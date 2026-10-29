import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SUMMARY_SYSTEM, JUDGE_SYSTEM, fallbackMessage, summaryInput, interpretReply } from '../lib/summary.js';

/** Run one tool-less `droid exec` in an empty temp dir; resolves with stdout. */
export function runDroidExec({ droidPath = 'droid', model, reasoning, prompt, timeoutMs, signal }) {
  return new Promise(async (resolve, reject) => {
    let dir;
    try {
      dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tgit-ai-summary-'));
      const file = path.join(dir, 'prompt.txt');
      await fs.writeFile(file, prompt, 'utf8');
      const args = ['exec', '-m', model, ...(reasoning ? ['-r', reasoning] : []), '--only-tools', 'Read', '--cwd', dir, '-f', file];
      // TGIT_AI_INNER makes the nested session's own hooks exit immediately.
      const child = spawn(droidPath, args, { cwd: dir, env: { ...process.env, TGIT_AI_INNER: '1' }, shell: false, windowsHide: true });
      const out = [], err = []; let stopped;
      const stop = reason => { stopped ||= reason; child.kill(); };
      const timer = setTimeout(() => stop('summary_timeout'), timeoutMs);
      const abort = () => stop('cancelled'); signal?.addEventListener('abort', abort, { once: true });
      child.stdout.on('data', b => { out.push(b); if (out.reduce((n, x) => n + x.length, 0) > 16000) stop('summary_too_long'); });
      child.stderr.on('data', b => err.push(b));
      const done = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); fs.rm(dir, { recursive: true, force: true }).catch(() => {}); };
      child.on('error', e => { done(); reject(e); });
      child.on('close', code => {
        done();
        if (stopped) return reject(new Error(stopped));
        if (code) return reject(new Error(`droid_exec_exit_${code}: ${Buffer.concat(err).toString('utf8').trim().slice(0, 200)}`));
        resolve(Buffer.concat(out).toString('utf8'));
      });
    } catch (e) { if (dir) fs.rm(dir, { recursive: true, force: true }).catch(() => {}); reject(e); }
  });
}

/** Commit title (and artifact judgement) via droid exec; template title on any failure. */
export async function droidSummary({ request = '', diff = '', paths = [], candidates = [], config, signal, exec = runDroidExec }) {
  const judge = candidates.length > 0;
  const prompt = `${judge ? JUDGE_SYSTEM : SUMMARY_SYSTEM}\n\n不要调用任何工具，直接回答。输入：\n${summaryInput({ request, paths, candidates, diff })}`;
  try {
    const text = await exec({ droidPath: config.droidPath, model: config.summaryModel, reasoning: config.summaryReasoning, prompt, timeoutMs: config.summaryTimeoutMs, signal });
    return { ...interpretReply(text, { paths, candidates: candidates.slice(0, 200) }), model: config.summaryModel };
  } catch (error) {
    return { message: fallbackMessage(paths), source: 'template', reason: String(error?.message || error).slice(0, 200) };
  }
}
