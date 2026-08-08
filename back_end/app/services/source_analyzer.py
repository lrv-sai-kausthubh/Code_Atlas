from pathlib import PurePosixPath
import re
from typing import Callable


ResolveImport = Callable[[PurePosixPath, str, set[PurePosixPath]], PurePosixPath | None]
CALL_KEYWORDS = {"if", "for", "while", "switch", "catch", "function", "def", "return", "typeof"}
FUNCTION_CALL_PATTERN = re.compile(r"\b([A-Za-z_$][\w$]*)\s*\(")
API_PATTERNS = (
    (re.compile(r"\bfetch\s*\("), "fetch", "HTTP request"),
    (re.compile(r"\baxios\s*(?:\.\s*(get|post|put|patch|delete|request))?\s*\("), "axios", "HTTP request"),
    (re.compile(r"\brequests\s*\.\s*(get|post|put|patch|delete)\s*\("), "requests", "HTTP request"),
    (re.compile(r"\bhttpx\s*\.\s*(get|post|put|patch|delete)\s*\("), "httpx", "HTTP request"),
    (re.compile(r"\b(openai|stripe|supabase|firebase)\b"), "third-party SDK", "external service integration"),
)
REACT_FLOW_NAMES = {"ReactFlow", "ReactFlowProvider", "useReactFlow", "useNodesState", "useEdgesState", "Background", "Controls", "MiniMap"}


def _split_parameters(raw: str) -> list[str]:
    parameters = []
    current = []
    depth = 0
    for character in raw:
        if character in "([{<":
            depth += 1
        elif character in ")]}>" and depth:
            depth -= 1
        if character == "," and depth == 0:
            if "".join(current).strip():
                parameters.append("".join(current).strip())
            current = []
        else:
            current.append(character)
    if "".join(current).strip():
        parameters.append("".join(current).strip())
    return parameters


def _inferred_type(name: str, annotation: str) -> str:
    if annotation:
        return annotation.strip()
    lowered = name.lower()
    if any(word in lowered for word in ("vector", "embedding")):
        return "vector (inferred)"
    if any(word in lowered for word in ("json", "data", "payload", "body", "config", "options")):
        return "JSON/object (inferred)"
    if any(word in lowered for word in ("id", "count", "index", "limit", "offset")):
        return "number/string (inferred)"
    return "unknown"


def _parse_parameters(raw: str) -> list[dict]:
    result = []
    for parameter in _split_parameters(raw):
        parameter = re.sub(r"^\.\.\.", "", parameter).strip()
        parameter = parameter.split("=", 1)[0].strip()
        if not parameter:
            continue
        if ":" in parameter:
            name, annotation = parameter.split(":", 1)
        else:
            name, annotation = parameter, ""
        name = name.strip().strip("{}[]")
        result.append({"name": name, "type": _inferred_type(name, annotation)})
    return result


def _function_matches(path: PurePosixPath, content: str) -> list[re.Match]:
    if path.suffix.lower() == ".py":
        return list(re.finditer(r"(?m)^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*:", content))
    return list(re.finditer(r"(?m)^\s*(?:(?:export|default|async)\s+)*(?:function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>)", content))


def _line_number(content: str, offset: int) -> int:
    return content.count("\n", 0, offset) + 1


def _function_end(path: PurePosixPath, content: str, match: re.Match) -> int:
    start_line = _line_number(content, match.start())
    lines = content.splitlines()
    if path.suffix.lower() == ".py":
        definition = lines[start_line - 1]
        indentation = len(definition) - len(definition.lstrip())
        end_line = start_line
        for index in range(start_line, len(lines)):
            line = lines[index]
            if line.strip() and len(line) - len(line.lstrip()) <= indentation:
                break
            end_line = index + 1
        return max(end_line, start_line)

    open_brace = content.find("{", match.end())
    if open_brace < 0:
        return start_line
    depth = 0
    quote = ""
    escaped = False
    for index in range(open_brace, len(content)):
        character = content[index]
        if quote:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote:
                quote = ""
            continue
        if character in "\"'`":
            quote = character
        elif character == "{":
            depth += 1
        elif character == "}":
            depth -= 1
            if depth == 0:
                return _line_number(content, index)
    return len(lines)


