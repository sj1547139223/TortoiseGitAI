import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { GitService } from '../lib/git.js';
import { start, stop, end } from '../droid/hook.js';
import { handle, operate } from '../droid/mcp.js';
import { createRuntime } from '../droid/runtime.js';
import { droidSummary } from '../droid/summary.js';
import * as store from '../droid/store.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();
async function setup(t, config = {}) {
  const cwd = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'tgai-droid-')));
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'tgai-home-'));
  t.after(async () => { await fs.rm(cwd, { recursive: true, force: true, maxRetries: 5 }); await fs.rm(home, { recursive: true, force: true, maxRetries: 5 }); });
  git(cwd, 'init', '-b', 'main'); git(cwd, 'config', 'user.name', 'T'); git(cwd, 'config', 'user.email', 't@example.invalid'); git(cwd, 'config', 'commit.gpgsign', 'false'); git(cwd, 'config', 'core.autocrlf', 'false');
  await fs.writeFile(path.join(cwd, 'a.txt'), 'one\n'); git(cwd, 'add', '.'); git(cwd, 'commit', '-m', 'init');
  process.env.TGIT_AI_HOME = home;
  await fs.writeFile(path.join(home, 'config.json'), JSON.stringify({ allowedRoots: [cwd], tgitPath: 'C:\\nope\\TortoiseGitProc.exe', droidPath: 'tgai-missing-droid', ...config }));
  return { cwd, home };
}
const summarize = (title = '更新 a', generated = []) => async () => ({ message: `AI: ${title}`, source: 'llm', generated, model: 'fake-model' });
const lastBody = cwd => git(cwd, 'log', '-1', '--format=%B');

test('baseline survives JSON serialization into a fresh GitService', async t => {
  const { cwd } = await setup(t);
  const base = await new GitService().baseline(cwd);
  await fs.writeFile(path.join(cwd, 'a.txt'), 'two\n');
  const other = new GitService(), restored = other.restoreBaseline(JSON.parse(JSON.stringify(base)));
  const prepared = await other.prepare(restored); assert.equal(prepared.status, 'ready', JSON.stringify(prepared));
  assert.equal((await other.commit(prepared, 'AI: x')).status, 'committed');
  assert.equal(other.restoreBaseline({ status: 'ready' }).reason, 'invalid_baseline');
});

test('start → stop commits the turn with Droid session trailers and records the outcome', async t => {
  const { cwd } = await setup(t);
  await start({ session_id: 'droid-s1', cwd, prompt: '改 a' });
  assert.equal(await store.othersRunning(store.keyOf(cwd), 'someone-else'), true);
  await fs.writeFile(path.join(cwd, 'a.txt'), 'two\n');
  await stop({ session_id: 'droid-s1', stop_hook_active: false }, { summarize: summarize() });
  assert.match(lastBody(cwd), /^AI: 更新 a\n\nAI-Session: droid-s1\nAI-Turn: 1\nAI-Model: fake-model$/);
  const s = await store.getSession('droid-s1');
  assert.equal(s.outcomes[0].status, 'committed'); assert.equal(s.baseline, null);
  assert.equal(await store.othersRunning(store.keyOf(cwd), 'someone-else'), false);
  assert.equal(git(cwd, 'status', '--porcelain'), '');
});

test('a dirty baseline skips the turn and leaves user work alone', async t => {
  const { cwd } = await setup(t);
  await fs.writeFile(path.join(cwd, 'mine.txt'), 'user work');
  await start({ session_id: 's', cwd, prompt: 'x' });
  await fs.writeFile(path.join(cwd, 'a.txt'), 'ai\n');
  await stop({ session_id: 's' }, { summarize: summarize() });
  assert.equal(git(cwd, 'rev-list', '--count', 'HEAD'), '1');
  assert.match((await store.getSession('s')).outcomes[0].reason, /^dirty_baseline: mine.txt/);
});

test('repositories are opt-in; the stored choice wins over allowedRoots', async t => {
  const { cwd } = await setup(t, { allowedRoots: [] });
  await start({ session_id: 's', cwd, prompt: 'x' });
  await fs.writeFile(path.join(cwd, 'a.txt'), 'ai\n');
  await stop({ session_id: 's' }, { summarize: summarize() });
  assert.equal(git(cwd, 'rev-list', '--count', 'HEAD'), '1');
  git(cwd, 'checkout', '--', 'a.txt');
  const rt = await createRuntime();
  assert.equal((await rt.setEnabled(await rt.repoOf(cwd), true)).authorized, true);
  await start({ session_id: 's', cwd, prompt: 'x' });
  await fs.writeFile(path.join(cwd, 'a.txt'), 'ai\n');
  await stop({ session_id: 's' }, { summarize: summarize() });
  assert.equal(git(cwd, 'rev-list', '--count', 'HEAD'), '2');
});

