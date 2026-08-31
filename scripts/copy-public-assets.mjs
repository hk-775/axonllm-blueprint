import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve(process.cwd(), process.argv[2] || 'dist');
const source = resolve(process.cwd(), '../docs/assets');
const target = resolve(output, 'assets');
const files = [
  'axonllm-blueprint-mark.svg',
  'axonllm-blueprint-architecture.drawio',
  'axonllm-blueprint-architecture.png',
  'axonllm-blueprint-aws-services-reference.drawio',
  'axonllm-blueprint-aws-services-reference.png',
];

await mkdir(target, { recursive: true });
await Promise.all(files.map((file) => copyFile(resolve(source, file), resolve(target, file))));
await writeFile(resolve(output, '.nojekyll'), '');
