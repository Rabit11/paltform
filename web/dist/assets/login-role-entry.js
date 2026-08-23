(() => {
  const ROLE_ORDER = { team: 1, mgmt: 2, chief: 3, finance: 4, leader: 5, admin: 6 };
  const ROLE_LABEL = {
    team: "项目团队",
    mgmt: "管理团队",
    chief: "责任总师",
    finance: "财务",
    leader: "领导",
    admin: "系统管理员",
  };

  function groupKey(role) {
    if (role === "contact") return "team";
    return role || "other";
  }

  function sessionOn() {
    return !!(localStorage.getItem("srpm.user") || sessionStorage.getItem("srpm.user"));
  }

  function setNative(el, value) {
    if (!el) return;
    const proto = el.constructor.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function fillAndLogin(empNo) {
    const inputs = Array.from(document.querySelectorAll("input"));
    const user = inputs.find((el) => el.placeholder && el.placeholder.includes("工号")) || inputs[0];
    const pwd = inputs.find((el) => el.type === "password");
    setNative(user, empNo);
    setNative(pwd, empNo);
    const btn = document.getElementById("srpm-login-btn");
    if (btn) btn.click();
  }

  function mount(users) {
    if (sessionOn() || document.getElementById("srpm-role-entry")) return;
    const card = document.getElementById("srpm-login-btn")?.closest(".card");
    if (!card) return;
    const box = document.createElement("div");
    box.id = "srpm-role-entry";
    box.innerHTML = `
      <button type="button" class="srpm-role-toggle" id="srpm-role-toggle">展开角色演示入口</button>
      <div class="srpm-role-panel" id="srpm-role-panel" hidden></div>
    `;
    card.insertAdjacentElement("afterend", box);
    const panel = box.querySelector("#srpm-role-panel");
    const sorted = [...users].sort((a, b) => {
      const d = (ROLE_ORDER[groupKey(a.role)] || 9) - (ROLE_ORDER[groupKey(b.role)] || 9);
      if (d) return d;
      if (groupKey(a.role) === "team") {
        const ac = a.role === "contact" ? 0 : 1;
        const bc = b.role === "contact" ? 0 : 1;
        if (ac !== bc) return ac - bc;
      }
      return String(a.emp_no || "").localeCompare(String(b.emp_no || ""));
    });
    const groups = new Map();
    for (const u of sorted) {
      const key = groupKey(u.role);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(u);
    }
    for (const [role, rows] of groups) {
      const wrap = document.createElement("div");
      wrap.className = "srpm-role-group";
      wrap.innerHTML = `<div class="srpm-role-group-title">${ROLE_LABEL[role] || role}</div>`;
      const list = document.createElement("div");
      list.className = "srpm-role-list";
      rows.forEach((u) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "srpm-role-item";
        const duty = (u.title || "").split(" / ").pop() || (u.role === "contact" ? "项目联系人" : "");
        btn.innerHTML = `<b>${u.name}</b><span>${u.emp_no || ""} · ${duty}</span>`;
        btn.addEventListener("click", () => fillAndLogin(String(u.emp_no || u.id)));
        list.appendChild(btn);
      });
      wrap.appendChild(list);
      panel.appendChild(wrap);
    }
    const toggle = box.querySelector("#srpm-role-toggle");
    toggle.addEventListener("click", () => {
      const open = panel.hasAttribute("hidden");
      if (open) panel.removeAttribute("hidden");
      else panel.setAttribute("hidden", "");
      toggle.textContent = open ? "收起角色演示入口" : "展开角色演示入口";
    });
  }

  function boot() {
    if (sessionOn()) return;
    if (!document.getElementById("srpm-login-btn")) return;
    fetch("/api/bootstrap")
      .then((r) => r.json())
      .then((d) => {
        const users = Array.isArray(d.users) ? d.users.filter((u) => u && u.emp_no) : [];
        if (users.length) mount(users);
      })
      .catch(() => {});
  }

  const style = document.createElement("style");
  style.textContent = `
    #srpm-role-entry{margin-top:12px;max-width:100%}
    .srpm-role-toggle{height:32px;padding:0 12px;border:1px solid #D9D9D9;background:#fff;color:#0064EF;border-radius:4px;font-size:13px;cursor:pointer}
    .srpm-role-toggle:hover{border-color:#0064EF}
    .srpm-role-panel{margin-top:12px;padding:12px;background:#fff;border:1px solid #E8E8E8;border-radius:4px}
    .srpm-role-group + .srpm-role-group{margin-top:12px}
    .srpm-role-group-title{font-size:12px;color:#8C8C8C;margin-bottom:8px}
    .srpm-role-list{display:flex;flex-wrap:wrap;gap:8px}
    .srpm-role-item{min-width:148px;text-align:left;padding:8px 10px;border:1px solid #E8E8E8;background:#F5F7FA;border-radius:4px;cursor:pointer}
    .srpm-role-item:hover{border-color:#0064EF;background:#E6F0FF}
    .srpm-role-item b{display:block;font-size:13px;color:#1F1F1F;font-weight:600}
    .srpm-role-item span{display:block;margin-top:2px;font-size:11px;color:#8C8C8C}
  `;
  document.head.appendChild(style);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  new MutationObserver(() => {
    if (!sessionOn() && document.getElementById("srpm-login-btn") && !document.getElementById("srpm-role-entry")) boot();
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
