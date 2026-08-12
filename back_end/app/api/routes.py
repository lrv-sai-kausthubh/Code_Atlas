import asyncio
import json
import threading
import time
from collections import Counter
from io import BytesIO
from pathlib import Path, PurePosixPath
import re
import shutil
import uuid
import urllib.error
import urllib.request
import zipfile
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from app.services import authorization as authz
from app.services.events import bus
from app.services.source_analyzer import analyze_source_files

router = APIRouter()

PREVIEW_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico", ".avif", ".pdf"}
PROJECTS_ROOT = Path(__file__).resolve().parents[3] / "data_base" / "uploads"
PROJECT_STORES: dict[str, dict] = {}

MAX_ZIP_BYTES = 200 * 1024 * 1024
MAX_EXTRACTED_BYTES = 250 * 1024 * 1024

UPLOAD_TASKS: dict[str, dict] = {}
UPLOAD_TASKS_LOCK = threading.Lock()


def _require_authenticated(token: str) -> dict:
    """Resolve a session token to a user; raise 401 when invalid."""
    from app.api.auth import _current_user

    user = _current_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    return user


def _user_role(email: str) -> str:
    from app.api.auth import USERS, _is_super_admin

    if _is_super_admin(email):
        return authz.SUPER_ADMIN
    user = USERS.get(email)
    if not user:
        return authz.DEFAULT_ROLE
    return user.get("role", authz.DEFAULT_ROLE)


def _user_teams(email: str) -> set[str]:
    return authz.user_team_ids(email)


def _project_store(project_id: str) -> dict | None:
    """Return the project store from memory, or rebuild it from persisted state."""
    store = PROJECT_STORES.get(project_id)
    if store:
        return store
    result = authz.load_project_graph(project_id)
    if not result:
        return None
    preview_files = [node["path"] for node in result.get("nodes", [])
                     if node.get("type") == "file"
                     and PurePosixPath(node.get("path", "")).suffix.lower() in PREVIEW_EXTENSIONS]
    store = {"root": (PROJECTS_ROOT / project_id).resolve(), "preview_files": sorted(preview_files)}
    PROJECT_STORES[project_id] = store
    return store


@router.get("/")
def root():
    return {
        "message": "Welcome to CodeAtlas Backend 🚀"
    }


@router.get("/api/status")
def status():
    return {
        "status": "working",
        "message": "Frontend and Backend Connected Successfully!"
    }


@router.get("/api/events")
async def stream_events(request: Request, token: str = Query("")):
    """Server-Sent Events stream pushing live change events to authenticated clients."""
    _require_authenticated(token)
    queue = bus.subscribe()

    async def generate():
        try:
            yield "retry: 3000\n\n"
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
                    continue
                if event.get("type") == "bus.shutdown":
                    return
                yield f"data: {json.dumps(event)}\n\n"
        finally:
            bus.unsubscribe(queue)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


IGNORED_DIRECTORIES = {"node_modules", ".git", "dist", "build", "__pycache__", "venv", ".venv", ".env", ".idea", ".vscode", ".DS_Store", "target", "out", "bin", "obj"}

ENV_FILE_NAMES = {".env", ".env.local", ".env.example", ".env.development", ".env.test", ".env.production", ".env.staging", ".env.development.local", ".env.test.local", ".env.production.local"}

