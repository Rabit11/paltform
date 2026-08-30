<template>
  <div class="login-page">
    <a-card class="card" title="科研项目信息化管理平台">
      <p class="sub">Vue3 + TypeScript  /  Spring Boot</p>
      <a-form layout="vertical" @finish="onFinish">
        <a-form-item label="工号（六位数字）" name="username" :rules="[{ required: true }]">
          <a-input v-model:value="username" placeholder="请输入工号" />
        </a-form-item>
        <a-form-item label="密码" name="password" :rules="[{ required: true }]">
          <a-input-password v-model:value="password" placeholder="初始密码与工号相同" />
        </a-form-item>
        <a-button type="primary" html-type="submit" block :loading="busy">登 录</a-button>
        <p v-if="err" class="err">{{ err }}</p>
      </a-form>
    </a-card>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSession } from '../stores/session'

const username = ref('100001')
const password = ref('100001')
const busy = ref(false)
const err = ref('')
const session = useSession()
const router = useRouter()

async function onFinish() {
  busy.value = true
  err.value = ''
  try {
    await session.login(username.value, password.value)
    await router.push('/cockpit')
  } catch (e: unknown) {
    const ax = e as { response?: { data?: { message?: string; error?: string } } }
    err.value = ax.response?.data?.message || ax.response?.data?.error || '登录失败'
  } finally {
    busy.value = false
  }
}
</script>
<style scoped>
.login-page { min-height: 100%; display: flex; align-items: center; justify-content: center; background: #f0f2f5; }
.card { width: 400px; }
.sub { color: #8c8c8c; margin: -8px 0 16px; font-size: 12px; }
.err { color: #cf1322; margin-top: 12px; }
</style>
