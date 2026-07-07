<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '../api';

const router = useRouter();
const items = ref([]);
onMounted(async () => {
  const { data } = await api.get('/partners');
  items.value = data;
});
</script>

<template>
  <div>
    <h2 class="page-title">协作单位评价</h2>
    <p class="muted">验收后 30 日内完成评价 · 五维度量化评分 · 不合格纳入黑名单</p>
    <el-table :data="items" @row-click="(r) => router.push(`/projects/${r.projectId}`)">
      <el-table-column prop="name" label="协作单位" min-width="160" />
      <el-table-column prop="type" label="类型" width="80" />
      <el-table-column label="所属项目" min-width="180"><template #default="{ row }">{{ row.project?.name }}</template></el-table-column>
      <el-table-column prop="score" label="得分" width="70" />
      <el-table-column prop="level" label="等级" width="80" />
      <el-table-column prop="evalStatus" label="评价状态" width="90" />
      <el-table-column prop="postEval" label="后评价" width="80" />
      <el-table-column label="黑名单" width="80">
        <template #default="{ row }"><el-tag v-if="row.blacklisted" type="danger" size="small">是</el-tag><span v-else>—</span></template>
      </el-table-column>
    </el-table>
  </div>
</template>
