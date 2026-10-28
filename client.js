window.__ModuleLoader__.load({
  id: '@local/tortoisegit-ai',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'tortoisegit-ai';
    const zh = { title: '小乌龟 AI 版本记录', on: '自动提交：开', off: '自动提交：关', refresh: '刷新', log: '日志', compare: '对比', status: '工作区', graph: '版本图', undo: '撤销', cancel: '取消', confirm: '确认撤销', warning: '将创建一个新的 revert 提交，原有历史保留。', empty: '本会话暂无 AI 提交。', failed: '操作失败', latest: '最近结果', history: '本会话 AI 提交', native: '打开 TortoiseGit 原生窗口', pending: '正在读取仓库…', outOfScope: '当前目录不在允许的仓库内，自动提交不生效。', committed: '已提交', skipped: '已跳过', error: '出错', reverted: '已撤销', conflict: '撤销冲突' };
    const en = { title: 'TortoiseGit AI history', on: 'Auto-commit: on', off: 'Auto-commit: off', refresh: 'Refresh', log: 'Log', compare: 'Compare', status: 'Working tree', graph: 'Graph', undo: 'Revert', cancel: 'Cancel', confirm: 'Confirm revert', warning: 'Creates a new revert commit; history is kept.', empty: 'No AI commits in this session yet.', failed: 'Operation failed', latest: 'Latest', history: 'AI commits in this session', native: 'Opens a native TortoiseGit window', pending: 'Reading repository…', outOfScope: 'This directory is not an allowed repository; auto-commit is inactive.', committed: 'Committed', skipped: 'Skipped', error: 'Error', reverted: 'Reverted', conflict: 'Revert conflict' };
    const css = `.tgai{font-size:12px;color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:8px 12px;background:var(--dsw-alias-bg-layer-1);margin:6px 0;box-sizing:border-box}.tgai-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.tgai button{font:inherit;color:inherit;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);padding:2px 8px;border-radius:6px;cursor:pointer}.tgai button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.tgai button:disabled{opacity:.55;cursor:default}.tgai button[aria-checked=true]{color:var(--dsw-alias-state-success-primary)}.tgai p{margin:4px 0;overflow-wrap:anywhere}.tgai small{color:var(--dsw-alias-label-secondary)}.tgai-error{color:var(--dsw-alias-state-error-primary)}.tgai-entry{border-top:1px solid var(--dsw-alias-border-l1);padding:6px 0}.tgai summary{cursor:pointer;margin-top:4px}.tgai code{font-family:var(--dsw-alias-font-mono,monospace)}.tgai-confirm{padding:6px 8px;margin-top:4px;background:var(--dsw-alias-bg-layer-2);border-radius:6px}`;
    const api = async (path, init) => {
      const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...init });
      const value = await response.json().catch(() => ({}));
      if (!response.ok || value.ok === false) throw new Error(value.reason || `HTTP ${response.status}`);
      return value;
    };
    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'tortoisegit-ai: dictionaries');
        const bound = ctx.locale.bind(NS);
        function Panel(props) {
          const t = typeof props.t === 'function' ? props.t : bound;
          const sessionId = props.sessionId;
          const [data, setData] = React.useState(null);
          const [busy, setBusy] = React.useState(false);
          const [error, setError] = React.useState('');
          const [confirmation, setConfirmation] = React.useState(null);
          const alive = React.useRef(true);
          const refresh = React.useCallback(async () => {
            if (!sessionId) return;
            try { const value = await api(`api/tortoisegit-ai.status?session=${encodeURIComponent(sessionId)}`); if (alive.current) { setData(value); setError(''); } }
            catch (e) { if (alive.current) setError(String(e.message || e)); }
          }, [sessionId]);
          React.useEffect(() => {
            alive.current = true; setData(null); setError(''); setConfirmation(null); refresh();
            const timer = window.setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 5000);
            return () => { alive.current = false; window.clearInterval(timer); };
          }, [refresh]);
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
          if (!data && !error) return null; // stay invisible until the first answer
          const outOfScope = data && !data.history?.commits?.length && data.git?.reason === 'repository_not_authorized';
          if (outOfScope || (data && data.git?.status === 'error')) return null; // not a managed repository: no clutter
          const commits = data?.history?.commits || [];
          const latest = data?.outcomes?.[0];
          const btn = (label, args, extra = {}) => h('button', { type: 'button', disabled: busy, onClick: () => act(args), ...extra }, label);
          const latestText = latest ? [t(latest.status) || latest.status, latest.summary || latest.reason, latest.sha && latest.sha.slice(0, 8)].filter(Boolean).join(' · ') : '';
          return h('section', { className: 'tgai', 'aria-label': t('title') },
            h('style', null, css),
            h('div', { className: 'tgai-row' },
              h('strong', null, t('title')),
              data?.git?.branch ? h('small', null, `${data.git.branch} @ ${(data.git.head || '').slice(0, 8)}`) : null,
              btn(data?.enabled ? t('on') : t('off'), { action: data?.enabled ? 'pause' : 'resume' }, { role: 'switch', 'aria-checked': !!data?.enabled }),
              h('button', { type: 'button', disabled: busy, onClick: refresh }, t('refresh')),
              data?.tgitPath ? btn(t('log'), { action: 'open', command: 'log' }, { title: t('native') }) : null,
              data?.tgitPath ? btn(t('status'), { action: 'open', command: 'repostatus' }, { title: t('native') }) : null,
              data?.tgitPath ? btn(t('graph'), { action: 'open', command: 'revisiongraph' }, { title: t('native') }) : null),
            latest ? h('p', null, h('small', null, `${t('latest')}: ${latestText}`)) : null,
            error ? h('p', { className: 'tgai-error', role: 'alert' }, error) : null,
            h('details', null, h('summary', null, `${t('history')} (${commits.length})`),
              commits.length ? commits.map(c => h('div', { className: 'tgai-entry', key: c.sha },
                h('p', null, h('code', null, c.sha.slice(0, 8)), ' ', String(c.message || '').split('\n')[0]),
                h('div', { className: 'tgai-row' },
                  data?.tgitPath ? btn(t('compare'), { action: 'open', command: 'showcompare', sha: c.sha }, { title: t('native') }) : null,
                  data?.tgitPath ? btn(t('log'), { action: 'open', command: 'log', sha: c.sha }, { title: t('native') }) : null,
                  h('button', { type: 'button', disabled: busy || data?.running, onClick: () => setConfirmation(c.sha) }, t('undo'))),
                confirmation === c.sha ? h('div', { className: 'tgai-confirm', role: 'alertdialog' }, h('p', null, t('warning')),
                  h('div', { className: 'tgai-row' }, btn(t('confirm'), { action: 'undo', sha: c.sha, confirm: true }), h('button', { type: 'button', onClick: () => setConfirmation(null) }, t('cancel')))) : null
              )) : h('p', null, h('small', null, t('empty')))));
        }
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({ name: 'conversation.composer.dock', id: 'tortoisegit-ai', order: 40, locale: NS, label: () => bound('title') }, Panel));
      },
    };
  },
});
