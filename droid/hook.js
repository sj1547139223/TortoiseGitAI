#!/usr/bin/env node
import { realpath } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createRuntime } from './runtime.js';
import { droidSummary } from './summary.js';
import * as store from './store.js';

/**
 * Droid hook entry: `start` on UserPromptSubmit takes the turn baseline, `stop` on Stop
 * commits the turn. Never writes stdout (UserPromptSubmit stdout becomes model context)
 * and always exits 0 so a failure can never block the user's turn.
 */
const message = error => String(error?.message || error).slice(0, 1000);
const freshSession = config => ({ enabled: config.enabled, outcomes: [], turn: 0 });

export async function start(input, { runtime } = {}) {
  const rt = runtime || await createRuntime();
  const id = String(input.session_id || ''), cwd = input.cwd || process.cwd();
  if (!id) return;
  const s = (await store.getSession(id)) || freshSession(rt.config);
  // A baseline still present means the previous turn was cancelled (no Stop event): discard it.
  s.baseline = null; s.cwd = cwd;
  try {
    if (!rt.config.enabled || s.enabled === false) return;
    const repo = await rt.repoOf(cwd);
    if (!repo.cwd || !repo.authorized) return;
    s.repoKey = repo.key; s.turn = (s.turn || 0) + 1;
    await store.markRunning(repo.key, id);
    try { await rt.refreshRepo(repo); } catch (e) { store.record(s, { status: 'warning', reason: `detect_failed: ${message(e)}` }); }
    const baseline = await rt.git.baseline(repo.cwd);
    if (baseline.status !== 'ready') {
      const dirty = baseline.dirty || [];
      store.record(s, { status: 'skipped', reason: dirty.length ? `${baseline.reason}: ${dirty.slice(0, 5).join(', ')}${dirty.length > 5 ? ' …' : ''}` : baseline.reason, turn: s.turn });
      s.baseline = { skipped: true };
      return;
    }
    s.baseline = baseline; s.request = String(input.prompt || '').slice(0, 2000);
  } catch (e) { store.record(s, { status: 'error', reason: message(e), turn: s.turn }); }
  finally { await store.putSession(id, s); }
}

export async function stop(input, { runtime, summarize = droidSummary } = {}) {
  const id = String(input.session_id || '');
  if (!id || input.stop_hook_active) return;
  const s = await store.getSession(id);
  if (!s) return;
  const raw = s.baseline, turn = s.turn;
  s.baseline = null;
  try {
    if (!raw || raw.skipped) return;
    const rt = runtime || await createRuntime();
    if (!rt.config.enabled || s.enabled === false) return store.record(s, { status: 'skipped', reason: 'paused', turn });
    const key = store.keyOf(await realpath(raw.cwd));
    await rt.repoOf(raw.cwd); // re-installs this repository's stored exclusion rules in this process
    if (await store.othersRunning(key, id)) return store.record(s, { status: 'skipped', reason: 'other_agent_active', turn });
    const baseline = rt.git.restoreBaseline(raw);
    const prepared = await rt.git.prepare(baseline);
    if (prepared.status !== 'ready') return store.record(s, { ...prepared, turn });
    const candidates = (prepared.created || []).slice(0, 200);
    const summary = await summarize({ request: s.request, diff: prepared.diff, paths: prepared.paths, candidates, config: rt.config });
    const omit = summary.generated || [];
    const result = await rt.git.commit(prepared, summary.message, { sessionId: id, turn, model: summary.model || 'template', omit });
    // Learn only after the commit: changing patterns earlier would invalidate the prepared snapshot.
    const learned = result.status === 'committed' || result.reason === 'excluded_only' ? await rt.learn(raw.cwd, key, omit, prepared.created || []).catch(() => []) : [];
    store.record(s, { ...result, turn, summary: summary.message, summarySource: summary.source, summaryFallbackReason: summary.reason, learned });
  } catch (e) { store.record(s, { status: 'error', reason: message(e), turn }); }
  finally {
    if (s.repoKey) await store.clearRunning(s.repoKey, id).catch(() => {});
    await store.putSession(id, s);
  }
}

export async function end(input) {
  const id = String(input.session_id || '');
  if (!id) return;
  await store.clearSessionMarkers(id);
  const s = await store.getSession(id);
  if (s) { s.baseline = null; await store.putSession(id, s); }
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const text = Buffer.concat(chunks).toString('utf8').trim();
  return text ? JSON.parse(text) : {};
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const mode = process.argv[2];
  if (process.env.TGIT_AI_INNER) process.exit(0);
  try {
    const input = await readStdin();
    if (mode === 'start') await start(input);
    else if (mode === 'stop') await stop(input);
    else if (mode === 'end') await end(input);
  } catch (e) { process.stderr.write(`tortoisegit-ai: ${message(e)}\n`); }
  process.exit(0);
}
