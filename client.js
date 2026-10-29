window.__ModuleLoader__.load({
  id: '@local/tortoisegit-ai',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'tortoisegit-ai';
    const zh = { title: '小乌龟 AI 版本记录', notEnabled: '未启用', enableRepo: '在此仓库启用自动提交', disableRepo: '在此仓库停用', enableHint: '启用后，AI 每轮修改结束会自动提交到当前分支（只提交 AI 本轮的改动；轮次开始时有未提交修改则跳过）。', sessionOn: '本会话自动提交：开', sessionOff: '本会话自动提交：关', refresh: '刷新', log: '日志', compare: '对比', status: '工作区', graph: '版本图', undo: '撤销', cancel: '取消', confirm: '确认撤销', warning: '将创建一个新的 revert 提交，原有历史保留。', empty: '本会话暂无 AI 提交。', failed: '操作失败', latest: '最近结果', history: '本会话 AI 提交', native: '打开 TortoiseGit 原生窗口', committed: '已提交', skipped: '已跳过', error: '出错', reverted: '已撤销', conflict: '撤销冲突', close: '关闭', rules: '不自动提交的文件', detected: '识别到的工程', none: '未识别到特定工具链（使用内置清单 + .gitignore）', learned: 'AI 判定的产物', forget: '恢复提交', redetect: '重新识别', patterns: '条规则', omitted: '已排除产物', noRepo: '未建仓库', initHint: '当前目录还不是 Git 仓库。一键新建会先分析目录（内置规则 + 识别工具链 + AI 检查），列出要忽略的文件供你确认，然后建仓库、做初始提交并开启自动提交。', initStart: '一键新建仓库', analyzing: '正在分析目录…（AI 检查需要忽略的文件，约 10–30 秒）', initBlocked: '这个目录不适合自动建仓库', blocked_drive_root: '盘符根目录', blocked_home_directory: '用户主目录', blocked_user_folder: '桌面/文档/下载等用户目录', blocked_system_folder: '系统或程序目录', too_many_files: '文件太多（超过 5 万个），可能不是工程目录', ignoreList: '将写入 .gitignore（可取消勾选）', willCommit: '初始提交约', ignored: '忽略', files: '个文件', aiFailed: 'AI 建议不可用，仅使用规则', aiTag: 'AI', sourceWarn: '含源码/文档类文件，默认不忽略', create: '创建仓库并初始提交', creating: '正在创建…', identity: '未配置 Git 用户名/邮箱：请在 TortoiseGit 设置 → Git 中填写后重试。', dirLabel: '目录', modeLabel: '纳入范围', modeCode: '仅代码（推荐）', modeAll: '全部文件', modeCodeHint: '只纳入源码、头文件、构建脚本、工程文件（uvprojx/ewp/ioc/CMakeLists…）和代码配置（json/yaml/ini/sdkconfig…）；md、Word、Excel、PDF、txt、图片、压缩包等一律不纳入。以后新建的文档也不会被自动提交。', modeAllHint: '纳入目录下所有文件，只排除下面勾选的规则。', includes: '将纳入', ignoreListCode: '代码文件中再排除（可取消勾选）', noEntries: '无需额外排除', nothing_to_commit: '没有可提交的文件', codeOnly: '仅保留代码文件', codeOnlyAsk: '将停止跟踪非代码文件（md、Word、Excel、txt、图片等；文件仍保留在磁盘上，可随时恢复）：', codeOnlyRule: '已跟踪的都是代码文件；确认后写入“仅代码”规则，以后新建的文档也不会被提交。', codeOnlyDone: '此仓库已经是“仅代码”模式。', codeOnlyConfirm: '确认并提交', dirtyFirst: '请先提交或还原这些修改' };
    const en = { title: 'TortoiseGit AI history', notEnabled: 'Off', enableRepo: 'Enable auto-commit for this repository', disableRepo: 'Disable for this repository', enableHint: 'When enabled, each AI turn that edits files is committed to the current branch (only the AI\'s own changes; turns that start with uncommitted changes are skipped).', sessionOn: 'Session auto-commit: on', sessionOff: 'Session auto-commit: off', refresh: 'Refresh', log: 'Log', compare: 'Compare', status: 'Working tree', graph: 'Graph', undo: 'Revert', cancel: 'Cancel', confirm: 'Confirm revert', warning: 'Creates a new revert commit; history is kept.', empty: 'No AI commits in this session yet.', failed: 'Operation failed', latest: 'Latest', history: 'AI commits in this session', native: 'Opens a native TortoiseGit window', committed: 'Committed', skipped: 'Skipped', error: 'Error', reverted: 'Reverted', conflict: 'Revert conflict', close: 'Close', rules: 'Never auto-committed', detected: 'Detected projects', none: 'No specific toolchain detected (built-in list + .gitignore)', learned: 'Judged artifacts (AI)', forget: 'Commit again', redetect: 'Re-detect', patterns: 'rules', omitted: 'Artifacts excluded', noRepo: 'No repo', initHint: 'This folder is not a Git repository yet. One click analyses it (built-in rules, toolchain detection, AI review), lists what will be ignored for you to confirm, then creates the repository, makes the first commit and enables auto-commit.', initStart: 'Create repository', analyzing: 'Analysing folder… (AI review, ~10–30 s)', initBlocked: 'Not a suitable folder for a repository', blocked_drive_root: 'drive root', blocked_home_directory: 'home folder', blocked_user_folder: 'Desktop/Documents/Downloads', blocked_system_folder: 'system or program folder', too_many_files: 'too many files (over 50k)', ignoreList: 'Written to .gitignore (untick to keep)', willCommit: 'First commit ≈', ignored: 'ignored', files: 'files', aiFailed: 'AI suggestions unavailable; rules only', aiTag: 'AI', sourceWarn: 'contains source/doc files; not ignored by default', create: 'Create repository and commit', creating: 'Creating…', identity: 'Git user name/email missing: set them in TortoiseGit Settings → Git, then retry.', dirLabel: 'Folder', modeLabel: 'Scope', modeCode: 'Code only (recommended)', modeAll: 'All files', modeCodeHint: 'Only sources, headers, build scripts, project files (uvprojx/ewp/ioc/CMakeLists…) and code configuration (json/yaml/ini/sdkconfig…); md, Word, Excel, PDF, txt, images and archives stay out, now and later.', modeAllHint: 'Everything in the folder except the ticked rules below.', includes: 'Includes', ignoreListCode: 'Also exclude among code files (untick to keep)', noEntries: 'Nothing else to exclude', nothing_to_commit: 'Nothing to commit', codeOnly: 'Keep code only', codeOnlyAsk: 'Stop tracking non-code files (md, Word, Excel, txt, images…; they stay on disk):', codeOnlyRule: 'Only code files are tracked; confirming writes the code-only rules so new documents stay out.', codeOnlyDone: 'This repository is already code-only.', codeOnlyConfirm: 'Confirm and commit', dirtyFirst: 'Commit or revert these changes first' };
    const css = `.tgai-wrap{position:relative;display:inline-flex}
.tgai-pill{display:inline-flex;align-items:center;gap:5px;font:inherit;font-size:12px;line-height:20px;color:var(--dsw-alias-label-secondary);background:transparent;border:0;border-radius:6px;padding:2px 6px;cursor:pointer;white-space:nowrap}
.tgai-pill:hover,.tgai-pill[aria-expanded=true]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.tgai-pill:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.tgai-pill code{font-family:var(--dsw-alias-font-mono,monospace);font-size:11px}
.tgai-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-label-tertiary,#aaa)}
.tgai-dot[data-on=true]{background:var(--dsw-alias-state-success-primary,#22a06b)}
.tgai-pop{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);width:min(380px,90vw);max-height:60vh;overflow:auto;z-index:50;font-size:12px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:10px 12px;box-shadow:0 8px 24px rgba(0,0,0,.12);box-sizing:border-box;text-align:left;white-space:normal}
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
          const [mode, setMode] = React.useState('code');
          const [codePreview, setCodePreview] = React.useState(null);
          const alive = React.useRef(true);
          const wrap = React.useRef(null);
          const refresh = React.useCallback(async () => {
            if (!sessionId) return;
            try { const value = await api(`api/tortoisegit-ai.status?session=${encodeURIComponent(sessionId)}`); if (alive.current) setData(value); }
            catch (e) { if (alive.current) setError(String(e.message || e)); }
          }, [sessionId]);
          React.useEffect(() => {
            alive.current = true; setData(null); setError(''); setOpen(false); refresh();
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
              const value = await post({ action: 'planRepo' });
              if (value.status === 'error') throw new Error(t(value.reason) !== value.reason ? t(value.reason) : value.reason);
              if (alive.current) { setPlan(value); setPicked(new Set(value.entries.filter(e => e.checked).map(e => e.id))); }
            } catch (e) { if (alive.current) setError(String(e.message || e)); }
            finally { if (alive.current) setPhase(''); }
          }
          async function createRepo() {
            setPhase('creating'); setError('');
            try {
              const value = await post({ action: 'initRepo', planId: plan.planId, checked: [...picked], mode });
              if (value.status === 'error' || value.status === 'skipped') throw new Error(value.reason === 'git_identity_missing' ? t('identity') : (value.error || value.reason));
              if (alive.current) { setPlan(null); setPicked(null); }
              await refresh();
            } catch (e) { if (alive.current) setError(String(e.message || e)); }
            finally { if (alive.current) setPhase(''); }
          }
          if (data?.noRepo && data.initBlocked && !open) return null; // home/system folders: stay out of the way
          if (data?.noRepo) {
            const toggle = id => setPicked(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
            const codeMode = mode === 'code';
            const count = e => (codeMode ? e.codeFiles : e.files);
            const shown = plan ? plan.entries.filter(e => !codeMode || e.codeFiles > 0) : [];
            let approx = 0;
            if (plan && picked) {
              approx = plan.modes[mode].keptFiles;
              for (const e of plan.entries) { if (e.locked) continue; if (e.checked && !picked.has(e.id)) approx += count(e); if (!e.checked && picked.has(e.id)) approx -= count(e); }
              approx = Math.max(0, Math.min(plan.totalFiles, approx));
            }
            const modeBtn = (value, label) => h('button', { type: 'button', role: 'radio', 'aria-checked': mode === value, className: mode === value ? 'tgai-primary' : '', disabled: !!phase, onClick: () => setMode(value) }, label);
            const labels = list => [...new Set(list.map(p => (p.dir ? `${p.label} (${p.dir})` : p.label)))].join(', ');
            const initPanel = h('div', { className: 'tgai-pop', role: 'dialog', 'aria-label': t('title') },
              h('div', { className: 'tgai-row tgai-head' }, h('strong', null, t('title')),
                h('button', { type: 'button', className: 'tgai-x', 'aria-label': t('close'), onClick: () => setOpen(false) }, '×')),
              h('p', null, h('small', null, `${t('dirLabel')}: `), h('code', null, data.cwd || '')),
              data.initBlocked ? h('p', { className: 'tgai-error' }, `${t('initBlocked')}（${t(`blocked_${data.initBlocked}`)}）`)
              : !plan ? h(React.Fragment, null, h('p', null, h('small', null, t('initHint'))),
                  h('div', { className: 'tgai-row' }, h('button', { type: 'button', className: 'tgai-primary', disabled: !!phase, onClick: startPlan }, phase === 'analyzing' ? t('analyzing') : t('initStart'))))
              : h(React.Fragment, null,
                  plan.profiles?.length ? h('p', null, h('small', null, `${t('detected')}: ${labels(plan.profiles)}`)) : null,
                  plan.ai?.status === 'failed' ? h('p', null, h('small', null, `${t('aiFailed')} (${plan.ai.reason})`)) : null,
                  h('div', { className: 'tgai-row', role: 'radiogroup', 'aria-label': t('modeLabel'), style: { marginTop: 4 } }, modeBtn('code', t('modeCode')), modeBtn('all', t('modeAll'))),
                  h('p', null, h('small', null, codeMode ? t('modeCodeHint') : t('modeAllHint'))),
                  plan.modes[mode].extensions?.length ? h('p', null, h('small', null, `${t('includes')}: ${plan.modes[mode].extensions.map(([e, n]) => `${e}×${n}`).join('  ')}`)) : null,
                  h('div', { className: 'tgai-section' }, codeMode ? t('ignoreListCode') : t('ignoreList')),
                  h('div', { className: 'tgai-plan' }, shown.length ? shown.map(e => h('label', { key: e.id, 'data-locked': String(!!e.locked), title: e.sample.join('\n') },
                    h('input', { type: 'checkbox', checked: e.locked || picked.has(e.id), disabled: e.locked || !!phase, onChange: () => toggle(e.id) }),
                    h('span', null, h('code', null, e.pattern), ' ', e.source === 'ai' ? h('span', { className: 'tgai-tag' }, t('aiTag')) : null, ' ',
                      h('small', null, `${e.reason} · ${count(e)} ${t('files')}${codeMode ? '' : ` · ${human(e.bytes)}`}`),
                      e.sourceFiles ? h('small', { className: 'tgai-error', style: { display: 'block' } }, `${t('sourceWarn')} (${e.sourceFiles})`) : null))) : h('small', null, t('noEntries'))),
                  h('p', null, `${t('willCommit')} ${approx} ${t('files')}，${t('ignored')} ${plan.totalFiles - approx} / ${plan.totalFiles}`),
                  h('div', { className: 'tgai-row' },
                    h('button', { type: 'button', className: 'tgai-primary', disabled: !!phase, onClick: createRepo }, phase === 'creating' ? t('creating') : t('create')),
                    h('button', { type: 'button', disabled: !!phase, onClick: () => { setPlan(null); setPicked(null); } }, t('cancel')))),
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
