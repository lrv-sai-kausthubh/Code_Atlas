"""Aura 1.0 NLU — intent detection and entity resolution.

This is CodeAtlas' own understanding layer: it reads the user's message,
classifies the intent (explicit patterns first, then the locally-trained
intent model when it is already loaded), and resolves any file/folder mentions
against the *authorized* project paths. No external AI is ever contacted.
"""
from __future__ import annotations

import re
from difflib import get_close_matches
from typing import Any

# Order matters: first matching pattern wins.
INTENT_PATTERNS: list[tuple[str, list[str]]] = [
    ("greet", [r"\b(hi|hello|hey|yo|hiya|howdy|morning|evening)\b"]),
    ("thanks", [r"\b(thanks|thank you|thx|ty|appreciate)\b"]),
    ("bye", [r"\b(bye|goodbye|see you|later|good night)\b"]),
    ("help", [r"\b(help|what can you do|how do you work|capabil|commands|features|what questions)\b"]),
    ("who", [r"\b(who are you|what are you|your name|who am i talking to|introduce yourself|tell me about yourself)\b"]),
    ("secrets", [r"\bsecret", r"\bsecurity", r"\bvulnerab", r"\bpassword", r"\bapi ?key", r"\btoken", r"\bleak", r"\bhardcod"]),
    ("cycles", [r"\bcycle", r"\bcircular", r"\bloop", r"\bscc\b", r"\bdependency graph (cycle|circular)"]),
    ("orphans", [r"\borphan", r"\bunused", r"\bdead code", r"\blonely", r"\bnever imported", r"\bnot referenced", r"\bno one imports"]),
    ("risk", [r"\brefactor", r"\brisk(y)?", r"\bmaintain", r"\bdebt", r"\bclean up", r"\bhigh risk", r"\brewrite", r"\bsmell"]),
    ("largest", [r"\blargest", r"\bbiggest", r"\bhuge", r"\benormous", r"\bgod file", r"\btoo big", r"\bbig files", r"\blong(est)? files"]),
    ("impact", [r"\bimpact", r"\bwhat breaks", r"\bif i (delete|remove|change|move)", r"\bbefore (deleting|removing|changing)", r"\baffected"]),
    ("compare", [r"\bcompare", r"\bdifference", r"\bvs\.?", r"\bversus", r"\bwhich is (bigger|smaller|worse|better|riskier)"]),
    ("dependents", [r"\bwho imports", r"\bwhat imports", r"\bimports it\b", r"\bimports this\b", r"\bdepends on it", r"\bdepend(s|ing)? on\b", r"\buses it\b", r"\buses this\b", r"\bwho depends", r"\breverse", r"\bwhich files? import"]),
    ("deps", [r"\bdependenc", r"\bimport", r"\bcouple", r"\brelationship", r"\bmodules\b", r"\barchitecture"]),
    ("find", [r"\bfind", r"\bsearch", r"\bwhere is", r"\bwhere are", r"\bwhich files?\b(?! (call|use|hit|request|import|depend))", r"\bwho has", r"\bwhat files?\b(?! (call|use|hit|request|import|depend))"]),
    ("functions", [r"\bfunction", r"\bmethod", r"\bcalled by", r"\bcalls\b", r"\bsignature", r"\bparameters"]),
    ("file", [r"\bwhat does .* do\b", r"\btell me about (the )?(file|module)", r"\bexplain", r"\bdescribe (the )?(file|module)", r"\bsummarize (the )?(file|module)", r"\bwhat is in (the )?(file|module)", r"\bcontents of", r"\bwhat does .* (contain|include|hold)\b", r"\bwhat( is|'s) (in|inside)\b", r"\bcontain(s|ing)?\b", r"\blist files? in\b"]),
    ("api", [r"\bapi call", r"\bexternal api", r"\brest\b", r"\bendpoint", r"\bhttp", r"\brequest", r"\bwebhook", r"\bfetch", r"\baxios", r"\bthird.party", r"\b(which|what) files? (call|use|hit|request)\b", r"\bcall(s|ed)? (the )?(api|endpoint|server)\b"]),
    ("health", [r"\bhealth", r"\bscore", r"\brating", r"\bquality", r"\bgrade", r"\bhow healthy", r"\bhealthy"]),
    ("roles", [r"\brole", r"\blayer", r"\barchetype", r"\bcategor", r"\btype of file", r"\bpattern"]),
    ("stats", [r"\bstats", r"\bstatistics", r"\bsummary", r"\boverview", r"\babout this repo", r"\babout this project", r"\btell me", r"\bdescribe the project"]),
]

INTENTS = {name for name, _ in INTENT_PATTERNS}


