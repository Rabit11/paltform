<template>
  <a-card title="人员名录（原平台主数据）">
    <a-space style="margin-bottom: 16px">
      <a-button type="primary" :loading="busy" @click="sync">从原平台同步</a-button>
      <span class="hint">未配置 org-platform 时，用本系统登录账号生成名录桩数据。</span>
    </a-space>
    <a-table :data-source="rows" :columns="cols" row-key="empNo" size="middle" />
  </a-card>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import api from '../api/http'

const rows = ref<Record<string, unknown>[]>([])
const busy = ref(false)
const cols = [
  { title: '工号', dataIndex: 'empNo' },
  { title: '姓名', dataIndex: 'name' },
  { title: '单位', dataIndex: 'unitName' },
  { title: '部门/职务', dataIndex: 'dept' },
]
async function load() {
  const { data } = await api.get('/roster')
  rows.value = data.people || []
}
async function sync() {
  busy.value = true
  try {
    await api.post('/org/people/sync', {})
    await load()
  } finally {
    busy.value = false
  }
}
onMounted(load)
</script>
<style scoped>
.hint { color: #8c8c8c; font-size: 13px; }
</style>
