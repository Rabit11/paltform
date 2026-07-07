<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick, computed } from 'vue';
import { useRouter } from 'vue-router';
import * as echarts from 'echarts';
import api from '../api';

const router = useRouter();
const board = ref(null);
const loading = ref(false);
const filters = ref({ year: '', org: '', level: '', channel: '', source: '' });

const chartRefs = {
  levelBar: ref(null),
  orgBar: ref(null),
  fundingBar: ref(null),
  fundingLine: ref(null),
  fieldPie: ref(null),
  phaseBar: ref(null),
  deliverableBar: ref(null),
  outcomePie: ref(null),
  riskPie: ref(null),
};
const charts = {};

const COMAC = ['#2359a7', '#11766f', '#1a6eb5', '#2d8f83', '#9a7026', '#4a90c4', '#0d4a8a', '#5ba897'];

async function loadBoard() {
  loading.value = true;
  try {
    const { data } = await api.get('/board', { params: filters.value });
    board.value = data;
    await nextTick();
    renderAllCharts();
  } finally {
    loading.value = false;
  }
}

function baseText() {
  return { color: '#94a3b8', fontSize: 11 };
}

function renderChart(key, option) {
  const el = chartRefs[key].value;
  if (!el) return;
  if (!charts[key]) charts[key] = echarts.init(el);
  charts[key].setOption(option, true);
  charts[key].off('click');
  charts[key].on('click', (p) => onChartClick(key, p));
}

function onChartClick(chartKey, params) {
  const q = { ...filters.value };
  const name = params.name;
  if (chartKey === 'levelBar' || chartKey === 'riskPie') q.level = name.includes('级') ? name : q.level;
  if (chartKey === 'orgBar' || chartKey === 'fundingBar') q.org = name;
  if (chartKey === 'phaseBar') q.phase = name;
  if (chartKey === 'riskPie' || name === '红' || name === '黄') {
    q.risk = { 红: 'red', 黄: 'yellow', 蓝: 'blue', 绿: 'green' }[name] || q.risk;
  }
  goLedger(q);
}

function goLedger(query = {}) {
  router.push({ path: '/ledger', query: Object.fromEntries(Object.entries(query).filter(([, v]) => v)) });
}

function goProject(id) {
  if (id) router.push(`/projects/${id}`);
}

function renderAllCharts() {
  if (!board.value) return;
  const d = board.value.dimensions;

  renderChart('levelBar', {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    grid: { left: 48, right: 16, top: 24, bottom: 28 },
    xAxis: { type: 'category', data: d.projectCount.byLevel.map((i) => i.name), axisLabel: baseText() },
    yAxis: { type: 'value', axisLabel: baseText(), splitLine: { lineStyle: { color: 'rgba(148,163,184,0.1)' } } },
    series: [{ type: 'bar', data: d.projectCount.byLevel.map((i) => i.value), itemStyle: { color: COMAC[0], borderRadius: [4, 4, 0, 0] }, barWidth: 28 }],
  });

  renderChart('orgBar', {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    grid: { left: 80, right: 16, top: 16, bottom: 24 },
    xAxis: { type: 'value', axisLabel: baseText(), splitLine: { lineStyle: { color: 'rgba(148,163,184,0.1)' } } },
    yAxis: { type: 'category', data: d.projectCount.byOrg.map((i) => i.name), axisLabel: baseText() },
    series: [{ type: 'bar', data: d.projectCount.byOrg.map((i) => i.value), itemStyle: { color: COMAC[1], borderRadius: [0, 4, 4, 0] } }],
  });

  renderChart('fundingBar', {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: { data: ['预算', '支出'], textStyle: baseText(), top: 0 },
    grid: { left: 48, right: 16, top: 32, bottom: 28 },
    xAxis: { type: 'category', data: d.funding.byOrg.map((i) => i.name), axisLabel: { ...baseText(), rotate: 20 } },
    yAxis: { type: 'value', name: '万元', nameTextStyle: baseText(), axisLabel: baseText(), splitLine: { lineStyle: { color: 'rgba(148,163,184,0.1)' } } },
    series: [
      { name: '预算', type: 'bar', data: d.funding.byOrg.map((i) => i.total), itemStyle: { color: COMAC[0] } },
      { name: '支出', type: 'bar', data: d.funding.byOrg.map((i) => i.spent), itemStyle: { color: COMAC[3] } },
    ],
  });

  const ft = d.funding.trend;
  renderChart('fundingLine', {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: { data: ['预算趋势', '支出趋势'], textStyle: baseText() },
    grid: { left: 48, right: 16, top: 32, bottom: 28 },
    xAxis: { type: 'category', data: ft.years.map(String), axisLabel: baseText() },
    yAxis: { type: 'value', axisLabel: baseText(), splitLine: { lineStyle: { color: 'rgba(148,163,184,0.1)' } } },
    series: [
      { name: '预算趋势', type: 'line', smooth: true, data: ft.budget, itemStyle: { color: COMAC[0] } },
      { name: '支出趋势', type: 'line', smooth: true, data: ft.spent, itemStyle: { color: COMAC[4] } },
    ],
  });

  renderChart('fieldPie', {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie', radius: ['38%', '62%'],
      data: d.funding.fieldPie.items.map((i, idx) => ({ name: i.name, value: i.value, itemStyle: { color: COMAC[idx % COMAC.length] } })),
      label: { color: '#cbd5e1', fontSize: 10 },
    }],
  });

  renderChart('phaseBar', {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie', radius: '62%',
      data: d.progress.phaseBar.map((i, idx) => ({ name: i.name, value: i.value, itemStyle: { color: COMAC[idx % COMAC.length] } })),
      label: { color: '#cbd5e1', fontSize: 10 },
    }],
  });

  renderChart('deliverableBar', {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    grid: { left: 48, right: 16, top: 16, bottom: 28 },
    xAxis: { type: 'category', data: d.deliverableOutput.byType.map((i) => i.name), axisLabel: baseText() },
    yAxis: { type: 'value', axisLabel: baseText(), splitLine: { lineStyle: { color: 'rgba(148,163,184,0.1)' } } },
    series: [{ type: 'bar', data: d.deliverableOutput.byType.map((i) => i.value), itemStyle: { color: COMAC[2], borderRadius: [4, 4, 0, 0] } }],
  });

  renderChart('outcomePie', {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie', radius: '62%',
      data: d.transformation.byStatus.map((i, idx) => ({ name: i.name, value: i.value, itemStyle: { color: COMAC[idx % COMAC.length] } })),
      label: { color: '#cbd5e1', fontSize: 10 },
    }],
  });

  renderChart('riskPie', {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    color: ['#ef4444', '#fbbf24', '#60a5fa', '#22c55e'],
    series: [{
      type: 'pie', radius: ['40%', '65%'],
      data: d.projectCount.byRisk.map((i) => ({ name: i.name, value: i.value })),
      label: { color: '#cbd5e1', fontSize: 11 },
    }],
  });
}

