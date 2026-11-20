import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

// Node's --check handles one entrypoint; visit every source, test, and script.
for (const directory of ['src', 'test', 'scripts']) {
  for (const name of await readdir(directory)) {
    if (!name.endsWith('.js')) continue;
    const file = path.join(directory, name);
    const child = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
    if (child.status !== 0) process.exit(child.status || 1);
  }
}
console.log('JavaScript syntax checks passed.');