SECRET_PATTERNS = [
    (re.compile(r"AKIA[0-9A-Z]{16}", re.IGNORECASE), "AWS Access Key"),
    (re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----", re.IGNORECASE), "Private Key"),
    (re.compile(r"(?i)(?:password|passwd|pwd|passphrase)\s*[:=]\s*[\"'][^\"']{4,}[\"']"), "Hardcoded Password"),
    (re.compile(r"(?i)(?:api[_-]?key|apikey|secret[_-]?key|client[_-]?secret|access[_-]?token|auth[_-]?token|private[_-]?key|firebase[_-]?key|slack[_-]?token)\s*[:=]\s*[\"'][^\"']{8,}[\"']"), "API Key / Token"),
]
LANGUAGES = {
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".py": "Python",
    ".css": "CSS",
    ".html": "HTML",
    ".json": "JSON",
    ".md": "Markdown",
    ".dart": "Dart",
    ".java": "Java",
    ".kt": "Kotlin",
    ".kts": "Kotlin",
    ".swift": "Swift",
    ".go": "Go",
    ".rs": "Rust",
    ".rb": "Ruby",
    ".php": "PHP",
    ".cs": "C#",
    ".cpp": "C++",
    ".cc": "C++",
    ".c": "C",
    ".h": "C/C++ Header",
    ".sql": "SQL",
    ".sh": "Shell",
    ".bash": "Shell",
    ".vue": "Vue",
    ".svelte": "Svelte",
    ".xml": "XML",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".toml": "TOML",
}
SOURCE_EXTENSIONS = set(LANGUAGES) - {".md", ".json", ".css", ".html", ".xml", ".yaml", ".yml", ".toml"}
RESOLVE_EXTENSIONS = ["", ".ts", ".tsx", ".js", ".jsx", ".py", ".json", ".css", ".html"]


def is_ignored(path: PurePosixPath) -> bool:
    if any(part in IGNORED_DIRECTORIES for part in path.parts):
        return True
    name = path.name
    if name in ENV_FILE_NAMES or name.startswith(".env."):
        return True
    return False


def scan_for_secrets(source_contents: dict[PurePosixPath, str]) -> list[dict]:
    """Scan source files for hardcoded credentials and secrets."""
    findings: list[dict] = []
    placeholder_markers = ("your_", "your-", "example", "sample", "changeme", "xxxx", "****", "todo", "<", "{", "}")
    for path, content in source_contents.items():
        for line_index, line in enumerate(content.splitlines(), start=1):
            if len(line) > 400:
                continue
            for pattern, label in SECRET_PATTERNS:
                match = pattern.search(line)
                if not match:
                    continue
                value = match.group(0)
                lower = value.lower()
                if any(marker in lower for marker in placeholder_markers):
                    continue
                findings.append({
                    "file": path.as_posix(),
                    "line": line_index,
                    "type": label,
                    "snippet": line.strip()[:160],
                })
                break
    return findings


def resolve_local_import(source: PurePosixPath, specifier: str, file_paths: set[PurePosixPath]) -> PurePosixPath | None:
    if not specifier.startswith("."):
        return None
    candidate = PurePosixPath(source.parent, specifier)
    for extension in RESOLVE_EXTENSIONS:
        with_extension = PurePosixPath(f"{candidate.as_posix()}{extension}")
        if with_extension in file_paths:
            return with_extension
    for extension in RESOLVE_EXTENSIONS[1:]:
        index_file = candidate / f"index{extension}"
        if index_file in file_paths:
            return index_file
    return None


def find_local_imports(source: PurePosixPath, content: str, file_paths: set[PurePosixPath]) -> set[PurePosixPath]:
    if source.suffix.lower() == ".py":
        specifiers = re.findall(r"(?:from|import)\s+([.][A-Za-z0-9_./-]+)", content)
    else:
        specifiers = re.findall(r"(?:from|(?:import|require)\s*(?:\(\s*)?)\s*[\"']([^\"']+)", content)
    return {target for specifier in specifiers if (target := resolve_local_import(source, specifier, file_paths))}


# ─────────────────────────────────────────────────────────────────────────────
# Function-call intelligence helpers
# ─────────────────────────────────────────────────────────────────────────────

EXTERNAL_CALL_DB: dict[str, list[tuple[str, str]]] = {
    "react": [
        ("useState",      "React state hook — manages component-level state"),
        ("useEffect",     "React effect hook — runs side-effects on mount / update"),
        ("useCallback",   "React callback hook — memoises a function reference"),
        ("useMemo",       "React memo hook — memoises an expensive computation"),
        ("useRef",        "React ref hook — holds a mutable DOM or value reference"),
        ("useContext",    "React context hook — reads a shared context value"),
        ("createContext", "Creates a React context object for prop-drilling avoidance"),
        ("forwardRef",    "React forwardRef — passes a ref through a component boundary"),
        ("useReducer",    "React reducer hook — manages complex state with a dispatch function"),
        ("useImperativeHandle", "React hook — exposes an imperative API through a ref"),
    ],
    "@xyflow/react": [
        ("useReactFlow",       "React Flow hook — accesses fitView, zoomIn, zoomOut, getNodes\u2026"),
        ("ReactFlow",          "React Flow component — renders the interactive graph canvas"),
        ("ReactFlowProvider",  "React Flow provider — wraps canvas with shared graph context"),
        ("Background",         "React Flow background — renders dot/grid pattern behind nodes"),
        ("Controls",           "React Flow controls — zoom / fit / lock button overlay"),
        ("MiniMap",            "React Flow minimap — overview thumbnail of the full graph"),
        ("Handle",             "React Flow handle — connection point on a custom node"),
        ("applyNodeChanges",   "React Flow util — applies node drag/position changes to state"),
        ("applyEdgeChanges",   "React Flow util — applies edge selection/removal to state"),
        ("useNodesState",      "React Flow hook — manages node list state with built-in helpers"),
        ("useEdgesState",      "React Flow hook — manages edge list state with built-in helpers"),
        ("MarkerType",         "React Flow enum — edge arrowhead marker type constants"),
        ("Position",           "React Flow enum — handle position constants (Top/Bottom/Left/Right)"),
        ("SelectionMode",      "React Flow enum — lasso vs partial-overlap selection mode"),
    ],
    "axios": [
        ("axios",   "Axios HTTP client — makes REST API requests with interceptors / retries"),
        ("create",  "Axios factory — creates a custom HTTP client instance with base config"),
    ],
    "zustand": [
        ("create",   "Zustand — creates a global state store with a selector-based API"),
        ("useStore", "Zustand hook — subscribes a component to a global state store"),
    ],
    "react-router-dom": [
        ("useNavigate", "React Router hook — programmatic route navigation"),
        ("useParams",   "React Router hook — reads URL path parameters"),
        ("Link",        "React Router component — declarative client-side navigation link"),
        ("Route",       "React Router component — maps a URL pattern to a component"),
        ("Routes",      "React Router component — route-switch container"),
    ],
    "socket.io-client": [
        ("io", "Socket.IO client — opens a persistent WebSocket connection to the server"),
    ],
}


def _infer_param_type(param_name: str) -> str:
    """Heuristically infer a high-level type label from a parameter name."""
    n = param_name.lower().replace("_", "")
    if any(k in n for k in ("json", "body", "payload", "data", "obj", "config", "options", "props", "meta")):
        return "JSON"
    if any(k in n for k in ("vec", "embed", "tensor", "matrix", "vector", "embedding")):
        return "vector"
    if any(k in n for k in ("arr", "list", "items", "rows", "collection", "elements", "batch")):
        return "array"
    if any(k in n for k in ("url", "endpoint", "uri", "href", "link", "src", "route", "path")):
        return "URL"
    if any(k in n for k in ("file", "stream", "blob", "buffer", "asset", "upload", "image")):
        return "File"
    if any(k in n for k in ("id", "key", "token", "hash", "slug", "name", "title", "label", "query", "str", "text", "message", "msg")):
        return "string"
    if any(k in n for k in ("count", "num", "size", "index", "len", "offset", "limit", "page", "width", "height")):
        return "number"
    if any(k in n for k in ("is", "has", "should", "enabled", "flag", "active", "open", "visible", "show", "bool")):
        return "boolean"
    if any(k in n for k in ("cb", "callback", "handler", "fn", "func", "hook")):
        return "function"
    if any(k in n for k in ("event", "evt", "ev")):
        return "Event"
    if any(k in n for k in ("node", "element", "el", "component", "ref", "dom")):
        return "element"
    return "any"


def _describe_call(name: str, params: list[str], target_file: str | None) -> str:
    """Generate a one-line human-readable description for a function call."""
    n = name.lower()
    if name.startswith("use"):
        if any(k in n for k in ("flow", "reactflow", "xyflow")):
            return "React Flow hook — accesses viewport / graph control methods"
        if "state" in n:    return "React state hook — manages component-level state"
        if "effect" in n:   return "React effect hook — runs side-effects on mount / update"
        if "memo" in n:     return "React memo hook — memoises an expensive computation"
        if "callback" in n: return "React callback hook — memoises a function reference"
        if "ref" in n:      return "React ref hook — holds a mutable DOM or value reference"
        if "context" in n:  return "React context hook — reads a shared context value"
        if "reducer" in n:  return "React reducer hook — manages complex state with dispatch"
        if "navigate" in n or "router" in n: return "React Router hook — programmatic navigation"
        if "param" in n:    return "React Router hook — reads URL path parameters"
        return f"Custom React hook — {name}"
    if any(k in n for k in ("upload", "fetch", "request", "post", "get", "put", "patch", "delete", "api")):
        return f"Makes an HTTP request — {name}"
    if any(k in n for k in ("format", "stringify", "serialize", "encode")):
        return f"Formats / serializes data — {name}"
    if any(k in n for k in ("parse", "decode", "deserialize", "extract")):
        return f"Parses / deserializes data — {name}"
    if any(k in n for k in ("build", "make", "create", "construct", "generate", "compose")):
        return f"Constructs a data structure or component — {name}"
    if any(k in n for k in ("render", "draw", "paint", "display", "show")):
        return f"Renders visual output — {name}"
    if any(k in n for k in ("validate", "check", "verify", "assert", "guard")):
        return f"Validates or verifies data — {name}"
    if any(k in n for k in ("update", "set", "mutate", "write", "save", "store", "persist")):
        return f"Updates or persists state / data — {name}"
    if n.startswith("on") and len(n) > 3:
        return f"Event handler — {name}"
    if any(k in n for k in ("navigate", "redirect", "route", "push", "goto")):
        return f"Navigates to a route — {name}"
    if any(k in n for k in ("cancel", "abort", "stop", "reset", "clear", "clean")):
        return f"Cancels or resets an operation — {name}"
    fname = PurePosixPath(target_file).name if target_file else "module"
    return f"Imported from {fname} — {name}"


def _parse_js_params(raw: str) -> list[str]:
    """Strip TypeScript type annotations and default values; return plain param names."""
    if not raw.strip():
        return []
    params: list[str] = []
    depth = 0
    current: list[str] = []
    for ch in raw:
        if ch in "({[<":
            depth += 1
        elif ch in ")}]>":
            depth -= 1
        if ch == "," and depth == 0:
            params.append("".join(current).strip())
            current = []
        else:
            current.append(ch)
    params.append("".join(current).strip())
    cleaned: list[str] = []
    for p in params:
        p = re.sub(r"\s*=.*$", "", p)   # strip default
        p = re.sub(r"\s*:.*$", "", p)   # strip TS type
        p = p.lstrip(". ")              # strip rest/spread dots
        p = p.strip()
        if p.startswith("{") or p.startswith("["):
            cleaned.append("...destructured")
        elif p:
            cleaned.append(p)
    return [c for c in cleaned if c]


def _parse_py_params(raw: str) -> list[str]:
    """Strip type annotations, defaults, and Python-specific syntax."""
    skip = {"self", "cls"}
    params: list[str] = []
    for p in raw.split(","):
        p = p.strip().lstrip("*")
        p = re.sub(r"\s*:.*$", "", p)
        p = re.sub(r"\s*=.*$", "", p)
        p = p.strip()
        if p and p not in skip:
            params.append(p)
    return params


def _extract_function_definitions(content: str, suffix: str) -> dict[str, list[str]]:
    """Return {func_name: [param_names]} for all top-level definitions in a source file."""
    defs: dict[str, list[str]] = {}
    if suffix in {".js", ".jsx", ".ts", ".tsx"}:
        for m in re.finditer(r"(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)", content):
            defs[m.group(1)] = _parse_js_params(m.group(2))
        for m in re.finditer(r"(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*(?::[^=>{][^=>{]*)?\s*=>", content):
            if m.group(1) not in defs:
                defs[m.group(1)] = _parse_js_params(m.group(2))
    elif suffix == ".py":
        for m in re.finditer(r"def\s+(\w+)\s*\(([^)]*)\)", content):
            defs[m.group(1)] = _parse_py_params(m.group(2))
    return defs


def _extract_import_map(
    content: str,
    source_path: PurePosixPath,
    file_path_set: set,
    suffix: str,
) -> tuple[dict[str, str], dict[str, str]]:
    """
    Parse import statements and return:
      local_map    — {local_alias: target_file_posix}   (imports from this project)
      external_map — {local_alias: package_name}         (imports from npm / pip)
    """
    local_map: dict[str, str] = {}
    external_map: dict[str, str] = {}

    if suffix in {".js", ".jsx", ".ts", ".tsx"}:
        # Named imports: import { Foo, Bar as Baz } from '...'
        for m in re.finditer(r"import\s*\{([^}]+)\}\s*from\s*['\"]([^'\"]+)['\"]", content):
            specifier = m.group(2)
            for sym in m.group(1).split(","):
                sym = sym.strip()
                if sym.startswith("type "):
                    continue
                if " as " in sym:
                    sym = sym.split(" as ")[-1].strip()
                if not sym:
                    continue
                if specifier.startswith("."):
                    r = resolve_local_import(source_path, specifier, file_path_set)
                    if r:
                        local_map[sym] = r.as_posix()
                else:
                    external_map[sym] = specifier
        # Default / namespace: import Foo from '...'  |  import * as Foo from '...'
        for m in re.finditer(r"import\s+(?:\*\s+as\s+)?(\w+)\s+from\s*['\"]([^'\"]+)['\"]", content):
            name, specifier = m.group(1), m.group(2)
            if name in ("type", "typeof"):
                continue
            if specifier.startswith("."):
                r = resolve_local_import(source_path, specifier, file_path_set)
                if r:
                    local_map[name] = r.as_posix()
            else:
                external_map[name] = specifier

    elif suffix == ".py":
        # from .module import A, B as C
        for m in re.finditer(r"from\s+([.][A-Za-z0-9_./-]*)\s+import\s+([^\n]+)", content):
            specifier, names_raw = m.group(1), m.group(2)
            r = resolve_local_import(source_path, specifier, file_path_set)
            for sym in names_raw.split(","):
                sym = sym.strip().split(" as ")[-1].strip()
                if sym:
                    if r:
                        local_map[sym] = r.as_posix()
                    else:
                        external_map[sym] = specifier
        # from package import X
        for m in re.finditer(r"from\s+([A-Za-z][A-Za-z0-9_.]*)\s+import\s+([^\n]+)", content):
            pkg, names_raw = m.group(1), m.group(2)
            for sym in names_raw.split(","):
                sym = sym.strip().split(" as ")[-1].strip()
                if sym:
                    external_map[sym] = pkg
        # import package as alias
        for m in re.finditer(r"^import\s+([A-Za-z][A-Za-z0-9_.]*)\s*(?:as\s+(\w+))?", content, re.MULTILINE):
            pkg = m.group(1)
            alias = m.group(2) if m.group(2) else pkg.split(".")[0]
            external_map[alias] = pkg

    return local_map, external_map


def _find_called_names(content: str) -> set[str]:
    """Single O(n) pass: collect all identifiers immediately before '(' or '<'."""
    return set(re.findall(r"\b([a-zA-Z_][a-zA-Z0-9_]*)\s*[(<]", content))


def _extract_external_calls(content: str, external_map: dict[str, str], called_names: set[str]) -> list[dict]:
    """Detect external library functions that are actually used in the file."""
    calls: list[dict] = []
    seen: set[str] = set()

    # Native browser fetch()
    if "fetch" in called_names and "fetch" not in external_map:
        urls = re.findall(r"fetch\s*\(\s*[`'\"]((?:https?://|/)[^`'\"]+)[`'\"]", content)
        desc = f"Native fetch — HTTP request to {urls[0]}" if urls else "Native fetch — makes a browser HTTP request"
        calls.append({"callee_name": "fetch", "callee_file": None, "params": ["url", "options"], "param_types": ["URL", "JSON"], "description": desc, "is_external": True, "external_lib": "browser fetch API"})
        seen.add("fetch")

    for local_name, pkg in external_map.items():
        if local_name in seen or local_name not in called_names:
            continue
        seen.add(local_name)
        found_entry: tuple[str, str] | None = None
        for lib_key, entries in EXTERNAL_CALL_DB.items():
            if pkg == lib_key or pkg.startswith(lib_key + "/"):
                for func_name, func_desc in entries:
                    if func_name == local_name:
                        found_entry = (func_name, func_desc)
                        break
            if found_entry:
                break
        if found_entry:
            calls.append({"callee_name": found_entry[0], "callee_file": None, "params": [], "param_types": [], "description": found_entry[1], "is_external": True, "external_lib": pkg})
        else:
            calls.append({"callee_name": local_name, "callee_file": None, "params": [], "param_types": [], "description": f"External call to {local_name} from package '{pkg}'", "is_external": True, "external_lib": pkg})

    return calls


def _extract_function_calls(source_contents: dict, file_path_set: set) -> list[dict]:
    """
    Analyse all source files and return a flat list of cross-file function-call
    records (both local imports and external library usage).
    """
    # Phase 1 — build a global function-definition map
    func_def_map: dict[str, dict[str, list[str]]] = {}
    for path, content in source_contents.items():
        func_def_map[path.as_posix()] = _extract_function_definitions(content, path.suffix.lower())

    all_calls: list[dict] = []

    # Phase 2 — per-file import + call analysis
    for source_path, content in source_contents.items():
        suffix = source_path.suffix.lower()
        local_map, external_map = _extract_import_map(content, source_path, file_path_set, suffix)
        called_names = _find_called_names(content)

        # Local cross-file calls
        seen_local: set[str] = set()
        for sym_name, target_file_posix in local_map.items():
            if sym_name not in called_names or sym_name in seen_local:
                continue
            seen_local.add(sym_name)
            target_defs = func_def_map.get(target_file_posix, {})
            params = target_defs.get(sym_name, [])
            all_calls.append({
                "caller_file": source_path.as_posix(),
                "callee_name": sym_name,
                "callee_file": target_file_posix,
                "params": params,
                "param_types": [_infer_param_type(p) for p in params],
                "description": _describe_call(sym_name, params, target_file_posix),
                "is_external": False,
                "external_lib": None,
            })

        # External / library calls
        for call in _extract_external_calls(content, external_map, called_names):
            all_calls.append({"caller_file": source_path.as_posix(), **call})

    return all_calls



def find_cycles(adjacency: dict[str, set[str]]) -> list[list[str]]:
    """Return strongly connected import groups, which represent cycles."""
    index = 0
    indices: dict[str, int] = {}
    low_links: dict[str, int] = {}
    stack: list[str] = []
    on_stack: set[str] = set()
    components: list[list[str]] = []

    def visit(node: str) -> None:
        nonlocal index
        indices[node] = index
        low_links[node] = index
        index += 1
        stack.append(node)
        on_stack.add(node)

        for target in adjacency.get(node, set()):
            if target not in indices:
                visit(target)
                low_links[node] = min(low_links[node], low_links[target])
            elif target in on_stack:
                low_links[node] = min(low_links[node], indices[target])

        if low_links[node] != indices[node]:
            return
        component = []
        while stack:
            current = stack.pop()
            on_stack.remove(current)
            component.append(current)
            if current == node:
                break
        if len(component) > 1 or node in adjacency.get(node, set()):
            components.append(sorted(component))

    for node in adjacency:
        if node not in indices:
            visit(node)
    return components


def longest_import_chain(adjacency: dict[str, set[str]]) -> list[str]:
    longest: list[str] = []

    def walk(node: str, path: list[str], visited: set[str]) -> None:
        nonlocal longest
        if len(path) > len(longest):
            longest = path.copy()
        for target in adjacency.get(node, set()):
            if target not in visited:
                walk(target, [*path, target], {*visited, target})

    for node in adjacency:
        walk(node, [node], {node})
    return longest


def build_analysis(file_paths: list[PurePosixPath], edges: list[dict], file_sizes: dict[PurePosixPath, int], file_lines: dict[PurePosixPath, int], source_contents: dict[PurePosixPath, str] | None = None) -> dict:
    file_ids = {f"file:{path.as_posix()}": path for path in file_paths}
    adjacency = {node_id: set() for node_id in file_ids}
    for edge in edges:
        if edge.get("relation") == "IMPORTS" and edge["source"] in adjacency and edge["target"] in adjacency:
            adjacency[edge["source"]].add(edge["target"])

    incoming = Counter(target for targets in adjacency.values() for target in targets)
    chains = longest_import_chain(adjacency)
    cycles = find_cycles(adjacency)
    total_lines = sum(file_lines.get(path, 0) for path in file_paths)
    total_size = sum(file_sizes.get(path, 0) for path in file_paths)
    sorted_by_size = sorted(file_paths, key=lambda path: file_sizes.get(path, 0), reverse=True)
    analyzed_ids = {node_id for node_id, path in file_ids.items() if path.suffix.lower() in LANGUAGES}
    orphan_paths = sorted(file_ids[node_id].as_posix() for node_id in analyzed_ids if incoming.get(node_id, 0) == 0)
    average_dependencies = round(sum(len(targets) for targets in adjacency.values()) / len(file_paths), 2) if file_paths else 0
    orphan_ratio = len(orphan_paths) / len(analyzed_ids) if analyzed_ids else 0
    secrets = scan_for_secrets(source_contents or {})
    api_connections = []
    api_counts = Counter()
    for detail in (source_contents or {}).items():
        path, content = detail
        lower = content.lower()
        patterns = (
            ("fetch", r"\bfetch\s*\("),
            ("axios", r"\baxios(?:\s*\.\s*(?:get|post|put|patch|delete|request))?\s*\("),
            ("requests", r"\brequests\s*\.\s*(?:get|post|put|patch|delete)\s*\("),
            ("httpx", r"\bhttpx\s*\.\s*(?:get|post|put|patch|delete)\s*\("),
            ("Dio", r"\b(?:Dio|dio)\s*\.\s*(?:get|post|put|patch|delete)\s*\("),
            ("GraphQL", r"\b(?:graphql|gql)\b"),
            ("gRPC", r"\bgrpc\b"),
            ("Firebase", r"\bfirebase\b"),
            ("Supabase", r"\bsupabase\b"),
        )
        for provider, pattern in patterns:
            count = len(re.findall(pattern, lower, re.IGNORECASE))
            if count:
                api_counts[provider] += count
                api_connections.append({"provider": provider, "file": path.as_posix(), "count": count})
    score = max(0, min(100, round(100 - len(cycles) * 10 - orphan_ratio * 20 - sum(1 for path in file_paths if file_lines.get(path, 0) > 500) * 3 - len(secrets) * 4)))

    return {
        "total_lines": total_lines,
        "total_size_bytes": total_size,
        "average_file_size_bytes": round(total_size / len(file_paths)) if file_paths else 0,
        "largest_file": {"path": sorted_by_size[0].as_posix(), "size_bytes": file_sizes.get(sorted_by_size[0], 0), "lines": file_lines.get(sorted_by_size[0], 0)} if sorted_by_size else None,
        "smallest_file": {"path": sorted_by_size[-1].as_posix(), "size_bytes": file_sizes.get(sorted_by_size[-1], 0), "lines": file_lines.get(sorted_by_size[-1], 0)} if sorted_by_size else None,
        "total_imports": sum(len(targets) for targets in adjacency.values()),
        "average_dependencies": average_dependencies,
        "longest_import_chain": {"length": len(chains), "files": [file_ids[node_id].as_posix() for node_id in chains]},
        "orphan_files": orphan_paths,
        "circular_dependencies": [[file_ids[node_id].as_posix() for node_id in cycle] for cycle in cycles],
        "security_issues": secrets,
        "api_connections": api_connections,
        "api_provider_counts": dict(api_counts.most_common()),
        "api_call_count": sum(api_counts.values()),
        "health_score": score,
    }


def _new_upload_task(upload_id: str) -> dict:
    task = {
        "status": "uploading",
        "phase": "uploading",
        "progress": 0.0,
        "files_processed": 0,
        "total_files": 0,
        "bytes_processed": 0,
        "total_bytes": 0,
        "current_file": "",
        "elapsed_seconds": 0.0,
        "remaining_seconds": 0,
        "error": None,
        "result": None,
    }
    with UPLOAD_TASKS_LOCK:
        UPLOAD_TASKS[upload_id] = task
    return task


def _existing_upload_task(upload_id: str) -> dict | None:
    """Return the task for an upload_id unless it was cancelled (never re-run those)."""
    with UPLOAD_TASKS_LOCK:
        task = UPLOAD_TASKS.get(upload_id)
        if task and task["status"] != "cancelled":
            return task
    return None


def _update_upload_task(upload_id: str, **changes) -> None:
    with UPLOAD_TASKS_LOCK:
        task = UPLOAD_TASKS.get(upload_id)
        if task:
            task.update(changes)


def _progress_snapshot(task: dict) -> dict:
    return {key: value for key, value in task.items() if key != "result"}


def _extract_and_analyze(upload_id: str, content: bytes, filename: str, strip_root: bool = False, owner_email: str | None = None) -> None:
    started = time.monotonic()
    project_id = uuid.uuid4().hex
    PROJECTS_ROOT.mkdir(parents=True, exist_ok=True)
    extraction_root = (PROJECTS_ROOT / project_id).resolve()
    try:
        with zipfile.ZipFile(BytesIO(content)) as archive:
            root_prefix = None
            if strip_root:
                first_components = {
                    PurePosixPath(info.filename).parts[0]
                    for info in archive.infolist()
                    if PurePosixPath(info.filename).parts
                }
                if len(first_components) == 1:
                    root_prefix = next(iter(first_components))
            infos = [info for info in archive.infolist() if not info.is_dir() and not is_ignored(PurePosixPath(info.filename))]
            total_files = len(infos)
            total_uncompressed = sum(info.file_size for info in infos)
            if total_uncompressed > MAX_EXTRACTED_BYTES:
                raise HTTPException(status_code=413, detail="Extracted project exceeds the 250 MB limit.")

            _update_upload_task(upload_id, status="processing", phase="extracting", total_files=total_files, total_bytes=total_uncompressed)

            members = []
            source_contents = {}
            file_sizes = {}
            file_lines = {}
            for info in archive.infolist():
                member_path = PurePosixPath(info.filename)
                if root_prefix and member_path.parts and member_path.parts[0] == root_prefix:
                    member_path = PurePosixPath(*member_path.parts[1:])
                if member_path.is_absolute() or ".." in member_path.parts or is_ignored(member_path):
                    continue
                destination = (extraction_root / Path(*member_path.parts)).resolve()
                if extraction_root not in destination.parents and destination != extraction_root:
                    continue
                members.append((info, member_path, destination))
                if info.is_dir():
                    destination.mkdir(parents=True, exist_ok=True)
                else:
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    file_content = archive.read(info)
                    destination.write_bytes(file_content)
                    file_sizes[member_path] = len(file_content)
                    file_lines[member_path] = len(file_content.decode("utf-8", errors="ignore").splitlines())
                    if member_path.suffix.lower() in SOURCE_EXTENSIONS:
                        source_contents[member_path] = file_content.decode("utf-8", errors="ignore")

                    bytes_done = sum(file_sizes.values())
                    percent = min(bytes_done / total_uncompressed, 1.0) if total_uncompressed else 1.0
                    elapsed = time.monotonic() - started
                    rate = bytes_done / elapsed if elapsed > 0 else 0
                    remaining = int((1 - percent) * total_uncompressed / rate) if rate > 0 else 0
                    _update_upload_task(
                        upload_id,
                        status="processing",
                        phase="extracting",
                        progress=round(percent * 100, 1),
                        bytes_processed=bytes_done,
                        files_processed=len(file_sizes),
                        current_file=member_path.as_posix(),
                        elapsed_seconds=round(elapsed, 1),
                        remaining_seconds=remaining,
                    )
        preview_files = [
            member_path for info, member_path, _destination in members
            if not info.is_dir() and member_path.suffix.lower() in PREVIEW_EXTENSIONS
        ]
        PROJECT_STORES[project_id] = {"root": extraction_root, "preview_files": sorted(preview_files, key=lambda path: path.as_posix())}
    except HTTPException as error:
        shutil.rmtree(extraction_root, ignore_errors=True)
        _update_upload_task(upload_id, status="error", error=error.detail)
        return
    except zipfile.BadZipFile:
        shutil.rmtree(extraction_root, ignore_errors=True)
        _update_upload_task(upload_id, status="error", error="The uploaded file is not a valid ZIP archive.")
        return

    _update_upload_task(upload_id, phase="analyzing", progress=90.0, current_file="", remaining_seconds=0)

    nodes = [{"id": "root", "label": Path(filename).stem, "path": "", "type": "project"}]
    edges = []
    directories = {PurePosixPath()}
    file_paths = []
    language_counts = Counter()

    for info, member_path, _destination in members:
        if info.is_dir():
            directories.add(member_path)
            continue
        file_paths.append(member_path)
        for parent in member_path.parents:
            if parent != PurePosixPath():
                directories.add(parent)
        language = LANGUAGES.get(member_path.suffix.lower(), "Other")
        language_counts[language] += 1

    for directory in sorted(directories, key=lambda value: (len(value.parts), str(value))):
        if directory == PurePosixPath():
            continue
        node_id = f"folder:{directory.as_posix()}"
        parent = directory.parent
        parent_id = "root" if parent == PurePosixPath() else f"folder:{parent.as_posix()}"
        nodes.append({"id": node_id, "label": directory.name, "path": directory.as_posix(), "type": "folder"})
        edges.append({"id": f"contains:{parent_id}:{node_id}", "source": parent_id, "target": node_id, "label": "CONTAINS", "relation": "CONTAINS"})

    for file_path in sorted(file_paths, key=lambda value: str(value)):
        node_id = f"file:{file_path.as_posix()}"
        parent = file_path.parent
        parent_id = "root" if parent == PurePosixPath() else f"folder:{parent.as_posix()}"
        language = LANGUAGES.get(file_path.suffix.lower(), "Other")
        nodes.append({"id": node_id, "label": file_path.name, "path": file_path.as_posix(), "type": "file", "language": language})
        edges.append({"id": f"contains:{parent_id}:{node_id}", "source": parent_id, "target": node_id, "label": "CONTAINS", "relation": "CONTAINS"})

    file_path_set = set(file_paths)
    for source_path, source_content in source_contents.items():
        source_id = f"file:{source_path.as_posix()}"
        for target_path in sorted(find_local_imports(source_path, source_content, file_path_set), key=lambda value: value.as_posix()):
            target_id = f"file:{target_path.as_posix()}"
            edges.append({"id": f"imports:{source_id}:{target_id}", "source": source_id, "target": target_id, "label": "IMPORTS", "relation": "IMPORTS"})

    analysis = build_analysis(file_paths, edges, file_sizes, file_lines, source_contents)

    try:
        function_calls = _extract_function_calls(source_contents, file_path_set)
    except Exception:
        function_calls = []
    try:
        file_details = analyze_source_files(source_contents, file_path_set, resolve_local_import)
    except Exception:
        file_details = {}
    for node in nodes:
        if node["type"] != "file":
            continue
        path = PurePosixPath(node["path"])
        node["size_bytes"] = file_sizes.get(path, 0)
        node["lines"] = file_lines.get(path, 0)

    ml_insights = None
    try:
        from app.services.ml import analyze_repo as _aura_analyze_repo

        function_count = sum(
            len(detail.get("functions", []))
            for detail in file_details.values()
            if isinstance(detail, dict)
        )
        external_import_count = sum(
            len(detail.get("external_imports", []))
            for detail in file_details.values()
            if isinstance(detail, dict)
        )
        in_degree: dict[str, int] = {}
        for edge in edges:
            if edge.get("relation") == "IMPORTS" and edge.get("target"):
                in_degree[edge["target"]] = in_degree.get(edge["target"], 0) + 1
        file_rows = []
        for file_path in file_paths:
            file_id = f"file:{file_path.as_posix()}"
            detail = file_details.get(file_id) or {}
            file_rows.append({
                "path": file_path.as_posix(),
                "lines": file_lines.get(file_path, 0),
                "size_bytes": file_sizes.get(file_path, 0),
                "in_degree": in_degree.get(file_id, 0),
                "out_degree": len(find_local_imports(file_path, source_contents.get(file_path, ""), file_path_set)),
                "function_count": len(detail.get("functions", [])) if isinstance(detail, dict) else 0,
                "api_call_count": len(detail.get("api_calls", [])) if isinstance(detail, dict) else 0,
                "external_import_count": len(detail.get("external_imports", [])) if isinstance(detail, dict) else 0,
                "local_import_count": len(detail.get("imports", [])) if isinstance(detail, dict) else 0,
            })
        oversized_count = sum(1 for path in file_paths if file_lines.get(path, 0) > 500)
        ml_insights = _aura_analyze_repo(
            analysis,
            file_rows,
            len(file_paths),
            max(len(directories) - 1, 0),
            oversized_count=oversized_count,
            function_count=function_count,
            external_import_count=external_import_count,
        )
    except Exception:
        logger.warning("Aura 1.0 ML analysis failed; continuing with deterministic analysis.", exc_info=True)
        ml_insights = None

    if ml_insights:
        per_file = ml_insights.get("per_file") or {}
        for node in nodes:
            if node["type"] != "file":
                continue
            info = per_file.get(node["path"])
            if info:
                node["ml_risk"] = info.get("risk_tier")
                node["ml_role"] = info.get("role")

    result = {
        "project_id": project_id,
        "project": Path(filename).stem,
        "files": len(file_paths),
        "folders": max(len(directories) - 1, 0),
        "languages": dict(language_counts.most_common()),
        "nodes": nodes,
        "edges": edges,
        "analysis": analysis,
        "function_calls": function_calls,
        "file_details": file_details,
        "ml_insights": ml_insights,
    }
    authz.save_project_graph(project_id, result)
    authz.save_project_secrets(project_id, analysis.get("security_issues") or [])
    policy = authz.ensure_policy(project_id, owner_email or "", result["project"])
    policy.project = result["project"]
    authz.save_policy(policy)
    elapsed = time.monotonic() - started
    _update_upload_task(upload_id, status="complete", phase="done", progress=100.0, files_processed=len(file_paths), elapsed_seconds=round(elapsed, 1), remaining_seconds=0, result=result)
    bus.publish("project.created", project_id, {"project": result["project"], "owner": owner_email or ""})


@router.post("/api/upload")
async def upload_project(file: UploadFile = File(...), upload_id: str = Form(...), token: str = Form(...)):
    """Start extracting a ZIP project and stream progress via /api/upload/{upload_id}/progress."""
    user = _require_authenticated(token)
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Please upload a .zip project file.")

    content = await file.read()
    if len(content) > MAX_ZIP_BYTES:
        raise HTTPException(status_code=413, detail="Project ZIPs must be smaller than 200 MB.")

    existing = _existing_upload_task(upload_id)
    if existing is not None:
        return {"upload_id": upload_id, "status": existing["status"]}
    task = _new_upload_task(upload_id)
    threading.Thread(
        target=_extract_and_analyze,
        args=(upload_id, content, file.filename),
        kwargs={"owner_email": user["email"]},
        daemon=True,
    ).start()
    return {"upload_id": upload_id, "status": task["status"]}


def _parse_github_url(url: str) -> tuple[str, str, str] | None:
    """Extract (owner, repo, branch) from common GitHub URLs."""
    cleaned = url.strip().rstrip("/")
    if cleaned.endswith(".git"):
        cleaned = cleaned[:-4]
    match = re.match(r"^https?://github\.com/([^/\s]+)/([^/\s#?]+)(?:/tree/([^/\s]+))?$", cleaned)
    if match:
        owner, repo, branch = match.groups()
        return owner, repo, branch or "main"
    match = re.match(r"^git@github\.com:([^/\s]+)/([^/\s]+)(?:\.git)?$", url.strip())
    if match:
        owner, repo = match.groups()
        return owner, repo.removesuffix(".git"), "main"
    return None


def _download_github_repo_zip(owner: str, repo: str, branch: str) -> bytes:
    """Download a repository as a ZIP archive from GitHub's codeload endpoint."""
    headers = {"User-Agent": "CodeAtlas"}
    errors: list[str] = []
    for candidate_branch in (branch, "main", "master"):
        url = f"https://codeload.github.com/{owner}/{repo}/zip/refs/heads/{candidate_branch}"
        try:
            request = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(request, timeout=60) as response:
                content = response.read()
            if not content.startswith(b"PK\x03\x04"):
                errors.append(f"Repository returned an invalid archive for branch '{candidate_branch}'.")
                continue
            return content
        except urllib.error.HTTPError as error:
            errors.append(f"Branch '{candidate_branch}' returned HTTP {error.code}.")
        except urllib.error.URLError as error:
            errors.append(f"Network error for branch '{candidate_branch}': {error.reason}")
    raise HTTPException(status_code=400, detail="Could not download the repository: " + " ".join(errors))


def _import_github_and_analyze(upload_id: str, url: str, owner_email: str | None = None) -> None:
    """Download a GitHub repository and run it through the standard analysis pipeline."""
    try:
        parsed = _parse_github_url(url)
        if not parsed:
            _update_upload_task(upload_id, status="error", error="Invalid GitHub repository URL.")
            return
        owner, repo, branch = parsed
        _update_upload_task(upload_id, status="processing", phase="downloading", progress=5.0, current_file=url)
        content = _download_github_repo_zip(owner, repo, branch)
        if len(content) > MAX_ZIP_BYTES:
            _update_upload_task(upload_id, status="error", error="Project ZIPs must be smaller than 200 MB.")
            return
        _extract_and_analyze(upload_id, content, repo, strip_root=True, owner_email=owner_email)
        with UPLOAD_TASKS_LOCK:
            result = (UPLOAD_TASKS.get(upload_id) or {}).get("result")
        if result and owner_email:
            from app.api.auth import USERS, _github_token_for_user

            access_token = _github_token_for_user(USERS.get(owner_email))
            if access_token:
                try:
                    authz.mark_github_policy(result["project_id"], owner, repo, access_token)
                except Exception:
                    # collaborator sync is best-effort; the repo remains private to the owner
                    pass
    except HTTPException as error:
        _update_upload_task(upload_id, status="error", error=error.detail)


@router.post("/api/upload/github")
async def import_github_project(repo_url: str = Form(...), upload_id: str = Form(...), token: str = Form(...)):
    """Download a GitHub repository by URL and analyze it with live progress."""
    user = _require_authenticated(token)
    parsed = _parse_github_url(repo_url)
    if not parsed:
        raise HTTPException(status_code=400, detail="Invalid GitHub repository URL. Use a link like https://github.com/owner/repo.")
    existing = _existing_upload_task(upload_id)
    if existing is not None:
        return {"upload_id": upload_id, "status": existing["status"]}
    task = _new_upload_task(upload_id)
    threading.Thread(target=_import_github_and_analyze, args=(upload_id, repo_url, user["email"]), daemon=True).start()
    return {"upload_id": upload_id, "status": task["status"]}


@router.get("/api/upload/{upload_id}/progress")
def get_upload_progress(upload_id: str, token: str = Query("")):
    """Return the live progress snapshot for an in-flight upload."""
    _require_authenticated(token)
    with UPLOAD_TASKS_LOCK:
        task = UPLOAD_TASKS.get(upload_id)
        if not task:
            raise HTTPException(status_code=404, detail="Upload not found or expired.")
        return _progress_snapshot(task)


@router.get("/api/upload/{upload_id}/result")
def get_upload_result(upload_id: str, token: str = Query("")):
    """Return the final graph once processing is complete."""
    _require_authenticated(token)
    with UPLOAD_TASKS_LOCK:
        task = UPLOAD_TASKS.get(upload_id)
        if not task:
            raise HTTPException(status_code=404, detail="Upload not found or expired.")
        if task["status"] == "error":
            raise HTTPException(status_code=422, detail=task["error"] or "Project processing failed.")
        if task["status"] != "complete":
            raise HTTPException(status_code=409, detail="Project is still processing.")
        return task["result"]


@router.delete("/api/upload/{upload_id}")
def cancel_upload(upload_id: str):
    """Cancel an in-flight upload and discard its extracted files."""
    with UPLOAD_TASKS_LOCK:
        task = UPLOAD_TASKS.get(upload_id)
        if not task:
            raise HTTPException(status_code=404, detail="Upload not found or expired.")
        result = task.get("result")
        task["status"] = "cancelled"
        UPLOAD_TASKS.pop(upload_id, None)
    if result:
        project_id = result.get("project_id")
        if project_id:
            PROJECT_STORES.pop(project_id, None)
            shutil.rmtree((PROJECTS_ROOT / project_id).resolve(), ignore_errors=True)
    return {"status": "cancelled"}


def _resolve_sandbox_path(project_id: str, path: str) -> Path:
    """Resolve a client-supplied path safely inside the project sandbox."""
    store = _project_store(project_id)
    if not store:
        raise HTTPException(status_code=404, detail="Project not found or expired.")
    requested = PurePosixPath(path)
    if requested.is_absolute() or ".." in requested.parts:
        raise HTTPException(status_code=400, detail="Invalid file path.")
    root = store["root"]
    candidate = (root / Path(*requested.parts)).resolve()
    if root not in candidate.parents and candidate != root:
        raise HTTPException(status_code=400, detail="Invalid file path.")
    if not candidate.is_file():
        raise HTTPException(status_code=404, detail="File not found.")
    return candidate


def _enforce_source_access(project_id: str, user: dict, path: str) -> authz.Policy:
    """Resolve the policy and require `source` access on the resource path.

    Super admins bypass only when they entered through the Admin Center; the
    permission model treats them like any other user everywhere else."""
    role = _user_role(user["email"])
    if role == authz.SUPER_ADMIN:
        _enforce_org_membership(project_id, user["email"], role)
        return _policy_for(project_id, user["email"])
    _enforce_org_membership(project_id, user["email"], role)
    policy = _policy_for(project_id, user["email"])
    access = policy.effective_access(user["email"], role, path, _user_teams(user["email"]))
    if not access["source"]:
        authz.audit(
            user["email"],
            "file.denied",
            f"{project_id}:{path}",
            {"reason": "no source access", "permission": "source"},
        )
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to view this resource. Request access from the repository owner.",
        )
    return policy


