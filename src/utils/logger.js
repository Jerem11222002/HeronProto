const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const LOG_LEVEL = (process.env.REACT_APP_LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info')).toLowerCase();
const MIN_LEVEL = LEVELS[LOG_LEVEL] || LEVELS.info;

const recent = new Map();
const DUPLICATE_WINDOW_MS = parseInt(process.env.REACT_APP_LOG_DUPLICATE_WINDOW_MS || '1000', 10);

function shouldLog(key) {
  const now = Date.now();
  const last = recent.get(key);
  if (last && (now - last) < DUPLICATE_WINDOW_MS) return false;
  recent.set(key, now);
  if (recent.size > 1000) {
    for (const [k, v] of recent) {
      if ((now - v) > DUPLICATE_WINDOW_MS * 5) recent.delete(k);
    }
  }
  return true;
}

function safeFormat(arg) {
  try {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return arg.message;
    return JSON.stringify(arg, (k, v) => {
      if (v && typeof v === 'object' && (v.byteLength || v instanceof ArrayBuffer)) return '<Binary>';
      return v;
    }, 2);
  } catch {
    return String(arg);
  }
}

function wrapConsole(level, fn) {
  return (...args) => {
    if (MIN_LEVEL > LEVELS[level]) return;
    const key = args.map(a => (typeof a === 'string' ? a : safeFormat(a))).join(' ');
    if (!shouldLog(key)) return;
    // small log payloads only - avoid huge objects
    fn(`[${level.toUpperCase()}]`, ...args);
  };
}

const logger = {
  debug: wrapConsole('debug', console.debug.bind(console)),
  info: wrapConsole('info', console.info.bind(console)),
  warn: wrapConsole('warn', console.warn.bind(console)),
  error: wrapConsole('error', console.error.bind(console))
};

export default logger;