"""Aura 1.0 agent — CodeAtlas' own AI architecture copilot.

The agent reasons over the *already-authorized* repository context:
repo analysis, ML insights (health/risk/roles), per-file intelligence
(functions, imports, api calls), and the import graph. It resolves files the
user mentions, plans tool calls per intent, and generates answers strictly
from facts present in the context — it never invents metrics and never
contacts an external AI service.

Authorization happens before retrieval (see New_version_prompt.md §8/§31):
the API layer builds the context from the same filtered graph the user sees.
"""
from __future__ import annotations

import re
from typing import Any

from app.services.aura import nlu

EMOTIONS = ("neutral", "happy", "excited", "concerned", "alert", "thinking", "sad", "listening")

GREETINGS = (
    "Hey! I'm Aura 1.0 — CodeAtlas' own AI architecture copilot, built and trained in-house. "
    "Ask me about this codebase's health, risky files, circular dependencies, what a module "
    "does, or who imports what. I read the map through your permissions."
)

NO_PROJECT = (
    "I don't have a repository open to reason about yet. Open a project and I'll read its map "
    "through your permissions — then ask me about its health, risk, or dependencies."
)


def _fmt_number(value: Any) -> str:
    try:
        return f"{int(value):,}"
    except (TypeError, ValueError):
        return "0"


def _flatten(value: str) -> str:
    """Remove underscores and spaces so snake_case and plain phrasing match."""
    return re.sub(r"[\s_]+", "", value)


