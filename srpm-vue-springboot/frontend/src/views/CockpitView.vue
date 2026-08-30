<template>
  <a-card title="可视化驾驶舱">
    <a-statistic title="可见项目数" :value="total" />
    <p class="hint">数据来自 Spring Boot /api/dashboard。台账接入后与 V19 行数对齐。</p>
  </a-card>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import api from '../api/http'

const total = ref(0)
onMounted(async () => {
  const { data } = await api.get('/dashboard')
  total.value = data?.kpis?.total ?? 0
})
</script>
<style scoped>
.hint { margin-top: 16px; color: #8c8c8c; font-size: 13px; }
</style>
