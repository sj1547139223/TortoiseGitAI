import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { apply } from '../index.js';
import { generateSummary, cleanTitle } from '../lib/summary.js';

const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();
async function repo(t) {
  const cwd = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'tgai-plugin-')));
  t.after(() => fs.rm(cwd, { recursive: true, force: true, maxRetries: 5 }));
  git(cwd, 'init', '-b', 'main'); git(cwd, 'config', 'user.name', 'T'); git(cwd, 'config', 'user.email', 't@example.invalid'); git(cwd, 'config', 'commit.gpgsign', 'false'); git(cwd, 'config', 'core.autocrlf', 'false');
  await fs.writeFile(path.join(cwd, 'a.txt'), 'one\n'); git(cwd, 'add', '.'); git(cwd, 'commit', '-m', 'init');
  return cwd;
}
function fakeLlm(text, seen = []) {
  return { async prepareCall(route, signal) { seen.push(route); return { config: { ...route }, async *stream(o) { seen.push(o); yield { type: 'text-delta', index: 0, text }; yield { type: 'finish', reason: { kind: 'stop' } }; } }; } };
}
function harness(cwd, { roots = [cwd], llm = fakeLlm('更新问候语'), others = [], store = new Map(), reload = false } = {}) {
  if (!reload) delete globalThis[Symbol.for('tortoisegit-ai.runtime')]; // fresh process unless simulating a hot reload
  const listeners = {}, routes = {}, tools = {}, effects = [];
  const agent = { id: 'sess-1', session: { requestHeader: () => ({ config: { provider: 'p', model: 'm' } }) } };
  const ctx = {
    on: (name, fn) => { (listeners[name] ||= []).push(fn); },
    effect: fn => { const d = fn(); effects.push(d); },
    tools: { register: d => { tools[d.name] = d; return () => {}; } },
    agents: { roots: () => [agent], get: id => (id === agent.id ? agent : undefined), list: () => [agent, ...others] },
    workingDirectory: { ensure: async () => cwd },
    llm,
    webServer: { register: r => { routes[r.path] = r.handler; return () => {}; } },
    connection: { requestRejection: () => undefined },
    storageDomain: { open: async spec => { assert.match(spec.name, /^[a-z][a-z0-9_]*$/); const m = store; return { table: () => ({ get: k => m.get(k), put: async (k, v) => { spec.tables.repos.valueSchema.parse(v); m.set(k, v); } }), close: async () => {} }; } },
  };
  apply(ctx, { allowedRoots: roots, tgitPath: 'C:\\nope\\TortoiseGitProc.exe' });
  const emit = async (name, payload) => { for (const fn of listeners[name] || []) await fn({ agent, ...payload }, async () => ({ kind: 'enter' })); };
  return { agent, ctx, emit, tools, routes, listeners };
}
const turn = async (h, n, edit) => {
  const signal = new AbortController().signal;
  await h.emit('agent/status', { status: 'running' });
  await h.emit('agent/pre-step', { turn: n, step: 0, messages: [{ role: 'user', content: [{ type: 'text', text: '把 one 改成 two' }] }], signal });
  await edit();
  await h.emit('agent/turn-stopping', { turn: n, signal });
  await h.emit('agent/status', { status: 'idle' });
};

test('turn edits are committed with LLM summary and trailers', async t => {
  const cwd = await repo(t), seen = [], h = harness(cwd, { llm: fakeLlm('**更新问候语**', seen) });
  await turn(h, 1, () => fs.writeFile(path.join(cwd, 'a.txt'), 'two\n'));
  const body = git(cwd, 'log', '-1', '--format=%B');
  assert.match(body, /^DSH: 更新问候语/); assert.match(body, /AI-Session: sess-1/); assert.match(body, /AI-Model: m/); assert.match(body, /AI-Tool: DSH/);
  assert.equal(git(cwd, 'status', '--porcelain'), '');
  assert.equal(seen[0].provider, 'p'); assert.match(seen[1].messages[0].content[0].text, /two/);
  const out = JSON.parse(await h.tools.tgit_ai.execute({ action: 'status' }, { agent: h.agent }));
  assert.equal(out.history.commits.length, 1); assert.equal(out.outcomes[0].status, 'committed');
});

test('dirty baseline, unauthorized repo, and paused session never commit', async t => {
  const cwd = await repo(t), h = harness(cwd);
  await fs.writeFile(path.join(cwd, 'user.txt'), 'mine');
  await turn(h, 1, () => fs.writeFile(path.join(cwd, 'a.txt'), 'two\n'));
  assert.equal(git(cwd, 'rev-list', '--count', 'HEAD'), '1');
  const other = await repo(t), h2 = harness(other, { roots: [] });
  await turn(h2, 1, () => fs.writeFile(path.join(other, 'a.txt'), 'two\n'));
  assert.equal(git(other, 'rev-list', '--count', 'HEAD'), '1');
  const third = await repo(t), h3 = harness(third);
  await h3.tools.tgit_ai.execute({ action: 'pause' }, { agent: h3.agent });
  await turn(h3, 1, () => fs.writeFile(path.join(third, 'a.txt'), 'two\n'));
  assert.equal(git(third, 'rev-list', '--count', 'HEAD'), '1');
});

