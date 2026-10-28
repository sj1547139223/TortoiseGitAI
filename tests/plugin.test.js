import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { apply } from '../index.js';
import { generateSummary, cleanTitle } from '../lib/summary.js';

const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();
async function repo(t) {
  const cwd = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'tgai-plugin-')));
  t.after(() => fs.rm(cwd, { recursive: true, force: true, maxRetries: 5 }));
  git(cwd, 'init', '-b', 'main'); git(cwd, 'config', 'user.name', 'T'); git(cwd, 'config', 'user.email', 't@example.invalid'); git(cwd, 'config', 'commit.gpgsign', 'false'); git(cwd, 'config', 'core.autocrlf', 'false');
  await fs.writeFile(path.join(cwd, 'a.txt'), 'one\n'); git(cwd, 'add', '.'); git(cwd, 'commit', '-m', 'init');
  return cwd;
}
function fakeLlm(text, seen = []) {
  return { async prepareCall(route, signal) { seen.push(route); return { config: { ...route }, async *stream(o) { seen.push(o); yield { type: 'text-delta', index: 0, text }; yield { type: 'finish', reason: { kind: 'stop' } }; } }; } };
}
function harness(cwd, { roots = [cwd], llm = fakeLlm('更新问候语'), others = [] } = {}) {
  const listeners = {}, routes = {}, tools = {}, effects = [];
  const agent = { id: 'sess-1', session: { requestHeader: () => ({ config: { provider: 'p', model: 'm' } }) } };
  const ctx = {
    on: (name, fn) => { (listeners[name] ||= []).push(fn); },
    effect: fn => { const d = fn(); effects.push(d); },
    tools: { register: d => { tools[d.name] = d; return () => {}; } },
    agents: { roots: () => [agent], get: id => (id === agent.id ? agent : undefined), list: () => [agent, ...others] },
    workingDirectory: { ensure: async () => cwd },
    llm,
    webServer: { register: r => { routes[r.path] = r.handler; return () => {}; } },
    connection: { requestRejection: () => undefined },
    storageDomain: { open: async spec => { assert.match(spec.name, /^[a-z][a-z0-9_]*$/); const m = new Map(); return { table: () => ({ get: k => m.get(k), put: async (k, v) => { spec.tables.repos.valueSchema.parse(v); m.set(k, v); } }), close: async () => {} }; } },
  };
  apply(ctx, { allowedRoots: roots, tgitPath: 'C:\\nope\\TortoiseGitProc.exe' });
  const emit = async (name, payload) => { for (const fn of listeners[name] || []) await fn({ agent, ...payload }, async () => ({ kind: 'enter' })); };
  return { agent, ctx, emit, tools, routes, listeners };
}
const turn = async (h, n, edit) => {
  const signal = new AbortController().signal;
  await h.emit('agent/status', { status: 'running' });
  await h.emit('agent/pre-step', { turn: n, step: 0, messages: [{ role: 'user', content: [{ type: 'text', text: '把 one 改成 two' }] }], signal });
  await edit();
  await h.emit('agent/turn-stopping', { turn: n, signal });
  await h.emit('agent/status', { status: 'idle' });
};

test('turn edits are committed with LLM summary and trailers', async t => {
  const cwd = await repo(t), seen = [], h = harness(cwd, { llm: fakeLlm('**更新问候语**', seen) });
  await turn(h, 1, () => fs.writeFile(path.join(cwd, 'a.txt'), 'two\n'));
  const body = git(cwd, 'log', '-1', '--format=%B');
  assert.match(body, /^AI: 更新问候语/); assert.match(body, /AI-Session: sess-1/); assert.match(body, /AI-Model: m/);
  assert.equal(git(cwd, 'status', '--porcelain'), '');
  assert.equal(seen[0].provider, 'p'); assert.match(seen[1].messages[0].content[0].text, /two/);
  const out = JSON.parse(await h.tools.tgit_ai.execute({ action: 'status' }, { agent: h.agent }));
  assert.equal(out.history.commits.length, 1); assert.equal(out.outcomes[0].status, 'committed');
});

test('dirty baseline, unauthorized repo, and paused session never commit', async t => {
  const cwd = await repo(t), h = harness(cwd);
  await fs.writeFile(path.join(cwd, 'user.txt'), 'mine');
  await turn(h, 1, () => fs.writeFile(path.join(cwd, 'a.txt'), 'two\n'));
  assert.equal(git(cwd, 'rev-list', '--count', 'HEAD'), '1');
  const other = await repo(t), h2 = harness(other, { roots: [] });
  await turn(h2, 1, () => fs.writeFile(path.join(other, 'a.txt'), 'two\n'));
  assert.equal(git(other, 'rev-list', '--count', 'HEAD'), '1');
  const third = await repo(t), h3 = harness(third);
  await h3.tools.tgit_ai.execute({ action: 'pause' }, { agent: h3.agent });
  await turn(h3, 1, () => fs.writeFile(path.join(third, 'a.txt'), 'two\n'));
  assert.equal(git(third, 'rev-list', '--count', 'HEAD'), '1');
});