def classify(message: str, intent_model: dict[str, Any] | None = None) -> str:
    """Classify the user message into an intent.

    Explicit patterns win (they are crisp triggers); otherwise the locally
    trained intent model (already-loaded Aura artifact) is consulted for
    ambiguous phrasing. Returns "default" when nothing matches confidently.
    """
    lowered = message.lower()
    for intent, patterns in INTENT_PATTERNS:
        for pattern in patterns:
            if re.search(pattern, lowered):
                return intent
    if intent_model is not None:
        try:
            vectorizer = intent_model["vectorizer"]
            classifier = intent_model["classifier"]
            labels = intent_model["labels"]
            vector = vectorizer.transform([lowered])
            probs = classifier.predict_proba(vector)[0]
            best_index = int(probs.argmax())
            if probs[best_index] >= 0.45:
                return labels[best_index]
        except Exception:  # pragma: no cover - defensive
            return "default"
    return "default"


def _normalize(text: str) -> str:
    return re.sub(r"[^\w\s./_-]", " ", text.lower()).strip()


def _flatten(value: str) -> str:
    """Remove underscores and spaces so snake_case and plain phrasing match."""
    return re.sub(r"[\s_]+", "", value)


def resolve_entities(message: str, file_paths: list[str], folder_paths: list[str]) -> list[dict[str, Any]]:
    """Find file/folder mentions in the message.

    Matching strategy (highest confidence first):
      1. the full posix path appears verbatim in the message
      2. the unique basename appears verbatim (e.g. "core.ts")
      3. a unique stem closely matches a token (typo-tolerant, e.g. "core")
    Returns a list of {"kind", "path", "label", "confidence"} sorted by
    confidence, deduplicated per path.
    """
    text = _normalize(message)
    if not text:
        return []
    tokens = set(text.split())

    def dedupe(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
        seen: set[str] = set()
        unique: list[dict[str, Any]] = []
        for entry in sorted(entries, key=lambda item: item["confidence"], reverse=True):
            key = f"{entry['kind']}:{entry['path']}"
            if key not in seen:
                seen.add(key)
                unique.append(entry)
        return unique

    found: list[dict[str, Any]] = []

    # 1. Full path verbatim (case-insensitive, longest paths first).
    for path in sorted(file_paths + folder_paths, key=len, reverse=True):
        if path and path.lower() in text:
            kind = "folder" if path in folder_paths else "file"
            found.append(
                {
                    "kind": kind,
                    "path": path,
                    "label": path.rsplit("/", 1)[-1],
                    "confidence": 0.95,
                }
            )

    # 2. Unique basename verbatim (underscore-agnostic).
    plain_text = _flatten(text)
    basename_to_paths: dict[str, list[str]] = {}
    for path in file_paths + folder_paths:
        if not path:
            continue
        basename_to_paths.setdefault(path.rsplit("/", 1)[-1].lower(), []).append(path)
    for basename, paths in basename_to_paths.items():
        if len(basename) < 5:
            continue
        if basename not in text and _flatten(basename) not in plain_text:
            continue
        if len(paths) == 1 and basename_to_paths.get(basename, [paths[0]]) == [paths[0]]:
            path = paths[0]
            found.append(
                {
                    "kind": "folder" if path in folder_paths else "file",
                    "path": path,
                    "label": basename,
                    "confidence": 0.8,
                }
            )

    # 3. Typo-tolerant stem matching against unique stems (len >= 3),
    #    comparing underscores and spaces interchangeably.
    stem_to_paths: dict[str, list[str]] = {}
    for path in file_paths + folder_paths:
        if not path:
            continue
        basename = path.rsplit("/", 1)[-1]
        stem = basename.rsplit(".", 1)[0]
        if len(stem) >= 3:
            stem_to_paths.setdefault(stem.lower(), []).append(path)
    unique_stems = {stem for stem, paths in stem_to_paths.items() if len(paths) == 1}
    flat_stem_to_paths: dict[str, list[str]] = {}
    for stem, paths in stem_to_paths.items():
        flat_stem_to_paths.setdefault(_flatten(stem), []).extend(paths)
    unique_flat_stems = {
        stem for stem, paths in flat_stem_to_paths.items() if len(paths) == 1
    }
    for token in tokens:
        flat = _flatten(token)
        if len(flat) < 3:
            continue
        if flat in stem_to_paths:
            path = stem_to_paths[flat][0]
            found.append(
                {
                    "kind": "folder" if path in folder_paths else "file",
                    "path": path,
                    "label": path.rsplit("/", 1)[-1],
                    "confidence": 0.6,
                }
            )
            continue
        exact = flat_stem_to_paths.get(flat)
        if exact:
            path = exact[0]
            found.append(
                {
                    "kind": "folder" if path in folder_paths else "file",
                    "path": path,
                    "label": path.rsplit("/", 1)[-1],
                    "confidence": 0.6,
                }
            )
            continue
        close = get_close_matches(flat, unique_flat_stems, n=1, cutoff=0.62)
        if close:
            path = flat_stem_to_paths[close[0]][0]
            found.append(
                {
                    "kind": "folder" if path in folder_paths else "file",
                    "path": path,
                    "label": path.rsplit("/", 1)[-1],
                    "confidence": 0.6,
                }
            )

    return dedupe(found)
