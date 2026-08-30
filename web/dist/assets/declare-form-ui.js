(() => {
  'use strict';
  const API = '/api';
  const $ = (s, r = document) => r.querySelector(s);

  function token() {
    const raw = localStorage.getItem('srpm.user') || sessionStorage.getItem('srpm.user') || '';
    if (!raw) return '';
    try {
      const o = JSON.parse(raw);
      return o.sessionToken || o.token || raw;
    } catch {
      return raw;
    }
  }

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

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

  function ensureStyle() {
    if ($('#srpm-declare-extra-style')) return;
    const st = document.createElement('style');
    st.id = 'srpm-declare-extra-style';
    st.textContent = `
#srpm-declare-extra{
  box-sizing:border-box;
  width:100%;
  min-width:0;
  margin:0;
  padding:16px 0 0;
  border:none;
  border-top:1px solid #E8E8E8;
  background:transparent;
  border-radius:0;
}
#srpm-declare-extra .de-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;min-width:0}
#srpm-declare-extra label{display:flex;flex-direction:column;gap:8px;font-size:12px;color:#8C8C8C;min-width:0}
#srpm-declare-extra .wide{grid-column:1/-1}
#srpm-declare-extra .req span::after{content:" *";color:#CF1322}
#srpm-declare-extra input,#srpm-declare-extra select,#srpm-declare-extra textarea{
  width:100%;box-sizing:border-box;
  height:32px;border:1px solid #D9D9D9;border-radius:4px;padding:0 8px;color:#1F1F1F;background:#fff;font-size:13px
}
#srpm-declare-extra textarea{height:auto;min-height:72px;padding:8px}
#srpm-declare-extra input:disabled{background:#F5F7FA;color:#8C8C8C}
#srpm-declare-extra .de-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) 32px;gap:8px;align-items:end}
#srpm-declare-extra .de-btn{height:32px;padding:0 12px;border:1px solid #D9D9D9;border-radius:4px;background:#fff;color:#0064EF;cursor:pointer;font-size:13px}
#srpm-declare-extra .de-btn.primary{background:#0064EF;border-color:#0064EF;color:#fff}
#srpm-declare-extra .de-err{margin-top:8px;font-size:12px;color:#CF1322}
#srpm-declare-confirm{margin:4px 0 0;padding:16px 0 4px;border-top:1px solid #E8E8E8}
#srpm-declare-confirm .dc-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px}
#srpm-declare-confirm .dc-item span{display:block;font-size:11.5px;color:#8C8C8C;margin-bottom:2px}
#srpm-declare-confirm .dc-item b{display:block;font-size:13px;font-weight:400;color:#1F1F1F;line-height:1.5;word-break:break-word}
#srpm-declare-confirm .wide{grid-column:1/-1}
#srpm-declare-extra .de-team{grid-column:1/-1;border:1px solid #E8E8E8;border-radius:4px;overflow:hidden;background:#fff}
#srpm-declare-extra .de-team table{width:100%;border-collapse:collapse}
#srpm-declare-extra .de-team th,#srpm-declare-extra .de-team td{border:1px solid #E8E8E8;padding:8px 10px;vertical-align:middle;font-size:13px}
#srpm-declare-extra .de-team th{background:#F5F7FA;color:#1F1F1F;font-weight:600;text-align:center}
#srpm-declare-extra .de-group{width:40px;background:#F0F5FF;color:#0048A0;font-weight:600;text-align:center;letter-spacing:2px;writing-mode:vertical-rl}
#srpm-declare-extra .de-role{width:168px;color:#1F1F1F;white-space:nowrap}
#srpm-declare-confirm .dc-team{margin-top:8px;border:1px solid #E8E8E8;border-radius:4px;overflow:hidden}
#srpm-declare-confirm .dc-team table{width:100%;border-collapse:collapse}
#srpm-declare-confirm .dc-team th,#srpm-declare-confirm .dc-team td{border:1px solid #E8E8E8;padding:6px 10px;font-size:13px}
#srpm-declare-confirm .dc-team th{background:#F5F7FA;text-align:center}
#srpm-declare-confirm .dc-group{width:36px;background:#F0F5FF;color:#0048A0;font-weight:600;text-align:center;writing-mode:vertical-rl}
#srpm-declare-toast{position:fixed;top:76px;right:24px;z-index:99999;background:#0064EF;color:#fff;padding:10px 16px;border-radius:4px;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.12)}
#srpm-declare-draft{height:32px;padding:0 16px;border:1px solid #D9D9D9;background:#fff;color:#262626;border-radius:4px;font-size:13px;cursor:pointer}
#srpm-declare-draft:hover{border-color:#0064EF;color:#0064EF}
`;
    document.head.appendChild(st);
  }

  const DECLARE_TEAM_GROUPS = [
    { group: '技术团队', slots: [['contact', '项目联系人'], ['owner', '项目负责人'], ['tech', '技术负责人']] },
    { group: '责任专家', slots: [['pm', '项目主管'], ['chief1', '一级总师'], ['chief2', '二级总师']] },
    { group: '管理团队', slots: [['hqHead', '总部处室处长'], ['hqStaff', '总部处室主管'], ['unitDeptHead', '单位科技部长'], ['unitStaff', '单位科技主管']] },
    { group: '财务团队', slots: [['finHq', '总部财务主管'], ['finHead', '单位财务部长'], ['finStaff', '单位财务主管']] },
  ];
  const DECLARE_TEAM_SLOTS = DECLARE_TEAM_GROUPS.flatMap((g) => g.slots);

  function peopleOptions(people, selected) {
    const opts = ['<option value="">请选择在岗人员</option>'];
    for (const u of people || []) {
      const emp = String(u.empNo || u.emp_no || '');
      const sel = emp === String(selected || '') || u.name === selected ? ' selected' : '';
      opts.push(`<option value="${esc(emp)}"${sel}>${esc(u.label || `${u.name}（${emp}）`)}</option>`);
    }
    return opts.join('');
  }

  function unitOptions(units, selectedId, selectedName) {
    const opts = ['<option value="">请选择</option>'];
    for (const u of units || []) {
      const sel = String(u.id) === String(selectedId || '') || u.name === selectedName || u.short === selectedName ? ' selected' : '';
      opts.push(`<option value="${esc(u.id)}" data-name="${esc(u.name)}"${sel}>${esc(u.short || u.name)}</option>`);
    }
    return opts.join('');
  }

  let cache = null;
  async function loadCache() {
    if (cache) return cache;
    const [meta, peopleWrap, boot, session] = await Promise.all([
      api('/meta/stage-fields'),
      api('/meta/people').catch(() => api('/roster')),
      fetch('/api/bootstrap').then((r) => r.json()),
      api('/session'),
    ]);
    cache = {
      major1: meta.major1 || [],
      major2ByMajor1: meta.major2ByMajor1 || {},
      people: peopleWrap.people || [],
      units: boot.units || [],
      me: session,
    };
    return cache;
  }

  function fillMajor2(panel, major1, keep) {
    const map = cache?.major2ByMajor1 || {};
    const list = map[major1] || [];
    const sel = panel.querySelector('#de-major2');
    sel.innerHTML = '<option value="">请先选一级专业</option>'
      + list.map((x) => `<option value="${esc(x)}"${x === keep ? ' selected' : ''}>${esc(x)}</option>`).join('');
  }

  function partnerRowsHtml(rows) {
    const data = rows && rows.length ? rows : [{ name: '', work: '' }];
    return data.map((r) => `
      <div class="de-row">
        <input class="de-p-name" placeholder="参研单位名称" value="${esc(r.name || '')}" />
        <input class="de-p-work" placeholder="主要工作内容" value="${esc(r.work || '')}" />
        <button type="button" class="de-btn de-p-del">−</button>
      </div>`).join('');
  }

  function fieldValue(root, labelText) {
    const labs = [...(root || document).querySelectorAll('label.block')];
    const lab = labs.find((el) => {
      const s = el.querySelector(':scope > span');
      const t = (s?.textContent || '').replace(/\*/g, '').trim();
      return t === labelText || t.startsWith(labelText);
    });
    if (!lab) return '';
    const inp = lab.querySelector('input:not([type=file]), textarea, select');
    return (inp?.value || '').trim();
  }

  function scrapeBasic() {
    const extra = $('#srpm-declare-extra');
    const card = extra?.closest('.card') || extra?.closest('section') || document;
    return {
      name: fieldValue(card, '项目名称'),
      goal: fieldValue(card, '项目目标'),
      budget: fieldValue(card, '申请经费'),
      start: fieldValue(card, '开始时间'),
      end: fieldValue(card, '结束时间'),
      partnersText: fieldValue(card, '参研单位'),
    };
  }

  function draftKey() {
    let emp = '';
    try {
      const o = JSON.parse(localStorage.getItem('srpm.user') || sessionStorage.getItem('srpm.user') || '{}');
      emp = o.emp_no || o.empNo || o.id || o.name || '';
    } catch (_) {}
    return `srpm.declare.draft.${emp || 'anon'}`;
  }

  function readDraft() {
    try {
      const s = sessionStorage.getItem('srpm.declare.extra');
      if (s) return JSON.parse(s);
    } catch (_) {}
    try {
      const s = localStorage.getItem(draftKey());
      if (s) return JSON.parse(s);
    } catch (_) {}
    return null;
  }

  function toast(msg) {
    let n = document.getElementById('srpm-declare-toast');
    if (!n) {
      n = document.createElement('div');
      n.id = 'srpm-declare-toast';
      document.body.appendChild(n);
    }
    n.textContent = msg;
    n.hidden = false;
    clearTimeout(n._t);
    n._t = setTimeout(() => { n.hidden = true; }, 2400);
  }

  function setNative(el, value) {
    if (!el || value == null || value === '') return;
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function labeledInput(labelText) {
    const labs = [...document.querySelectorAll('label')];
    const lab = labs.find((el) => {
      const s = el.querySelector(':scope > span');
      const t = (s?.textContent || '').replace(/\*/g, '').trim();
      return t === labelText || t.startsWith(labelText);
    });
    return lab?.querySelector('input:not([type=file]), textarea, select') || null;
  }

  function restoreBasic(saved) {
    const b = saved?.basic;
    if (!b) return;
    setNative(labeledInput('项目名称'), b.name);
    setNative(labeledInput('项目目标'), b.goal);
    setNative(labeledInput('申请经费'), b.budget);
    setNative(labeledInput('开始时间'), b.start);
    setNative(labeledInput('结束时间'), b.end);
    setNative(labeledInput('参研单位'), b.partnersText);
  }

  function readNeedApproval() {
    const on = document.querySelector('input[name="deNeedAppr"]:checked');
    if (on) return on.value !== '0';
    return true;
  }

  function persist(panel) {
    try {
      const extra = collect(panel);
      extra.basic = scrapeBasic();
      extra.needApproval = readNeedApproval();
      extra.savedAt = new Date().toISOString();
      extra.matUploads = window.__srpmMatUploads || {};
      const json = JSON.stringify(extra);
      sessionStorage.setItem('srpm.declare.extra', json);
      localStorage.setItem(draftKey(), json);
    } catch (_) {}
  }

  function saveDraft() {
    const panel = $('#srpm-declare-extra');
    if (panel) persist(panel);
    else {
      try {
        const extra = readDraft() || {};
        extra.basic = scrapeBasic();
        extra.savedAt = new Date().toISOString();
        extra.matUploads = window.__srpmMatUploads || {};
        const json = JSON.stringify(extra);
        sessionStorage.setItem('srpm.declare.extra', json);
        localStorage.setItem(draftKey(), json);
      } catch (_) {}
    }
    toast('已暂存，可稍后继续填写');
  }

  window.__srpmSaveDeclareDraft = saveDraft;

  function restore(panel) {
    let saved = readDraft();
    if (!saved) return;
    const set = (id, v) => { const el = panel.querySelector(id); if (el && v != null && v !== '') el.value = v; };
    set('#de-major1', saved.major1);
    fillMajor2(panel, saved.major1 || '', saved.major2);
    set('#de-demand', saved.demandUnit);
    set('#de-lead-unit', saved.leadUnitId);
    set('#de-lead-work', saved.leadWork);
    if (window.SrpmPeoplePicker) {
      for (const [key] of DECLARE_TEAM_SLOTS) {
        window.SrpmPeoplePicker.setValue(panel.querySelector('#de-' + key), saved.team?.[key]);
      }
    }
    set('#de-grant', saved.finance?.centralGrant || '');
    set('#de-self', saved.finance?.selfFund || '');
    set('#de-igran', saved.finance?.internalGrant || '');
    set('#de-iself', saved.finance?.internalSelfFund || '');
    if (Array.isArray(saved.partners) && saved.partners.length) {
      const box = panel.querySelector('#de-partners');
      if (box) box.innerHTML = partnerRowsHtml(saved.partners);
    }
    if (saved.matUploads && typeof saved.matUploads === 'object') {
      window.__srpmMatUploads = { ...(window.__srpmMatUploads || {}), ...saved.matUploads };
    }
    const nameEl = labeledInput('项目名称');
    if (nameEl && !(nameEl.value || '').trim()) restoreBasic(saved);
  }
  function pickerVal(sel) {
    return (window.SrpmPeoplePicker && window.SrpmPeoplePicker.getValue(sel)) || '';
  }

  function pickerLabel(sel, people, fallback) {
    const emp = pickerVal(sel);
    const u = (people || []).find((x) => String(x.empNo || x.emp_no || x.id) === String(emp) || x.name === emp);
    if (u) return u.label || `${u.name}（${u.empNo || u.emp_no || ''}）`;
    return fallback || '';
  }

  function collect(panel) {
    const unitSel = panel.querySelector('#de-lead-unit');
    const unitOpt = unitSel?.selectedOptions?.[0];
    const partners = [...panel.querySelectorAll('.de-row')].map((row) => ({
      name: row.querySelector('.de-p-name')?.value.trim() || '',
      work: row.querySelector('.de-p-work')?.value.trim() || '',
    })).filter((x) => x.name);
    return {
      major1: panel.querySelector('#de-major1')?.value || '',
      major2: panel.querySelector('#de-major2')?.value || '',
      demandUnit: panel.querySelector('#de-demand')?.value.trim() || '',
      leadUnitId: unitSel?.value || '',
      responsibleUnit: unitOpt?.dataset.name || unitOpt?.textContent || '',
      leadWork: panel.querySelector('#de-lead-work')?.value.trim() || '',
      team: Object.fromEntries(DECLARE_TEAM_SLOTS.map(([key]) => {
        let v = pickerVal(panel.querySelector('#de-' + key));
        if (key === 'contact' && !v) v = cache?.me?.emp_no || cache?.me?.name || '';
        return [key, v];
      })),
      teamLabels: Object.fromEntries(DECLARE_TEAM_SLOTS.map(([key]) => {
        const fallback = key === 'contact' && cache?.me?.name ? `${cache.me.name}（${cache.me.emp_no || ''}）` : '';
        return [key, pickerLabel(panel.querySelector('#de-' + key), cache?.people, fallback)];
      })),
      partners,
      finance: {
        centralGrant: Number(panel.querySelector('#de-grant')?.value || 0),
        selfFund: Number(panel.querySelector('#de-self')?.value || 0),
        internalGrant: Number(panel.querySelector('#de-igran')?.value || 0),
        internalSelfFund: Number(panel.querySelector('#de-iself')?.value || 0),
      },
    };
  }

  function validate(extra) {
    if (!extra.major1 || !extra.major2) return '请选择一级专业和对应二级专业（附件1口径）';
    if (!extra.leadWork) return '请填写牵头单位主要工作内容';
    for (const [key, label] of DECLARE_TEAM_SLOTS) {
      if (!extra.team?.[key]) return `请指定${label}（姓名及工号）`;
    }
    return '';
  }

  function allExtras() {
    return [...document.querySelectorAll('[id="srpm-declare-extra"]')];
  }

  function findAnchor() {
    return [...document.querySelectorAll('h2,h3,div,span')].find((el) => {
      if ((el.textContent || '').trim() !== '项目基本信息') return false;
      return ![...el.children].some((c) => (c.textContent || '').trim() === '项目基本信息');
    });
  }

  function dash(v) {
    if (v === 0) return '0';
    if (v == null || v === '' || v === '请选择' || v === '请选择在岗人员' || v === '待指定') return '—';
    return String(v);
  }

  function money(v) {
    if (v == null || v === '' || Number.isNaN(Number(v))) return '—';
    return `${v} 万元`;
  }

  function empText(emp, label) {
    if (label && label !== '请选择在岗人员' && label !== '请选择') return label;
    const u = (cache?.people || []).find((p) => String(p.empNo || p.emp_no || '') === String(emp || '') || p.name === emp);
    if (u) return u.label || `${u.name}（${u.empNo || u.emp_no || ''}）`;
    return dash(emp);
  }

  function dcItem(label, value, wide) {
    return `<div class="dc-item${wide ? ' wide' : ''}"><span>${esc(label)}</span><b>${esc(dash(value))}</b></div>`;
  }

  async function renderConfirm(titleEl) {
    allExtras().forEach((n) => n.remove());
    const card = titleEl.closest('.card') || titleEl.closest('section');
    if (!card) return;
    card.style.maxWidth = '1080px';
    ensureStyle();
    try { await loadCache(); } catch (_) {}
    let extra = null;
    try { extra = JSON.parse(sessionStorage.getItem('srpm.declare.extra') || 'null'); } catch { extra = null; }
    extra = extra || {};
    const basic = extra.basic || {};
    const fin = extra.finance || {};
    const partners = Array.isArray(extra.partners) ? extra.partners : [];
    const partnerText = partners.length
      ? partners.map((p) => p.work ? `${p.name}：${p.work}` : p.name).join('；')
      : basic.partnersText;
    const html = `<div class="dc-grid">
      ${dcItem('是否需要审批', extra.needApproval === false ? '无需审批（直接线上报备）' : '需审批（按渠道走线上审签）', true)}
      ${dcItem('项目目标', basic.goal, true)}
      ${dcItem('一级专业', extra.major1)}
      ${dcItem('二级专业', extra.major2)}
      ${dcItem('管理/需求单位', extra.demandUnit)}
      ${dcItem('责任单位 / 牵头单位', extra.responsibleUnit)}
      ${dcItem('牵头单位主要工作内容', extra.leadWork, true)}
    </div>
    <div class="dc-team" style="grid-column:1/-1">
      <table>
        <thead><tr><th colspan="2">申报岗位</th><th>姓名及工号</th></tr></thead>
        <tbody>
          ${DECLARE_TEAM_GROUPS.map((g) => g.slots.map(([key, label], i) => `<tr>
            ${i === 0 ? `<td class="dc-group" rowspan="${g.slots.length}">${esc(g.group)}</td>` : ''}
            <td>${esc(label)}</td>
            <td>${esc(empText(extra.team?.[key], extra.teamLabels?.[key]))}</td>
          </tr>`).join('')).join('')}
        </tbody>
      </table>
    </div>
    <div class="dc-grid">
      ${dcItem('国拨经费', money(fin.centralGrant))}
      ${dcItem('自筹经费', money(fin.selfFund))}
      ${dcItem('其中商飞内部国拨', money(fin.internalGrant))}
      ${dcItem('其中商飞内部自筹', money(fin.internalSelfFund))}
      ${dcItem('参研单位与分工', partnerText, true)}
    </div>`;
    const sig = html;
    let box = $('#srpm-declare-confirm');
    if (box && box.dataset.sig === sig) return;
    if (!box) {
      box = document.createElement('div');
      box.id = 'srpm-declare-confirm';
      const mat = [...card.querySelectorAll('span')].find((s) => (s.textContent || '').trim() === '随附材料');
      const matBlock = mat && mat.parentElement;
      if (matBlock && matBlock.parentElement) matBlock.parentElement.insertBefore(box, matBlock);
      else {
        const grid = card.querySelector('.grid');
        if (grid) grid.insertAdjacentElement('afterend', box);
        else (card.querySelector('.p-4') || card).appendChild(box);
      }
    }
    box.innerHTML = html;
    box.dataset.sig = sig;
  }

  function findConfirmTitle() {
    return [...document.querySelectorAll('h2,h3,div,span')].find((el) => {
      if ((el.textContent || '').trim() !== '提交确认') return false;
      return ![...el.children].some((c) => (c.textContent || '').trim() === '提交确认');
    });
  }

  function findBasicCard(anchor) {
    return anchor.closest('section.card') || anchor.closest('.card') || anchor.closest('section');
  }

  function placePanel(panel, anchor) {
    document.querySelectorAll('.srpm-declare-layout').forEach((el) => el.classList.remove('srpm-declare-layout'));
    const card = findBasicCard(anchor);
    if (!card) {
      const host = anchor.parentElement;
      if (host && panel.parentElement !== host) host.appendChild(panel);
      return;
    }
    const body = card.querySelector('.p-4') || card;
    const form = [...body.children].find((el) =>
      el.tagName === 'DIV' && String(el.className || '').includes('flex-col')
    ) || body;
    if (panel.parentElement !== form) form.appendChild(panel);
  }

  function displayDeclareMaterial(name) {
    let t = String(name || '');
    if (/任务清单/.test(t)) return t;
    t = t.replace(/项目建议书/g, '\u0001').replace(/项目申请书/g, '\u0002');
    t = t.replace(/建议书/g, '项目建议书').replace(/申请书/g, '项目申请书').replace(/任务书/g, '项目建议书');
    return t.replace(/\u0001/g, '项目建议书').replace(/\u0002/g, '项目申请书');
  }

  function relabelAiReadCopy() {
    /* 主包已改为「项目建议书或项目申请书」，避免整页扫 DOM 触发闪动 */
  }

  function relabelDeclareMaterials() {
    if (!location.pathname.startsWith('/declare')) return;
    const walk = (node) => {
      if (!node) return;
      if (node.nodeType === 3) {
        const next = displayDeclareMaterial(node.nodeValue);
        if (next !== node.nodeValue) node.nodeValue = next;
        return;
      }
      if (node.nodeType !== 1) return;
      const tag = node.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'SCRIPT' || tag === 'STYLE') return;
      node.childNodes.forEach(walk);
    };
    const heads = [...document.querySelectorAll('div,h2,h3,span')].filter((el) => /^申报材料/.test((el.textContent || '').trim()));
    for (const h of heads) {
      const card = h.closest('[class*="card"]') || h.parentElement;
      if (card) walk(card);
    }
  }

  let mounting = false;
  async function mount() {
    if (!location.pathname.startsWith('/declare')) {
      allExtras().forEach((n) => n.remove());
      $('#srpm-declare-confirm')?.remove();
      return;
    }
    relabelDeclareMaterials();
    relabelAiReadCopy();
    const confirmTitle = findConfirmTitle();
    if (confirmTitle) {
      allExtras().forEach((n) => n.remove());
      await renderConfirm(confirmTitle);
      return;
    }
    $('#srpm-declare-confirm')?.remove();
    const extras = allExtras();
    extras.slice(1).forEach((n) => n.remove());
    const anchor = findAnchor();
    const existing = extras[0] || null;
    if (existing && !anchor) {
      existing.style.display = 'none';
      return;
    }
    if (existing && anchor) {
      existing.style.display = '';
      const form = (findBasicCard(anchor)?.querySelector('.p-4') || findBasicCard(anchor) || anchor.parentElement);
      if (form && existing.parentElement !== form && !form.contains(existing)) placePanel(existing, anchor);
      if (existing.dataset.deRestored !== '1') {
        restore(existing);
        existing.dataset.deRestored = '1';
      }
      return;
    }
    if (!anchor || mounting) return;
    mounting = true;
    try {
    ensureStyle();
    const data = await loadCache();
    if (allExtras().length) {
      placePanel(allExtras()[0], findAnchor() || anchor);
      allExtras().slice(1).forEach((n) => n.remove());
      return;
    }
    const wrap = document.createElement('div');
    wrap.id = 'srpm-declare-extra';
    wrap.innerHTML = `
      <div class="de-grid">
        <label class="req"><span>一级专业</span>
          <select id="de-major1">${['<option value="">请选择</option>'].concat(data.major1.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`)).join('')}</select>
        </label>
        <label class="req"><span>二级专业</span>
          <select id="de-major2"><option value="">请先选一级专业</option></select>
        </label>
        <label><span>管理/需求单位</span>
          <input id="de-demand" placeholder="内部项目可与责任单位相同" />
        </label>
        <label class="req"><span>责任单位 / 牵头单位</span>
          <select id="de-lead-unit">${unitOptions(data.units, data.me?.unit_id)}</select>
        </label>
        <label class="req wide"><span>牵头单位主要工作内容</span>
          <textarea id="de-lead-work" placeholder="牵头单位在本项目中的主要任务"></textarea>
        </label>
        <div class="wide de-team">
          <table>
            <thead><tr><th colspan="2">申报须填岗位</th><th>姓名及工号</th></tr></thead>
            <tbody>
              ${DECLARE_TEAM_GROUPS.map((g) => g.slots.map(([key, label], i) => `
                <tr>
                  ${i === 0 ? `<td class="de-group" rowspan="${g.slots.length}">${esc(g.group)}</td>` : ''}
                  <td class="de-role">${esc(label)} <span style="color:#CF1322">*</span></td>
                  <td><div id="de-${key}"></div></td>
                </tr>`).join('')).join('')}
            </tbody>
          </table>
        </div>
        <label><span>国拨经费（万元）</span><input id="de-grant" type="number" min="0" step="0.1" /></label>
        <label><span>自筹经费（万元）</span><input id="de-self" type="number" min="0" step="0.1" /></label>
        <label><span>其中商飞内部国拨</span><input id="de-igran" type="number" min="0" step="0.1" /></label>
        <label><span>其中商飞内部自筹</span><input id="de-iself" type="number" min="0" step="0.1" /></label>
      </div>
      <div class="de-err" id="de-err" hidden></div>
    `;
    placePanel(wrap, findAnchor() || anchor);
    const picker = window.SrpmPeoplePicker;
    if (picker) {
      for (const [key, label] of DECLARE_TEAM_SLOTS) {
        const opts = {
          people: data.people,
          placeholder: `输入姓名或工号查找${label}`,
          onChange: () => persist(wrap),
        };
        if (key === 'contact') {
          opts.value = data.me?.emp_no || data.me?.id || data.me?.name;
          opts.disabled = true;
          opts.placeholder = '当前登录人';
        }
        picker.mount(wrap.querySelector('#de-' + key), opts);
      }
    }
    restore(wrap);
    wrap.dataset.deRestored = '1';
    wrap.addEventListener('change', () => persist(wrap));
    wrap.addEventListener('input', () => persist(wrap));
    const card = findBasicCard(findAnchor() || anchor);
    if (card && card.dataset.deBind !== '1') {
      card.dataset.deBind = '1';
      card.addEventListener('input', () => persist(wrap));
      card.addEventListener('change', () => persist(wrap));
    }

    wrap.querySelector('#de-major1').addEventListener('change', (e) => fillMajor2(wrap, e.target.value));
    const major1Val = wrap.querySelector('#de-major1')?.value;
    if (major1Val) fillMajor2(wrap, major1Val, wrap.querySelector('#de-major2')?.value);
    wrap.querySelector('#de-p-add')?.addEventListener('click', () => {
      const box = wrap.querySelector('#de-partners');
      if (!box) return;
      box.insertAdjacentHTML('beforeend', partnerRowsHtml([{ name: '', work: '' }]));
    });
    wrap.addEventListener('click', (e) => {
      if (!e.target.classList.contains('de-p-del')) return;
      const box = wrap.querySelector('#de-partners');
      e.target.closest('.de-row')?.remove();
      if (!box.children.length) box.innerHTML = partnerRowsHtml([]);
    });
    } finally {
      mounting = false;
    }
  }

  function hookFetch() {
    if (window.__srpmDeclareFetchHook) return;
    window.__srpmDeclareFetchHook = true;
    const orig = window.fetch.bind(window);
    window.fetch = async function (input, init) {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const method = (init && init.method) || (input && input.method) || 'GET';
      if (/\/api\/declarations\/?$/.test(url) && String(method).toUpperCase() === 'POST') {
        const panel = $('#srpm-declare-extra');
        if (panel) {
          const extra = collect(panel);
          const err = validate(extra);
          const errBox = panel.querySelector('#de-err');
          if (err) {
            errBox.hidden = false;
            errBox.textContent = err;
            panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return new Response(JSON.stringify({ error: err }), { status: 400, headers: { 'Content-Type': 'application/json' } });
          }
          errBox.hidden = true;
          let body = {};
          try { body = JSON.parse(init?.body || '{}'); } catch { body = {}; }
          const merged = {
            ...body,
            major1: extra.major1,
            major2: extra.major2,
            demandUnit: extra.demandUnit,
            leadWork: extra.leadWork,
            leadUnitId: extra.leadUnitId ? Number(extra.leadUnitId) : body.leadUnitId,
            responsibleUnit: extra.responsibleUnit,
            team: { ...(body.team || {}), ...extra.team },
            partners: extra.partners.length ? extra.partners : body.partners,
            finance: extra.finance,
            needApproval: Object.prototype.hasOwnProperty.call(body, 'needApproval') ? body.needApproval !== false : extra.needApproval !== false,
            declareMode: (Object.prototype.hasOwnProperty.call(body, 'needApproval') ? body.needApproval !== false : extra.needApproval !== false) ? '审批' : '报备',
          };
          init = { ...(init || {}), body: JSON.stringify(merged) };
          const res = await orig(input, init);
          if (res.ok) {
            try { sessionStorage.removeItem('srpm.declare.extra'); } catch (_) {}
            try { localStorage.removeItem(draftKey()); } catch (_) {}
            try {
              const data = await res.clone().json();
              const arch = data.archive;
              if (arch) {
                const n = arch.memberCount || (arch.members || []).length;
                toast(`已建档 ${arch.code || ''}，已关联 ${n} 名岗位人员并下发任务`);
              }
            } catch (_) {}
          }
          return res;
        }
        let saved = null;
        try { saved = JSON.parse(sessionStorage.getItem('srpm.declare.extra') || 'null'); } catch { saved = null; }
        if (saved) {
          const err = validate(saved);
          if (err) {
            return new Response(JSON.stringify({ error: err }), { status: 400, headers: { 'Content-Type': 'application/json' } });
          }
          let body = {};
          try { body = JSON.parse(init?.body || '{}'); } catch { body = {}; }
          const { basic, teamLabels, ...rest } = saved;
          init = { ...(init || {}), body: JSON.stringify({ ...body, ...rest, team: { ...(body.team || {}), ...(saved.team || {}) } }) };
        }
      }
      return orig(input, init);
    };
  }

  hookFetch();
  if (!window.__srpmDeclarePersistClick) {
    window.__srpmDeclarePersistClick = true;
    document.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest && e.target.closest('button');
      if (!btn) return;
      const t = (btn.textContent || '').replace(/\s+/g, '');
      if (!(t.includes('下一步') && t.includes('确认提交'))) return;
      const panel = $('#srpm-declare-extra');
      if (panel) persist(panel);
    }, true);
  }
  let timer = 0;
  const boot = () => { mount().catch((e) => { mounting = false; console.warn('declare extra', e); }); };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(boot, 160);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  new MutationObserver((muts) => {
    if (!location.pathname.startsWith('/declare')) {
      allExtras().forEach((n) => n.remove());
      $('#srpm-declare-confirm')?.remove();
      return;
    }
    const self = muts.every((m) => {
      const t = m.target;
      if (!t) return false;
      const el = t.nodeType === 1 ? t : t.parentElement;
      return !!(el && el.closest && (
        el.closest('#srpm-declare-extra')
        || el.closest('#srpm-declare-confirm')
        || el.closest('.lc-ch-flow')
        || el.closest('#lc-declare-hint')
      ));
    });
    if (self) return;
    schedule();
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