test('LLM failure falls back to template; undo requires confirm and reverts', async t => {
  const cwd = await repo(t);
  const broken = { async prepareCall() { throw new Error('no route'); } };
  const h = harness(cwd, { llm: broken });
  await turn(h, 1, () => fs.writeFile(path.join(cwd, 'a.txt'), 'two\n'));
  assert.match(git(cwd, 'log', '-1', '--format=%s'), /^AI: 修改 a\.txt/);
  const sha = git(cwd, 'rev-parse', 'HEAD');
  await assert.rejects(h.tools.tgit_ai.execute({ action: 'undo', sha }, { agent: h.agent }), /confirm/);
  const res = JSON.parse(await h.tools.tgit_ai.execute({ action: 'undo', sha, confirm: true }, { agent: h.agent }));
  assert.equal(res.status, 'reverted'); assert.equal(await fs.readFile(path.join(cwd, 'a.txt'), 'utf8'), 'one\n');
});

test('HTTP routes serve status and actions for live sessions only', async t => {
  const cwd = await repo(t), h = harness(cwd);
  const call = (route, req) => new Promise(resolve => { const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { resolve({ status: this.statusCode, body: b && JSON.parse(b) }); } }; h.routes[route](req, res); });
  const ok = await call('/api/tortoisegit-ai.status', { method: 'GET', url: '/api/tortoisegit-ai.status?session=sess-1' });
  assert.equal(ok.status, 200); assert.equal(ok.body.enabled, true);
  const missing = await call('/api/tortoisegit-ai.status', { method: 'GET', url: '/api/tortoisegit-ai.status?session=x' });
  assert.equal(missing.status, 404);
  const body = Buffer.from(JSON.stringify({ session: 'sess-1', action: 'pause' }));
  const post = await call('/api/tortoisegit-ai.action', { method: 'POST', headers: { 'content-type': 'application/json' }, [Symbol.asyncIterator]: async function* () { yield body; } });
  assert.equal(post.body.enabled, false);
});

test('a repository can be enabled from the UI only, and then auto-commits', async t => {
  const cwd = await repo(t), h = harness(cwd, { roots: [] });
  const call = (route, req) => new Promise(resolve => { const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { resolve({ status: this.statusCode, body: b && JSON.parse(b) }); } }; h.routes[route](req, res); });
  const post = payload => { const body = Buffer.from(JSON.stringify({ session: 'sess-1', ...payload })); return call('/api/tortoisegit-ai.action', { method: 'POST', headers: { 'content-type': 'application/json' }, [Symbol.asyncIterator]: async function* () { yield body; } }); };
  const before = await call('/api/tortoisegit-ai.status', { method: 'GET', url: '/x?session=sess-1' });
  assert.equal(before.body.authorized, false); assert.equal(before.body.git.status, 'ok');
  await assert.rejects(h.tools.tgit_ai.execute({ action: 'enableRepo' }, { agent: h.agent }), /only the user/);
  assert.equal((await post({ action: 'enableRepo' })).body.authorized, true);
  await turn(h, 1, () => fs.writeFile(path.join(cwd, 'a.txt'), 'two\n'));
  assert.equal(git(cwd, 'rev-list', '--count', 'HEAD'), '2');
  assert.equal((await post({ action: 'disableRepo' })).body.authorized, false);
  await turn(h, 2, () => fs.writeFile(path.join(cwd, 'a.txt'), 'three\n'));
  assert.equal(git(cwd, 'rev-list', '--count', 'HEAD'), '2');
});

test('summary cleaning and other-agent guard', async t => {
  assert.equal(cleanTitle('"AI: 修复登录。"\n解释'), '修复登录');
  const r = await generateSummary({ llm: null, paths: ['a', 'b', 'c', 'd'] });
  assert.equal(r.source, 'template'); assert.match(r.message, /等 4 个文件/);
  const cwd = await repo(t), h = harness(cwd);
  const child = { id: 'child' };
  for (const fn of h.listeners['agent/status']) fn({ agent: child, status: 'running' });
  await new Promise(r => setTimeout(r, 300));
  await turn(h, 1, () => fs.writeFile(path.join(cwd, 'a.txt'), 'two\n'));
  assert.equal(git(cwd, 'rev-list', '--count', 'HEAD'), '1');
});
