import { z } from 'zod';
import { realpath, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { GitService } from './lib/git.js';
import { generateSummary, withTool } from './lib/summary.js';
import { detectProfiles } from './lib/detect.js';
import { buildPlan, planTotals, gitignoreText, manualGitignore, normalizeSelection, initBlockedReason, isCodeFile, listDirs } from './lib/init.js';
import { locateTortoiseGit, openTortoiseGit } from './lib/tgit.js';

/**
 * TortoiseGit AI: commits each root-agent turn's own file changes to the current
 * branch with a model-written Chinese summary, and bridges to native TortoiseGit
 * dialogs. Safety: only explicitly allowed repository roots; a turn whose repo was
 * dirty at its first step is never committed; no reset/stash/push; undo = git revert.
 */
export const name = 'tortoisegit-ai';
export const inject = ['tools', 'agents', 'workingDirectory', 'llm', 'webServer', 'connection', 'storageDomain'];
const TOOL_NAME = 'DSH'; // commit subject prefix: which coding tool made the change

export const Config = z.object({
  enabled: z.boolean().default(true),
  allowedRoots: z.array(z.string()).default([]),
  tgitPath: z.string().default(''),
  summaryTimeoutMs: z.number().int().min(100).max(15000).default(15000),
  gitTimeoutMs: z.number().int().min(1000).max(120000).default(30000),
  /** Extra gitignore-style patterns never auto-committed (on top of .gitignore and the built-in artifact list). */
  excludes: z.array(z.string()).default([]),
  /** Use the built-in build-artifact list (Keil/IAR/GCC objects, Objects/, Listings/, *.uvguix.* …). */
  defaultExcludes: z.boolean().default(true),
});
const Request = z.object({
  action: z.enum(['status', 'log', 'diff', 'open', 'pause', 'resume', 'undo', 'enableRepo', 'disableRepo', 'forgetExclude', 'redetect', 'listDirs', 'planRepo', 'planPreview', 'initRepo', 'codeOnly']),
  dir: z.string().max(1000).optional(),
  planId: z.string().uuid().optional(),
  mode: z.enum(['code', 'all', 'manual']).optional(),
  selection: z.array(z.object({ dir: z.string().max(1000), include: z.boolean().optional(), auto: z.boolean() }).strict()).max(1500).optional(),
  checked: z.array(z.string().max(12)).max(1000).optional(),
  pattern: z.string().max(500).optional(),
  command: z.enum(['log', 'showcompare', 'repostatus', 'diff', 'blame', 'revisiongraph']).optional(),
  sha: z.string().regex(/^[a-f0-9]{7,64}$/i).optional(),
  path: z.string().max(2000).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  confirm: z.boolean().optional(),
}).strict();
/** Persistent per-repository opt-in (key = canonical repository root). */
const RepoRecord = z.object({
  enabled: z.boolean(), path: z.string(), updatedAt: z.number(),
  profiles: z.array(z.object({ id: z.string(), label: z.string(), dir: z.string() })).optional(), // detected toolchains
  detected: z.array(z.string()).optional(), // patterns from detected toolchains
  learned: z.array(z.string()).optional(), // patterns the model judged to be artifacts
  detectedAt: z.number().optional(),
});
const REPOS_DOMAIN = { name: 'tortoisegit_ai', version: 1, tables: { repos: { valueSchema: RepoRecord } } };
const UI_ONLY = new Set(['enableRepo', 'disableRepo', 'forgetExclude', 'redetect', 'listDirs', 'planRepo', 'planPreview', 'initRepo', 'codeOnly']);
const PLAN_TTL_MS = 15 * 60 * 1000;
const DETECT_TTL_MS = 10 * 60 * 1000;
const ROUTE_STATUS = '/api/tortoisegit-ai.status';
const ROUTE_ACTION = '/api/tortoisegit-ai.action';
const keyOf = value => process.platform === 'win32' ? value.toLowerCase() : value;
const message = error => String(error?.message || error).slice(0, 1000);
const textOf = messages => (messages || []).flatMap(m => Array.isArray(m?.content) ? m.content : [])
  .filter(b => b?.type === 'text' && typeof b.text === 'string').map(b => b.text).join('\n').slice(0, 2000);

export function apply(ctx, rawConfig) {
  const config = Config.parse(rawConfig || {});
  const shutdown = new AbortController();
  const git = new GitService({ timeoutMs: config.gitTimeoutMs, signal: shutdown.signal, excludes: config.excludes, defaultExcludes: config.defaultExcludes });
  /** Per-session state: preference, baseline of the current editing interval, outcomes.
   * Kept on globalThis so a plugin hot reload during a turn does not lose the baseline. */
  const shared = globalThis[Symbol.for('tortoisegit-ai.runtime')] ||= { states: new Map(), running: new Map(), epochs: new Map() };
  const states = shared.states;
  const running = shared.running; // agent id -> canonical cwd key while that agent runs
  const pending = new Set();
  let discovery;
  const domain = ctx.storageDomain.open(REPOS_DOMAIN);
  domain.catch(() => {});
  const table = async () => (await domain).table('repos');
  const idOf = key => createHash('sha256').update(key).digest('hex').slice(0, 32); // storage-safe key
  const repoTable = async () => { const t = await table(); return { get: key => t.get(idOf(key)), put: (key, value) => t.put(idOf(key), value) }; };
  const applyExcludes = (root, rec) => git.setRepoExcludes(root, [...(rec?.detected || []), ...(rec?.learned || [])]);
  /** Detect toolchains for an enabled repo (cached), persist, and install its exclusion patterns. */
  async function refreshRepo(repo, { force = false } = {}) {
    const t = await repoTable();
    let rec = t.get(repo.key);
    if (!rec && repo.authorized) rec = { enabled: true, path: repo.cwd, updatedAt: Date.now() }; // enabled via allowedRoots
    if (!rec?.enabled) return rec;
    if (force || !rec.detectedAt || Date.now() - rec.detectedAt > DETECT_TTL_MS) {
      const found = await detectProfiles(repo.cwd);
      rec = { ...rec, profiles: found.profiles, detected: found.patterns, detectedAt: Date.now() };
      await t.put(repo.key, rec);
    }
    applyExcludes(repo.cwd, rec);
    return rec;
  }
  /** Turn model-flagged new files into durable patterns: a whole new directory when
   * every new file in it was flagged and it holds no tracked file, else the exact path. */
  async function learn(cwd, key, generated, created) {
    if (!generated.length) return [];
    const flagged = new Set(generated), patterns = new Set();
    for (const file of generated) {
      const dir = path.posix.dirname(file);
      if (dir !== '.' && created.filter(f => f.startsWith(`${dir}/`)).every(f => flagged.has(f)) && !(await git.hasTracked(cwd, dir))) patterns.add(`/${dir}/`);
      else patterns.add(`/${file}`);
    }
    const t = await repoTable(), rec = t.get(key) || { enabled: true, path: cwd, updatedAt: Date.now() };
    const learned = [...new Set([...(rec.learned || []), ...patterns])].slice(-500);
    const next = { ...rec, learned, updatedAt: Date.now() };
    await t.put(key, next); applyExcludes(cwd, next);
    return [...patterns];
  }
  const executable = () => discovery ||= locateTortoiseGit(config.tgitPath);
  const stateOf = id => { let s = states.get(id); if (!s) states.set(id, s = { enabled: config.enabled, baseline: null, request: '', outcomes: [] }); return s; };
  const record = (id, value) => {
    const s = stateOf(id), entry = { ...value, timestamp: Date.now() };
    s.outcomes.unshift(entry); s.outcomes.length = Math.min(s.outcomes.length, 30); return entry;
  };
  const watch = promise => { pending.add(promise); promise.finally(() => pending.delete(promise)).catch(() => {}); return promise; };
  const isRoot = agent => ctx.agents.roots().some(a => a.id === agent.id);
  const allowedRoots = async () => {
    const out = [];
    for (const root of config.allowedRoots) { try { out.push(keyOf(await realpath(root))); } catch { /* missing roots are not authorized */ } }
    return out;
  };
  /** A stored per-repo choice wins; otherwise the configured allowedRoots decide. */
  const isAuthorized = async key => {
    const stored = (await repoTable()).get(key);
    if (stored) return stored.enabled;
    return (await allowedRoots()).includes(key);
  };
  /** Resolve the agent's repository top level and whether auto-commit is enabled there. */
  const repoOf = async (agent, signal) => {
    const cwd = await ctx.workingDirectory.ensure(agent, signal);
    const status = await git.status(cwd);
    if (status.status !== 'ok') return { status };
    const key = keyOf(await realpath(status.cwd));
    return { cwd: status.cwd, key, status, authorized: await isAuthorized(key) };
  };
  const plans = new Map(); // session id -> pending one-click repository plan
  const planView = plan => {
    const checked = new Set(plan.entries.filter(e => e.checked).map(e => e.id));
    const view = mode => { const x = planTotals(plan, checked, mode); return { keptFiles: x.keptFiles, keptBytes: x.keptBytes, extensions: x.extensions }; };
    return { planId: plan.id, root: plan.root, profiles: plan.profiles, ai: plan.ai, totalFiles: plan.files.length, totalBytes: plan.files.reduce((n, f) => n + f.size, 0),
      modes: { code: view('code'), all: view('all') }, tree: plan.tree, selection: plan.selection, skipped: plan.skipped || [], skippedCount: plan.skippedCount || 0,
      entries: plan.entries.map(({ id, pattern, source, reason, locked, checked: on, files, bytes, sourceFiles, codeFiles, sample }) => ({ id, pattern: pattern === '(sensitive)' ? '.env / 密钥' : pattern, source, reason, locked, checked: on, files, bytes, sourceFiles, codeFiles, sample })) };
  };
  const othersRunning = (self, key) => [...running].some(([id, k]) => id !== self && k === key);

  async function start(agent, payload) {
    const s = stateOf(agent.id);
    if (s.baseline || !s.enabled || !config.enabled || !isRoot(agent)) return;
    const repo = await repoOf(agent, payload.signal);
    if (repo.key) running.set(agent.id, repo.key);
    if (!repo.cwd || !repo.authorized) return; // not a repo / not enabled: silently out of scope
    try { await refreshRepo(repo); } catch (e) { record(agent.id, { status: 'warning', reason: `detect_failed: ${message(e)}` }); }
    const baseline = await git.baseline(repo.cwd);
    if (baseline.status !== 'ready') { record(agent.id, { status: 'skipped', reason: baseline.dirty?.length ? `${baseline.reason}: ${baseline.dirty.slice(0, 5).join(', ')}${baseline.dirty.length > 5 ? ' …' : ''}` : baseline.reason, turn: payload.turn }); s.baseline = { skipped: true }; return; }
    s.baseline = baseline; s.request = textOf(payload.messages);
  }

  async function stop(agent, { turn, signal }) {
    const s = stateOf(agent.id), baseline = s.baseline;
    s.baseline = null; // the next step (steering) or turn takes a fresh baseline
    if (!baseline || baseline.skipped) return;
    if (!s.enabled || !config.enabled) return record(agent.id, { status: 'skipped', reason: 'paused', turn });
    try {
      const key = keyOf(await realpath(baseline.cwd));
      if (othersRunning(agent.id, key)) return record(agent.id, { status: 'skipped', reason: 'other_agent_active', turn });
      const prepared = await git.prepare(baseline);
      if (prepared.status !== 'ready') return record(agent.id, { ...prepared, turn });
      const route = agent.session?.requestHeader?.()?.config;
      const candidates = (prepared.created || []).slice(0, 200);
      const summary = await generateSummary({ llm: ctx.llm, route, sessionId: agent.id, request: s.request, diff: prepared.diff, paths: prepared.paths, candidates, timeoutMs: config.summaryTimeoutMs, signal: AbortSignal.any([signal, shutdown.signal]) });
      const omit = summary.generated || [];
      const subject = withTool(summary.message, TOOL_NAME);
      const result = await git.commit(prepared, subject, { sessionId: agent.id, turn, model: route?.model, tool: TOOL_NAME, omit, signal: AbortSignal.any([signal, shutdown.signal]) });
      // Learn only after the commit: changing patterns earlier would invalidate the prepared snapshot.
      const learned = result.status === 'committed' || result.reason === 'excluded_only' ? await learn(baseline.cwd, key, omit, prepared.created || []).catch(() => []) : [];
      record(agent.id, { ...result, turn, summary: subject, summarySource: summary.source, summaryFallbackReason: summary.reason, learned });
    } catch (error) { record(agent.id, { status: 'error', reason: message(error), turn }); }
  }

  async function operate(agent, raw, signal, { ui = false } = {}) {
    const args = Request.parse(raw);
    if (UI_ONLY.has(args.action) && !ui) throw new Error('only the user can enable or disable a repository (TortoiseGit AI pill)');
    const s = stateOf(agent.id);
    if (args.action === 'pause' || args.action === 'resume') {
      s.enabled = args.action === 'resume';
      if (!s.enabled) s.baseline = null;
      return { ok: true, enabled: s.enabled };
    }
    const repo = await repoOf(agent, signal);
    // A folder can be set up when it is not in a repository, or is the root of an empty one (no commit yet).
    const emptyRepo = !!(repo.cwd && repo.status?.status === 'ok' && !repo.status.head);
    const initable = async () => {
      if (repo.status?.noRepo) return true;
      if (!emptyRepo) return false;
      return keyOf(path.resolve(await ctx.workingDirectory.ensure(agent, signal))) === keyOf(path.resolve(repo.cwd));
    };
    if (args.action === 'planRepo') {
      if (!(await initable())) return repo.cwd ? { status: 'error', reason: 'already_repository' } : repo.status;
      const root = await ctx.workingDirectory.ensure(agent, signal);
      const route = agent.session?.requestHeader?.()?.config;
      const plan = await buildPlan(root, { llm: ctx.llm, route, sessionId: agent.id, signal, timeoutMs: 25000, selection: args.selection || null });
      if (plan.status !== 'ready') return { status: 'error', reason: plan.reason, files: plan.files };
      if (plan.selection) plan.tree = []; // the folder picker already showed the tree
      plans.set(agent.id, plan);
      return { ok: true, ...planView(plan) };
    }
    if (args.action === 'listDirs') {
      if (!(await initable())) return { status: 'error', reason: 'already_repository' };
      const root = await ctx.workingDirectory.ensure(agent, signal);
      return { ok: true, ...(await listDirs(root, args.dir || '')) };
    }
    if (args.action === 'planPreview') {
      const plan = plans.get(agent.id);
      if (!plan || plan.id !== args.planId) return { status: 'error', reason: 'plan_expired' };
      const x = plan.selection ? planTotals(plan, new Set(args.checked || []), 'manual', plan.selection) : planTotals(plan, new Set(args.checked || []), args.mode || 'code', args.selection || []);
      return { ok: true, keptFiles: x.keptFiles, keptBytes: x.keptBytes, extensions: x.extensions, large: x.large.slice(0, 5) };
    }
    if (args.action === 'initRepo') {
      const plan = plans.get(agent.id);
      if (!plan || plan.id !== args.planId || Date.now() - plan.createdAt > PLAN_TTL_MS) return { status: 'error', reason: 'plan_expired' };
      if (!(await initable())) return { status: 'error', reason: 'already_repository' };
      const root = await ctx.workingDirectory.ensure(agent, signal);
      if (keyOf(path.resolve(root)) !== keyOf(path.resolve(plan.root))) return { status: 'error', reason: 'plan_expired' };
      if (running.has(agent.id)) return { status: 'error', reason: 'agent_running' };
      const mode = plan.selection ? 'manual' : (args.mode || 'code');
      const chosen = plan.selection || args.selection || [];
      if (mode === 'manual' && !normalizeSelection(chosen, plan.selection ? null : plan).some(x => x.include)) return { status: 'error', reason: 'nothing_selected' };
      const totals = planTotals(plan, new Set(args.checked || []), mode, chosen);
      if (!totals.keptFiles) return { status: 'error', reason: 'nothing_to_commit' };
      const huge = plan.files.filter(f => f.size >= 100 * 1024 * 1024 && totals.kept.has(f.path));
      if (huge.length) return { status: 'error', reason: `file_too_large: ${huge.slice(0, 3).map(f => f.path).join(', ')}` };
      let existing = ''; try { existing = await readFile(path.join(root, '.gitignore'), 'utf8'); } catch { /* none yet */ }
      const result = await git.initRepository(root, { gitignore: mode === 'manual' ? manualGitignore(totals.entries, normalizeSelection(chosen, plan.selection ? null : plan), existing) : gitignoreText(totals.entries, existing, mode), message: '初始提交（TortoiseGit AI 一键建仓）' });
      if (result.status !== 'committed' && result.status !== 'initialized') return result;
      plans.delete(agent.id); s.baseline = null;
      const created = await repoOf(agent, signal);
      if (created.key) { const t = await repoTable(); await t.put(created.key, { ...t.get(created.key), enabled: true, path: created.cwd, updatedAt: Date.now() }); await refreshRepo({ ...created, authorized: true }, { force: true }); }
      return { ok: true, ...result, authorized: true };
    }
    if (args.action === 'codeOnly') {
      if (!repo.cwd) return repo.status;
      if (running.has(agent.id)) return { status: 'error', reason: 'agent_running' };
      let existing = ''; try { existing = await readFile(path.join(repo.cwd, '.gitignore'), 'utf8'); } catch { /* none */ }
      const nonCode = (await git.trackedFiles(repo.cwd)).filter(f => !isCodeFile(f));
      const whitelisted = existing.split(/\r?\n/).some(l => l.trim() === '!*/');
      if (!args.confirm) return { ok: true, preview: true, files: nonCode.length, sample: nonCode.slice(0, 12), whitelisted };
      if (!nonCode.length && whitelisted) return { ok: true, status: 'no_changes' };
      return git.untrack(repo.cwd, { files: nonCode, gitignore: gitignoreText([], existing, 'code'), message: '仅保留代码相关文件（文档等停止跟踪，文件仍在磁盘）' });
    }
    if (args.action === 'enableRepo' || args.action === 'disableRepo') {
      if (!repo.cwd) return repo.status;
      const enabled = args.action === 'enableRepo';
      const t = await repoTable(), prev = t.get(repo.key);
      await t.put(repo.key, { ...prev, enabled, path: repo.cwd, updatedAt: Date.now() });
      if (!enabled) { s.baseline = null; git.setRepoExcludes(repo.cwd, []); return { ok: true, authorized: false, repo: repo.cwd }; }
      const rec = await refreshRepo(repo, { force: true });
      return { ok: true, authorized: true, repo: repo.cwd, profiles: rec?.profiles || [] };
    }
    if (args.action === 'redetect') {
      if (!repo.authorized) return { status: 'error', reason: 'repository_not_enabled' };
      const rec = await refreshRepo(repo, { force: true });
      return { ok: true, profiles: rec?.profiles || [], detected: rec?.detected || [] };
    }
    if (args.action === 'forgetExclude') {
      const t = await repoTable(), rec = t.get(repo.key);
      if (!rec || !args.pattern) return { status: 'error', reason: 'nothing_to_forget' };
      const next = { ...rec, learned: (rec.learned || []).filter(p => p !== args.pattern), updatedAt: Date.now() };
      await t.put(repo.key, next); applyExcludes(repo.cwd, next);
      return { ok: true, learned: next.learned };
    }
    if (args.action === 'status') {
      const rec = repo.key ? (await repoTable()).get(repo.key) : undefined;
      return { ok: true, enabled: s.enabled && config.enabled, authorized: !!repo.authorized, running: running.has(agent.id), git: repo.status,
        ...(repo.status?.noRepo ? { noRepo: true, cwd: repo.status.cwd, initBlocked: initBlockedReason(repo.status.cwd) }
          : emptyRepo && await initable() ? { noRepo: true, emptyRepo: true, cwd: repo.cwd, initBlocked: initBlockedReason(repo.cwd) } : {}),
        rules: { profiles: rec?.profiles || [], detected: rec?.detected || [], learned: rec?.learned || [], custom: config.excludes, builtIn: config.defaultExcludes },
        history: repo.cwd ? await git.log(repo.cwd, { limit: args.limit || 20, sessionId: agent.id }) : { status: 'ok', commits: [] },
        outcomes: s.outcomes.slice(0, 10), tgitPath: await executable() };
    }
    if (!repo.cwd) return repo.status;
    if (args.action === 'log') return git.log(repo.cwd, { limit: args.limit || 30, sessionId: agent.id });
    if (args.action === 'diff') return git.diff(repo.cwd, { commit: args.sha, maxChars: 16000 });
    if (args.action === 'open') return openTortoiseGit({ executable: await executable(), cwd: repo.cwd, command: args.command || 'log', sha: args.sha, file: args.path, sessionId: agent.id });
    if (args.action === 'undo') {
      if (!repo.authorized) throw new Error('repository_not_enabled');
      if (!args.sha || args.confirm !== true) throw new Error('undo requires sha and confirm:true after an explicit user request');
      if (othersRunning(agent.id, repo.key)) throw new Error('other_agent_active: another agent is editing this repository');
      const result = await git.undo(repo.cwd, args.sha, agent.id);
      s.baseline = null; // HEAD moved; the next step re-baselines
      return record(agent.id, { ...result, action: 'undo' });
    }
    return { status: 'error', reason: 'unknown_action' };
  }

  // ---- Agent tool -------------------------------------------------------
  ctx.effect(() => ctx.tools.register({
    name: 'tgit_ai',
    description: 'TortoiseGit AI history for this session. Every turn that edits files in an allowed repository is committed automatically when the turn ends (current branch, AI-written Chinese summary, AI-Session/AI-Turn trailers) — never commit those changes yourself. Actions: status | log {limit} | diff {sha} (bounded text diff) | open {command: log|showcompare|repostatus|diff|blame|revisiongraph, sha?, path?} opens a native TortoiseGit window for the user | pause / resume auto-commit | undo {sha, confirm:true} creates a git revert of one of this session\'s AI commits — only when the user explicitly asks.',
    parameters: {
      type: 'object', additionalProperties: false, required: ['action'],
      properties: {
        action: { type: 'string', enum: ['status', 'log', 'diff', 'open', 'pause', 'resume', 'undo'] },
        command: { type: 'string', enum: ['log', 'showcompare', 'repostatus', 'diff', 'blame', 'revisiongraph'], description: 'Dialog for action=open.' },
        sha: { type: 'string', description: 'Commit hash (7-64 hex).' },
        path: { type: 'string', description: 'Repository-relative file for open diff/blame.' },
        limit: { type: 'integer', minimum: 1, maximum: 100 },
        confirm: { type: 'boolean', description: 'Must be true for undo, after the user asked.' },
      },
    },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    async execute(args, exec) {
      if (!exec?.agent) throw new Error('tgit_ai requires an agent session');
      return JSON.stringify(await operate(exec.agent, args, exec.signal));
    },
  }));

  // ---- Authenticated browser routes for the composer panel ---------------
  const send = (res, status, payload) => { res.statusCode = status; res.setHeader('content-type', 'application/json; charset=utf-8'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(payload)); };
  const rejected = (req, res) => { const code = Reflect.get(ctx, 'connection').requestRejection(req); if (code === undefined) return false; res.statusCode = code; res.end(); return true; };
  const agentFor = id => { const agent = typeof id === 'string' ? ctx.agents.get(id) : undefined; if (!agent) throw Object.assign(new Error('session is not live'), { http: 404 }); return agent; };
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: ROUTE_STATUS, handler: async (req, res) => {
    if (rejected(req, res)) return;
    if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('allow', 'GET'); return res.end(); }
    try { send(res, 200, await operate(agentFor(new URL(String(req.url), 'http://localhost').searchParams.get('session')), { action: 'status' })); }
    catch (error) { send(res, error.http || 500, { ok: false, reason: message(error) }); }
  } }));
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: ROUTE_ACTION, handler: async (req, res) => {
    if (rejected(req, res)) return;
    if (req.method !== 'POST') { res.statusCode = 405; res.setHeader('allow', 'POST'); return res.end(); }
    if (String(req.headers['content-type']).split(';', 1)[0].trim().toLowerCase() !== 'application/json') return send(res, 415, { ok: false, reason: 'content-type must be application/json' });
    try {
      const chunks = []; let size = 0;
      for await (const c of req) { size += c.length; if (size > 16384) return send(res, 413, { ok: false, reason: 'too large' }); chunks.push(c); }
      const { session, ...args } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      send(res, 200, await operate(agentFor(session), args, undefined, { ui: true }));
    } catch (error) { send(res, error.http || 400, { ok: false, reason: message(error) }); }
  } }));

  // ---- Lifecycle hooks ------------------------------------------------------
  // Agent events are dispatched through the root context with payload.agent.
  const topKey = async agent => {
    const cwd = await ctx.workingDirectory.ensure(agent);
    const status = await git.status(cwd);
    return keyOf(await realpath(status.status === 'ok' ? status.cwd : cwd));
  };
  ctx.on('agent/pre-step', async (payload, next) => {
    await watch(start(payload.agent, payload)).catch(e => record(payload.agent.id, { status: 'error', reason: message(e), turn: payload.turn }));
    return next();
  });
  ctx.on('agent/turn-stopping', payload => watch(stop(payload.agent, payload)).catch(() => {}));
  const epochs = shared.epochs;
  ctx.on('agent/status', ({ agent, status }) => {
    if (!agent) return;
    const epoch = (epochs.get(agent.id) || 0) + 1; epochs.set(agent.id, epoch);
    if (status === 'running') watch(topKey(agent).then(k => { if (epochs.get(agent.id) === epoch) running.set(agent.id, k); })).catch(() => {});
    else { running.delete(agent.id); if (states.has(agent.id)) states.get(agent.id).baseline = null; }
  });
  ctx.on('agent/disposed', ({ agent }) => { running.delete(agent.id); states.delete(agent.id); });
  ctx.effect(() => async () => { shutdown.abort(); await Promise.allSettled([...pending]); try { await (await domain).close(); } catch { /* closed by the facility */ } });
}

export const _internal = { textOf, keyOf, path };
