<template>
  <a-card title="成员管理（本系统登录账号）">
    <a-table :data-source="rows" :columns="cols" row-key="emp_no" size="middle" />
  </a-card>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import api from '../api/http'

const rows = ref<Record<string, unknown>[]>([])
const cols = [
  { title: '工号', dataIndex: 'emp_no' },
  { title: '姓名', dataIndex: 'name' },
  { title: '平台身份', dataIndex: 'role' },
  { title: '范围', dataIndex: 'scope' },
  { title: '表单维护', dataIndex: 'form_access' },
]
onMounted(async () => {
  const { data } = await api.get('/admin/users')
  rows.value = data.users || []
})
</script>
