(() => {
  'use strict';

  const LEVELS = ['国家级', '地方级', '公司级'];
  let regrouping = false;

  function cardLevel(card) {
    const meta = (card.querySelector('.srpm-flow-meta')?.innerText || '').trim();
    const hit = LEVELS.find((lv) => meta.startsWith(lv + ' ·') || meta.startsWith(lv));
    return hit || '其他';
  }

  function cardsOf(board) {
    return [...board.children].filter((el) => !el.classList.contains('srpm-flow-section'));
  }

  function needsRegroup(board) {
    const kids = [...board.children];
    if (!kids.length) return false;
    if (!kids[0].classList.contains('srpm-flow-section')) return true;
    return !LEVELS.every((lv) => {
      const has = kids.some((el) => el.classList.contains('srpm-flow-section') && el.dataset.level === lv);
      const n = cardsOf(board).filter((c) => cardLevel(c) === lv).length;
      return n === 0 || has;
    });
  }

  function regroup(board) {
    const buckets = { 国家级: [], 地方级: [], 公司级: [], 其他: [] };
    for (const card of cardsOf(board)) buckets[cardLevel(card)].push(card);
    board.querySelectorAll('.srpm-flow-section').forEach((el) => el.remove());
    const frag = document.createDocumentFragment();
    for (const lv of [...LEVELS, '其他']) {
      const list = buckets[lv];
      if (!list.length) continue;
      const h = document.createElement('div');
      h.className = 'srpm-flow-section';
      h.dataset.level = lv;
      h.innerHTML = `<b>${lv}</b><span>${list.length} 个项目类型</span>`;
      frag.appendChild(h);
      list.forEach((c) => frag.appendChild(c));
    }
    board.appendChild(frag);
  }

  function ensureToolbar(board) {
    if (!board || board.previousElementSibling?.id === 'srpm-flow-toolbar') return board.previousElementSibling;
    const bar = document.createElement('div');
    bar.id = 'srpm-flow-toolbar';
    bar.className = 'srpm-flow-toolbar';
    bar.innerHTML = `
      <div class="srpm-flow-lead">
        <b>流程模板</b>
        <span>按国家级、地方级、公司级分组。组内按项目类型列出全周期节点；序号即流转顺序。检索只过滤列表，不改模板数据。</span>
      </div>
      <div class="srpm-flow-tools">
        <input id="srpm-flow-q" placeholder="搜索项目类型 / 渠道 / 处室" />
        <select id="srpm-flow-level">
          <option value="">全部层级</option>
          <option value="国家级">国家级</option>
          <option value="地方级">地方级</option>
          <option value="公司级">公司级</option>
        </select>
        <span class="srpm-flow-count" id="srpm-flow-count"></span>
      </div>`;
    board.parentElement.insertBefore(bar, board);
    bar.querySelector('#srpm-flow-q').addEventListener('input', applyFilter);
    bar.querySelector('#srpm-flow-level').addEventListener('change', applyFilter);
    return bar;
  }

  function applyFilter() {
    const board = document.querySelector('.srpm-flow-tpl');
    if (!board) return;
    const q = (document.querySelector('#srpm-flow-q')?.value || '').trim().toLowerCase();
    const level = document.querySelector('#srpm-flow-level')?.value || '';
    const cards = cardsOf(board);
    let shown = 0;
    for (const card of cards) {
      const text = (card.innerText || '').replace(/\s+/g, ' ');
      const lv = cardLevel(card);
      const hitQ = !q || text.toLowerCase().includes(q);
      const hitL = !level || lv === level;
      const on = hitQ && hitL;
      card.classList.toggle('srpm-flow-hide', !on);
      if (on) shown += 1;
    }
    board.querySelectorAll('.srpm-flow-section').forEach((sec) => {
      let any = false;
      let n = sec.nextElementSibling;
      while (n && !n.classList.contains('srpm-flow-section')) {
        if (!n.classList.contains('srpm-flow-hide')) any = true;
        n = n.nextElementSibling;
      }
      sec.classList.toggle('srpm-flow-hide', !any);
    });
    const el = document.querySelector('#srpm-flow-count');
    if (el) el.textContent = `显示 ${shown} / ${cards.length} 个项目类型`;
  }

  function mount() {
    if (!document.querySelector('.srpm-flow-tpl')) return;
    if (regrouping) return;
    const board = document.querySelector('.srpm-flow-tpl');
    document.querySelectorAll('#srpm-flow-toolbar').forEach((el) => {
      if (!board || el.nextElementSibling !== board) el.remove();
    });
    if (!board) return;
    ensureToolbar(board);
    if (needsRegroup(board)) {
      regrouping = true;
      regroup(board);
      regrouping = false;
    }
    applyFilter();
  }

  let t = 0;
  const schedule = () => {
    clearTimeout(t);
    t = setTimeout(mount, 120);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
