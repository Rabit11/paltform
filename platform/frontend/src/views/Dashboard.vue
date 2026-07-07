<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import * as echarts from 'echarts';
import api from '../api';

const router = useRouter();
const data = ref(null);
const projectChartRef = ref(null);
const personnelChartRef = ref(null);
let refreshTimer = null;
let projectChart = null;
let personnelChart = null;

const COMAC_COLORS = [
  '#2359a7', '#11766f', '#1a6eb5', '#2d8f83', '#9a7026',
  '#4a90c4', '#0d4a8a', '#5ba897', '#c4973a', '#102c4a',
  '#3f7d56', '#34455f', '#708096', '#a84b45', '#5c8fd6',
];

import { dashboardTitle } from '../roles';

function buildPieOption(items, unit) {
  const pieData = (items || []).map((item, i) => ({
    name: item.name,
    value: item.value,
    itemStyle: { color: COMAC_COLORS[i % COMAC_COLORS.length] },
  }));
  return {
    backgroundColor: '#fbf7ee',
    color: COMAC_COLORS,
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(7,24,44,0.92)',
      borderColor: '#2359a7',
      textStyle: { color: '#f1eadf', fontSize: 12 },
      formatter: (p) => {
        const pct = p.percent?.toFixed(2) ?? 0;
        const suffix = unit === '人' ? '人' : ` ${unit}`;
        return `${p.name}<br/>${p.value}${suffix}（${pct}%）`;
      },
    },
    series: [{
      type: 'pie',
      radius: ['0%', '58%'],
      center: ['50%', '52%'],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: '#fbf7ee', borderWidth: 2 },
      label: {
        show: true,
        position: 'outside',
        alignTo: 'edge',
        edgeDistance: 8,
        formatter: (p) => {
          const pct = p.percent?.toFixed(2) ?? 0;
          const val = unit === '人' ? `${p.value}人 (${pct}%)` : `${p.value}${unit} (${pct}%)`;
          return `{name|${p.name}}\n{val|${val}}`;
        },
        rich: {
          name: { fontSize: 11, color: '#34455f', lineHeight: 16 },
          val: { fontSize: 10, color: '#708096', lineHeight: 14 },
        },
      },
      labelLine: { show: true, length: 12, length2: 10, lineStyle: { color: '#c8bfb0' } },
      emphasis: {
        scaleSize: 6,
        itemStyle: { shadowBlur: 12, shadowColor: 'rgba(35,89,167,0.35)' },
      },
      data: pieData,
    }],
  };
}

function renderCharts() {
  if (!data.value?.charts) return;
  if (projectChartRef.value) {
    if (!projectChart) projectChart = echarts.init(projectChartRef.value);
    projectChart.setOption(
      buildPieOption(data.value.charts.projectByField.items, '万元'),
      true,
    );
  }
  if (personnelChartRef.value) {
    if (!personnelChart) personnelChart = echarts.init(personnelChartRef.value);
    personnelChart.setOption(
      buildPieOption(data.value.charts.personnelByField.items, '人'),
      true,
    );
  }
}

function onResize() {
  projectChart?.resize();
  personnelChart?.resize();
}

async function loadDashboard() {
  const { data: d } = await api.get('/dashboard');
  data.value = d;
  await nextTick();
  renderCharts();
}

onMounted(async () => {
  await loadDashboard();
  window.addEventListener('resize', onResize);
  refreshTimer = setInterval(loadDashboard, 30000);
});

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer);
  window.removeEventListener('resize', onResize);
  projectChart?.dispose();
  personnelChart?.dispose();
});

watch(() => data.value?.charts, () => nextTick(renderCharts), { deep: true });
</script>

<template>
  <div v-if="data">
    <div class="head-row">
      <div>
        <h2 class="page-title">{{ dashboardTitle(data.role) }}</h2>
        <p class="muted">依据需求 V18：四色预警统一规则 · 经费汇总观察口径 · 全生命周期一本账</p>
      </div>
      <el-button size="small" @click="loadDashboard">刷新数据</el-button>
    </div>

    <div class="card-grid" style="margin: 20px 0">
      <div class="stat-card"><div class="muted">在管项目</div><div class="num">{{ data.stats.total }}</div></div>
      <div class="stat-card"><div class="muted">红色预警</div><div class="num" style="color:var(--red)">{{ data.stats.byRisk.red || 0 }}</div></div>
      <div class="stat-card"><div class="muted">黄色临期</div><div class="num" style="color:var(--yellow)">{{ data.stats.byRisk.yellow || 0 }}</div></div>
      <div class="stat-card"><div class="muted">经费总额(万)</div><div class="num">{{ data.stats.budgetTotal.toFixed(0) }}</div></div>
      <div class="stat-card"><div class="muted">已支出(万)</div><div class="num">{{ data.stats.budgetSpent.toFixed(0) }}</div></div>
    </div>

    <el-row v-if="data.charts" :gutter="16" style="margin-bottom:16px">
      <el-col :span="12">
        <el-card shadow="never" class="chart-card">
          <div class="comac-chart-wrap">
            <div class="chart-head">
              <h4>项目按专业分类（经费占比）</h4>
              <p class="sub">按项目名称关键词自动归类 · 经费合计 {{ data.charts.projectByField.total }} 万元 · 随项目台账动态更新</p>
            </div>
            <div ref="projectChartRef" class="chart-box" />
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never" class="chart-card">
          <div class="comac-chart-wrap">
            <div class="chart-head">
              <h4>人员专业划分</h4>
              <p class="sub">科研人员共 {{ data.charts.personnelByField.total }} 人 · 按专业领域统计</p>
            </div>
            <div ref="personnelChartRef" class="chart-box" />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :span="14">
        <el-card shadow="never">
          <template #header>待办事项</template>
          <el-table :data="data.todos" size="small" @row-click="() => router.push('/todos')">
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
.head-row { display: flex; justify-content: space-between; align-items: flex-start; }
.chart-card :deep(.el-card__body) { padding: 12px; }
.comac-chart-wrap {
  background: #fbf7ee;
  border-radius: 8px;
  padding: 12px 8px 4px;
  border: 1px solid rgba(35, 89, 167, 0.12);
}
.chart-head { padding: 0 12px 4px; }
.chart-head h4 { margin: 0; font-size: 14px; color: #172235; font-weight: 600; }
.chart-head .sub { margin: 4px 0 0; font-size: 11px; color: #708096; }
.chart-box { width: 100%; height: 340px; }
.risk-row { display: flex; gap: 10px; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid var(--line); cursor: pointer; }
.risk-row:hover { opacity: 0.85; }
.phase-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--line); font-size: 13px; }
</style>
