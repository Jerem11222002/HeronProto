const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '..'); // points to the backend folder

function walk(dir = baseDir, filelist = []) {
  if (!fs.existsSync(dir)) {
    return filelist; // avoid throwing if directory is missing
  }
  const entries = fs.readdirSync(dir);
  entries.forEach((entry) => {
    const fullPath = path.join(dir, entry);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath, filelist);
    } else {
      filelist.push(fullPath);
    }
  });
  return filelist;
}

function _formatMeta(meta) {
  if (!meta) return '';
  try { return typeof meta === 'string' ? meta : JSON.stringify(meta); } catch { return String(meta); }
}

const logger = {
  info: (msg, meta) => console.info('INFO', msg, _formatMeta(meta)),
  debug: (msg, meta) => {
    if (process.env.NODE_ENV === 'development') console.debug('DEBUG', msg, _formatMeta(meta));
  },
  warn: (msg, meta) => console.warn('WARN', msg, _formatMeta(meta)),
  error: (msg, meta) => console.error('ERROR', msg, _formatMeta(meta)),
};

// export logger methods and walk utility
module.exports = { ...logger, walk };