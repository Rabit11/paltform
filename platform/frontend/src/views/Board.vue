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

/** 钢蓝 SteelBlue #4682B4 · 国资央企数据看板调色板 */
const STEEL = '#4682B4';
const PALETTE = ['#4682B4', '#5a9bc9', '#366892', '#6b8fa8', '#2d5678', '#7aa3c4', '#4a7088', '#8fb4d0'];
const CHART_AXIS = { color: '#64748b', fontSize: 10, fontFamily: '"Microsoft YaHei UI", sans-serif' };
const CHART_SPLIT = 'rgba(70, 130, 180, 0.1)';
const CHART_LABEL = { color: '#94a3b8', fontSize: 10 };

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
  return { ...CHART_AXIS };
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
  const tooltip = {
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderColor: 'rgba(70, 130, 180, 0.35)',
    textStyle: { color: '#e2e8f0', fontSize: 11 },
  };

  renderChart('levelBar', {
    backgroundColor: 'transparent',
    tooltip: { ...tooltip, trigger: 'axis' },
    grid: { left: 40, right: 12, top: 20, bottom: 24 },
    xAxis: { type: 'category', data: d.projectCount.byLevel.map((i) => i.name), axisLabel: baseText(), axisLine: { lineStyle: { color: CHART_SPLIT } } },
    yAxis: { type: 'value', axisLabel: baseText(), splitLine: { lineStyle: { color: CHART_SPLIT } } },
    series: [{ type: 'bar', data: d.projectCount.byLevel.map((i) => i.value), itemStyle: { color: PALETTE[0], borderRadius: [2, 2, 0, 0] }, barWidth: 20 }],
  });

  renderChart('orgBar', {
    backgroundColor: 'transparent',
    tooltip: { ...tooltip, trigger: 'axis' },
    grid: { left: 72, right: 12, top: 12, bottom: 20 },
    xAxis: { type: 'value', axisLabel: baseText(), splitLine: { lineStyle: { color: CHART_SPLIT } } },
    yAxis: { type: 'category', data: d.projectCount.byOrg.map((i) => i.name), axisLabel: { ...baseText(), width: 64, overflow: 'truncate' }, axisLine: { lineStyle: { color: CHART_SPLIT } } },
    series: [{ type: 'bar', data: d.projectCount.byOrg.map((i) => i.value), itemStyle: { color: PALETTE[1], borderRadius: [0, 2, 2, 0] }, barWidth: 12 }],
  });

  renderChart('fundingBar', {
    backgroundColor: 'transparent',
    tooltip: { ...tooltip, trigger: 'axis' },
    legend: { data: ['预算', '支出'], textStyle: CHART_LABEL, top: 0, itemWidth: 10, itemHeight: 10 },
    grid: { left: 44, right: 12, top: 28, bottom: 32 },
    xAxis: { type: 'category', data: d.funding.byOrg.map((i) => i.name), axisLabel: { ...baseText(), rotate: 18, fontSize: 9 }, axisLine: { lineStyle: { color: CHART_SPLIT } } },
    yAxis: { type: 'value', name: '万元', nameTextStyle: CHART_LABEL, axisLabel: baseText(), splitLine: { lineStyle: { color: CHART_SPLIT } } },
    series: [
      { name: '预算', type: 'bar', data: d.funding.byOrg.map((i) => i.total), itemStyle: { color: PALETTE[0], borderRadius: [2, 2, 0, 0] }, barGap: '24%', barWidth: 10 },
      { name: '支出', type: 'bar', data: d.funding.byOrg.map((i) => i.spent), itemStyle: { color: PALETTE[2], borderRadius: [2, 2, 0, 0] }, barWidth: 10 },
    ],
  });

  const ft = d.funding.trend;
  renderChart('fundingLine', {
    backgroundColor: 'transparent',
    tooltip: { ...tooltip, trigger: 'axis' },
    legend: { data: ['预算趋势', '支出趋势'], textStyle: CHART_LABEL, itemWidth: 10, itemHeight: 10 },
    grid: { left: 44, right: 12, top: 28, bottom: 24 },
    xAxis: { type: 'category', data: ft.years.map(String), axisLabel: baseText(), axisLine: { lineStyle: { color: CHART_SPLIT } } },
    yAxis: { type: 'value', axisLabel: baseText(), splitLine: { lineStyle: { color: CHART_SPLIT } } },
    series: [
      { name: '预算趋势', type: 'line', smooth: false, symbol: 'circle', symbolSize: 4, lineStyle: { width: 2 }, data: ft.budget, itemStyle: { color: PALETTE[0] } },
      { name: '支出趋势', type: 'line', smooth: false, symbol: 'circle', symbolSize: 4, lineStyle: { width: 2, type: 'dashed' }, data: ft.spent, itemStyle: { color: PALETTE[3] } },
    ],
  });

  renderChart('fieldPie', {
    backgroundColor: 'transparent',
    tooltip: { ...tooltip, trigger: 'item' },
    series: [{
      type: 'pie', radius: ['36%', '58%'], center: ['50%', '52%'],
      data: d.funding.fieldPie.items.map((i, idx) => ({ name: i.name, value: i.value, itemStyle: { color: PALETTE[idx % PALETTE.length] } })),
      label: { ...CHART_LABEL, formatter: '{b}\n{d}%' },
      labelLine: { lineStyle: { color: 'rgba(148,163,184,0.35)' } },
    }],
  });

  renderChart('phaseBar', {
    backgroundColor: 'transparent',
    tooltip: { ...tooltip, trigger: 'item' },
    series: [{
      type: 'pie', radius: ['0%', '58%'], center: ['50%', '52%'],
      data: d.progress.phaseBar.map((i, idx) => ({ name: i.name, value: i.value, itemStyle: { color: PALETTE[idx % PALETTE.length] } })),
      label: { ...CHART_LABEL, formatter: '{b} {c}' },
      labelLine: { lineStyle: { color: 'rgba(148,163,184,0.35)' } },
    }],
  });

  renderChart('deliverableBar', {
    backgroundColor: 'transparent',
    tooltip: { ...tooltip, trigger: 'axis' },
    grid: { left: 40, right: 12, top: 12, bottom: 24 },
    xAxis: { type: 'category', data: d.deliverableOutput.byType.map((i) => i.name), axisLabel: baseText(), axisLine: { lineStyle: { color: CHART_SPLIT } } },
    yAxis: { type: 'value', axisLabel: baseText(), splitLine: { lineStyle: { color: CHART_SPLIT } } },
    series: [{ type: 'bar', data: d.deliverableOutput.byType.map((i) => i.value), itemStyle: { color: PALETTE[0], borderRadius: [2, 2, 0, 0] }, barWidth: 18 }],
  });

  renderChart('outcomePie', {
    backgroundColor: 'transparent',
    tooltip: { ...tooltip, trigger: 'item' },
    series: [{
      type: 'pie', radius: ['36%', '58%'], center: ['50%', '52%'],
      data: d.transformation.byStatus.map((i, idx) => ({ name: i.name, value: i.value, itemStyle: { color: PALETTE[idx % PALETTE.length] } })),
      label: { ...CHART_LABEL, formatter: '{b}\n{c}' },
      labelLine: { lineStyle: { color: 'rgba(148,163,184,0.35)' } },
    }],
  });

  renderChart('riskPie', {
    backgroundColor: 'transparent',
    tooltip: { ...tooltip, trigger: 'item' },
    color: ['#dc2626', '#d97706', '#4682B4', '#16a34a'],
    series: [{
      type: 'pie', radius: ['38%', '60%'], center: ['50%', '52%'],
      data: d.projectCount.byRisk.map((i) => ({ name: i.name, value: i.value })),
      label: { ...CHART_LABEL, formatter: '{b} {c}' },
      labelLine: { lineStyle: { color: 'rgba(148,163,184,0.35)' } },
    }],
  });
}

