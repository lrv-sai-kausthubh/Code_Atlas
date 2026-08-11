"""Aura 1.0 — locally-trained question intent classifier.

A small TF-IDF + logistic-regression model trained in-house on a curated
corpus of repository-QA phrasings. It is cached inside the Aura artifact
(joblib) and used by the NLU layer for ambiguous queries; explicit patterns
still win. No external AI service is involved.
"""
from __future__ import annotations

from typing import Any

FILES = [
    "src/api.ts",
    "src/store.py",
    "app/services/auth.py",
    "components/ui/button.tsx",
    "lib/db.py",
    "src/utils.py",
    "backend/routes.py",
    "index.ts",
    "config.yaml",
    "app/main.py",
]
FUNCTIONS = [
    "handleLogin",
    "fetchUser",
    "saveProject",
    "renderNode",
    "connectDb",
    "parseQuery",
    "buildGraph",
]
ENDPOINTS = [
    "/api/projects",
    "/api/upload",
    "api.github.com",
    "stripe.com",
    "openai.com",
]

FOLDERS = [
    "src",
    "app",
    "components",
    "lib",
    "backend",
    "tests",
    "public",
]

TEMPLATES: dict[str, list[str]] = {
    "greet": ["hi", "hello there", "hey", "good morning", "howdy", "hello aura", "yo"],
    "thanks": ["thanks", "thank you", "thx a lot", "i appreciate it", "thanks a bunch"],
    "bye": ["bye", "goodbye", "see you later", "good night", "later"],
    "help": [
        "help",
        "what can you do",
        "what are your capabilities",
        "how do you work",
        "list your commands",
        "what features do you have",
        "what questions can i ask",
    ],
    "who": [
        "who are you",
        "what are you",
        "what is your name",
        "who am i talking to",
        "introduce yourself",
        "tell me about yourself",
        "are you an ai",
    ],
    "secrets": [
        "are there any secrets",
        "any security issues",
        "find hardcoded passwords",
        "check for api keys",
        "any vulnerable code",
        "where are tokens stored",
        "any leaks in the repo",
    ],
    "cycles": [
        "are there circular dependencies",
        "any import cycles",
        "check for dependency loops",
        "is there a cycle in the graph",
        "any circular imports",
        "are any modules in a loop",
    ],
    "orphans": [
        "any orphan files",
        "which files are unused",
        "find dead code",
        "any lonely modules",
        "what is never imported",
        "any files not referenced",
        "who is not imported by anyone",
    ],
    "risk": [
        "which files should we refactor",
        "what is risky",
        "any high risk modules",
        "where is the tech debt",
        "what needs cleanup",
        "which modules are hard to maintain",
        "any code smells",
    ],
    "largest": [
        "what is the largest file",
        "biggest files in the repo",
        "which file is huge",
        "any god files",
        "what are the longest files",
        "which file has the most lines",
    ],
    "impact": [
        "what breaks if i delete {f}",
        "impact of removing {f}",
        "what depends on {f} if i change it",
        "who is affected by changing {f}",
        "can i safely remove {f}",
        "what is the impact of refactoring {f}",
    ],
    "compare": [
        "compare {f} and {f2}",
        "difference between {f} and {f2}",
        "which is riskier {f} or {f2}",
        "how does {f} compare to {f2}",
        "is {f} bigger than {f2}",
        "{f} vs {f2}",
    ],
    "dependents": [
        "who imports {f}",
        "what imports {f}",
        "which files use {f}",
        "what depends on {f}",
        "who calls code in {f}",
        "what uses this module {f}",
    ],
    "deps": [
        "what are the dependencies",
        "how coupled is this repo",
        "which modules depend on each other",
        "what is the import structure",
        "tell me about the architecture",
        "what does {f} depend on",
        "what does {f} import",
    ],
    "find": [
        "find {f}",
        "search for {fn}",
        "where is {fn} defined",
        "which file has {fn}",
        "where is the file {f}",
        "find files containing {fn}",
    ],
    "functions": [
        "how many functions are there",
        "what functions does {f} define",
        "what are the methods in {f}",
        "show me the signatures in {f}",
        "who calls {fn}",
    ],
    "file": [
        "what does {f} do",
        "tell me about {f}",
        "explain the module {f}",
        "summarize what {f} does",
        "what is inside {f}",
        "describe the file {f}",
        "what is the purpose of {f}",
        "what does the {folder} folder contain",
        "what is in the {folder} folder",
        "list files in {folder}",
        "what does {folder} contain",
    ],
    "api": [
        "which files call {api}",
        "what external apis do we use",
        "where is {api} called",
        "any rest calls",
        "which modules hit {api}",
        "show me the api calls",
        "what endpoints are used",
    ],
    "health": [
        "how healthy is this repo",
        "what is the health score",
        "rate this codebase",
        "give me a quality score",
        "how good is this code",
        "is this repo healthy",
        "what grade would you give",
    ],
    "roles": [
        "what are the module roles",
        "which files are core logic",
        "how are the modules categorized",
        "which files are glue code",
        "what is the architecture pattern",
        "which are data files",
    ],
    "stats": [
        "give me an overview",
        "summarize the project",
        "tell me about this repo",
        "repo statistics",
        "how many files are there",
        "describe the project",
        "what languages are used",
    ],
    "default": [
        "tell me a joke",
        "what is the meaning of life",
        "play some music",
        "how is the weather",
        "order a pizza",
        "what time is it",
    ],
}


def _build_corpus() -> list[tuple[str, str]]:
    """Deterministic-ish corpus with varied fill-ins (seeded by caller rng)."""
    import numpy as np

    rng = np.random.default_rng(42)
    corpus: list[tuple[str, str]] = []
    for intent, templates in TEMPLATES.items():
        for _ in range(45):
            template = templates[int(rng.integers(len(templates)))]
            filled = template.format(
                f=FILES[int(rng.integers(len(FILES)))],
                f2=FILES[int(rng.integers(len(FILES)))],
                fn=FUNCTIONS[int(rng.integers(len(FUNCTIONS)))],
                api=ENDPOINTS[int(rng.integers(len(ENDPOINTS)))],
                folder=FOLDERS[int(rng.integers(len(FOLDERS)))],
            )
            corpus.append((filled, intent))
    return corpus


def train_intent_model() -> dict[str, Any]:
    """Train and return {vectorizer, classifier, labels} for the NLU layer."""
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression

    corpus = _build_corpus()
    texts = [text for text, _ in corpus]
    labels = [label for _, label in corpus]

    vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
    matrix = vectorizer.fit_transform(texts)
    classifier = LogisticRegression(max_iter=600, C=1.0)
    classifier.fit(matrix, labels)
    return {
        "vectorizer": vectorizer,
        "classifier": classifier,
        "labels": classifier.classes_.tolist(),
    }
