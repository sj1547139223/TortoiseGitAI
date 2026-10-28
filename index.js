import { z } from 'zod';
import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { GitService } from './lib/git.js';
import { generateSummary } from './lib/summary.js';
import { locateTortoiseGit, openTortoiseGit } from './lib/tgit.js';

/**
 * TortoiseGit AI: commits each root-agent turn's own file changes to the current
 * branch with a model-written Chinese summary, and bridges to native TortoiseGit
 * dialogs. Safety: only explicitly allowed repository roots; a turn whose repo was
 * dirty at its first step is never committed; no reset/stash/push; undo = git revert.
 */
export const name = 'tortoisegit-ai';
export const inject = ['tools', 'agents', 'workingDirectory', 'llm', 'webServer', 'connection'];
export const Config = z.object({
  enabled: z.boolean().default(true),
  allowedRoots: z.array(z.string()).default([]),
  tgitPath: z.string().default(''),
  summaryTimeoutMs: z.number().int().min(100).max(15000).default(15000),
  gitTimeoutMs: z.number().int().min(1000).max(120000).default(30000),
});
const Request = z.object({
  action: z.enum(['status', 'log', 'diff', 'open', 'pause', 'resume', 'undo']),
  command: z.enum(['log', 'showcompare', 'repostatus', 'diff', 'blame', 'revisiongraph']).optional(),
  sha: z.string().regex(/^[a-f0-9]{7,64}$/i).optional(),
  path: z.string().max(2000).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  confirm: z.boolean().optional(),
}).strict();
const ROUTE_STATUS = '/api/tortoisegit-ai.status';
const ROUTE_ACTION = '/api/tortoisegit-ai.action';
const keyOf = value => process.platform === 'win32' ? value.toLowerCase() : value;
const message = error => String(error?.message || error).slice(0, 1000);
const textOf = messages => (messages || []).flatMap(m => Array.isArray(m?.content) ? m.content : [])
  .filter(b => b?.type === 'text' && typeof b.text === 'string').map(b => b.text).join('\n').slice(0, 2000);

export function apply(ctx, rawConfig) {
  const config = Config.parse(rawConfig || {});
  const shutdown = new AbortController();
  const git = new GitService({ timeoutMs: config.gitTimeoutMs, signal: shutdown.signal });
  /** Per-session state: preference, baseline of the current editing interval, outcomes. */
  const states = new Map();
  const running = new Map(); // agent id -> canonical cwd key while that agent runs
  const pending = new Set();
  let discovery;
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
  /** Resolve the agent's repository top level and require it to be an allowed root. */
  const repoOf = async (agent, signal) => {
    const cwd = await ctx.workingDirectory.ensure(agent, signal);
    const status = await git.status(cwd);
    if (status.status !== 'ok') return { status };
    const top = keyOf(await realpath(status.cwd));
    if (!(await allowedRoots()).includes(top)) return { status: { status: 'skipped', reason: 'repository_not_authorized', cwd: status.cwd } };
    return { cwd: status.cwd, key: top, status };
  };
  const othersRunning = (self, key) => [...running].some(([id, k]) => id !== self && k === key);

  async function start(agent, payload) {
    const s = stateOf(agent.id);
    if (s.baseline || !s.enabled || !config.enabled || !isRoot(agent)) return;
    const repo = await repoOf(agent, payload.signal);
    if (repo.key) running.set(agent.id, repo.key);
    if (!repo.cwd) return; // not a repo / not authorized: silently out of scope
    const baseline = await git.baseline(repo.cwd);
    if (baseline.status !== 'ready') { record(agent.id, { status: 'skipped', reason: baseline.reason, turn: payload.turn }); s.baseline = { skipped: true }; return; }
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
      const summary = await generateSummary({ llm: ctx.llm, route, sessionId: agent.id, request: s.request, diff: prepared.diff, paths: prepared.paths, timeoutMs: config.summaryTimeoutMs, signal: AbortSignal.any([signal, shutdown.signal]) });
      const result = await git.commit(prepared, summary.message, { sessionId: agent.id, turn, model: route?.model, signal: AbortSignal.any([signal, shutdown.signal]) });
      record(agent.id, { ...result, turn, summary: summary.message, summarySource: summary.source, summaryFallbackReason: summary.reason });
    } catch (error) { record(agent.id, { status: 'error', reason: message(error), turn }); }
  }

  async function operate(agent, raw, signal) {
    const args = Request.parse(raw);
    const s = stateOf(agent.id);
    if (args.action === 'pause' || args.action === 'resume') {
      s.enabled = args.action === 'resume';
      if (!s.enabled) s.baseline = null;
      return { ok: true, enabled: s.enabled };
    }
    const repo = await repoOf(agent, signal);
    if (args.action === 'status') {
      return { ok: true, enabled: s.enabled && config.enabled, running: running.has(agent.id), git: repo.status,
        history: repo.cwd ? await git.log(repo.cwd, { limit: args.limit || 20, sessionId: agent.id }) : { status: 'ok', commits: [] },
        outcomes: s.outcomes.slice(0, 10), tgitPath: await executable() };
    }
    if (!repo.cwd) return repo.status;
    if (args.action === 'log') return git.log(repo.cwd, { limit: args.limit || 30, sessionId: agent.id });
    if (args.action === 'diff') return git.diff(repo.cwd, { commit: args.sha, maxChars: 16000 });
    if (args.action === 'open') return openTortoiseGit({ executable: await executable(), cwd: repo.cwd, command: args.command || 'log', sha: args.sha, file: args.path, sessionId: agent.id });
    if (args.action === 'undo') {
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
      send(res, 200, await operate(agentFor(session), args));
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
  const epochs = new Map();
  ctx.on('agent/status', ({ agent, status }) => {
    if (!agent) return;
    const epoch = (epochs.get(agent.id) || 0) + 1; epochs.set(agent.id, epoch);
    if (status === 'running') watch(topKey(agent).then(k => { if (epochs.get(agent.id) === epoch) running.set(agent.id, k); })).catch(() => {});
    else { running.delete(agent.id); if (states.has(agent.id)) states.get(agent.id).baseline = null; }
  });
  ctx.on('agent/disposed', ({ agent }) => { running.delete(agent.id); states.delete(agent.id); });
  ctx.effect(() => async () => { shutdown.abort(); await Promise.allSettled([...pending]); });
}

export const _internal = { textOf, keyOf, path };
