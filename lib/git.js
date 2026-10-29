import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const skipped = (reason, extra = {}) => ({ status: 'skipped', reason, ...extra });
const failure = (error) => ({ status: 'error', reason: error.code || 'git_failed', error: error.message, stderr: error.stderr || '' });
/** Secrets: never auto-committed, not configurable. */
const SENSITIVE = (name) => /(?:^|\/)\.env(?:\.|$)/i.test(name) || /(?:^|\/)(?:id_rsa|id_ed25519|id_ecdsa|credentials(?:\.json)?|secrets?(?:\..*)?)$/i.test(name) || /\.(?:pem|key|p12|pfx)$/i.test(name);
/**
 * Built-in build-artifact / IDE-noise patterns (gitignore-like, case-insensitive):
 * `dir/` matches a directory segment anywhere; a pattern without `/` matches the
 * file name; otherwise it matches the whole repository-relative path.
 */
export const DEFAULT_EXCLUDES = Object.freeze([
  // generic
  'node_modules/', 'dist/', 'build/', 'coverage/', '.next/', '.git/', 'vendor/', '__pycache__/', '.vs/', '.cache/',
  '*.pyc', '*.tmp', '*.bak', '*.log', '*.swp', 'Thumbs.db', '.DS_Store',
  // compiled objects / images (Keil MDK, IAR, GCC, CCS …)
  '*.o', '*.obj', '*.d', '*.crf', '*.axf', '*.elf', '*.hex', '*.lst', '*.map', '*.lnp', '*.dep', '*.iex', '*.htm.bak',
  '*.__i', '*._ia', '*._2i', '*.pbi', '*.pbd', '*.browse', '*.sim', '*.out', '*.a51.lst',
  // Keil MDK output folders and per-user/IDE state
  'Objects/', 'Listings/', 'DebugConfig/', '*.uvguix.*', '*.uvoptx', '*.uvopt', '*.dbgconf', '*.build_log.htm',
  'JLinkLog.txt', 'JLinkSettings.ini', 'EventRecorderStub.scvd',
  // IAR per-user state
  '*.ewt.bak',
]);
function compile(pattern) {
  let p = String(pattern).trim().replace(/\\/g, '/');
  if (!p || p.startsWith('#')) return null;
  const dir = p.endsWith('/'); if (dir) p = p.slice(0, -1);
  const anchored = p.startsWith('/'); if (anchored) p = p.slice(1);
  const body = p.split(/(\*\*\/?|\*|\?)/).map(t => t === '**' ? '.*' : t === '**/' ? '(?:.*/)?' : t === '*' ? '[^/]*' : t === '?' ? '[^/]' : t.replace(/[.+^${}()|[\]\\]/g, '\\$&')).join('');
  if (dir) return new RegExp(`${anchored || p.includes('/') ? '^' : '(?:^|/)'}${body}/`, 'i');
  if (!anchored && !p.includes('/')) return new RegExp(`(?:^|/)${body}$`, 'i');
  return new RegExp(`^${body}$`, 'i');
}
/** Build a predicate: true when the auto-commit must ignore `name`. */
export function createExcluder(extra = [], { defaults = true } = {}) {
  const rules = [...(defaults ? DEFAULT_EXCLUDES : []), ...extra].map(compile).filter(Boolean);
  return (name) => SENSITIVE(name) || rules.some(r => r.test(name.replace(/\\/g, '/')));
}
const defaultExcluder = createExcluder();
/** Single-pattern matcher (same syntax as excludes); null for blank/comment lines. */
export function patternMatcher(pattern) { const r = compile(pattern); return r ? name => r.test(String(name).replace(/\\/g, '/')) : null; }
export const isSensitive = name => SENSITIVE(String(name).replace(/\\/g, '/'));
const repoKey = (root) => { const r = path.resolve(String(root)); return process.platform === 'win32' ? r.toLowerCase() : r; };
const hash = (data) => createHash('sha256').update(data).digest('hex');
function issue(code, message) { return Object.assign(new Error(message), { code }); }
function entries(raw) {
  const parts = raw.split('\0'); const result = [];
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    const code = parts[i].slice(0, 2); const name = parts[i].slice(3);
    result.push({ code, path: name });
    if (/[RC]/.test(code)) result.push({ code, path: parts[++i] });
  }
  return result;
}

