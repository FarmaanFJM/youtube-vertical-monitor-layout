// Builds reproducible store/release archives into dist/:
//   youtube-vertical-monitor-layout-<version>-chromium.zip   (Chrome, Edge, other Chromium)
//   youtube-vertical-monitor-layout-<version>-firefox.zip    (adds browser_specific_settings)
// Requires the `zip` CLI. File order and timestamps are fixed so the same
// sources produce byte-identical archives.
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, readdirSync, statSync, utimesSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const FILES = ['manifest.json', 'src', 'icons', 'LICENSE', 'README.md'];
const EPOCH = new Date('2026-01-01T00:00:00Z');

function walk(dir) {
  return readdirSync(dir).sort().flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

rmSync('dist', { recursive: true, force: true });
for (const target of ['chromium', 'firefox']) {
  const stage = path.join('dist', `stage-${target}`);
  mkdirSync(stage, { recursive: true });
  for (const f of FILES) cpSync(f, path.join(stage, f), { recursive: true });
  if (target === 'firefox') {
    const m = JSON.parse(readFileSync(path.join(stage, 'manifest.json'), 'utf8'));
    m.browser_specific_settings = { gecko: { id: 'youtube-vertical-monitor-layout@farmaanfjm.github.io', strict_min_version: '121.0' } };
    writeFileSync(path.join(stage, 'manifest.json'), JSON.stringify(m, null, 2) + '\n');
  }
  const files = walk(stage).map((p) => path.relative(stage, p));
  for (const f of files) utimesSync(path.join(stage, f), EPOCH, EPOCH);
  const out = path.resolve('dist', `youtube-vertical-monitor-layout-${manifest.version}-${target}.zip`);
  execFileSync('zip', ['-X', '-q', out, ...files], { cwd: stage });
  rmSync(stage, { recursive: true, force: true });
  console.log('wrote', path.relative('.', out));
}
