<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import api from '../api';
import { LOGIN_PORTALS, homeRouteForRole, normalizeRole } from '../roles';

const router = useRouter();
const loading = ref(false);
const error = ref('');
const username = ref('');
const password = ref('');
const activePortal = ref('fill');
const showDemo = ref(false);

const personas = [
  { username: 'team_owner', name: '周明', title: '项目团队', sub: '项目联系人/负责人', org: '试飞中心', portal: 'fill' },
  { username: 'team_tech', name: '张晓', title: '项目团队', sub: '技术责任人', org: '试飞中心', portal: 'fill' },
  { username: 'team_pm', name: '赵明远', title: '项目团队', sub: '项目主管', org: '试飞中心', portal: 'fill' },
  { username: 'chief_l1', name: '张总师', title: '一级责任总师', sub: '审签节点', org: '总部', portal: 'review' },
  { username: 'chief_l2', name: '王总师', title: '二级责任总师', sub: '审签节点', org: '试飞中心', portal: 'review' },
  { username: 'mgmt_hq', name: '陈建国', title: '总部科技部', sub: '科研项目处审签', org: '总部科技部', portal: 'review' },
  { username: 'mgmt_unit', name: '王海涛', title: '单位科技部', sub: '单位审签节点', org: '试飞中心', portal: 'review' },
  { username: 'finance', name: '刘财务', title: '财务团队', sub: '经费审签节点', org: '试飞中心', portal: 'finance' },
  { username: 'admin', name: '系统管理员', title: '超级管理员', sub: '运维配置', org: '总部科技部', portal: 'ops' },
];

const currentPortal = computed(() => LOGIN_PORTALS.find((p) => p.id === activePortal.value) || LOGIN_PORTALS[0]);
const portalPersonas = computed(() => personas.filter((p) => p.portal === activePortal.value));

async function doLogin(user, pass) {
  loading.value = true;
  error.value = '';
  try {
    const { data } = await api.post('/auth/login', { username: user, password: pass });
    localStorage.setItem('keyan_token', data.token);
    localStorage.setItem('keyan_user', JSON.stringify(data.user));
    router.push(homeRouteForRole(data.user.role));
  } catch (e) {
    error.value = e.response?.data?.error || '登录失败，请检查账号和密码';
  } finally {
    loading.value = false;
  }
}

function onSubmit() {
  if (!username.value.trim()) {
    error.value = '请输入用户名';
    return;
  }
  if (!password.value) {
    error.value = '请输入密码';
    return;
  }
  doLogin(username.value.trim(), password.value);
}

function loginAs(p) {
  username.value = p.username;
  password.value = 'Keyan@2026';
  activePortal.value = p.portal;
  doLogin(p.username, 'Keyan@2026');
}
</script>

