Design a premium, modern developer-tool web application called "CodeAtlas".

CodeAtlas is an interactive software architecture visualization platform.

The product takes a software repository, analyzes its source code, discovers relationships between files, modules, functions, APIs, components and dependencies, and presents the resulting architecture as an interactive visual graph.

The core product philosophy is:

"Understand your codebase without reading every file."

The interface should feel like a combination of:

- VS Code
- Linear
- Obsidian
- Figma
- GitHub
- Neo4j Bloom
- modern AI developer tools

But DO NOT copy any of these products directly.

Create an original visual identity for CodeAtlas.

==================================================
1. OVERALL DESIGN DIRECTION
==================================================

Create a sophisticated, developer-first interface.

The design should feel:

- intelligent
- technical
- calm
- premium
- precise
- fast
- minimal
- futuristic
- trustworthy

Avoid:

- generic SaaS dashboards
- excessive glassmorphism
- excessive gradients
- giant rounded cards
- excessive shadows
- colorful AI gimmicks
- unnecessary illustrations
- stock imagery
- excessive whitespace
- oversized hero sections
- "AI startup template" aesthetics

CodeAtlas should look like a serious professional developer tool that engineers could use for several hours every day.

The interface should prioritize information density without becoming visually overwhelming.

Use progressive disclosure:
show the important information first and reveal deeper information when the user asks for it.

==================================================
2. VISUAL LANGUAGE
==================================================

Primary theme:

Dark mode.

Background:

Very dark blue-black / graphite rather than pure black.

Use subtle layers of dark surfaces to establish hierarchy.

Suggested palette:

Background:
#080B12

Primary surface:
#0D111A

Secondary surface:
#111722

Border:
#202938

Primary text:
#F4F7FB

Secondary text:
#8B95A7

Muted text:
#596477

Primary accent:
Cool electric blue

Secondary accent:
Cyan / blue-violet

Success:
Green

Warning:
Amber

Danger:
Red

Do not make the interface overwhelmingly blue.

Blue should identify important interactive elements, selected graph elements, active states and CodeAtlas branding.

==================================================
3. TYPOGRAPHY
==================================================

Use a modern developer-friendly sans-serif.

Suggested:

Inter

or

Geist

or another highly legible modern UI font.

Use a monospace font only where appropriate:

- file paths
- function names
- code
- API routes
- technical metadata
- graph node identifiers

Typography hierarchy should be strong but restrained.

Avoid huge marketing-style typography inside the actual application.

==================================================
4. BRAND
==================================================

Create a small, refined CodeAtlas logo.

The logo should communicate:

- code
- relationships
- mapping
- architecture
- connected systems

Use a minimalist geometric mark inspired by connected nodes / a technical map / an abstract atlas.

The logo should work as:

- desktop application icon
- browser favicon
- sidebar logo
- GitHub README logo
- loading animation

Wordmark:

CodeAtlas

Keep the branding subtle and professional.

==================================================
5. PRODUCT STRUCTURE
==================================================

The application should have these major areas:

1. Project Home
2. Repository Upload
3. Project Analysis
4. Architecture Workspace
5. Graph Explorer
6. File Explorer
7. Search
8. AI Architect
9. Architecture Insights
10. Git History
11. Settings

For the first version, prioritize:

Project Home
Upload
Analysis
Graph Workspace

Do not clutter the initial MVP with enterprise features.

==================================================
6. LANDING / EMPTY PROJECT SCREEN
==================================================

Create an extremely clean initial screen.

Center the experience around one action:

"Understand your codebase."

Headline:

"See how your code actually works."

Supporting text:

"Upload a repository and CodeAtlas will map its files, dependencies and architecture into an interactive visual graph."

Primary CTA:

"Upload ZIP"

Secondary CTA:

"Connect GitHub"

For the current MVP, ZIP upload should be visually dominant.

Add a subtle drag-and-drop area.

Example:

--------------------------------------------

            CodeAtlas

       See how your code works.

 Upload a repository and explore its
 architecture as an interactive graph.

        [ Upload ZIP ]

        or drop a .zip file here

--------------------------------------------

Below this, show a very small "How it works":

Upload
→
Analyze
→
Explore

Do not create a huge marketing landing page.

The user should reach the product quickly.

==================================================
7. UPLOAD EXPERIENCE
==================================================

Create a beautiful drag-and-drop upload component.

States:

Empty

Hover

Dragging

Uploading

Processing

Success

Error

The upload component should communicate accepted formats:

ZIP

Maximum file size should be displayed dynamically if configured.

After upload:

show filename

file size

upload progress

analysis progress

estimated status

==================================================
8. ANALYSIS / PROCESSING SCREEN
==================================================

