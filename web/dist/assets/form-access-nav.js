(() => {
  const FORM_LABEL = '表单维护';
  const HIDDEN = 'data-srpm-form-nav-hidden';
  const TO = '/transition-tool';

  function token() {
    const raw = localStorage.getItem('srpm.user') || sessionStorage.getItem('srpm.user') || '';
    if (!raw) return '';
    try {
      const o = JSON.parse(raw);
      if (o && typeof o === 'object') return o.sessionToken || o.token || '';
    } catch { /* raw token */ }
    return raw;
  }

  async function allowed() {
    const tok = token();
    if (!tok) return null;
    try {
      const res = await fetch('/api/session', { headers: { 'x-session': tok, Authorization: `Bearer ${tok}` } });
      if (res.status === 401 || res.status === 403) return false;
      if (!res.ok) return null;
      const d = await res.json();
      if (d.role === 'admin') return true;
      return !!d.canFormMaintain;
    } catch {
      return null;
    }
  }

  function navCandidates() {
    return [...document.querySelectorAll('a,button,span,div,li,[role="menuitem"]')];
  }

  function isFormNav(el) {
    const href = (el.getAttribute && (el.getAttribute('href') || '')) || '';
    if (href.includes(TO)) return true;
    if ((el.textContent || '').trim() !== FORM_LABEL) return false;
    if (el.children.length > 2) return false;
    return true;
  }

  function hide() {
    navCandidates().forEach((el) => {
      if (!isFormNav(el)) return;
      const item = el.closest('a,li,[role="menuitem"]') || el;
      if (item.getAttribute(HIDDEN) === '1') return;
      item.setAttribute(HIDDEN, '1');
      item.style.display = 'none';
    });
  }

  function unhide() {
    document.querySelectorAll(`[${HIDDEN}="1"]`).forEach((el) => {
      el.removeAttribute(HIDDEN);
      if (el.style.display === 'none') el.style.display = '';
    });
  }

  let observer = null;
  let lastAllowed = null;

  function ensureObserver() {
    if (observer) return;
    observer = new MutationObserver(() => {
      if (lastAllowed === false) hide();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function stopObserver() {
    if (!observer) return;
    observer.disconnect();
    observer = null;
  }

  let inflight = 0;
  async function sync() {
    const seq = ++inflight;
    const ok = await allowed();
    if (seq !== inflight) return;
    lastAllowed = ok;
    if (ok === true) {
      stopObserver();
      unhide();
      return;
    }
    if (ok === false) {
      hide();
      ensureObserver();
    }
  }

  function hookStorage(storage) {
    const rawSet = storage.setItem.bind(storage);
    const rawRemove = storage.removeItem.bind(storage);
    storage.setItem = function (k, v) {
      rawSet(k, v);
      if (k === 'srpm.user') sync();
    };
    storage.removeItem = function (k) {
      rawRemove(k);
      if (k === 'srpm.user') sync();
    };
  }
  try { hookStorage(localStorage); hookStorage(sessionStorage); } catch { /* ignore */ }

  window.addEventListener('storage', (e) => {
    if (!e.key || e.key === 'srpm.user') sync();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) sync();
  });

  sync();
})();