/** Conservative current-branch adapter. A clean baseline is mandatory. Changes
 * between baseline and prepare are candidates, NOT proof of AI authorship.
 * Callers must serialize their own editing interval. After prepare, snapshots
 * detect tracked/untracked changes; Git's unavoidable final worktree race remains.
 * Options: timeoutMs, lockTimeoutMs, signal (AbortSignal). No shell is used.
 */
export class GitService {
  constructor({ timeoutMs = 30000, lockTimeoutMs = 2000, signal, excludes, defaultExcludes = true } = {}) {
    this.timeoutMs = timeoutMs; this.lockTimeoutMs = lockTimeoutMs; this.signal = signal;
    this.baseExcludes = excludes || []; this.defaultExcludes = defaultExcludes;
    this.excluded = excludes || !defaultExcludes ? createExcluder(this.baseExcludes, { defaults: defaultExcludes }) : defaultExcluder;
    this.repoExcluders = new Map(); // canonical repo root -> predicate including per-repo patterns
    // Shared across plugin reloads in one process, so an in-flight turn survives a hot reload.
    const shared = globalThis[Symbol.for('tortoisegit-ai.git-tokens')] ||= { baselines: new WeakSet(), prepared: new WeakMap() };
    this.baselines = shared.baselines; this.prepared = shared.prepared;
  }

  /** Per-repository extra patterns (detected toolchains, AI-learned artifacts). */
  setRepoExcludes(root, patterns = []) {
    const key = repoKey(root);
    if (!patterns.length) this.repoExcluders.delete(key);
    else this.repoExcluders.set(key, createExcluder([...this.baseExcludes, ...patterns], { defaults: this.defaultExcludes }));
  }
  excludedFor(root) { return this.repoExcluders.get(repoKey(root)) || this.excluded; }

