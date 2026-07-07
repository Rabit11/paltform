<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../api';
import ChannelFlowTimeline from '../components/ChannelFlowTimeline.vue';
import { dashboardTitle, normalizeRole } from '../roles';

const router = useRouter();
const user = JSON.parse(localStorage.getItem('keyan_user') || '{}');
const loading = ref(false);
const inbox = ref({ items: [], pendingCount: 0, rules: {} });
const filter = ref('all');
const detail = ref(null);
const detailOpen = ref(false);
const comment = ref('');

const statusMap = {
  draft: { label: '草稿', type: 'info' },
  pending: { label: '审签中', type: 'warning' },
  rejected: { label: '已驳回', type: 'danger' },
  approved: { label: '已通过', type: 'success' },
  archived: { label: '已归档', type: 'success' },
};

const pageTitle = computed(() => {
  const role = normalizeRole(user.role);
  if (role === 'project_team') return '我的申报';
  if (role === 'finance') return '经费审签';
  return '审签中心';
});

const filtered = computed(() => {
  const list = inbox.value.items || [];
  if (filter.value === 'todo') return list.filter((i) => i.canApprove);
  if (filter.value === 'mine') return list.filter((i) => i.isMine);
  return list;
});

async function load() {
  loading.value = true;
  try {
    const { data } = await api.get('/approvals/inbox');
    inbox.value = data;
  } finally {
    loading.value = false;
  }
}

async function openDetail(row) {
  const { data } = await api.get(`/applications/${row.id}`);
  detail.value = data;
  comment.value = '';
  detailOpen.value = true;
}

async function doAction(action) {
  if (!detail.value) return;
  const id = detail.value.id;
  try {
    if (action === 'reject') {
      if (!comment.value.trim()) return ElMessage.warning('请填写驳回意见');
      await ElMessageBox.confirm('驳回后将退回填报节点，意见将留痕归档', '确认驳回', { type: 'warning' });
      await api.post(`/applications/${id}/reject`, { comment: comment.value });
      ElMessage.success('已驳回，退回填报人修改');
    } else if (action === 'approve') {
      await api.post(`/applications/${id}/approve`, { comment: comment.value });
      ElMessage.success('审签通过');
    } else if (action === 'revoke') {
      await ElMessageBox.confirm('撤销后回归草稿状态，记录永久留存', '确认撤销', { type: 'warning' });
      await api.post(`/applications/${id}/revoke`, { comment: comment.value });
      ElMessage.success('已撤销，回归草稿');
    } else if (action === 'submit') {
      await api.post(`/applications/${id}/submit`);
      ElMessage.success('已提交审签');
    }
    detailOpen.value = false;
    await load();
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '操作失败');
  }
}

function goApply() {
  router.push('/apply');
}

onMounted(load);
</script>

