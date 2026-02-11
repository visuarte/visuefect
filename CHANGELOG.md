# Changelog

## Unreleased

- test: add local canvas shim to stabilize jsdom tests and prevent exportVideo from throwing in headless environments. (test/engine.export.test.js, test/jest-canvas-shim.js)
- fix: make Pixi/Three initialization and raycasting defensive in headless environments to avoid crashes in CI and tests. (src/core/Engine.js, src/core/PointerCoordinator.js)
- test: add unit test for VisualEngine.exportVideo to ensure deterministic behavior when 2D contexts are unavailable.
- note: attempted to install `jest-canvas-mock` but failed due to a registry/dependency error; a small local `test/jest-canvas-shim.js` is used as a stable fallback for CI.