class KnowledgeBase:
    """Indexes over the authorized context: nodes, per-file details, graph."""

    def __init__(self, context: dict[str, Any]):
        self.context = context
        self.project = context.get("project")
        self.analysis = context.get("analysis") or {}
        self.insights = context.get("ml_insights") or {}
        self.details = context.get("file_details") or {}
        self.calls = context.get("function_calls") or []

        self.nodes: dict[str, dict[str, Any]] = {}
        for node in context.get("nodes") or []:
            path = node.get("path")
            if path:
                self.nodes[path] = node
        self.file_paths = sorted(
            path for path, node in self.nodes.items() if node.get("type") == "file"
        )
        self.folder_paths = sorted(
            path for path, node in self.nodes.items() if node.get("type") == "folder"
        )

        self._imports: dict[str, list[str]] = {}
        self._dependents: dict[str, list[str]] = {}
        for detail in self.details.values():
            source = detail.get("path")
            if not source or source not in self.nodes:
                continue
            for entry in detail.get("imports") or []:
                target = entry.get("path") if isinstance(entry, dict) else entry
                if not target or target not in self.nodes:
                    continue
                self._imports.setdefault(source, []).append(target)
                self._dependents.setdefault(target, []).append(source)

        self._function_index: dict[str, list[dict[str, Any]]] = {}
        for detail in self.details.values():
            path = detail.get("path")
            for function in detail.get("functions") or []:
                name = function.get("name", "")
                if name:
                    self._function_index.setdefault(name.lower(), []).append(
                        {"path": path, "name": name, "signature": function.get("signature", "")}
                    )

        self._api_index: dict[str, list[str]] = {}
        for detail in self.details.values():
            path = detail.get("path")
            for call in detail.get("api_calls") or []:
                call_value = (
                    call.get("url") or call.get("endpoint") or call.get("path") or ""
                    if isinstance(call, dict)
                    else call
                )
                key = re.sub(r"[^a-z0-9/._-]", " ", str(call_value).lower()).strip()
                if key:
                    self._api_index.setdefault(key, []).append(path)

    # ── tools ────────────────────────────────────────────────────────────
    def health(self) -> dict[str, Any]:
        insights = self.insights
        learned = insights.get("health_score")
        return {
            "learned": learned,
            "score": learned if learned is not None else self.analysis.get("health_score"),
            "confidence": insights.get("health_confidence"),
            "risk_tier": insights.get("risk_tier") or "unknown",
            "top_factors": insights.get("top_factors") or [],
            "candidate_count": len(insights.get("refactor_candidates") or []),
        }

    def file_insight(self, path: str) -> dict[str, Any]:
        detail = self.details.get(f"file:{path}") or {}
        node = self.nodes.get(path) or {}
        per_file = (self.insights.get("per_file") or {}).get(path) or {}
        functions = detail.get("functions") or []
        imports = detail.get("imports") or []
        external_imports = detail.get("external_imports") or []
        api_calls = detail.get("api_calls") or []
        return {
            "path": path,
            "kind": node.get("type", "file"),
            "lines": node.get("lines") or 0,
            "size_bytes": node.get("size_bytes") or 0,
            "role": per_file.get("role_label") or per_file.get("role"),
            "risk_tier": per_file.get("risk_tier"),
            "risk_score": per_file.get("risk_score"),
            "reason": per_file.get("reason"),
            "function_count": len(functions),
            "import_count": len(imports),
            "external_import_count": len(external_imports),
            "api_call_count": len(api_calls),
            "functions": functions[:8],
            "api_calls": api_calls[:5],
        }

    def dependencies(self, path: str, depth: int = 1) -> list[tuple[str, int]]:
        """Import closure: (path, depth)."""
        result: list[tuple[str, int]] = []
        queue = [(path, 0)]
        visited: set[str] = set()
        while queue:
            current, level = queue.pop(0)
            if current in visited:
                continue
            visited.add(current)
            if current != path:
                result.append((current, level))
            if level >= depth:
                continue
            for target in self._imports.get(current, []):
                queue.append((target, level + 1))
        return result

    def dependents(self, path: str, depth: int = 1) -> list[tuple[str, int]]:
        """Reverse import closure: (path, depth)."""
        result: list[tuple[str, int]] = []
        queue = [(path, 0)]
        visited: set[str] = set()
        while queue:
            current, level = queue.pop(0)
            if current in visited:
                continue
            visited.add(current)
            if current != path:
                result.append((current, level))
            if level >= depth:
                continue
            for source in self._dependents.get(current, []):
                queue.append((source, level + 1))
        return result

    def impact(self, path: str) -> dict[str, Any]:
        dependents = [entry[0] for entry in self.dependents(path, depth=3)]
        per_file = self.insights.get("per_file") or {}
        lines = sum(self.nodes.get(p, {}).get("lines", 0) for p in dependents)
        risky = [p for p in dependents if (per_file.get(p) or {}).get("risk_tier") == "high"]
        calls = sum(
            1 for call in self.calls if call.get("callee_file") == path
        )
        return {
            "direct": [entry[0] for entry in self.dependents(path, depth=1)],
            "total": dependents,
            "lines": lines,
            "risky": risky,
            "direct_calls": calls,
        }

    def compare(self, path_a: str, path_b: str) -> dict[str, Any]:
        a = self.file_insight(path_a)
        b = self.file_insight(path_b)
        return {"a": a, "b": b}

    def find_functions(self, query: str) -> list[dict[str, Any]]:
        q = _flatten(query.lower())
        matches: list[dict[str, Any]] = []
        for name, entries in self._function_index.items():
            if q and q in _flatten(name):
                matches.extend(entries[:1])
        return matches[:8]

    def find_api(self, query: str) -> list[tuple[str, str]]:
        q = _flatten(query.lower())
        hits: list[tuple[str, str]] = []
        for key, paths in self._api_index.items():
            if q and q in _flatten(key):
                for path in paths[:2]:
                    hits.append((path, key))
        return hits[:8]

    def search_paths(self, query: str) -> list[str]:
        q = _flatten(query.lower())
        if not q:
            return self.file_paths[:10]
        return [
            path
            for path in self.file_paths + self.folder_paths
            if q in _flatten(path.lower())
        ][:10]

    def largest(self, count: int = 5) -> list[dict[str, Any]]:
        ranked = sorted(
            self.file_paths,
            key=lambda path: self.nodes.get(path, {}).get("lines", 0) or 0,
            reverse=True,
        )
        return [
            {
                "path": path,
                "lines": self.nodes.get(path, {}).get("lines", 0) or 0,
                "size_bytes": self.nodes.get(path, {}).get("size_bytes", 0) or 0,
            }
            for path in ranked[:count]
        ]

    def most_connected(self, count: int = 5) -> list[tuple[str, int]]:
        ranked = sorted(
            self._dependents,
            key=lambda path: len(self._dependents.get(path, [])),
            reverse=True,
        )
        return [(path, len(self._dependents.get(path, []))) for path in ranked[:count]]

    def roles_distribution(self) -> dict[str, int]:
        return dict(self.insights.get("roles") or {})

    def role_examples(self) -> list[tuple[str, str]]:
        per_file = self.insights.get("per_file") or {}
        examples: list[tuple[str, str]] = []
        seen: set[str] = set()
        for path, entry in per_file.items():
            role = entry.get("role")
            if role and role not in seen:
                seen.add(role)
                examples.append((role, path))
        return examples

    def external_api_summary(self) -> list[tuple[str, list[str]]]:
        return [
            (key, paths[:3])
            for key, paths in sorted(self._api_index.items(), key=lambda item: -len(item[1]))[:5]
        ]


