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
// Safe to run any time: it only rewrites a page when a hash actually changed.
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const check = process.argv.includes('--check');
const REF = /((?:src|href)=")(shared\/[^"?]+)(?:\?v=[0-9a-f]*)?(")/g;

let stale = 0;
for(const page of fs.readdirSync(ROOT).filter(f => f.endsWith('.html'))){
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
if(!stale) console.log('All shared file versions are up to date.');
else if(check) process.exitCode = 1;