function onResize() {
  Object.values(charts).forEach((c) => c?.resize());
}

const spotlight = computed(() => board.value?.spotlight);

const dimMeta = computed(() => {
  if (!board.value) return [];
  const c = board.value.cards;
  const d = board.value.dimensions;
  const ms = d.progress.milestoneStats || {};
  const del = d.deliverableOutput;
  const tr = d.transformation;
  return [
    {
      id: '01', title: '项目数量分布', desc: '层级 · 承担单位',
      kpis: [
        { label: '在管', value: c.total, accent: false },
        { label: '层级', value: d.projectCount.byLevel.length, accent: false },
        { label: '单位', value: d.projectCount.byOrg.length, accent: false },
      ],
    },
    {
      id: '02', title: '经费收支执行', desc: '预算 · 支出 · 专业占比',
      kpis: [
        { label: '总经费(万)', value: c.budgetTotal, accent: false },
        { label: '执行率', value: `${c.execRate}%`, accent: true },
        { label: '年度执行', value: `${c.yearExecRate}%`, accent: false },
      ],
    },
    {
      id: '03', title: '项目实施进度', desc: '阶段分布 · 里程碑',
      kpis: [
        { label: '里程碑', value: ms.total || 0, accent: false },
        { label: '已完成', value: ms.completed || 0, accent: true },
        { label: '临期', value: ms.upcoming || 0, accent: false },
      ],
    },
    {
      id: '04', title: '交付物产出', desc: '专利 · 标准 · 论文等',
      kpis: [
        { label: '合计', value: del.total, accent: false },
        { label: '已交付', value: del.delivered, accent: true },
        { label: '类型', value: del.byType.filter((x) => x.value > 0).length, accent: false },
      ],
    },
    {
      id: '05', title: '项目风险预警', desc: '四色分布 · 预警榜单',
      kpis: [
        { label: '红色', value: c.red, accent: false, risk: 'red' },
        { label: '黄色', value: c.yellow, accent: false, risk: 'yellow' },
        { label: '预警条', value: d.riskAlerts.length, accent: false },
      ],
    },
    {
      id: '06', title: '成果转化', desc: '转化状态 · 应用情况',
      kpis: [
        { label: '已转化', value: c.outcomeConverted, accent: true },
        { label: '成果项', value: tr.total || tr.byStatus.reduce((s, i) => s + i.value, 0), accent: false },
        { label: '状态', value: tr.byStatus.length, accent: false },
      ],
    },
  ];
});

