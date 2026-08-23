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

  function toast(msg, bad) {
    const n = document.createElement('div');
    n.className = 'pm-toast' + (bad ? ' bad' : '');
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3200);
  }

  function ensureStyle() {
    if ($('#pm-ui-style')) return;
    const st = document.createElement('style');
    st.id = 'pm-ui-style';
    st.textContent = `
#pm-inbox-bar{margin:0 0 16px;padding:12px 16px;background:#fff;border:1px solid #E8E8E8;border-radius:6px}
#pm-inbox-bar .pm-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}
#pm-inbox-bar h3{margin:0;font-size:14px;color:#1F1F1F;font-weight:600}
#pm-inbox-bar .pm-sub{font-size:12px;color:#8C8C8C;margin:0}
#pm-inbox-bar .pm-more{height:32px;padding:0 12px;border:none;background:transparent;color:#0064EF;cursor:pointer;font-size:13px;text-decoration:none;white-space:nowrap}
#pm-inbox-bar .pm-more:hover{text-decoration:underline}
.pm-inbox-list{display:flex;flex-direction:column;gap:8px}
.pm-inbox-item{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:40px;padding:8px 12px;border:1px solid #E8E8E8;border-radius:4px;background:#F5F7FA;text-decoration:none;color:#1F1F1F;min-width:0}
.pm-inbox-item:hover{border-color:#0064EF;background:#E6F0FF}
.pm-inbox-item > div{min-width:0;flex:1}
.pm-inbox-item b{display:block;font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pm-inbox-item .pm-meta{display:block;margin-top:2px;font-size:12px;color:#8C8C8C;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pm-tag{height:22px;padding:0 8px;border-radius:4px;font-size:12px;line-height:22px;background:#E6F0FF;color:#0048A0;white-space:nowrap;flex-shrink:0}
.pm-tag.fill{background:#FFF7E6;color:#D46B08}
.pm-empty{font-size:13px;color:#8C8C8C;padding:8px 0}
#pm-slot-panel{margin:0 0 16px;padding:8px 16px;min-height:48px;display:flex;align-items:center;justify-content:space-between;gap:12px;background:#fff;border:1px solid #E8E8E8;border-radius:4px}
#pm-slot-panel h3{margin:0;font-size:14px;color:#1F1F1F;font-weight:600}
#pm-slot-panel .pm-sub{margin:0;font-size:12px;color:#8C8C8C}
.pm-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px}
.pm-grid .pm-g{grid-column:1/-1;margin:4px 0 0;font-size:12px;color:#8C8C8C}
.pm-grid label{display:flex;flex-direction:column;gap:8px;font-size:12px;color:#8C8C8C;min-width:0}
.pm-grid .pm-slot-row{display:flex;gap:8px;align-items:center}
.pm-grid .pm-slot-row .srpm-pp{flex:1;min-width:0}
.pm-grid select{flex:1;min-width:0;height:32px;border:1px solid #D9D9D9;border-radius:4px;padding:0 8px;color:#1F1F1F;background:#fff}
.pm-btn{height:32px;padding:0 12px;border-radius:4px;border:1px solid #D9D9D9;background:#fff;color:#0064EF;cursor:pointer;font-size:13px;white-space:nowrap}
.pm-btn:hover{border-color:#0064EF}
.pm-btn.primary{background:#0064EF;border-color:#0064EF;color:#fff}
.pm-btn[disabled]{opacity:.45;cursor:not-allowed}
.pm-actions{margin-top:16px;display:flex;gap:8px;justify-content:flex-end}
.pm-vacant{color:#D46B08}
.pm-toast{position:fixed;right:20px;top:20px;z-index:99999;background:#389E0D;color:#fff;padding:8px 14px;border-radius:4px;font-size:13px}
.pm-toast.bad{background:#CF1322}
.pm-appr-mask{position:fixed;inset:0;z-index:99995;background:rgba(15,23,42,.45);display:flex;justify-content:flex-end}
.pm-appr-drawer{width:min(560px,100%);height:100%;background:#fff;display:flex;flex-direction:column;box-shadow:-4px 0 24px rgba(0,0,0,.12)}
.pm-appr-drawer header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid #E8E8E8}
.pm-appr-drawer header h2{margin:0;font-size:15px;font-weight:600;color:#1F1F1F;line-height:1.4}
.pm-appr-drawer .pm-appr-meta{margin-top:6px;font-size:12px;color:#8C8C8C;line-height:1.5}
.pm-appr-close{width:32px;height:32px;border:0;background:transparent;color:#8C8C8C;cursor:pointer;font-size:20px;line-height:32px;border-radius:4px}
.pm-appr-close:hover{background:#F5F7FA;color:#1F1F1F}
.pm-appr-body{flex:1;overflow:auto;padding:16px 20px}
.pm-appr-kv{display:grid;grid-template-columns:88px 1fr;gap:8px 12px;font-size:13px;margin-bottom:16px}
.pm-appr-kv span{color:#8C8C8C}
.pm-appr-kv b{font-weight:400;color:#1F1F1F;word-break:break-word}
.pm-appr-kv .wide{grid-column:1/-1}
.pm-link{color:#0064EF;text-decoration:none}
.pm-link:hover{text-decoration:underline}
.pm-appr-kv b .pm-link{margin-left:8px;font-size:12px;white-space:nowrap}
.pm-appr-sec{margin:0 0 16px}
.pm-appr-sec h4{margin:0 0 8px;font-size:12px;color:#8C8C8C;font-weight:400;display:flex;align-items:center;justify-content:space-between;gap:8px}
.pm-chips{display:flex;flex-wrap:wrap;gap:8px}
.pm-chip{height:22px;padding:0 8px;border-radius:4px;font-size:12px;line-height:22px;background:#E6F0FF;color:#0048A0}
.pm-step{position:relative;padding:0 0 12px 20px}
.pm-step:last-child{padding-bottom:0}
.pm-step::before{content:"";position:absolute;left:5px;top:8px;bottom:-4px;width:1px;background:#E8E8E8}
.pm-step:last-child::before{display:none}
.pm-step i{position:absolute;left:0;top:4px;width:11px;height:11px;border-radius:50%;border:2px solid #D9D9D9;background:#fff;box-sizing:border-box}
.pm-step.approved i{border-color:#389E0D;background:#389E0D}
.pm-step.current i{border-color:#0064EF;background:#0064EF}
.pm-step.rejected i{border-color:#CF1322;background:#CF1322}
.pm-step b{display:block;font-size:13px;font-weight:500;color:#1F1F1F}
.pm-step.current b{color:#0064EF}
.pm-step.pending b{color:#8C8C8C;font-weight:400}
.pm-step em{display:block;margin-top:2px;font-style:normal;font-size:12px;color:#8C8C8C}
.pm-appr-note{margin:0 0 12px;padding:8px 12px;background:#F0F5FF;border:1px solid #91CAFF;border-radius:4px;font-size:12px;color:#0048A0;line-height:1.5}
.pm-tag.track{background:#F5F7FA;color:#595959}
.pm-appr-foot{padding:12px 20px 16px;border-top:1px solid #E8E8E8;background:#fff}
#pm-slot-panel .pm-actions{margin-top:0;flex-shrink:0}
.pm-appr-foot textarea{width:100%;box-sizing:border-box;min-height:64px;margin-bottom:12px;padding:8px;border:1px solid #D9D9D9;border-radius:4px;font-size:13px;color:#1F1F1F;resize:vertical}
.pm-appr-foot .pm-actions{margin-top:0}
.pm-btn.danger{border-color:#CF1322;color:#CF1322}
.pm-btn.danger:hover{background:#FFF1F0}
.pm-slot-mask{position:fixed;inset:0;z-index:99994;background:rgba(15,23,42,.45);display:flex;justify-content:flex-end}
.pm-slot-drawer{width:min(640px,100%);height:100%;background:#fff;display:flex;flex-direction:column;box-shadow:-4px 0 24px rgba(0,0,0,.12)}
.pm-slot-drawer header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid #E8E8E8}
.pm-slot-drawer header h2{margin:0;font-size:15px;font-weight:600;color:#1F1F1F}
.pm-slot-drawer header .pm-sub{margin-top:6px}
.pm-slot-drawer .pm-slot-body{flex:1;overflow:auto;padding:16px 20px}
.pm-slot-drawer .pm-appr-foot{padding:12px 20px 16px}
@media(max-width:900px){.pm-grid{grid-template-columns:1fr}}
`;
    document.head.appendChild(st);
  }

  const TYPE_LABEL = {
    declaration: '申报审签',
    filing: '立项备案',
    change: '项目变更',
    data_change: '数据变更',
    milestone_close: '里程碑关闭',
    plan_finish: '计划结题',
    acceptance: '项目验收',
    funding: '经费拨付',
    package: '成果转化包',
    evaluation: '协作评价确认',
    baseinfo: '基本信息完善',
    assessment: '评估检查',
  };

  function fmtDate(v) {
    return v ? String(v).slice(0, 10) : '';
  }

  function closeApprovalDrawer() {
    $('#pm-appr-mask')?.remove();
  }

  function stepClass(st) {
    if (st === 'approved' || st === 'rejected' || st === 'current' || st === 'pending') return st;
    return 'pending';
  }

  function dash(v) {
    if (v == null || v === '') return '—';
    return String(v);
  }

  function channelPath(p) {
    if (!p) return '';
    return [p.sourceChannel, p.orgOffice, p.projectType || p.channelName].filter(Boolean).join(' → ');
  }

  function fillApprovalDrawer(mask, a, proj) {
    const typeName = TYPE_LABEL[a.type] || a.type || '审批';
    const mats = Array.isArray(a.payload?.materials) ? a.payload.materials : [];
    const atts = Array.isArray(a.payload?.attachments) ? a.payload.attachments : [];
    const steps = Array.isArray(a.steps) ? a.steps : [];
    const done = steps.filter((s) => s.status === 'approved').length;
    const body = mask.querySelector('.pm-appr-body');
    const head = mask.querySelector('header h2');
    const meta = mask.querySelector('.pm-appr-meta');
    if (head) head.textContent = a.title || typeName;
    if (meta) meta.textContent = [typeName, a.initiator ? `发起人 ${a.initiator}` : '', fmtDate(a.created_at)].filter(Boolean).join(' · ');
    const chips = [
      ...mats.map((x) => `<span class="pm-chip">${esc(x)}.pdf</span>`),
      ...atts.map((x) => `<span class="pm-chip">${esc(x.name || x)}</span>`),
    ].join('');
    const pid = a.project_id || proj?.id;
    const pName = proj?.name || a.projectName || '—';
    const pCode = proj?.code || a.projectCode || '';
    const team = proj?.team || {};
    const v19 = proj?.v19 || {};
    const period = proj && (proj.start || proj.end) ? `${fmtDate(proj.start)} ~ ${fmtDate(proj.end)}` : '';
    const budget = proj && (proj.total_budget != null && proj.total_budget !== '') ? `${proj.total_budget} 万元` : '';
    const partners = Array.isArray(proj?.partners) ? proj.partners : [];
    const partnerText = partners.length
      ? partners.map((x) => x.work ? `${x.name}：${x.work}` : x.name).join('；')
      : '';
    const archive = pid
      ? `<a class="pm-link" href="/projects/${esc(pid)}" target="_blank" rel="noopener">查看档案</a>`
      : '';
    body.innerHTML = `
      <div class="pm-appr-kv">
        <span>当前节点</span><b>${esc(steps[a.current_step]?.title || a.status || '—')}</b>
      </div>
      <div class="pm-appr-sec">
        <h4>项目信息${archive}</h4>
        <div class="pm-appr-kv">
          <span>项目名称</span><b>${esc(pName)}${pCode ? ` · ${esc(pCode)}` : ''}</b>
          <span>状态 / 级别</span><b>${esc(dash([proj?.status, proj?.level].filter(Boolean).join(' · ')))}</b>
          <span>立项渠道</span><b>${esc(dash(channelPath(proj)))}</b>
          <span>项目周期</span><b>${esc(dash(period))}</b>
          <span>申请经费</span><b>${esc(dash(budget))}</b>
          <span>项目目标</span><b class="wide">${esc(dash(proj?.goal))}</b>
          <span>年度目标</span><b class="wide">${esc(dash(proj?.year_goal))}</b>
          <span>一级 / 二级专业</span><b>${esc(dash([v19.major1, v19.major2].filter(Boolean).join(' / ')))}</b>
          <span>责任单位</span><b>${esc(dash(v19.responsibleUnit || proj?.unitName))}</b>
          <span>项目负责人</span><b>${esc(dash(team.owner))}</b>
          <span>技术负责人</span><b>${esc(dash(team.tech))}</b>
          ${partnerText ? `<span>参研单位</span><b class="wide">${esc(partnerText)}</b>` : ''}
        </div>
      </div>
      <div class="pm-appr-sec">
        <h4>随附材料</h4>
        ${chips ? `<div class="pm-chips">${chips}</div>` : '<div class="pm-empty">无随附材料</div>'}
      </div>
      <div class="pm-appr-sec">
        <h4>审签流转（${done}/${steps.length}）</h4>
        ${steps.map((s) => `
          <div class="pm-step ${stepClass(s.status)}">
            <i></i>
            <b>${esc(s.title || '')}${s.status === 'current' ? ' · 当前' : ''}</b>
            <em>${esc([s.actor || s.assignee, s.at ? fmtDate(s.at) : ''].filter(Boolean).join(' · '))}${s.comment ? `「${esc(s.comment)}」` : ''}</em>
          </div>`).join('')}
      </div>`;
    const foot = mask.querySelector('.pm-appr-foot');
    const acting = typeof a.canAct === 'boolean' ? a.canAct : a.status === '审批中';
    foot.hidden = !acting;
    if (!acting) {
      const note = mask.querySelector('.pm-appr-note');
      if (!note) {
        const n = document.createElement('div');
        n.className = 'pm-appr-note';
        n.textContent = a.status === '审批中' ? '您已签署，审签流转仍可继续查看。' : `流程状态：${a.status || '已办结'}，流转记录保留可查。`;
        body.prepend(n);
      }
      return;
    }
    const ta = foot.querySelector('textarea');
    foot.querySelectorAll('[data-act]').forEach((btn) => {
      btn.onclick = async () => {
        const action = btn.dataset.act;
        btn.disabled = true;
        try {
          const updated = await api(`/approvals/${a.id}/act`, { method: 'POST', body: { action, comment: ta.value.trim() } });
          toast(action === 'approve' ? '已签署同意，流转图已更新' : '已驳回，退回填报节点');
          let nextProj = proj;
          if (updated?.project_id) {
            try { nextProj = await api(`/projects/${updated.project_id}`); } catch (_) {}
          }
          fillApprovalDrawer(mask, updated, nextProj);
          await renderInbox();
        } catch (err) {
          toast(err.message, true);
          btn.disabled = false;
        }
      };
    });
  }

  async function openApprovalDrawer(id) {
    if (!id) return;
    closeApprovalDrawer();
    ensureStyle();
    const mask = document.createElement('div');
    mask.id = 'pm-appr-mask';
    mask.className = 'pm-appr-mask';
    mask.innerHTML = `
      <aside class="pm-appr-drawer" role="dialog" aria-modal="true">
        <header>
          <div>
            <h2>加载中…</h2>
            <div class="pm-appr-meta"></div>
          </div>
          <button type="button" class="pm-appr-close" aria-label="关闭">×</button>
        </header>
        <div class="pm-appr-body"><div class="pm-empty">正在打开流程…</div></div>
        <div class="pm-appr-foot" hidden>
          <textarea placeholder="审批意见（选填）…"></textarea>
          <div class="pm-actions">
            <button type="button" class="pm-btn danger" data-act="reject">驳回退改</button>
            <button type="button" class="pm-btn primary" data-act="approve">签署同意</button>
          </div>
        </div>
      </aside>`;
    document.body.appendChild(mask);
    mask.addEventListener('click', (e) => { if (e.target === mask) closeApprovalDrawer(); });
    mask.querySelector('.pm-appr-close').onclick = closeApprovalDrawer;
    try {
      let a = null;
      try { a = await api(`/approvals/${id}`); } catch (_) { a = null; }
      if (!a) {
        let rows = await api('/approvals?mine=1');
        a = (Array.isArray(rows) ? rows : []).find((x) => String(x.id) === String(id));
      }
      if (!a) {
        const rows = await api('/approvals');
        a = (Array.isArray(rows) ? rows : []).find((x) => String(x.id) === String(id));
      }
      if (!a) throw new Error('未找到该流程');
      let proj = null;
      if (a.project_id) {
        try { proj = await api(`/projects/${a.project_id}`); } catch (_) { proj = null; }
      }
      fillApprovalDrawer(mask, a, proj);
    } catch (err) {
      toast(err.message, true);
      closeApprovalDrawer();
    }
  }

  function shouldShowInbox(path) {
    const p = path || '';
    if (!p || p.startsWith('/login')) return false;
    if (p.startsWith('/approvals')) return false;
    if (p.startsWith('/cockpit')) return false;
    if (p.startsWith('/projects')) return false;
    if (p.startsWith('/declare')) return false;
    if (p.startsWith('/transition-tool')) return false;
    if (p.startsWith('/admin')) return false;
    if (p.startsWith('/pre-research')) return false;
    return true;
  }

  function contentHost() {
    const rootFlex = document.querySelector('#root > div.h-full.flex');
    const grow = rootFlex && [...rootFlex.children].find((el) => el.tagName !== 'ASIDE' && !el.matches('aside'));
    if (grow) {
      const pane = [...grow.children].find((el) => {
        if (el.id === 'pm-inbox-bar' || el.id === 'pm-slot-panel' || el.id === 'lc-stage-bar') return false;
        if (el.tagName === 'HEADER') return false;
        const cls = String(el.className || '');
        if (cls.includes('h-[60px]') || cls.includes('h-[64px]')) return false;
        return true;
      });
      return pane || grow;
    }
    return $('main');
  }

  function placeTop(html, id) {
    const old = document.getElementById(id);
    if (old) old.remove();
    const host = contentHost();
    if (!host) return null;
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    const el = wrap.firstElementChild;
    el.id = id;
    host.prepend(el);
    return el;
  }

  async function renderInbox() {
    if (!token() || !shouldShowInbox(location.pathname)) {
      $('#pm-inbox-bar')?.remove();
      return;
    }
    let data;
    try { data = await api('/inbox'); } catch { return; }
    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) {
      $('#pm-inbox-bar')?.remove();
      return;
    }
    const pending = items.filter((it) => it.kind !== 'track');
    const tracks = items.filter((it) => it.kind === 'track');
    const shownPending = pending.slice(0, 4);
    const shownTracks = tracks.slice(0, 3);
    const shown = [...shownPending, ...shownTracks];
    const extra = pending.length - shownPending.length;
    const tagOf = (it) => (it.kind === 'fill' ? ['fill', '去填报'] : it.kind === 'track' ? ['track', '查看流转'] : ['', '去审批']);
    const rows = shown.map((it) => {
      const [cls, text] = tagOf(it);
      return `
        <a class="pm-inbox-item" href="${esc(it.kind === 'fill' ? (it.href || '#') : '#')}" data-kind="${esc(it.kind || '')}" data-appr="${esc(it.approvalId || '')}">
          <div>
            <b title="${esc(it.title || '')}">${esc(it.title || '')}</b>
            <span class="pm-meta">${esc([it.projectCode, it.projectName, it.stepTitle].filter(Boolean).join(' · '))}</span>
          </div>
          <span class="pm-tag ${cls}">${text}</span>
        </a>`;
    }).join('');
    const title = pending.length ? `待办 ${pending.length} 件` : '已办流转';
    const sub = pending.length
      ? (tracks.length ? '签署后右侧流程图仍可点开查看' : '点条目即可在本页签署，不必再进审批中心一层层打开')
      : '您已办结的审签流转仍可查看';
    const bar = placeTop(`
      <section>
        <div class="pm-head">
          <div>
            <h3>${title}</h3>
            <div class="pm-sub">${sub}</div>
          </div>
          <a class="pm-more" href="/approvals">进入审批中心</a>
        </div>
        <div class="pm-inbox-list">${rows}${extra > 0 ? `<div class="pm-empty">另有 ${extra} 件待办，请在审批中心查看</div>` : ''}</div>
      </section>`, 'pm-inbox-bar');
    bar?.querySelector('.pm-inbox-list')?.addEventListener('click', (e) => {
      const item = e.target.closest('.pm-inbox-item');
      if (!item || item.dataset.kind === 'fill') return;
      e.preventDefault();
      openApprovalDrawer(item.dataset.appr);
    });
  }

  function peopleOptions(people, selectedEmp, selectedName) {
    const opts = ['<option value="">待指定</option>'];
    for (const u of people || []) {
      const emp = String(u.empNo || u.emp_no || u.id || '');
      const selected = emp && (emp === String(selectedEmp || '') || u.name === selectedName) ? ' selected' : '';
      opts.push(`<option value="${esc(emp)}"${selected}>${esc(u.label || `${u.name}（${emp}）`)}</option>`);
    }
    return opts.join('');
  }

  function closeSlotDrawer() {
    $('#pm-slot-mask')?.remove();
  }

  function bindSlotForm(root, pid, editable, data) {
    const collectSlots = () => {
      const slots = {};
      root.querySelectorAll('label[data-slot]').forEach((lab) => {
        slots[lab.dataset.slot] = (window.SrpmPeoplePicker && window.SrpmPeoplePicker.getValue(lab.querySelector('[data-pp]'))) || '';
      });
      return slots;
    };
    if (window.SrpmPeoplePicker) {
      const members = data?.members || [];
      root.querySelectorAll('[data-pp]').forEach((el) => {
        const m = members.find((x) => x.key === el.dataset.pp) || {};
        window.SrpmPeoplePicker.mount(el, {
          people: data?.people || [],
          value: m.empNo || m.name || '',
          disabled: !editable,
          placeholder: '输入姓名或工号查找',
        });
      });
    }
    const saveBtn = $('#pm-save-slots', root);
    if (saveBtn) {
      saveBtn.onclick = async () => {
        try {
          await api(`/projects/${pid}/members`, { method: 'PUT', body: { slots: collectSlots() } });
          toast('项目岗位已保存');
          closeSlotDrawer();
          await renderMembers(pid);
        } catch (e) { toast(e.message, true); }
      };
    }
    root.onclick = async (e) => {
      const btn = e.target.closest('[data-transfer]');
      if (!btn) return;
      const slot = btn.dataset.transfer;
      const empNo = (window.SrpmPeoplePicker && window.SrpmPeoplePicker.getValue(root.querySelector(`label[data-slot="${slot}"] [data-pp]`))) || '';
      if (!empNo) { toast('请先选择转办对象', true); return; }
      try {
        await api(`/projects/${pid}/members/transfer`, { method: 'POST', body: { slot, empNo } });
        toast('已转办并改派在途审批');
        await renderMembers(pid);
      } catch (err) { toast(err.message, true); }
    };
  }

  function slotFormHtml(data, editable) {
    const duties = data.duties || [];
    const members = data.members || [];
    const byKey = Object.fromEntries(members.map((m) => [m.key, m]));
    const groups = [];
    const seen = new Set();
    for (const d of duties) {
      if (seen.has(d.group)) continue;
      seen.add(d.group);
      groups.push(d.group);
    }
    return (groups.length ? groups : ['项目团队']).map((g) => {
      const slots = duties.filter((d) => d.group === g);
      const cells = slots.map((d) => {
        const m = byKey[d.key] || {};
        const vacant = !m.name;
        return `
          <label data-slot="${esc(d.key)}">
            ${esc(d.label)}${vacant ? ' <span class="pm-vacant">待指定</span>' : ''}
            <div class="pm-slot-row">
              <div class="srpm-pp" data-pp="${esc(d.key)}"></div>
              ${editable ? `<button type="button" class="pm-btn" data-transfer="${esc(d.key)}">转办</button>` : ''}
            </div>
          </label>`;
      }).join('');
      return `<div class="pm-g">${esc(g)}</div>${cells}`;
    }).join('');
  }

  function openSlotDrawer(pid, data, editable) {
    closeSlotDrawer();
    const filled = (data.duties || []).filter((d) => (data.members || []).some((m) => m.key === d.key && m.name)).length;
    const total = (data.duties || []).length;
    const mask = document.createElement('div');
    mask.id = 'pm-slot-mask';
    mask.className = 'pm-slot-mask';
    mask.innerHTML = `
      <aside class="pm-slot-drawer" role="dialog" aria-modal="true">
        <header>
          <div>
            <h2>项目岗位指定</h2>
            <div class="pm-sub">已指定 ${filled}/${total} · 同一人可在不同项目任职，审批只认本项目岗位</div>
          </div>
          <button type="button" class="pm-appr-close" aria-label="关闭">×</button>
        </header>
        <div class="pm-slot-body">
          <form class="pm-grid" id="pm-slot-form">${slotFormHtml(data, editable)}</form>
        </div>
        <div class="pm-appr-foot">
          ${editable
            ? '<div class="pm-actions"><button type="button" class="pm-btn primary" id="pm-save-slots">保存岗位</button></div>'
            : '<div class="pm-empty">您可查看本项目岗位，指定/转办需具备相应权限</div>'}
        </div>
      </aside>`;
    document.body.appendChild(mask);
    mask.addEventListener('click', (e) => { if (e.target === mask) closeSlotDrawer(); });
    mask.querySelector('.pm-appr-close').onclick = closeSlotDrawer;
    bindSlotForm(mask, pid, editable, data);
  }

  async function renderMembers(pid) {
    let data;
    try { data = await api(`/projects/${pid}/members`); } catch { return; }
    const duties = data.duties || [];
    const members = data.members || [];
    const filled = duties.filter((d) => members.some((m) => m.key === d.key && m.name)).length;
    const editable = !!data.editable;
    const bar = placeTop(`
      <section>
        <div>
          <h3>项目岗位</h3>
          <div class="pm-sub">已指定 ${filled}/${duties.length || 0} · 点右侧在抽屉中调整，审签流转可随时查看</div>
        </div>
        <div class="pm-actions">
          <button type="button" class="pm-btn" id="pm-flow-open">查看审签流转</button>
          <button type="button" class="pm-btn ${editable ? 'primary' : ''}" id="pm-slot-open">${editable ? '调整岗位' : '查看岗位'}</button>
        </div>
      </section>`, 'pm-slot-panel');
    const flowBtn = bar && $('#pm-flow-open', bar);
    if (flowBtn) {
      flowBtn.onclick = async () => {
        try {
          const rows = await api(`/approvals?projectId=${encodeURIComponent(pid)}`);
          const list = Array.isArray(rows) ? rows : [];
          const a = list.find((x) => x.status === '审批中') || list[0];
          if (!a) { toast('暂无审签流转', true); return; }
          openApprovalDrawer(a.id);
        } catch (e) { toast(e.message, true); }
      };
    }
    const openBtn = bar && $('#pm-slot-open', bar);
    if (openBtn) openBtn.onclick = () => openSlotDrawer(pid, data, editable);
    const openMask = $('#pm-slot-mask');
    if (openMask) {
      const body = openMask.querySelector('#pm-slot-form');
      if (body) {
        body.innerHTML = slotFormHtml(data, editable);
        bindSlotForm(openMask, pid, editable, data);
      }
    }
  }

  let lastPath = '';
  let timer = 0;
  async function run(force) {
    if (!token()) {
      closeApprovalDrawer();
      closeSlotDrawer();
      $('#pm-inbox-bar')?.remove();
      $('#pm-slot-panel')?.remove();
      return;
    }
    ensureStyle();
    const path = location.pathname;
    if (path !== lastPath) {
      closeApprovalDrawer();
      closeSlotDrawer();
    }
    const inboxOk = shouldShowInbox(path) && $('#pm-inbox-bar');
    if (!force && path === lastPath && inboxOk) return;
    lastPath = path;
    try { await renderInbox(); } catch (e) { console.warn('inbox', e); }
    const m = path.match(/^\/projects\/(\d+)/);
    if (m) {
      $('#pm-slot-panel')?.remove();
    } else {
      closeSlotDrawer();
      $('#pm-slot-panel')?.remove();
    }
  }

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => run(), 120);
  };
  new MutationObserver(() => {
    if (location.pathname !== lastPath) schedule();
    else if (shouldShowInbox(location.pathname) && token() && !$('#pm-inbox-bar')) schedule();
  }).observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => run());
  else run();
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeApprovalDrawer();
      closeSlotDrawer();
    }
  });
  setInterval(() => run(true), 60000);
})();