test('LLM failure falls back to template; undo requires confirm and reverts', async t => {
  const cwd = await repo(t);
  const broken = { async prepareCall() { throw new Error('no route'); } };
  const h = harness(cwd, { llm: broken });
  await turn(h, 1, () => fs.writeFile(path.join(cwd, 'a.txt'), 'two\n'));
  assert.match(git(cwd, 'log', '-1', '--format=%s'), /^DSH: 修改 a\.txt/);
  const sha = git(cwd, 'rev-parse', 'HEAD');
  await assert.rejects(h.tools.tgit_ai.execute({ action: 'undo', sha }, { agent: h.agent }), /confirm/);
  const res = JSON.parse(await h.tools.tgit_ai.execute({ action: 'undo', sha, confirm: true }, { agent: h.agent }));
  assert.equal(res.status, 'reverted'); assert.equal(await fs.readFile(path.join(cwd, 'a.txt'), 'utf8'), 'one\n');
});

test('HTTP routes serve status and actions for live sessions only', async t => {
  const cwd = await repo(t), h = harness(cwd);
  const call = (route, req) => new Promise(resolve => { const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { resolve({ status: this.statusCode, body: b && JSON.parse(b) }); } }; h.routes[route](req, res); });
  const ok = await call('/api/tortoisegit-ai.status', { method: 'GET', url: '/api/tortoisegit-ai.status?session=sess-1' });
  assert.equal(ok.status, 200); assert.equal(ok.body.enabled, true);
  const missing = await call('/api/tortoisegit-ai.status', { method: 'GET', url: '/api/tortoisegit-ai.status?session=x' });
  assert.equal(missing.status, 404);
  const body = Buffer.from(JSON.stringify({ session: 'sess-1', action: 'pause' }));
  const post = await call('/api/tortoisegit-ai.action', { method: 'POST', headers: { 'content-type': 'application/json' }, [Symbol.asyncIterator]: async function* () { yield body; } });
  assert.equal(post.body.enabled, false);
});

test('a repository can be enabled from the UI only, and then auto-commits', async t => {
  const cwd = await repo(t), h = harness(cwd, { roots: [] });
  const call = (route, req) => new Promise(resolve => { const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { resolve({ status: this.statusCode, body: b && JSON.parse(b) }); } }; h.routes[route](req, res); });
  const post = payload => { const body = Buffer.from(JSON.stringify({ session: 'sess-1', ...payload })); return call('/api/tortoisegit-ai.action', { method: 'POST', headers: { 'content-type': 'application/json' }, [Symbol.asyncIterator]: async function* () { yield body; } }); };
  const before = await call('/api/tortoisegit-ai.status', { method: 'GET', url: '/x?session=sess-1' });
  assert.equal(before.body.authorized, false); assert.equal(before.body.git.status, 'ok');
  await assert.rejects(h.tools.tgit_ai.execute({ action: 'enableRepo' }, { agent: h.agent }), /only the user/);
  assert.equal((await post({ action: 'enableRepo' })).body.authorized, true);
  await turn(h, 1, () => fs.writeFile(path.join(cwd, 'a.txt'), 'two\n'));
  assert.equal(git(cwd, 'rev-list', '--count', 'HEAD'), '2');
  assert.equal((await post({ action: 'disableRepo' })).body.authorized, false);
  await turn(h, 2, () => fs.writeFile(path.join(cwd, 'a.txt'), 'three\n'));
  assert.equal(git(cwd, 'rev-list', '--count', 'HEAD'), '2');
});

test('summary cleaning and other-agent guard', async t => {
  assert.equal(cleanTitle('"AI: 修复登录。"\n解释'), '修复登录');
  const r = await generateSummary({ llm: null, paths: ['a', 'b', 'c', 'd'] });
  assert.equal(r.source, 'template'); assert.match(r.message, /等 4 个文件/);
  const cwd = await repo(t), h = harness(cwd);
  const child = { id: 'child' };
  for (const fn of h.listeners['agent/status']) fn({ agent: child, status: 'running' });
  await new Promise(r => setTimeout(r, 300));
  await turn(h, 1, () => fs.writeFile(path.join(cwd, 'a.txt'), 'two\n'));
  assert.equal(git(cwd, 'rev-list', '--count', 'HEAD'), '1');
});

test('build artifacts are never committed and do not dirty the baseline', async t => {
  const cwd = await repo(t), h = harness(cwd);
  await fs.mkdir(path.join(cwd, 'Objects'), { recursive: true });
  await fs.writeFile(path.join(cwd, 'Objects', 'app.axf'), 'old');            // leftover from an earlier build
  await fs.writeFile(path.join(cwd, 'proj.uvguix.sj'), 'layout');
  await turn(h, 1, async () => {
    await fs.writeFile(path.join(cwd, 'a.txt'), 'two\n');
    await fs.writeFile(path.join(cwd, 'Objects', 'main.o'), Buffer.alloc(1000, 1));
    await fs.mkdir(path.join(cwd, 'Listings')); await fs.writeFile(path.join(cwd, 'Listings', 'app.map'), 'map');
    await fs.writeFile(path.join(cwd, 'main.crf'), 'x'); await fs.writeFile(path.join(cwd, '.env'), 'SECRET=1');
  });
  assert.equal(git(cwd, 'rev-list', '--count', 'HEAD'), '2');
  assert.deepEqual(git(cwd, 'show', '--name-only', '--format=', 'HEAD').split(/\r?\n/), ['a.txt']);
});

