/*
 * WebM muxer skeleton for deterministic exports.
 *
 * Goals:
 * - Provide a minimal API for adding frames and finalizing an output Blob
 * - Make it easy to replace the implementation with a WebCodecs+WebM muxer
 * - Include tests and docs to check integration points
 *
 * TODO:
 * - Implement actual muxing (WebCodecs or WebAssembly based muxer)
 * - Provide optional audio tracks and deterministic timestamping
 * - Streaming-friendly API for large exports
 */

export default class WebMMuxer {
  constructor({ width = 800, height = 600, fps = 30, mockOutput = false } = {}) {
    this.width = width;
    this.height = height;
    this.fps = fps;
    this._frames = [];
    this._closed = false;
    this.mockOutput = !!mockOutput;
  }

  // Add a frame. Accepts Canvas, ImageBitmap, ImageData, or Blob/Buffer
  addFrame(frame) {
    if (this._closed) throw new Error('Muxer already finalized');
    // At skeleton stage we simply record a placeholder record for tests
    this._frames.push({ time: Date.now(), frame });
    // Real implementations should validate format and convert to encoded video frames
  }

  // Finalize and return a Promise resolving to a Blob representing the WebM file
  async finalize() {
    if (this._closed) throw new Error('Muxer already finalized');
    this._closed = true;
    // If running in mock mode, return a small blob containing metadata for tests
    if (this.mockOutput) {
      const payload = JSON.stringify({ frames: this._frames.length, width: this.width, height: this.height, fps: this.fps });
      // In jsdom/Node tests, Blob is available via jsdom; fallback to simple object if not
      try {
        const b = new Blob([payload], { type: 'application/webm' });
        return Promise.resolve(b);
      } catch (e) {
        return Promise.resolve({ type: 'application/webm', size: payload.length, text: async () => payload });
      }
    }

    // Placeholder behavior: reject to indicate not implemented
    return Promise.reject(new Error('WebM muxer not implemented; this is a skeleton.'));
  }

  // Convenience for tests: return number of frames captured
  frameCount() { return this._frames.length; }
}
