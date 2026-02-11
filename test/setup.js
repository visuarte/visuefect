// Test setup: global shims for tests
// Provide a better canvas mock to silence minimal shims and ensure toDataURL etc.
import 'jest-canvas-mock';
// Prefer a Node mock for mojs in test env to avoid UMD/browser runtime issues
process.env.MOJS_MOCK = '1';
import mojsMock from '../src/mocks/mojs-node-mock.js';
// expose mock on window/globalThis so modules that expect window.mojs find it
if (typeof globalThis !== 'undefined') globalThis.mojs = mojsMock.default || mojsMock;