def _policy_for(project_id: str, email: str) -> authz.Policy:
    policy = authz.load_policy(project_id)
    if policy is None:
        raise HTTPException(status_code=404, detail="Project not found or expired.")
    return policy


def _enforce_org_membership(project_id: str, email: str, role: str | None) -> None:
    """Multi-tenant gate: org-owned repositories are invisible (404) to anyone
    outside the org, the owner, or a super admin — no existence leak."""
    policy = _policy_for(project_id, email)
    from app.api.auth import USERS

    login = (USERS.get(email) or {}).get("github_login")
    orgs = authz.user_org_ids(email, login)
    if not authz.policy_org_access(policy, email, role, orgs):
        raise HTTPException(status_code=404, detail="Project not found or expired.")


def _load_project_result(project_id: str) -> dict:
    result = authz.load_project_graph(project_id)
    if not result:
        raise HTTPException(status_code=404, detail="Project not found or expired.")
    return result


@router.get("/api/projects/{project_id}/graph")
def get_project_graph(project_id: str, token: str = Query("")):
    """Return the graph filtered to what the current user may see.

    Every node carries an `access` object. Source intelligence
    (`file_details`) is stripped for nodes whose `source` flag is false.
    Users without any metadata access receive 404 (no existence leak).
    """
    user = _require_authenticated(token)
    _enforce_org_membership(project_id, user["email"], _user_role(user["email"]))
    result = _load_project_result(project_id)
    policy = _policy_for(project_id, user["email"])
    role = _user_role(user["email"])
    authorized = authz.authorized_graph(
        result, user["email"], role, policy, _user_teams(user["email"])
    )
    if not any(node.get("path") == "" for node in authorized["nodes"]):
        authz.audit(
            user["email"],
            "graph.denied",
            project_id,
            {"reason": "no metadata access"},
        )
        raise HTTPException(status_code=404, detail="Project not found or expired.")
    authz.audit(user["email"], "graph.read", project_id, {"files": len(authorized["nodes"])})
    response = {key: value for key, value in authorized.items() if not key.startswith("_")}
    response["owner_email"] = policy.owner_email
    response["is_manager"] = authz.can_manage(user["email"], role, policy)
    response["policy_source"] = policy.source
    return response