test('model-judged artifacts are omitted and learned; another live session blocks the commit', async t => {
  const { cwd } = await setup(t);
  await start({ session_id: 's', cwd, prompt: 'x' });
  await fs.mkdir(path.join(cwd, 'gen')); await fs.writeFile(path.join(cwd, 'gen', 'out.bin'), 'bin'); await fs.writeFile(path.join(cwd, 'src.c'), 'int x;');
  await stop({ session_id: 's' }, { summarize: summarize('加源文件', ['gen/out.bin']) });
  assert.equal(git(cwd, 'show', '--name-only', '--format=', 'HEAD'), 'src.c');
  assert.deepEqual((await store.getRepo(store.keyOf(cwd))).learned, ['/gen/']);
  await store.markRunning(store.keyOf(cwd), 'other');
  await start({ session_id: 's', cwd, prompt: 'y' });
  await fs.writeFile(path.join(cwd, 'src.c'), 'int y;');
  await stop({ session_id: 's' }, { summarize: summarize() });
  assert.equal((await store.getSession('s')).outcomes[0].reason, 'other_agent_active');
  await end({ session_id: 's' });
});

test('a cancelled turn (no Stop) does not leak its baseline into the next turn', async t => {
  const { cwd } = await setup(t);
  await start({ session_id: 's', cwd, prompt: 'x' });
  await fs.writeFile(path.join(cwd, 'a.txt'), 'cancelled edit\n');
  await start({ session_id: 's', cwd, prompt: 'y' });
  await stop({ session_id: 's' }, { summarize: summarize() });
  assert.equal(git(cwd, 'rev-list', '--count', 'HEAD'), '1');
  assert.match((await store.getSession('s')).outcomes[0].reason, /^dirty_baseline/);
});

test('MCP server: protocol, status, no repo enabling, guarded undo, pause', async t => {
  const { cwd } = await setup(t);
  const init = await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  assert.equal(init.result.serverInfo.name, 'tortoisegit-ai');
  assert.equal((await handle({ jsonrpc: '2.0', method: 'notifications/initialized' })), null);
  assert.equal((await handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' })).result.tools[0].name, 'tgit_ai');
  await start({ session_id: 's', cwd, prompt: 'x' });
  await fs.writeFile(path.join(cwd, 'a.txt'), 'two\n');
  await stop({ session_id: 's' }, { summarize: summarize() });
  const status = await operate({ action: 'status' }, { cwd });
  assert.equal(status.sessionId, 's'); assert.equal(status.authorized, true); assert.equal(status.history.commits.length, 1);
  const denied = await handle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'tgit_ai', arguments: { action: 'enableRepo' } } });
  assert.equal(denied.result.isError, true);
  const sha = status.history.commits[0].sha;
  await assert.rejects(operate({ action: 'undo', sha }, { cwd }), /confirm:true/);
  assert.equal((await operate({ action: 'undo', sha, confirm: true }, { cwd })).status, 'reverted');
  assert.equal(await fs.readFile(path.join(cwd, 'a.txt'), 'utf8'), 'one\n');
  assert.deepEqual(await operate({ action: 'pause' }, { cwd }), { ok: true, enabled: false });
  await start({ session_id: 's', cwd, prompt: 'x' });
  assert.equal((await store.getSession('s')).baseline, null);
});

test('droid exec failure falls back to the template title', async t => {
  await setup(t);
  const config = (await createRuntime()).config;
  const r = await droidSummary({ paths: ['a.txt'], config, exec: async () => { throw new Error('summary_timeout'); } });
  assert.deepEqual([r.message, r.source, r.reason], ['AI: 修改 a.txt', 'template', 'summary_timeout']);
  const ok = await droidSummary({ paths: ['a.txt'], candidates: ['x.o'], config, exec: async ({ prompt }) => { assert.match(prompt, /candidates/); return '{"title":"改了 a","generated":["x.o","bogus"]}'; } });
  assert.deepEqual([ok.message, ok.generated], ['AI: 改了 a', ['x.o']]);
});

test('hook process: silent stdout, recursion guard, template title when droid is unavailable', async t => {
  const { cwd, home } = await setup(t);
  const run = (mode, input, env = {}) => spawnSync(process.execPath, [path.join(root, 'droid', 'hook.js'), mode], { input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, TGIT_AI_HOME: home, ...env } });
  const inner = run('start', { session_id: 'p', cwd, prompt: 'x' }, { TGIT_AI_INNER: '1' });
  assert.equal(inner.status, 0); assert.equal(await store.getSession('p'), null);
  const a = run('start', { session_id: 'p', cwd, prompt: 'x' });
  assert.equal(a.status, 0); assert.equal(a.stdout, '');
  await fs.writeFile(path.join(cwd, 'a.txt'), 'two\n');
  const b = run('stop', { session_id: 'p', stop_hook_active: false });
  assert.equal(b.status, 0, b.stderr);
  assert.match(lastBody(cwd), /^AI: 修改 a.txt\n\nAI-Session: p\n/);
});
