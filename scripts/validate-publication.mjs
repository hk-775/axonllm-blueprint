import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const normalDir = resolve(root, 'frontend/dist');
const publicDir = resolve(root, 'frontend/dist-public');
const assetNames = [
  'axonllm-blueprint-architecture.drawio',
  'axonllm-blueprint-architecture.png',
  'axonllm-blueprint-aws-services-reference.drawio',
  'axonllm-blueprint-aws-services-reference.png',
];

const publicIndex = await readFile(resolve(publicDir, 'index.html'), 'utf8');
assert.match(publicIndex, /\/axonllm-blueprint\/assets\//);

async function bundleText(directory) {
  const names = await readdir(resolve(directory, 'assets'));
  const js = names.filter((name) => name.endsWith('.js'));
  assert.ok(js.length > 0, `No JavaScript bundle in ${directory}`);
  return (await Promise.all(js.map((name) => readFile(resolve(directory, 'assets', name), 'utf8')))).join('\n');
}

const normalBundle = await bundleText(normalDir);
const publicBundle = await bundleText(publicDir);
assert.doesNotMatch(normalBundle, /Published synthetic preview/);
assert.match(publicBundle, /Published synthetic preview/);
assert.doesNotMatch(publicBundle, /execute-api|wss:\/\/|localhost:3001|127\.0\.0\.1:3001/i);

for (const name of assetNames) {
  const source = await readFile(resolve(root, 'docs/assets', name));
  const published = await readFile(resolve(publicDir, 'assets', name));
  assert.deepEqual(published, source, `Published asset drift: ${name}`);
}

for (const workflow of ['ci.yml', 'codeql.yml', 'pages.yml']) {
  const text = await readFile(resolve(root, '.github/workflows', workflow), 'utf8');
  assert.doesNotMatch(text, /pull_request_target/);
  for (const match of text.matchAll(/uses:\s*([^\s#]+)/g)) {
    assert.match(match[1], /@[0-9a-f]{40}$/, `Unpinned action in ${workflow}: ${match[1]}`);
  }
}

console.log('Normal/public boundary, base path, workflows, and architecture assets verified.');
