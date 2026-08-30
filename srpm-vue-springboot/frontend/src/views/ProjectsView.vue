<template>
  <a-card title="项目台账">
    <a-table :data-source="rows" :columns="cols" row-key="id" size="middle" />
    <p v-if="!rows.length" class="hint">暂无项目。后续从现网台账/8092 迁入 ledger 后在此展示。</p>
  </a-card>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import api from '../api/http'

const rows = ref<Record<string, unknown>[]>([])
const cols = [
  { title: '编号', dataIndex: 'code' },
  { title: '名称', dataIndex: 'name' },
  { title: '状态', dataIndex: 'status' },
  { title: '层级', dataIndex: 'level' },
]
onMounted(async () => {
  const { data } = await api.get('/projects')
  rows.value = Array.isArray(data) ? data : []
})
</script>
<style scoped>
.hint { margin-top: 12px; color: #8c8c8c; }
</style>
