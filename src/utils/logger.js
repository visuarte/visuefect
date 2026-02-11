const MAX_LOGS = 1000;

class Logger {
  constructor() {
    this._logs = [];
  }

  _push(level, msg, meta) {
    const entry = {
      time: Date.now(), level, message: (msg && msg.message) ? msg.message : String(msg), meta,
    };
    this._logs.push(entry);
    if (this._logs.length > MAX_LOGS) this._logs.shift();
  }

  info(msg, meta) { this._push('info', msg, meta); }

  warn(msg, meta) { this._push('warn', msg, meta); }

  error(msg, meta) { this._push('error', msg, meta); }

  debug(msg, meta) { this._push('debug', msg, meta); }

  recent(n = 100) { return this._logs.slice(-n); }
}

const logger = new Logger();
export default logger;