Do NOT simply show a generic spinner.

Show an animated analysis pipeline.

Example:

Repository
   ↓
Scanning files
   ↓
Detecting languages
   ↓
Parsing source code
   ↓
Resolving dependencies
   ↓
Building architecture graph
   ↓
Preparing visualization

Show progress for each stage.

Example:

✓ Repository uploaded
✓ 382 files discovered
✓ JavaScript / TypeScript detected
● Building dependency graph
○ Generating visualization

The graph should subtly begin appearing in the background as analysis progresses.

This creates the feeling that CodeAtlas is actually "understanding" the repository.

==================================================
9. MAIN APPLICATION WORKSPACE
==================================================

This is the most important screen.

Design it as a professional desktop-class workspace.

Use a three-panel layout.

LEFT:

Project Explorer

CENTER:

Graph Canvas

RIGHT:

Inspector

BOTTOM:

Optional collapsible activity / AI / logs panel

Overall layout:

┌───────────────────────────────────────────────────────────┐
│ CodeAtlas     Project     Search     View     AI     ...  │
├──────────────┬───────────────────────────────┬────────────┤
│              │                               │            │
│ PROJECT      │                               │ INSPECTOR  │
│ EXPLORER     │       GRAPH CANVAS            │            │
│              │                               │            │
│ files        │                               │ node info  │
│ folders      │                               │ metrics    │
│ search       │                               │ relations  │
│ filters      │                               │            │
│              │                               │            │
├──────────────┴───────────────────────────────┴────────────┤
│ Status / AI / Logs / Timeline                             │
└───────────────────────────────────────────────────────────┘

The canvas must dominate the screen.

==================================================
10. TOP BAR
==================================================

Top navigation should be compact.

Left:

CodeAtlas logo

Project name

Example:

CodeAtlas / ecommerce-api

Center:

Global search field

Placeholder:

"Search files, functions, APIs..."

Right:

View selector

AI button

Settings

User/profile

Avoid excessive navigation items.

==================================================
11. LEFT SIDEBAR
==================================================

Sections:

PROJECT

Files
Folders
Components
APIs
Database

VIEWS

Architecture
Dependencies
Call Graph
API Flow
Components
Database

ANALYSIS

Issues
Circular Dependencies
Dead Code
Hotspots

The sidebar should be collapsible.

When collapsed, show icons with tooltips.

==================================================
12. FILE EXPLORER
==================================================

Build a VS Code-inspired but original file explorer.

Example:

PROJECT

src
  components
    Header.tsx
    Navbar.tsx
  pages
    Home.tsx
    Dashboard.tsx
  services
    api.ts
    auth.ts
  utils
    format.ts

backend
  api
  services
  models

Use small language/file icons.

Do not visually overload the explorer.

Clicking a file should:

- select it in the tree
- highlight it in the graph
- open its information in the inspector

==================================================
13. GRAPH CANVAS
==================================================

The graph is the primary product experience.

It should feel like:

Obsidian graph + Figma canvas + professional architecture diagram.

Canvas features:

- pan
- zoom
- fit-to-screen
- minimap
- grid
- node selection
- multi-selection
- drag nodes
- animated relationships
- graph layouts
- clustering
- collapse/expand
- focus mode

Use subtle graph animations.

Avoid excessive physics movement.

The graph should feel stable and predictable.

==================================================
14. GRAPH NODES
==================================================

Different node types must be visually distinguishable.

FILE:

rounded rectangle

FOLDER:

folder-like shape

FUNCTION:

small circular node

CLASS:

rounded rectangle with class icon

API:

diamond

DATABASE:

database cylinder

EXTERNAL PACKAGE:

hexagonal / package icon

COMPONENT:

component-style rectangle

EVENT:

small event node

Use color carefully.

Suggested:

Files → blue

Folders → neutral

Functions → cyan

APIs → orange

Database → purple

External packages → amber

Errors/issues → red

Do not rely on color alone.

Use icons and shapes as well.

==================================================
15. GRAPH EDGES
==================================================

Relationships must have directional meaning.

Examples:

IMPORTS
CALLS
USES
DEPENDS_ON
READS
WRITES
RENDERS
FETCHES
CONTAINS

Edges should have subtle arrows.

When a node is selected:

- highlight outgoing relationships
- highlight incoming relationships
- dim unrelated nodes
- animate the active path subtly

This is one of the most important interactions in the application.

==================================================
16. GRAPH MODES
==================================================

Create a compact "View" selector.

Modes:

Architecture

Imports

Call Graph

Data Flow

API Flow

Components

Database

Git

Do not display all modes simultaneously.

When a mode changes, smoothly transition the visualization.

==================================================
17. NODE INSPECTOR
==================================================

