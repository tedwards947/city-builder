# City Builder

A deep, browser-based 2D top-down city simulation inspired by classic city builders like SimCity. Built with TypeScript and rendered via a high-performance custom Canvas 2D engine.

## 🏗️ Core Features

### Deep Simulation Systems
- **Zoning & Growth**: Paint Residential, Commercial, and Industrial zones. Growth is governed by demand curves, land value, and resource availability.
- **Resource Grids**: Full simulation of Power, Water, and Sewage networks. Buildings require connectivity to function and reach higher density levels.
- **Pollution & Environment**: Real-time pollution diffusion and decay. Vegetation (Oak, Pine, Birch, etc.) naturally filters air quality and improves local desirability.
- **Transit & Traffic**: Flow-based traffic simulation on an autotiling road network (Streets, Avenues, Highways) with congestion affecting zone growth.
- **Political Capital**: Manage citizen satisfaction to earn the right to perform disruptive actions like mass demolition.
- **City Character**: Ambient systems shift the city's "vibe" (Egalitarian ↔ Laissez-faire, Green ↔ Industrial) based on your planning decisions.

### Visuals & UX
- **Custom Render Engine**: Viewport culling, pan/zoom support, and an isometric-ready projection layer.
- **Autotiling Roads**: Seamless road connectivity with context-aware turns, intersections, and markings.
- **Rich Vegetation**: Procedural forests with shoreline avoidance and species variety.
- **Live Tooltips**: Deep inspection tool for every tile, providing insight into growth requirements and distress states.
- **Persistence**: Save and load multiple cities directly in your browser using IndexedDB.

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or newer recommended)
- [npm](https://www.npmjs.com/)

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Development Server
Start the Vite development server:
```bash
npm run dev
```
The application will be available at `http://localhost:5173`.

### Building for Production
To create a production-ready build:
```bash
npm run build
```

### Running Tests
The project uses Vitest for rigorous system and command validation:
```bash
npm test          # Run all tests once
npm run test:watch # Run tests in watch mode
```

## 🛠️ Technical Architecture

- **Language**: TypeScript
- **Renderer**: Vanilla Canvas 2D (Optimized with chunked dirty tracking)
- **Data Model**: Typed-array tile layers (`Uint8Array`) for high-performance simulation and minimal memory overhead.
- **Pattern**: Command pattern for all mutations (supporting full Undo/Redo) and an ECS-inspired system architecture.
- **Tooling**: Vite for fast bundling and Vitest for testing.

## 📜 License
Internal/Private (See `CLAUDE.md` for project status and roadmap).
