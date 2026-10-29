#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { createRuntime } from './runtime.js';
import { openTortoiseGit } from '../lib/tgit.js';
import * as store from './store.js';

/** Minimal stdio MCP server exposing the same `tgit_ai` tool as the DSH plugin. */
const ACTIONS = ['status', 'log', 'diff', 'open', 'pause', 'resume', 'undo'];
const COMMANDS = ['log', 'showcompare', 'repostatus', 'diff', 'blame', 'revisiongraph'];
export const TOOL = {
  name: 'tgit_ai',
  description: 'TortoiseGit AI history for this session. Every turn that edits files in an enabled repository is committed automatically when the turn ends (current branch, AI-written Chinese summary, AI-Session/AI-Turn trailers) — never commit those changes yourself. Actions: status | log {limit} | diff {sha} (bounded text diff) | open {command: log|showcompare|repostatus|diff|blame|revisiongraph, sha?, path?} opens a native TortoiseGit window for the user | pause / resume auto-commit | undo {sha, confirm:true} creates a git revert of one of this session\'s AI commits — only when the user explicitly asks. Enabling a repository is done by the user, not by this tool.',
  inputSchema: {
    type: 'object', additionalProperties: false, required: ['action'],
    properties: {
      action: { type: 'string', enum: ACTIONS },
      command: { type: 'string', enum: COMMANDS, description: 'Dialog for action=open.' },
      sha: { type: 'string', description: 'Commit hash (7-64 hex).' },
      path: { type: 'string', description: 'Repository-relative file for open diff/blame.' },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
      confirm: { type: 'boolean', description: 'Must be true for undo, after the user asked.' },
    },
  },
};

function validate(args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('arguments must be an object');
  for (const k of Object.keys(args)) if (!(k in TOOL.inputSchema.properties)) throw new Error(`unknown argument: ${k}`);
  if (!ACTIONS.includes(args.action)) throw new Error('only the user can enable or disable a repository; valid actions: ' + ACTIONS.join(', '));
  if (args.command != null && !COMMANDS.includes(args.command)) throw new Error('invalid command');
  if (args.sha != null && !/^[a-f0-9]{7,64}$/i.test(args.sha)) throw new Error('invalid sha');
  if (args.path != null && (typeof args.path !== 'string' || args.path.length > 2000)) throw new Error('invalid path');
  if (args.limit != null && !(Number.isInteger(args.limit) && args.limit >= 1 && args.limit <= 100)) throw new Error('invalid limit');
  if (args.confirm != null && typeof args.confirm !== 'boolean') throw new Error('invalid confirm');
  return args;
}

/** The Droid session behind this server: the most recent hook-recorded session in the same repository. */
async function currentSession(rt, cwd) {
  const sessions = await store.listSessions();
  const repo = await rt.repoOf(cwd);
  const mine = repo.key ? sessions.find(s => s.repoKey === repo.key || (s.cwd && store.keyOf(s.cwd) === store.keyOf(cwd))) : undefined;
  return { repo, session: mine || sessions[0] || null };
}

export async function operate(raw, { cwd = process.env.FACTORY_PROJECT_DIR || process.cwd(), runtime } = {}) {
  const args = validate(raw);
  const rt = runtime || await createRuntime();
  const { repo: here, session } = await currentSession(rt, cwd);
  const repo = here.cwd ? here : session?.cwd ? await rt.repoOf(session.cwd) : here;
  const id = session?.id;
  if (args.action === 'pause' || args.action === 'resume') {
    if (!session) return { status: 'error', reason: 'no_active_session' };
    session.enabled = args.action === 'resume';
    if (!session.enabled) session.baseline = null;
    await store.putSession(id, session);
    return { ok: true, enabled: session.enabled };
  }
  if (args.action === 'status') {
    const rec = repo.key ? await store.getRepo(repo.key) : undefined;
    return { ok: true, sessionId: id || null, enabled: (session?.enabled ?? true) && rt.config.enabled, authorized: !!repo.authorized, running: !!(session?.baseline && !session.baseline.skipped), git: repo.status,
      rules: { profiles: rec?.profiles || [], detected: rec?.detected || [], learned: rec?.learned || [], custom: rt.config.excludes, builtIn: rt.config.defaultExcludes },
      history: repo.cwd && id ? await rt.git.log(repo.cwd, { limit: args.limit || 20, sessionId: id }) : { status: 'ok', commits: [] },
      outcomes: (session?.outcomes || []).slice(0, 10), tgitPath: await rt.executable() };
  }
  if (!repo.cwd) return repo.status;
  if (args.action === 'log') return rt.git.log(repo.cwd, { limit: args.limit || 30, sessionId: id });
  if (args.action === 'diff') return rt.git.diff(repo.cwd, { commit: args.sha, maxChars: 16000 });
  if (args.action === 'open') return openTortoiseGit({ executable: await rt.executable(), cwd: repo.cwd, command: args.command || 'log', sha: args.sha, file: args.path, sessionId: id });
  if (args.action === 'undo') {
    if (!repo.authorized) throw new Error('repository_not_enabled');
    if (!id) throw new Error('no_active_session');
    if (!args.sha || args.confirm !== true) throw new Error('undo requires sha and confirm:true after an explicit user request');
    if (await store.othersRunning(repo.key, id)) throw new Error('other_agent_active: another agent is editing this repository');
    const result = await rt.git.undo(repo.cwd, args.sha, id);
    // HEAD moved: this turn can no longer be committed against its baseline.
    session.baseline = null;
    const entry = store.record(session, { ...result, action: 'undo' });
    await store.putSession(id, session);
    return entry;
  }
  return { status: 'error', reason: 'unknown_action' };
}

export async function handle(msg, options) {
  const reply = result => ({ jsonrpc: '2.0', id: msg.id, result });
  switch (msg.method) {
    case 'initialize': return reply({ protocolVersion: msg.params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'tortoisegit-ai', version: '0.1.0' } });
    case 'ping': return reply({});
    case 'tools/list': return reply({ tools: [TOOL] });
    case 'tools/call': {
      if (msg.params?.name !== TOOL.name) return { jsonrpc: '2.0', id: msg.id, error: { code: -32602, message: `unknown tool: ${msg.params?.name}` } };
      try { return reply({ content: [{ type: 'text', text: JSON.stringify(await operate(msg.params.arguments || {}, options)) }] }); }
      catch (e) { return reply({ content: [{ type: 'text', text: String(e?.message || e) }], isError: true }); }
    }
    default:
      if (msg.id === undefined) return null; // notification
      return { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `method not found: ${msg.method}` } };
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  let buffer = '';
  const pending = new Set();
  const write = obj => { if (obj) process.stdout.write(`${JSON.stringify(obj)}\n`); };
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    buffer += chunk;
    let i;
    while ((i = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, i).trim(); buffer = buffer.slice(i + 1);
      if (!line) continue;
      let msg; try { msg = JSON.parse(line); } catch { write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }); continue; }
      const p = handle(msg).then(write, e => write({ jsonrpc: '2.0', id: msg.id ?? null, error: { code: -32603, message: String(e?.message || e) } }));
      pending.add(p); p.finally(() => pending.delete(p));
    }
  });
  process.stdin.on('end', async () => { await Promise.allSettled([...pending]); process.exit(0); });
}
