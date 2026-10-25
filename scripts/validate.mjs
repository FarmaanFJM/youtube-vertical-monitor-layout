// Static validation of the extension: manifest shape, referenced files, and
// the invariants the design depends on. Exits non-zero on any violation.
import { readFileSync, existsSync } from 'node:fs';

const errors = [];
const fail = (msg) => errors.push(msg);
const read = (f) => readFileSync(f, 'utf8');

const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('package.json'));

// ---- manifest ----
if (manifest.manifest_version !== 3) fail('manifest_version must be 3');
if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) fail(`version "${manifest.version}" is not x.y.z`);
if (manifest.version !== pkg.version) fail(`manifest version ${manifest.version} != package.json ${pkg.version}`);
if ((manifest.permissions || []).length) fail(`unexpected permissions: ${manifest.permissions}`);
if (manifest.host_permissions?.length) fail('host_permissions must be empty (content scripts only)');
if (manifest.background || manifest.web_accessible_resources) fail('no background page or web-accessible resources expected');
const scripts = manifest.content_scripts || [];
if (scripts.length !== 1) fail('expected exactly one content_scripts entry');
for (const cs of scripts) {
  for (const m of cs.matches) if (m !== 'https://www.youtube.com/*') fail(`unexpected match pattern ${m}`);
  for (const f of [...(cs.css || []), ...(cs.js || [])]) if (!existsSync(f)) fail(`manifest references missing file ${f}`);
  if (cs.run_at !== 'document_start') fail('content script should run at document_start so CSS applies before first paint');
}

// ---- CSS invariants ----
const GATE = 'html.ytvm-portrait';
function selectors(css) {
  const out = [];
  let depth = 0, buf = '', inMedia = [];
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const ch of stripped) {
    if (ch === '{') {
      const head = buf.trim();
      if (head.startsWith('@media')) inMedia.push(depth);
      else if (!head.startsWith('@')) out.push(head);
      depth++; buf = '';
    } else if (ch === '}') { depth--; buf = ''; inMedia = inMedia.filter((d) => d < depth); }
    else if (ch === ';' && depth === 0) buf = '';
    else if (ch === ';') buf = '';
    else buf += ch;
  }
  return out;
}
for (const file of scripts.flatMap((cs) => cs.css || [])) {
  const css = read(file);
  for (const sel of selectors(css)) {
    for (const part of sel.split(',').map((s) => s.trim()).filter(Boolean)) {
      if (!part.startsWith(GATE)) fail(`${file}: selector not gated on ${GATE}: "${part.slice(0, 80)}"`);
    }
  }
  for (const m of css.matchAll(/z-index\s*:\s*(-?\d+)/g)) if (Math.abs(+m[1]) > 10) fail(`${file}: high z-index ${m[1]}`);
  if (/url\(\s*['"]?https?:/i.test(css) || /@import/i.test(css)) fail(`${file}: remote resource in CSS`);
}

// ---- JS invariants: layout only, no network, no custom UI, no eval ----
const banned = [
  [/\bfetch\s*\(/, 'network call'], [/XMLHttpRequest/, 'network call'], [/sendBeacon/, 'telemetry'], [/WebSocket/, 'network call'],
  [/\beval\s*\(/, 'eval'], [/new\s+Function/, 'Function constructor'], [/document\.write/, 'document.write'],
  [/createElement\s*\(/, 'creating elements (no custom UI allowed)'], [/innerHTML|insertAdjacentHTML/, 'HTML injection'],
  [/MutationObserver/, 'unscoped observers (use navigation events)'], [/setInterval\s*\(/, 'polling'],
  [/chrome\.|browser\.(?!_)/, 'extension APIs (none needed)'], [/\.appendChild|\.insertBefore|\.append\(|\.prepend\(|\.remove\(\)/, 'DOM mutation of YouTube nodes'],
];
for (const f of scripts.flatMap((cs) => cs.js || [])) {
  const code = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const [re, why] of banned) if (re.test(code)) fail(`${f}: ${why} (${re})`);
}

if (errors.length) {
  console.error(`validate: ${errors.length} problem(s)\n - ` + errors.join('\n - '));
  process.exit(1);
}
console.log(`validate: ok (manifest v${manifest.version}, ${scripts[0].css.length} stylesheets, ${scripts[0].js.length} scripts)`);