When the user clicks a node, open the right inspector.

Example:

FILE

src/services/auth.ts

--------------------------------

Authentication service

Language
TypeScript

Lines
284

Complexity
Medium

--------------------------------

IMPORTS

12

IMPORTED BY

31

FUNCTIONS

8

--------------------------------

DEPENDENCIES

api.ts
jwt.ts
database.ts

--------------------------------

AI SUMMARY

"Handles authentication,
token validation and user
session management."

--------------------------------

Actions

[ Open Code ]

[ Trace Flow ]

[ Ask AI ]

[ Show Dependents ]

The inspector should feel like a professional developer tool, not a generic card.

==================================================
18. CODE PREVIEW
==================================================

When "Open Code" is selected, show a code viewer.

Use:

- syntax highlighting
- line numbers
- minimap
- search
- highlighted relevant lines

Clicking a relationship should jump to the relevant source line.

Example:

IMPORTS
line 14

CALLS
line 87

This is critical for making the visualization useful rather than decorative.

==================================================
19. SEARCH
==================================================

Search should be extremely powerful.

Global search should support:

Files
Functions
Classes
Components
APIs
Variables
Database tables

Example:

Search:

authentication

Results:

auth.ts
AuthService
authenticateUser()
/api/auth/login
UserRepository

Selecting a result should immediately focus the graph on the relevant nodes.

==================================================
20. AI ARCHITECT
==================================================

Do NOT make AI a generic chatbot floating on the screen.

Create an "AI Architect" integrated directly into the code graph.

The AI understands:

- repository structure
- files
- symbols
- dependencies
- graph relationships
- architecture
- Git history

Example questions:

"How does authentication work?"

"What happens when a user logs in?"

"Where is payment processing implemented?"

"What depends on this file?"

"What would break if I delete this module?"

"Why is this module highly coupled?"

"Explain this repository to me."

"Find architectural problems."

"Suggest a better architecture."

When the AI answers:

it should also visually highlight the relevant graph path.

Example:

User asks:

"How does login work?"

The graph highlights:

Login.tsx
↓
loginUser()
↓
/api/login
↓
AuthController
↓
AuthService
↓
UserRepository
↓
Database

The answer should be connected to the visualization.

This is a defining CodeAtlas interaction.

==================================================
21. AI AGENT UI
==================================================

Later versions will allow the AI agent to modify code.

Design the interface now so it can support this later.

Agent actions:

Analyze
Explain
Suggest
Refactor
Generate tests
Modify code

When the agent proposes changes, DO NOT immediately modify files.

Use a review workflow:

AI proposal

↓

Changed files

↓

Diff preview

↓

Impact analysis

↓

User approval

↓

Apply changes

The UI should feel like a safe engineering workflow.

==================================================
22. ARCHITECTURE INSIGHTS
==================================================

Create an "Insights" view.

Show issues such as:

Circular dependency

High coupling

Dead code

Large module

Complex function

Duplicate logic

Unused dependency

Architecture violation

Display severity:

Critical
High
Medium
Low

Each issue should be actionable.

Example:

HIGH

auth.ts has unusually high coupling.

Connected modules:
31

[View on Graph]

[Ask AI]

[Show Dependents]

==================================================
23. IMPACT ANALYSIS
==================================================

This should become a signature feature.

User selects:

AuthService

Then chooses:

"Analyze Impact"

CodeAtlas visually shows:

Direct dependencies

Indirect dependencies

Potentially affected APIs

Potentially affected components

Tests

Database interactions

Use different visual emphasis levels.

Example:

Direct:
strong highlight

Indirect:
soft highlight

Unrelated:
dimmed

Display:

"Potential impact: 17 files"

==================================================
24. DEBUGGING MODE
==================================================

Create a "Trace Flow" interaction.

User selects:

API endpoint

Example:

POST /api/login

Then CodeAtlas displays:

Frontend
↓
API Request
↓
Controller
↓
Service
↓
Repository
↓
Database

The path should animate.

Each step can be clicked.

This should feel like debugging with a visual execution map.

==================================================
25. GIT INTEGRATION — PREPARE THE UI
==================================================

GitHub is V2, but design the UI so it can support it.

Future actions:

Connect GitHub

Repository

Branch

Commit

Pull Request

Author

Last changed

Use Git information to visualize:

hot files

frequently changing modules

ownership

architectural evolution

Do not make Git features prominent in V1.

==================================================
26. EMPTY STATES
==================================================

Every empty state should explain what the user can do.

Example:

No project loaded

"Upload a repository to build your first architecture map."

[ Upload ZIP ]

No node selected

"Select a node to inspect its relationships."

No search results

"No matching symbols found."

Do not use generic empty-state illustrations.

