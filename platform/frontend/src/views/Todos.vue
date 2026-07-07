<script setup>
import { ref, onMounted } from 'vue';
import api from '../api';

const items = ref([]);
async function load() {
  const { data } = await api.get('/todos');
  items.value = data;
}
onMounted(load);

async function handle(row, status) {
  await api.patch(`/todos/${row.id}`, { status });
  await load();
}
</script>

<template>
  <div>
    <h2 class="page-title">待办审批</h2>
    <p class="muted">分级审批流 · 驳回留痕 · 全程可溯源</p>
    <el-table :data="items">
      <el-table-column prop="title" label="事项" min-width="240" />
      <el-table-column prop="type" label="类型" width="110" />
      <el-table-column label="关联项目" min-width="180"><template #default="{ row }">{{ row.project?.name || '—' }}</template></el-table-column>
      <el-table-column prop="status" label="状态" width="90">
        <template #default="{ row }"><el-tag :type="row.status === 'pending' ? 'warning' : 'success'" size="small">{{ row.status === 'pending' ? '待处理' : '已完成' }}</el-tag></template>
      </el-table-column>
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <template v-if="row.status === 'pending'">
            <el-button size="small" type="primary" @click="handle(row, 'approved')">通过</el-button>
            <el-button size="small" @click="handle(row, 'rejected')">驳回</el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