<template>
  <div class="approvals-page">
    <header class="page-head">
      <div>
        <span class="page-head__badge">V18 审签流程</span>
        <h2 class="page-title">{{ pageTitle }}</h2>
        <p class="muted">{{ dashboardTitle(user.role) }} · 分级审批 · 驳回留痕 · 撤销归档</p>
      </div>
      <div v-if="inbox.pendingCount" class="pending-badge">
        待我审签 <strong>{{ inbox.pendingCount }}</strong>
      </div>
    </header>

    <section v-if="inbox.rules" class="rules-bar">
      <span v-for="(text, key) in inbox.rules" :key="key" class="rule-chip">{{ text }}</span>
    </section>

    <div class="toolbar">
      <el-radio-group v-model="filter" size="small">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="todo">待我审签</el-radio-button>
        <el-radio-button value="mine">我的申报</el-radio-button>
      </el-radio-group>
      <el-button v-if="normalizeRole(user.role) === 'project_team'" type="primary" @click="goApply">新建申报</el-button>
    </div>

    <el-table v-loading="loading" :data="filtered" stripe class="data-table" @row-click="openDetail">
      <el-table-column label="项目" min-width="200">
        <template #default="{ row }">
          <strong>{{ row.name }}</strong>
          <div class="muted small">{{ row.projectCode || '—' }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="channelName" label="渠道" width="160" show-overflow-tooltip />
      <el-table-column prop="org" label="单位" width="110" />
      <el-table-column label="当前节点" min-width="160">
        <template #default="{ row }">{{ row.approval?.currentStepLabel || '—' }}</template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="statusMap[row.status]?.type || 'info'" size="small">
            {{ statusMap[row.status]?.label || row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100">
        <template #default="{ row }">
          <el-button v-if="row.canApprove" size="small" type="primary" @click.stop="openDetail(row)">审签</el-button>
          <el-button v-else size="small" link @click.stop="openDetail(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-drawer v-model="detailOpen" :title="detail?.payload?.name || '审签详情'" size="520px" direction="rtl">
      <template v-if="detail">
        <div class="detail-meta">
          <p><span class="label">渠道</span>{{ detail.channelName }}</p>
          <p><span class="label">编号</span>{{ detail.payload?.code || detail.projectCode || '—' }}</p>
          <p><span class="label">填报人</span>{{ detail.applicant }}</p>
          <p v-if="detail.rejectReason" class="reject-box">驳回意见：{{ detail.rejectReason }}</p>
        </div>

        <h4 class="section-title">审签流程</h4>
        <ChannelFlowTimeline
          :nodes="detail.approval?.nodes?.map((n) => ({ ...n, name: n.label }))"
          :current-step="detail.approval?.currentStep"
        />

        <h4 v-if="detail.records?.length" class="section-title">审批留痕</h4>
        <el-timeline v-if="detail.records?.length">
          <el-timeline-item
            v-for="r in detail.records"
            :key="r.id"
            :timestamp="new Date(r.createdAt).toLocaleString()"
            placement="top"
          >
            <strong>{{ r.stepName }}</strong> · {{ r.actorName }}
            <el-tag size="small" style="margin-left:6px">{{ r.action }}</el-tag>
            <p v-if="r.comment" class="muted small">{{ r.comment }}</p>
          </el-timeline-item>
        </el-timeline>

        <div v-if="detail.canApprove || detail.canRevoke || detail.canEdit" class="action-panel">
          <el-input
            v-if="detail.canApprove"
            v-model="comment"
            type="textarea"
            :rows="2"
            placeholder="审批意见（驳回必填）"
          />
          <div class="action-btns">
            <el-button v-if="detail.canApprove" type="primary" @click="doAction('approve')">通过</el-button>
            <el-button v-if="detail.canApprove" type="danger" plain @click="doAction('reject')">驳回</el-button>
            <el-button v-if="detail.canRevoke" @click="doAction('revoke')">撤销流程</el-button>
            <el-button v-if="detail.canEdit" type="primary" plain @click="goApply">修改后重提</el-button>
          </div>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.approvals-page { max-width: 1200px; }
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}
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
.pending-badge {
  padding: 8px 16px;
  background: rgba(70, 130, 180, 0.15);
  border: 1px solid rgba(70, 130, 180, 0.35);
  border-radius: 8px;
  font-size: 13px;
}
.pending-badge strong { font-size: 20px; color: var(--accent); margin-left: 4px; }
.rules-bar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.rule-chip {
  font-size: 11px;
  padding: 4px 8px;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--muted);
  line-height: 1.4;
  max-width: 280px;
}
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.small { font-size: 12px; }
.detail-meta p { margin: 6px 0; font-size: 13px; }
.detail-meta .label { display: inline-block; width: 64px; color: var(--muted); }
.reject-box { color: var(--red); background: rgba(220,38,38,0.08); padding: 8px; border-radius: 6px; }
.section-title { font-size: 13px; margin: 16px 0 8px; color: var(--accent); }
.action-panel { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--line); }
.action-btns { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
</style>
