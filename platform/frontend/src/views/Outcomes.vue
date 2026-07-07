<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '../api';

const router = useRouter();
const items = ref([]);
onMounted(async () => {
  const { data } = await api.get('/outcomes');
  items.value = data;
});
</script>

<template>
  <div>
    <h2 class="page-title">成果转化台账</h2>
    <p class="muted">承接验收交付物，支持单项/打包转化，数据同步至项目台账与看板</p>
    <el-table :data="items" @row-click="(r) => router.push(`/projects/${r.projectId}`)">
      <el-table-column prop="code" label="成果编号" width="130" />
      <el-table-column prop="name" label="成果名称" min-width="200" />
      <el-table-column label="所属项目" min-width="180"><template #default="{ row }">{{ row.project?.name }}</template></el-table-column>
      <el-table-column prop="method" label="转化方式" width="100" />
      <el-table-column prop="form" label="转化形式" width="100" />
      <el-table-column prop="status" label="状态" width="120" />
      <el-table-column prop="planDate" label="计划转化" width="110" />
      <el-table-column prop="actualDate" label="实际转化" width="110" />
    </el-table>
  </div>
</template>
