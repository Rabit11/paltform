(() => {
  'use strict';
  const API = '/api';
  const token = () => localStorage.getItem('srpm.user') || '';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function api(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', 'x-session': token(), Authorization: `Bearer ${token()}` };
    let body = opts.body;
    if (body && typeof body === 'object' && !(body instanceof FormData)) body = JSON.stringify(body);
    else if (body instanceof FormData) delete headers['Content-Type'];
    const r = await fetch(API + path, { ...opts, headers: { ...headers, ...(opts.headers || {}) }, body });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `请求失败 ${r.status}`);
    return data;
  }

  function toast(msg, bad) {
    const n = document.createElement('div');
    n.className = 'lc-toast' + (bad ? ' bad' : '');
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3200);
  }

  function ensureStyle() {
    if ($('#lc-ui-style')) return;
    const st = document.createElement('style');
    st.id = 'lc-ui-style';
    st.textContent = `
.lc-bar{margin:0 0 14px;padding:12px 14px;background:#fff;border:1px solid #d9e4f2;border-radius:8px;box-shadow:0 1px 4px #143b660c}
.lc-bar h3{margin:0 0 8px;font-size:13px;color:#143b66;font-weight:600}
.lc-bar .lc-sub{font-size:11px;color:#718096;margin-bottom:10px}
.lc-macro{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px}
.lc-chip{min-width:132px;flex:0 0 auto;padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;cursor:pointer;text-align:left}
.lc-chip:hover{border-color:#0759a6;background:#eff6ff}
.lc-chip.current{border-color:#0759a6;background:#e8f1fb;box-shadow:inset 3px 0 0 #0759a6}
.lc-chip.done{opacity:.85;background:#f0fdf4;border-color:#bbf7d0}
.lc-chip .n{font-size:12px;font-weight:600;color:#1a365d;margin-bottom:4px}
.lc-chip .d,.lc-chip .p{font-size:11px;color:#4a5568;line-height:1.35}
.lc-chip .st{font-size:10px;color:#0759a6;margin-top:4px}
.lc-drawer-mask{position:fixed;inset:0;background:#0f172a66;z-index:99990;display:flex;justify-content:flex-end}
.lc-drawer{width:min(420px,100%);background:#fff;height:100%;overflow:auto;padding:18px 16px;box-shadow:-4px 0 24px #0002}
.lc-drawer h2{margin:0 0 6px;font-size:16px;color:#143b66}
.lc-drawer .meta{font-size:12px;color:#64748b;margin-bottom:12px;line-height:1.5}
.lc-drawer .node{padding:10px;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:8px}
.lc-drawer .node.current{border-color:#0759a6;background:#f0f7ff}
.lc-drawer .node.approved,.lc-drawer .node.done{background:#f0fdf4}
.lc-drawer .node.rejected{background:#fff1f2}
.lc-drawer button.close{margin-top:12px;padding:8px 14px;border:0;border-radius:5px;background:#0759a6;color:#fff;cursor:pointer}
.lc-hint{margin:0 0 12px;padding:10px 12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;color:#1e40af;font-size:12px;line-height:1.55}
.lc-panel{margin:0 0 14px;padding:14px 16px;background:#fff;border:1px solid #d9e4f2;border-left:4px solid #0759a6;border-radius:8px}
.lc-panel h3{margin:0 0 10px;font-size:14px;color:#143b66}
.lc-grid{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:10px}
.lc-grid label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#475569}
.lc-grid .wide{grid-column:span 2}
.lc-grid input,.lc-grid select,.lc-grid textarea{padding:7px 9px;border:1px solid #cbd7e6;border-radius:4px}
.lc-grid button{align-self:end;padding:8px 14px;border:0;border-radius:4px;background:#0759a6;color:#fff;cursor:pointer}
.lc-toast{position:fixed;right:20px;top:20px;z-index:99999;background:#16835d;color:#fff;padding:10px 14px;border-radius:6px}
.lc-toast.bad{background:#c53030}
@media(max-width:900px){.lc-grid{grid-template-columns:1fr 1fr}}
`;
    document.head.appendChild(st);
  }

  function placeTop(html, id) {
    if (document.getElementById(id)) return document.getElementById(id);
    const main = $('main') || $('[class*="content"]') || $('#root');
    if (!main) return null;
    const wrap = document.createElement('div');
    wrap.id = id;
    wrap.innerHTML = html;
    const el = wrap.firstElementChild;
    el.id = id;
    main.prepend(el);
    return el;
  }

  function openDrawer(title, bodyHtml) {
    const old = $('.lc-drawer-mask');
    if (old) old.remove();
    const mask = document.createElement('div');
    mask.className = 'lc-drawer-mask';
    mask.innerHTML = `<div class="lc-drawer"><h2>${esc(title)}</h2>${bodyHtml}<button type="button" class="close">关闭</button></div>`;
    mask.addEventListener('click', (e) => { if (e.target === mask || e.target.classList.contains('close')) mask.remove(); });
    document.body.appendChild(mask);
  }

  function statusLabel(st) {
    return ({ current: '当前', done: '已完成', approved: '已办', pending: '待办', rejected: '驳回' })[st] || st || '';
  }

  async function renderProjectStages(pid) {
    const data = await api(`/projects/${pid}/lifecycle-stages`);
    const chips = (data.macro || []).map((m) => `
      <button type="button" class="lc-chip ${esc(m.status)}" data-macro="${esc(m.id)}">
        <div class="n">${esc(m.name)}</div>
        <div class="d">${esc(m.dept)}</div>
        <div class="p">${esc(m.owner?.label || '待指定')}</div>
        <div class="st">${esc(statusLabel(m.status))}</div>
      </button>`).join('');

    const bar = placeTop(`
      <section class="lc-bar">
        <h3>全生命周期阶段责任</h3>
        <div class="lc-sub">点击阶段查看部门、负责人与当前审签节点详情（演示数据保留）</div>
        <div class="lc-macro">${chips}</div>
      </section>`, 'lc-stage-bar');
    if (!bar) return;

    bar.onclick = (e) => {
      const btn = e.target.closest('[data-macro]');
      if (!btn) return;
      const m = (data.macro || []).find((x) => x.id === btn.dataset.macro);
      if (!m) return;
      const ap = data.approval;
      let nodesHtml = '';
      if (ap && ap.nodes && ap.nodes.length && (m.status === 'current' || ap.current)) {
        nodesHtml = `<div class="meta">关联流程：${esc(ap.title)}（${esc(ap.status)}）</div>`
          + ap.nodes.map((n) => `
            <div class="node ${esc(n.status)}">
              <b>${esc(n.title)}</b>
              <div class="meta">${esc(n.dept)} · ${esc(n.owner?.label || '待指定')}<br/>状态：${esc(statusLabel(n.status))}${n.at ? ' · ' + esc(n.at) : ''}${n.comment ? '<br/>意见：' + esc(n.comment) : ''}</div>
            </div>`).join('');
      } else {
        nodesHtml = `<div class="meta">${esc(m.detail?.summary || '')}</div>
          <div class="node"><b>填报角色</b><div class="meta">${esc(m.filler)}</div></div>
          <div class="node"><b>责任部门</b><div class="meta">${esc(m.dept)}</div></div>
          <div class="node"><b>负责人</b><div class="meta">${esc(m.owner?.label || '待指定')}</div></div>
          <div class="node"><b>项目状态</b><div class="meta">${esc(data.status)}</div></div>`;
      }
      // fill hints
      const hints = (data.fillHints || []).map((h) => `<div class="node"><b>${esc(h.stage)}</b><div class="meta">谁填：${esc(h.filler)}<br/>字段：${esc(h.fields)}</div></div>`).join('');
      openDrawer(m.name, `<div class="meta">${esc(data.code)} · ${esc(data.name)}</div>${nodesHtml}<h2 style="font-size:14px;margin-top:16px">填表分工（V19）</h2>${hints}`);
    };
  }

  async function renderDeclareHints() {
    if ($('#lc-declare-hint')) return;
    try {
      const meta = await api('/meta/stage-fields');
      const lines = (meta.stages || []).map((s) => `【${s.name}】${s.filler}：${s.note || ''}`).join('<br/>');
      placeTop(`<div class="lc-hint" id="lc-declare-hint"><b>V19 填表分工</b><br/>${lines}<br/>本页为<strong>立项·申报</strong>：须填级别/渠道、名称、目标、起止日期、总经费、负责人·技术负责人及渠道材料。主管/总师等在实施·基本信息补全。</div>`, 'lc-declare-hint');
    } catch (_) { /* ignore */ }
  }

  async function renderMilestonePanels() {
    if ($('#lc-ms-plan')) return;
    let projects = [];
    try { projects = await api('/projects'); } catch { return; }
    if (!Array.isArray(projects) || !projects.length) return;
    const opts = projects.map((p) => `<option value="${p.id}">${esc(p.code)} · ${esc(p.name)}</option>`).join('');

    placeTop(`
      <section class="lc-panel" id="lc-ms-close">
        <h3>里程碑佐证销项</h3>
        <form class="lc-grid" id="lc-ms-close-form">
          <label>项目<select name="projectId" required>${opts}</select></label>
          <label>未闭环里程碑<select name="milestoneId" required></select></label>
          <label>完成佐证<input name="file" type="file" required></label>
          <button type="submit">提交核验</button>
        </form>
      </section>`, 'lc-ms-close');

    placeTop(`
      <section class="lc-panel" id="lc-ms-plan">
        <h3>年度目标与里程碑计划</h3>
        <form class="lc-grid" id="lc-ms-plan-form">
          <label>项目<select name="projectId" required>${opts}</select></label>
          <label>年度<input name="year" type="number" min="2020" max="2100" required></label>
          <label class="wide">年度目标<input name="yearGoal" maxlength="500" required></label>
          <label class="wide">里程碑（每行：名称 | YYYY-MM-DD）<textarea name="milestones" rows="3" required></textarea></label>
          <button type="submit">提交计划审批</button>
        </form>
      </section>`, 'lc-ms-plan');

    const yearInput = $('[name=year]', $('#lc-ms-plan-form'));
    if (yearInput) yearInput.value = new Date().getFullYear();

    const closeForm = $('#lc-ms-close-form');
    const closeProject = $('[name=projectId]', closeForm);
    const closeMs = $('[name=milestoneId]', closeForm);
    const loadClose = async () => {
      const p = await api(`/projects/${closeProject.value}`);
      const open = (p.milestones || []).filter((x) => !x.done_at);
      closeMs.innerHTML = open.map((x) => `<option value="${x.id}">${esc(x.title)} · ${esc(x.due)}</option>`).join('') || '<option value="">无未闭环节点</option>';
    };
    closeProject.onchange = loadClose;
    await loadClose();

    closeForm.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(closeForm);
      try {
        const file = fd.get('file');
        const upFd = new FormData();
        upFd.append('file', file);
        const up = await api('/uploads', { method: 'POST', body: upFd });
        await api(`/milestones/${fd.get('milestoneId')}/complete`, { method: 'POST', body: { uploadId: up.id } });
        toast('已提交里程碑销项');
        await loadClose();
      } catch (err) { toast(err.message, true); }
    };

    $('#lc-ms-plan-form').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const milestones = String(fd.get('milestones')).split(/\r?\n/).map((line) => {
          const [title, due] = line.split('|').map((x) => x.trim());
          return { title, due };
        }).filter((x) => x.title && x.due);
        await api(`/projects/${fd.get('projectId')}/milestone-plan`, {
          method: 'POST',
          body: { year: Number(fd.get('year')), yearGoal: fd.get('yearGoal'), milestones },
        });
        toast('里程碑计划已提交审批');
        e.target.reset();
        if (yearInput) yearInput.value = new Date().getFullYear();
      } catch (err) { toast(err.message, true); }
    };
  }

  let last = '';
  async function run() {
    if (!token()) return;
    ensureStyle();
    const path = location.pathname;
    if (path === last) return;
    last = path;

    const m = path.match(/^\/projects\/(\d+)/);
    if (m) {
      try { await renderProjectStages(m[1]); } catch (e) { console.warn('lifecycle stages', e); }
    } else {
      $('#lc-stage-bar')?.remove();
    }

    if (path.startsWith('/declare')) {
      try { await renderDeclareHints(); } catch (_) {}
    }

    if (path.startsWith('/milestones')) {
      try { await renderMilestonePanels(); } catch (e) { console.warn('milestone panels', e); }
    }
  }

  new MutationObserver(() => {
    if (location.pathname !== last) run();
  }).observe(document.body, { childList: true, subtree: true });
  run();
})();
