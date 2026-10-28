import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { GitService } from '../lib/git.js';

async function git(cwd, ...args) {
  return new Promise((resolve, reject) => {
    const p = spawn('git', args, { cwd, shell: false, windowsHide: true }); const out = [], err = [];
    p.stdout.on('data', b => out.push(b)); p.stderr.on('data', b => err.push(b));
    p.on('error', reject); p.on('close', code => code ? reject(new Error(Buffer.concat(err).toString())) : resolve(Buffer.concat(out).toString().trim()));
  });
}
async function repo(t, { unborn = false } = {}) {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'tortoise-ai-git-'));
  t.after(async () => { await fs.rm(cwd, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });
  await git(cwd, 'init', '-b', 'main'); await git(cwd, 'config', 'user.name', 'Adapter Test'); await git(cwd, 'config', 'user.email', 'adapter@example.invalid');
  await git(cwd, 'config', 'commit.gpgsign', 'false'); await git(cwd, 'config', 'core.autocrlf', 'false');
  if (!unborn) { await fs.writeFile(path.join(cwd, 'hello.txt'), 'before\n'); await git(cwd, 'add', '.'); await git(cwd, 'commit', '-m', 'initial'); }
  return cwd;
}
async function ready(t, file = 'hello.txt') {
  const cwd = await repo(t), service = new GitService(), base = await service.baseline(cwd);
  assert.equal(base.status, 'ready', JSON.stringify(base));
  await fs.writeFile(path.join(cwd, file), 'after\n');
  const prepared = await service.prepare(base); assert.equal(prepared.status, 'ready', JSON.stringify(prepared));
  return { cwd, service, base, prepared };
}

test('clean baseline commits scoped edits, metadata and configured author; history and bounded diff', async t => {
  const { cwd, service, prepared } = await ready(t);
  assert.match(prepared.diff, /after/);
  const result = await service.commit(prepared, 'Update greeting', { sessionId: 'session-a', turnId: 'turn-1', model: 'test-model' });
  assert.equal(result.status, 'committed', JSON.stringify(result));
  assert.equal((await service.status(cwd)).clean, true);
  const log = await service.log(cwd, { sessionId: 'session-a' });
  assert.equal(log.commits.length, 1); assert.equal(log.commits[0].sha, result.sha);
  assert.equal(log.commits[0].author, 'Adapter Test'); assert.equal(log.commits[0].turnId, 'turn-1');
  const diff = await service.diff(cwd, { commit: result.sha, maxChars: 12 });
  assert.equal(diff.diff.length, 12); assert.equal(diff.truncated, true);
});

test('no diff skips commit without altering HEAD', async t => {
  const cwd = await repo(t), service = new GitService(), baseline = await service.baseline(cwd);
  assert.deepEqual(await service.prepare(baseline), { status: 'skipped', reason: 'no_changes' });
  assert.equal(await git(cwd, 'rev-parse', 'HEAD'), baseline.head);
});

test('dirty tracked staged/unstaged and untracked baseline is rejected and preserved', async t => {
  const cwd = await repo(t), service = new GitService();
  await fs.writeFile(path.join(cwd, 'hello.txt'), 'staged\n'); await git(cwd, 'add', 'hello.txt');
  await fs.writeFile(path.join(cwd, 'hello.txt'), 'unstaged\n'); await fs.writeFile(path.join(cwd, 'user.txt'), 'private work');
  const before = await git(cwd, 'diff', '--cached');
  const baseline = await service.baseline(cwd); assert.equal(baseline.reason, 'dirty_baseline');
  await fs.writeFile(path.join(cwd, 'hello.txt'), 'AI overlaps\n');
  assert.equal((await service.commit(await service.prepare(baseline), 'unsafe')).reason, 'dirty_baseline');
  assert.equal(await git(cwd, 'diff', '--cached'), before);
  assert.equal(await fs.readFile(path.join(cwd, 'user.txt'), 'utf8'), 'private work');
});

test('concurrent HEAD and content changes are rejected', async t => {
  const { cwd, service, prepared } = await ready(t);
  await git(cwd, 'commit', '--allow-empty', '-m', 'other writer');
  assert.equal((await service.commit(prepared, 'AI')).reason, 'head_changed');
  const other = await repo(t), s = new GitService(), b = await s.baseline(other);
  await fs.writeFile(path.join(other, 'hello.txt'), 'AI'); const p = await s.prepare(b);
  await fs.writeFile(path.join(other, 'hello.txt'), 'user races');
  assert.equal((await s.commit(p, 'AI')).reason, 'content_changed');
});

test('staging after baseline is not appropriated', async t => {
  const cwd = await repo(t), s = new GitService(), b = await s.baseline(cwd);
  await fs.writeFile(path.join(cwd, 'hello.txt'), 'user staged'); await git(cwd, 'add', '.');
  assert.equal((await s.prepare(b)).reason, 'index_changed');
});