# ─────────────────────────────────────────────────────────────────────────────
# Generators (each returns emotion, reply, actions)
# ─────────────────────────────────────────────────────────────────────────────
def _describe_candidates(insights: dict[str, Any]) -> str:
    candidates = insights.get("refactor_candidates") or []
    if not candidates:
        return "The model sees no standout refactor candidates right now."
    lines = []
    for entry in candidates[:4]:
        role = entry.get("role_label") or entry.get("role") or "module"
        lines.append(f"{entry.get('path')} — {entry.get('risk_tier')} risk, {role}")
    return "Aura's model recommends focusing on these: " + "; ".join(lines) + "."


def _gen_health(kb: KnowledgeBase) -> tuple[str, str, list[dict[str, Any]]]:
    health = kb.health()
    confidence = health["confidence"]
    confidence_text = (
        f" with {int((confidence or 0) * 100)}% model confidence"
        if confidence is not None
        else ""
    )
    reply = f"The Aura model scores this repo {health['score']}/100{confidence_text} — {health['risk_tier']} risk."
    factors = health["top_factors"][:3]
    if factors:
        names = ", ".join(factor.get("feature", "") for factor in factors)
        reply += f" Top health factors: {names}."
    emotion = "happy" if health["risk_tier"] in ("low", "unknown") else "concerned"
    return emotion, reply, []


def _gen_risk(kb: KnowledgeBase) -> tuple[str, str, list[dict[str, Any]]]:
    health = kb.health()
    reply = f"{_describe_candidates(kb.insights)}"
    if health["score"] is not None:
        reply = f"Repo health is {health['score']}/100 ({health['risk_tier']} risk). {reply}"
    return "thinking", reply, []


def _gen_cycles(kb: KnowledgeBase) -> tuple[str, str, list[dict[str, Any]]]:
    cycles = kb.analysis.get("circular_dependencies") or []
    if not cycles:
        return "happy", "No circular dependencies detected — the import graph is acyclic. Clean.", []
    names = " → ".join(cycles[0][:5])
    return "concerned", (
        f"I found {len(cycles)} circular dependencies. The tightest is {names}. "
        "Cycles make modules harder to reason about and resist refactoring."
    ), []


def _gen_orphans(kb: KnowledgeBase) -> tuple[str, str, list[dict[str, Any]]]:
    orphans = kb.analysis.get("orphan_files") or []
    if not orphans:
        return "happy", "Every analyzed module is referenced somewhere — no orphan files.", []
    sample = ", ".join(orphans[:4])
    return "thinking", (
        f"{len(orphans)} files aren't imported by anything. If they're dead code they're safe to "
        f"archive; examples: {sample}."
    ), []


