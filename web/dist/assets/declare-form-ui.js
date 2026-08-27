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
@media(max-width:720px){
  #srpm-declare-extra .de-grid,#srpm-declare-confirm .dc-grid{grid-template-columns:1fr}
}
`;
    document.head.appendChild(st);
  }

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

  function persist(panel) {
    try {
      const extra = collect(panel);
      extra.basic = scrapeBasic();
      sessionStorage.setItem('srpm.declare.extra', JSON.stringify(extra));
    } catch (_) {}
  }

  function restore(panel) {
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem('srpm.declare.extra') || 'null'); } catch { saved = null; }
    if (!saved) return;
    const set = (id, v) => { const el = panel.querySelector(id); if (el && v != null && v !== '') el.value = v; };
    set('#de-major1', saved.major1);
    fillMajor2(panel, saved.major1 || '', saved.major2);
    set('#de-demand', saved.demandUnit);
    set('#de-lead-unit', saved.leadUnitId);
    set('#de-lead-work', saved.leadWork);
    if (window.SrpmPeoplePicker) {
      window.SrpmPeoplePicker.setValue(panel.querySelector('#de-owner'), saved.team?.owner);
      window.SrpmPeoplePicker.setValue(panel.querySelector('#de-tech'), saved.team?.tech);
    }
    set('#de-grant', saved.finance?.centralGrant || '');
    set('#de-self', saved.finance?.selfFund || '');
    set('#de-igran', saved.finance?.internalGrant || '');
    set('#de-iself', saved.finance?.internalSelfFund || '');
    if (Array.isArray(saved.partners) && saved.partners.length) {
      panel.querySelector('#de-partners').innerHTML = partnerRowsHtml(saved.partners);
    }
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
      team: {
        contact: cache?.me?.name || '',
        owner: pickerVal(panel.querySelector('#de-owner')),
        tech: pickerVal(panel.querySelector('#de-tech')),
      },
      teamLabels: {
        contact: cache?.me?.name ? `${cache.me.name}（${cache.me.emp_no || ''}）` : '',
        owner: pickerLabel(panel.querySelector('#de-owner'), cache?.people),
        tech: pickerLabel(panel.querySelector('#de-tech'), cache?.people),
      },
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
    if (!extra.team.owner) return '请指定项目负责人';
    if (!extra.team.tech) return '请指定技术负责人';
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
    card.style.maxWidth = '960px';
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
      ${dcItem('项目目标', basic.goal, true)}
      ${dcItem('一级专业', extra.major1)}
      ${dcItem('二级专业', extra.major2)}
      ${dcItem('管理/需求单位', extra.demandUnit)}
      ${dcItem('责任单位 / 牵头单位', extra.responsibleUnit)}
      ${dcItem('牵头单位主要工作内容', extra.leadWork, true)}
      ${dcItem('项目联系人', extra.teamLabels?.contact || extra.team?.contact)}
      ${dcItem('项目负责人', empText(extra.team?.owner, extra.teamLabels?.owner))}
      ${dcItem('技术负责人', empText(extra.team?.tech, extra.teamLabels?.tech))}
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

  let mounting = false;
  async function mount() {
    if (!location.pathname.startsWith('/declare')) {
      allExtras().forEach((n) => n.remove());
      $('#srpm-declare-confirm')?.remove();
      return;
    }
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
      placePanel(existing, anchor);
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
        <label><span>项目联系人</span>
          <div id="de-contact"></div>
        </label>
        <label class="req"><span>项目负责人</span>
          <div id="de-owner"></div>
        </label>
        <label class="req"><span>技术负责人</span>
          <div id="de-tech"></div>
        </label>
        <label><span>国拨经费（万元）</span><input id="de-grant" type="number" min="0" step="0.1" /></label>
        <label><span>自筹经费（万元）</span><input id="de-self" type="number" min="0" step="0.1" /></label>
        <label><span>其中商飞内部国拨</span><input id="de-igran" type="number" min="0" step="0.1" /></label>
        <label><span>其中商飞内部自筹</span><input id="de-iself" type="number" min="0" step="0.1" /></label>
        <label class="wide"><span>参研单位与分工</span>
          <div id="de-partners">${partnerRowsHtml([])}</div>
          <button type="button" class="de-btn" id="de-p-add" style="margin-top:8px;width:max-content">增加参研单位</button>
        </label>
      </div>
      <div class="de-err" id="de-err" hidden></div>
    `;
    placePanel(wrap, findAnchor() || anchor);
    const picker = window.SrpmPeoplePicker;
    if (picker) {
      picker.mount(wrap.querySelector('#de-contact'), {
        people: data.people,
        value: data.me?.emp_no || data.me?.id || data.me?.name,
        disabled: true,
        placeholder: '当前登录人',
      });
      picker.mount(wrap.querySelector('#de-owner'), {
        people: data.people,
        placeholder: '输入姓名或工号查找',
        onChange: () => persist(wrap),
      });
      picker.mount(wrap.querySelector('#de-tech'), {
        people: data.people,
        placeholder: '输入姓名或工号查找',
        onChange: () => persist(wrap),
      });
    }
    restore(wrap);
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
    wrap.querySelector('#de-p-add').addEventListener('click', () => {
      const box = wrap.querySelector('#de-partners');
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
          };
          init = { ...(init || {}), body: JSON.stringify(merged) };
          const res = await orig(input, init);
          if (res.ok) try { sessionStorage.removeItem('srpm.declare.extra'); } catch (_) {}
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
      return (t.closest && (t.closest('#srpm-declare-extra') || t.closest('#srpm-declare-confirm')))
        || t.id === 'srpm-declare-extra' || t.id === 'srpm-declare-confirm';
    });
    if (self) return;
    schedule();
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
