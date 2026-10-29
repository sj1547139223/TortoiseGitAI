/** The `tgit_ai` tool contract shared by the DSH plugin and the Droid (Factory) MCP server. */
export const AI_ACTIONS = ['status', 'history', 'branches', 'log', 'diff', 'open', 'pause', 'resume', 'undo', 'branch', 'switch', 'restore'];
export const OPEN_COMMANDS = ['log', 'showcompare', 'repostatus', 'diff', 'blame', 'revisiongraph'];
export const CHANGE_ACTIONS = new Set(['undo', 'branch', 'switch', 'restore']);

export const TOOL_DESCRIPTION = 'Project version history shared by every coding tool (DSH, Factory, Cursor, Codex...). Each turn that edits files in an enabled repository is committed automatically when the turn ends, subject "<Tool>: <one-sentence Chinese summary>" with AI-Session/AI-Turn/AI-Model/AI-Tool trailers; never commit those changes yourself. '
  + 'Read (free to use; call history first when picking up a project another tool or session worked on): status | history {limit, skip, tool, path, since, all} whole-project changes by every tool, with changed files | branches | log {limit} this session only | diff {sha} bounded diff of one commit. '
  + 'For the user: open {command: log|showcompare|repostatus|diff|blame|revisiongraph, sha?, path?} opens a native TortoiseGit window | pause / resume auto-commit. '
  + 'Change (ONLY when the user explicitly asks, with confirm:true; needs a clean work tree): undo {sha} reverts one AI commit of this session | branch {name, sha?, checkout?} creates a branch at sha (default HEAD) | switch {name} or {sha} switches branch or checks out a commit (detached: auto-commit pauses) | restore {sha, before?} makes the project look like that version again as a NEW commit (history kept; the restore can itself be undone). Never use git reset, stash or force pushes for these.';

export const TOOL_PROPERTIES = {
  action: { type: 'string', enum: AI_ACTIONS },
  command: { type: 'string', enum: OPEN_COMMANDS, description: 'Dialog for action=open.' },
  sha: { type: 'string', description: 'Commit hash (7-64 hex): diff/undo/restore target, branch start point, or switch to a detached commit.' },
  path: { type: 'string', description: 'Repository-relative file: history of one file, or file for open diff/blame.' },
  limit: { type: 'integer', minimum: 1, maximum: 100 },
  skip: { type: 'integer', minimum: 0, description: 'history: commits to skip (paging).' },
  tool: { type: 'string', description: 'history: only commits by this tool (DSH, Factory, Cursor, Codex; AI = older untagged AI commits; human).' },
  since: { type: 'string', description: 'history: git date such as 2026-10-28 or "3 days ago".' },
  all: { type: 'boolean', description: 'history: include all branches, not only the current one.' },
  name: { type: 'string', description: 'Branch name for branch / switch.' },
  checkout: { type: 'boolean', description: 'branch: also switch to the new branch.' },
  before: { type: 'boolean', description: 'restore: restore the version just before sha instead of sha itself.' },
  confirm: { type: 'boolean', description: 'Must be true for undo / branch / switch / restore, only after the user explicitly asked.' },
};

/**
 * Run a read or change action that does not depend on the host (session bookkeeping stays with the caller).
 * Returns undefined for actions the caller handles itself.
 */
export async function runGitAction(git, cwd, args, { tool, sessionId, model }) {
  if (args.action === 'history') return git.history(cwd, { limit: args.limit || 30, skip: args.skip, tool: args.tool, path: args.path, since: args.since, all: args.all });
  if (args.action === 'branches') return git.branches(cwd);
  if (args.action === 'branch') {
    if (!args.name) throw new Error('branch requires name (optional sha to branch from, checkout:true to switch)');
    return git.createBranch(cwd, { name: args.name, from: args.sha, checkout: args.checkout === true });
  }
  if (args.action === 'switch') {
    if (!args.name === !args.sha) throw new Error('switch requires exactly one of name (branch) or sha (detached checkout)');
    return git.switchTo(cwd, { branch: args.name, sha: args.sha });
  }
  if (args.action === 'restore') {
    if (!args.sha) throw new Error('restore requires sha (before:true restores the version just before that commit)');
    return git.restore(cwd, { sha: args.sha, before: args.before === true, metadata: { sessionId, tool, model } });
  }
  return undefined;
}