const kpiStrip = computed(() => {
  if (!board.value) return [];
  const c = board.value.cards;
  return [
    { label: '在管项目', value: c.total, click: () => goLedger(filters.value) },
    { label: '总经费(万)', value: c.budgetTotal },
    { label: '执行率', value: `${c.execRate}%` },
    { label: '红色预警', value: c.red, tone: 'red', click: () => goLedger({ ...filters.value, risk: 'red' }) },
    { label: '黄色临期', value: c.yellow, tone: 'yellow', click: () => goLedger({ ...filters.value, risk: 'yellow' }) },
    { label: '已转化成果', value: c.outcomeConverted, tone: 'green' },
  ];
});

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
    <!-- 页头 -->
    <header class="board-head">
      <div class="board-head__main">
        <div class="board-head__badge">总部看板</div>
        <h2 class="page-title">可视化看板</h2>
        <p class="board-head__note">{{ board?.note || '基于台账底层数据自动运算 · 六大维度实时渲染' }}</p>
      </div>
      <div class="board-head__actions">
        <span v-if="board" class="board-head__ts">共 {{ board.cards.total }} 项在管</span>
        <el-button size="small" type="primary" plain @click="loadBoard">刷新数据</el-button>
      </div>
    </header>

    <!-- 紧凑筛选 -->
    <section class="filter-bar">
      <el-form inline class="filter-form">
        <el-form-item label="年度">
          <el-select v-model="filters.year" clearable placeholder="全部" style="width:88px">
            <el-option v-for="y in board?.filters?.years || []" :key="y" :label="y" :value="String(y)" />
          </el-select>
        </el-form-item>
        <el-form-item label="承担单位">
          <el-select v-model="filters.org" clearable placeholder="全部" style="width:120px">
            <el-option v-for="o in board?.filters?.orgs || []" :key="o" :label="o" :value="o" />
          </el-select>
        </el-form-item>
        <el-form-item label="层级">
          <el-select v-model="filters.level" clearable placeholder="全部" style="width:96px">
            <el-option v-for="l in board?.filters?.levels || []" :key="l" :label="l" :value="l" />
          </el-select>
        </el-form-item>
        <el-form-item label="渠道">
          <el-select v-model="filters.channel" clearable placeholder="全部" style="width:140px">
            <el-option v-for="c in board?.filters?.channels || []" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="来源">
          <el-select v-model="filters.source" clearable placeholder="全部" style="width:120px">
            <el-option v-for="s in board?.filters?.sources || []" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
      </el-form>
    </section>

    <!-- KPI 条 -->
    <section v-if="board" class="kpi-strip">
      <div
        v-for="(k, i) in kpiStrip"
        :key="i"
        class="kpi-cell"
        :class="{ clickable: k.click, [`tone-${k.tone}`]: k.tone }"
        @click="k.click?.()"
      >
        <span class="kpi-cell__label">{{ k.label }}</span>
        <span class="kpi-cell__value">{{ k.value }}</span>
      </div>
    </section>

    <!-- 样例 Spotlight -->
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
    <div v-if="board" class="dim-section-head">
      <h3>六大分析维度</h3>
      <span>点击图表可下钻至项目台账</span>
    </div>

    <section v-if="board" class="dim-grid">
      <!-- 01 项目数量 -->
      <article class="dim-panel dim-panel--span2">
        <header class="dim-head">
          <div class="dim-head__left">
            <span class="dim-id">{{ dimMeta[0].id }}</span>
            <div>
              <h4>{{ dimMeta[0].title }}</h4>
              <p>{{ dimMeta[0].desc }}</p>
            </div>
          </div>
          <div class="dim-kpis">
            <div v-for="k in dimMeta[0].kpis" :key="k.label" class="dim-kpi">
              <span>{{ k.label }}</span><strong>{{ k.value }}</strong>
            </div>
          </div>
        </header>
        <div class="dim-body dim-body--2">
          <div class="dim-chart-wrap">
            <div class="dim-chart-label">按层级</div>
            <div ref="chartRefs.levelBar" class="chart-box" />
          </div>
          <div class="dim-chart-wrap">
            <div class="dim-chart-label">按承担单位 TOP10</div>
            <div ref="chartRefs.orgBar" class="chart-box chart-box--tall" />
          </div>
        </div>
      </article>

      <!-- 02 经费 -->
      <article class="dim-panel dim-panel--span2">
        <header class="dim-head">
          <div class="dim-head__left">
            <span class="dim-id">{{ dimMeta[1].id }}</span>
            <div>
              <h4>{{ dimMeta[1].title }}</h4>
              <p>{{ dimMeta[1].desc }}</p>
            </div>
          </div>
          <div class="dim-kpis">
            <div v-for="k in dimMeta[1].kpis" :key="k.label" class="dim-kpi" :class="{ accent: k.accent }">
              <span>{{ k.label }}</span><strong>{{ k.value }}</strong>
            </div>
          </div>
        </header>
        <div class="dim-body dim-body--3">
          <div class="dim-chart-wrap dim-chart-wrap--wide">
            <div class="dim-chart-label">单位预算 vs 支出</div>
            <div ref="chartRefs.fundingBar" class="chart-box" />
          </div>
          <div class="dim-chart-wrap">
            <div class="dim-chart-label">专业经费占比</div>
            <div ref="chartRefs.fieldPie" class="chart-box" />
          </div>
          <div class="dim-chart-wrap">
            <div class="dim-chart-label">历年趋势</div>
            <div ref="chartRefs.fundingLine" class="chart-box" />
          </div>
        </div>
      </article>

      <!-- 03 进度 -->
      <article class="dim-panel">
        <header class="dim-head">
          <div class="dim-head__left">
            <span class="dim-id">{{ dimMeta[2].id }}</span>
            <div>
              <h4>{{ dimMeta[2].title }}</h4>
              <p>{{ dimMeta[2].desc }}</p>
            </div>
          </div>
          <div class="dim-kpis">
            <div v-for="k in dimMeta[2].kpis" :key="k.label" class="dim-kpi" :class="{ accent: k.accent }">
              <span>{{ k.label }}</span><strong>{{ k.value }}</strong>
            </div>
          </div>
        </header>
        <div class="dim-body">
          <div class="dim-chart-wrap">
            <div class="dim-chart-label">阶段分布</div>
            <div ref="chartRefs.phaseBar" class="chart-box" />
          </div>
        </div>
      </article>

      <!-- 04 交付物 -->
      <article class="dim-panel">
        <header class="dim-head">
          <div class="dim-head__left">
            <span class="dim-id">{{ dimMeta[3].id }}</span>
            <div>
              <h4>{{ dimMeta[3].title }}</h4>
              <p>{{ dimMeta[3].desc }}</p>
            </div>
          </div>
          <div class="dim-kpis">
            <div v-for="k in dimMeta[3].kpis" :key="k.label" class="dim-kpi" :class="{ accent: k.accent }">
              <span>{{ k.label }}</span><strong>{{ k.value }}</strong>
            </div>
          </div>
        </header>
        <div class="dim-body">
          <div class="dim-chart-wrap">
            <div class="dim-chart-label">按类型统计</div>
            <div ref="chartRefs.deliverableBar" class="chart-box" />
          </div>
        </div>
      </article>

      <!-- 05 风险 -->
      <article class="dim-panel dim-panel--risk">
        <header class="dim-head">
          <div class="dim-head__left">
            <span class="dim-id">{{ dimMeta[4].id }}</span>
            <div>
              <h4>{{ dimMeta[4].title }}</h4>
              <p>{{ dimMeta[4].desc }}</p>
            </div>
          </div>
          <div class="dim-kpis">
            <div v-for="k in dimMeta[4].kpis" :key="k.label" class="dim-kpi" :class="k.risk ? `risk-${k.risk}` : ''">
              <span>{{ k.label }}</span><strong>{{ k.value }}</strong>
            </div>
          </div>
        </header>
        <div class="dim-body dim-body--risk">
          <div class="dim-chart-wrap dim-chart-wrap--compact">
            <div class="dim-chart-label">四色分布</div>
            <div ref="chartRefs.riskPie" class="chart-box chart-box--sm" />
          </div>
          <div class="dim-table-wrap">
            <div class="dim-chart-label">预警榜单 <small>里程碑30天临期 · 点击跳转</small></div>
            <el-table
              :data="board.dimensions.riskAlerts"
              stripe
              class="data-table dim-table"
              size="small"
              max-height="200"
              @row-click="(row) => goProject(row.projectId)"
            >
              <el-table-column width="28">
                <template #default="{ row }"><span class="risk-dot" :class="row.level" /></template>
              </el-table-column>
              <el-table-column prop="type" label="类型" width="72" />
              <el-table-column prop="code" label="编号" width="88" show-overflow-tooltip />
              <el-table-column prop="name" label="项目" min-width="100" show-overflow-tooltip />
              <el-table-column prop="detail" label="说明" min-width="120" show-overflow-tooltip />
            </el-table>
          </div>
        </div>
      </article>

      <!-- 06 成果转化 -->
      <article class="dim-panel">
        <header class="dim-head">
          <div class="dim-head__left">
            <span class="dim-id">{{ dimMeta[5].id }}</span>
            <div>
              <h4>{{ dimMeta[5].title }}</h4>
              <p>{{ dimMeta[5].desc }}</p>
            </div>
          </div>
          <div class="dim-kpis">
            <div v-for="k in dimMeta[5].kpis" :key="k.label" class="dim-kpi" :class="{ accent: k.accent }">
              <span>{{ k.label }}</span><strong>{{ k.value }}</strong>
            </div>
          </div>
        </header>
        <div class="dim-body">
          <div class="dim-chart-wrap">
            <div class="dim-chart-label">转化状态</div>
            <div ref="chartRefs.outcomePie" class="chart-box" />
          </div>
        </div>
      </article>
    </section>
  </div>
