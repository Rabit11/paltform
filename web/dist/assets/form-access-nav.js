(() => {
  const FORM_LABEL = '表单维护';
  function token() {
    return localStorage.getItem('srpm.user') || sessionStorage.getItem('srpm.user') || '';
  }
  async function allowed() {
    try {
      const res = await fetch('/api/session', { headers: { 'x-session': token() } });
      if (!res.ok) return false;
      const d = await res.json();
      if (d.role === 'admin') return true;
      return !!d.canFormMaintain;
    } catch {
      return false;
    }
  }
  function hide() {
    document.querySelectorAll('a,button,span,div,li').forEach((el) => {
      if ((el.textContent || '').trim() !== FORM_LABEL) return;
      if (el.children.length > 2) return;
      const item = el.closest('a,li,[role="menuitem"]') || el;
      item.style.display = 'none';
    });
  }
  allowed().then((ok) => {
    if (ok) return;
    hide();
    new MutationObserver(hide).observe(document.documentElement, { childList: true, subtree: true });
  });
})();