@router.get("/api/projects/{project_id}/file-content")
def get_project_file_content(project_id: str, path: str = Query(...), token: str = Query("")):
    """Serve raw source text only when the user has `source` access."""
    user = _require_authenticated(token)
    _enforce_source_access(project_id, user, path)
    candidate = _resolve_sandbox_path(project_id, path)
    authz.audit(user["email"], "file.read", f"{project_id}:{path}")
    content = candidate.read_text(encoding="utf-8", errors="replace")
    return {"path": path, "content": content}


@router.get("/api/projects/{project_id}/file")
def get_project_file(project_id: str, path: str = Query(...), token: str = Query("")):
    """Serve a raw file (image/PDF) from a previously uploaded project for preview."""
    user = _require_authenticated(token)
    _enforce_source_access(project_id, user, path)
    candidate = _resolve_sandbox_path(project_id, path)
    return FileResponse(candidate)


@router.get("/api/projects/{project_id}/previewable")
def list_previewable_files(project_id: str, token: str = Query("")):
    """List files that support in-app preview (metadata requires auth)."""
    user = _require_authenticated(token)
    _enforce_org_membership(project_id, user["email"], _user_role(user["email"]))
    store = _project_store(project_id)
    if not store:
        raise HTTPException(status_code=404, detail="Project not found or expired.")
    policy = _policy_for(project_id, user["email"])
    role = _user_role(user["email"])
    files = [
        path
        for path in store["preview_files"]
        if policy.effective_access(user["email"], role, path, _user_teams(user["email"]))["metadata"]
    ]
    return {"files": files}


