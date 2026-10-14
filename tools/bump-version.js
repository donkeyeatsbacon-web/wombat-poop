#!/usr/bin/env node
// Stamp every shared/ file reference in the root HTML pages with a hash of the
// file's contents, e.g. src="shared/physics.js?v=3fa9c2e1".
//
// GitHub Pages lets browsers cache files for about 10 minutes. Without this, a
// player who loads a freshly pushed page can still get yesterday's cached
// shared script, and the two halves of the game won't match. With it, any
// change to a shared file changes its URL, so the browser has to fetch it.
//
//   node tools/bump-version.js          # update the pages in place
//   node tools/bump-version.js --check  # exit 1 if any stamp is out of date
//
// It also refreshes sw.js (offline play): the list of files to keep, and the
// cache name, which changes whenever any of those files does.
//
// Safe to run any time: it only rewrites a file when something actually changed.
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const check = process.argv.includes('--check');
const REF = /((?:src|href)=")(shared\/[^"?]+)(?:\?v=[0-9a-f]*)?(")/g;

let stale = 0;
const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
for(const page of pages){
  const file = path.join(ROOT, page);
  const html = fs.readFileSync(file, 'utf8');
  const out = html.replace(REF, (m, pre, ref, post) => {
    const target = path.join(ROOT, ref);
    if(!fs.existsSync(target)){ console.error(`${page}: ${ref} does not exist`); process.exitCode = 1; return m; }
    const hash = crypto.createHash('sha1').update(fs.readFileSync(target)).digest('hex').slice(0, 8);
    return `${pre}${ref}?v=${hash}${post}`;
  });
  if(out === html) continue;
  stale++;
  if(check) console.log(`${page}: shared file versions are out of date`);
  else { fs.writeFileSync(file, out); console.log(`${page}: updated`); }
}
// ---------- sw.js: what to keep for offline play ----------
const swFile = path.join(ROOT, 'sw.js');
if(fs.existsSync(swFile)){
  const refs = new Set();
  for(const page of pages){
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    for(const m of html.matchAll(/(?:src|href)="(shared\/[^"]+)"/g)) refs.add(m[1]);
  }
  const listDir = d => fs.existsSync(path.join(ROOT, d)) ? fs.readdirSync(path.join(ROOT, d)).filter(f => !f.startsWith('.')).map(f => d + '/' + f) : [];
  const files = ['./', ...pages, 'manifest.webmanifest', ...[...refs].sort(), ...listDir('shared/fonts').filter(f => f.endsWith('.woff2')), ...listDir('icons').filter(f => !f.includes('og-image'))];   // the link preview is for chat apps, not players
  // the cache name hashes every listed file, so any change ships a fresh cache
  const h = crypto.createHash('sha1');
  for(const f of files){ const p = path.join(ROOT, f === './' ? 'index.html' : f.split('?')[0]); if(fs.existsSync(p)) h.update(f).update(fs.readFileSync(p)); }
  const sw = fs.readFileSync(swFile, 'utf8');
  const out = sw.replace(/const CACHE = '[^']*';/, `const CACHE = 'wombat-${h.digest('hex').slice(0, 8)}';`)
                .replace(/const PRECACHE = \[[\s\S]*?\];/, 'const PRECACHE = [\n' + files.map(f => `  '${f}',`).join('\n') + '\n];');
  if(out !== sw){
    stale++;
    if(check) console.log('sw.js: offline file list is out of date');
    else { fs.writeFileSync(swFile, out); console.log('sw.js: updated'); }
  }
}

if(!stale) console.log('All shared file versions are up to date.');
else if(check) process.exitCode = 1;
