<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import api from '../api';

const router = useRouter();
const loading = ref(false);
const error = ref('');
const username = ref('');
const password = ref('');
const showDemo = ref(false);

const personas = [
  { username: 'team_owner', name: '周明', title: '项目团队', sub: '项目责任人', org: '试飞中心' },
  { username: 'team_tech', name: '张晓', title: '项目团队', sub: '技术责任人', org: '试飞中心' },
  { username: 'team_pm', name: '赵明远', title: '项目团队', sub: '项目主管', org: '试飞中心' },
  { username: 'chief_l1', name: '张总师', title: '一级责任总师', sub: '经手项目审核', org: '总部' },
  { username: 'chief_l2', name: '王总师', title: '二级责任总师', sub: '经手项目审核', org: '试飞中心' },
  { username: 'mgmt_hq', name: '陈建国', title: '管理团队（总部）', sub: '可查看导出全公司项目', org: '总部科技部' },
  { username: 'mgmt_unit', name: '王海涛', title: '管理团队（单位）', sub: '本单位项目统筹', org: '试飞中心' },
  { username: 'finance', name: '刘财务', title: '财务团队', sub: '本单位经费台账', org: '试飞中心' },
  { username: 'admin', name: '系统管理员', title: '超级管理员', sub: '运维配置', org: '总部科技部' },
];

async function doLogin(user, pass) {
  loading.value = true;
  error.value = '';
  try {
    const { data } = await api.post('/auth/login', { username: user, password: pass });
    localStorage.setItem('keyan_token', data.token);
    localStorage.setItem('keyan_user', JSON.stringify(data.user));
    router.push('/dashboard');
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
  doLogin(p.username, 'Keyan@2026');
}
</script>

<template>
  <div class="login-page">
    <div class="login-box">
      <h1>科研项目信息化管理平台</h1>
      <p class="sub">AI 原生 · 本体架构 · 一本账全生命周期管控</p>

      <el-card shadow="never" class="form-card">
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
            登录
          </el-button>
        </el-form>
      </el-card>

      <div class="demo-section">
        <button type="button" class="demo-toggle" @click="showDemo = !showDemo">
          {{ showDemo ? '收起演示快捷登录 ▲' : '演示快捷登录（可选）▼' }}
        </button>
        <template v-if="showDemo">
          <div class="personas">
            <button
              v-for="p in personas"
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
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse at 30% 20%, #1e3a5f 0%, #0a0e17 60%);
}
.login-box {
  width: min(440px, 94vw);
  padding: 40px 24px;
}
h1 {
  margin: 0;
  font-size: 24px;
  letter-spacing: 0.02em;
  text-align: center;
}
.sub {
  color: var(--muted);
  margin: 8px 0 24px;
  text-align: center;
  font-size: 13px;
}
.form-card {
  margin-bottom: 20px;
}
.submit-btn {
  width: 100%;
  margin-top: 4px;
}
.err {
  color: var(--red);
  font-size: 13px;
  margin: 0 0 8px;
}
.demo-section {
  margin-top: 8px;
}
.demo-toggle {
  width: 100%;
  padding: 8px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;
}
.demo-toggle:hover {
  color: var(--accent);
}
.personas {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-top: 8px;
  max-height: 320px;
  overflow-y: auto;
}
.persona {
  text-align: left;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--text);
  cursor: pointer;
  transition: border-color 0.2s;
}
.persona:hover:not(:disabled) {
  border-color: var(--accent);
}
.persona strong {
  display: block;
  font-size: 13px;
}
.persona span {
  display: block;
  color: var(--accent);
  font-size: 11px;
  margin-top: 2px;
}
.persona small {
  color: var(--muted);
  font-size: 10px;
}
.hint {
  text-align: center;
  color: var(--muted);
  font-size: 11px;
  margin-top: 10px;
}
@media (max-width: 500px) {
  .personas {
    grid-template-columns: 1fr;
  }
}
</style>