class GrantRequest(BaseModel):
    subject_type: str = "user"
    subject_value: str
    path: str = ""
    effect: str = "allow"
    permissions: dict[str, bool] = {}
    expires_at: float | None = None
    windows: list[dict] = []


class DefaultAccessRequest(BaseModel):
    permissions: dict[str, bool] = {}


def _require_manager(project_id: str, token: str) -> tuple[dict, authz.Policy]:
    user = _require_authenticated(token)
    _enforce_org_membership(project_id, user["email"], _user_role(user["email"]))
    _load_project_result(project_id)
    policy = _policy_for(project_id, user["email"])
    if not authz.can_manage(user["email"], _user_role(user["email"]), policy):
        raise HTTPException(status_code=403, detail="You do not manage this repository.")
    return user, policy


@router.get("/api/projects/{project_id}/policy")
def get_project_policy(project_id: str, token: str = Query("")):
    """Return the current policy (owner / repo admins only)."""
    _user, policy = _require_manager(project_id, token)
    return policy.to_dict()


@router.post("/api/projects/{project_id}/grants")
def add_project_grant(project_id: str, request: GrantRequest, token: str = Query("")):
    """Add or update a user or team grant (owner / repo admins only)."""
    user, policy = _require_manager(project_id, token)
    if request.effect not in ("allow", "deny"):
        raise HTTPException(status_code=422, detail="effect must be 'allow' or 'deny'.")
    if request.subject_type not in ("user", "team"):
        raise HTTPException(status_code=422, detail="subject_type must be 'user' or 'team'.")
    unknown = set(request.permissions) - set(authz.PERMISSION_FLAGS)
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown permissions: {', '.join(sorted(unknown))}")
    if not request.subject_value.strip():
        raise HTTPException(status_code=422, detail="subject_value is required.")
    if request.expires_at is not None and request.expires_at <= time.time():
        raise HTTPException(status_code=422, detail="expires_at must be in the future.")
    try:
        windows = authz.validate_time_windows(request.windows)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    authz.set_grant(
        policy,
        request.subject_type,
        request.subject_value.strip(),
        request.path,
        request.effect,
        request.permissions,
        request.expires_at,
        windows,
    )
    authz.save_policy(policy, actor=user["email"], note=f"grant {request.effect} for {request.subject_type}")
    authz.audit(
        user["email"],
        "grant.upsert",
        f"{project_id}:{request.subject_type}:{request.subject_value}:{request.path}",
        {"effect": request.effect, "permissions": request.permissions, "expires_at": request.expires_at, "windows": windows},
    )
    bus.publish("policy.access", project_id, {"subject_type": request.subject_type, "subject": request.subject_value, "path": request.path})
    return policy.to_dict()


@router.delete("/api/projects/{project_id}/grants")
def remove_project_grant(project_id: str, request: GrantRequest, token: str = Query("")):
    """Remove a user or team grant (owner / repo admins only)."""
    user, policy = _require_manager(project_id, token)
    removed = authz.remove_grant(policy, request.subject_type, request.subject_value.strip(), request.path)
    if removed:
        authz.save_policy(policy, actor=user["email"], note="grant removed")
        authz.audit(
            user["email"],
            "grant.remove",
            f"{project_id}:{request.subject_type}:{request.subject_value}:{request.path}",
        )
        bus.publish("policy.access", project_id, {"subject_type": request.subject_type, "subject": request.subject_value, "path": request.path})
    return policy.to_dict()


@router.delete("/api/projects/{project_id}/membership")
def revoke_own_membership(project_id: str, token: str = Query("")):
    """A member can revoke the access a project granted them and leave.

    The owner cannot revoke their own access; anyone with a grant (or
    manager status) on the project can remove themselves."""
    user = _require_authenticated(token)
    email = user["email"]
    _enforce_org_membership(project_id, email, _user_role(email))
    policy = _policy_for(project_id, email)
    if email == policy.owner_email:
        raise HTTPException(status_code=422, detail="The owner cannot revoke their own access.")
    policy.grants = [
        grant
        for grant in policy.grants
        if not (grant.subject_type == "user" and grant.subject_value == email)
    ]
    if email in policy.managers:
        policy.managers.remove(email)
    authz.save_policy(policy, actor=email, note="member revoked own access")
    authz.audit(email, "project.leave", project_id, {"project": policy.project})
    bus.publish("policy.access", project_id, {"subject_type": "user", "subject": email, "path": ""})
    return {"status": "left", "project_id": project_id}


class ManagerRequest(BaseModel):
    email: str
    action: str = "add"  # "add" | "remove"


