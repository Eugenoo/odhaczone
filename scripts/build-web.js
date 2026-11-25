// Exports the web build and injects the precache list + version into dist/sw.js.
const { execSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

execSync('npx expo export -p web', { stdio: 'inherit' });

const dist = path.join(__dirname, '..', 'dist');
const skip = new Set(['sw.js', 'metadata.json', '_redirects']);
const files = [];
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else {
      const rel = path.relative(dist, full).split(path.sep).join('/');
      if (!skip.has(rel)) files.push('/' + rel.split('/').map(encodeURIComponent).join('/'));
    }
  }
})(dist);

// Fingerprint names AND contents, so changing a file that keeps its name (an icon, say) still updates the cache.
const hasher = crypto.createHash('sha1');
for (const f of files) {
  hasher.update(f);
  hasher.update(fs.readFileSync(path.join(dist, ...decodeURIComponent(f).split('/'))));
}
const hash = hasher.digest('hex').slice(0, 10);
const swPath = path.join(dist, 'sw.js');
const before = fs.readFileSync(swPath, 'utf8');
const sw = before
  .replace(/^const CACHE = .*$/m, `const CACHE = 'todo-${hash}';`)
  .replace(/^const PRECACHE = .*$/m, `const PRECACHE = ['/'].concat(${JSON.stringify(files)});`);
if (sw === before) throw new Error('Could not inject the precache list into dist/sw.js');
fs.writeFileSync(swPath, sw);
console.log(`Precaching ${files.length} files (cache todo-${hash})`);