test('custom excludes and a staged artifact still count as user work', async t => {
  const { createExcluder } = await import('../lib/git.js');
  const ex = createExcluder(['gen/', '*.cache', '/top.txt', 'docs/**/*.pdf']);
  assert.ok(ex('src/gen/x.c')); assert.ok(ex('a/b.cache')); assert.ok(ex('top.txt')); assert.ok(!ex('sub/top.txt'));
  assert.ok(ex('docs/a/b/c.pdf')); assert.ok(ex('Objects/x.bin')); assert.ok(ex('KEIL/OBJECTS/x.bin'));
  assert.ok(!ex('src/main.c')); assert.ok(!ex('Core/Src/objects.c')); assert.ok(ex('x/.env.local'));
  const noDefaults = createExcluder([], { defaults: false });
  assert.ok(!noDefaults('Objects/x.o')); assert.ok(noDefaults('.env'));
  const cwd = await repo(t), h = harness(cwd);
  await fs.writeFile(path.join(cwd, 'x.o'), 'o'); git(cwd, 'add', '-f', 'x.o');
  await turn(h, 1, () => fs.writeFile(path.join(cwd, 'a.txt'), 'two\n'));
  assert.equal(git(cwd, 'rev-list', '--count', 'HEAD'), '1');
});

const postTo = (h, payload) => new Promise(resolve => {
  const body = Buffer.from(JSON.stringify({ session: 'sess-1', ...payload }));
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { resolve(b && JSON.parse(b)); } };
  h.routes['/api/tortoisegit-ai.action']({ method: 'POST', headers: { 'content-type': 'application/json' }, [Symbol.asyncIterator]: async function* () { yield body; } }, res);
});

test('toolchains are detected (ESP-IDF, PlatformIO, nested) and their outputs ignored', async t => {
  const { detectProfiles } = await import('../lib/detect.js');
  const cwd = await repo(t);
  await fs.writeFile(path.join(cwd, 'CMakeLists.txt'), 'include($ENV{IDF_PATH}/tools/cmake/project.cmake)\nproject(app)\n');
  await fs.writeFile(path.join(cwd, 'sdkconfig'), 'CONFIG_X=y\n');
  await fs.mkdir(path.join(cwd, 'tools', 'pio'), { recursive: true }); await fs.writeFile(path.join(cwd, 'tools', 'pio', 'platformio.ini'), '[env]\n');
  await fs.mkdir(path.join(cwd, '.vscode')); await fs.writeFile(path.join(cwd, '.vscode', 'settings.json'), '{}');
  git(cwd, 'add', '.'); git(cwd, 'commit', '-q', '-m', 'proj');
  const found = await detectProfiles(cwd);
  const ids = found.profiles.map(p => p.id);
  for (const id of ['esp-idf', 'cmake', 'platformio', 'vscode']) assert.ok(ids.includes(id), id);
  assert.ok(found.patterns.includes('managed_components/')); assert.ok(found.patterns.includes('.pio/'));
  const h = harness(cwd, { roots: [] });
  assert.equal((await postTo(h, { action: 'enableRepo' })).profiles.some(p => p.id === 'esp-idf'), true);
  await fs.mkdir(path.join(cwd, 'managed_components', 'espressif__led'), { recursive: true });
  await fs.writeFile(path.join(cwd, 'managed_components', 'espressif__led', 'led.c'), 'int x;');
  await fs.writeFile(path.join(cwd, 'sdkconfig.old'), 'old');                       // left over before the turn
  await turn(h, 1, async () => {
    await fs.writeFile(path.join(cwd, 'a.txt'), 'two\n');
    await fs.mkdir(path.join(cwd, 'tools', 'pio', '.pio', 'build'), { recursive: true }); await fs.writeFile(path.join(cwd, 'tools', 'pio', '.pio', 'build', 'fw.bin'), 'bin');
    await fs.writeFile(path.join(cwd, '.vscode', 'c_cpp_properties.json'), '{}');
  });
  assert.deepEqual(git(cwd, 'show', '--name-only', '--format=', 'HEAD').split(/\r?\n/), ['a.txt']);
  const status = await postTo(h, { action: 'status' });
  assert.ok(status.rules.profiles.length >= 4);
});

test('the model judges unknown new artifacts; they are omitted, learned, and forgettable', async t => {
  const cwd = await repo(t);
  await fs.mkdir(path.join(cwd, 'src')); await fs.writeFile(path.join(cwd, 'src', 'keep.c'), 'int k;'); git(cwd, 'add', '.'); git(cwd, 'commit', '-q', '-m', 'src');
  const reply = JSON.stringify({ title: '新增驱动并编译', generated: ['out_fw/app.img', 'out_fw/app.sym', 'src/cache.dat', 'src/drv.c', 'a.txt', 'not/listed.x'] });
  const store = new Map(), h = harness(cwd, { llm: fakeLlm(`结果：${reply}`), store });
  await turn(h, 1, async () => {
    await fs.writeFile(path.join(cwd, 'a.txt'), 'two\n');                    // tracked: may never be omitted
    await fs.writeFile(path.join(cwd, 'src', 'cache.dat'), 'c');              // new, flagged, dir has tracked files
    await fs.writeFile(path.join(cwd, 'src', 'drv.c'), 'int d;');             // new, flagged, but source code is never omitted
    await fs.mkdir(path.join(cwd, 'out_fw')); await fs.writeFile(path.join(cwd, 'out_fw', 'app.img'), 'x'); await fs.writeFile(path.join(cwd, 'out_fw', 'app.sym'), 'y');
  });
  assert.match(git(cwd, 'log', '-1', '--format=%s'), /^DSH: 新增驱动并编译/);
  assert.deepEqual(git(cwd, 'show', '--name-only', '--format=', 'HEAD').split(/\r?\n/).sort(), ['a.txt', 'src/drv.c']);
  const status = await postTo(h, { action: 'status' });
  assert.deepEqual(status.rules.learned.sort(), ['/out_fw/', '/src/cache.dat']);
  assert.deepEqual(status.outcomes[0].omitted.sort(), ['out_fw/app.img', 'out_fw/app.sym', 'src/cache.dat']);
  // Next turn: learned artifacts do not dirty the baseline; the model now sees no candidates.
  const h2seen = [];
  const h2 = harness(cwd, { llm: fakeLlm('再改一次', h2seen), store, reload: true });
  await turn(h2, 2, () => fs.writeFile(path.join(cwd, 'a.txt'), 'three\n'));
  assert.equal(git(cwd, 'rev-list', '--count', 'HEAD'), '4');
  assert.doesNotMatch(h2seen[1].messages[0].content[0].text, /candidates/);
  // Forgetting a rule makes cache.dat count as user work again (dirty baseline -> skip).
  await postTo(h2, { action: 'forgetExclude', pattern: '/src/cache.dat' });
  await turn(h2, 3, () => fs.writeFile(path.join(cwd, 'a.txt'), 'four\n'));
  assert.equal(git(cwd, 'rev-list', '--count', 'HEAD'), '4');
  await assert.rejects(h2.tools.tgit_ai.execute({ action: 'forgetExclude', pattern: '/out_fw/' }, { agent: h2.agent }), /only the user/);
});