function onResize() {
  Object.values(charts).forEach((c) => c?.resize());
}

const spotlight = computed(() => board.value?.spotlight);

onMounted(() => {
  loadBoard();
  window.addEventListener('resize', onResize);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  Object.values(charts).forEach((c) => c?.dispose());
});
watch(filters, loadBoard, { deep: true });
</script>

<template>
  <div v-loading="loading" class="board-page">
    <div class="board-head">
      <div>
        <h2 class="page-title">可视化看板</h2>
        <p class="muted">{{ board?.note || '总部专属 · 基于台账底层数据自动运算渲染' }}</p>
      </div>
      <el-button size="small" @click="loadBoard">刷新</el-button>
    </div>

    <el-card shadow="never" class="filter-card">
      <el-form inline>
        <el-form-item label="年度">
          <el-select v-model="filters.year" clearable placeholder="全部" style="width:100px">
            <el-option v-for="y in board?.filters?.years || []" :key="y" :label="y" :value="String(y)" />
          </el-select>
        </el-form-item>
        <el-form-item label="承担单位">
          <el-select v-model="filters.org" clearable placeholder="全部" style="width:140px">
            <el-option v-for="o in board?.filters?.orgs || []" :key="o" :label="o" :value="o" />
          </el-select>
        </el-form-item>
        <el-form-item label="项目层级">
          <el-select v-model="filters.level" clearable placeholder="全部" style="width:110px">
            <el-option v-for="l in board?.filters?.levels || []" :key="l" :label="l" :value="l" />
          </el-select>
        </el-form-item>
        <el-form-item label="细分渠道">
          <el-select v-model="filters.channel" clearable placeholder="全部" style="width:160px">
            <el-option v-for="c in board?.filters?.channels || []" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="项目来源">
          <el-select v-model="filters.source" clearable placeholder="全部" style="width:140px">
            <el-option v-for="s in board?.filters?.sources || []" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 指标卡片 -->
    <div v-if="board" class="card-grid" style="margin:16px 0">
      <div class="stat-card clickable" @click="goLedger(filters)">
        <div class="muted">在管项目</div>
        <div class="num">{{ board.cards.total }}</div>
      </div>
      <div class="stat-card">
        <div class="muted">总经费(万)</div>
        <div class="num">{{ board.cards.budgetTotal }}</div>
      </div>
      <div class="stat-card">
        <div class="muted">执行率</div>
        <div class="num">{{ board.cards.execRate }}%</div>
      </div>
      <div class="stat-card clickable" @click="goLedger({ ...filters, risk: 'red' })">
        <div class="muted">红色预警</div>
        <div class="num" style="color:var(--red)">{{ board.cards.red }}</div>
      </div>
      <div class="stat-card clickable" @click="goLedger({ ...filters, risk: 'yellow' })">
        <div class="muted">黄色临期</div>
        <div class="num" style="color:var(--yellow)">{{ board.cards.yellow }}</div>
      </div>
      <div class="stat-card">
        <div class="muted">已转化成果</div>
        <div class="num" style="color:var(--green)">{{ board.cards.outcomeConverted }}</div>
      </div>
    </div>

    <!-- 样例项目 Spotlight（参照 V18 样例样式） -->
    <div v-if="spotlight" class="spotlight-card" @click="goProject(spotlight.id)">
      <div class="sp-deco" />
      <div class="sp-source">{{ spotlight.source }}</div>
      <h3 class="sp-title">{{ spotlight.name }}</h3>
      <div class="sp-meta">
        <div><span>项目时间</span>{{ spotlight.timeRange }}</div>
        <div><span>WBS</span>{{ spotlight.wbs }}</div>
        <div><span>参研单位</span>{{ spotlight.partners }}</div>
        <div><span>牵头单位</span>{{ spotlight.org }}</div>
        <div><span>项目负责人</span>{{ spotlight.owner }}</div>
        <div><span>技术专家</span>{{ spotlight.techOwner }}</div>
      </div>
      <div class="sp-goals">
        <div><strong>项目目标</strong>{{ spotlight.goal }}</div>
        <div><strong>年度目标</strong>{{ spotlight.yearGoal }}</div>
      </div>
      <div class="sp-body">
        <div class="sp-milestones">
          <div class="sp-section-title">年度里程碑计划</div>
          <div v-for="(m, i) in spotlight.milestones" :key="i" class="sp-milestone">
            <div class="sp-ms-head">
              <span>{{ m.title }}<template v-if="m.due"> ({{ m.due }})</template></span>
              <span class="risk-dot" :class="m.risk" />
            </div>
            <div class="sp-bar"><div class="sp-bar-fill" :style="{ width: m.progress + '%' }" :class="m.risk" /></div>
            <small>{{ m.status }}</small>
          </div>
        </div>
        <div class="sp-side">
          <div class="sp-section-title">交付物</div>
          <div class="sp-deliver-grid">
            <div v-for="d in spotlight.deliverables" :key="d.type" class="sp-deliver-item">
              <div class="sp-deliver-icon">{{ d.type.slice(0, 1) }}</div>
              <div>{{ d.type }}</div>
              <small>{{ d.label }}</small>
            </div>
          </div>
          <div class="sp-section-title" style="margin-top:12px">成果转化</div>
          <label class="sp-check"><input type="checkbox" :checked="spotlight.transformation.internal" disabled /> 对内转化</label>
          <label class="sp-check"><input type="checkbox" :checked="spotlight.transformation.external" disabled /> 对外转化</label>
        </div>
      </div>
      <div class="sp-budget">
        <span>年度预算共计 <strong>{{ spotlight.budgetYear }}</strong> 万元 · 已执行 <strong>{{ spotlight.budgetYearSpent }}</strong> 万元</span>
        <div class="sp-budget-bar"><div class="sp-budget-fill" :style="{ width: spotlight.budgetRate + '%' }">{{ spotlight.budgetRate }}%</div></div>
      </div>
      <p class="sp-hint">点击查看项目台账明细 →</p>
    </div>

    <!-- 六大维度 -->
    <el-row :gutter="16">
      <el-col :span="12">
        <el-card shadow="never" class="chart-card">
          <template #header>① 项目数量分布 · 按层级</template>
          <div ref="chartRefs.levelBar" class="chart-box" />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never" class="chart-card">
          <template #header>① 项目数量分布 · 按承担单位</template>
          <div ref="chartRefs.orgBar" class="chart-box" />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top:12px">
      <el-col :span="14">
        <el-card shadow="never" class="chart-card">
          <template #header>② 经费收支执行 · 单位对比</template>
          <div ref="chartRefs.fundingBar" class="chart-box" />
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card shadow="never" class="chart-card">
          <template #header>② 专业经费占比</template>
          <div ref="chartRefs.fieldPie" class="chart-box" />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top:12px">
      <el-col :span="12">
        <el-card shadow="never" class="chart-card">
          <template #header>② 经费趋势（折线）</template>
          <div ref="chartRefs.fundingLine" class="chart-box" />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never" class="chart-card">
          <template #header>③ 项目实施进度 · 阶段分布</template>
          <div ref="chartRefs.phaseBar" class="chart-box" />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top:12px">
      <el-col :span="10">
        <el-card shadow="never" class="chart-card">
          <template #header>④ 交付物产出</template>
          <div ref="chartRefs.deliverableBar" class="chart-box" />
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never" class="chart-card">
          <template #header>⑥ 成果转化状态</template>
          <div ref="chartRefs.outcomePie" class="chart-box" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="chart-card">
          <template #header>⑤ 四色预警分布</template>
          <div ref="chartRefs.riskPie" class="chart-box" />
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" style="margin-top:12px">
      <template #header>⑤ 项目风险预警榜单 <small class="muted">（里程碑30天临期 · 逾期高亮 · 点击跳转台账）</small></template>
      <el-table :data="board?.dimensions?.riskAlerts || []" stripe class="data-table" @row-click="(row) => goProject(row.projectId)">
        <el-table-column width="40">
          <template #default="{ row }"><span class="risk-dot" :class="row.level" /></template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="100" />
        <el-table-column prop="code" label="编号" width="120" />
        <el-table-column prop="name" label="项目" min-width="180" show-overflow-tooltip />
        <el-table-column prop="org" label="单位" width="100" />
        <el-table-column prop="detail" label="预警说明" min-width="200" />
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.board-head { display: flex; justify-content: space-between; align-items: flex-start; }
.filter-card { margin-bottom: 4px; }
.clickable { cursor: pointer; transition: border-color 0.2s; }
.clickable:hover { border-color: var(--accent); }
.chart-card { margin-bottom: 0; }
.chart-box { height: 260px; }

