<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '../api';

const router = useRouter();
const data = ref(null);

const roleTitles = {
  hq: '总部治理台',
  leader: '领导驾驶舱',
  dept: '单位治理台',
  pm: '执行监控台',
  owner: '负责人工作台',
  member: '我的工作台',
};

onMounted(async () => {
  const { data: d } = await api.get('/dashboard');
  data.value = d;
});

function riskLabel(c) {
  return { red: '红色逾期', yellow: '黄色临期', blue: '蓝色正常', green: '绿色完成' }[c] || c;
}
</script>

<template>
  <div v-if="data">
    <h2 class="page-title">{{ roleTitles[data.role] || '工作台' }}</h2>
    <p class="muted">依据需求 V18：四色预警统一规则 · 经费汇总观察口径 · 全生命周期一本账</p>

    <div class="card-grid" style="margin: 20px 0">
      <div class="stat-card"><div class="muted">在管项目</div><div class="num">{{ data.stats.total }}</div></div>
      <div class="stat-card"><div class="muted">红色预警</div><div class="num" style="color:var(--red)">{{ data.stats.byRisk.red || 0 }}</div></div>
      <div class="stat-card"><div class="muted">黄色临期</div><div class="num" style="color:var(--yellow)">{{ data.stats.byRisk.yellow || 0 }}</div></div>
      <div class="stat-card"><div class="muted">经费总额(万)</div><div class="num">{{ data.stats.budgetTotal.toFixed(0) }}</div></div>
      <div class="stat-card"><div class="muted">已支出(万)</div><div class="num">{{ data.stats.budgetSpent.toFixed(0) }}</div></div>
    </div>

    <el-row :gutter="16">
      <el-col :span="14">
        <el-card shadow="never">
          <template #header>待办事项</template>
          <el-table :data="data.todos" size="small" @row-click="(r) => router.push('/todos')">
            <el-table-column prop="title" label="事项" />
            <el-table-column prop="type" label="类型" width="100" />
            <el-table-column label="关联项目" width="180">
              <template #default="{ row }">{{ row.project?.name || '—' }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card shadow="never">
          <template #header>红色预警项目</template>
          <div v-if="!data.stats.redProjects.length" class="muted">当前范围内无红色项目</div>
          <div v-for="p in data.stats.redProjects" :key="p.id" class="risk-row" @click="router.push(`/projects/${p.id}`)">
            <span class="risk-dot red" />
            <div>
              <div>{{ p.name }}</div>
              <small class="muted">{{ p.org }} · {{ p.owner }}</small>
            </div>
          </div>
        </el-card>
        <el-card shadow="never" style="margin-top:12px">
          <template #header>阶段分布</template>
          <div v-for="(v, k) in data.stats.byPhase" :key="k" class="phase-row">
            <span>{{ k }}</span><strong>{{ v }}</strong>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.risk-row { display: flex; gap: 10px; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid var(--line); cursor: pointer; }
.risk-row:hover { opacity: 0.85; }
.phase-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--line); font-size: 13px; }
</style>
