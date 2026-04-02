const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'release', 'win-unpacked');
try {
  fs.rmSync(dir, { recursive: true, force: true });
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
