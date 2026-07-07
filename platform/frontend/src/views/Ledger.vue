<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import api from '../api';
import { normalizeRole, canExport, roleLabel } from '../roles';

const router = useRouter();
const user = JSON.parse(localStorage.getItem('keyan_user') || '{}');
const role = normalizeRole(user.role);
const items = ref([]);
const showExport = ref(false);
const filters = ref({ search: '', level: '', risk: '', phase: '' });

const pageTitle = computed(() => {
  if (role === 'finance') return '经费台账';
  if (role === 'project_team') return '我的项目';
  if (role.startsWith('chief')) return '经手项目';
  return '项目台账';
});

const pageHint = computed(() => {
  if (role === 'finance') return '财务团队：仅查看本单位项目经费台账（汇总观察口径），无修改权限';
  return '台账由立项、实施、验收全流程自动归集，无需手工填报';
});

async function load() {
  const { data } = await api.get('/projects', { params: filters.value });
  items.value = data.items;
  showExport.value = data.canExport;
}

onMounted(() => {
  const q = router.currentRoute.value.query;
  if (q.level) filters.value.level = q.level;
  if (q.risk) filters.value.risk = q.risk;
  if (q.phase) filters.value.phase = q.phase;
  if (q.search) filters.value.search = q.search;
  load();
});

function exportCsv() {
  const header = ['编号', '名称', '层级', '渠道', '单位', '负责人', '阶段', '预警', '总经费', '已支出'];
  const rows = items.value.map((p) => [p.code, p.name, p.level, p.channelName, p.org, p.owner, p.phase, p.risk, p.budgetTotal, p.budgetSpent]);
  const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '项目台账.csv';
  a.click();
}
</script>

<template>
  <div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div>
        <h2 class="page-title" style="margin:0">{{ pageTitle }}</h2>
        <p class="muted" style="margin:4px 0 0">{{ roleLabel(user.role) }}</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <el-input v-model="filters.search" placeholder="搜索项目/单位/负责人" clearable style="width:200px" @change="load" />
        <el-select v-if="role !== 'finance'" v-model="filters.level" placeholder="层级" clearable style="width:120px" @change="load">
          <el-option label="国家级" value="国家级" /><el-option label="地方级" value="地方级" /><el-option label="公司级" value="公司级" />
        </el-select>
        <el-select v-model="filters.risk" placeholder="预警" clearable style="width:100px" @change="load">
          <el-option label="红" value="red" /><el-option label="黄" value="yellow" /><el-option label="蓝" value="blue" /><el-option label="绿" value="green" />
        </el-select>
        <el-button v-if="showExport && canExport(user.role)" type="primary" @click="exportCsv">导出 Excel</el-button>
      </div>
    </div>
    <p class="muted">{{ pageHint }}</p>
    <el-table :data="items" stripe class="data-table" @row-click="(r) => router.push(`/projects/${r.id}`)">
      <el-table-column v-if="role !== 'finance'" width="40">
        <template #default="{ row }"><span class="risk-dot" :class="row.risk" /></template>
      </el-table-column>
      <el-table-column prop="code" label="编号" width="130" />
      <el-table-column prop="name" label="项目名称" min-width="200" show-overflow-tooltip />
      <el-table-column v-if="role !== 'finance'" prop="level" label="层级" width="80" />
      <el-table-column v-if="role !== 'finance'" prop="org" label="承担单位" width="110" />
      <el-table-column v-if="role !== 'finance'" prop="owner" label="负责人" width="90" />
      <el-table-column label="总经费(万)" width="100"><template #default="{ row }">{{ row.budgetTotal }}</template></el-table-column>
      <el-table-column label="已支出(万)" width="100"><template #default="{ row }">{{ row.budgetSpent }}</template></el-table-column>
      <el-table-column label="执行率" width="80">
        <template #default="{ row }">{{ row.budgetTotal ? ((row.budgetSpent / row.budgetTotal) * 100).toFixed(0) : 0 }}%</template>
      </el-table-column>
      <el-table-column v-if="role !== 'finance'" label="操作" width="90">
        <template #default="{ row }"><el-button link type="primary" @click.stop="router.push(`/projects/${row.id}`)">进入档案</el-button></template>
      </el-table-column>
    </el-table>
  </div>
</template>