</template>

<style scoped>
/* 钢蓝 #4682B4 · 8px 网格 · 国资央企数据看板 */
.board-page {
  --steel: #4682B4;
  --steel-light: #5a9bc9;
  --steel-dark: #366892;
  --steel-muted: rgba(70, 130, 180, 0.14);
  --dim-bg: #0c1220;
  --dim-border: rgba(70, 130, 180, 0.18);
  --dim-accent: var(--steel);
  --dim-muted: #64748b;
  --dim-text: #cbd5e1;
  max-width: 1440px;
}

.board-page :deep(.el-button--primary.is-plain) {
  --el-button-text-color: var(--steel-light);
  --el-button-border-color: rgba(70, 130, 180, 0.45);
  --el-button-hover-text-color: #fff;
  --el-button-hover-bg-color: var(--steel);
  --el-button-hover-border-color: var(--steel);
}

/* 页头 */
.board-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
  gap: 16px;
}
.board-head__badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--steel-light);
  background: rgba(70, 130, 180, 0.12);
  border: 1px solid rgba(70, 130, 180, 0.28);
  border-radius: 4px;
  padding: 2px 8px;
  margin-bottom: 4px;
}
.page-title { font-size: 18px; font-weight: 600; margin: 0; color: #f1f5f9; }
.board-head__note { margin: 4px 0 0; font-size: 12px; color: var(--dim-muted); line-height: 16px; }
.board-head__actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.board-head__ts { font-size: 11px; color: var(--dim-muted); font-variant-numeric: tabular-nums; }

/* 筛选条 */
.filter-bar {
  background: var(--dim-bg);
  border: 1px solid var(--dim-border);
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 8px;
}
.filter-form :deep(.el-form-item) { margin-bottom: 0; margin-right: 8px; }
.filter-form :deep(.el-form-item__label) { font-size: 12px; color: var(--dim-muted); padding-right: 8px; line-height: 32px; }

/* KPI 条 · 6 列 8px 网格 */
.kpi-strip {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  margin-bottom: 8px;
}
.kpi-cell {
  background: var(--dim-bg);
  border: 1px solid var(--dim-border);
  border-radius: 4px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.kpi-cell.clickable { cursor: pointer; }
.kpi-cell.clickable:hover { border-color: var(--steel); background: rgba(70, 130, 180, 0.08); }
.kpi-cell__label { font-size: 11px; color: var(--dim-muted); line-height: 16px; }
.kpi-cell__value { font-size: 20px; font-weight: 700; color: #f1f5f9; font-variant-numeric: tabular-nums; line-height: 24px; }
.kpi-cell.tone-red .kpi-cell__value { color: #f87171; }
.kpi-cell.tone-yellow .kpi-cell__value { color: #fbbf24; }
.kpi-cell.tone-green .kpi-cell__value { color: #4ade80; }

/* 六大维度 */
.dim-section-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 16px 0 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--dim-border);
}
.dim-section-head h3 { margin: 0; font-size: 13px; font-weight: 600; color: #e2e8f0; }
.dim-section-head span { font-size: 11px; color: var(--dim-muted); }

.dim-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.dim-panel {
  background: var(--dim-bg);
  border: 1px solid var(--dim-border);
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.dim-panel--span2 { grid-column: span 2; }
.dim-panel--risk { grid-column: span 2; }

.dim-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px;
  border-bottom: 1px solid rgba(70, 130, 180, 0.1);
  background: rgba(70, 130, 180, 0.06);
  border-left: 3px solid var(--steel);
}
.dim-head__left { display: flex; align-items: center; gap: 8px; min-width: 0; }
.dim-id {
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--steel-light);
  background: rgba(70, 130, 180, 0.14);
  border-radius: 4px;
  padding: 4px 8px;
  flex-shrink: 0;
  font-family: ui-monospace, Consolas, monospace;
}
.dim-head h4 { margin: 0; font-size: 13px; font-weight: 600; color: #f1f5f9; line-height: 16px; }
.dim-head p { margin: 2px 0 0; font-size: 11px; color: var(--dim-muted); line-height: 16px; }

.dim-kpis { display: flex; gap: 8px; flex-shrink: 0; }
.dim-kpi {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  padding: 4px 8px;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(70, 130, 180, 0.12);
  border-radius: 4px;
  min-width: 48px;
}
.dim-kpi span { font-size: 10px; color: var(--dim-muted); white-space: nowrap; line-height: 16px; }
.dim-kpi strong { font-size: 14px; font-weight: 700; color: #e2e8f0; font-variant-numeric: tabular-nums; line-height: 16px; }
.dim-kpi.accent strong { color: var(--steel-light); }
.dim-kpi.risk-red strong { color: #f87171; }
.dim-kpi.risk-yellow strong { color: #fbbf24; }

.dim-body { padding: 8px; flex: 1; }
.dim-body--2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.dim-body--3 { display: grid; grid-template-columns: 1.4fr 0.8fr 1fr; gap: 8px; }
.dim-body--risk { display: grid; grid-template-columns: 192px 1fr; gap: 8px; align-items: start; }

.dim-chart-wrap {
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid rgba(70, 130, 180, 0.1);
  border-radius: 4px;
  padding: 8px;
  min-height: 0;
}
.dim-chart-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--dim-muted);
  letter-spacing: 0.03em;
  margin-bottom: 4px;
  line-height: 16px;
}
.dim-chart-label small { font-weight: 400; margin-left: 8px; opacity: 0.85; }

.chart-box { height: 192px; }
.chart-box--tall { height: 208px; }
.chart-box--sm { height: 176px; }

.dim-table-wrap {
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid rgba(70, 130, 180, 0.1);
  border-radius: 4px;
  padding: 8px;
  min-width: 0;
}
.dim-table { cursor: pointer; }
.dim-table :deep(.el-table__cell) {
  padding: 4px 8px !important;
  font-size: 11px !important;
  line-height: 16px !important;
}
.dim-table :deep(.el-table__header .el-table__cell) {
  padding: 8px !important;
  font-size: 11px !important;
}

/* Spotlight · 钢蓝稳重风，无渐变动效 */
.spotlight-card {
  position: relative;
  margin: 8px 0;
  padding: 16px;
  background: #0c1220;
  border: 1px solid var(--dim-border);
  border-radius: 4px;
  color: #e2e8f0;
  cursor: pointer;
  overflow: hidden;
}
.sp-deco {
  position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: var(--steel);
}
.sp-source { font-size: 11px; color: #64748b; margin-bottom: 4px; line-height: 16px; }
.sp-title { margin: 0 0 8px; font-size: 18px; font-weight: 700; color: #f1f5f9; text-align: center; line-height: 24px; }
.sp-meta {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
  font-size: 11px; padding: 8px 0; border-top: 1px solid rgba(70,130,180,0.15); border-bottom: 1px solid rgba(70,130,180,0.15);
  line-height: 16px;
}
.sp-meta span { color: #64748b; margin-right: 4px; }
.sp-goals {
  display: flex; gap: 16px; margin: 8px 0; padding: 8px;
  background: rgba(70, 130, 180, 0.12);
  border: 1px solid rgba(70, 130, 180, 0.22);
  border-radius: 4px; font-size: 12px; line-height: 16px;
}
.sp-goals strong { margin-right: 8px; color: var(--steel-light); }
.sp-body { display: grid; grid-template-columns: 1fr 192px; gap: 16px; margin-top: 8px; }
.sp-section-title { font-size: 12px; font-weight: 600; color: var(--steel-light); margin-bottom: 8px; line-height: 16px; }
.sp-milestone { margin-bottom: 8px; font-size: 11px; line-height: 16px; }
.sp-ms-head { display: flex; justify-content: space-between; margin-bottom: 4px; }
.sp-bar { height: 8px; background: rgba(70,130,180,0.15); border-radius: 2px; overflow: hidden; }
.sp-bar-fill { height: 100%; border-radius: 2px; background: var(--steel); }
.sp-bar-fill.yellow { background: #d97706; }
.sp-bar-fill.green { background: #16a34a; }
.sp-bar-fill.red { background: #dc2626; }
.sp-deliver-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.sp-deliver-item {
  text-align: center; padding: 8px 4px; background: rgba(15,23,42,0.5);
  border: 1px solid rgba(70,130,180,0.12); border-radius: 4px; font-size: 10px; line-height: 16px;
}
.sp-deliver-icon {
  width: 24px; height: 24px; margin: 0 auto 4px; line-height: 24px;
  background: var(--steel); color: #fff; border-radius: 4px; font-size: 11px;
}
.sp-check { display: block; font-size: 11px; margin: 4px 0; color: #94a3b8; line-height: 16px; }
.sp-budget { margin-top: 8px; font-size: 12px; color: #94a3b8; line-height: 16px; }
.sp-budget-bar { height: 24px; margin-top: 8px; background: rgba(70,130,180,0.15); border-radius: 4px; overflow: hidden; }
.sp-budget-fill {
  height: 100%; background: var(--steel);
  display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 600; font-size: 12px; min-width: 40px;
}
.sp-hint { text-align: center; font-size: 10px; color: #64748b; margin: 8px 0 0; line-height: 16px; }

@media (max-width: 1200px) {
  .kpi-strip { grid-template-columns: repeat(3, 1fr); }
  .dim-grid { grid-template-columns: 1fr; }
  .dim-panel--span2, .dim-panel--risk { grid-column: span 1; }
  .dim-body--3 { grid-template-columns: 1fr; }
  .dim-body--risk { grid-template-columns: 1fr; }
}
</style>
