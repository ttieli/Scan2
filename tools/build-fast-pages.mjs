import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const fastRoot = join(projectRoot, 'fast-mode');
const distRoot = join(fastRoot, 'apps', 'web', 'dist');

execFileSync('pnpm', ['--dir', fastRoot, '--filter', '@raptorqr/web', 'build'], {
  cwd: projectRoot,
  stdio: 'inherit',
});

const distFiles = listFiles(distRoot).map((file) => relative(distRoot, file));
if (distFiles.length !== 1 || distFiles[0] !== 'index.html') {
  throw new Error(`Enhanced build must contain only index.html; found: ${distFiles.join(', ')}`);
}

const source = readFileSync(join(distRoot, 'index.html'), 'utf8');
const notice = `<!--
QR Transfer Enhanced includes source derived from infrost/RaptorQR
commit fdb434e1fc1126f84b98e407be8d24bbb683b597 under the MIT License.
The complete vendored license notices are in fast-mode/.
-->`;

writeFileSync(join(projectRoot, 'sender-fast.html'), makePage(source, 'sender', '增强发送端'), 'utf8');
writeFileSync(join(projectRoot, 'receiver-fast.html'), makePage(source, 'receiver', '增强接收端'), 'utf8');

function makePage(html, mode, title) {
  const bootstrap = `<script>if (!location.hash) location.hash = '${mode}';</script>`;
  return html
    .replace('<html lang="en">', `<html lang="zh-CN" data-default-mode="${mode}">`)
    .replace('<title>RaptorQR</title>', `<title>QR Transfer · ${title}</title>`)
    .replace('<body>', `<body>\n    ${notice}\n    ${bootstrap}`)
    .replaceAll('◈ RaptorQR', '◈ QR Transfer Enhanced');
}

function listFiles(directory) {
  const result = [];
  for (const name of readdirSync(directory).sort()) {
    const file = join(directory, name);
    if (statSync(file).isDirectory()) result.push(...listFiles(file));
    else result.push(file);
  }
  return result;
}
