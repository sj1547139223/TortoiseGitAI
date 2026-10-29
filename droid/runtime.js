import path from 'node:path';
import { realpath } from 'node:fs/promises';
import { GitService } from '../lib/git.js';
import { detectProfiles } from '../lib/detect.js';
import { locateTortoiseGit } from '../lib/tgit.js';
import * as store from './store.js';

const DETECT_TTL_MS = 10 * 60 * 1000;

/** Repository resolution, enablement and exclusion rules shared by the hook, MCP server and CLI. */
export async function createRuntime({ signal } = {}) {
  const config = await store.loadConfig();
  const git = new GitService({ timeoutMs: config.gitTimeoutMs, signal, excludes: config.excludes, defaultExcludes: config.defaultExcludes });
  const applyExcludes = (root, rec) => git.setRepoExcludes(root, rec?.enabled ? [...(rec.detected || []), ...(rec.learned || [])] : []);
  const allowedRoots = async () => {
    const out = [];
    for (const root of config.allowedRoots) { try { out.push(store.keyOf(await realpath(root))); } catch { /* missing roots are not authorized */ } }
    return out;
  };
  /** Resolve the repository top level; a stored per-repo choice wins over allowedRoots. */
  async function repoOf(cwd) {
    const status = await git.status(cwd);
    if (status.status !== 'ok') return { status };
    const key = store.keyOf(await realpath(status.cwd));
    const rec = await store.getRepo(key);
    const authorized = rec ? rec.enabled : (await allowedRoots()).includes(key);
    applyExcludes(status.cwd, rec);
    return { cwd: status.cwd, key, status, authorized, rec };
  }
  async function refreshRepo(repo, { force = false } = {}) {
    let rec = await store.getRepo(repo.key);
    if (!rec && repo.authorized) rec = { enabled: true, path: repo.cwd, updatedAt: Date.now() };
    if (!rec?.enabled) return rec;
    if (force || !rec.detectedAt || Date.now() - rec.detectedAt > DETECT_TTL_MS) {
      const found = await detectProfiles(repo.cwd);
      rec = { ...rec, profiles: found.profiles, detected: found.patterns, detectedAt: Date.now() };
      await store.putRepo(repo.key, rec);
    }
    applyExcludes(repo.cwd, rec);
    return rec;
  }
  async function setEnabled(repo, enabled) {
    const prev = await store.getRepo(repo.key);
    await store.putRepo(repo.key, { ...prev, enabled, path: repo.cwd, updatedAt: Date.now() });
    if (!enabled) { applyExcludes(repo.cwd, null); return { ok: true, authorized: false, repo: repo.cwd }; }
    const rec = await refreshRepo({ ...repo, authorized: true }, { force: true });
    return { ok: true, authorized: true, repo: repo.cwd, profiles: rec?.profiles || [] };
  }
  /** Same rule as the DSH plugin: a whole new directory when all its new files were flagged and it tracks nothing, else the exact path. */
  async function learn(cwd, key, generated, created) {
    if (!generated.length) return [];
    const flagged = new Set(generated), patterns = new Set();
    for (const file of generated) {
      const dir = path.posix.dirname(file);
      if (dir !== '.' && created.filter(f => f.startsWith(`${dir}/`)).every(f => flagged.has(f)) && !(await git.hasTracked(cwd, dir))) patterns.add(`/${dir}/`);
      else patterns.add(`/${file}`);
    }
    const rec = (await store.getRepo(key)) || { enabled: true, path: cwd, updatedAt: Date.now() };
    const next = { ...rec, learned: [...new Set([...(rec.learned || []), ...patterns])].slice(-500), updatedAt: Date.now() };
    await store.putRepo(key, next); applyExcludes(cwd, next);
    return [...patterns];
  }
  async function forgetExclude(repo, pattern) {
    const rec = await store.getRepo(repo.key);
    if (!rec || !pattern) return { status: 'error', reason: 'nothing_to_forget' };
    const next = { ...rec, learned: (rec.learned || []).filter(p => p !== pattern), updatedAt: Date.now() };
    await store.putRepo(repo.key, next); applyExcludes(repo.cwd, next);
    return { ok: true, learned: next.learned };
  }
  let discovery;
  const executable = () => discovery ||= locateTortoiseGit(config.tgitPath);
  return { config, git, repoOf, refreshRepo, setEnabled, learn, forgetExclude, executable };
}
