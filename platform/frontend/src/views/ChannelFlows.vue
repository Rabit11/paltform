<script setup>
import { ref, onMounted, computed } from 'vue';
import api from '../api';

const channels = ref([]);
const activeLevel = ref('国家级');

const levels = ['国家级', '地方级', '公司级'];

const filtered = computed(() => channels.value.filter((c) => c.level === activeLevel.value));

onMounted(async () => {
  const { data } = await api.get('/channels');
  channels.value = data;
});
</script>

<template>
  <div>
    <h2 class="page-title">各渠道项目全周期管理流程</h2>
    <p class="muted">需求 V18 ·（三）各渠道项目全周期管理流程 · 渠道作为配置数据，超级管理员可维护</p>

    <el-tabs v-model="activeLevel" style="margin-top:16px">
      <el-tab-pane v-for="lv in levels" :key="lv" :label="lv" :name="lv">
        <el-table :data="filtered" stripe class="data-table">
          <el-table-column prop="name" label="项目渠道" width="280" show-overflow-tooltip />
          <el-table-column prop="dept" label="渠道部门" width="140" />
          <el-table-column label="流程节点数" width="100">
            <template #default="{ row }">{{ row.steps?.length || 0 }}</template>
          </el-table-column>
          <el-table-column label="全周期管理流程">
            <template #default="{ row }">
              <div class="flow-steps">
                <template v-for="(step, i) in row.steps" :key="i">
                  <span class="step">{{ step }}</span>
                  <span v-if="i < row.steps.length - 1" class="arrow">→</span>
                </template>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.flow-steps {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  line-height: 1.8;
  font-size: 13px;
}
.step {
  background: rgba(35, 89, 167, 0.15);
  color: #93c5fd;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid rgba(35, 89, 167, 0.25);
}
.arrow {
  color: #708096;
  font-size: 12px;
}
</style>
