(() => {
  'use strict';
  const API = '/api';
  const token = () => {
    const raw = localStorage.getItem('srpm.user') || sessionStorage.getItem('srpm.user') || '';
    if (!raw) return '';
    try {
      const o = JSON.parse(raw);
      return o.sessionToken || o.token || raw;
    } catch {
      return raw;
    }
  };
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
.lc-hint{display:none!important}
.lc-ch-flow{margin:0 0 16px;padding:16px 20px;background:#fff;border:1px solid #E8E8E8;border-radius:4px}
.lc-ch-flow .hd{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 12px;margin-bottom:12px}
.lc-ch-flow .hd b{font-size:14px;color:#262626;font-weight:600}
.lc-ch-flow .hd span{font-size:12px;color:#8C8C8C}
.lc-ch-steps{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0;padding:0}
.lc-ch-steps > span{display:inline-flex;align-items:center;gap:8px;height:32px;padding:0 12px;border:1px solid #E8E8E8;border-radius:4px;background:#FAFAFA;font-size:13px;color:#262626}
.lc-ch-steps > span .n{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:9px;background:#F0F2F5;color:#8C8C8C;font-size:11px}
.lc-ch-steps > span.cur{border-color:#0064EF;background:#F0F5FF;color:#0064EF;font-weight:600}
.lc-ch-steps > span.cur .n{background:#0064EF;color:#fff}
.lc-ch-steps .arr{color:#BFBFBF;font-size:12px;padding:0 2px}
.lc-panel{margin:0 0 14px;padding:14px 16px;background:#fff;border:1px solid #d9e4f2;border-left:4px solid #0759a6;border-radius:8px}
.lc-panel h3{margin:0 0 10px;font-size:14px;color:#143b66}
.lc-grid{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:10px}
.lc-grid label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#475569}
.lc-grid .wide{grid-column:span 2}
.lc-grid input,.lc-grid select,.lc-grid textarea{padding:7px 9px;border:1px solid #cbd7e6;border-radius:4px}
.lc-grid button{align-self:end;padding:8px 14px;border:0;border-radius:4px;background:#0759a6;color:#fff;cursor:pointer}
.lc-toast{position:fixed;right:20px;top:20px;z-index:99999;background:#16835d;color:#fff;padding:10px 14px;border-radius:6px}
.lc-toast.bad{background:#c53030}
.lc-owners{position:relative;min-height:86px;margin:2px 0 6px}
.lc-owner-col{position:absolute;top:0;width:18%;transform:translateX(-50%);text-align:center;padding:6px 6px 8px;border:1px solid transparent;border-radius:4px;background:transparent;cursor:pointer;appearance:none;font:inherit}
.lc-owner-col:hover{border-color:#91CAFF;background:#F0F5FF}
.lc-owner-col.current{border-color:#91CAFF;background:#F0F5FF}
.lc-owner-col.done{opacity:.88}
.lc-owner-col .k{display:block;font-size:10px;color:#8C8C8C;line-height:1.3;margin-top:2px}
.lc-owner-col .v{display:block;font-size:12px;color:#262626;font-weight:600;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lc-owner-col .flow{color:#0064EF}
.lc-owner-col .done-txt{color:#5B8C00}
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

  const VIS_POS = ['8.42%', '29.21%', '50%', '70.79%', '91.58%'];

  function personName(p) {
    return (p && (p.name || p.label)) || '待指定';
  }

  function openStageDrawer(data, stage) {
    const live = stage.liveApproval;
    const head = live
      ? `<div class="meta">${live.status === '审批中' ? '在途流程' : '最近流程'}：${esc(live.title)}（${esc(live.status)}）</div>`
      : `<div class="meta">本阶段按渠道岗位链预排，尚未发起该阶段流程。</div>`;
    const nodesHtml = (stage.flow || []).map((n) => `
      <div class="node ${esc(n.status || '')}">
        <b>${esc(n.title || '')}${n.status === 'current' ? ' · 当前' : ''}</b>
        <div class="meta">${esc(n.dept || '')} · ${esc(n.owner?.label || n.owner?.name || '待指定')}
          <br/>状态：${esc(statusLabel(n.status))}${n.at ? ' · ' + esc(n.at) : ''}${n.comment ? '<br/>意见：' + esc(n.comment) : ''}
        </div>
      </div>`).join('') || '<div class="meta">暂无节点</div>';
    openDrawer(`${stage.name} · 责任与流向`, `
      <div class="meta">${esc(data.code || '')} · ${esc(data.name || '')}</div>
      <div class="node current"><b>本阶段负责</b><div class="meta">${esc(stage.ownerSlotLabel || '待指定')} · ${esc(personName(stage.owner))}</div></div>
      <div class="node"><b>当前流向</b><div class="meta">${esc(stage.flowTo?.title || '—')} · ${esc(personName(stage.flowTo?.owner))}</div></div>
      ${head}
      <h2 style="font-size:14px;margin-top:12px">审签 / 办理链条</h2>
      ${nodesHtml}
    `);
  }

  async function renderProjectStageOwners(pid, svg) {
    const data = await api(`/projects/${pid}/lifecycle-stages`);
    const stages = Array.isArray(data.visual) && data.visual.length ? data.visual : [];
    if (!stages.length) return false;
    let box = document.getElementById('lc-stage-owners');
    if (box && box.previousElementSibling !== svg) {
      box.remove();
      box = null;
    }
    if (!box) {
      box = document.createElement('div');
      box.id = 'lc-stage-owners';
      svg.insertAdjacentElement('afterend', box);
    }
    box.className = 'lc-owners';
    box.innerHTML = stages.map((s, i) => {
      const flowTitle = s.status === 'done' ? '已办结' : (s.flowTo?.title || '待排程');
      const flowName = s.status === 'done' ? '' : personName(s.flowTo?.owner);
      return `
        <button type="button" class="lc-owner-col ${esc(s.status)}" data-stage="${esc(s.id)}" style="left:${VIS_POS[i] || '50%'}" title="${esc(s.name)}：负责 ${esc(s.ownerSlotLabel || '')} ${esc(personName(s.owner))}；流向 ${esc(flowTitle)} ${esc(flowName)}">
          <span class="k">负责 · ${esc(s.ownerSlotLabel || '待指定')}</span>
          <span class="v">${esc(personName(s.owner))}</span>
          <span class="k">流向 · ${esc(flowTitle)}</span>
          <span class="v ${s.status === 'done' ? 'done-txt' : 'flow'}">${esc(flowName || (s.status === 'done' ? '—' : '待指定'))}</span>
        </button>`;
    }).join('');
    box.onclick = (e) => {
      const btn = e.target.closest('[data-stage]');
      if (!btn) return;
      const stage = stages.find((x) => x.id === btn.dataset.stage);
      if (stage) openStageDrawer(data, stage);
    };
    svg.dataset.lcOwners = String(pid);
    return true;
  }

  function injectTeamFlowLink(pid) {
    const hd = [...document.querySelectorAll('.card-hd, header')].find((el) => {
      const t = ((el.querySelector('h3,.card-title') || el).textContent || '').replace(/\s+/g, '');
      return t === '项目团队';
    });
    if (!hd || hd.querySelector('#lc-flow-link')) return;
    const btn = document.createElement('button');
    btn.id = 'lc-flow-link';
    btn.type = 'button';
    btn.textContent = '查看审签流转';
    btn.style.cssText = 'height:32px;padding:0 12px;border:1px solid #D9D9D9;background:#fff;color:#0064EF;border-radius:4px;font-size:13px;cursor:pointer;margin-left:auto';
    btn.onclick = () => {
      const col = document.querySelector('#lc-stage-owners .lc-owner-col.current') || document.querySelector('#lc-stage-owners .lc-owner-col');
      if (col) col.click();
    };
    hd.style.display = hd.style.display || 'flex';
    hd.style.alignItems = 'center';
    hd.appendChild(btn);
  }

  let bootCache = null;
  async function loadBoot() {
    if (!bootCache) bootCache = await api('/bootstrap');
    return bootCache;
  }

  function selectedDeclareChannelName() {
    const nodes = [...document.querySelectorAll('div,h2,h3,span,p,strong,b')];
    for (const el of nodes) {
      if (el.querySelector('div,h2,h3')) continue;
      const t = (el.textContent || '').trim().replace(/\s+/g, '');
      const m = t.match(/^申报材料[（(]([^)）]+)[)）]/);
      if (m) return m[1].trim();
    }
    return '';
  }

  function findDeclareChannel(name) {
    const list = bootCache?.channels || [];
    if (!name) return null;
    const exact = list.filter((c) => c.enabled !== 0 && (c.name === name || `${c.source_channel}/${c.name}` === name));
    if (exact.length) return exact[0];
    return list.find((c) => c.name === name)
      || list.find((c) => c.enabled !== 0 && (name.includes(c.name) || c.name.includes(name)))
      || null;
  }

  function channelFlowSteps(ch) {
    const raw = Array.isArray(ch?.flow) ? ch.flow : [];
    return raw.map((x) => String(x || '').trim()).filter(Boolean);
  }

  function currentFlowIndex(steps) {
    const i = steps.findIndex((s) => /申报|建议书|申请书/.test(s) && !/评审|批复|评估/.test(s));
    if (i >= 0) return i;
    const j = steps.findIndex((s) => /申报|建议书|申请书/.test(s));
    return j >= 0 ? j : 0;
  }

  function findDeclareInsertHost() {
    const labels = [...document.querySelectorAll('div,span,p')];
    const step = labels.find((n) => {
      const t = (n.textContent || '').replace(/\s+/g, '');
      return t === '选择立项渠道' && !n.querySelector('div');
    });
    if (step) {
      let p = step.parentElement;
      for (let i = 0; i < 8 && p; i++) {
        const txt = (p.textContent || '').replace(/\s+/g, '');
        if (txt.includes('选择立项渠道') && txt.includes('填报') && p.parentElement) {
          return p.parentElement;
        }
        p = p.parentElement;
      }
    }
    return $('main') || document.querySelector('[class*="content"]');
  }

  function setDeclareFlowBox(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const next = tmp.firstElementChild;
    if (!next) return null;
    next.id = 'lc-declare-hint';
    const existing = document.getElementById('lc-declare-hint');
    if (existing && existing.innerHTML === next.innerHTML && existing.className === next.className) return existing;
    const host = findDeclareInsertHost();
    if (!host) return existing || null;
    if (existing) existing.remove();
    host.insertBefore(next, host.firstChild);
    return next;
  }

  async function renderDeclareChannelFlow() {
    document.getElementById('lc-declare-hint')?.remove();
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

  function stripDutyHints() {
    document.querySelectorAll('.lc-hint').forEach((el) => el.remove());
    const hits = [...document.querySelectorAll('div,section,aside')].filter((el) => {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      return t.startsWith('V19 填表分工') && t.length < 1600;
    });
    hits.sort((a, b) => (a.contains(b) ? 1 : b.contains(a) ? -1 : 0));
    hits.forEach((el) => { if (el.isConnected && !el.closest('.lc-ch-flow')) el.remove(); });
  }

  let last = '';
  async function run() {
    stripDutyHints();
    if (!token()) return;
    ensureStyle();
    const path = location.pathname;
    const m = path.match(/^\/projects\/(\d+)/);
    $('#lc-stage-bar')?.remove();

    if (!m) {
      $('#lc-stage-owners')?.remove();
      if (path.startsWith('/declare')) {
        last = path;
        try { await renderDeclareChannelFlow(); } catch (_) {}
        return;
      }
      document.getElementById('lc-declare-hint')?.remove();
      if (path === last) return;
      last = path;
      if (path.startsWith('/milestones')) {
        try { await renderMilestonePanels(); } catch (e) { console.warn('milestone panels', e); }
      }
      return;
    }

    last = path;
    const svg = document.querySelector('svg[aria-label="项目全生命周期阶段"]');
    const box = document.getElementById('lc-stage-owners');
    if (svg && box && svg.dataset.lcOwners === m[1] && box.previousElementSibling === svg) {
      try { injectTeamFlowLink(m[1]); } catch (_) {}
      return;
    }
    if (!svg) return;
    try { await renderProjectStageOwners(m[1], svg); } catch (e) { console.warn('stage owners', e); }
    try { injectTeamFlowLink(m[1]); } catch (_) {}
  }

  new MutationObserver(() => {
    const path = location.pathname;
    if (path !== last) run();
    else if (/^\/projects\/\d+/.test(path)) {
      if (!document.getElementById('lc-stage-owners')) run();
      else {
        const id = (path.match(/^\/projects\/(\d+)/) || [])[1];
        if (id) injectTeamFlowLink(id);
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
  run();
})();
