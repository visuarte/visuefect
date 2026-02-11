#!/usr/bin/env node
// Visuefect mux server (lightweight) — handles chunks/frames and uses ffmpeg to mux frames into WebM
// Features added: detailed logging, automatic cleanup of temp dirs (>24h), /status, /uploads listing and download

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, spawnSync } from 'child_process';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const TMP_PREFIX = 'visuefect-';
const CLEANUP_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // hourly

function log(...args) { console.log(`[${new Date().toISOString()}]`, ...args); }
function jsonResponse(res, obj, status = 200) {
  const s = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(s) });
  res.end(s);
}

function collectRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (b) => chunks.push(b));
    req.on('end', () => { const buf = Buffer.concat(chunks); try { const s = buf.toString('utf8'); const j = JSON.parse(s || '{}'); resolve(j); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function ensureUploads() { if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR); }

function cleanupOldTempDirs(maxAgeMs = CLEANUP_AGE_MS) {
  const tmp = os.tmpdir();
  try {
    const entries = fs.readdirSync(tmp, { withFileTypes: true });
    const now = Date.now();
    let removed = 0;
    entries.forEach(ent => {
      try {
        if (!ent.isDirectory()) return;
        if (!ent.name.startsWith(TMP_PREFIX)) return;
        const p = path.join(tmp, ent.name);
        const stat = fs.statSync(p);
        const age = now - stat.mtimeMs;
        if (age > maxAgeMs) { fs.rmSync(p, { recursive: true, force: true }); removed++; log('Removed temp dir', p); }
      } catch (e) { log('cleanup entry failed', ent.name, e.message); }
    });
    log(`Cleanup complete. Removed ${removed} temp dirs older than ${maxAgeMs}ms`);
    // also cleanup uploads older than maxAgeMs
    ensureUploads();
    const ups = fs.readdirSync(UPLOADS_DIR, { withFileTypes: true });
    let removedUploads = 0;
    ups.forEach(f => {
      try {
        const p = path.join(UPLOADS_DIR, f.name);
        const stat = fs.statSync(p);
        if ((Date.now() - stat.mtimeMs) > maxAgeMs) { fs.rmSync(p, { force: true }); removedUploads++; log('Removed upload', p); }
      } catch (e) { log('cleanup upload failed', f.name, e.message); }
    });
    log(`Removed ${removedUploads} uploads older than threshold`);
  } catch (e) { log('cleanupOldTempDirs failed', e.message); }
}

function checkFfmpegAvailable() {
  try {
    const res = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return res.status === 0;
  } catch (e) { return false; }
}

// API Handlers
const server = (req, res) => {
  // status endpoint
  if (req.method === 'GET' && req.url === '/status') {
    try {
      ensureUploads();
      const uploads = fs.readdirSync(UPLOADS_DIR);
      const tmpEntries = fs.readdirSync(os.tmpdir()).filter(n => n.startsWith(TMP_PREFIX));
      jsonResponse(res, { uptime: process.uptime(), ffmpeg: checkFfmpegAvailable(), uploadsCount: uploads.length, tmpDirs: tmpEntries.length });
    } catch (e) { jsonResponse(res, { error: String(e) }, 500); }
    return;
  }

  // list uploads
  if (req.method === 'GET' && req.url === '/uploads') {
    try {
      ensureUploads();
      const list = fs.readdirSync(UPLOADS_DIR).map(name => {
        const p = path.join(UPLOADS_DIR, name); const s = fs.statSync(p);
        return { name, size: s.size, mtime: s.mtime.toISOString(), path: `/uploads/${encodeURIComponent(name)}` };
      });
      jsonResponse(res, { files: list });
    } catch (e) { jsonResponse(res, { error: String(e) }, 500); }
    return;
  }

  // download uploaded file
  if (req.method === 'GET' && req.url && req.url.startsWith('/uploads/')) {
    try {
      const name = decodeURIComponent(req.url.replace('/uploads/', ''));
      const p = path.join(UPLOADS_DIR, name);
      if (!fs.existsSync(p)) return res.writeHead(404).end('Not found');
      const s = fs.statSync(p);
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': s.size, 'Content-Disposition': `attachment; filename="${name}"` });
      fs.createReadStream(p).pipe(res);
    } catch (e) { jsonResponse(res, { error: String(e) }, 500); }
    return;
  }

  // upload chunks
  if (req.method === 'POST' && req.url === '/api/mux/upload-chunks') {
    collectRequestBody(req).then((payload) => {
      try {
        ensureUploads();
        const name = `chunks_${Date.now()}.json`;
        const outPath = path.join(UPLOADS_DIR, name);
        fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
        log('Received chunks saved to', outPath);
        jsonResponse(res, { saved: true, path: outPath });
      } catch (e) { log('upload-chunks failed', e.message); jsonResponse(res, { error: String(e) }, 500); }
    }).catch((err) => { log('parse body failed', err.message); jsonResponse(res, { error: 'invalid json' }, 400); });
    return;
  }

  // upload frames and run ffmpeg
  if (req.method === 'POST' && req.url === '/api/mux/upload-frames') {
    collectRequestBody(req).then(async (payload) => {
      try {
        const frames = payload.frames || [];
        const fps = payload.fps || 30;
        if (!frames.length) return jsonResponse(res, { error: 'No frames' }, 400);
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), TMP_PREFIX));
        log('Writing frames to', tmpDir, 'count', frames.length);
        for (let i = 0; i < frames.length; i++) {
          const b64 = frames[i].replace(/^data:image\/(png|jpeg);base64,/, '');
          const buf = Buffer.from(b64, 'base64');
          const fname = path.join(tmpDir, `frame_${String(i).padStart(6,'0')}.png`);
          fs.writeFileSync(fname, buf);
        }
        const outFile = path.join(tmpDir, `out_${Date.now()}.webm`);
        const args = ['-y', '-framerate', String(fps), '-i', path.join(tmpDir, 'frame_%06d.png'), '-c:v', 'libvpx', '-crf', '10', '-b:v', '1M', outFile];
        log('Spawning ffmpeg with', args.join(' '));
        const ff = spawn('ffmpeg', args, { stdio: 'inherit' });
        ff.on('close', (code) => {
          if (code !== 0) { log('ffmpeg failed with', code); return jsonResponse(res, { error: 'ffmpeg failed', code }, 500); }
          try {
            const stat = fs.statSync(outFile);
            res.writeHead(200, { 'Content-Type': 'video/webm', 'Content-Length': stat.size, 'Content-Disposition': 'attachment; filename="visuefect_export.webm"' });
            fs.createReadStream(outFile).pipe(res);
          } catch (e) { log('stream failed', e.message); jsonResponse(res, { error: String(e) }, 500); }
        });
      } catch (e) { log('upload-frames failed', e.message); jsonResponse(res, { error: String(e) }, 500); }
    }).catch((err) => { log('parse body failed', err.message); jsonResponse(res, { error: 'invalid json' }, 400); });
    return;
  }

  // default
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
};

const port = process.env.PORT || 3001;
const s = http.createServer(server);

// startup tasks
ensureUploads();
cleanupOldTempDirs();
setInterval(() => cleanupOldTempDirs(), CLEANUP_INTERVAL_MS);

s.listen(port, () => log(`Visuefect mux server listening on ${port}`));

// graceful shutdown
process.on('SIGINT', () => { log('SIGINT received - cleaning up and exiting'); cleanupOldTempDirs(); process.exit(0); });
process.on('exit', () => { log('Process exit - running cleanup'); cleanupOldTempDirs(); });
