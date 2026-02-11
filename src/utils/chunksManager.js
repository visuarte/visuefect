// Utilities to download and upload serialized chunks (base64 payloads)
export function downloadChunksAsJson(chunks = [], name = 'visuefect_chunks') {
  try {
    const payload = JSON.stringify({ generatedAt: (new Date()).toISOString(), chunks });
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${name}.json`; a.click(); URL.revokeObjectURL(url);
    return true;
  } catch (e) { console.warn('downloadChunksAsJson failed', e); return false; }
}

export async function uploadChunks(url, chunks = [], opts = {}) {
  try {
    const body = JSON.stringify({ chunks, meta: { width: opts.width, height: opts.height, fps: opts.fps } });
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    if (!res.ok) throw new Error(`Upload failed ${res.status}`);
    return await res.json();
  } catch (e) { console.warn('uploadChunks failed', e); throw e; }
}

export async function uploadFramesAsZip(url, frames = [], fps = 60) {
  // Send as JSON array (server example will decode and write to files)
  try {
    const body = JSON.stringify({ frames, fps });
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    if (!res.ok) throw new Error(`Upload frames failed ${res.status}`);
    // expect server to return a downloadable file (Blob url or object)
    const blob = await res.blob();
    return blob;
  } catch (e) { console.warn('uploadFramesAsZip failed', e); throw e; }
}