def _gen_secrets(kb: KnowledgeBase) -> tuple[str, str, list[dict[str, Any]]]:
    issues = kb.analysis.get("security_issues") or []
    if not issues:
        return "happy", "No hardcoded secrets flagged in this repository. Good hygiene.", []
    kinds: dict[str, int] = {}
    for issue in issues:
        kinds[issue.get("type", "Finding")] = kinds.get(issue.get("type", "Finding"), 0) + 1
    summary = ", ".join(f"{count} {kind}" for kind, count in list(kinds.items())[:4])
    return "alert", (
        f"I flagged {len(issues)} possible secret issues ({summary}). Review them before sharing."
    ), []


def _gen_largest(kb: KnowledgeBase, count: int = 5) -> tuple[str, str, list[dict[str, Any]]]:
    largest = kb.largest(count)
    if not largest:
        return "neutral", "No file size data available.", []
    top = largest[0]
    lines = "; ".join(
        f"{entry['path']} ({_fmt_number(entry['lines'])} lines)" for entry in largest[1:4]
    )
    actions = [{"type": "select", "path": top["path"], "label": "Open largest file"}]
    return "thinking", (
        f"The largest file is {top['path']} — {_fmt_number(top['lines'])} lines, "
        f"{_fmt_number(top['size_bytes'])} bytes. Next up: {lines}."
    ), actions


def _gen_deps(kb: KnowledgeBase) -> tuple[str, str, list[dict[str, Any]]]:
    analysis = kb.analysis
    chain = analysis.get("longest_import_chain") or {}
    hubs = kb.most_connected(4)
    hub_text = ""
    if hubs:
        hub_text = " Most-imported modules: " + ", ".join(
            f"{path} ({count} importers)" for path, count in hubs
        ) + "."
    return "neutral", (
        f"On average each file has {analysis.get('average_dependencies', 0)} dependencies; "
        f"{_fmt_number(analysis.get('total_imports', 0))} import edges total. Longest import chain "
        f"is {chain.get('length', 0)} files.{hub_text}"
    ), []


def _gen_roles(kb: KnowledgeBase) -> tuple[str, str, list[dict[str, Any]]]:
    roles = kb.roles_distribution()
    if not roles:
        return "neutral", "No role clustering available for this project yet.", []
    labels = {
        "core": "core logic",
        "glue": "integration hub",
        "thin": "thin layer",
        "data": "data/config",
    }
    described = ", ".join(
        f"{count} {labels.get(role, role)}" for role, count in sorted(roles.items())
    )
    examples = kb.role_examples()
    example_text = ""
    if examples:
        example_text = " Examples: " + "; ".join(
            f"{label} → {path}" for label, path in examples[:4]
        ) + "."
    return "happy", f"Aura clustered the modules: {described}.{example_text}", []


def _gen_stats(kb: KnowledgeBase) -> tuple[str, str, list[dict[str, Any]]]:
    name = kb.project or "this repository"
    analysis = kb.analysis
    health = kb.health()
    reply = (
        f"{name} has {_fmt_number(kb.context.get('files', 0))} files across "
        f"{_fmt_number(kb.context.get('folders', 0))} folders and "
        f"{len(kb.context.get('languages') or {})} languages. "
        f"{_fmt_number(analysis.get('total_lines', 0))} lines of code, "
        f"{_fmt_number(analysis.get('total_imports', 0))} import edges. "
        f"Model health: {health['score']}/100 ({health['risk_tier']} risk)."
    )
    return "excited" if kb.project else "neutral", reply, []


