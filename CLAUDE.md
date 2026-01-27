# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Stupid Network Monitor is a macOS-only Electron application that displays real-time network activity in the menu bar. It visualizes upload/download speeds using D3-generated SVG charts rendered to PNG via resvg-js.

## Commands

- `pnpm dev` - Start development (electron-forge start)
- `pnpm typecheck` - Type check with TypeScript
- `pnpm make` - Build distributables
- `pnpm package` - Package app for macOS

## Architecture

**Main Process (`src/main.mjs`):**
- Spawns `netstat -I en0 -b -w 1` to collect network stats every second
- Maintains 5-minute rolling history (300 data points)
- Generates SVG charts with D3, renders to PNG via resvg-js
- Uses macOS template images for menu bar icon (auto-adapts to light/dark mode)
- Persists history to `history.json` in userData folder

**Speed Test (`src/speed-test.mjs`):**
- Background speed tests every 20 seconds
- Downloads/uploads test files via `https://paulmurray.lol/api/speedtest`

**Build Configuration (`forge.config.ts`):**
- Code signing with "Developer ID Application" certificate
- Pre-package hook: kills running instance, cleans build, generates icons
- Post-package hook: copies to /Applications and opens

## Code Style

- ESM modules only (`.mjs` files, `import` statements)
- Biome for linting/formatting: tabs, double quotes, semicolons, 100-char line width
- TypeScript for type checking (not strict mode)

## Key Constraints

- macOS only - exits on non-darwin platforms
- Uses `pnpm` (not npm or yarn)
- Node.js 22.19.0 (from .node-version)
- Uses resvg-js (Rust-based) for SVG rendering, NOT Canvas
