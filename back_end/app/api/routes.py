import threading
import time
from collections import Counter
from io import BytesIO
from pathlib import Path, PurePosixPath
import re
import shutil
import uuid
import zipfile

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

router = APIRouter()

PREVIEW_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico", ".avif", ".pdf"}
PROJECTS_ROOT = Path(__file__).resolve().parents[3] / "data_base" / "uploads"
PROJECT_STORES: dict[str, dict] = {}

MAX_ZIP_BYTES = 200 * 1024 * 1024
MAX_EXTRACTED_BYTES = 250 * 1024 * 1024

UPLOAD_TASKS: dict[str, dict] = {}
UPLOAD_TASKS_LOCK = threading.Lock()


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


def _update_upload_task(upload_id: str, **changes) -> None:
    with UPLOAD_TASKS_LOCK:
        task = UPLOAD_TASKS.get(upload_id)
        if task:
            task.update(changes)


def _progress_snapshot(task: dict) -> dict:
    return {key: value for key, value in task.items() if key != "result"}


def _extract_and_analyze(upload_id: str, content: bytes, filename: str) -> None:
    started = time.monotonic()
    project_id = uuid.uuid4().hex
    PROJECTS_ROOT.mkdir(parents=True, exist_ok=True)
    extraction_root = (PROJECTS_ROOT / project_id).resolve()
    try:
        with zipfile.ZipFile(BytesIO(content)) as archive:
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

    analysis = build_analysis(file_paths, edges, file_sizes, file_lines)
    for node in nodes:
        if node["type"] != "file":
            continue
        path = PurePosixPath(node["path"])
        node["size_bytes"] = file_sizes.get(path, 0)
        node["lines"] = file_lines.get(path, 0)

    result = {
        "project_id": project_id,
        "project": Path(filename).stem,
        "files": len(file_paths),
        "folders": max(len(directories) - 1, 0),
        "languages": dict(language_counts.most_common()),
        "nodes": nodes,
        "edges": edges,
        "analysis": analysis,
    }
    elapsed = time.monotonic() - started
    _update_upload_task(upload_id, status="complete", phase="done", progress=100.0, files_processed=len(file_paths), elapsed_seconds=round(elapsed, 1), remaining_seconds=0, result=result)


@router.post("/api/upload")
async def upload_project(file: UploadFile = File(...), upload_id: str = Form(...)):
    """Start extracting a ZIP project and stream progress via /api/upload/{upload_id}/progress."""
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Please upload a .zip project file.")

    content = await file.read()
    if len(content) > MAX_ZIP_BYTES:
        raise HTTPException(status_code=413, detail="Project ZIPs must be smaller than 200 MB.")

    task = _new_upload_task(upload_id)
    threading.Thread(target=_extract_and_analyze, args=(upload_id, content, file.filename), daemon=True).start()
    return {"upload_id": upload_id, "status": task["status"]}


@router.get("/api/upload/{upload_id}/progress")
def get_upload_progress(upload_id: str):
    """Return the live progress snapshot for an in-flight upload."""
    with UPLOAD_TASKS_LOCK:
        task = UPLOAD_TASKS.get(upload_id)
        if not task:
            raise HTTPException(status_code=404, detail="Upload not found or expired.")
        return _progress_snapshot(task)


@router.get("/api/upload/{upload_id}/result")
def get_upload_result(upload_id: str):
    """Return the final graph once processing is complete."""
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


@router.get("/api/projects/{project_id}/file")
def get_project_file(project_id: str, path: str = Query(...)):
    """Serve a raw file (image/PDF) from a previously uploaded project for preview."""
    store = PROJECT_STORES.get(project_id)
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
    return FileResponse(candidate)


@router.get("/api/projects/{project_id}/previewable")
def list_previewable_files(project_id: str):
    """List files in the uploaded project that support in-app preview."""
    store = PROJECT_STORES.get(project_id)
    if not store:
        raise HTTPException(status_code=404, detail="Project not found or expired.")
    return {"files": store["preview_files"]}