def _gen_file(kb: KnowledgeBase, entities: list[dict[str, Any]]) -> tuple[str, str, list[dict[str, Any]]]:
    if not entities:
        suggestions = ", ".join(kb.file_paths[:4])
        reply = "Which file? I can look at any module you can see."
        if suggestions:
            reply += f" Try asking about {suggestions}."
        return "listening", reply, []
    entity = entities[0]
    path = entity["path"]
    if entity["kind"] == "folder":
        children = [p for p in kb.file_paths if p.startswith(path + "/")]
        if not children:
            return "neutral", f"The {path} folder has no visible source files.", []
        sample = ", ".join(children[:6])
        return "happy", (
            f"The {path} folder contains {len(children)} files. "
            f"Examples: {sample}. Ask about any of them and I'll break it down."
        ), [{"type": "select", "path": path, "label": f"Open {path}"}]
    info = kb.file_insight(path)
    role_text = f" The model classifies it as {info['role']}." if info.get("role") else ""
    risk_text = ""
    if info.get("risk_tier"):
        risk_text = f" Refactor risk: {info['risk_tier']}."
    functions = info["functions"]
    function_text = ""
    if functions:
        function_text = " Top functions: " + "; ".join(
            f"{fn.get('name')}(…)" for fn in functions[:5]
        ) + "."
    reply = (
        f"{path} is {_fmt_number(info['lines'])} lines with {_fmt_number(info['function_count'])} "
        f"functions and {info['import_count']} local imports ({info['external_import_count']} "
        f"external).{role_text}{risk_text}{function_text}"
    )
    return "happy", reply, [{"type": "select", "path": path, "label": f"Open {path}"}]


def _gen_dependents(kb: KnowledgeBase, entities: list[dict[str, Any]]) -> tuple[str, str, list[dict[str, Any]]]:
    if not entities:
        return "listening", "Tell me which file — for example \"who imports src/api.ts?\".", []
    path = entities[0]["path"]
    direct = [entry[0] for entry in kb.dependents(path, depth=1)]
    if not direct:
        return "happy", f"Nothing imports {path} — it's an orphan or an entry point.", []
    impact = kb.impact(path)
    risky_text = ""
    if impact["risky"]:
        risky_text = " Among them, high-risk modules: " + ", ".join(impact["risky"][:3]) + "."
    sample = ", ".join(direct[:6])
    extra = f" ({len(impact['total'])} including transitive)" if len(impact["total"]) > len(direct) else ""
    actions = [{"type": "select", "path": path, "label": f"Open {path}"}]
    return "thinking", (
        f"{len(direct)} modules import {path} directly{extra}: {sample}. "
        f"Together they span ~{_fmt_number(impact['lines'])} lines.{risky_text}"
    ), actions


def _gen_impact(kb: KnowledgeBase, entities: list[dict[str, Any]]) -> tuple[str, str, list[dict[str, Any]]]:
    if not entities:
        return "listening", "Which file are you thinking of changing?", []
    path = entities[0]["path"]
    impact = kb.impact(path)
    direct = impact["direct"]
    if not direct and not impact["direct_calls"]:
        return "happy", f"Changing {path} looks low-risk — nothing imports it directly.", []
    parts = [f"Changing {path} touches {len(impact['total'])} dependent files"]
    if impact["direct_calls"]:
        parts.append(f"{impact['direct_calls']} traced function calls")
    risky = impact["risky"]
    if risky:
        parts.append(f"including risky modules {', '.join(risky[:3])}")
    parts.append(f"~{_fmt_number(impact['lines'])} lines affected")
    return "concerned", ". ".join(parts) + ".", [{"type": "select", "path": path, "label": f"Open {path}"}]


