import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

/** File-backed state for the Droid adapter: hooks and the MCP server are separate short-lived processes. */
export const home = () => process.env.TGIT_AI_HOME || path.join(os.homedir(), '.factory', 'tortoisegit-ai');
export const keyOf = value => process.platform === 'win32' ? value.toLowerCase() : value;
export const idOf = value => createHash('sha256').update(String(value)).digest('hex').slice(0, 32);
const RUNNING_TTL_MS = 2 * 60 * 60 * 1000;

export const DEFAULTS = Object.freeze({
  enabled: true, allowedRoots: [], tgitPath: '', summaryModel: 'claude-haiku-4-5-20251001', summaryReasoning: 'off',
  summaryTimeoutMs: 25000, gitTimeoutMs: 30000, excludes: [], defaultExcludes: true, droidPath: 'droid',
});

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT' || e instanceof SyntaxError) return fallback; throw e; }
}
async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(value, null, 2));
  for (let i = 0; ; i++) {
    try { await fs.rename(temp, file); return; } catch (e) {
      // Windows refuses to replace a file another process is reading; retry briefly.
      if (i >= 20 || !['EPERM', 'EACCES', 'EBUSY'].includes(e.code)) { await fs.rm(temp, { force: true }); throw e; }
      await new Promise(r => setTimeout(r, 25));
    }
  }
}

const num = (v, d, min, max) => Number.isInteger(v) && v >= min && v <= max ? v : d;
const strings = v => Array.isArray(v) ? v.filter(s => typeof s === 'string') : [];
export async function loadConfig() {
  const raw = await readJson(path.join(home(), 'config.json'), {});
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULTS.enabled,
    allowedRoots: strings(raw.allowedRoots),
    tgitPath: typeof raw.tgitPath === 'string' ? raw.tgitPath : '',
    summaryModel: typeof raw.summaryModel === 'string' && raw.summaryModel ? raw.summaryModel : DEFAULTS.summaryModel,
    summaryReasoning: typeof raw.summaryReasoning === 'string' ? raw.summaryReasoning : DEFAULTS.summaryReasoning,
    summaryTimeoutMs: num(raw.summaryTimeoutMs, DEFAULTS.summaryTimeoutMs, 100, 60000),
    gitTimeoutMs: num(raw.gitTimeoutMs, DEFAULTS.gitTimeoutMs, 1000, 120000),
    excludes: strings(raw.excludes),
    defaultExcludes: typeof raw.defaultExcludes === 'boolean' ? raw.defaultExcludes : true,
    droidPath: typeof raw.droidPath === 'string' && raw.droidPath ? raw.droidPath : DEFAULTS.droidPath,
  };
}

const reposFile = () => path.join(home(), 'repos.json');
export async function getRepo(key) { return (await readJson(reposFile(), {}))[idOf(key)]; }
export async function putRepo(key, value) {
  const all = await readJson(reposFile(), {});
  all[idOf(key)] = value; await writeJson(reposFile(), all);
}

const sessionFile = id => path.join(home(), 'sessions', `${idOf(id)}.json`);
export async function getSession(id) { return readJson(sessionFile(id), null); }
export async function putSession(id, value) { await writeJson(sessionFile(id), { ...value, id, updatedAt: Date.now() }); }
export async function listSessions() {
  const dir = path.join(home(), 'sessions');
  let names; try { names = await fs.readdir(dir); } catch { return []; }
  const all = await Promise.all(names.filter(n => n.endsWith('.json')).map(n => readJson(path.join(dir, n), null)));
  return all.filter(s => s?.id).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}
export function record(session, value) {
  const entry = { ...value, timestamp: Date.now() };
  session.outcomes = [entry, ...(session.outcomes || [])].slice(0, 30);
  return entry;
}

const runningDir = () => path.join(home(), 'running');
const marker = (key, sessionId) => path.join(runningDir(), `${idOf(key)}-${idOf(sessionId)}`);
export async function markRunning(key, sessionId) { await fs.mkdir(runningDir(), { recursive: true }); await fs.writeFile(marker(key, sessionId), String(Date.now())); }
export async function clearRunning(key, sessionId) { await fs.rm(marker(key, sessionId), { force: true }); }
export async function clearSessionMarkers(sessionId) {
  let names; try { names = await fs.readdir(runningDir()); } catch { return; }
  await Promise.all(names.filter(n => n.endsWith(`-${idOf(sessionId)}`)).map(n => fs.rm(path.join(runningDir(), n), { force: true })));
}
/** Another session is mid-turn in the same repository. Markers left by a cancelled turn expire. */
export async function othersRunning(key, sessionId) {
  let names; try { names = await fs.readdir(runningDir()); } catch { return false; }
  const prefix = `${idOf(key)}-`, self = `${prefix}${idOf(sessionId)}`;
  for (const name of names.filter(n => n.startsWith(prefix) && n !== self)) {
    try { if (Date.now() - (await fs.stat(path.join(runningDir(), name))).mtimeMs < RUNNING_TTL_MS) return true; } catch { /* removed meanwhile */ }
  }
  return false;
}