test('hook failure preserves real index and working files, hook runs normally', async t => {
  const { cwd, service, prepared, base } = await ready(t);
  await fs.writeFile(path.join(cwd, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\necho hook-denied >&2\nexit 1\n', { mode: 0o755 });
  const index = await fs.readFile(path.join(cwd, '.git', 'index'));
  const result = await service.commit(prepared, 'blocked');
  assert.equal(result.status, 'error'); assert.match(result.error, /hook-denied/);
  assert.equal(await git(cwd, 'rev-parse', 'HEAD'), base.head);
  assert.deepEqual(await fs.readFile(path.join(cwd, '.git', 'index')), index);
  assert.equal(await fs.readFile(path.join(cwd, 'hello.txt'), 'utf8'), 'after\n');
  await assert.rejects(fs.stat(path.join(cwd, '.git', 'index.lock')), { code: 'ENOENT' });
});

test('duplicate commits are idempotent including concurrent requests', async t => {
  const { cwd, service, prepared } = await ready(t);
  const results = await Promise.all([service.commit(prepared, 'one'), service.commit(prepared, 'two')]);
  assert.equal(results[0].status, 'committed', JSON.stringify(results));
  assert.equal(results[0].sha, results[1].sha); assert.equal(results[1].duplicate, true);
  assert.equal(await git(cwd, 'rev-list', '--count', 'HEAD'), '2');
});

test('undo is session-restricted git revert and restores content', async t => {
  const { cwd, service, prepared } = await ready(t);
  const commit = await service.commit(prepared, 'AI edit', { sessionId: 'mine' });
  assert.equal((await service.undo(cwd, commit.sha, 'other')).reason, 'session_mismatch');
  const result = await service.undo(cwd, commit.sha, 'mine'); assert.equal(result.status, 'reverted', JSON.stringify(result));
  assert.equal(await fs.readFile(path.join(cwd, 'hello.txt'), 'utf8'), 'before\n');
  assert.equal(await git(cwd, 'rev-list', '--count', 'HEAD'), '3');
  assert.equal((await service.status(cwd)).clean, true);
});

test('undo refuses dirty state and leaves genuine revert conflicts explicit', async t => {
  const { cwd, service, prepared } = await ready(t);
  const commit = await service.commit(prepared, 'AI edit', { sessionId: 'mine' });
  await fs.writeFile(path.join(cwd, 'hello.txt'), 'later edit\n');
  assert.equal((await service.undo(cwd, commit.sha, 'mine')).reason, 'dirty_worktree');
  await git(cwd, 'add', '.'); await git(cwd, 'commit', '-m', 'later edit');
  const result = await service.undo(cwd, commit.sha, 'mine'); assert.equal(result.status, 'conflict', JSON.stringify(result));
  assert.equal((await service.status(cwd)).operation, 'REVERT_HEAD');
});

test('unborn branch supports initial commit; excluded and ignored files stay outside commit', async t => {
  const cwd = await repo(t, { unborn: true }), service = new GitService(), base = await service.baseline(cwd);
  assert.equal(base.status, 'ready'); assert.equal(base.head, null);
  await fs.writeFile(path.join(cwd, '.gitignore'), 'ignored.txt\n'); await fs.writeFile(path.join(cwd, 'ignored.txt'), 'ignored');
  await fs.writeFile(path.join(cwd, 'hello.txt'), 'initial'); await fs.writeFile(path.join(cwd, '.env'), 'TOP_SECRET=1');
  await fs.mkdir(path.join(cwd, 'node_modules')); await fs.writeFile(path.join(cwd, 'node_modules', 'dep.js'), 'dependency');
  const prepared = await service.prepare(base); assert.equal(prepared.status, 'ready'); assert.doesNotMatch(prepared.diff, /TOP_SECRET|dependency/);
  const result = await service.commit(prepared, 'initial AI', { sessionId: 'mine' }); assert.equal(result.status, 'committed', JSON.stringify(result));
  assert.equal(await git(cwd, 'ls-files'), '.gitignore\nhello.txt');
  assert.equal(await fs.readFile(path.join(cwd, '.env'), 'utf8'), 'TOP_SECRET=1');
});

test('detached HEAD, cancellation, and existing process lock fail safely', async t => {
  const cwd = await repo(t), s = new GitService({ lockTimeoutMs: 50 });
  await git(cwd, 'checkout', '--detach'); assert.equal((await s.baseline(cwd)).reason, 'detached_head');
  await git(cwd, 'checkout', 'main');
  const ac = new AbortController(); ac.abort(); assert.equal((await new GitService({ signal: ac.signal }).baseline(cwd)).reason, 'cancelled');
  const lock = path.join(cwd, '.git', 'tortoisegit-ai.lock'); await fs.writeFile(lock, 'other-owner');
  assert.equal((await s.baseline(cwd)).reason, 'locked'); assert.equal(await fs.readFile(lock, 'utf8'), 'other-owner');
});

test('filenames with spaces and pathspec syntax remain literal', async t => {
  const cwd = await repo(t), s = new GitService(), b = await s.baseline(cwd);
  await fs.writeFile(path.join(cwd, 'space name.txt'), 'safe');
  const p = await s.prepare(b); const result = await s.commit(p, 'spaces'); assert.equal(result.status, 'committed', JSON.stringify(result));
  assert.match(await git(cwd, 'ls-files'), /space name.txt/);
});
