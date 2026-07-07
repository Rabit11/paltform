<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '../api';

const router = useRouter();
const items = ref([]);
const approvalCount = ref(0);

async function load() {
  const [{ data: todos }, { data: inbox }] = await Promise.all([
    api.get('/todos'),
    api.get('/approvals/inbox').catch(() => ({ data: { pendingCount: 0 } })),
  ]);
  items.value = todos;
  approvalCount.value = inbox.pendingCount || 0;
}

onMounted(load);

async function handle(row, status) {
  await api.patch(`/todos/${row.id}`, { status });
  await load();
}

function goApprovals() {
  router.push('/approvals');
}
</script>

<template>
  <div>
    <h2 class="page-title">待办审批</h2>
    <p class="muted">分级审批流 · 驳回留痕 · 全程可溯源</p>

    <el-alert
      v-if="approvalCount"
      type="warning"
      :closable="false"
      show-icon
      class="approval-banner"
    >
      您有 <strong>{{ approvalCount }}</strong> 条立项审签待处理
      <el-button type="primary" size="small" style="margin-left:12px" @click="goApprovals">进入审签中心</el-button>
    </el-alert>

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
            <el-button v-if="row.type === 'apply_review'" size="small" type="primary" @click="goApprovals">审签</el-button>
            <template v-else>
              <el-button size="small" type="primary" @click="handle(row, 'approved')">通过</el-button>
              <el-button size="small" @click="handle(row, 'rejected')">驳回</el-button>
            </template>
          </template>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.approval-banner { margin: 12px 0 16px; }
</style>