def _import_statement_details(path: PurePosixPath, content: str, file_paths: set[PurePosixPath], resolve_import: ResolveImport) -> tuple[list[dict], list[str], dict[str, str]]:
    local_imports = []
    external_imports = []
    imported_symbols: dict[str, str] = {}
    if path.suffix.lower() == ".py":
        statements = re.finditer(r"(?m)^\s*from\s+([.][A-Za-z0-9_./-]+)\s+import\s+([^\n#]+)", content)
        for statement in statements:
            specifier, names = statement.groups()
            target = resolve_import(path, specifier, file_paths)
            parsed_names = [part.strip().split(" as ")[-1] for part in names.split(",") if part.strip()]
            if target:
                target_path = target.as_posix()
                local_imports.append({"path": target_path, "names": parsed_names})
                for name in parsed_names:
                    imported_symbols[name] = target_path
            else:
                external_imports.append(specifier)
        return local_imports, sorted(set(external_imports)), imported_symbols

    from_statements = re.finditer(r"(?m)^\s*import\s+(.+?)\s+from\s+[\"']([^\"']+)[\"']", content)
    side_effects = re.finditer(r"(?m)^\s*import\s+[\"']([^\"']+)[\"']", content)
    require_statements = re.finditer(r"\b(?:require|import)\s*\(\s*[\"']([^\"']+)[\"']\s*\)", content)
    for statement in from_statements:
        bindings, specifier = statement.groups()
        target = resolve_import(path, specifier, file_paths)
        names = []
        if "{" in bindings:
            names.extend(part.strip().split(" as ")[-1] for part in bindings.split("{", 1)[1].split("}", 1)[0].split(",") if part.strip())
        else:
            default_name = bindings.strip().split(",", 1)[0].strip()
            if default_name and not default_name.startswith("*"):
                names.append(default_name)
        if target:
            target_path = target.as_posix()
            local_imports.append({"path": target_path, "names": names})
            for name in names:
                imported_symbols[name] = target_path
        else:
            external_imports.append(specifier)
    for statement in side_effects:
        specifier = statement.group(1)
        if not resolve_import(path, specifier, file_paths):
            external_imports.append(specifier)
    for statement in require_statements:
        specifier = statement.group(1)
        target = resolve_import(path, specifier, file_paths)
        if target:
            local_imports.append({"path": target.as_posix(), "names": []})
        else:
            external_imports.append(specifier)
    return local_imports, sorted(set(external_imports)), imported_symbols


def _api_calls(content: str) -> list[dict]:
    calls = []
    for pattern, provider, description in API_PATTERNS:
        for match in pattern.finditer(content):
            method = match.group(1) if match.lastindex else None
            calls.append({"provider": provider, "operation": f"{method.upper()} {description}" if method else description, "expression": content[content.rfind("\n", 0, match.start()) + 1:content.find("\n", match.end()) if content.find("\n", match.end()) >= 0 else len(content)].strip()[:180]})
    return calls


def analyze_source_files(source_contents: dict[PurePosixPath, str], file_paths: set[PurePosixPath], resolve_import: ResolveImport) -> dict[str, dict]:
    """Extract explainable source details without claiming full AST accuracy."""
    details = {}
    for path, content in source_contents.items():
        local_imports, external_imports, imported_symbols = _import_statement_details(path, content, file_paths, resolve_import)
        file_calls = _api_calls(content)
        file_uses = []
        if "@xyflow/react" in content or "reactflow" in content.lower():
            file_uses.append("React Flow")
        if external_imports:
            file_uses.extend(external_imports)
        functions = []
        lines = content.splitlines()
        for match in _function_matches(path, content):
            if path.suffix.lower() == ".py":
                name = match.group(1)
                parameters = match.group(2)
            else:
                name = match.group(1) or match.group(3) or "anonymous"
                parameters = match.group(2) or match.group(4) or ""
            start_line = _line_number(content, match.start())
            end_line = _function_end(path, content, match)
            body = "\n".join(lines[start_line - 1:end_line])
            calls = []
            for call_match in FUNCTION_CALL_PATTERN.finditer(body):
                called_name = call_match.group(1)
                if called_name in CALL_KEYWORDS or called_name == name:
                    continue
                calls.append({"name": called_name, "target": imported_symbols.get(called_name)})
            function_api_calls = _api_calls(body)
            function_uses = ["React Flow"] if any(name in body for name in REACT_FLOW_NAMES) else []
            summary_parts = []
            if calls:
                summary_parts.append(f"Calls {', '.join(sorted({call['name'] for call in calls})[:5])}")
            if function_api_calls:
                summary_parts.append("makes an external/API request")
            if function_uses:
                summary_parts.append("uses React Flow")
            functions.append({"name": name, "signature": lines[start_line - 1].strip()[:220], "line_start": start_line, "line_end": end_line, "inputs": _parse_parameters(parameters), "calls": calls, "api_calls": function_api_calls, "uses": function_uses, "summary": "; ".join(summary_parts) or "No direct calls detected.", "snippet": "\n".join(lines[start_line - 1:min(end_line, start_line + 34)])[:4000]})
        details[f"file:{path.as_posix()}"] = {"path": path.as_posix(), "imports": local_imports, "external_imports": external_imports, "uses": sorted(set(file_uses)), "api_calls": file_calls, "functions": functions}
    return details
