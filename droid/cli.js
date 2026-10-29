#!/usr/bin/env node
import path from 'node:path';
import { createRuntime } from './runtime.js';
import * as store from './store.js';

/** User-side switch: `node droid/cli.js enable|disable|status|redetect|forget <pattern> [path]`. */
const [cmd, ...rest] = process.argv.slice(2);
const usage = 'usage: node droid/cli.js <enable|disable|status|redetect> [repo-path]\n       node droid/cli.js forget <pattern> [repo-path]';
const out = value => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
try {
  const pattern = cmd === 'forget' ? rest.shift() : undefined;
  const target = path.resolve(rest[0] || process.cwd());
  const rt = await createRuntime();
  const repo = await rt.repoOf(target);
  if (!['enable', 'disable', 'status', 'redetect', 'forget'].includes(cmd)) { process.stderr.write(`${usage}\n`); process.exit(2); }
  if (!repo.cwd) { out(repo.status); process.exit(1); }
  if (cmd === 'enable' || cmd === 'disable') out(await rt.setEnabled(repo, cmd === 'enable'));
  else if (cmd === 'redetect') out(repo.authorized ? await rt.refreshRepo(repo, { force: true }) : { status: 'error', reason: 'repository_not_enabled' });
  else if (cmd === 'forget') out(await rt.forgetExclude(repo, pattern));
  else {
    const rec = await store.getRepo(repo.key);
    out({ repo: repo.cwd, authorized: !!repo.authorized, stateDir: store.home(), rules: { profiles: rec?.profiles || [], detected: rec?.detected || [], learned: rec?.learned || [] }, tgitPath: await rt.executable() });
  }
} catch (e) { process.stderr.write(`${String(e?.message || e)}\n`); process.exit(1); }
