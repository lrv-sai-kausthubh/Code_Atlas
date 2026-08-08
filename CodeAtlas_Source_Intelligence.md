# CodeAtlas Source Intelligence

## Scope

CodeAtlas now has a source-intelligence layer on top of the file dependency graph. The upload pipeline still returns folders, files, `CONTAINS` edges, and `IMPORTS` edges, but it also analyzes supported source files so a developer can inspect what a file does without opening a separate editor.

## Current Flow

```text
ZIP upload
  -> safe extraction and progress tracking
  -> file tree and import graph
  -> repository metrics and security scan
  -> source function/import/API analysis
  -> graph + file details JSON
  -> React Flow workspace and inspector
```

The backend remains the only layer that reads uploaded source. The frontend receives structured metadata and bounded snippets through the existing upload-result endpoint.

## Backend Contract

`POST /api/upload` starts processing. The client polls:

- `GET /api/upload/{upload_id}/progress`
- `GET /api/upload/{upload_id}/result`

The result now includes:

```json
{
  "function_calls": [],
  "file_details": {
    "file:src/example.ts": {
      "path": "src/example.ts",
      "imports": [],
      "external_imports": ["axios"],
      "uses": ["React Flow"],
      "api_calls": [],
      "functions": []
    }
  }
}
```

Each function detail includes its name, signature, line range, inferred inputs, calls, API calls, library usage, a short summary, and a bounded code snippet.

## Analysis Behavior

The current implementation is intentionally conservative and dependency-free:

- JavaScript, JSX, TypeScript, TSX, and Python function definitions are detected with source-aware regular expressions.
- Local import aliases are resolved to repository files when possible.
- Cross-file calls are linked using imported symbol names.
- External package calls are recognized for React, React Flow, Axios, Zustand, React Router, Socket.IO, browser `fetch`, and common SDK patterns.
- Parameter types use explicit TypeScript/Python annotations when present and otherwise use clearly labeled name-based inference such as `JSON`, `vector`, `URL`, `array`, or `any`.
- Snippets are limited to the detected function body and a fixed character/line budget so large files do not create an unbounded API response.

This is not a substitute for Tree-sitter or a compiler API. The next parser milestone should replace the regular expressions with AST-backed definitions and call resolution while preserving this response shape.

## Frontend Behavior

When a file is selected in the VS Code-style explorer:

1. Its ancestor folders are expanded.
2. The graph viewport fits to that file node.
3. The node receives a short focus pulse.
4. The inspector opens automatically if it was collapsed.
5. The inspector shows imports, external packages, React Flow/library usage, function definitions, parameters, calls, API calls, cross-file call targets, and expandable snippets.

The same focus behavior is used when selecting a file directly in the graph.

## Files Changed

- `back_end/app/api/routes.py`: integrates structured source details into the asynchronous upload result.
- `back_end/app/services/source_analyzer.py`: extracts function, input, call, import, API, and usage metadata.
- `front_end/src/types/project.ts`: defines the source-intelligence response types.
- `front_end/src/components/workspace/inspector-panel.tsx`: renders expandable source intelligence and snippets.
- `front_end/src/components/workspace/workspace-layout.tsx`: expands ancestors and coordinates focus navigation.
- `front_end/src/components/workspace/graph-panel.tsx`: passes focus state into the graph canvas.
- `front_end/src/components/atlas/graph-canvas.tsx`: fits the graph to the selected node.
- `front_end/src/components/atlas/graph-layout.ts`: adds temporary focus state to graph nodes.
- `front_end/src/components/atlas/atlas-node.tsx`: renders focus styling.
- `front_end/src/components/atlas/atlas-types.ts`: adds focused-node metadata.
- `front_end/src/index.css`: adds the focus pulse animation.

## Validation

The current frontend checks are:

```text
npm run build
npm run lint
```

The backend source modules are syntax-checked with:

```text
python3 -m py_compile app/main.py app/api/routes.py app/services/source_analyzer.py
```

## Next Steps

1. Replace regex parsing with Tree-sitter AST extraction.
2. Add definition-to-usage graph edges for functions and components.
3. Add a code viewer with file-level context and search highlighting.
4. Add path finding and two-hop focus mode.
5. Use the structured graph as context for repository Q&A after deterministic analysis is stable.
