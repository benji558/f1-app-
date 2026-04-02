const path = require('path');
const { spawn } = require('child_process');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const token = (process.env.GH_TOKEN || '').trim();
if (!token) {
  let repoHint = 'your repo (see package.json → build.publish)';
  try {
    const pub = require('../package.json').build?.publish;
    const p = Array.isArray(pub) ? pub[0] : pub;
    if (p?.provider === 'github' && p.owner && p.repo) {
      repoHint = `https://github.com/${p.owner}/${p.repo}`;
    }
  } catch (_) {
    /* ignore */
  }
  console.error(`
GH_TOKEN is not set. electron-builder needs it to upload to GitHub Releases.

1) GitHub → Settings → Developer settings → Personal access tokens
   (classic PAT with "repo", or fine-grained with Contents + Metadata read/write on ${repoHint})

2) Then either:
   cmd:         set GH_TOKEN=ghp_...
   PowerShell:  $env:GH_TOKEN="ghp_..."

   Or add a line to your local .env (gitignored):
   GH_TOKEN=ghp_...

3) Run: npm run dist:publish
`);
  process.exit(1);
}

const cli = path.join(__dirname, '..', 'node_modules', 'electron-builder', 'cli.js');
const child = spawn(process.execPath, [cli, '--win', '--x64', '--publish', 'always'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  env: { ...process.env, GH_TOKEN: token },
});

child.on('exit', (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code == null ? 1 : code);
});
