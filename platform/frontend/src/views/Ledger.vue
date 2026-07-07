<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '../api';

const router = useRouter();
const items = ref([]);
const canExport = ref(false);
const filters = ref({ search: '', level: '', risk: '', phase: '' });

async function load() {
  const { data } = await api.get('/projects', { params: filters.value });
  items.value = data.items;
  canExport.value = data.canExport;
}

onMounted(load);

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
      <h2 class="page-title" style="margin:0">项目台账</h2>
      <div style="display:flex;gap:8px;align-items:center">
        <el-input v-model="filters.search" placeholder="搜索项目/单位/负责人" clearable style="width:200px" @change="load" />
        <el-select v-model="filters.level" placeholder="层级" clearable style="width:120px" @change="load">
          <el-option label="国家级" value="国家级" /><el-option label="地方级" value="地方级" /><el-option label="公司级" value="公司级" />
        </el-select>
        <el-select v-model="filters.risk" placeholder="预警" clearable style="width:100px" @change="load">
          <el-option label="红" value="red" /><el-option label="黄" value="yellow" /><el-option label="蓝" value="blue" /><el-option label="绿" value="green" />
        </el-select>
        <el-button v-if="canExport" type="primary" @click="exportCsv">导出 Excel</el-button>
      </div>
    </div>
    <p class="muted">台账由立项、实施、验收全流程自动归集，无需手工填报</p>
    <el-table :data="items" stripe @row-click="(r) => router.push(`/projects/${r.id}`)">
      <el-table-column width="40">
        <template #default="{ row }"><span class="risk-dot" :class="row.risk" /></template>
      </el-table-column>
      <el-table-column prop="code" label="编号" width="130" />
      <el-table-column prop="name" label="项目名称" min-width="220" show-overflow-tooltip />
      <el-table-column prop="level" label="层级" width="80" />
      <el-table-column prop="channelName" label="渠道" width="140" show-overflow-tooltip />
      <el-table-column prop="org" label="承担单位" width="110" />
      <el-table-column prop="owner" label="负责人" width="90" />
      <el-table-column prop="phase" label="阶段" width="90" />
      <el-table-column label="总经费(万)" width="100"><template #default="{ row }">{{ row.budgetTotal }}</template></el-table-column>
      <el-table-column label="执行率" width="80">
        <template #default="{ row }">{{ row.budgetTotal ? ((row.budgetSpent / row.budgetTotal) * 100).toFixed(0) : 0 }}%</template>
      </el-table-column>
      <el-table-column label="操作" width="90">
        <template #default="{ row }"><el-button link type="primary" @click.stop="router.push(`/projects/${row.id}`)">进入档案</el-button></template>
      </el-table-column>
    </el-table>
  </div>
</template>