test('a hot reload during a turn keeps the baseline and still commits', async t => {
  const cwd = await repo(t), store = new Map();
  const first = harness(cwd, { store }), signal = new AbortController().signal;
  await first.emit('agent/status', { status: 'running' });
  await first.emit('agent/pre-step', { turn: 1, step: 0, messages: [], signal });
  await fs.writeFile(path.join(cwd, 'a.txt'), 'two\n');
  const second = harness(cwd, { store, reload: true });                                     // plugin re-applied with new code
  await second.emit('agent/pre-step', { turn: 1, step: 1, messages: [], signal });
  await second.emit('agent/turn-stopping', { turn: 1, signal });
  assert.equal(git(cwd, 'rev-list', '--count', 'HEAD'), '2');
});

test('judge replies are parsed defensively', async () => {
  const { parseJudge } = await import('../lib/summary.js');
  assert.deepEqual(parseJudge('```json\n{"title":"修复","generated":["a.o","x"]}\n```', ['a.o']), { title: '修复', generated: ['a.o'] });
  assert.deepEqual(parseJudge('修复串口', ['a.o']), { title: '修复串口', generated: [] });
  assert.deepEqual(parseJudge('{bad json', ['a.o']).generated, []);
  assert.deepEqual(parseJudge('{"title":"t","generated":["commands/x.mjs","src/main.c","docs/a.md","out/fw.bin"]}', ['commands/x.mjs', 'src/main.c', 'docs/a.md', 'out/fw.bin']).generated, ['out/fw.bin']);
});

test('one-click repository: plan with rules + AI, user ticks, init + first commit + enabled', async t => {
  const { initBlockedReason } = await import('../lib/init.js');
  assert.equal(initBlockedReason(os.homedir()), 'home_directory');
  assert.equal(initBlockedReason(path.parse(process.cwd()).root), 'drive_root');
  const base = process.env.TGAI_TEST_ROOT || path.parse(process.cwd()).root;
  const cwd = await fs.realpath(await fs.mkdtemp(path.join(base, 'tgai-init-')));
  t.after(() => fs.rm(cwd, { recursive: true, force: true, maxRetries: 5 }));
  const gcfg = path.join(cwd, '..', `${path.basename(cwd)}.gitconfig`);
  await fs.writeFile(gcfg, '[user]\n\tname = T\n\temail = t@example.invalid\n[core]\n\tautocrlf = false\n[commit]\n\tgpgsign = false\n');
  const prev = process.env.GIT_CONFIG_GLOBAL; process.env.GIT_CONFIG_GLOBAL = gcfg;
  t.after(() => { if (prev === undefined) delete process.env.GIT_CONFIG_GLOBAL; else process.env.GIT_CONFIG_GLOBAL = prev; return fs.rm(gcfg, { force: true }); });
  const put = async (p, c = 'x') => { await fs.mkdir(path.dirname(path.join(cwd, p)), { recursive: true }); await fs.writeFile(path.join(cwd, p), c); };
  await put('src/main.c', 'int main(){}'); await put('doc/spec.docx', 'PK\0doc'); await put('build/out.o'); await put('code.rar');
  await put('com14_log.txt'); await put('tmp/x.txt'); await put('outputs/a.bin'); await put('.env', 'K=1');
  await put('README.md', '# r'); await put('esp/sdkconfig', 'C=1'); await put('esp/main/CMakeLists.txt', 'idf_component_register()'); await put('proj/app.uvprojx', '<x/>'); await put('notes.txt'); await put('pic/a.png', 'png');
  const reply = JSON.stringify({ ignore: [{ pattern: '/outputs/', reason: '输出' }, { pattern: '*_log.txt', reason: '串口日志' }, { pattern: 'src/', reason: '误判' }, { pattern: '**', reason: '全部' }] });
  const h = harness(cwd, { roots: [], llm: fakeLlm(reply) });
  const status = await postTo(h, { action: 'status' });
  assert.equal(status.noRepo, true); assert.equal(status.initBlocked, null);
  await assert.rejects(h.tools.tgit_ai.execute({ action: 'planRepo' }, { agent: h.agent }), /only the user|Invalid|invalid/);
  const plan = await postTo(h, { action: 'planRepo' });
  const by = p => plan.entries.find(e => e.pattern === p);
  assert.ok(by('build/').locked); assert.ok(by('*.rar').checked); assert.ok(by('tmp/').checked);
  assert.equal(by('/outputs/').source, 'ai'); assert.ok(by('/outputs/').checked); assert.ok(by('*_log.txt').checked);
  assert.equal(by('src/').checked, false); assert.equal(by('src/').sourceFiles, 1);
  assert.equal(by('**'), undefined); assert.ok(by('.env / 密钥').locked);
  const checked = plan.entries.filter(e => e.checked).map(e => e.id);
  assert.equal((await postTo(h, { action: 'initRepo', planId: '00000000-0000-4000-8000-000000000000', checked })).reason, 'plan_expired');
  const done = await postTo(h, { action: 'initRepo', planId: plan.planId, checked });
  assert.equal(done.status, 'committed');
  const files = git(cwd, 'ls-files').split(/\r?\n/).sort();
  assert.deepEqual(files, ['.gitignore', 'esp/main/CMakeLists.txt', 'esp/sdkconfig', 'proj/app.uvprojx', 'src/main.c']);
  assert.equal(plan.modes.code.keptFiles + 1, files.length); // preview matches what Git really took (+ the new .gitignore)
  assert.ok(plan.modes.all.keptFiles > plan.modes.code.keptFiles);
  assert.match(await fs.readFile(path.join(cwd, '.gitignore'), 'utf8'), /\/outputs\/[\s\S]*\*_log\.txt/);
  assert.equal(git(cwd, 'status', '--porcelain'), '');
  const after = await postTo(h, { action: 'status' });
  assert.equal(after.authorized, true); assert.equal(after.noRepo, undefined);
  // Auto-commit works right away in the new repository.
  await turn(h, 1, async () => { await fs.writeFile(path.join(cwd, 'src', 'main.c'), 'int main(){return 0;}'); await fs.writeFile(path.join(cwd, 'CHANGELOG.md'), 'x'); });
  assert.deepEqual(git(cwd, 'show', '--name-only', '--format=', 'HEAD').split(/\r?\n/), ['src/main.c']);
  assert.equal(git(cwd, 'rev-list', '--count', 'HEAD'), '2');
  assert.equal((await postTo(h, { action: 'planRepo' })).reason, 'already_repository');
});

