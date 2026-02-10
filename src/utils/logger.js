// Simple logger utility with in-memory ring buffer for audit
const MAX_ENTRIES = 500;
const buffer = [];

function _push(level, msg, meta) {
  const entry = { time: Date.now(), level, message: typeof msg === 'string' ? msg : String(msg), meta: meta || null };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.shift();
  // Mirror to console for visibility
  try {
    if (level === 'error') console.error(entry.message, entry.meta);
    else if (level === 'warn') console.warn(entry.message, entry.meta);
    else console.log(entry.message, entry.meta);
  } catch (e) {}
}

export default {
  info: (msg, meta) => _push('info', msg, meta),
  warn: (msg, meta) => _push('warn', msg, meta),
  error: (msg, meta) => _push('error', msg, meta),
  clear: () => { buffer.length = 0; },
  recent: (n = 100) => buffer.slice(-n),
};
