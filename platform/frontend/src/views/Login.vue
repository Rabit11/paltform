<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import api from '../api';

const router = useRouter();
const loading = ref(false);
const error = ref('');
const personas = [
  { username: 'hq_admin', role: 'hq', name: '陈建国', title: '总部治理台', org: '总部科技部' },
  { username: 'leader_li', role: 'leader', name: '李振华', title: '领导驾驶舱', org: '总部' },
  { username: 'dept_wang', role: 'dept', name: '王海涛', title: '单位治理台', org: '试飞中心' },
  { username: 'pm_zhao', role: 'pm', name: '赵明远', title: '执行监控台', org: '总部科技部' },
  { username: 'owner_zhou', role: 'owner', name: '周明', title: '负责人工作台', org: '试飞中心' },
  { username: 'member_zhang', role: 'member', name: '张晓', title: '我的工作台', org: '试飞中心' },
];

async function loginAs(p) {
  loading.value = true;
  error.value = '';
  try {
    const { data } = await api.post('/auth/login', { username: p.username, password: 'Keyan@2026' });
    localStorage.setItem('keyan_token', data.token);
    localStorage.setItem('keyan_user', JSON.stringify(data.user));
    router.push('/dashboard');
  } catch (e) {
    error.value = e.response?.data?.error || '登录失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-box">
      <h1>科研项目信息化管理平台</h1>
      <p class="sub">AI 原生 · 本体架构 · 一本账全生命周期管控</p>
      <p v-if="error" class="err">{{ error }}</p>
      <div class="personas">
        <button v-for="p in personas" :key="p.username" class="persona" :disabled="loading" @click="loginAs(p)">
          <strong>{{ p.name }}</strong>
          <span>{{ p.title }}</span>
          <small>{{ p.org }}</small>
        </button>
      </div>
      <p class="hint">演示账号统一密码：Keyan@2026</p>
    </div>
  </div>
</template>

<style scoped>
.login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse at 30% 20%, #1e3a5f 0%, #0a0e17 60%); }
.login-box { width: min(920px, 94vw); padding: 40px; }
h1 { margin: 0; font-size: 28px; letter-spacing: 0.02em; }
.sub { color: var(--muted); margin: 8px 0 28px; }
.err { color: var(--red); }
.personas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.persona { text-align: left; background: var(--panel-2); border: 1px solid var(--line); border-radius: 12px; padding: 16px; color: var(--text); cursor: pointer; transition: border-color .2s, transform .15s; }
.persona:hover:not(:disabled) { border-color: var(--accent); transform: translateY(-2px); }
.persona strong { display: block; font-size: 16px; }
.persona span { display: block; color: var(--accent); font-size: 13px; margin-top: 4px; }
.persona small { color: var(--muted); font-size: 12px; }
.hint { text-align: center; color: var(--muted); font-size: 12px; margin-top: 20px; }
@media (max-width: 700px) { .personas { grid-template-columns: 1fr; } }
</style>
