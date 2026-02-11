// Test setup: global shims for tests
// Use upstream jest-canvas-mock to provide stable Canvas APIs in jsdom tests
import 'jest-canvas-mock';
// Prefer a Node mock for mojs in test env to avoid UMD/browser runtime issues
import mojsMock from '../src/mocks/mojs-node-mock.js';

process.env.MOJS_MOCK = '1';
// expose mock on window/globalThis so modules that expect window.mojs find it
if (typeof globalThis !== 'undefined') globalThis.mojs = mojsMock.default || mojsMock;
