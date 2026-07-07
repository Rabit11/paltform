<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import api from '../api';
import ChannelFlowTimeline from '../components/ChannelFlowTimeline.vue';
import { STEEL } from '../utils/flowUtils';

const router = useRouter();
const channels = ref([]);
const activeLevel = ref('国家级');

const levels = ['国家级', '地方级', '公司级'];

const filtered = computed(() => channels.value.filter((c) => c.level === activeLevel.value));

const levelStats = computed(() => {
  const list = filtered.value;
  return {
    channels: list.length,
    projects: list.reduce((s, c) => s + (c.projectTotal || 0), 0),
    nodes: list.length ? Math.round(list.reduce((s, c) => s + (c.steps?.length || 0), 0) / list.length) : 0,
  };
});

onMounted(async () => {
  const { data } = await api.get('/channels');
  channels.value = data;
});

function goLedger(channelId) {
  router.push({ path: '/ledger', query: { channel: channelId } });
}

function goProject(id) {
  if (id) router.push(`/projects/${id}`);
}

function heatOpacity(count, max) {
  if (!max || !count) return 0.08;
  return 0.12 + (count / max) * 0.45;
}
</script>

<template>
  <div class="channel-flows-page">
    <header class="page-head">
      <div>
        <span class="page-head__badge">V18 规范流程</span>
        <h2 class="page-title">各渠道项目全周期管理流程</h2>
        <p class="muted page-head__note">
          不同级别项目对应不同管理流程 · 渠道为配置数据 · 流程节点自动映射至各在管项目
        </p>
      </div>
    </header>

    <section class="level-stats">
      <div class="stat-cell">
        <span class="stat-cell__label">{{ activeLevel }}渠道</span>
        <strong>{{ levelStats.channels }}</strong>
      </div>
      <div class="stat-cell">
        <span class="stat-cell__label">在管项目</span>
        <strong>{{ levelStats.projects }}</strong>
      </div>
      <div class="stat-cell">
        <span class="stat-cell__label">平均节点数</span>
        <strong>{{ levelStats.nodes }}</strong>
      </div>
    </section>

    <el-tabs v-model="activeLevel" class="level-tabs">
      <el-tab-pane v-for="lv in levels" :key="lv" :label="lv" :name="lv">
        <el-table
          :data="filtered"
          stripe
          class="data-table channel-table"
          row-key="id"
        >
          <el-table-column type="expand">
            <template #default="{ row }">
              <div class="expand-panel">
                <div class="expand-panel__head">
                  <span>规范流程 · {{ row.name }}</span>
                  <el-button size="small" link type="primary" @click.stop="goLedger(row.id)">
                    查看该渠道全部项目 →
                  </el-button>
                </div>
                <ChannelFlowTimeline
                  :steps="row.steps"
                  :current-step="-1"
                  :step-counts="row.stepCounts"
                />
                <div v-if="row.projectTotal" class="step-heatmap">
                  <div class="step-heatmap__title">在管项目节点分布</div>
                  <div class="step-heatmap__row">
                    <div
                      v-for="(step, i) in row.steps"
                      :key="i"
                      class="heat-cell"
                      :style="{
                        background: `rgba(70, 130, 180, ${heatOpacity(row.stepCounts?.[i], Math.max(...(row.stepCounts || [0]), 1))})`,
                        borderColor: STEEL,
                      }"
                    >
                      <span class="heat-cell__n">{{ row.stepCounts?.[i] || 0 }}</span>
                      <span class="heat-cell__t">{{ step }}</span>
                    </div>
                  </div>
                  <div class="step-projects">
                    <template v-for="(projs, i) in row.projectsByStep" :key="i">
                      <div v-if="projs?.length" class="step-project-group">
                        <span class="step-project-group__label">节点{{ i + 1 }} · {{ row.steps[i] }}</span>
                        <el-tag
                          v-for="p in projs"
                          :key="p.id"
                          size="small"
                          class="proj-tag"
                          @click.stop="goProject(p.id)"
                        >
                          <span class="risk-dot" :class="p.risk" style="margin-right:4px" />
                          {{ p.code }}
                        </el-tag>
                      </div>
                    </template>
                  </div>
                </div>
                <p v-else class="muted expand-empty">该渠道暂无在管项目</p>
              </div>
            </template>
          </el-table-column>

          <el-table-column prop="name" label="项目渠道" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="channel-name">{{ row.name }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="dept" label="渠道部门" width="120" />
          <el-table-column label="节点" width="64" align="center">
            <template #default="{ row }">{{ row.steps?.length || 0 }}</template>
          </el-table-column>
          <el-table-column label="在管" width="64" align="center">
            <template #default="{ row }">
              <span
                class="proj-count"
                :class="{ clickable: row.projectTotal }"
                @click.stop="row.projectTotal && goLedger(row.id)"
              >
                {{ row.projectTotal || 0 }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="平均进度" width="120">
            <template #default="{ row }">
              <div class="mini-progress">
                <div class="mini-progress__bar" :style="{ width: (row.avgProgress || 0) + '%' }" />
              </div>
              <span class="mini-progress__text">{{ row.avgProgress || 0 }}%</span>
            </template>
          </el-table-column>
          <el-table-column label="全周期管理流程（规范）" min-width="320">
            <template #default="{ row }">
              <ChannelFlowTimeline :steps="row.steps" :current-step="-1" compact horizontal />
            </template>
          </el-table-column>
        </el-table>
        <p class="table-hint muted">点击行展开查看节点分布及关联项目 · 点击项目编号进入详情</p>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.channel-flows-page {
  --steel: #4682B4;
  max-width: 1440px;
}
.page-head { margin-bottom: 8px; }
.page-head__badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  color: #5a9bc9;
  background: rgba(70, 130, 180, 0.12);
  border: 1px solid rgba(70, 130, 180, 0.28);
  border-radius: 4px;
  padding: 2px 8px;
  margin-bottom: 4px;
}
.page-head__note { margin: 4px 0 0; font-size: 12px; line-height: 16px; }

.level-stats {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.stat-cell {
  flex: 1;
  max-width: 160px;
  padding: 8px;
  background: #0c1220;
  border: 1px solid rgba(70, 130, 180, 0.18);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-cell__label { font-size: 11px; color: #64748b; }
.stat-cell strong { font-size: 18px; color: #f1f5f9; font-variant-numeric: tabular-nums; }

.level-tabs :deep(.el-tabs__item.is-active) { color: var(--steel); }
.level-tabs :deep(.el-tabs__active-bar) { background: var(--steel); }

.channel-table { cursor: pointer; }
.channel-table :deep(.el-table__cell) { padding: 8px !important; font-size: 12px; }
.channel-name { font-weight: 600; color: #e2e8f0; }

.proj-count { font-variant-numeric: tabular-nums; font-weight: 600; }
.proj-count.clickable { color: #5a9bc9; cursor: pointer; }

.mini-progress {
  height: 4px;
  background: rgba(70, 130, 180, 0.15);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 4px;
}
.mini-progress__bar { height: 100%; background: var(--steel); border-radius: 2px; }
.mini-progress__text { font-size: 10px; color: #94a3b8; }

.expand-panel {
  padding: 8px 16px 16px;
  background: rgba(12, 18, 32, 0.6);
  border-top: 1px solid rgba(70, 130, 180, 0.12);
}
.expand-panel__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #cbd5e1;
}
.expand-empty { font-size: 12px; margin: 8px 0; }

.step-heatmap { margin-top: 16px; }
.step-heatmap__title { font-size: 11px; color: #64748b; margin-bottom: 8px; }
.step-heatmap__row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 8px;
}
.heat-cell {
  min-width: 72px;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid rgba(70, 130, 180, 0.2);
  text-align: center;
  flex-shrink: 0;
}
.heat-cell__n { display: block; font-size: 16px; font-weight: 700; color: #f1f5f9; }
.heat-cell__t { display: block; font-size: 9px; color: #94a3b8; margin-top: 4px; line-height: 12px; }

.step-projects { margin-top: 8px; }
.step-project-group { margin-bottom: 8px; }
.step-project-group__label {
  display: block;
  font-size: 10px;
  color: #64748b;
  margin-bottom: 4px;
}
.proj-tag { margin: 0 4px 4px 0; cursor: pointer; }

.table-hint { font-size: 11px; margin-top: 8px; }
</style>
