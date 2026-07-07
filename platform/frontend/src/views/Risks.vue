<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '../api';

const router = useRouter();
const items = ref([]);
onMounted(async () => {
  const { data } = await api.get('/risks');
  items.value = data;
});
</script>

<template>
  <div>
    <h2 class="page-title">风险看板</h2>
    <p class="muted">四色预警：红＞黄＞蓝＞绿 · 临期 30 天自动触发黄色预警</p>
    <el-table :data="items" @row-click="(r) => router.push(`/projects/${r.id}`)">
      <el-table-column width="40"><template #default="{ row }"><span class="risk-dot" :class="row.risk" /></template></el-table-column>
      <el-table-column prop="name" label="项目名称" min-width="220" />
      <el-table-column prop="org" label="单位" width="120" />
      <el-table-column prop="owner" label="负责人" width="90" />
      <el-table-column prop="phase" label="阶段" width="90" />
      <el-table-column prop="endDate" label="计划结束" width="110" />
      <el-table-column label="经费执行" width="100">
        <template #default="{ row }">{{ row.budgetTotal ? ((row.budgetSpent / row.budgetTotal) * 100).toFixed(0) : 0 }}%</template>
      </el-table-column>
    </el-table>
  </div>
</template>
