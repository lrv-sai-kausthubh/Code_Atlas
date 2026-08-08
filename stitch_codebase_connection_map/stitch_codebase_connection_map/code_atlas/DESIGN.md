---
name: Code Atlas
colors:
  surface: '#10141a'
  surface-dim: '#10141a'
  surface-bright: '#353940'
  surface-container-lowest: '#0a0e14'
  surface-container-low: '#181c22'
  surface-container: '#1c2026'
  surface-container-high: '#262a31'
  surface-container-highest: '#31353c'
  on-surface: '#dfe2eb'
  on-surface-variant: '#c1c6d7'
  inverse-surface: '#dfe2eb'
  inverse-on-surface: '#2d3137'
  outline: '#8b90a0'
  outline-variant: '#414755'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e69'
  primary-container: '#4b8eff'
  on-primary-container: '#00285c'
  inverse-primary: '#005bc1'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffb595'
  on-tertiary: '#571e00'
  tertiary-container: '#ef6719'
  on-tertiary-container: '#4c1a00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a41'
  on-primary-fixed-variant: '#004493'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdbcc'
  tertiary-fixed-dim: '#ffb595'
  on-tertiary-fixed: '#351000'
  on-tertiary-fixed-variant: '#7c2e00'
  background: '#10141a'
  on-background: '#dfe2eb'
  surface-variant: '#31353c'
  canvas-bg: '#080A0D'
  surface-stroke: '#30363D'
  electric-blue: '#007AFF'
  emerald-green: '#10B981'
  royal-purple: '#8B5CF6'
  vibrant-orange: '#F97316'
  crimson-error: '#EF4444'
  utility-yellow: '#FACC15'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.2'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.6'
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.05em
spacing:
  unit: 4px
  gutter: 16px
  sidebar-width: 280px
  drawer-width: 360px
  edge-thickness: 1.5px
---

## Brand & Style

The design system embodies "Neo-Brutalist Bauhaus"—a philosophy where form strictly follows function, but with a sharp, digital-first edge. It is built for developers who navigate high-density information environments. The personality is hyper-logical, technical, and authoritative, yet avoids the clutter of legacy IDEs.

The aesthetic utilizes a high-contrast dark mode to reduce eye strain during long "deep dive" sessions. It combines the raw structural integrity of Brutalism (sharp corners, defined borders, and visible grids) with the geometric clarity of Bauhaus. Visual interest is generated through kinetic data flow animations and glassmorphic overlays that provide depth without breaking the rigid architectural grid.

## Colors

The palette is anchored in a "Deep Space" charcoal (`#0D1117`) for sidebars and a near-black (`#080A0D`) for the primary graph canvas to maximize the "pop" of data nodes. 

Functional color coding is the primary driver of the interface:
- **Electric Blue**: Frontend logic and UI components.
- **Emerald Green**: Backend services and server-side logic.
- **Royal Purple**: Databases and persistent storage layers.
- **Vibrant Orange**: API endpoints and external integrations.
- **Crimson Error**: Critical issues, circular dependencies, or dead code.
- **Utility Yellow**: Configuration files and helper functions.

The contrast ratio is strictly maintained to ensure that even thin "edge" lines in the graph remain legible against the dark background.

## Typography

The system uses a tri-font approach to categorize information levels:
1. **Space Grotesk (Headlines)**: Used for tool titles, modal headers, and major section labeling. Its geometric quirks reinforce the "Bauhaus" aesthetic.
2. **Inter (UI/Body)**: The workhorse for the sidebar, property panels, and descriptions. Chosen for its exceptional legibility at small sizes.
3. **JetBrains Mono (Data/Labels)**: Used for node labels, code snippets, and metadata. This font signals "technical data" to the user immediately.

All typography follows a strict vertical rhythm. Large display sizes are reserved for empty states and onboarding; the active dashboard favors density and uses `body-sm` and `code-md` for the majority of the information architecture.

## Layout & Spacing

The layout utilizes a "Fixed-Fluid-Fixed" model:
- **Left Sidebar**: 280px fixed width for navigation and project tree.
- **Center Canvas**: Fluid area with a 24px dot-grid background for the interactive graph.
- **Right Drawer**: 360px fixed width for deep-dive node metadata and AI insights.

Spacing follows a 4px base unit. Internal padding for code-rich areas should be tight (`8px` to `12px`) to maximize data density, while the main canvas allows for expansive whitespace. All panels are separated by 1px "Surface Stroke" borders (`#30363D`) rather than shadows to maintain the Neo-Brutalist structure.

## Elevation & Depth

This system rejects traditional soft shadows in favor of **Tonal Layering** and **Glassmorphism**:

- **Level 0 (Canvas)**: The deepest layer. A pure black or near-black background with a subtle CSS grid.
- **Level 1 (Sidebars)**: Solid, high-opacity charcoal. No transparency. These feel like "grounded" structural pillars.
- **Level 2 (Overlays/Modals)**: Translucent glassmorphism. Use a `backdrop-filter: blur(12px)` and a slight white tint at 5% opacity. This allows the graph to be partially visible behind floating controls.
- **Active State**: Instead of elevation, active elements are indicated by "Glow" effects—a 2px outer stroke in the functional brand color (e.g., Electric Blue) with a soft 8px bloom.

## Shapes

The shape language is strictly geometric and serves as a semantic classification system:
- **Rectangles (90° Corners)**: Represent Files. They are the "containers" of the system.
- **Circles**: Represent Functions. They symbolize the "movement" and "logic" nodes.
- **Hexagons**: Represent Databases. The geometric complexity implies structured storage.
- **Diamonds**: Represent APIs. These serve as the junction points for external data.
- **Triangles**: Represent External Libraries or Dependencies.

**Roundedness is set to 0.** Sharp corners are non-negotiable for the Neo-Brutalist aesthetic, providing a precision-engineered look.

## Components

### Nodes & Edges
- **Nodes**: Must include a 1px border. The border color should be a 20% lighter shade of the node's functional color. Labels are placed inside the shape if large enough, or immediately below in `label-caps` JetBrains Mono.
- **Edges**: Use directional arrows. "Data Flow" edges should be animated with a "marching ants" stroke effect to show the direction of traffic.

### Sidebars & Lists
- **Dense List Items**: 32px height. Hover states should use a subtle `#ffffff10` background tint. No rounded corners.
- **Input Fields**: Sharp corners, 1px border. Focus state changes border color to `Electric Blue` with no "glow" unless it's a critical action.

### Buttons
- **Primary**: Solid background (Electric Blue), black text, sharp corners.
- **Ghost**: No background, 1px white or grey border. On hover, invert the colors.

### The "Minimap"
A floating glassmorphic square in the bottom-right corner of the canvas. It provides a macro-view of the entire project structure, using the same functional color coding at a pixel scale.

### AI Assistant Chat
A vertical slide-out component from the bottom-right. It uses a different background tint (`#161B22`) to distinguish human-generated data from machine-generated explanations.