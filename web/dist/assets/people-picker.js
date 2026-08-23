(() => {
  'use strict';

  const MAX = 40;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  function ensureStyle() {
    if (document.getElementById('srpm-pp-style')) return;
    const st = document.createElement('style');
    st.id = 'srpm-pp-style';
    st.textContent = `
.srpm-pp{position:relative;width:100%;min-width:0}
.srpm-pp-input{width:100%;box-sizing:border-box;height:32px;border:1px solid #D9D9D9;border-radius:4px;padding:0 8px;color:#1F1F1F;background:#fff;font-size:13px}
.srpm-pp-input:focus{border-color:#0064EF;outline:none;box-shadow:0 0 0 2px rgba(0,100,239,.12)}
.srpm-pp-input:disabled{background:#F5F7FA;color:#8C8C8C}
.srpm-pp-list{position:fixed;z-index:100040;max-height:240px;overflow:auto;background:#fff;border:1px solid #E8E8E8;border-radius:4px;box-shadow:0 6px 16px rgba(0,0,0,.08)}
.srpm-pp-item{display:block;width:100%;text-align:left;padding:8px 12px;border:0;background:#fff;cursor:pointer;font:inherit}
.srpm-pp-item:hover,.srpm-pp-item.active{background:#E6F0FF}
.srpm-pp-item b{display:block;font-size:13px;color:#1F1F1F;font-weight:600}
.srpm-pp-item span{display:block;margin-top:2px;font-size:11px;color:#8C8C8C}
.srpm-pp-empty{padding:10px 12px;font-size:12px;color:#8C8C8C}
#srpm-pp-tip{position:fixed;z-index:100050;min-width:196px;max-width:280px;padding:8px 12px;background:#fff;border:1px solid #E8E8E8;border-radius:4px;box-shadow:0 6px 16px rgba(0,0,0,.12);pointer-events:none}
#srpm-pp-tip .k{display:inline-block;width:36px;color:#8C8C8C;font-size:12px}
#srpm-pp-tip .v{color:#1F1F1F;font-size:12px}
#srpm-pp-tip div+div{margin-top:4px}
`;
    document.head.appendChild(st);
  }

  function empOf(u) {
    return String(u?.empNo || u?.emp_no || u?.id || '');
  }

  function labelOf(u) {
    if (!u) return '';
    return u.label || (empOf(u) ? `${u.name}（${empOf(u)}）` : (u.name || ''));
  }

  function unitOf(u) {
    if (!u) return '—';
    if (u.unitShort && u.unitName && u.unitShort !== u.unitName) return `${u.unitShort}（${u.unitName}）`;
    return u.unitShort || u.unitName || '—';
  }

  function deptOf(u) {
    return (u && (u.dept || u.duty || '')) || '—';
  }

  function tipHtml(u) {
    if (!u) return '';
    return `
      <div><span class="k">姓名</span><span class="v">${esc(u.name || '—')}</span></div>
      <div><span class="k">工号</span><span class="v">${esc(empOf(u) || '—')}</span></div>
      <div><span class="k">单位</span><span class="v">${esc(unitOf(u))}</span></div>
      <div><span class="k">部门</span><span class="v">${esc(deptOf(u))}</span></div>`;
  }

  function showTip(u, anchor) {
    hideTip();
    if (!u || !anchor) return;
    const tip = document.createElement('div');
    tip.id = 'srpm-pp-tip';
    tip.innerHTML = tipHtml(u);
    document.body.appendChild(tip);
    const r = anchor.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let left = r.right + 8;
    if (left + tw > window.innerWidth - 8) left = Math.max(8, r.left - tw - 8);
    let top = r.top;
    if (top + th > window.innerHeight - 8) top = Math.max(8, window.innerHeight - th - 8);
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  function hideTip() {
    document.getElementById('srpm-pp-tip')?.remove();
  }

  function match(u, q) {
    if (!q) return true;
    const blob = [u.name, empOf(u), u.label, u.unitShort, u.unitName, u.dept, u.duty, u.title]
      .filter(Boolean).join(' ').toLowerCase();
    return blob.includes(q);
  }

  function findPerson(people, value) {
    const v = String(value || '').trim();
    if (!v) return null;
    return (people || []).find((u) => empOf(u) === v || u.name === v || labelOf(u) === v) || null;
  }

  const registry = new WeakMap();
  let sharedList = null;
  let openState = null;

  function listEl() {
    if (!sharedList) {
      sharedList = document.createElement('div');
      sharedList.className = 'srpm-pp-list';
      sharedList.hidden = true;
      document.body.appendChild(sharedList);
      sharedList.addEventListener('mouseover', (e) => {
        const item = e.target.closest('.srpm-pp-item');
        if (!item || !openState) return;
        showTip(findPerson(openState.people, item.dataset.emp), item);
      });
      sharedList.addEventListener('mouseleave', hideTip);
      sharedList.addEventListener('mousedown', (e) => e.preventDefault());
      sharedList.addEventListener('click', (e) => {
        const item = e.target.closest('.srpm-pp-item');
        if (!item || !openState) return;
        applyPerson(openState, findPerson(openState.people, item.dataset.emp));
        closeList(openState);
      });
    }
    return sharedList;
  }

  function renderList(state, q) {
    const query = String(q || '').trim().toLowerCase();
    const rows = (state.people || []).filter((u) => match(u, query)).slice(0, MAX);
    const list = listEl();
    if (!rows.length) {
      list.innerHTML = '<div class="srpm-pp-empty">未找到匹配人员，请改用姓名或工号</div>';
      return;
    }
    list.innerHTML = rows.map((u) => `
      <button type="button" class="srpm-pp-item" data-emp="${esc(empOf(u))}">
        <b>${esc(labelOf(u))}</b>
        <span>${esc([unitOf(u), deptOf(u)].filter((x) => x && x !== '—').join(' · '))}</span>
      </button>`).join('');
  }

  function placeList(state) {
    const list = listEl();
    const r = state.input.getBoundingClientRect();
    list.style.left = `${r.left}px`;
    list.style.top = `${r.bottom + 4}px`;
    list.style.width = `${Math.max(r.width, 220)}px`;
  }

  function applyPerson(state, u, silent) {
    state.selected = u || null;
    state.value.value = u ? empOf(u) : '';
    state.input.value = u ? labelOf(u) : '';
    if (!silent && typeof state.onChange === 'function') state.onChange(state.value.value, u);
  }

  function openList(state) {
    if (state.disabled) return;
    openState = state;
    renderList(state, state.input.value === labelOf(state.selected) ? '' : state.input.value);
    placeList(state);
    listEl().hidden = false;
  }

  function closeList(state) {
    if (openState === state) {
      listEl().hidden = true;
      openState = null;
    }
    hideTip();
    if (state.selected) state.input.value = labelOf(state.selected);
    else if (!state.input.value.trim()) state.value.value = '';
  }

  function bind(state) {
    const { root, input } = state;
    input.addEventListener('focus', () => openList(state));
    input.addEventListener('click', () => openList(state));
    input.addEventListener('input', () => {
      if (!input.value.trim()) applyPerson(state, null, true);
      openList(state);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeList(state); input.blur(); }
      if (e.key === 'Enter') {
        e.preventDefault();
        const first = listEl().querySelector('.srpm-pp-item');
        if (first) {
          applyPerson(state, findPerson(state.people, first.dataset.emp));
          closeList(state);
        }
      }
    });
    input.addEventListener('mouseenter', () => {
      if (state.selected) showTip(state.selected, input);
    });
    input.addEventListener('mouseleave', hideTip);
    document.addEventListener('click', (e) => {
      if (root.contains(e.target) || listEl().contains(e.target)) return;
      closeList(state);
    });
  }

  function mount(host, opts = {}) {
    if (!host) return null;
    ensureStyle();
    let state = registry.get(host);
    if (!state) {
      host.classList.add('srpm-pp');
      host.innerHTML = `
        <input class="srpm-pp-input" type="text" autocomplete="off" spellcheck="false" />
        <input class="srpm-pp-value" type="hidden" />`;
      state = {
        root: host,
        input: host.querySelector('.srpm-pp-input'),
        value: host.querySelector('.srpm-pp-value'),
        people: [],
        selected: null,
        disabled: false,
        onChange: null,
      };
      bind(state);
      registry.set(host, state);
    }
    state.people = opts.people || state.people || [];
    state.onChange = opts.onChange || state.onChange;
    state.disabled = !!opts.disabled;
    state.input.disabled = state.disabled;
    state.input.placeholder = opts.placeholder || '输入姓名或工号查找';
    if (opts.value != null) applyPerson(state, findPerson(state.people, opts.value), true);
    return state;
  }

  function getValue(host) {
    const state = host && registry.get(host);
    if (state) return state.value.value || '';
    return host?.querySelector?.('.srpm-pp-value')?.value || host?.value || '';
  }

  function setValue(host, value) {
    const state = host && registry.get(host);
    if (!state) return;
    applyPerson(state, findPerson(state.people, value), true);
  }

  window.SrpmPeoplePicker = { mount, getValue, setValue };
})();