test('an existing repository can be switched to code-only (files stay on disk)', async t => {
  const cwd = await repo(t);
  await fs.mkdir(path.join(cwd, 'doc')); await fs.writeFile(path.join(cwd, 'doc', 'spec.docx'), 'PK'); await fs.writeFile(path.join(cwd, 'README.md'), '# r');
  await fs.writeFile(path.join(cwd, 'main.c'), 'int m;'); git(cwd, 'add', '.'); git(cwd, 'commit', '-q', '-m', 'all');
  const h = harness(cwd);
  const preview = await postTo(h, { action: 'codeOnly' });
  assert.deepEqual(preview.sample.sort(), ['README.md', 'a.txt', 'doc/spec.docx']);
  await fs.writeFile(path.join(cwd, 'main.c'), 'int n;');
  assert.equal((await postTo(h, { action: 'codeOnly', confirm: true })).reason, 'dirty_worktree');
  git(cwd, 'checkout', '--', 'main.c');
  const done = await postTo(h, { action: 'codeOnly', confirm: true });
  assert.equal(done.status, 'committed'); assert.equal(done.warning, undefined);
  assert.deepEqual(git(cwd, 'ls-files').split(/\r?\n/).sort(), ['.gitignore', 'main.c']);
  assert.equal(await fs.readFile(path.join(cwd, 'README.md'), 'utf8'), '# r');
  assert.equal(git(cwd, 'status', '--porcelain'), '');
  assert.equal((await postTo(h, { action: 'codeOnly' })).whitelisted, true);
  await assert.rejects(h.tools.tgit_ai.execute({ action: 'codeOnly', confirm: true }, { agent: h.agent }), /only the user|nvalid/);
});

test('manual folder selection: only chosen folders, per-folder auto detection, preview equals Git', async t => {
  const base = process.env.TGAI_TEST_ROOT || path.parse(process.cwd()).root;
  const cwd = await fs.realpath(await fs.mkdtemp(path.join(base, 'tgai-manual-')));
  t.after(() => fs.rm(cwd, { recursive: true, force: true, maxRetries: 5 }));
  const gcfg = `${cwd}.gitconfig`;
  await fs.writeFile(gcfg, '[user]\n\tname = T\n\temail = t@example.invalid\n[core]\n\tautocrlf = false\n[commit]\n\tgpgsign = false\n');
  const prev = process.env.GIT_CONFIG_GLOBAL; process.env.GIT_CONFIG_GLOBAL = gcfg;
  t.after(() => { if (prev === undefined) delete process.env.GIT_CONFIG_GLOBAL; else process.env.GIT_CONFIG_GLOBAL = prev; return fs.rm(gcfg, { force: true }); });
  const put = async (p, c = 'x') => { await fs.mkdir(path.dirname(path.join(cwd, p)), { recursive: true }); await fs.writeFile(path.join(cwd, p), c); };
  for (const p of ['main.c', 'README.md', 'esp/CMakeLists.txt', 'esp/src/a.c', 'esp/docs/x.md', 'esp/build/o.c', 'esp/vendorlib/any.md', 'esp/vendorlib/bin/tool',
    'tool/t.py', 'tool/notes.md', 'tool/build/out.bin', 'tool/cache/c.py', 'skip/s.c', 'skip/keep/k.c', 'skip/keep/k.md', 'my docs/a.c', 'tool/.env']) await put(p);
  const h = harness(cwd, { roots: [], llm: fakeLlm('{"ignore":[]}') });
  const plan = await postTo(h, { action: 'planRepo' });
  assert.ok(plan.tree.some(r => r.path === 'esp/vendorlib' && r.depth === 2));
  const selection = [{ dir: '', auto: true }, { dir: 'esp', auto: true }, { dir: 'esp/vendorlib', auto: false }, { dir: 'tool', auto: false },
    { dir: 'tool/cache', include: false, auto: true }, { dir: 'skip/keep', auto: true }, { dir: 'my docs', auto: false }, { dir: '../evil', auto: false }];
  const checked = plan.entries.filter(e => e.checked).map(e => e.id);
  const preview = await postTo(h, { action: 'planPreview', planId: plan.planId, mode: 'manual', checked, selection });
  assert.equal((await postTo(h, { action: 'initRepo', planId: plan.planId, mode: 'manual', checked, selection: [] })).reason, 'nothing_selected');
  const done = await postTo(h, { action: 'initRepo', planId: plan.planId, mode: 'manual', checked, selection });
  assert.equal(done.status, 'committed', JSON.stringify(done));
  const files = git(cwd, 'ls-files').split(/\r?\n/).sort();
  assert.deepEqual(files, ['.gitignore', 'esp/CMakeLists.txt', 'esp/src/a.c', 'esp/vendorlib/any.md', 'esp/vendorlib/bin/tool', 'main.c', 'my docs/a.c', 'skip/keep/k.c', 'tool/build/out.bin', 'tool/notes.md', 'tool/t.py']);
  assert.equal(preview.keptFiles + 1, files.length);
  assert.equal(git(cwd, 'status', '--porcelain'), '');
  // Later AI turns follow the same rules: a new doc in an auto folder stays out, one in an "all" folder goes in.
  await turn(h, 1, async () => { await put('esp/src/b.c'); await put('esp/docs/y.md'); await put('tool/more.md'); await put('skip/n.c'); });
  assert.deepEqual(git(cwd, 'show', '--name-only', '--format=', 'HEAD').split(/\r?\n/).sort(), ['esp/src/b.c', 'tool/more.md']);
});