  async _git(cwd, args, { env = {}, allowFailure = false, signal = this.signal } = {}) {
    if (signal?.aborted) throw issue('cancelled', 'Operation cancelled');
    return new Promise((resolve, reject) => {
      // Ignore inherited repository/index overrides: cwd selects the repository.
      const childEnv = { ...process.env };
      for (const key of Object.keys(childEnv)) if (/^GIT_(?:DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CONFIG_COUNT|CONFIG_KEY_\d+|CONFIG_VALUE_\d+)$/i.test(key)) delete childEnv[key];
      const child = spawn('git', args, { cwd, env: { ...childEnv, GIT_TERMINAL_PROMPT: '0', ...env }, shell: false, windowsHide: true });
      const out = [], err = []; let size = 0; let stopped;
      const stop = code => { stopped ||= code; child.kill(); };
      const timer = setTimeout(() => stop('timeout'), this.timeoutMs);
      const abort = () => stop('cancelled'); signal?.addEventListener('abort', abort, { once: true });
      const clean = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
      child.stdout.on('data', b => { size += b.length; if (size > 32 * 1024 * 1024) stop('output_limit'); else out.push(b); });
      child.stderr.on('data', b => { if (err.reduce((n, x) => n + x.length, 0) < 1024 * 1024) err.push(b); });
      child.on('error', e => { clean(); reject(e); });
      child.on('close', code => {
        clean(); const result = { code, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8') };
        if (stopped) return reject(Object.assign(issue(stopped, `Git ${stopped}; inspect repository state before retrying`), result, { code: stopped }));
        if (code && !allowFailure) return reject(Object.assign(issue('git_failed', result.stderr.trim() || `git exited ${code}`), result, { code: 'git_failed', exitCode: code }));
        resolve(result);
      });
    });
  }

  async _context(cwd) {
    const root = (await this._git(cwd, ['rev-parse', '--show-toplevel'])).stdout.trim();
    const gitDir = (await this._git(root, ['rev-parse', '--absolute-git-dir'])).stdout.trim();
    const common = (await this._git(root, ['rev-parse', '--git-common-dir'])).stdout.trim();
    return { cwd: root, gitDir, commonDir: path.resolve(root, common) };
  }
  async _state(cwd) {
    const branch = (await this._git(cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD'], { allowFailure: true })).stdout.trim() || null;
    const head = (await this._git(cwd, ['rev-parse', '--verify', 'HEAD'], { allowFailure: true })).stdout.trim() || null;
    const raw = (await this._git(cwd, ['status', '--porcelain=v1', '-z', '--untracked-files=all'])).stdout;
    return { branch, head, porcelain: raw, paths: entries(raw) };
  }
  async _operation(ctx) {
    for (const name of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'sequencer']) {
      try { await fs.lstat(path.join(ctx.gitDir, name)); return name; } catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    return null;
  }
  async _snapshot(cwd) {
    const state = await this._state(cwd);
    const files = (await this._git(cwd, ['ls-files', '-z', '--cached', '--others', '--exclude-standard'])).stdout.split('\0').filter(Boolean);
    const hashes = [];
    // Ignored artifacts are neither hashed (large binaries) nor part of the fingerprint,
    // so a concurrent build does not invalidate the AI's commit.
    const excluded = this.excludedFor(cwd);
    for (const name of [...new Set(files)].filter(f => !excluded(f)).sort()) {
      try {
        const p = path.join(cwd, name), stat = await fs.lstat(p);
        if (stat.isDirectory()) { hashes.push([name, 'directory']); continue; }
        hashes.push([name, stat.mode, hash(stat.isSymbolicLink() ? await fs.readlink(p) : await fs.readFile(p))]);
      } catch (e) { if (e.code === 'ENOENT') hashes.push([name, 'missing']); else throw e; }
    }
    // Read-only index signature catches staging changes without acquiring index.lock.
    const indexFingerprint = hash((await this._git(cwd, ['ls-files', '--stage', '-z'])).stdout);
    const tree = state.head ? (await this._git(cwd, ['rev-parse', `${state.head}^{tree}`])).stdout.trim() : null;
    const relevant = state.paths.filter(p => !excluded(p.path));
    return { ...state, tree, indexFingerprint, fingerprint: hash(JSON.stringify([state.branch, state.head, relevant, indexFingerprint, hashes])) };
  }
  async _lock(file, signal = this.signal) {
    const start = Date.now(), token = randomUUID(); let handle;
    while (!handle) {
      if (signal?.aborted) throw issue('cancelled', 'Operation cancelled');
      try { handle = await fs.open(file, 'wx'); } catch (e) {
        if (e.code !== 'EEXIST') throw e;
        if (Date.now() - start >= this.lockTimeoutMs) throw issue('locked', `Repository is busy: ${file}. Stale locks require manual inspection.`);
        await new Promise(r => setTimeout(r, 25));
      }
    }
    await handle.writeFile(token); await handle.close();
    return async () => { try { if ((await fs.readFile(file, 'utf8')) === token) await fs.unlink(file); } catch (e) { if (e.code !== 'ENOENT') throw e; } };
  }
  async _guard(ctx, fn, signal) {
    const unlock = await this._lock(path.join(ctx.commonDir, 'tortoisegit-ai.lock'), signal);
    try { return await fn(); } finally { await unlock(); }
  }

  async baseline(cwd) {
    try {
      const ctx = await this._context(cwd);
      return await this._guard(ctx, async () => {
        const state = await this._state(ctx.cwd), operation = await this._operation(ctx);
        if (!state.branch) return skipped('detached_head', { cwd: ctx.cwd });
        if (operation) return skipped('operation_in_progress', { operation });
        // Anything staged, or any non-ignored change, means the user has work in progress.
        // Changes to ignored build artifacts alone do not block the turn.
        const excluded = this.excludedFor(ctx.cwd);
        const dirty = state.paths.filter(p => (p.code[0] !== ' ' && p.code[0] !== '?') || !excluded(p.path));
        if (dirty.length) return skipped('dirty_baseline', { ...state, cwd: ctx.cwd, dirty: dirty.slice(0, 20).map(p => p.path) });
        const result = Object.freeze({ status: 'ready', ...ctx, ...(await this._snapshot(ctx.cwd)) });
        this.baselines.add(result); return result;
      });
    } catch (e) { return failure(e); }
  }

  /** Re-admit a baseline that was serialized by another process (hook start → hook stop). */
  restoreBaseline(value) {
    if (value?.status !== 'ready' || typeof value.cwd !== 'string' || typeof value.gitDir !== 'string' || typeof value.commonDir !== 'string' || typeof value.fingerprint !== 'string' || typeof value.indexFingerprint !== 'string') return skipped('invalid_baseline');
    const result = Object.freeze({ ...value });
    this.baselines.add(result); return result;
  }

  async prepare(baseline) {
    if (baseline?.status === 'skipped') return baseline;
    if (!this.baselines.has(baseline)) return skipped('invalid_baseline');
    try {
      return await this._guard(baseline, async () => {
        const now = await this._snapshot(baseline.cwd), operation = await this._operation(baseline);
        if (operation) return skipped('operation_in_progress', { operation });
        if (now.head !== baseline.head || now.branch !== baseline.branch) return skipped('head_changed');
        if (now.indexFingerprint !== baseline.indexFingerprint) return skipped('index_changed');
        const excluded = this.excludedFor(baseline.cwd);
        const paths = [...new Set(now.paths.map(p => p.path))].filter(p => !excluded(p));
        const created = now.paths.filter(p => p.code === '??' && paths.includes(p.path)).map(p => p.path);
        if (!paths.length) return skipped(now.paths.length ? 'excluded_only' : 'no_changes');
        let preview = now.head ? (await this._git(baseline.cwd, ['--literal-pathspecs', 'diff', '--no-ext-diff', '--no-textconv', now.head, '--', ...paths])).stdout : '';
        for (const item of now.paths.filter(p => p.code === '??' && paths.includes(p.path))) {
          if (preview.length >= 16000) break;
          const stat = await fs.lstat(path.join(baseline.cwd, item.path));
          if (stat.isSymbolicLink() || !stat.isFile()) continue;
          const file = await fs.open(path.join(baseline.cwd, item.path), 'r');
          try {
            const buf = Buffer.alloc(16000); const { bytesRead } = await file.read(buf, 0, buf.length, 0);
            const data = buf.subarray(0, bytesRead);
            preview += `\nNew file: ${JSON.stringify(item.path)}\n${data.includes(0) ? '[binary]' : data.toString('utf8')}`;
          } finally { await file.close(); }
        }
        const result = Object.freeze({ status: 'ready', cwd: baseline.cwd, head: now.head, branch: now.branch, paths: Object.freeze(paths), created: Object.freeze(created), excluded: now.paths.map(p => p.path).filter(excluded), diff: preview.slice(0, 16000), diffTruncated: preview.length > 16000 });
        this.prepared.set(result, { ctx: baseline, snapshot: now, result: null }); return result;
      });
    } catch (e) { return failure(e); }
  }

  async commit(prepared, message, metadata = {}) {
    if (prepared?.status === 'skipped') return prepared;
    const saved = this.prepared.get(prepared);
    if (!saved) return skipped('invalid_prepared');
    if (saved.result) return { ...saved.result, duplicate: true };
    if (saved.pending) return saved.pending.then(r => r.status === 'committed' ? { ...r, duplicate: true } : r);
    if (typeof message !== 'string' || !message.trim()) return skipped('empty_message');
    saved.pending = this._commit(prepared, saved, message, metadata);
    try { return await saved.pending; } finally { saved.pending = null; }
  }

  async _commit(prepared, saved, message, metadata) {
    const signal = metadata.signal || this.signal;
    try {
      return await this._guard(saved.ctx, async () => {
        if (saved.result) return { ...saved.result, duplicate: true };
        const operation = await this._operation(saved.ctx);
        if (operation) return skipped('operation_in_progress', { operation });
        const now = await this._snapshot(prepared.cwd);
        if (now.head !== prepared.head || now.branch !== prepared.branch) return skipped('head_changed');
        if (now.fingerprint !== saved.snapshot.fingerprint) return skipped('content_changed');
        // Callers may drop newly created files judged to be artifacts; tracked changes cannot be omitted.
        const omit = new Set((metadata.omit || []).filter(p => prepared.created?.includes(p)));
        const paths = prepared.paths.filter(p => !omit.has(p));
        if (!paths.length) return skipped('excluded_only', { omitted: [...omit] });
        const index = path.join(saved.ctx.gitDir, 'index'), indexLock = `${index}.lock`;
        const releaseIndex = await this._lock(indexLock, signal);
        const temp = path.join(saved.ctx.gitDir, `ai-index-${randomUUID()}`), env = { GIT_INDEX_FILE: temp };
        let reconciled = false;
        try {
          await this._git(prepared.cwd, ['read-tree', ...(prepared.head ? [prepared.head] : ['--empty'])], { env, signal });
          // Literal pathspecs prevent filenames beginning with ':' becoming patterns.
          await this._git(prepared.cwd, ['--literal-pathspecs', 'add', '-A', '--', ...paths], { env, signal });
          const unchanged = await this._git(prepared.cwd, ['diff', '--cached', '--quiet', '--no-ext-diff', '--no-textconv', '--'], { env, signal, allowFailure: true });
          if (unchanged.code === 0) return skipped('no_changes');
          if (unchanged.code !== 1) throw issue('git_failed', unchanged.stderr);
          const check = await this._snapshot(prepared.cwd);
          if (check.fingerprint !== saved.snapshot.fingerprint) return skipped(check.head !== prepared.head ? 'head_changed' : 'content_changed');
          const trailers = [['AI-Session', metadata.sessionId], ['AI-Turn', metadata.turnId ?? metadata.turn], ['AI-Model', metadata.model]];
          const suffix = trailers.filter(([, v]) => v != null).map(([k, v]) => `${k}: ${String(v).replace(/[\r\n\0]/g, ' ').trim()}`).join('\n');
          const text = `${message.trim()}${suffix ? `\n\n${suffix}` : ''}`;
          await this._git(prepared.cwd, ['commit', '-m', text], { env, signal });
          // Commit may already be durable even if a later read/reconciliation fails.
          const sha = (await this._git(prepared.cwd, ['rev-parse', 'HEAD'], { env, signal: null })).stdout.trim();
          const parents = (await this._git(prepared.cwd, ['show', '-s', '--format=%P', sha], { signal: null })).stdout.trim();
          saved.result = { status: 'committed', sha, cwd: prepared.cwd, branch: prepared.branch, paths, omitted: [...omit] };
          await this._git(prepared.cwd, ['read-tree', sha], { env, signal: null });
          await fs.copyFile(temp, indexLock); await fs.rename(indexLock, index); reconciled = true;
          if (parents !== (prepared.head || '')) saved.result.warning = 'concurrent_head_change: commit parent differs from baseline; inspect history';
          return saved.result;
        } catch (e) {
          if (saved.result) { saved.result = { ...saved.result, warning: `index_reconciliation_failed: ${e.message}` }; return saved.result; }
          return failure(e);
        } finally {
          if (!reconciled) await releaseIndex();
          await fs.rm(temp, { force: true }); await fs.rm(`${temp}.lock`, { force: true });
        }
      }, signal);
    } catch (e) { return failure(e); }
  }

  /** True when the repository tracks any file under the relative directory. */
  async hasTracked(cwd, dir) {
    const out = (await this._git(cwd, ['--literal-pathspecs', 'ls-files', '-z', '--', dir])).stdout;
    return out.length > 0;
  }

  async status(cwd) {
    try { const ctx = await this._context(cwd); const state = await this._state(ctx.cwd); return { status: 'ok', cwd: ctx.cwd, ...state, clean: !state.paths.length, operation: await this._operation(ctx) }; }
    catch (e) { const f = failure(e); if (/not a git repository/i.test(`${e.stderr || ''} ${e.message}`)) f.noRepo = true; f.cwd = cwd; return f; }
  }

  /** Commit identity Git would use here (global/system config); null fields when missing. */
  async identity(cwd) {
    const get = async key => (await this._git(cwd, ['config', '--get', key], { allowFailure: true })).stdout.trim() || null;
    return { name: await get('user.name'), email: await get('user.email') };
  }

  /**
   * Create a repository in a directory that is not inside one, write .gitignore and
   * make the first commit of everything not ignored. Never touches an existing repo.
   */
  async initRepository(root, { gitignore, message = '初始提交' } = {}) {
    try {
      const inside = await this._git(root, ['rev-parse', '--show-toplevel'], { allowFailure: true });
      if (inside.code === 0) return skipped('already_repository', { cwd: inside.stdout.trim() });
      const who = await this.identity(root);
      if (!who.name || !who.email) return skipped('git_identity_missing');
      const file = path.join(root, '.gitignore');
      let existing = ''; try { existing = await fs.readFile(file, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      if (typeof gitignore === 'string' && gitignore !== existing) await fs.writeFile(file, gitignore, 'utf8');
      await this._git(root, ['init']);
      await this._git(root, ['add', '-A']);
      const staged = (await this._git(root, ['diff', '--cached', '--name-only', '-z'])).stdout.split('\0').filter(Boolean);
      if (!staged.length) return { status: 'initialized', cwd: root, files: 0 };
      await this._git(root, ['commit', '-q', '-m', message]);
      const sha = (await this._git(root, ['rev-parse', 'HEAD'])).stdout.trim();
      const branch = (await this._git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'], { allowFailure: true })).stdout.trim() || null;
      return { status: 'committed', cwd: root, sha, branch, files: staged.length };
    } catch (e) { return failure(e); }
  }
  async log(cwd, { limit = 30, sessionId } = {}) {
    try {
      const ctx = await this._context(cwd), state = await this._state(ctx.cwd);
      if (!state.head) return { status: 'ok', commits: [] };
      const count = Math.max(1, Math.min(500, Number.isFinite(limit) ? Math.floor(limit) : 30));
      const args = ['log', `--max-count=${count}`, '--format=%H%x00%P%x00%an%x00%aI%x00%B%x00', 'HEAD', '--'];
      const parts = (await this._git(ctx.cwd, args)).stdout.split('\0'), commits = [];
      for (let i = 0; i + 4 < parts.length; i += 5) {
        const body = parts[i + 4], session = trailer(body, 'AI-Session');
        if (sessionId != null && session !== String(sessionId)) continue;
        commits.push({ sha: parts[i].trim(), parents: parts[i + 1].split(' ').filter(Boolean), author: parts[i + 2], date: parts[i + 3], message: body.trim(), sessionId: session, turnId: trailer(body, 'AI-Turn'), model: trailer(body, 'AI-Model') });
      }
      return { status: 'ok', commits };
    } catch (e) { return failure(e); }
  }
  async diff(cwd, { commit, maxChars = 100000 } = {}) {
    try {
      const ctx = await this._context(cwd); let args;
      if (commit != null) {
        if (!/^[a-f0-9]{7,64}$/i.test(commit)) return skipped('invalid_commit');
        args = ['show', '--format=', '--no-ext-diff', '--no-textconv', commit, '--'];
      } else args = ['diff', '--no-ext-diff', '--no-textconv', 'HEAD', '--'];
      if (commit == null && !(await this._state(ctx.cwd)).head) args = ['diff', '--cached', '--no-ext-diff', '--no-textconv', '--'];
      const text = (await this._git(ctx.cwd, args)).stdout;
      const cap = Math.max(0, Math.min(1000000, Number.isFinite(maxChars) ? Math.floor(maxChars) : 100000));
      return { status: 'ok', diff: text.slice(0, cap), truncated: text.length > cap };
    } catch (e) { return failure(e); }
  }
  async undo(cwd, sha, sessionId) {
    if (!/^[a-f0-9]{7,64}$/i.test(sha || '') || !sessionId) return skipped('invalid_undo_request');
    try {
      const ctx = await this._context(cwd);
      return await this._guard(ctx, async () => {
        const state = await this._state(ctx.cwd), operation = await this._operation(ctx);
        if (operation) return skipped('operation_in_progress', { operation });
        if (!state.branch) return skipped('detached_head');
        if (state.paths.length) return skipped('dirty_worktree');
        const full = (await this._git(ctx.cwd, ['rev-parse', '--verify', `${sha}^{commit}`])).stdout.trim();
        const reachable = await this._git(ctx.cwd, ['merge-base', '--is-ancestor', full, 'HEAD'], { allowFailure: true });
        if (reachable.code !== 0) return skipped('unreachable_commit');
        const body = (await this._git(ctx.cwd, ['show', '-s', '--format=%B', full])).stdout;
        if (trailer(body, 'AI-Session') !== String(sessionId)) return skipped('session_mismatch');
        const parents = (await this._git(ctx.cwd, ['show', '-s', '--format=%P', full])).stdout.trim().split(' ').filter(Boolean);
        if (parents.length > 1) return skipped('merge_commit');
        const revert = await this._git(ctx.cwd, ['revert', '--no-edit', full], { allowFailure: true });
        if (revert.code) {
          const current = await this._state(ctx.cwd), op = await this._operation(ctx);
          return { status: op || current.paths.some(p => /U|AA|DD/.test(p.code)) ? 'conflict' : 'error', reason: 'revert_failed', error: revert.stderr.trim(), operation: op, paths: current.paths };
        }
        return { status: 'reverted', sha: (await this._state(ctx.cwd)).head, revertedSha: full };
      });
    } catch (e) { return failure(e); }
  }
}

// Only the final trailer paragraph is authoritative; a prose mention is not ownership.
function trailer(body, key) {
  const block = body.trim().split(/\r?\n\s*\r?\n/).at(-1) || '';
  const lines = block.split(/\r?\n/);
  if (!lines.every(line => /^[A-Za-z0-9-]+:\s*.*$/.test(line))) return null;
  const matches = lines.filter(line => line.startsWith(`${key}:`));
  return matches.length === 1 ? matches[0].slice(key.length + 1).trim() : null;
}
