<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import * as echarts from 'echarts';

const props = defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  items: { type: Array, default: () => [] },
  unit: { type: String, default: '万元' },
  valueLabel: { type: String, default: 'value' },
});

const COMAC_COLORS = [
  '#2359a7', '#11766f', '#1a6eb5', '#2d8f83', '#9a7026',
  '#4a90c4', '#0d4a8a', '#5ba897', '#c4973a', '#102c4a',
  '#3f7d56', '#34455f', '#708096', '#a84b45', '#5c8fd6',
];

const chartRef = ref(null);
let chart = null;

function render() {
  if (!chartRef.value) return;
  if (!chart) chart = echarts.init(chartRef.value);

  const data = props.items.map((item, i) => ({
    name: item.name,
    value: item.value,
    itemStyle: { color: COMAC_COLORS[i % COMAC_COLORS.length] },
  }));

  chart.setOption({
    backgroundColor: '#fbf7ee',
    color: COMAC_COLORS,
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(7,24,44,0.92)',
      borderColor: '#2359a7',
      textStyle: { color: '#f1eadf', fontSize: 12 },
      formatter: (p) => {
        const pct = p.percent?.toFixed(2) ?? 0;
        return `${p.name}<br/>${p.value}${props.unit === '人' ? '人' : ' ' + props.unit}（${pct}%）`;
      },
    },
    legend: { show: false },
    series: [{
      type: 'pie',
      radius: ['0%', '58%'],
      center: ['50%', '52%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderColor: '#fbf7ee',
        borderWidth: 2,
      },
      label: {
        show: true,
        position: 'outside',
        alignTo: 'edge',
        edgeDistance: 8,
        formatter: (p) => {
          const pct = p.percent?.toFixed(2) ?? 0;
          if (props.unit === '人') {
            return `{name|${p.name}}\n{val|${p.value}人 (${pct}%)}`;
          }
          return `{name|${p.name}}\n{val|${p.value}${props.unit} (${pct}%)}`;
        },
        rich: {
          name: { fontSize: 11, color: '#34455f', lineHeight: 16 },
          val: { fontSize: 10, color: '#708096', lineHeight: 14 },
        },
      },
      labelLine: {
        show: true,
        length: 12,
        length2: 10,
        lineStyle: { color: '#c8bfb0' },
      },
      emphasis: {
        scaleSize: 6,
        itemStyle: { shadowBlur: 12, shadowColor: 'rgba(35,89,167,0.35)' },
      },
      data,
    }],
  }, true);
}

function onResize() {
  chart?.resize();
}

watch(() => props.items, render, { deep: true });
onMounted(() => {
  render();
  window.addEventListener('resize', onResize);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  chart?.dispose();
});
</script>

<template>
  <div class="comac-chart-wrap">
    <div v-if="title" class="chart-head">
      <h4>{{ title }}</h4>
      <p v-if="subtitle" class="sub">{{ subtitle }}</p>
    </div>
    <div ref="chartRef" class="chart-box" />
  </div>
</template>

<style scoped>
.comac-chart-wrap {
  background: #fbf7ee;
  border-radius: 8px;
  padding: 12px 8px 4px;
  border: 1px solid rgba(35, 89, 167, 0.12);
}
.chart-head {
  padding: 0 12px 4px;
}
.chart-head h4 {
  margin: 0;
  font-size: 14px;
  color: #172235;
  font-weight: 600;
}
.chart-head .sub {
  margin: 4px 0 0;
  font-size: 11px;
  color: #708096;
}
.chart-box {
  width: 100%;
  height: 340px;
}
</style>
