<script setup>
import { computed } from 'vue';
import { classifyStepPhase, STEP_PHASE_COLORS, STEEL } from '../utils/flowUtils';

const props = defineProps({
  /** 带 status 的节点：{ index, name, phase?, status: done|current|pending } */
  nodes: { type: Array, default: () => [] },
  /** 或仅传 steps + currentStep */
  steps: { type: Array, default: () => [] },
  currentStep: { type: Number, default: 0 },
  compact: { type: Boolean, default: false },
  /** 各节点在管项目数（渠道总览用） */
  stepCounts: { type: Array, default: () => [] },
  horizontal: { type: Boolean, default: true },
});

const displayNodes = computed(() => {
  if (props.nodes?.length) return props.nodes;
  return (props.steps || []).map((name, index) => ({
    index,
    name,
    phase: classifyStepPhase(name),
    status: index < props.currentStep ? 'done' : index === props.currentStep ? 'current' : 'pending',
  }));
});

const progressPct = computed(() => {
  const n = displayNodes.value.length;
  if (!n) return 0;
  const cur = displayNodes.value.findIndex((x) => x.status === 'current');
  const idx = cur >= 0 ? cur : props.currentStep;
  return Math.round(((idx + 0.5) / n) * 100);
});

function phaseColor(phase) {
  return STEP_PHASE_COLORS[phase] || STEEL;
}
</script>

<template>
  <div class="flow-timeline" :class="{ compact, vertical: !horizontal }">
    <div v-if="!compact" class="flow-progress">
      <div class="flow-progress__track">
        <div class="flow-progress__fill" :style="{ width: progressPct + '%' }" />
      </div>
      <span class="flow-progress__label">流程进度 {{ progressPct }}%</span>
    </div>

    <div class="flow-track" role="list">
      <template v-for="(node, i) in displayNodes" :key="node.index ?? i">
        <div
          class="flow-node"
          :class="[`is-${node.status}`]"
          role="listitem"
        >
          <div class="flow-node__marker">
            <span class="flow-node__num">{{ (node.index ?? i) + 1 }}</span>
          </div>
          <div class="flow-node__body">
            <span class="flow-node__phase" :style="{ borderColor: phaseColor(node.phase) }">{{ node.phase }}</span>
            <span class="flow-node__name" :title="node.name">{{ node.name }}</span>
            <span v-if="stepCounts[i]" class="flow-node__count">{{ stepCounts[i] }} 项在管</span>
          </div>
        </div>
        <div v-if="i < displayNodes.length - 1" class="flow-connector" aria-hidden="true" />
      </template>
    </div>
  </div>
</template>

<style scoped>
.flow-timeline {
  --steel: #4682B4;
  --steel-light: #5a9bc9;
  --steel-muted: rgba(70, 130, 180, 0.15);
  --line: rgba(70, 130, 180, 0.22);
}

.flow-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.flow-progress__track {
  flex: 1;
  height: 4px;
  background: var(--steel-muted);
  border-radius: 2px;
  overflow: hidden;
}
.flow-progress__fill {
  height: 100%;
  background: var(--steel);
  border-radius: 2px;
}
.flow-progress__label {
  font-size: 11px;
  color: #94a3b8;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.flow-track {
  display: flex;
  align-items: flex-start;
  gap: 0;
  overflow-x: auto;
  padding-bottom: 4px;
}
.flow-timeline.vertical .flow-track {
  flex-direction: column;
  overflow-x: visible;
}
.flow-timeline.compact .flow-track {
  flex-wrap: wrap;
  gap: 4px;
}

.flow-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 88px;
  max-width: 120px;
  flex-shrink: 0;
}
.flow-timeline.compact .flow-node {
  min-width: 72px;
  max-width: 100px;
}

.flow-node__marker {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--line);
  background: #0c1220;
  margin-bottom: 4px;
}
.flow-node__num {
  font-size: 10px;
  font-weight: 700;
  color: #64748b;
  font-variant-numeric: tabular-nums;
}
.flow-node.is-done .flow-node__marker {
  border-color: var(--steel);
  background: rgba(70, 130, 180, 0.25);
}
.flow-node.is-done .flow-node__num { color: var(--steel-light); }
.flow-node.is-current .flow-node__marker {
  border-color: var(--steel);
  background: var(--steel);
  box-shadow: 0 0 0 2px rgba(70, 130, 180, 0.35);
}
.flow-node.is-current .flow-node__num { color: #fff; }

.flow-node__body {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 4px;
}
.flow-node__phase {
  font-size: 9px;
  color: #94a3b8;
  border-left: 2px solid var(--steel);
  padding-left: 4px;
  text-align: left;
  line-height: 14px;
}
.flow-node__name {
  font-size: 11px;
  color: #cbd5e1;
  line-height: 14px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.flow-node.is-current .flow-node__name {
  color: #f1f5f9;
  font-weight: 600;
}
.flow-node.is-pending .flow-node__name { color: #64748b; }
.flow-node__count {
  font-size: 9px;
  color: var(--steel-light);
  font-variant-numeric: tabular-nums;
}

.flow-connector {
  width: 16px;
  height: 2px;
  background: var(--line);
  margin-top: 12px;
  flex-shrink: 0;
}
.flow-node.is-done + .flow-connector,
.flow-connector:has(+ .flow-node.is-done),
.flow-connector:has(+ .flow-node.is-current) {
  background: var(--steel);
}
.flow-timeline.compact .flow-connector { display: none; }

.flow-timeline.vertical .flow-connector {
  width: 2px;
  height: 12px;
  margin: 0 auto;
}
</style>