test('a UTF-8 BOM in an existing .gitignore does not break its first rule', async () => {
  const { gitignoreText, manualGitignore } = await import('../lib/init.js');
  for (const text of [gitignoreText([], '\uFEFFnode_modules/\n', 'code'), manualGitignore([], [{ dir: 'a', auto: true }], '\uFEFFnode_modules/\n')]) {
    assert.ok(!text.includes('\uFEFF')); assert.match(text, /^node_modules\/$/m);
  }
});

test('folder picker first: list one level, scan only the selection, skip artifact folders, nested repos left out', async t => {
  const base = process.env.TGAI_TEST_ROOT || path.parse(process.cwd()).root;
  const cwd = await fs.realpath(await fs.mkdtemp(path.join(base, 'tgai-pick-')));
  t.after(() => fs.rm(cwd, { recursive: true, force: true, maxRetries: 5 }));
  const gcfg = `${cwd}.gitconfig`;
  await fs.writeFile(gcfg, '[user]\n\tname = T\n\temail = t@example.invalid\n[core]\n\tautocrlf = false\n[commit]\n\tgpgsign = false\n');
  const prev = process.env.GIT_CONFIG_GLOBAL; process.env.GIT_CONFIG_GLOBAL = gcfg;
  t.after(() => { if (prev === undefined) delete process.env.GIT_CONFIG_GLOBAL; else process.env.GIT_CONFIG_GLOBAL = prev; return fs.rm(gcfg, { force: true }); });
  const put = async (p, c = 'x') => { await fs.mkdir(path.dirname(path.join(cwd, p)), { recursive: true }); await fs.writeFile(path.join(cwd, p), c); };
  for (const p of ['app/main.c', 'app/README.md', 'app/node_modules/m/index.js', 'app/build/x.c', 'app/lib/ext/.git/HEAD', 'app/lib/ext/e.c', 'app/lib/own.c', 'huge/a.c', 'notes.md']) await put(p);
  const h = harness(cwd, { roots: [], llm: fakeLlm('{"ignore":[]}') });
  const top = await postTo(h, { action: 'listDirs' });
  assert.deepEqual(top.dirs.map(d => d.name), ['app', 'huge']); assert.equal(top.files, 1);
  const lib = await postTo(h, { action: 'listDirs', dir: 'app/lib' });
  assert.equal(lib.dirs.find(d => d.name === 'ext').nestedRepo, true);
  assert.equal((await postTo(h, { action: 'listDirs', dir: 'app' })).dirs.find(d => d.name === 'node_modules').artifact, true);
  assert.equal((await postTo(h, { action: 'listDirs', dir: '../..' })).error, 'invalid_dir');
  assert.equal((await postTo(h, { action: 'planRepo', selection: [] })).reason, 'nothing_selected');
  const plan = await postTo(h, { action: 'planRepo', selection: [{ dir: 'app', auto: true }] });
  assert.equal(plan.totalFiles, 3, 'only app/ is scanned, node_modules/build and the nested repo are not listed');
  assert.ok(plan.skippedCount >= 2); assert.ok(plan.entries.some(e => e.source === 'nested' && e.pattern === '/app/lib/ext/'));
  const checked = plan.entries.filter(e => e.checked).map(e => e.id);
  const preview = await postTo(h, { action: 'planPreview', planId: plan.planId, checked });
  const done = await postTo(h, { action: 'initRepo', planId: plan.planId, checked });
  assert.equal(done.status, 'committed', JSON.stringify(done));
  const files = git(cwd, 'ls-files').split(/\r?\n/).sort();
  assert.deepEqual(files, ['.gitignore', 'app/lib/own.c', 'app/main.c']);
  assert.equal(preview.keptFiles + 1, files.length);
  assert.equal(git(cwd, 'status', '--porcelain'), '');
});