==================================================
27. LOADING STATES
==================================================

Use skeletons and functional motion.

Avoid generic spinning loaders whenever possible.

For graph loading:

show progressively appearing nodes.

For analysis:

show pipeline progress.

For AI:

show contextual status:

"Tracing authentication flow..."

"Analyzing 14 connected modules..."

"Generating explanation..."

Motion should communicate state, not decoration.

==================================================
28. MICRO-INTERACTIONS
==================================================

Use subtle functional motion.

Examples:

Node hover:
small elevation / glow

Node selection:
smooth outline

Edge activation:
animated flow

Sidebar:
smooth collapse

Inspector:
slide/fade

Search:
instant highlighting

View change:
smooth graph transition

Upload:
progressive feedback

Avoid excessive animation.

The application should feel fast.

==================================================
29. RESPONSIVE BEHAVIOR
==================================================

This is a desktop-class application.

Prioritize:

1440px
1280px
1024px

For smaller screens:

collapse the left sidebar

collapse inspector

allow graph canvas to dominate

Use a bottom-sheet inspector on mobile.

The graph must remain usable.

==================================================
30. ACCESSIBILITY
==================================================

Use:

keyboard navigation

visible focus states

high contrast

ARIA labels

tooltips

non-color indicators

reduced-motion support

Keyboard shortcuts:

/

Search

F

Fit graph

Esc

Close inspector

A

Open AI Architect

G

Focus graph

==================================================
31. KEYBOARD-FIRST UX
==================================================

Developers should be able to navigate the product quickly.

Add a command palette:

Ctrl/Cmd + K

Example commands:

Open file
Search symbol
Change graph view
Fit graph
Focus node
Open AI Architect
Analyze impact
Trace flow
Toggle sidebar

The command palette should feel like a modern developer tool.

==================================================
32. DASHBOARD / PROJECT OVERVIEW
==================================================

After a repository is analyzed, show a compact overview.

Example:

PROJECT

E-commerce Platform

--------------------------------

382 Files
46 Components
28 APIs
14 Database Tables
617 Dependencies

--------------------------------

ARCHITECTURE HEALTH

84 / 100

--------------------------------

Top Issues

3 Circular Dependencies
7 High Coupling Modules
12 Dead Files

--------------------------------

MOST CONNECTED

AuthService
APIClient
UserRepository

--------------------------------

[ Explore Architecture ]

The dashboard should immediately guide the user into the graph.

==================================================
33. VISUAL HIERARCHY
==================================================

The graph is the primary visual element.

Do not allow sidebars and cards to visually compete with it.

Hierarchy:

1. Graph
2. Selected node
3. Navigation
4. Contextual information
5. Secondary metrics

The canvas should always feel like the center of gravity.

==================================================
34. DESIGN SYSTEM
==================================================

Create reusable design tokens.

Define:

colors

spacing

radius

typography

shadows

borders

motion

icons

buttons

inputs

panels

tooltips

badges

node styles

graph edge styles

Use a consistent 4px / 8px spacing system.

Avoid arbitrary values.

Components should be reusable and consistent.

==================================================
35. PRODUCT PERSONALITY
==================================================

CodeAtlas should communicate:

"Your codebase is complicated.
We make it understandable."

The product should feel:

calm rather than chaotic

precise rather than flashy

powerful rather than intimidating

intelligent rather than gimmicky

visual rather than text-heavy

developer-first rather than marketing-first

==================================================
36. IMPORTANT UX PRINCIPLE
==================================================

Do not design CodeAtlas as a normal SaaS dashboard.

It is fundamentally a spatial computing interface.

The user should feel like they are entering a map of their software.

The graph should behave like a navigable environment.

The sidebars and inspector provide context around the map.

The AI should act as a guide through the map.

==================================================
37. MVP PRIORITY
==================================================

For the current V1 proof of concept, implement only:

1. Landing screen
2. ZIP upload
3. Analysis progress
4. Project workspace
5. File explorer
6. Interactive dependency graph
7. Search
8. Node inspector

Do NOT visually implement all future features as if they already exist.

Future features may appear as disabled / "Coming soon" items:

GitHub
AI Architect
Impact Analysis
Git History
Call Graph
Data Flow
Architecture Insights

The MVP must feel complete even with these features absent.

==================================================
38. FINAL VISUAL RESULT
==================================================

The final design should look like a serious product that could eventually be used by engineering teams at large technology companies.

It should be visually impressive when first opened, but the visual sophistication must come from:

- excellent information hierarchy
- interactive graph visualization
- typography
- spacing
- subtle motion
- intelligent interaction
- clean developer tooling patterns

NOT from excessive decoration.

Generate the complete UI system and all key screens required to demonstrate this product.