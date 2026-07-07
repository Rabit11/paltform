<script setup>
import { ref, onMounted, watch } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../api';

const channels = ref([]);
const form = ref({ level: '', channelId: '', name: '', goal: '', budgetTotal: null, startDate: '', endDate: '' });
const materials = ref([]);

onMounted(async () => {
  const { data } = await api.get('/channels');
  channels.value = data;
});

watch(() => form.value.channelId, async (id) => {
  if (!id) { materials.value = []; return; }
  const { data } = await api.get(`/applications/channel-materials/${id}`);
  materials.value = data.materials;
});

const levelChannels = (level) => channels.value.filter((c) => c.level === level);

async function aiExtract() {
  const { data } = await api.post('/ai/extract', { text: '模拟上传材料' });
  Object.assign(form.value, data.extracted);
  ElMessage.success(data.note);
}

async function submit() {
  const ch = channels.value.find((c) => c.id === form.value.channelId);
  await api.post('/applications', {
    level: form.value.level,
    channelId: form.value.channelId,
    channelName: ch?.name,
    payload: form.value,
  });
  ElMessage.success('申报已提交，已推送单位/总部待办');
  form.value = { level: '', channelId: '', name: '', goal: '', budgetTotal: null, startDate: '', endDate: '' };
}
</script>

<template>
  <div>
    <h2 class="page-title">立项申报</h2>
    <p class="muted">层级→渠道联动材料清单 · AI 抽取一键回填 · 提交审签生成项目对象</p>
    <el-card shadow="never" style="max-width:720px">
      <el-form label-width="100px">
        <el-form-item label="项目层级">
          <el-select v-model="form.level" placeholder="选择层级" style="width:100%">
            <el-option label="国家级" value="国家级" /><el-option label="地方级" value="地方级" /><el-option label="公司级" value="公司级" />
          </el-select>
        </el-form-item>
        <el-form-item label="立项渠道">
          <el-select v-model="form.channelId" placeholder="选择渠道" style="width:100%" :disabled="!form.level">
            <el-option v-for="c in levelChannels(form.level)" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="materials.length" label="材料清单">
          <el-tag v-for="m in materials" :key="m" style="margin:2px">{{ m }}</el-tag>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" plain @click="aiExtract">AI 智能抽取</el-button>
        </el-form-item>
        <el-form-item label="项目名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="项目目标"><el-input v-model="form.goal" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="总经费(万)"><el-input-number v-model="form.budgetTotal" :min="0" /></el-form-item>
        <el-form-item label="开始日期"><el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" /></el-form-item>
        <el-form-item label="结束日期"><el-date-picker v-model="form.endDate" type="date" value-format="YYYY-MM-DD" /></el-form-item>
        <el-form-item>
          <el-button type="primary" :disabled="!form.channelId || !form.name" @click="submit">提交审签</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>