test('csb regressions: Vivado/Vitis/Python detected, unselected nested repo ignored, empty repo can be set up again', async t => {
  const base = process.env.TGAI_TEST_ROOT || path.parse(process.cwd()).root;
  const cwd = await fs.realpath(await fs.mkdtemp(path.join(base, 'tgai-csb-')));
  t.after(() => fs.rm(cwd, { recursive: true, force: true, maxRetries: 5 }));
  const gcfg = `${cwd}.gitconfig`;
  await fs.writeFile(gcfg, '[user]\n\tname = T\n\temail = t@example.invalid\n[core]\n\tautocrlf = false\n[commit]\n\tgpgsign = false\n');
  const prev = process.env.GIT_CONFIG_GLOBAL; process.env.GIT_CONFIG_GLOBAL = gcfg;
  t.after(() => { if (prev === undefined) delete process.env.GIT_CONFIG_GLOBAL; else process.env.GIT_CONFIG_GLOBAL = prev; return fs.rm(gcfg, { force: true }); });
  const put = async (p, c = 'x') => { await fs.mkdir(path.dirname(path.join(cwd, p)), { recursive: true }); await fs.writeFile(path.join(cwd, p), c); };
  for (const p of ['z/viv/p.xpr', 'z/viv/p.srcs/sources_1/new/top.v', 'z/viv/p.gen/sources_1/bd/sys/hdl/sys.v', 'z/viv/p.runs/synth_1/x.tcl', 'z/viv/p.cache/a.json',
    'z/ws/_ide/launch.json', 'z/ws/app/vitis-comp.json', 'z/ws/app/src/main.c', 'z/ws/app/build/x.c', 'z/ws/plat/vitis-comp.json',
    'z/ws/plat/ps7_cortexa9_0/standalone_domain/bsp/libsrc/drv/x.c', 'z/ws/plat/ps7_cortexa9_0/standalone_domain/bsp/include/x.h', 'z/ws/plat/export/plat/sw/a.h',
    'z/ws/plat/fsbl/CMakeLists.txt', 'z/ws/plat/fsbl/main.c', 'z/ws/plat/fsbl/build_jtag/x.c', 'z/tool/app.py', 'z/tool/__pycache__/app.cpython-311.pyc', 'z/constraints/pins.xdc',
    'other/big.c']) await put(p);
  await fs.mkdir(path.join(cwd, 'empty_nested'), { recursive: true });
  execFileSync('git', ['init', '-q'], { cwd: path.join(cwd, 'empty_nested') }); // unselected repo without commits used to break `git add -A`
  execFileSync('git', ['init', '-q'], { cwd }); // leftover empty repository from a failed attempt
  await fs.writeFile(path.join(cwd, '.gitignore'), '# ---- TortoiseGit AI：手动选择的文件夹（未选择的不纳入；后面的规则优先） ----\n*\n!*/\n!/.gitignore\nmine.tmp\n');
  const h = harness(cwd, { roots: [], llm: fakeLlm('{"ignore":[]}') });
  const st = await postTo(h, { action: 'status' });
  assert.equal(st.noRepo, true); assert.equal(st.emptyRepo, true);
  const plan = await postTo(h, { action: 'planRepo', selection: [{ dir: 'z', auto: true }] });
  assert.equal(plan.ok, true, JSON.stringify(plan));
  const ids = new Set(plan.profiles.map(p => p.id));
  for (const id of ['vivado', 'vitis', 'vitis-workspace', 'python', 'vivado-hdl']) assert.ok(ids.has(id), `missing ${id}: ${[...ids]}`);
  const checked = plan.entries.filter(e => e.checked).map(e => e.id);
  const done = await postTo(h, { action: 'initRepo', planId: plan.planId, checked });
  assert.equal(done.status, 'committed', JSON.stringify(done));
  const files = git(cwd, 'ls-files').split(/\r?\n/).sort();
  assert.deepEqual(files, ['.gitignore', 'z/constraints/pins.xdc', 'z/tool/app.py', 'z/viv/p.srcs/sources_1/new/top.v', 'z/viv/p.xpr', 'z/ws/app/src/main.c', 'z/ws/app/vitis-comp.json', 'z/ws/plat/fsbl/CMakeLists.txt', 'z/ws/plat/fsbl/main.c', 'z/ws/plat/vitis-comp.json']);
  const gi = await fs.readFile(path.join(cwd, '.gitignore'), 'utf8');
  assert.equal(gi.split('# ---- TortoiseGit AI：手动选择').length, 2, 'old generated block replaced, not stacked');
  assert.match(gi, /^mine\.tmp$/m, 'user rules kept');
  assert.equal(git(cwd, 'status', '--porcelain'), '');
});