@router.post("/api/projects/{project_id}/managers")
def update_project_manager(project_id: str, request: ManagerRequest, token: str = Query("")):
    """Add or remove a repository manager (owner / repo admins only).

    Managers get full source access and can review access requests, edit
    policies, and manage collaborators — without owning the repository.
    """
    user, policy = _require_manager(project_id, token)
    email = request.email.strip().lower()
    action = request.action
    if not email:
        raise HTTPException(status_code=422, detail="email is required.")
    if action not in ("add", "remove"):
        raise HTTPException(status_code=422, detail="action must be 'add' or 'remove'.")
    if email == policy.owner_email:
        raise HTTPException(status_code=422, detail="The repository owner is always a manager.")
    accounts = authz.list_users_file()
    if email not in accounts:
        suggestions = sorted(
            [
                f"{account_email} ({account.get('github_login') or 'no GitHub login'})"
                for account_email, account in accounts.items()
                if request.email.strip().lower() in (account_email.lower(), (account.get("github_login") or "").lower())
            ]
        )
        raise HTTPException(
            status_code=422,
            detail=(
                "No registered account uses that email. "
                + ("Did you mean: " + ", ".join(suggestions) + "?" if suggestions else
                   "The person must log in with GitHub first (this creates their account), "
                   "then add them from the member list below.")
            ),
        )
    if action == "add":
        if email not in policy.managers:
            policy.managers.append(email)
        authz.set_user_grant(policy, email, "", "allow", authz._full_access())
    else:
        policy.managers = [manager for manager in policy.managers if manager != email]
    authz.save_policy(policy, actor=user["email"], note=f"manager {action}: {email}")
    authz.audit(
        user["email"],
        "manager.upsert",
        f"{project_id}:{email}:{action}",
        {"managers": list(policy.managers)},
    )
    bus.publish("policy.managers", project_id, {"email": email, "action": action, "managers": list(policy.managers)})
    return {"status": "ok", "managers": list(policy.managers)}


class ProjectStatusRequest(BaseModel):
    status: str


@router.put("/api/projects/{project_id}/status")
def update_project_status(project_id: str, request: ProjectStatusRequest, token: str = Query("")):
    """Set the project lifecycle status: new / in_progress / completed."""
    user, policy = _require_manager(project_id, token)
    status = request.status.strip().lower()
    if status not in ("new", "in_progress", "completed"):
        raise HTTPException(
            status_code=422,
            detail="status must be one of: new, in_progress, completed.",
        )
    if policy.status == status:
        return {"status": policy.status}
    previous = policy.status
    policy.status = status
    authz.save_policy(policy, actor=user["email"], note=f"status {previous} -> {status}")
    authz.audit(user["email"], "project.status", project_id, {"previous": previous, "status": status})
    bus.publish("project.status", project_id, {"previous": previous, "status": status})
    return {"status": policy.status}


@router.delete("/api/projects/{project_id}")
def delete_project(project_id: str, token: str = Query("")):
    """Permanently delete a repository and everything associated with it
    (policy, versions, access requests, graph, secrets, extracted files).
    Owner or super admin only."""
    user = _require_authenticated(token)
    policy = _policy_for(project_id, user["email"])
    _enforce_org_membership(project_id, user["email"], _user_role(user["email"]))
    if user["email"] != policy.owner_email and _user_role(user["email"]) != authz.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Only the repository owner can delete a project.")
    store = PROJECT_STORES.pop(project_id, None)
    if store:
        shutil.rmtree(store.get("root"), ignore_errors=True)
    shutil.rmtree((PROJECTS_ROOT / project_id).resolve(), ignore_errors=True)
    authz.delete_project(project_id)
    authz.audit(user["email"], "project.delete", project_id, {"project": policy.project})
    bus.publish("project.deleted", project_id, {"project": policy.project})
    return {"status": "deleted"}



@router.put("/api/projects/{project_id}/policy/default")
def update_default_access(project_id: str, request: DefaultAccessRequest, token: str = Query("")):
    """Configure the repository-wide default permission flags."""
    user, policy = _require_manager(project_id, token)
    unknown = set(request.permissions) - set(authz.PERMISSION_FLAGS)
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown permissions: {', '.join(sorted(unknown))}")
    for flag in authz.PERMISSION_FLAGS:
        if flag in request.permissions:
            policy.default_access[flag] = bool(request.permissions[flag])
    authz.save_policy(policy, actor=user["email"], note="default access updated")
    authz.audit(user["email"], "policy.default", project_id, dict(policy.default_access))
    bus.publish("policy.default", project_id, {"default_access": dict(policy.default_access)})
    return policy.to_dict()


@router.get("/api/projects/{project_id}/policy/versions")
def list_project_policy_versions(project_id: str, token: str = Query("")):
    """List the policy version history for this repository."""
    _user, _policy = _require_manager(project_id, token)
    return {"versions": authz.list_policy_versions(project_id)}


@router.get("/api/projects/{project_id}/policy/versions/{version}")
def get_project_policy_version(project_id: str, version: int, token: str = Query("")):
    """Return a full historical policy snapshot."""
    _user, _policy = _require_manager(project_id, token)
    snapshot = authz.get_policy_version(project_id, version)
    if snapshot is None:
        raise HTTPException(status_code=404, detail="Policy version not found.")
    return snapshot


@router.post("/api/projects/{project_id}/policy/versions/{version}/restore")
def restore_project_policy_version(project_id: str, version: int, token: str = Form(...)):
    """Restore a historical policy snapshot as the live policy."""
    user, _policy = _require_manager(project_id, token)
    restored = authz.restore_policy_version(project_id, version, actor=user["email"])
    if restored is None:
        raise HTTPException(status_code=404, detail="Policy version not found.")
    authz.audit(user["email"], "policy.restore", f"{project_id}:v{version}")
    bus.publish("policy.restore", project_id, {"version": version})
    return restored.to_dict()


@router.get("/api/projects/{project_id}/users")
def list_project_users(project_id: str, token: str = Query("")):
    """List the accounts that are actually part of this repository — the
    owner, managers, GitHub collaborators, and users with grants. Other
    registered accounts are never shown here, even to the owner."""
    _user, policy = _require_manager(project_id, token)
    users = authz.list_users_file()
    granted_emails = {
        grant.subject_value
        for grant in policy.grants
        if grant.subject_type == "user"
    }
    member_emails = (
        {policy.owner_email, *policy.managers, *policy.collaborators} | granted_emails
    )
    return {
        "users": [
            {
                "email": email,
                "name": user.get("name", ""),
                "role": (
                    "owner"
                    if email == policy.owner_email
                    else user.get("role", authz.DEFAULT_ROLE)
                    if user.get("role") != authz.SUPER_ADMIN
                    else authz.DEFAULT_ROLE
                ),
                "github_login": user.get("github_login"),
            }
            for email, user in sorted(users.items())
            if email in member_emails
        ],
        "pending": [
            {"login": item["login"], "permission": item.get("permission", "pull")}
            for item in policy.github_collaborators
            if not item.get("email")
        ],
    }


@router.put("/api/users/{email}/role")
def set_user_role(email: str, role: str = Query(...), token: str = Query("")):
    """Assign an account role so teams know each member's standing.

    Only super admins may change roles for now; the role set stays small so a
    team can grow into it later. Roles never grant implicit access on their
    own — access is still decided by the per-repository policy."""
    caller = _require_admin(token)
    from app.api import auth as auth_module

    target = email.strip().lower()
    if target not in auth_module.USERS:
        raise HTTPException(status_code=404, detail="User not found.")
    if role not in ("admin", "architect", "developer", "viewer"):
        raise HTTPException(status_code=422, detail="Invalid role.")
    if target == caller["email"]:
        raise HTTPException(status_code=422, detail="You cannot change your own role.")
    auth_module.USERS[target]["role"] = role
    auth_module._save_users()
    authz.audit(caller["email"], "user.role", target, {"role": role})
    bus.publish("user.changed", payload={"email": target, "role": role})
    return {"email": target, "role": role}


@router.post("/api/projects/{project_id}/access-requests")
def create_access_request(
    project_id: str,
    resource_path: str = Form(...),
    reason: str = Form(...),
    token: str = Form(...),
):
    """Let any authenticated user request source access to a resource."""
    user = _require_authenticated(token)
    _load_project_result(project_id)
    request = {
        "id": uuid.uuid4().hex,
        "project_id": project_id,
        "requester_email": user["email"],
        "requester_name": user.get("name", ""),
        "resource_path": resource_path,
        "permission": "source",
        "reason": reason,
        "status": "pending",
        "created_at": time.time(),
    }
    authz.save_access_request(project_id, request)
    authz.audit(user["email"], "access.request", f"{project_id}:{resource_path}")
    bus.publish("access.request", project_id, {"status": "pending"})
    return request


@router.get("/api/projects/{project_id}/access-requests")
def list_access_requests(project_id: str, token: str = Query("")):
    """List access requests. Managers see all; others see only their own."""
    user = _require_authenticated(token)
    _load_project_result(project_id)
    policy = _policy_for(project_id, user["email"])
    if authz.can_manage(user["email"], _user_role(user["email"]), policy):
        requests = authz.load_access_requests(project_id, "*")
    else:
        requests = authz.load_access_requests(project_id, user["email"])
    return {"requests": requests}


@router.post("/api/projects/{project_id}/access-requests/{request_id}")
def resolve_access_request(
    project_id: str,
    request_id: str,
    action: str = Form(...),
    token: str = Form(...),
    duration_hours: float = Form(0),
):
    """Approve (grants source access, optionally time-limited), reject, or
    temporarily approve a pending request."""
    user, policy = _require_manager(project_id, token)
    if action not in ("approve", "reject", "temporary"):
        raise HTTPException(status_code=422, detail="action must be 'approve', 'reject', or 'temporary'.")
    if action == "temporary" and duration_hours <= 0:
        raise HTTPException(status_code=422, detail="duration_hours must be positive for temporary approval.")
    request = next(
        (item for item in authz.load_access_requests(project_id, "*") if item.get("id") == request_id),
        None,
    )
    if not request:
        raise HTTPException(status_code=404, detail="Access request not found.")
    if request.get("status") != "pending":
        raise HTTPException(status_code=400, detail="This request has already been resolved.")
    if action in ("approve", "temporary"):
        expires_at = (time.time() + duration_hours * 3600) if action == "temporary" else None
        authz.set_user_grant(
            policy,
            request["requester_email"],
            request.get("resource_path", ""),
            "allow",
            {"metadata": True, "graph": True, "source": True, "download": True},
            expires_at,
        )
        authz.save_policy(policy, actor=user["email"], note=f"access request {action}")
        status = "approved" if action == "approve" else "approved_temporary"
    else:
        status = "rejected"
    authz.update_access_request(project_id, request_id, {"status": status})
    authz.audit(
        user["email"],
        f"access.{status}",
        f"{project_id}:{request.get('resource_path', '')}",
        {
            "requester": request["requester_email"],
            "duration_hours": duration_hours if action == "temporary" else None,
        },
    )
    bus.publish("access.request", project_id, {"status": status, "request_id": request_id, "requester": request["requester_email"]})
    return {"status": status, "request": request}


