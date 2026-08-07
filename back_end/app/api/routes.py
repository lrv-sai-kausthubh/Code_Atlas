from collections import Counter
from io import BytesIO
from pathlib import Path, PurePosixPath
import re
import tempfile
import zipfile

from fastapi import APIRouter, File, HTTPException, UploadFile

router = APIRouter()


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


IGNORED_DIRECTORIES = {"node_modules", ".git", "dist", "build", "__pycache__", "venv", ".venv"}
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
}
SOURCE_EXTENSIONS = {".js", ".jsx", ".ts", ".tsx", ".py"}
RESOLVE_EXTENSIONS = ["", ".ts", ".tsx", ".js", ".jsx", ".py", ".json", ".css", ".html"]


def is_ignored(path: PurePosixPath) -> bool:
    return any(part in IGNORED_DIRECTORIES for part in path.parts)


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


def build_analysis(file_paths: list[PurePosixPath], edges: list[dict], file_sizes: dict[PurePosixPath, int], file_lines: dict[PurePosixPath, int]) -> dict:
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
    score = max(0, min(100, round(100 - len(cycles) * 10 - orphan_ratio * 20 - sum(1 for path in file_paths if file_lines.get(path, 0) > 500) * 3)))

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
        "health_score": score,
    }


@router.post("/api/upload")
async def upload_project(file: UploadFile = File(...)):
    """Extract a ZIP project and return a visualizable project tree."""
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Please upload a .zip project file.")

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Project ZIPs must be smaller than 50 MB.")

    try:
        with tempfile.TemporaryDirectory() as temporary_directory:
            extraction_root = Path(temporary_directory).resolve()
            with zipfile.ZipFile(BytesIO(content)) as archive:
                members = []
                source_contents = {}
                file_sizes = {}
                file_lines = {}
                for info in archive.infolist():
                    member_path = PurePosixPath(info.filename)
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
    except zipfile.BadZipFile as error:
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid ZIP archive.") from error

    nodes = [{"id": "root", "label": Path(file.filename).stem, "path": "", "type": "project"}]
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

    analysis = build_analysis(file_paths, edges, file_sizes, file_lines)
    for node in nodes:
        if node["type"] != "file":
            continue
        path = PurePosixPath(node["path"])
        node["size_bytes"] = file_sizes.get(path, 0)
        node["lines"] = file_lines.get(path, 0)

    return {
        "project": Path(file.filename).stem,
        "files": len(file_paths),
        "folders": max(len(directories) - 1, 0),
        "languages": dict(language_counts.most_common()),
        "nodes": nodes,
        "edges": edges,
        "analysis": analysis,
    }