def _gen_compare(kb: KnowledgeBase, entities: list[dict[str, Any]]) -> tuple[str, str, list[dict[str, Any]]]:
    files = [entity["path"] for entity in entities if entity["kind"] == "file"]
    if len(files) < 2:
        return "listening", "Compare which two files? Name both, e.g. \"compare api.ts and store.py\".", []
    a_path, b_path = files[:2]
    result = kb.compare(a_path, b_path)
    a, b = result["a"], result["b"]
    reply = (
        f"{a['path']}: {_fmt_number(a['lines'])} lines, {a['function_count']} functions, "
        f"{a['import_count']} imports, role {a['role'] or 'n/a'}, risk {a['risk_tier'] or 'n/a'}."
        f" {b['path']}: {_fmt_number(b['lines'])} lines, {b['function_count']} functions, "
        f"{b['import_count']} imports, role {b['role'] or 'n/a'}, risk {b['risk_tier'] or 'n/a'}."
    )
    actions = [
        {"type": "select", "path": a_path, "label": f"Open {a_path}"},
        {"type": "select", "path": b_path, "label": f"Open {b_path}"},
    ]
    return "thinking", reply, actions


def _gen_find(kb: KnowledgeBase, message: str) -> tuple[str, str, list[dict[str, Any]]]:
    query = re.sub(r"^(find|search for|search|where is|where are|which file|what file|who has)\b", "", message).strip(" .,!?:;")
    query = query.strip("'\"")
    if len(query) < 2:
        return "listening", "What should I search for — a file name, function, or API?", []
    paths = kb.search_paths(query)
    functions = kb.find_functions(query)
    parts = []
    actions: list[dict[str, Any]] = []
    if paths:
        parts.append("Files matching: " + ", ".join(paths[:8]))
        first = paths[0]
        if first in kb.file_paths or first in kb.folder_paths:
            actions.append({"type": "select", "path": first, "label": f"Open {first}"})
    if functions:
        parts.append("Functions matching: " + "; ".join(
            f"{fn['name']} in {fn['path']}" for fn in functions[:6]
        ))
        if not actions and functions:
            actions.append({"type": "select", "path": functions[0]["path"], "label": "Open file"})
    if not parts:
        return "neutral", f"I couldn't find anything matching \"{query}\" in your authorized view.", []
    return "happy", " ".join(parts), actions


def _gen_api(kb: KnowledgeBase, message: str) -> tuple[str, str, list[dict[str, Any]]]:
    summary = kb.external_api_summary()
    if not summary:
        return "neutral", "I don't see any external API calls in the visible modules.", []
    keyword = re.sub(r"[^a-z0-9]", "", message.lower())
    if keyword:
        hits = kb.find_api(keyword)
        if hits:
            sample = "; ".join(f"{path} → {api}" for path, api in hits[:6])
            return "thinking", f"Modules calling \"{keyword}\": {sample}.", []
    top = ", ".join(f"{key} (in {len(paths)} files)" for key, paths in summary[:4])
    return "neutral", f"External API surface: {top}. Ask about a specific endpoint to see callers.", []


def _gen_functions(kb: KnowledgeBase, entities: list[dict[str, Any]]) -> tuple[str, str, list[dict[str, Any]]]:
    calls = kb.calls
    cross = sum(1 for call in calls if call.get("callee_file"))
    external = sum(1 for call in calls if call.get("is_external"))
    if entities and entities[0]["kind"] == "file":
        info = kb.file_insight(entities[0]["path"])
        reply = (
            f"{info['path']} defines {_fmt_number(info['function_count'])} functions "
            f"and {_fmt_number(info['api_call_count'])} API calls."
        )
        if info["functions"]:
            reply += " Top: " + "; ".join(
                f"{fn.get('name')} — {fn.get('signature', '')[:60]}" for fn in info["functions"][:4]
            ) + "."
        return "thinking", reply, [{"type": "select", "path": entities[0]["path"], "label": "Open file"}]
    return "thinking", (
        f"I can see {_fmt_number(len(calls))} traced calls across the files you can read "
        f"({cross} cross-file, {external} external). Name a file to see its functions."
    ), []