@router.post("/api/projects/{project_id}/sync-collaborators")
def sync_project_collaborators(project_id: str, token: str = Form(...)):
    """Re-pull the GitHub collaborator list and refresh grants (Phase 1: GitHub repos)."""
    user, policy = _require_manager(project_id, token)
    if policy.source != "github":
        raise HTTPException(status_code=400, detail="Only GitHub-imported repositories support collaborator sync.")
    from app.api.auth import USERS, _github_token_for_user

    owner = USERS.get(policy.owner_email)
    access_token = _github_token_for_user(owner)
    if not access_token:
        raise HTTPException(status_code=400, detail="The repository owner must have a connected GitHub account.")
    try:
        snapshot = authz.sync_github_collaborators(policy, access_token)
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"Could not fetch collaborators: {error}") from error
    authz.audit(user["email"], "collaborators.sync", project_id, {"collaborators": snapshot})
    bus.publish("policy.access", project_id, {"subject_type": "collaborator", "action": "sync"})
    return {"snapshot": snapshot, "policy": policy.to_dict()}


@router.get("/api/developer/projects")
def list_accessible_projects(token: str = Query("")):
    """List the repositories the current user may access (metadata or better).

    "MY PROJECTS" only lists repositories the user owns, manages, or holds an
    explicit grant on — one account never mirrors another account's data,
    super admin or not. Global management lives in the Admin Center.
    """
    user = _require_authenticated(token)
    role = _user_role(user["email"])
    user_orgs = authz.user_org_ids(user["email"], (user.get("github_login") or ""))
    projects = []
    for policy in authz.load_all_policies():
        if not authz.policy_org_access(policy, user["email"], role, user_orgs):
            continue
        access = policy.effective_access(user["email"], role, "", _user_teams(user["email"]))
        if not access["metadata"]:
            continue
        projects.append(
            {
                "project_id": policy.project_id,
                "project": policy.project,
                "owner_email": policy.owner_email,
                "source": policy.source,
                "organization_id": policy.organization_id,
                "status": policy.status,
                "access": access,
                "is_manager": authz.can_manage(user["email"], role, policy),
            }
        )
    projects.sort(key=lambda item: item["project"].lower())
    return {"projects": projects}


# ── Phase 3: search authorization ────────────────────────────────────────────
@router.get("/api/projects/{project_id}/search")
def search_project(
    project_id: str,
    q: str = Query(...),
    scope: str = Query("metadata"),
    token: str = Query(""),
):
    """Search a repository under the current user's permissions (§13–14).

    `scope=metadata` matches node names/paths; results only include nodes the
    user may know exist, and each carries its `access` state.
    `scope=source` matches source content, but only inside files the user can
    read; no restricted bytes ever leave the server.
    """
    user = _require_authenticated(token)
    _enforce_org_membership(project_id, user["email"], _user_role(user["email"]))
    result = _load_project_result(project_id)
    policy = _policy_for(project_id, user["email"])
    role = _user_role(user["email"])
    team_ids = _user_teams(user["email"])
    query = q.strip()
    if not query:
        return {"query": query, "results": []}

    if scope == "source":
        results = []
        store = _project_store(project_id)
        if not store:
            raise HTTPException(status_code=404, detail="Project not found or expired.")
        needle = query.lower()
        for node in result.get("nodes", []):
            if node.get("type") != "file":
                continue
            path = node.get("path", "")
            access = policy.effective_access(user["email"], role, path, team_ids)
            if not access["source"]:
                continue
            try:
                candidate = (store["root"] / Path(*PurePosixPath(path).parts)).resolve()
            except (ValueError, OSError):
                continue
            if not candidate.is_file():
                continue
            content = candidate.read_text(encoding="utf-8", errors="replace")
            for line_index, line in enumerate(content.splitlines(), start=1):
                if needle in line.lower():
                    results.append({"path": path, "line": line_index, "text": line.rstrip()})
                    if len(results) >= 100:
                        break
            if len(results) >= 100:
                break
        authz.audit(user["email"], "search.source", project_id, {"query": query, "hits": len(results)})
        return {"query": query, "scope": "source", "results": results}

    if scope != "metadata":
        raise HTTPException(status_code=422, detail="scope must be 'metadata' or 'source'.")
    hits = authz.search_metadata(result, user["email"], role, policy, query, team_ids)
    authz.audit(user["email"], "search.metadata", project_id, {"query": query, "hits": len(hits)})
    return {"query": query, "scope": "metadata", "results": hits}


# ── Phase 3: permission-respecting exports ───────────────────────────────────
@router.get("/api/projects/{project_id}/export")
def export_project(
    project_id: str,
    format: str = Query("json"),
    token: str = Query(""),
):
    """Export the repository view the current user is allowed to see (§30)."""
    user = _require_authenticated(token)
    if format not in ("json", "report"):
        raise HTTPException(status_code=422, detail="format must be 'json' or 'report'.")
    _enforce_org_membership(project_id, user["email"], _user_role(user["email"]))
    result = _load_project_result(project_id)
    policy = _policy_for(project_id, user["email"])
    role = _user_role(user["email"])
    export = authz.authorized_export(result, user["email"], role, policy, format, _user_teams(user["email"]))
    authz.audit(user["email"], "export", f"{project_id}:{format}")
    return export


# ── Phase 2: teams ───────────────────────────────────────────────────────────
class TeamRequest(BaseModel):
    name: str
    members: list[str] = []
    project_id: str = ""


def _validate_member_emails(emails: list[str]) -> list[str]:
    """Normalize member emails and reject any that don't match a registered
    account, so team grants are never silently lost to email mismatches."""
    normalized: list[str] = []
    accounts = authz.list_users_file()
    for raw in emails:
        email = raw.strip().lower()
        if not email:
            continue
        if email in accounts:
            normalized.append(email)
            continue
        suggestions = sorted(
            account_email
            for account_email, account in accounts.items()
            if email in (account_email.lower(), (account.get("github_login") or "").lower())
        )
        raise HTTPException(
            status_code=422,
            detail=(
                f"No registered account uses {raw.strip()!r}. "
                + ("Did you mean: " + ", ".join(suggestions) + "?" if suggestions else
                   "That person must log in with GitHub first (this creates their account), "
                   "then add them here.")
            ),
        )
    return normalized


def _require_admin(token: str) -> dict:
    """Super admins manage global teams."""
    user = _require_authenticated(token)
    if _user_role(user["email"]) != authz.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Only super admins manage teams.")
    return user


@router.get("/api/teams")
def list_teams(token: str = Query(""), project_id: str = Query("")):
    """List the teams of a project (super admins only). Teams are scoped to
    the project they were created in, so a team never leaks into another
    project's security center."""
    _require_admin(token)
    teams = [
        {
            "id": team_id,
            "name": team.get("name", ""),
            "members": team.get("members") or [],
            "project_id": team.get("project_id", ""),
            "created_at": team.get("created_at"),
        }
        for team_id, team in sorted(authz.list_teams().items())
        if not project_id or team.get("project_id", "") == project_id
    ]
    return {"teams": teams}


@router.post("/api/teams")
def create_team(request: TeamRequest, token: str = Query("")):
    """Create a team scoped to a project (super admins only)."""
    user = _require_admin(token)
    if not request.name.strip():
        raise HTTPException(status_code=422, detail="name is required.")
    team_id = f"team-{uuid.uuid4().hex[:8]}"
    team = {
        "id": team_id,
        "name": request.name.strip(),
        "members": _validate_member_emails(request.members),
        "project_id": request.project_id,
        "created_at": time.time(),
        "created_by": user["email"],
    }
    authz.save_team(team)
    authz.audit(user["email"], "team.create", team_id, {"name": team["name"], "project_id": request.project_id})
    bus.publish("team.changed", payload={"team_id": team_id, "action": "create"})
    return team


@router.put("/api/teams/{team_id}")
def update_team(team_id: str, request: TeamRequest, token: str = Query(""), project_id: str = Query("")):
    """Rename a team and/or replace its membership."""
    user = _require_admin(token)
    teams = authz.list_teams()
    if team_id not in teams:
        raise HTTPException(status_code=404, detail="Team not found.")
    team = teams[team_id]
    if project_id and team.get("project_id", "") != project_id:
        raise HTTPException(status_code=403, detail="Team does not belong to this project.")
    if request.name.strip():
        team["name"] = request.name.strip()
    team["members"] = _validate_member_emails(request.members)
    authz.save_team(team)
    authz.audit(user["email"], "team.update", team_id, {"members": team["members"]})
    bus.publish("team.changed", payload={"team_id": team_id, "action": "update"})
    return team


@router.post("/api/teams/{team_id}/members")
def add_team_member(team_id: str, request: TeamRequest, token: str = Query(""), project_id: str = Query("")):
    """Add members to an existing team without replacing the whole roster."""
    user = _require_admin(token)
    teams = authz.list_teams()
    if team_id not in teams:
        raise HTTPException(status_code=404, detail="Team not found.")
    team = teams[team_id]
    if project_id and team.get("project_id", "") != project_id:
        raise HTTPException(status_code=403, detail="Team does not belong to this project.")
    current = set(team.get("members") or [])
    current.update(_validate_member_emails(request.members))
    team["members"] = sorted(current)
    authz.save_team(team)
    authz.audit(user["email"], "team.update", team_id, {"members": team["members"]})
    bus.publish("team.changed", payload={"team_id": team_id, "action": "update"})
    return team


@router.delete("/api/teams/{team_id}")
def delete_team(team_id: str, token: str = Query(""), project_id: str = Query("")):
    """Delete a team (super admins only)."""
    user = _require_admin(token)
    teams = authz.list_teams()
    if team_id not in teams:
        raise HTTPException(status_code=404, detail="Team not found.")
    if project_id and teams[team_id].get("project_id", "") != project_id:
        raise HTTPException(status_code=403, detail="Team does not belong to this project.")
    if not authz.delete_team(team_id):
        raise HTTPException(status_code=404, detail="Team not found.")
    authz.audit(user["email"], "team.delete", team_id, {"project_id": project_id})
    bus.publish("team.changed", payload={"team_id": team_id, "action": "delete"})
    return {"status": "deleted"}


# ── Phase 4: sensitive-information review ────────────────────────────────────
@router.get("/api/projects/{project_id}/secrets")
def get_project_secrets(project_id: str, token: str = Query("")):
    """Return redacted secret findings for a repository (owner / admins only)."""
    user = _require_authenticated(token)
    role = _user_role(user["email"])
    policy = _policy_for(project_id, user["email"])
    _enforce_org_membership(project_id, user["email"], role)
    if not authz.can_manage(user["email"], role, policy) and role != authz.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized to view secrets.")
    findings = authz.load_project_secrets(project_id)
    return {"count": len(findings), "secrets": findings}


# ── Phase 5: admin analytics, audit, security events ─────────────────────────
@router.get("/api/admin/users")
def admin_list_users(token: str = Query("")):
    """List registered accounts for admin consoles (super admins only)."""
    _require_admin(token)
    from app.api.auth import USERS

    return {
        "users": [
            {
                "email": email,
                "name": user.get("name", ""),
                "role": _user_role(email),
                "github_login": user.get("github_login"),
                "created_at": user.get("created_at"),
            }
            for email, user in sorted(USERS.items())
        ]
    }


