import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, realpath } from 'node:fs/promises';
import path from 'node:path';
const exec = promisify(execFile);
const COMMANDS = new Set(['log', 'showcompare', 'repostatus', 'diff', 'blame', 'revisiongraph']);
export async function locateTortoiseGit(configured = '') {
  if (process.platform !== 'win32') return null;
  const candidates = configured ? [configured] : [];
  if (!configured) {
    for (const hive of ['HKCU', 'HKLM']) {
      try {
        const { stdout } = await exec('reg.exe', ['query', `${hive}\\SOFTWARE\\TortoiseGit`, '/v', 'ProcPath'], { timeout: 3000, windowsHide: true });
        const match = stdout.match(/ProcPath\s+REG_\w+\s+(.+)/i);
        if (match) candidates.push(match[1].trim());
      } catch { /* Missing registry key is normal. */ }
    }
    for (const root of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean)) candidates.push(path.join(root, 'TortoiseGit', 'bin', 'TortoiseGitProc.exe'));
  }
  for (const candidate of candidates) {
    if (!path.isAbsolute(candidate) || path.basename(candidate).toLowerCase() !== 'tortoisegitproc.exe') continue;
    try { await access(candidate); return await realpath(candidate); } catch { /* Try the next declared installation. */ }
  }
  return null;
}
export async function openTortoiseGit({ executable, cwd, command = 'log', sha, file, sessionId }) {
  if (!executable) throw new Error('TortoiseGit is not installed or tgitPath is invalid');
  if (!COMMANDS.has(command)) throw new Error('Only read-only dialog commands are allowed');
  if (sha != null && !/^[a-f0-9]{7,64}$/i.test(sha)) throw new Error('Invalid commit hash');
  const root = await realpath(cwd);
  let target = root;
  if (file) {
    target = await realpath(path.resolve(root, file));
    const rel = path.relative(root, target);
    if (rel.startsWith('..' + path.sep) || rel === '..' || path.isAbsolute(rel)) throw new Error('File must be inside repository');
  }
  if (/[\0\r\n*]/.test(target)) throw new Error('Unsupported path characters');
  if (['blame', 'diff'].includes(command) && !file) throw new Error('This dialog requires a file path');
  const args = [`/command:${command}`, `/path:${target}`];
  if (command === 'showcompare') {
    if (!sha) throw new Error('showcompare requires a commit hash');
    // Root commits have no parent: show their log, whose changed-files pane handles this.
    const { stdout } = await exec('git', ['show', '-s', '--format=%P', sha, '--'], { cwd: root, timeout: 10000, windowsHide: true });
    const parent = stdout.trim().split(' ')[0];
    if (parent) args.push(`/revision1:${parent}`, `/revision2:${sha}`);
    else { args[0] = '/command:log'; args.push(`/rev:${sha}`); }
  } else if (command === 'log') {
    if (sha) args.push(`/rev:${sha}`);
    if (sessionId) args.push(`/findstring:AI-Session: ${String(sessionId).replace(/[\0\r\n]/g, '')}`, '/findtext', '/findtype:1');
  } else if (command === 'blame' && sha) args.push(`/endrev:${sha}`);
  await new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: root, detached: true, stdio: 'ignore', shell: false, windowsHide: false });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  });
  return { status: 'opened', command, sha: sha || null, path: target };
}
