window.__ModuleLoader__.load({
  id: '@local/tortoisegit-ai',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'tortoisegit-ai';
    const zh = { title: '小乌龟 AI 版本记录', notEnabled: '未启用', enableRepo: '在此仓库启用自动提交', disableRepo: '在此仓库停用', enableHint: '启用后，AI 每轮修改结束会自动提交到当前分支（只提交 AI 本轮的改动；轮次开始时有未提交修改则跳过）。', sessionOn: '本会话自动提交：开', sessionOff: '本会话自动提交：关', refresh: '刷新', log: '日志', compare: '对比', status: '工作区', graph: '版本图', undo: '撤销', cancel: '取消', confirm: '确认撤销', warning: '将创建一个新的 revert 提交，原有历史保留。', empty: '本会话暂无 AI 提交。', failed: '操作失败', latest: '最近结果', history: '本会话 AI 提交', native: '打开 TortoiseGit 原生窗口', committed: '已提交', skipped: '已跳过', error: '出错', reverted: '已撤销', conflict: '撤销冲突', close: '关闭', rules: '不自动提交的文件', detected: '识别到的工程', none: '未识别到特定工具链（使用内置清单 + .gitignore）', learned: 'AI 判定的产物', forget: '恢复提交', redetect: '重新识别', patterns: '条规则', omitted: '已排除产物', noRepo: '未建仓库', initHint: '当前目录还不是 Git 仓库。一键新建会先分析目录（内置规则 + 识别工具链 + AI 检查），列出要忽略的文件供你确认，然后建仓库、做初始提交并开启自动提交。', initStart: '一键新建仓库', analyzing: '正在分析目录…（AI 检查需要忽略的文件，约 10–30 秒）', initBlocked: '这个目录不适合自动建仓库', blocked_drive_root: '盘符根目录', blocked_home_directory: '用户主目录', blocked_user_folder: '桌面/文档/下载等用户目录', blocked_system_folder: '系统或程序目录', too_many_files: '文件太多（超过 5 万个），可能不是工程目录', ignoreList: '将写入 .gitignore（可取消勾选）', willCommit: '初始提交约', ignored: '忽略', files: '个文件', aiFailed: 'AI 建议不可用，仅使用规则', aiTag: 'AI', sourceWarn: '含源码/文档类文件，默认不忽略', create: '创建仓库并初始提交', creating: '正在创建…', identity: '未配置 Git 用户名/邮箱：请在 TortoiseGit 设置 → Git 中填写后重试。', dirLabel: '目录', modeLabel: '纳入范围', modeCode: '仅代码（推荐）', modeAll: '全部文件', modeCodeHint: '只纳入源码、头文件、构建脚本、工程文件（uvprojx/ewp/ioc/CMakeLists…）和代码配置（json/yaml/ini/sdkconfig…）；md、Word、Excel、PDF、txt、图片、压缩包等一律不纳入。以后新建的文档也不会被自动提交。', modeAllHint: '纳入目录下所有文件，只排除下面勾选的规则。', includes: '将纳入', ignoreListCode: '代码文件中再排除（可取消勾选）', noEntries: '无需额外排除', nothing_to_commit: '没有可提交的文件', codeOnly: '仅保留代码文件', codeOnlyAsk: '将停止跟踪非代码文件（md、Word、Excel、txt、图片等；文件仍保留在磁盘上，可随时恢复）：', codeOnlyRule: '已跟踪的都是代码文件；确认后写入“仅代码”规则，以后新建的文档也不会被提交。', codeOnlyDone: '此仓库已经是“仅代码”模式。', codeOnlyConfirm: '确认并提交', dirtyFirst: '请先提交或还原这些修改', modeManual: '手动选择', modeManualHint: '勾选要纳入的文件夹，未勾选的不纳入；子文件夹默认跟随上级，可单独取消或改设置。勾“自动识别”的文件夹只纳入代码并屏蔽编译产物；不勾则该文件夹全部纳入。', manualTree: '文件夹', rootFiles: '(根目录下的文件)', collapse: '收起', expand: '展开', autoShort: '识别后', autoHint: '只纳入代码文件，并自动屏蔽编译产物、缓存、日志等', autoDetect: '自动识别', ignoreListManual: '“自动识别”的文件夹中再排除（可取消勾选）', pickFolders: '请至少勾选一个文件夹', nothing_selected: '请至少勾选一个文件夹', pickHint: '先勾选要纳入的文件夹（未勾选的不纳入），再点“分析”。只扫描勾选的文件夹，大目录也能用。勾“自动识别”的文件夹只纳入代码并屏蔽编译产物；不勾则全部纳入。子文件夹跟随上级，可展开单独设置。', allAuto: '全选·自动识别', allAll: '全选·全部纳入', clearPick: '清空', analyzePicked: '分析所选文件夹', loading: '读取中…', tooManyDirs: '（子文件夹过多，只显示前 500 个）', artifactTag: '产物', nestedTag: '独立仓库，不能纳入', scope: '范围', allIn: '全部纳入', excluded: '排除', skippedDirs: '自动识别的文件夹里未展开扫描的产物文件夹（node_modules/build 等，已写入忽略规则）：', scanned: '共扫描', backToPick: '返回修改选择', emptyRepo: '这里已有一个空仓库（还没有任何提交，可能是上次建仓没成功留下的），可以直接重新建仓。', selection_too_large: '所选文件夹里文件太多（超过 5 万个），请少选一些或打开“自动识别”' };
    const en = { title: 'TortoiseGit AI history', notEnabled: 'Off', enableRepo: 'Enable auto-commit for this repository', disableRepo: 'Disable for this repository', enableHint: 'When enabled, each AI turn that edits files is committed to the current branch (only the AI\'s own changes; turns that start with uncommitted changes are skipped).', sessionOn: 'Session auto-commit: on', sessionOff: 'Session auto-commit: off', refresh: 'Refresh', log: 'Log', compare: 'Compare', status: 'Working tree', graph: 'Graph', undo: 'Revert', cancel: 'Cancel', confirm: 'Confirm revert', warning: 'Creates a new revert commit; history is kept.', empty: 'No AI commits in this session yet.', failed: 'Operation failed', latest: 'Latest', history: 'AI commits in this session', native: 'Opens a native TortoiseGit window', committed: 'Committed', skipped: 'Skipped', error: 'Error', reverted: 'Reverted', conflict: 'Revert conflict', close: 'Close', rules: 'Never auto-committed', detected: 'Detected projects', none: 'No specific toolchain detected (built-in list + .gitignore)', learned: 'Judged artifacts (AI)', forget: 'Commit again', redetect: 'Re-detect', patterns: 'rules', omitted: 'Artifacts excluded', noRepo: 'No repo', initHint: 'This folder is not a Git repository yet. One click analyses it (built-in rules, toolchain detection, AI review), lists what will be ignored for you to confirm, then creates the repository, makes the first commit and enables auto-commit.', initStart: 'Create repository', analyzing: 'Analysing folder… (AI review, ~10–30 s)', initBlocked: 'Not a suitable folder for a repository', blocked_drive_root: 'drive root', blocked_home_directory: 'home folder', blocked_user_folder: 'Desktop/Documents/Downloads', blocked_system_folder: 'system or program folder', too_many_files: 'too many files (over 50k)', ignoreList: 'Written to .gitignore (untick to keep)', willCommit: 'First commit ≈', ignored: 'ignored', files: 'files', aiFailed: 'AI suggestions unavailable; rules only', aiTag: 'AI', sourceWarn: 'contains source/doc files; not ignored by default', create: 'Create repository and commit', creating: 'Creating…', identity: 'Git user name/email missing: set them in TortoiseGit Settings → Git, then retry.', dirLabel: 'Folder', modeLabel: 'Scope', modeCode: 'Code only (recommended)', modeAll: 'All files', modeCodeHint: 'Only sources, headers, build scripts, project files (uvprojx/ewp/ioc/CMakeLists…) and code configuration (json/yaml/ini/sdkconfig…); md, Word, Excel, PDF, txt, images and archives stay out, now and later.', modeAllHint: 'Everything in the folder except the ticked rules below.', includes: 'Includes', ignoreListCode: 'Also exclude among code files (untick to keep)', noEntries: 'Nothing else to exclude', nothing_to_commit: 'Nothing to commit', codeOnly: 'Keep code only', codeOnlyAsk: 'Stop tracking non-code files (md, Word, Excel, txt, images…; they stay on disk):', codeOnlyRule: 'Only code files are tracked; confirming writes the code-only rules so new documents stay out.', codeOnlyDone: 'This repository is already code-only.', codeOnlyConfirm: 'Confirm and commit', dirtyFirst: 'Commit or revert these changes first', modeManual: 'Pick folders', modeManualHint: 'Tick the folders to include; unticked ones stay out. Subfolders follow their parent unless changed. Folders with "Auto detect" keep only code and drop build output; without it, everything in the folder is included.', manualTree: 'Folders', rootFiles: '(files in the root)', collapse: 'Collapse', expand: 'Expand', autoShort: 'auto', autoHint: 'Keep only code files and drop build output, caches and logs', autoDetect: 'Auto detect', ignoreListManual: 'Also exclude in auto-detect folders (untick to keep)', pickFolders: 'Tick at least one folder', nothing_selected: 'Tick at least one folder', pickHint: 'Tick the folders to include (unticked ones stay out), then Analyse. Only ticked folders are scanned, so huge trees work. "Auto detect" keeps only code and drops build output; without it the folder is included as is. Subfolders follow their parent; expand to change them.', allAuto: 'All · auto detect', allAll: 'All · everything', clearPick: 'Clear', analyzePicked: 'Analyse selected folders', loading: 'Loading…', tooManyDirs: '(too many subfolders; first 500 shown)', artifactTag: 'artifacts', nestedTag: 'separate repository, cannot be included', scope: 'Scope', allIn: 'everything', excluded: 'excluded', skippedDirs: 'Artifact folders not scanned in auto-detect folders (node_modules/build…, ignored by rule):', scanned: 'scanned', backToPick: 'Back to folders', emptyRepo: 'An empty repository (no commits yet, probably from an unfinished setup) is here; you can set it up again.', selection_too_large: 'Too many files in the selected folders (over 50k); pick fewer or turn on auto detect' };
    const css = `.tgai-wrap{position:relative;display:inline-flex}
.tgai-pill{display:inline-flex;align-items:center;gap:5px;font:inherit;font-size:12px;line-height:20px;color:var(--dsw-alias-label-secondary);background:transparent;border:0;border-radius:6px;padding:2px 6px;cursor:pointer;white-space:nowrap}
.tgai-pill:hover,.tgai-pill[aria-expanded=true]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.tgai-pill:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.tgai-pill code{font-family:var(--dsw-alias-font-mono,monospace);font-size:11px}
.tgai-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-label-tertiary,#aaa)}
.tgai-dot[data-on=true]{background:var(--dsw-alias-state-success-primary,#22a06b)}
.tgai-pop{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);width:min(460px,92vw);max-height:70vh;overflow:auto;z-index:50;font-size:12px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:10px 12px;box-shadow:0 8px 24px rgba(0,0,0,.12);box-sizing:border-box;text-align:left;white-space:normal}
.tgai-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.tgai-head{justify-content:space-between;margin-bottom:6px}
.tgai-pop button{font:inherit;color:inherit;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);padding:2px 8px;border-radius:6px;cursor:pointer}
.tgai-pop button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.tgai-pop button:disabled{opacity:.55;cursor:default}
.tgai-pop button.tgai-primary{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.tgai-pop button.tgai-x{border:0;background:transparent;padding:0 4px;font-size:14px}
.tgai-pop p{margin:4px 0;overflow-wrap:anywhere}
.tgai-pop small{color:var(--dsw-alias-label-secondary)}
.tgai-error{color:var(--dsw-alias-state-error-primary)}
.tgai-entry{border-top:1px solid var(--dsw-alias-border-l1);padding:6px 0}
.tgai-pop code{font-family:var(--dsw-alias-font-mono,monospace)}
.tgai-section{margin-top:8px;font-weight:600}
.tgai-chip{display:inline-flex;align-items:center;gap:2px;padding:0 6px;border-radius:10px;background:var(--dsw-alias-bg-layer-2);font-family:var(--dsw-alias-font-mono,monospace);font-size:11px}
.tgai-pop .tgai-chip button{border:0;background:transparent;padding:0 2px;font-size:11px}
.tgai-pop details summary{cursor:pointer;color:var(--dsw-alias-label-secondary)}
.tgai-plan{max-height:240px;overflow:auto;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:4px 6px;margin:4px 0}
.tgai-plan label{display:flex;gap:6px;align-items:flex-start;padding:2px 0;cursor:pointer}
.tgai-plan label[data-locked=true]{cursor:default;opacity:.75}
.tgai-pop button.tgai-twisty{border:0;background:transparent;padding:0;width:16px;flex:0 0 16px}
.tgai-tag{font-size:10px;padding:0 4px;border-radius:4px;background:var(--dsw-alias-brand-primary);color:#fff}
.tgai-confirm{padding:6px 8px;margin-top:4px;background:var(--dsw-alias-bg-layer-2);border-radius:6px}`;
    const api = async (path, init) => {
      const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...init });
      const value = await response.json().catch(() => ({}));
      if (!response.ok || value.ok === false) throw new Error(value.reason || `HTTP ${response.status}`);
      return value;
    };
    const icon = h('svg', { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, 'aria-hidden': true },
      h('circle', { cx: 8, cy: 8, r: 2.5 }), h('path', { d: 'M1 8h4.5M10.5 8H15' }));
    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'tortoisegit-ai: dictionaries');
        const bound = ctx.locale.bind(NS);
        function Pill(props) {
          const t = typeof props.t === 'function' ? props.t : bound;
          const sessionId = props.sessionId;
          const [data, setData] = React.useState(null);
          const [open, setOpen] = React.useState(false);
          const [busy, setBusy] = React.useState(false);
          const [error, setError] = React.useState('');
          const [confirmation, setConfirmation] = React.useState(null);
          const [plan, setPlan] = React.useState(null);
          const [picked, setPicked] = React.useState(null);
          const [phase, setPhase] = React.useState('');
          const [codePreview, setCodePreview] = React.useState(null);
          const [sel, setSel] = React.useState(() => new Map()); // folder picker: dir -> { include, auto }
          const [expanded, setExpanded] = React.useState(() => new Set());
          const [listing, setListing] = React.useState(() => new Map()); // dir -> { files, dirs }
          const [preview, setPreview] = React.useState(null);
          const selection = () => [...sel].map(([dir, v]) => ({ dir, include: v.include, auto: v.auto }));
          React.useEffect(() => {
            if (!plan || !picked) { setPreview(null); return undefined; }
            let live = true;
            const timer = setTimeout(async () => {
              try { const v = await post({ action: 'planPreview', planId: plan.planId, checked: [...picked] }); if (live && alive.current && v.ok) setPreview(v); } catch { /* keep the last preview */ }
            }, 150);
            return () => { live = false; clearTimeout(timer); };
          }, [plan, picked]);
          async function loadDir(dir) {
            if (listing.has(dir)) return;
            try { const v = await post({ action: 'listDirs', dir }); if (alive.current && v.ok) setListing(prev => new Map(prev).set(dir, v)); } catch (e) { if (alive.current) setError(String(e.message || e)); }
          }
          React.useEffect(() => { if (open && data?.noRepo && !data.initBlocked && !listing.has('')) loadDir(''); }, [open, data?.noRepo, data?.initBlocked]);
          const alive = React.useRef(true);
          const wrap = React.useRef(null);
          const refresh = React.useCallback(async () => {
            if (!sessionId) return;
            try { const value = await api(`api/tortoisegit-ai.status?session=${encodeURIComponent(sessionId)}`); if (alive.current) setData(value); }
            catch (e) { if (alive.current) setError(String(e.message || e)); }
          }, [sessionId]);
          React.useEffect(() => {
            alive.current = true; setData(null); setError(''); setOpen(false);
            setPlan(null); setPicked(null); setSel(new Map()); setListing(new Map()); setExpanded(new Set()); setCodePreview(null);
            refresh();
            const timer = window.setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 5000);
            return () => { alive.current = false; window.clearInterval(timer); };
          }, [refresh]);
          React.useEffect(() => {
            if (!open) return undefined;
            const onDown = e => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
            const onKey = e => { if (e.key === 'Escape') setOpen(false); };
            document.addEventListener('pointerdown', onDown); document.addEventListener('keydown', onKey);
            return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
          }, [open]);
          async function act(args) {
            if (busy) return;
            setBusy(true); setError('');
            try {
              const value = await api('api/tortoisegit-ai.action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ session: sessionId, ...args }) });
              if (['error', 'conflict'].includes(value.status) || (value.status === 'skipped' && args.action === 'undo')) throw new Error(value.error || value.reason || t('failed'));
              await refresh();
            } catch (e) { if (alive.current) setError(String(e.message || e)); }
            finally { if (alive.current) { setBusy(false); setConfirmation(null); } }
          }
          const human = n => n >= 1 << 30 ? `${(n / (1 << 30)).toFixed(1)} GB` : n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`;
          const post = body => api('api/tortoisegit-ai.action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ session: sessionId, ...body }) });
          async function startPlan() {
            setPhase('analyzing'); setError(''); setPlan(null);
            try {
              const value = await post({ action: 'planRepo', selection: selection() });
              if (value.status === 'error') throw new Error(t(value.reason) !== value.reason ? t(value.reason) : value.reason);
              if (alive.current) { setPlan(value); setPicked(new Set(value.entries.filter(e => e.checked).map(e => e.id))); }
            } catch (e) { if (alive.current) setError(String(e.message || e)); }
            finally { if (alive.current) setPhase(''); }
          }
          async function createRepo() {
            setPhase('creating'); setError('');
            try {
              const value = await post({ action: 'initRepo', planId: plan.planId, checked: [...picked] });
              if (value.status === 'error' || value.status === 'skipped') throw new Error(value.reason === 'git_identity_missing' ? t('identity') : (t(value.reason) !== value.reason ? t(value.reason) : (value.error || value.reason)));
              if (alive.current) { setPlan(null); setPicked(null); setSel(new Map()); setListing(new Map()); setExpanded(new Set()); }
              await refresh();
            } catch (e) { if (alive.current) setError(String(e.message || e)); }
            finally { if (alive.current) setPhase(''); }
          }
          if (data?.noRepo && data.initBlocked && !open) return null; // home/system folders: stay out of the way
          if (data?.noRepo) {
            const toggle = id => setPicked(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
            // Folder picker: the deepest explicit choice on the folder or an ancestor decides.
            const parentOf = dir => (dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : null);
            const inherited = dir => { for (let p = parentOf(dir); p !== null; p = parentOf(p)) if (sel.has(p)) return sel.get(p); return null; };
            const effective = dir => sel.get(dir) || (dir === '' ? null : inherited(dir));
            const same = (a, b) => (!a || !a.include) ? (!b || !b.include) : (!!b && b.include && a.auto === b.auto);
            const choose = (dir, value) => setSel(prev => { const next = new Map(prev); if (same(value, dir === '' ? null : inherited(dir))) next.delete(dir); else next.set(dir, value); return next; });
            const anyIncluded = [...sel.values()].some(v => v.include);
            const selectAll = auto => { const top = listing.get(''); if (!top) return; const next = new Map(); if (top.files) next.set('', { include: true, auto }); for (const d of top.dirs) if (!d.artifact && !d.nestedRepo) next.set(d.path, { include: true, auto }); setSel(next); };
            const row = (r, depth) => {
              const isRoot = r.path === '';
              const eff = effective(r.path), on = !!eff?.include && !r.nestedRepo, explicit = sel.has(r.path), isOpen = expanded.has(r.path);
              const tags = [r.artifact ? t('artifactTag') : '', r.nestedRepo ? t('nestedTag') : ''].filter(Boolean).join(' ');
              return h('div', { key: r.path || '.', role: 'treeitem', 'aria-expanded': r.hasChildren ? isOpen : undefined, className: 'tgai-row', style: { paddingLeft: `${depth * 14}px`, flexWrap: 'nowrap', opacity: on && !explicit ? 0.8 : 1 } },
                h('button', { type: 'button', className: 'tgai-twisty', 'aria-label': isOpen ? t('collapse') : t('expand'), disabled: !r.hasChildren || r.nestedRepo, onClick: () => { setExpanded(prev => { const n = new Set(prev); if (n.has(r.path)) n.delete(r.path); else n.add(r.path); return n; }); loadDir(r.path); } }, r.hasChildren && !r.nestedRepo ? (isOpen ? '▾' : '▸') : ''),
                h('label', { style: { display: 'flex', gap: '4px', alignItems: 'center', flex: '1 1 auto', minWidth: 0 } },
                  h('input', { type: 'checkbox', checked: on, disabled: !!phase || r.nestedRepo, onChange: () => choose(r.path, { include: !on, auto: eff?.auto ?? true }) }),
                  h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: r.path || t('rootFiles') }, isRoot ? h('em', null, t('rootFiles')) : r.name),
                  h('small', { style: { whiteSpace: 'nowrap' } }, ` ${r.files} ${t('files')}${tags ? ` · ${tags}` : ''}`)),
                on ? h('label', { style: { whiteSpace: 'nowrap' }, title: t('autoHint') },
                  h('input', { type: 'checkbox', checked: eff.auto, disabled: !!phase, onChange: () => choose(r.path, { include: true, auto: !eff.auto }) }), h('small', null, t('autoDetect'))) : null);
            };
            const branch = (dir, depth) => {
              const l = listing.get(dir);
              if (!l) return [h('div', { key: `${dir}…`, style: { paddingLeft: `${depth * 14 + 20}px` } }, h('small', null, t('loading')))];
              const out = [];
              for (const d of l.dirs) { out.push(row(d, depth)); if (expanded.has(d.path) && !d.nestedRepo) out.push(...branch(d.path, depth + 1)); }
              if (l.truncated) out.push(h('small', { key: `${dir}+` }, t('tooManyDirs')));
              return out;
            };
            const top = listing.get('');
            const picker = h('div', { className: 'tgai-plan', role: 'tree', 'aria-label': t('manualTree') },
              top ? [top.files ? row({ path: '', name: '', files: top.files, hasChildren: false }, 0) : null, ...branch('', 0)] : h('small', null, t('loading')));
            const chosen = plan?.selection || [];
            const totals = preview;
            const labels = list => { const n = new Map(); for (const p of list) n.set(p.label, (n.get(p.label) || 0) + 1); return [...n].map(([l, c]) => (c > 1 ? `${l}×${c}` : l)).join('、'); };
            const shown = plan ? plan.entries.filter(e => e.files > 0 || e.source === 'nested') : [];
            const initPanel = h('div', { className: 'tgai-pop', role: 'dialog', 'aria-label': t('title') },
              h('div', { className: 'tgai-row tgai-head' }, h('strong', null, t('title')),
                h('button', { type: 'button', className: 'tgai-x', 'aria-label': t('close'), onClick: () => setOpen(false) }, '×')),
              h('p', null, h('small', null, `${t('dirLabel')}: `), h('code', null, data.cwd || '')),
              data.emptyRepo ? h('p', null, h('small', null, t('emptyRepo'))) : null,
              data.initBlocked ? h('p', { className: 'tgai-error' }, `${t('initBlocked')}（${t(`blocked_${data.initBlocked}`)}）`)
              : !plan ? h(React.Fragment, null,
                  h('p', null, h('small', null, t('pickHint'))),
                  h('div', { className: 'tgai-row' },
                    h('button', { type: 'button', disabled: !!phase || !top, onClick: () => selectAll(true) }, t('allAuto')),
                    h('button', { type: 'button', disabled: !!phase || !top, onClick: () => selectAll(false) }, t('allAll')),
                    h('button', { type: 'button', disabled: !!phase || !sel.size, onClick: () => setSel(new Map()) }, t('clearPick'))),
                  picker,
                  h('div', { className: 'tgai-row' }, h('button', { type: 'button', className: 'tgai-primary', disabled: !!phase || !anyIncluded, title: anyIncluded ? undefined : t('pickFolders'), onClick: startPlan }, phase === 'analyzing' ? t('analyzing') : t('analyzePicked'))))
              : h(React.Fragment, null,
                  h('p', null, h('small', null, `${t('scope')}: ${chosen.filter(s => s.include).map(s => `${s.dir || t('rootFiles')}${s.auto ? `（${t('autoDetect')}）` : `（${t('allIn')}）`}`).join('、')}`
                    + (chosen.some(s => !s.include) ? `；${t('excluded')}: ${chosen.filter(s => !s.include).map(s => s.dir).join('、')}` : ''))),
                  plan.profiles?.length ? h('p', null, h('small', null, `${t('detected')}: ${labels(plan.profiles)}`)) : null,
                  plan.ai?.status === 'failed' ? h('p', null, h('small', null, `${t('aiFailed')} (${plan.ai.reason})`)) : null,
                  plan.skippedCount ? h('p', null, h('small', { title: plan.skipped.join('\n') }, `${t('skippedDirs')} ${plan.skippedCount}`)) : null,
                  totals?.extensions?.length ? h('p', null, h('small', null, `${t('includes')}: ${totals.extensions.map(([e, n]) => `${e}×${n}`).join('  ')}`)) : null,
                  h('div', { className: 'tgai-section' }, t('ignoreListManual')),
                  h('div', { className: 'tgai-plan' }, shown.length ? shown.map(e => h('label', { key: e.id, 'data-locked': String(!!e.locked), title: e.sample.join('\n') },
                    h('input', { type: 'checkbox', checked: e.locked || picked.has(e.id), disabled: e.locked || !!phase, onChange: () => toggle(e.id) }),
                    h('span', null, h('code', null, e.pattern), ' ', e.source === 'ai' ? h('span', { className: 'tgai-tag' }, t('aiTag')) : null, ' ',
                      h('small', null, e.source === 'nested' ? e.reason : `${e.reason} · ${e.files} ${t('files')} · ${human(e.bytes)}`),
                      e.sourceFiles ? h('small', { className: 'tgai-error', style: { display: 'block' } }, `${t('sourceWarn')} (${e.sourceFiles})`) : null))) : h('small', null, t('noEntries'))),
                  totals ? h('p', null, `${t('willCommit')} ${totals.keptFiles} ${t('files')}（${human(totals.keptBytes)}），${t('scanned')} ${plan.totalFiles}`) : h('p', null, h('small', null, t('loading'))),
                  h('div', { className: 'tgai-row' },
                    h('button', { type: 'button', className: 'tgai-primary', disabled: !!phase || !totals?.keptFiles, onClick: createRepo }, phase === 'creating' ? t('creating') : t('create')),
                    h('button', { type: 'button', disabled: !!phase, onClick: () => { setPlan(null); setPicked(null); } }, t('backToPick')))),
              error ? h('p', { className: 'tgai-error', role: 'alert' }, error) : null);
            return h('span', { className: 'tgai-wrap', ref: wrap }, h('style', null, css),
              h('button', { type: 'button', className: 'tgai-pill', 'aria-expanded': open, 'aria-haspopup': 'dialog', title: t('title'), onClick: () => setOpen(v => !v) },
                icon, h('span', { className: 'tgai-dot', 'data-on': 'false' }), t('noRepo')),
              open ? initPanel : null);
          }
          if (!data || data.git?.status !== 'ok') return null; // git unavailable: show nothing
          const commits = data.history?.commits || [];
          const latest = data.outcomes?.[0];
          const on = data.authorized && data.enabled;
          const btn = (label, args, extra = {}) => h('button', { type: 'button', disabled: busy, onClick: () => act(args), ...extra }, label);
          const nativeBtn = (label, args) => data.tgitPath ? btn(label, args, { title: t('native') }) : null;
          const pillText = !data.authorized ? t('notEnabled') : h('code', null, (commits[0]?.sha || data.git.head || '').slice(0, 7));
          const latestText = latest ? [t(latest.status) || latest.status, latest.summary || latest.reason, latest.sha && latest.sha.slice(0, 7)].filter(Boolean).join(' · ') : '';
          const panel = h('div', { className: 'tgai-pop', role: 'dialog', 'aria-label': t('title') },
            h('div', { className: 'tgai-row tgai-head' },
              h('strong', null, t('title')),
              h('small', null, `${data.git.branch || ''} @ ${(data.git.head || '').slice(0, 7)}`),
              h('button', { type: 'button', className: 'tgai-x', 'aria-label': t('close'), onClick: () => setOpen(false) }, '×')),
            !data.authorized
              ? h(React.Fragment, null, h('p', null, h('small', null, t('enableHint'))), h('div', { className: 'tgai-row' }, btn(t('enableRepo'), { action: 'enableRepo' }, { className: 'tgai-primary' })))
              : h('div', { className: 'tgai-row' },
                  btn(data.enabled ? t('sessionOn') : t('sessionOff'), { action: data.enabled ? 'pause' : 'resume' }, { role: 'switch', 'aria-checked': !!data.enabled }),
                  btn(t('disableRepo'), { action: 'disableRepo' })),
            h('div', { className: 'tgai-row', style: { marginTop: 6 } },
              nativeBtn(t('log'), { action: 'open', command: 'log' }),
              nativeBtn(t('status'), { action: 'open', command: 'repostatus' }),
              nativeBtn(t('graph'), { action: 'open', command: 'revisiongraph' }),
              h('button', { type: 'button', disabled: busy, onClick: refresh }, t('refresh'))),
            latest ? h('p', null, h('small', null, `${t('latest')}: ${latestText}`)) : null,
            latest?.omitted?.length ? h('p', null, h('small', null, `${t('omitted')}: ${latest.omitted.slice(0, 6).join(', ')}${latest.omitted.length > 6 ? ' …' : ''}`)) : null,
            data.authorized && data.rules ? h(React.Fragment, null,
              h('div', { className: 'tgai-section' }, t('rules')),
              h('p', null, h('small', null, data.rules.profiles.length ? `${t('detected')}: ${[...new Set(data.rules.profiles.map(p => p.dir ? `${p.label} (${p.dir})` : p.label))].join(', ')}` : t('none'))),
              data.rules.detected.length ? h('details', null, h('summary', null, `${data.rules.detected.length} ${t('patterns')}`), h('div', { className: 'tgai-row' }, data.rules.detected.map(p => h('span', { className: 'tgai-chip', key: p }, p)))) : null,
              data.rules.learned.length ? h(React.Fragment, null, h('p', null, h('small', null, t('learned'))),
                h('div', { className: 'tgai-row' }, data.rules.learned.map(p => h('span', { className: 'tgai-chip', key: p }, p, h('button', { type: 'button', title: t('forget'), 'aria-label': `${t('forget')} ${p}`, disabled: busy, onClick: () => act({ action: 'forgetExclude', pattern: p }) }, '×'))))) : null,
              h('div', { className: 'tgai-row', style: { marginTop: 4 } }, btn(t('redetect'), { action: 'redetect' }),
                h('button', { type: 'button', disabled: busy || !!phase, onClick: async () => {
                  setError('');
                  try { const v = await post({ action: 'codeOnly' }); if (v.status === 'error') throw new Error(v.reason); if (alive.current) setCodePreview(v); } catch (e) { if (alive.current) setError(String(e.message || e)); }
                } }, t('codeOnly'))),
              codePreview ? h('div', { className: 'tgai-confirm' },
                codePreview.files ? h(React.Fragment, null,
                  h('p', null, `${t('codeOnlyAsk')} ${codePreview.files} ${t('files')}`),
                  h('p', null, h('small', null, codePreview.sample.join('、') + (codePreview.files > codePreview.sample.length ? ' …' : ''))))
                : h('p', null, codePreview.whitelisted ? t('codeOnlyDone') : t('codeOnlyRule')),
                !(codePreview.whitelisted && !codePreview.files) ? h('div', { className: 'tgai-row' },
                  h('button', { type: 'button', className: 'tgai-primary', disabled: !!phase, onClick: async () => {
                    setPhase('codeOnly'); setError('');
                    try { const v = await post({ action: 'codeOnly', confirm: true }); if (v.status === 'error' || v.status === 'skipped') throw new Error(v.reason === 'dirty_worktree' ? `${t('dirtyFirst')}: ${(v.dirty || []).join(', ')}` : (v.error || v.reason)); if (alive.current) setCodePreview(null); await refresh(); }
                    catch (e) { if (alive.current) setError(String(e.message || e)); } finally { if (alive.current) setPhase(''); }
                  } }, phase === 'codeOnly' ? t('creating') : t('codeOnlyConfirm')),
                  h('button', { type: 'button', onClick: () => setCodePreview(null) }, t('cancel'))) : h('button', { type: 'button', onClick: () => setCodePreview(null) }, t('close'))) : null) : null,
            error ? h('p', { className: 'tgai-error', role: 'alert' }, error) : null,
            data.authorized ? h(React.Fragment, null,
              h('div', { className: 'tgai-section' }, `${t('history')} (${commits.length})`),
              commits.length ? commits.map(c => h('div', { className: 'tgai-entry', key: c.sha },
                h('p', null, h('code', null, c.sha.slice(0, 7)), ' ', String(c.message || '').split('\n')[0]),
                h('div', { className: 'tgai-row' },
                  nativeBtn(t('compare'), { action: 'open', command: 'showcompare', sha: c.sha }),
                  nativeBtn(t('log'), { action: 'open', command: 'log', sha: c.sha }),
                  h('button', { type: 'button', disabled: busy || data.running, onClick: () => setConfirmation(c.sha) }, t('undo'))),
                confirmation === c.sha ? h('div', { className: 'tgai-confirm', role: 'alertdialog' }, h('p', null, t('warning')),
                  h('div', { className: 'tgai-row' }, btn(t('confirm'), { action: 'undo', sha: c.sha, confirm: true }), h('button', { type: 'button', onClick: () => setConfirmation(null) }, t('cancel')))) : null
              )) : h('p', null, h('small', null, t('empty')))) : null);
          return h('span', { className: 'tgai-wrap', ref: wrap },
            h('style', null, css),
            h('button', { type: 'button', className: 'tgai-pill', 'aria-expanded': open, 'aria-haspopup': 'dialog', title: t('title'), onClick: () => setOpen(v => !v) },
              icon, h('span', { className: 'tgai-dot', 'data-on': String(!!on) }), pillText),
            open ? panel : null);
        }
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({ name: 'conversation.composer.dock', id: 'tortoisegit-ai', order: 40, locale: NS, label: () => bound('title') }, Pill));
      },
    };
  },
});
