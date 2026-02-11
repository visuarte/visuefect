# WebM Muxer (Proposal)

This document outlines a proposed WebM muxer for deterministic exports.

Goals
- Deterministic per-frame export from the engine's composite canvas
- Support for optional audio tracks (aligned to SyncBridge timestamps)
- Streaming-friendly API for large outputs

API (Skeleton)
- new WebMMuxer({ width, height, fps })
- addFrame(canvas|ImageBitmap|ImageData|Blob)
- finalize() -> Promise<Blob> (resolves to a WebM blob)

Implementation notes / TODO
- Consider using WebCodecs + a WebM muxer in-browser (or a WASM muxer server-side)
- Provide deterministic timestamping using SyncBridge frame indices
- Provide tests that verify integration with `VisualEngine#exportVideo`

This PR adds a small skeleton and tests so we can iterate on the implementation.
