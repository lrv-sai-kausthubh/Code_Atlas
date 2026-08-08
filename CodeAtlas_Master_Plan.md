# CodeAtlas -- Project Master Plan (V1)

## Vision

CodeAtlas is an AI-powered software architecture visualization platform
that converts a source code repository into an interactive graph so
developers can understand dependencies, architecture, and code flow.

## Core Problem

Large codebases become difficult to understand: - Which files import
which? - Where does execution flow? - What breaks if a file changes? -
Which modules are tightly coupled?

## Long-Term Goal

A developer tool combining ideas from dependency visualization, graph
databases, and AI-assisted code understanding.

------------------------------------------------------------------------

# Planned Tech Stack

## Frontend

-   React
-   TypeScript
-   Vite
-   Tailwind CSS (later)
-   React Flow (graph rendering)
-   Zustand (state management)
-   Axios

## Backend

-   Python 3.13+
-   FastAPI
-   Uvicorn
-   Tree-sitter (AST parsing)
-   NetworkX (graph algorithms)

## Database

-   Neo4j

------------------------------------------------------------------------

# Planned Product Roadmap

## V1 (Current)

-   Upload ZIP
-   Extract files
-   Parse imports
-   Build dependency graph
-   Store graph in Neo4j
-   Display graph with React Flow

## V2

-   GitHub repository integration
-   Automatic graph updates
-   Incremental parsing
-   Git history overlays

## V3

-   AI repository assistant
-   Code summaries
-   Architecture Q&A
-   Refactoring suggestions
-   Dependency analysis

------------------------------------------------------------------------

# High-Level Pipeline

ZIP Upload ↓ Extract ↓ Scan Files ↓ Parse AST ↓ Build Graph ↓ Store
Neo4j ↓ Return JSON ↓ Render Graph

------------------------------------------------------------------------

# Milestones

## Milestone 0 ✅ COMPLETE

### Completed

-   Planned architecture
-   Created GitHub repository
-   Backend structure
-   Frontend structure
-   Installed Node.js, Python, Git, VS Code
-   Neo4j instance created
-   React app created with Vite
-   FastAPI backend created
-   CORS configured
-   Axios configured
-   Frontend successfully communicates with backend
-   Git workflow established

### Frontend Structure

src/ - assets/ → images/icons - components/ → reusable UI - pages/ →
complete screens - services/ → API communication - store/ → global
state - types/ → TypeScript models - App.tsx → root component - main.tsx
→ React entry point - index.css → global styling

### Backend Structure

app/ - api/ - models/ - services/ - main.py

------------------------------------------------------------------------

# Next Milestone (Milestone 1)

Goal: Upload a ZIP file and return the project structure.

Tasks: 1. Create upload endpoint in FastAPI. 2. Accept ZIP files. 3.
Validate upload. 4. Extract to temporary directory. 5. Ignore: -
node_modules - .git - dist - build - **pycache** - venv 6. Walk
directory tree. 7. Return: - file count - folder count - language
statistics - file tree

Example response:

``` json
{
  "files": 124,
  "folders": 18,
  "languages": {
    "ts": 45,
    "js": 22,
    "css": 6
  }
}
```

------------------------------------------------------------------------

# Later Milestones

Milestone 2 - Tree-sitter parser - Import extraction

Milestone 3 - Neo4j graph storage

Milestone 4 - React Flow visualization

Milestone 5 - Inspector panel

Milestone 6 - Search and filters

Milestone 7 - Layout improvements

Milestone 8 - GitHub sync

Milestone 9 - AI assistant

------------------------------------------------------------------------

# Planned Features

## Core

-   ZIP upload
-   GitHub import
-   Dependency graph
-   Interactive navigation
-   File inspector
-   Search
-   Filters
-   Multiple graph layouts

## AI

-   Code explanation
-   Architecture summary
-   Refactoring suggestions
-   Dependency analysis
-   FAQ over repository
-   Change impact analysis

## Enterprise (Future)

-   Collaboration
-   Version comparison
-   Role-based access
-   Documentation generation
-   CI integration

------------------------------------------------------------------------

# Engineering Principles

-   Single Responsibility Principle
-   Modular architecture
-   API-first design
-   Frontend never talks directly to Neo4j
-   Services perform one responsibility each

Flow:

React ↓ FastAPI ↓ Service Layer ↓ Neo4j

------------------------------------------------------------------------

# Git Workflow

Design ↓ Implement ↓ Test ↓ git status ↓ git add . ↓ git commit -m
"meaningful message" ↓ git push

------------------------------------------------------------------------

# Learning Goals

Frontend: - React - TypeScript - Component architecture - State
management

Backend: - FastAPI - REST APIs - File uploads - Async programming

Computer Science: - ASTs - Static analysis - Graph theory - Dependency
graphs

Databases: - Neo4j - Cypher

Software Engineering: - Project architecture - System design - Clean
code - Git workflow

------------------------------------------------------------------------

# Current Status

Milestone 0 is complete.

Immediate next objective: Build the ZIP upload pipeline and return a
parsed project tree before implementing AST parsing.
