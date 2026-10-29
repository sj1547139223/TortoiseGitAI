import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { start, stop, end } from '../codex/hook.js';
import { handle } from '../codex/mcp.js';
import { codexSummary } from '../codex/summary.js';
import * as store from '../codex/store.js';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
async function setup(t) {
  const cwd = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'tgai-codex-')));
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'tgai-codex-home-'));
  const previousHome = process.env.TGIT_AI_CODEX_HOME;
  t.after(async () => { await fs.rm(cwd, { recursive: true, force: true, maxRetries: 5 }); await fs.rm(home, { recursive: true, force: true, maxRetries: 5 }); });
  t.after(() => { if (previousHome === undefined) delete process.env.TGIT_AI_CODEX_HOME; else process.env.TGIT_AI_CODEX_HOME = previousHome; });
  git(cwd, 'init', '-b', 'main'); git(cwd, 'config', 'user.name', 'T'); git(cwd, 'config', 'user.email', 't@example.invalid'); git(cwd, 'config', 'commit.gpgsign', 'false');
  await fs.writeFile(path.join(cwd, 'a.txt'), 'one\n'); git(cwd, 'add', '.'); git(cwd, 'commit', '-m', 'init');
  process.env.TGIT_AI_CODEX_HOME = home;
  await fs.writeFile(path.join(home, 'config.json'), JSON.stringify({ allowedRoots: [cwd], codexPath: 'codex-missing' }));
  return { cwd, home };
}
const summarize = () => async () => ({ message: 'Codex: 更新 a', source: 'test', generated: [], model: 'codex-test' });

test('Codex hook commits a turn with Codex metadata', async t => {
  const { cwd } = await setup(t);
  await start({ session_id: 'codex-s1', cwd, prompt: '改 a' });
  await fs.writeFile(path.join(cwd, 'a.txt'), 'two\n');
  await stop({ session_id: 'codex-s1', stop_hook_active: false }, { summarize: summarize() });
  const body = git(cwd, 'log', '-1', '--format=%B');
  assert.match(body, /^Codex: 更新 a/);
  assert.match(body, /AI-Session: codex-s1/);
  assert.match(body, /AI-Model: codex-test/);
  assert.match(body, /AI-Tool: Codex/);
  assert.equal(git(cwd, 'status', '--porcelain'), '');
  await end({ session_id: 'codex-s1' });
});

test('Codex summary falls back and parses model output', async t => {
  const { cwd } = await setup(t);
  const fallback = await codexSummary({ paths: ['a.txt'], config: { codexPath: 'missing', summaryModel: 'm', summaryTimeoutMs: 100 }, exec: async () => { throw new Error('summary_timeout'); } });
  assert.match(fallback.message, /修改/);
  const parsed = await codexSummary({ paths: ['a.txt'], candidates: ['out.bin'], config: { codexPath: 'codex', summaryModel: 'm', summaryTimeoutMs: 100 }, exec: async ({ prompt }) => { assert.match(prompt, /candidates/); return '{"title":"更新 a","generated":["out.bin"]}'; } });
  assert.equal(parsed.message, 'AI: 更新 a');
  assert.deepEqual(parsed.generated, ['out.bin']);
});

test('Codex MCP exposes shared tgit_ai contract', async t => {
  const { cwd } = await setup(t);
  const listed = await handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.equal(listed.result.tools[0].name, 'tgit_ai');
  const response = await handle({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'tgit_ai', arguments: { action: 'status' } } }, { cwd });
  const value = JSON.parse(response.result.content[0].text);
  assert.equal(value.authorized, true);
});
