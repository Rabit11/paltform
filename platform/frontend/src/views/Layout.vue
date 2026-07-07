<script setup>
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();
const user = computed(() => JSON.parse(localStorage.getItem('keyan_user') || '{}'));

const roleMenus = {
  hq: [
    { path: '/dashboard', label: '总部治理台', icon: '🏛' },
    { path: '/ledger', label: '项目台账', icon: '📋' },
    { path: '/risks', label: '风险看板', icon: '⚠' },
    { path: '/outcomes', label: '成果转化', icon: '🎯' },
    { path: '/partners', label: '协作评价', icon: '🤝' },
    { path: '/todos', label: '待办审批', icon: '✓' },
    { path: '/ai', label: '智能助手', icon: '✦' },
  ],
  leader: [
    { path: '/dashboard', label: '领导驾驶舱', icon: '📊' },
    { path: '/ledger', label: '项目台账', icon: '📋' },
    { path: '/risks', label: '风险看板', icon: '⚠' },
    { path: '/outcomes', label: '成果转化', icon: '🎯' },
    { path: '/ai', label: '智能助手', icon: '✦' },
  ],
  dept: [
    { path: '/dashboard', label: '单位治理台', icon: '🏢' },
    { path: '/ledger', label: '项目台账', icon: '📋' },
    { path: '/risks', label: '风险看板', icon: '⚠' },
    { path: '/partners', label: '协作评价', icon: '🤝' },
    { path: '/todos', label: '待办审批', icon: '✓' },
    { path: '/apply', label: '立项申报', icon: '📝' },
  ],
  pm: [
    { path: '/dashboard', label: '执行监控台', icon: '📡' },
    { path: '/ledger', label: '项目台账', icon: '📋' },
    { path: '/risks', label: '风险看板', icon: '⚠' },
    { path: '/todos', label: '待办审批', icon: '✓' },
    { path: '/apply', label: '立项申报', icon: '📝' },
    { path: '/ai', label: '智能助手', icon: '✦' },
  ],
  owner: [
    { path: '/dashboard', label: '负责人工作台', icon: '👤' },
    { path: '/ledger', label: '我的项目', icon: '📋' },
    { path: '/todos', label: '我的待办', icon: '✓' },
    { path: '/apply', label: '立项申报', icon: '📝' },
  ],
  member: [
    { path: '/dashboard', label: '我的工作台', icon: '💼' },
    { path: '/ledger', label: '我的项目', icon: '📋' },
    { path: '/todos', label: '我的待办', icon: '✓' },
    { path: '/apply', label: '立项申报', icon: '📝' },
  ],
};

const menus = computed(() => roleMenus[user.value.role] || roleMenus.member);

function logout() {
  localStorage.removeItem('keyan_token');
  localStorage.removeItem('keyan_user');
  router.push('/login');
}
</script>

<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">
        <div class="logo">科研管理</div>
        <div class="tag">Ontology · 一本账</div>
      </div>
      <nav>
        <router-link v-for="m in menus" :key="m.path" :to="m.path" class="nav-item" :class="{ active: route.path === m.path || (m.path !== '/dashboard' && route.path.startsWith(m.path)) }">
          <span class="ico">{{ m.icon }}</span>{{ m.label }}
        </router-link>
      </nav>
      <div class="user-card">
        <strong>{{ user.name }}</strong>
        <span>{{ user.title || user.org }}</span>
        <button @click="logout">切换账号</button>
      </div>
    </aside>
    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.layout { display: flex; height: 100vh; }
.sidebar { width: 220px; background: var(--panel); border-right: 1px solid var(--line); display: flex; flex-direction: column; padding: 16px 12px; }
.brand { padding: 8px 8px 20px; border-bottom: 1px solid var(--line); margin-bottom: 12px; }
.logo { font-weight: 700; font-size: 17px; }
.tag { font-size: 11px; color: var(--muted); margin-top: 4px; }
.nav-item { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 8px; color: var(--muted); font-size: 14px; margin-bottom: 2px; }
.nav-item:hover, .nav-item.active { background: rgba(59,130,246,0.12); color: var(--text); }
.ico { width: 20px; text-align: center; }
.user-card { margin-top: auto; padding: 12px; background: var(--panel-2); border-radius: 10px; border: 1px solid var(--line); }
.user-card strong { display: block; font-size: 14px; }
.user-card span { display: block; font-size: 12px; color: var(--muted); margin: 4px 0 10px; }
.user-card button { width: 100%; padding: 6px; border: 1px solid var(--line); background: transparent; color: var(--muted); border-radius: 6px; cursor: pointer; font-size: 12px; }
.main { flex: 1; overflow: auto; padding: 24px 28px; }
</style>
