<template>
  <a-layout class="shell">
    <a-layout-header class="bar">
      <div class="brand">科研项目信息化管理平台</div>
      <div class="meta">
        <span>{{ session.user?.name }} · {{ session.user?.role }}</span>
        <a-button type="link" @click="out">退出</a-button>
      </div>
    </a-layout-header>
    <a-layout>
      <a-layout-sider width="228" theme="light" class="sider">
        <a-menu :selected-keys="[route.path]" mode="inline" @click="onMenu">
          <a-menu-item key="/cockpit">可视化驾驶舱</a-menu-item>
          <a-menu-item key="/projects">项目台账</a-menu-item>
          <a-menu-item v-if="session.canForm" key="/ledger">表单维护</a-menu-item>
          <a-menu-item v-if="session.user?.role === 'admin'" key="/admin/members">成员管理</a-menu-item>
          <a-menu-item v-if="session.user?.role === 'admin' || session.user?.role === 'mgmt'" key="/admin/people">人员名录</a-menu-item>
        </a-menu>
      </a-layout-sider>
      <a-layout-content class="content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>
<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSession } from '../stores/session'

const session = useSession()
const route = useRoute()
const router = useRouter()

onMounted(() => { session.restore().catch(() => session.logout()) })

function onMenu(info: { key: string }) {
  router.push(info.key)
}
function out() {
  session.logout()
  router.push('/login')
}
</script>
<style scoped>
.shell { min-height: 100%; }
.bar {
  background: #0048a0;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 56px;
  line-height: 56px;
}
.brand { font-weight: 600; }
.meta { display: flex; align-items: center; gap: 8px; }
.meta :deep(.ant-btn-link) { color: #fff; }
.sider { border-right: 1px solid #e8e8e8; }
.content { padding: 20px; background: #f5f7fa; min-height: calc(100vh - 56px); }
</style>