@router.get("/api/admin/analytics")
def admin_analytics(token: str = Query("")):
    """Enterprise dashboard numbers for super admins."""
    user = _require_admin(token)
    from app.api.auth import USERS

    users = dict(USERS)
    policies = authz.load_all_policies()
    requests = _load_all_access_requests()
    teams = authz.list_teams()
    grants_total = sum(len(policy.grants) for policy in policies)
    pending = [
        request for request in requests
        if request.get("status") == "pending"
    ]
    analytics = {
        "users": len(users),
        "teams": len(teams),
        "repositories": len(policies),
        "grants_total": grants_total,
        "pending_access_requests": len(pending),
        "repositories_with_policy": len(policies),
        "coverage": [
            {
                "project_id": policy.project_id,
                "project": policy.project,
                "owner_email": policy.owner_email,
                "grants": len(policy.grants),
                "source_default": policy.default_access.get("source", False),
            }
            for policy in policies
        ],
    }
    authz.audit(user["email"], "admin.analytics", "global")
    return analytics


def _load_all_access_requests() -> list[dict[str, Any]]:
    import json as _json

    path = authz.DATA_BASE / "access_requests.json"
    if not path.exists():
        return []
    try:
        data = _json.loads(path.read_text(encoding="utf-8"))
    except (_json.JSONDecodeError, OSError):
        return []
    return list(data.values())


@router.get("/api/admin/audit")
def admin_audit_log(
    token: str = Query(""),
    limit: int = Query(100, ge=1, le=1000),
    action: str = Query(""),
    email: str = Query(""),
):
    """View the audit trail (super admins only)."""
    user = _require_admin(token)
    events = authz.list_audit_events(limit, action or None, email or None)
    authz.audit(user["email"], "admin.audit.view", "global")
    return {"events": events}


@router.get("/api/admin/security-events")
def admin_security_events(token: str = Query("")):
    """Run anomaly detection and return security alerts (super admins only)."""
    user = _require_admin(token)
    new_alerts = authz.detect_anomalies()
    events = authz.list_security_events(limit=100)
    authz.audit(user["email"], "admin.security.view", "global", {"new_alerts": len(new_alerts)})
    return {"new_alerts": new_alerts, "events": events}


@router.get("/api/admin/projects")
def admin_list_projects(token: str = Query("")):
    """List every project across all accounts (admin panel only)."""
    user = _require_admin(token)
    projects = []
    for policy in authz.load_all_policies():
        projects.append(
            {
                "project_id": policy.project_id,
                "project": policy.project,
                "owner_email": policy.owner_email,
                "source": policy.source,
                "status": policy.status,
                "managers": list(policy.managers),
                "grants": len(policy.grants),
                "collaborators": len(policy.collaborators),
                "organization_id": policy.organization_id,
            }
        )
    projects.sort(key=lambda item: item["owner_email"].lower())
    return {"projects": projects}


@router.get("/api/admin/projects/{project_id}/graph")
def admin_get_project_graph(project_id: str, token: str = Query("")):
    """Return a project's full graph unfiltered (admin panel only)."""
    user = _require_admin(token)
    result = authz.load_project_graph(project_id)
    if not result:
        raise HTTPException(status_code=404, detail="Project not found or expired.")
    policy = _policy_for(project_id, user["email"])
    result["owner_email"] = policy.owner_email
    result["is_manager"] = True
    result["policy_source"] = policy.source
    return result


# ── Phase 5: organizations (multi-tenant) ────────────────────────────────────
class OrganizationRequest(BaseModel):
    name: str = ""
    members: list[str] = []


def _require_org_manager(org_id: str, token: str) -> dict:
    """Super admins and the org owner can manage an organization."""
    user = _require_admin(token)
    org = authz.list_organizations().get(org_id)
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found.")
    if _user_role(user["email"]) != authz.SUPER_ADMIN and user["email"] != org.get("owner_email"):
        raise HTTPException(status_code=403, detail="You do not manage this organization.")
    return user


@router.get("/api/organizations")
def list_organizations(token: str = Query("")):
    """List organizations. Super admins see all; others see only their own."""
    user = _require_authenticated(token)
    role = _user_role(user["email"])
    orgs = authz.list_organizations()
    result = []
    for org_id, org in sorted(orgs.items()):
        if role != authz.SUPER_ADMIN and not (
            user["email"] == org.get("owner_email") or user["email"] in (org.get("members") or [])
        ):
            continue
        result.append(
            {
                "id": org_id,
                "name": org.get("name", ""),
                "owner_email": org.get("owner_email", ""),
                "members": org.get("members") or [],
                "created_at": org.get("created_at"),
                "project_ids": org.get("project_ids") or [],
            }
        )
    return {"organizations": result}


@router.post("/api/organizations")
def create_organization(request: OrganizationRequest, token: str = Query("")):
    """Create an organization (super admins only)."""
    user = _require_admin(token)
    if not request.name.strip():
        raise HTTPException(status_code=422, detail="name is required.")
    org_id = f"org-{uuid.uuid4().hex[:8]}"
    org = {
        "id": org_id,
        "name": request.name.strip(),
        "owner_email": user["email"],
        "members": list(dict.fromkeys(member.strip() for member in request.members if member.strip())),
        "project_ids": [],
        "created_at": time.time(),
    }
    authz.save_organization(org)
    authz.audit(user["email"], "org.create", org_id, {"name": org["name"]})
    bus.publish("org.changed", payload={"org_id": org_id, "action": "create"})
    return org


@router.put("/api/organizations/{org_id}")
def update_organization(org_id: str, request: OrganizationRequest, token: str = Query("")):
    """Rename an organization and/or replace membership (owner / super admin)."""
    user = _require_org_manager(org_id, token)
    orgs = authz.list_organizations()
    org = orgs[org_id]
    if request.name.strip():
        org["name"] = request.name.strip()
    org["members"] = list(dict.fromkeys(member.strip() for member in request.members if member.strip()))
    authz.save_organization(org)
    authz.audit(user["email"], "org.update", org_id, {"members": org["members"]})
    bus.publish("org.changed", payload={"org_id": org_id, "action": "update"})
    return org


@router.delete("/api/organizations/{org_id}")
def delete_organization(org_id: str, token: str = Query("")):
    """Delete an organization (super admins only)."""
    user = _require_admin(token)
    if not authz.delete_organization(org_id):
        raise HTTPException(status_code=404, detail="Organization not found.")
    authz.audit(user["email"], "org.delete", org_id)
    bus.publish("org.changed", payload={"org_id": org_id, "action": "delete"})
    return {"status": "deleted"}


@router.post("/api/organizations/{org_id}/projects/{project_id}")
def assign_organization_project(org_id: str, project_id: str, token: str = Query("")):
    """Attach a repository to an organization (owner / super admin). Once
    attached, only the org's members (plus owner/super admin) can see it."""
    user = _require_org_manager(org_id, token)
    orgs = authz.list_organizations()
    org = orgs[org_id]
    policy = _policy_for(project_id, user["email"])
    role = _user_role(user["email"])
    if not authz.can_manage(user["email"], role, policy) and role != authz.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="You do not manage this repository.")
    policy.organization_id = org_id
    authz.save_policy(policy, actor=user["email"], note="assigned to organization")
    if project_id not in org["project_ids"]:
        org["project_ids"].append(project_id)
        authz.save_organization(org)
    authz.audit(user["email"], "org.assign_project", org_id, {"project_id": project_id})
    bus.publish("org.changed", payload={"org_id": org_id, "action": "assign_project", "project_id": project_id})
    return {"organization_id": org_id, "project_id": project_id}


@router.delete("/api/organizations/{org_id}/projects/{project_id}")
def unassign_organization_project(org_id: str, project_id: str, token: str = Query("")):
    """Detach a repository from an organization (owner / super admin)."""
    user = _require_org_manager(org_id, token)
    orgs = authz.list_organizations()
    org = orgs[org_id]
    policy = _policy_for(project_id, user["email"])
    policy.organization_id = ""
    authz.save_policy(policy, actor=user["email"], note="removed from organization")
    org["project_ids"] = [pid for pid in org.get("project_ids", []) if pid != project_id]
    authz.save_organization(org)
    authz.audit(user["email"], "org.unassign_project", org_id, {"project_id": project_id})
    bus.publish("org.changed", payload={"org_id": org_id, "action": "unassign_project", "project_id": project_id})
    return {"organization_id": "", "project_id": project_id}


# ── Phase 5: admin permission preview (read-only impersonation) ──────────────
@router.get("/api/admin/effective-permissions")
def admin_effective_permissions(
    token: str = Query(""),
    email: str = Query(""),
    project_id: str = Query(""),
):
    """Read-only preview: what would this user be allowed to know/see in a
    repository? Does NOT change any state or session (§41)."""
    admin = _require_admin(token)
    if not email.strip():
        raise HTTPException(status_code=422, detail="email is required.")
    from app.api.auth import USERS

    target = USERS.get(email.strip())
    if target is None:
        raise HTTPException(status_code=404, detail="Target user not found.")
    _enforce_org_membership(project_id, admin["email"], _user_role(admin["email"]))
    policy = _policy_for(project_id, admin["email"])
    role = _user_role(email.strip())
    teams = sorted(authz.user_team_ids(email.strip()))
    access = policy.effective_access(email.strip(), role, "", teams)
    summary = {
        "email": email.strip(),
        "role": role,
        "teams": teams,
        "owner": email.strip() == policy.owner_email,
        "organization": policy.organization_id,
        "in_org": policy.organization_id in authz.user_org_ids(email.strip()),
        "default_access": dict(policy.default_access),
        "effective_access": access,
        "explanation": policy.explanation(email.strip(), role, "", teams),
        "grants": [
            {
                "subject_type": grant.subject_type,
                "subject_value": grant.subject_value,
                "path": grant.path,
                "effect": grant.effect,
                "permissions": grant.permissions,
                "expires_at": grant.expires_at,
            }
            for grant in policy.grants
        ],
    }
    authz.audit(admin["email"], "admin.preview.effective", f"{project_id}:{email.strip()}")
    return summary


@router.get("/api/admin/preview-graph")
def admin_preview_graph(
    token: str = Query(""),
    email: str = Query(""),
    project_id: str = Query(""),
):
    """Read-only preview of the graph exactly as the target user would see it
    (their access flags applied), never modifying state (§41)."""
    admin = _require_admin(token)
    if not email.strip():
        raise HTTPException(status_code=422, detail="email is required.")
    from app.api.auth import USERS

    target = USERS.get(email.strip())
    if target is None:
        raise HTTPException(status_code=404, detail="Target user not found.")
    _enforce_org_membership(project_id, admin["email"], _user_role(admin["email"]))
    result = _load_project_result(project_id)
    policy = _policy_for(project_id, admin["email"])
    role = _user_role(email.strip())
    graph = authz.authorized_graph(
        result, email.strip(), role, policy, authz.user_team_ids(email.strip())
    )
    graph["_previewed_as"] = email.strip()
    authz.audit(admin["email"], "admin.preview.graph", f"{project_id}:{email.strip()}")
    return graph