# ─────────────────────────────────────────────────────────────────────────────
# Planner + public entry point
# ─────────────────────────────────────────────────────────────────────────────
def _intent_model():
    """Return the locally-trained intent model only when already loaded."""
    try:
        from app.services.ml import model as aura_model

        service = aura_model._service
        return service.get("intent_model") if service else None
    except Exception:  # pragma: no cover - defensive
        return None


def detect_intent_from_question(message: str, intent_model: dict[str, Any] | None = None) -> str:
    """Lightweight wrapper over the NLU layer used by callers that only need the intent."""
    return nlu.classify(message, intent_model)


def answer(context: dict[str, Any], message: str) -> tuple[str, str, list[str], list[dict[str, Any]]]:
    """Run the agent: returns (emotion, reply, thinking_steps, actions)."""
    intent = nlu.classify(message, _intent_model())
    kb = KnowledgeBase(context)
    entities = nlu.resolve_entities(message, kb.file_paths, kb.folder_paths)

    thinking = [
        f"Parsed intent → {intent}",
        f"Resolved {len(entities)} module mention(s)",
        "Filtered to your authorized view of the graph",
    ]
    if entities:
        top = entities[0]
        thinking.append(f"Key module: {top['path']}")

    actions: list[dict[str, Any]] = []
    emotion = "neutral"
    reply = ""

    if not kb.project and intent not in ("greet", "thanks", "bye", "help", "who"):
        return "listening", NO_PROJECT, thinking, []

    if intent == "greet":
        emotion, reply = "happy", GREETINGS
    elif intent == "thanks":
        emotion, reply = "happy", "Anytime. That's what an in-house architect copilot is for."
    elif intent == "bye":
        emotion, reply = "neutral", "Stay sharp — I'll be here when you need the map read."
    elif intent == "help":
        emotion, reply = "excited", (
            "I reason over your authorized view of the codebase with CodeAtlas' own models. Ask me: "
            "how healthy is this repo? which files should we refactor? what does src/api.ts do? "
            "who imports store? what breaks if I delete X? compare two files, or search for a function."
        )
    elif intent == "who":
        emotion, reply = "excited", (
            "I'm Aura 1.0 — CodeAtlas' own AI agent. My models are trained and served in-house: "
            "a health/risk/role model over the repository graph, plus a question classifier. "
            "I never call external AI services, and I only reason about what you're allowed to see."
        )
    elif intent == "secrets":
        emotion, reply, actions = _gen_secrets(kb)
    elif intent == "cycles":
        emotion, reply, actions = _gen_cycles(kb)
    elif intent == "orphans":
        emotion, reply, actions = _gen_orphans(kb)
    elif intent == "risk":
        emotion, reply, actions = _gen_risk(kb)
    elif intent == "largest":
        emotion, reply, actions = _gen_largest(kb)
    elif intent == "health":
        emotion, reply, actions = _gen_health(kb)
    elif intent == "deps":
        emotion, reply, actions = _gen_deps(kb)
    elif intent == "roles":
        emotion, reply, actions = _gen_roles(kb)
    elif intent == "stats":
        emotion, reply, actions = _gen_stats(kb)
    elif intent == "file":
        emotion, reply, actions = _gen_file(kb, entities)
    elif intent == "dependents":
        emotion, reply, actions = _gen_dependents(kb, entities)
    elif intent == "impact":
        emotion, reply, actions = _gen_impact(kb, entities)
    elif intent == "compare":
        emotion, reply, actions = _gen_compare(kb, entities)
    elif intent == "find":
        emotion, reply, actions = _gen_find(kb, message)
    elif intent == "api":
        emotion, reply, actions = _gen_api(kb, message)
    elif intent == "functions":
        emotion, reply, actions = _gen_functions(kb, entities)
    else:
        emotion, reply, actions = _gen_stats(kb)
        reply = f"I don't have a precise answer for that yet, but here's the state of the map: {reply}"

    return emotion, reply, thinking, actions