<template>
  <div class="login-page">
    <div class="login-shell">
      <aside class="portal-panel">
        <h1>科研项目信息化管理平台</h1>
        <p class="sub">V18 审签流程 · 按角色职责分入口登录</p>

        <div class="portal-tabs">
          <button
            v-for="p in LOGIN_PORTALS"
            :key="p.id"
            type="button"
            class="portal-tab"
            :class="{ active: activePortal === p.id }"
            :style="{ '--portal-accent': p.accent }"
            @click="activePortal = p.id"
          >
            <strong>{{ p.title }}</strong>
            <span>{{ p.subtitle }}</span>
          </button>
        </div>

        <div class="portal-desc" :style="{ borderColor: currentPortal.accent }">
          <h3>{{ currentPortal.title }}</h3>
          <p>{{ currentPortal.desc }}</p>
          <ul class="portal-features">
            <li v-if="activePortal === 'fill'">立项申报 → 多级审签 → 线下报批</li>
            <li v-if="activePortal === 'fill'">驳回修改 · 流程撤销 · 附件替换</li>
            <li v-if="activePortal === 'review'">国家级/地方级/公司级差异化审批链</li>
            <li v-if="activePortal === 'review'">科技周 · 大飞机研究院 · 材料联盟等特殊流程</li>
            <li v-if="activePortal === 'finance'">单位财务部门负责人审签节点</li>
            <li v-if="activePortal === 'ops'">全渠道流程配置 · 人员与权限运维</li>
          </ul>
        </div>
      </aside>

      <main class="form-panel">
        <el-card shadow="never" class="form-card">
          <div class="form-head">
            <span class="form-badge" :style="{ background: currentPortal.accent }">{{ currentPortal.title }}</span>
            <h2>账号登录</h2>
          </div>
          <el-form label-position="top" @submit.prevent="onSubmit">
            <el-form-item label="用户名">
              <el-input
                v-model="username"
                placeholder="请输入用户名"
                clearable
                :disabled="loading"
                @keyup.enter="onSubmit"
              />
            </el-form-item>
            <el-form-item label="密码">
              <el-input
                v-model="password"
                type="password"
                placeholder="请输入密码"
                show-password
                :disabled="loading"
                @keyup.enter="onSubmit"
              />
            </el-form-item>
            <p v-if="error" class="err">{{ error }}</p>
            <el-button type="primary" class="submit-btn" :loading="loading" @click="onSubmit">
              进入{{ currentPortal.title }}
            </el-button>
          </el-form>
        </el-card>

        <div class="demo-section">
          <button type="button" class="demo-toggle" @click="showDemo = !showDemo">
            {{ showDemo ? '收起演示快捷登录 ▲' : `${currentPortal.title} · 演示账号 ▼` }}
          </button>
          <template v-if="showDemo">
            <div class="personas">
              <button
                v-for="p in portalPersonas"
                :key="p.username"
                type="button"
                class="persona"
                :disabled="loading"
                @click="loginAs(p)"
              >
                <strong>{{ p.name }}</strong>
                <span>{{ p.title }} · {{ p.sub }}</span>
                <small>{{ p.org }} · {{ p.username }}</small>
              </button>
            </div>
            <p class="hint">演示账号统一密码：Keyan@2026</p>
          </template>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse at 20% 30%, #1e3a5f 0%, #0a0e17 65%);
  padding: 24px;
}
.login-shell {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 32px;
  width: min(960px, 100%);
  align-items: start;
}
.portal-panel h1 {
  margin: 0;
  font-size: 22px;
  letter-spacing: 0.02em;
}
.sub {
  color: var(--muted);
  margin: 8px 0 20px;
  font-size: 13px;
}
.portal-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 16px;
}
.portal-tab {
  text-align: left;
  padding: 10px 12px;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--text);
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.portal-tab.active {
  border-color: var(--portal-accent, var(--accent));
  background: rgba(70, 130, 180, 0.1);
}
.portal-tab strong { display: block; font-size: 12px; }
.portal-tab span { display: block; font-size: 10px; color: var(--muted); margin-top: 2px; }
.portal-desc {
  padding: 16px;
  background: var(--panel-2);
  border-radius: 8px;
  border-left: 3px solid var(--accent);
}
.portal-desc h3 { margin: 0 0 8px; font-size: 14px; }
.portal-desc p { margin: 0 0 12px; font-size: 12px; color: var(--muted); line-height: 1.6; }
.portal-features {
  margin: 0;
  padding-left: 18px;
  font-size: 11px;
  color: var(--muted);
  line-height: 1.8;
}
.form-panel { width: 100%; }
.form-card { margin-bottom: 16px; }
.form-head { margin-bottom: 16px; }
.form-badge {
  display: inline-block;
  font-size: 10px;
  color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
  margin-bottom: 8px;
}
.form-head h2 { margin: 0; font-size: 18px; }
.submit-btn { width: 100%; margin-top: 4px; }
.err { color: var(--red); font-size: 13px; margin: 0 0 8px; }
.demo-toggle {
  width: 100%;
  padding: 8px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;
}
.demo-toggle:hover { color: var(--accent); }
.personas { display: grid; gap: 8px; margin-top: 8px; max-height: 280px; overflow-y: auto; }
.persona {
  text-align: left;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--text);
  cursor: pointer;
}
.persona:hover:not(:disabled) { border-color: var(--accent); }
.persona strong { display: block; font-size: 13px; }
.persona span { display: block; color: var(--accent); font-size: 11px; margin-top: 2px; }
.persona small { color: var(--muted); font-size: 10px; }
.hint { text-align: center; color: var(--muted); font-size: 11px; margin-top: 10px; }
@media (max-width: 800px) {
  .login-shell { grid-template-columns: 1fr; }
}
</style>