/* 样例 Spotlight · 浅色科技风 */
.spotlight-card {
  position: relative;
  margin: 16px 0 20px;
  padding: 20px 24px 16px;
  background: linear-gradient(180deg, #f8fbff 0%, #eef4fc 100%);
  border: 1px solid #c5d9f0;
  border-radius: 12px;
  color: #1e293b;
  cursor: pointer;
  overflow: hidden;
}
.sp-deco {
  position: absolute; top: 0; left: 0; right: 0; height: 4px;
  background: linear-gradient(90deg, #2359a7, #4a90c4, #2359a7);
}
.sp-source { font-size: 12px; color: #64748b; margin-bottom: 4px; }
.sp-title { margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #0f172a; text-align: center; }
.sp-meta {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 16px;
  font-size: 12px; padding: 12px 0; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;
}
.sp-meta span { color: #64748b; margin-right: 6px; }
.sp-goals {
  display: flex; gap: 24px; margin: 12px 0; padding: 10px 16px;
  background: linear-gradient(90deg, #2359a7, #1a6eb5); color: #fff; border-radius: 8px; font-size: 13px;
}
.sp-goals strong { margin-right: 8px; opacity: 0.9; }
.sp-body { display: grid; grid-template-columns: 1fr 220px; gap: 20px; margin-top: 12px; }
.sp-section-title { font-size: 13px; font-weight: 600; color: #2359a7; margin-bottom: 8px; }
.sp-milestone { margin-bottom: 12px; font-size: 12px; }
.sp-ms-head { display: flex; justify-content: space-between; margin-bottom: 4px; }
.sp-bar { height: 8px; background: #dbeafe; border-radius: 4px; overflow: hidden; }
.sp-bar-fill { height: 100%; border-radius: 4px; background: #2359a7; }
.sp-bar-fill.yellow { background: #f59e0b; }
.sp-bar-fill.green { background: #22c55e; }
.sp-bar-fill.red { background: #ef4444; }
.sp-deliver-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.sp-deliver-item {
  text-align: center; padding: 8px 4px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 11px;
}
.sp-deliver-icon {
  width: 28px; height: 28px; margin: 0 auto 4px; line-height: 28px;
  background: #2359a7; color: #fff; border-radius: 6px; font-size: 12px;
}
.sp-check { display: block; font-size: 12px; margin: 4px 0; color: #475569; }
.sp-budget { margin-top: 16px; font-size: 13px; color: #334155; }
.sp-budget-bar {
  height: 28px; margin-top: 8px; background: #dbeafe; border-radius: 6px; overflow: hidden; position: relative;
}
.sp-budget-fill {
  height: 100%; background: linear-gradient(90deg, #2359a7, #4a90c4);
  display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 600; font-size: 13px;
  min-width: 48px;
}
.sp-hint { text-align: center; font-size: 11px; color: #64748b; margin: 8px 0 0; }
</style>
