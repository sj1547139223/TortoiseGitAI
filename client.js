window.__ModuleLoader__.load({
  id: '@local/tortoisegit-ai',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'tortoisegit-ai';
    const zh = { title: '小乌龟 AI 版本记录', notEnabled: '未启用', enableRepo: '在此仓库启用自动提交', disableRepo: '在此仓库停用', enableHint: '启用后，AI 每轮修改结束会自动提交到当前分支（只提交 AI 本轮的改动；轮次开始时有未提交修改则跳过）。', sessionOn: '本会话自动提交：开', sessionOff: '本会话自动提交：关', refresh: '刷新', log: '日志', compare: '对比', status: '工作区', graph: '版本图', undo: '撤销', cancel: '取消', confirm: '确认撤销', warning: '将创建一个新的 revert 提交，原有历史保留。', empty: '本会话暂无 AI 提交。', failed: '操作失败', latest: '最近结果', history: '本会话 AI 提交', native: '打开 TortoiseGit 原生窗口', committed: '已提交', skipped: '已跳过', error: '出错', reverted: '已撤销', conflict: '撤销冲突', close: '关闭', rules: '不自动提交的文件', detected: '识别到的工程', none: '未识别到特定工具链（使用内置清单 + .gitignore）', learned: 'AI 判定的产物', forget: '恢复提交', redetect: '重新识别', patterns: '条规则', omitted: '已排除产物' };
    const en = { title: 'TortoiseGit AI history', notEnabled: 'Off', enableRepo: 'Enable auto-commit for this repository', disableRepo: 'Disable for this repository', enableHint: 'When enabled, each AI turn that edits files is committed to the current branch (only the AI\'s own changes; turns that start with uncommitted changes are skipped).', sessionOn: 'Session auto-commit: on', sessionOff: 'Session auto-commit: off', refresh: 'Refresh', log: 'Log', compare: 'Compare', status: 'Working tree', graph: 'Graph', undo: 'Revert', cancel: 'Cancel', confirm: 'Confirm revert', warning: 'Creates a new revert commit; history is kept.', empty: 'No AI commits in this session yet.', failed: 'Operation failed', latest: 'Latest', history: 'AI commits in this session', native: 'Opens a native TortoiseGit window', committed: 'Committed', skipped: 'Skipped', error: 'Error', reverted: 'Reverted', conflict: 'Revert conflict', close: 'Close', rules: 'Never auto-committed', detected: 'Detected projects', none: 'No specific toolchain detected (built-in list + .gitignore)', learned: 'Judged artifacts (AI)', forget: 'Commit again', redetect: 'Re-detect', patterns: 'rules', omitted: 'Artifacts excluded' };
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
          if (!data || data.git?.status !== 'ok') return null; // not a git repository: show nothing
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
              h('div', { className: 'tgai-row', style: { marginTop: 4 } }, btn(t('redetect'), { action: 'redetect' }))) : null,
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
