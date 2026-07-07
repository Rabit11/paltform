<script setup>
import { ref, onMounted } from 'vue';
import api from '../api';

const roles = ref([]);

onMounted(async () => {
  const { data } = await api.get('/meta/roles');
  roles.value = data;
});
</script>

<template>
  <div>
    <h2 class="page-title">角色定义</h2>
    <p class="muted">依据《科研项目信息化管理平台需求 V18》·（二）角色定义</p>
    <el-table :data="roles" stripe class="data-table" style="margin-top:16px">
      <el-table-column prop="label" label="角色" width="140" />
      <el-table-column prop="personnel" label="人员" width="200" show-overflow-tooltip />
      <el-table-column prop="duties" label="职责" min-width="280" show-overflow-tooltip />
      <el-table-column prop="permissions" label="权限" min-width="280" show-overflow-tooltip />
    </el-table>
  </div>
</template>
