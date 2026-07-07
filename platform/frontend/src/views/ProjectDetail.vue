<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '../api';

const route = useRoute();
const router = useRouter();
const project = ref(null);

onMounted(async () => {
  const { data } = await api.get(`/projects/${route.params.id}`);
  project.value = data;
});

const phaseSteps = ['立项', '实施', '验收', '协作评价', '成果转化', '后评价'];
</script>

<template>
  <div v-if="project">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <el-button @click="router.back()">← 返回</el-button>
      <h2 class="page-title" style="margin:0">{{ project.name }}</h2>
      <span class="risk-dot" :class="project.risk" />
    </div>
    <p class="muted">{{ project.code }} · {{ project.level }} · {{ project.channelName }} · {{ project.org }}</p>

    <el-steps :active="phaseSteps.indexOf(project.phase)" finish-status="success" style="margin: 24px 0">
      <el-step v-for="s in phaseSteps" :key="s" :title="s" />
    </el-steps>

    <el-row :gutter="16">
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>项目所属信息</template>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="目标">{{ project.goal }}</el-descriptions-item>
            <el-descriptions-item label="周期">{{ project.startDate }} ~ {{ project.endDate }}</el-descriptions-item>
            <el-descriptions-item label="负责人">{{ project.owner }}</el-descriptions-item>
            <el-descriptions-item label="状态">{{ project.status }}</el-descriptions-item>
            <el-descriptions-item label="成果转化">{{ project.outcomeStatus }}</el-descriptions-item>
            <el-descriptions-item label="后评价">
              <span v-if="!project.over100M">不适用（未超1亿）</span>
              <span v-else>{{ project.postEvalStatus }}</span>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
        <el-card shadow="never" style="margin-top:12px">
          <template #header>科研经费 <small class="muted">（汇总观察口径，两套体系独立存储）</small></template>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="总经费">{{ project.budgetTotal }} 万</el-descriptions-item>
            <el-descriptions-item label="历年支出">{{ project.budgetSpent }} 万</el-descriptions-item>
            <el-descriptions-item label="年度预算">{{ project.budgetYear }} 万</el-descriptions-item>
            <el-descriptions-item label="年度支出">{{ project.budgetYearSpent }} 万</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>年度里程碑</template>
          <el-table :data="project.milestones" size="small">
            <el-table-column prop="title" label="节点" />
            <el-table-column prop="dueDate" label="到期" width="110" />
            <el-table-column width="40"><template #default="{ row }"><span class="risk-dot" :class="row.risk" /></template></el-table-column>
            <el-table-column prop="status" label="状态" width="80" />
          </el-table>
        </el-card>
        <el-card shadow="never" style="margin-top:12px">
          <template #header>协作单位评价</template>
          <el-table :data="project.partners" size="small">
            <el-table-column prop="name" label="单位" />
            <el-table-column prop="type" label="类型" width="70" />
            <el-table-column prop="score" label="得分" width="60" />
            <el-table-column prop="level" label="等级" width="70" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" style="margin-top:16px">
      <template #header>操作留痕 <small class="muted">（人与 AI 同轨）</small></template>
      <el-timeline>
        <el-timeline-item v-for="a in project.audits" :key="a.id" :timestamp="new Date(a.createdAt).toLocaleString()">
          {{ a.actor }} · {{ a.action }} — {{ a.detail }}
        </el-timeline-item>
        <el-timeline-item v-if="!project.audits?.length" timestamp="系统">暂无留痕记录</el-timeline-item>
      </el-timeline>
    </el-card>
  </div>
</template>