test('Quartus project: keeps project/HDL/IP, drops db, output_files and reports', async t => {
  const base = process.env.TGAI_TEST_ROOT || path.parse(process.cwd()).root;
  const cwd = await fs.realpath(await fs.mkdtemp(path.join(base, 'tgai-qts-')));
  t.after(() => fs.rm(cwd, { recursive: true, force: true, maxRetries: 5 }));
  const gcfg = `${cwd}.gitconfig`;
  await fs.writeFile(gcfg, '[user]\n\tname = T\n\temail = t@example.invalid\n[core]\n\tautocrlf = false\n[commit]\n\tgpgsign = false\n');
  const prev = process.env.GIT_CONFIG_GLOBAL; process.env.GIT_CONFIG_GLOBAL = gcfg;
  t.after(() => { if (prev === undefined) delete process.env.GIT_CONFIG_GLOBAL; else process.env.GIT_CONFIG_GLOBAL = prev; return fs.rm(gcfg, { force: true }); });
  const put = async (p, c = 'x') => { await fs.mkdir(path.dirname(path.join(cwd, p)), { recursive: true }); await fs.writeFile(path.join(cwd, p), c); };
  for (const p of ['fpga/top.qpf', 'fpga/top.qsf', 'fpga/top.sdc', 'fpga/rtl/top.v', 'fpga/ip/pll.qip', 'fpga/ip/pll.v', 'fpga/soc.qsys', 'fpga/ram.mif', 'fpga/top.qws',
    'fpga/db/top.db_info', 'fpga/db/x.v', 'fpga/incremental_db/README', 'fpga/output_files/top.sof', 'fpga/output_files/top.fit.rpt', 'fpga/top.map.summary', 'fpga/PLLJ_PLLSPE_INFO.txt',
    'fpga/simulation/modelsim/top.vo', 'fpga/simulation/modelsim/tb.do', 'fpga/simulation/modelsim/rtl_work/_info', 'fpga/simulation/modelsim/transcript', 'fpga/simulation/modelsim/vsim.wlf']) await put(p);
  const h = harness(cwd, { roots: [], llm: fakeLlm('{"ignore":[]}') });
  const plan = await postTo(h, { action: 'planRepo', selection: [{ dir: 'fpga', auto: true }] });
  assert.ok(plan.profiles.some(p => p.id === 'quartus'), JSON.stringify(plan.profiles));
  assert.ok(plan.profiles.some(p => p.id === 'modelsim'));
  const done = await postTo(h, { action: 'initRepo', planId: plan.planId, checked: plan.entries.filter(e => e.checked).map(e => e.id) });
  assert.equal(done.status, 'committed', JSON.stringify(done));
  assert.deepEqual(git(cwd, 'ls-files').split(/\r?\n/).sort(), ['.gitignore', 'fpga/ip/pll.qip', 'fpga/ip/pll.v', 'fpga/ram.mif', 'fpga/rtl/top.v', 'fpga/simulation/modelsim/tb.do', 'fpga/soc.qsys', 'fpga/top.qpf', 'fpga/top.qsf', 'fpga/top.sdc']);
  assert.equal(git(cwd, 'status', '--porcelain'), '');
});

test('cross-tool history, branches, switch, restore: read freely, change only with confirm', async t => {
  const cwd = await repo(t), h = harness(cwd);
  const call = async a => JSON.parse(await h.tools.tgit_ai.execute(a, { agent: h.agent }));
  await turn(h, 1, () => fs.writeFile(path.join(cwd, 'a.txt'), 'two\n'));
  // another tool (Factory) commits as well
  await fs.writeFile(path.join(cwd, 'b.txt'), 'b\n'); git(cwd, 'add', '.');
  git(cwd, 'commit', '-q', '-m', 'Factory: 新增 b\n\nAI-Session: droid-1\nAI-Tool: Factory');
  const hist = await call({ action: 'history', limit: 10 });
  assert.deepEqual(hist.commits.map(c => c.tool), ['Factory', 'DSH', 'human']);
  assert.deepEqual(hist.commits[0].files, ['A b.txt']);
  assert.deepEqual((await call({ action: 'history', tool: 'factory' })).commits.map(c => c.subject), ['Factory: 新增 b']);
  assert.equal((await call({ action: 'history', path: 'a.txt' })).commits.length, 2);
  const [factory, dsh, init] = hist.commits;
  await assert.rejects(h.tools.tgit_ai.execute({ action: 'restore', sha: dsh.sha }, { agent: h.agent }), /confirm:true/);
  // restore the version before the DSH change, as a new commit
  const r = await call({ action: 'restore', sha: dsh.sha, before: true, confirm: true });
  assert.equal(r.status, 'restored', JSON.stringify(r));
  assert.equal(await fs.readFile(path.join(cwd, 'a.txt'), 'utf8'), 'one\n');
  await assert.rejects(fs.stat(path.join(cwd, 'b.txt')));
  assert.match(git(cwd, 'log', '-1', '--format=%B'), /^DSH: 恢复到 .*之前.*\n\nAI-Session: sess-1\n(?:.*\n)*AI-Tool: DSH\nAI-Restore: /);
  assert.equal(git(cwd, 'rev-list', '--count', 'HEAD'), '4', 'history kept');
  // branch at an old commit and switch to it, then back
  const b = await call({ action: 'branch', name: 'try-old', sha: factory.sha, checkout: true, confirm: true });
  assert.deepEqual([b.status, b.switched], ['created', true]);
  assert.equal(git(cwd, 'rev-parse', '--abbrev-ref', 'HEAD'), 'try-old');
  assert.equal((await call({ action: 'branch', name: 'try-old', confirm: true })).reason, 'branch_exists');
  assert.equal((await call({ action: 'branch', name: 'bad..name', confirm: true })).reason, 'invalid_branch_name');
  const list = await call({ action: 'branches' });
  assert.deepEqual(list.branches.map(x => x.name).sort(), ['main', 'try-old']); assert.equal(list.current, 'try-old');
  await fs.writeFile(path.join(cwd, 'a.txt'), 'dirty\n');
  assert.equal((await call({ action: 'switch', name: 'main', confirm: true })).reason, 'dirty_worktree');
  await fs.writeFile(path.join(cwd, 'a.txt'), 'two\n');
  assert.equal((await call({ action: 'switch', name: 'main', confirm: true })).status, 'switched');
  const d = await call({ action: 'switch', sha: init.sha, confirm: true });
  assert.equal(d.status, 'detached'); assert.match(d.warning, /detached_head/);
  assert.equal((await call({ action: 'restore', sha: init.sha, confirm: true })).reason, 'detached_head');
  assert.equal((await call({ action: 'switch', name: 'main', confirm: true })).status, 'switched');
});
