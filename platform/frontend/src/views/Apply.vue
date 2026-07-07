<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import api from '../api';
import {
  emptyProjectForm,
  PROJECT_INFO_ROWS,
  TEAM_SECTIONS,
  FUNDING_ROWS,
  ANNUAL_PLAN_COLS,
  DELIVERABLE_COLS,
  PARTNER_COLS,
  OUTCOME_COLS,
  LEVEL_OPTIONS,
  OUTCOME_FORMS_PRODUCT,
  OUTCOME_FORMS_MARKET,
  calcPartnerLevel,
  calcPlanRisk,
  riskLabel,
} from '../projectFormFields.js';

const router = useRouter();
const channels = ref([]);
const form = ref(emptyProjectForm());
const materials = ref([]);
const channelSteps = ref([]);
const activeTab = ref('info');
const submitMode = ref('apply');
const showGuide = ref(true);
const folderInput = ref(null);
const uploadingFolder = ref(false);
const user = JSON.parse(localStorage.getItem('keyan_user') || '{}');

const levelChannels = (level) => channels.value.filter((c) => c.level === level);

onMounted(async () => {
  const [{ data: ch }, { data: codeRes }] = await Promise.all([
    api.get('/channels'),
    api.get('/projects/next-code'),
  ]);
  channels.value = ch;
  form.value.code = codeRes.code;
  if (user.org) form.value.org = user.org;
  if (user.name) form.value.owner = `${user.name} / `;
  syncOutcomeMeta();
});

watch(() => form.value.channelId, async (id) => {
  if (!id) {
    materials.value = [];
    channelSteps.value = [];
    form.value.initDept = '';
    form.value.channelName = '';
    return;
  }
  const ch = channels.value.find((c) => c.id === id);
  form.value.level = ch?.level || form.value.level;
  form.value.initDept = ch?.dept || '';
  form.value.channelName = ch?.name || '';
  channelSteps.value = ch?.steps || [];
  const { data } = await api.get(`/applications/channel-materials/${id}`);
  materials.value = data.materials;
});

watch(
  () => form.value.partners.map((p) => p.score),
  () => {
    form.value.partners.forEach((p) => {
      p.level = calcPartnerLevel(p.score);
    });
  },
  { deep: true },
);

watch(
  () => form.value.annualPlans.map((p) => [p.dueDate, p.completion]),
  () => {
    form.value.annualPlans.forEach((p) => {
      p.planStatus = riskLabel(calcPlanRisk(p.dueDate, p.completion));
    });
  },
  { deep: true },
);

watch(() => form.value.code, syncOutcomeMeta);
watch(() => form.value.deliverables, syncOutcomeDeliverableCounts, { deep: true });

function syncOutcomeMeta() {
  form.value.outcomes.forEach((o) => {
    o.projectCode = form.value.code;
  });
}

function syncOutcomeDeliverableCounts() {
  const counts = {};
  form.value.deliverables.forEach((d) => {
    if (d.outcomeCode) counts[d.outcomeCode] = (counts[d.outcomeCode] || 0) + 1;
  });
  form.value.outcomes.forEach((o) => {
    o.deliverableCount = counts[o.code] || 0;
  });
}

function addRow(key) {
  const templates = {
    annualPlans: { yearGoal: '', planContent: '', dueDate: '', completion: '进行中', planStatus: '蓝' },
    deliverables: { name: '', type: '专利', status: '待交付', ownership: [], outcomeCode: '' },
    partners: { name: '', type: '参研', evaluator: '', score: null, level: '', evalDate: '' },
    outcomes: {
      code: `CG-${new Date().getFullYear()}-${String(form.value.outcomes.length + 1).padStart(3, '0')}`,
      name: '',
      projectCode: form.value.code,
      summary: '',
      method: '',
      form: '',
      planDate: '',
      actualDate: '',
      status: '已启动',
      transformBrief: '',
      responsibleUnit: '',
      deliverableCount: 0,
    },
  };
  form.value[key].push({ ...templates[key] });
  syncOutcomeDeliverableCounts();
}

function removeRow(key, idx) {
  if (form.value[key].length <= 1) return;
  form.value[key].splice(idx, 1);
  syncOutcomeDeliverableCounts();
}

function outcomeFormOptions(method) {
  if ((method || '').includes('市场')) return OUTCOME_FORMS_MARKET;
  return OUTCOME_FORMS_PRODUCT;
}

function pickFolder() {
  folderInput.value?.click();
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      resolve(typeof result === 'string' ? result.split(',')[1] : '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function onFolderChange(e) {
  const list = e.target.files;
  if (!list?.length) return;
  uploadingFolder.value = true;
  const first = list[0];
  const root = first.webkitRelativePath?.split('/')[0] || '项目材料文件夹';
  form.value.folderName = root;
  const files = [];
  const maxSize = 5 * 1024 * 1024;
  for (const f of list) {
    if (f.size > maxSize) {
      ElMessage.warning(`跳过大文件：${f.name}`);
      continue;
    }
    const content = await fileToBase64(f);
    files.push({
      relativePath: f.webkitRelativePath || f.name,
      fileName: f.name,
      mimeType: f.type || 'application/octet-stream',
      size: f.size,
      content,
    });
  }
  form.value.folderFiles = files;
  uploadingFolder.value = false;
  ElMessage.success(`已选择文件夹「${root}」，共 ${files.length} 个文件`);
  e.target.value = '';
}

async function aiExtract() {
  const { data } = await api.post('/ai/extract', { text: '模拟上传材料' });
  const ex = data.extracted || {};
  Object.assign(form.value, ex);
  if (ex.deliverables?.length) {
    form.value.deliverables = ex.deliverables.map((d) => ({
      ...d,
      ownership: Array.isArray(d.ownership) ? d.ownership : d.ownership ? [d.ownership] : [],
    }));
  }
  syncOutcomeMeta();
  ElMessage.success(data.note);
}

function validateForm() {
  const f = form.value;
  if (!f.name?.trim()) return '请填写名称';
  if (!f.level) return '请选择层级';
  if (!f.channelId) return '请选择渠道类别';
  if (!f.org?.trim()) return '请填写牵头单位';
  if (!f.owner?.trim()) return '请填写项目负责人（姓名及工号）';
  return null;
}

async function buildPayload() {
  return { ...form.value, code: form.value.code };
}

async function submitApply() {
  const err = validateForm();
  if (err) return ElMessage.warning(err);
  const ch = channels.value.find((c) => c.id === form.value.channelId);
  const payload = await buildPayload();
  const { data } = await api.post('/applications', {
    level: form.value.level,
    channelId: form.value.channelId,
    channelName: ch?.name,
    payload,
  });
  ElMessage.success(`立项申报已提交（${data.code}）${data.fileCount ? `，附件 ${data.fileCount} 个已入库` : ''}`);
  resetForm();
}

async function submitUpload() {
  const err = validateForm();
  if (err) return ElMessage.warning(err);
  const payload = await buildPayload();
  const { data } = await api.post('/projects/upload', payload);
  ElMessage.success(`项目已上传入库${data.fileCount ? `，附件 ${data.fileCount} 个` : ''}`);
  router.push(`/projects/${data.id}`);
}

async function resetForm() {
  const { data } = await api.get('/projects/next-code');
  form.value = emptyProjectForm();
  form.value.code = data.code;
  if (user.org) form.value.org = user.org;
  if (user.name) form.value.owner = `${user.name} / `;
}

async function submit() {
  if (submitMode.value === 'upload') await submitUpload();
  else await submitApply();
}

const folderSummary = computed(() => {
  if (!form.value.folderFiles?.length) return '未选择文件夹';
  return `${form.value.folderName} · ${form.value.folderFiles.length} 个文件`;
});
</script>

<template>
  <div class="apply-page">
    <h2 class="page-title">立项申报 / 项目信息上传</h2>
    <p class="muted">需求 V18 · 填表说明 · 按台账表头规范填写 · 系统字段自动生成</p>

    <el-card shadow="never" class="guide-card">
      <div class="guide-toggle" @click="showGuide = !showGuide">
        {{ showGuide ? '▼' : '▶' }} 填表说明（V18 规范）
      </div>
      <div v-show="showGuide" class="guide-body muted">
        <p>· 项目编号、项目状态、成果转化状态、预警等由系统自动生成，上传时无需手工填写。</p>
        <p>· 人员类字段请填写「姓名 / 工号」；协作评价得分填好后等级自动计算（优秀≥90、合格60-89、不合格&lt;60）。</p>
        <p>· 支持上传整个项目材料文件夹，文件随申报/入库一并存入数据库。</p>
      </div>
    </el-card>

    <el-card shadow="never" style="margin-bottom:12px">
      <div class="toolbar">
        <el-button type="primary" plain @click="aiExtract">AI 智能抽取</el-button>
        <el-radio-group v-model="submitMode">
          <el-radio value="apply">提交审签</el-radio>
          <el-radio value="upload">直接上传入库</el-radio>
        </el-radio-group>
      </div>
    </el-card>

    <el-tabs v-model="activeTab" type="border-card">
      <!-- 项目所属信息 -->
      <el-tab-pane label="项目所属信息" name="info">
        <div class="module-tag">板块：项目所属信息</div>
        <el-table :data="PROJECT_INFO_ROWS" border class="form-table" size="small">
          <el-table-column prop="label" label="表头" width="140" />
          <el-table-column label="填写" min-width="280">
            <template #default="{ row }">
              <el-input v-if="row.key === 'code'" v-model="form.code" disabled />
              <el-input v-else-if="row.key === 'name'" v-model="form.name" />
              <el-input v-else-if="row.key === 'goal'" v-model="form.goal" type="textarea" :rows="2" />
              <el-date-picker v-else-if="row.key === 'startDate'" v-model="form.startDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
              <el-date-picker v-else-if="row.key === 'endDate'" v-model="form.endDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
              <el-select v-else-if="row.key === 'level'" v-model="form.level" style="width:100%">
                <el-option v-for="lv in LEVEL_OPTIONS" :key="lv" :label="lv" :value="lv" />
              </el-select>
              <el-input v-else-if="row.key === 'initDept'" v-model="form.initDept" disabled />
              <el-select v-else-if="row.key === 'channelId'" v-model="form.channelId" style="width:100%" :disabled="!form.level">
                <el-option v-for="c in levelChannels(form.level)" :key="c.id" :label="c.name" :value="c.id" />
              </el-select>
              <el-input v-else-if="row.key === 'org'" v-model="form.org" />
              <el-input v-else-if="row.key === 'mainWork'" v-model="form.mainWork" type="textarea" :rows="2" />
              <el-input v-else-if="row.readonly && row.key === 'status'" model-value="进行中" disabled />
              <el-input v-else-if="row.readonly && row.key === 'outcomeStatus'" model-value="技术储备待应用" disabled />
              <el-input v-else-if="row.readonly && row.key === 'risk'" model-value="蓝（系统初始）" disabled />
              <el-input v-else-if="row.key === 'partnerUnit1'" v-model="form.partnerUnit1" />
              <el-input v-else-if="row.key === 'partnerWork1'" v-model="form.partnerWork1" type="textarea" :rows="2" />
              <el-input v-else-if="row.key === 'partnerUnit2'" v-model="form.partnerUnit2" />
              <el-input v-else-if="row.key === 'partnerWork2'" v-model="form.partnerWork2" type="textarea" :rows="2" />
              <el-input v-else-if="row.key === 'partnerUnitsExtra'" v-model="form.partnerUnitsExtra" type="textarea" :rows="2" />
            </template>
          </el-table-column>
          <el-table-column prop="hint" label="说明" min-width="300" />
        </el-table>
      </el-tab-pane>

      <!-- 人员团队 -->
      <el-tab-pane label="人员团队" name="team">
        <template v-for="sec in TEAM_SECTIONS" :key="sec.module">
          <div class="module-tag">板块：{{ sec.module }}</div>
          <el-table :data="sec.fields" border class="form-table" size="small" style="margin-bottom:16px">
            <el-table-column prop="label" label="表头" width="140" />
            <el-table-column label="填写" min-width="240">
              <template #default="{ row }">
                <el-input v-model="form[row.key]" :placeholder="row.placeholder" />
              </template>
            </el-table-column>
            <el-table-column prop="hint" label="说明" min-width="280" />
          </el-table>
        </template>
      </el-tab-pane>

      <!-- 科研经费 -->
      <el-tab-pane label="科研经费情况" name="funding">
        <div class="module-tag">板块：科研经费情况</div>
        <el-table :data="FUNDING_ROWS" border class="form-table" size="small">
          <el-table-column prop="label" label="表头" width="120" />
          <el-table-column label="填写" width="200">
            <template #default="{ row }">
              <el-input-number v-model="form[row.key]" :min="0" style="width:100%" />
            </template>
          </el-table-column>
          <el-table-column prop="hint" label="说明" min-width="320" />
        </el-table>
      </el-tab-pane>

      <!-- 年度计划 -->
      <el-tab-pane label="年度目标及计划" name="plans">
        <div class="module-tag">板块：科研年度目标及计划</div>
        <div v-for="(row, idx) in form.annualPlans" :key="idx" class="repeat-block">
          <el-table :data="ANNUAL_PLAN_COLS" border size="small" class="form-table">
            <el-table-column prop="label" label="表头" width="120" />
            <el-table-column label="填写" min-width="200">
              <template #default="{ row: col }">
                <el-input v-if="col.key === 'yearGoal'" v-model="row.yearGoal" />
                <el-input v-else-if="col.key === 'planContent'" v-model="row.planContent" />
                <el-date-picker v-else-if="col.key === 'dueDate'" v-model="row.dueDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
                <el-select v-else-if="col.key === 'completion'" v-model="row.completion" style="width:100%">
                  <el-option v-for="o in col.options" :key="o" :label="o" :value="o" />
                </el-select>
                <el-input v-else-if="col.readonly" :model-value="row.planStatus" disabled />
              </template>
            </el-table-column>
            <el-table-column prop="hint" label="说明" min-width="260" />
          </el-table>
          <el-button v-if="form.annualPlans.length > 1" link type="danger" @click="removeRow('annualPlans', idx)">删除本行计划</el-button>
        </div>
        <el-button link type="primary" @click="addRow('annualPlans')">+ 添加计划行</el-button>
      </el-tab-pane>

      <!-- 交付物 -->
      <el-tab-pane label="交付物" name="deliverables">
        <div class="module-tag">板块：交付物</div>
        <div v-for="(row, idx) in form.deliverables" :key="idx" class="repeat-block">
          <el-table :data="DELIVERABLE_COLS" border size="small" class="form-table">
            <el-table-column prop="label" label="表头" width="120" />
            <el-table-column label="填写" min-width="200">
              <template #default="{ row: col }">
                <el-input v-if="col.key === 'name'" v-model="row.name" />
                <el-select v-else-if="col.key === 'type'" v-model="row.type" style="width:100%">
                  <el-option v-for="o in col.options" :key="o" :label="o" :value="o" />
                </el-select>
                <el-select v-else-if="col.key === 'status'" v-model="row.status" style="width:100%">
                  <el-option v-for="o in col.options" :key="o" :label="o" :value="o" />
                </el-select>
                <el-select v-else-if="col.key === 'ownership'" v-model="row.ownership" multiple style="width:100%">
                  <el-option v-for="o in col.options" :key="o" :label="o" :value="o" />
                </el-select>
                <el-input v-else-if="col.key === 'outcomeCode'" v-model="row.outcomeCode" @input="syncOutcomeDeliverableCounts" />
              </template>
            </el-table-column>
            <el-table-column prop="hint" label="说明" min-width="260" />
          </el-table>
          <el-button v-if="form.deliverables.length > 1" link type="danger" @click="removeRow('deliverables', idx)">删除</el-button>
        </div>
        <el-button link type="primary" @click="addRow('deliverables')">+ 添加交付物</el-button>
      </el-tab-pane>

      <!-- 协作评价 -->
      <el-tab-pane label="协作单位评价" name="partners">
        <div class="module-tag">板块：协作单位评价</div>
        <div v-for="(row, idx) in form.partners" :key="idx" class="repeat-block">
          <el-table :data="PARTNER_COLS" border size="small" class="form-table">
            <el-table-column prop="label" label="表头" width="120" />
            <el-table-column label="填写" min-width="200">
              <template #default="{ row: col }">
                <el-input v-if="col.key === 'name'" v-model="row.name" />
                <el-select v-else-if="col.key === 'type'" v-model="row.type" style="width:100%">
                  <el-option v-for="o in col.options" :key="o" :label="o" :value="o" />
                </el-select>
                <el-input v-else-if="col.key === 'evaluator'" v-model="row.evaluator" />
                <el-input-number v-else-if="col.key === 'score'" v-model="row.score" :min="0" :max="100" style="width:100%" />
                <el-input v-else-if="col.readonly" :model-value="row.level || '—'" disabled />
                <el-date-picker v-else-if="col.key === 'evalDate'" v-model="row.evalDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
              </template>
            </el-table-column>
            <el-table-column prop="hint" label="说明" min-width="260" />
          </el-table>
          <el-button v-if="form.partners.length > 1" link type="danger" @click="removeRow('partners', idx)">删除</el-button>
        </div>
        <el-button link type="primary" @click="addRow('partners')">+ 添加协作单位</el-button>
      </el-tab-pane>

      <!-- 成果转化 -->
      <el-tab-pane label="成果转化" name="outcomes">
        <div class="module-tag">板块：成果转化</div>
        <div v-for="(row, idx) in form.outcomes" :key="idx" class="repeat-block">
          <el-table :data="OUTCOME_COLS" border size="small" class="form-table">
            <el-table-column prop="label" label="表头" width="130" />
            <el-table-column label="填写" min-width="200">
              <template #default="{ row: col }">
                <el-input v-if="col.readonly && col.key === 'code'" v-model="row.code" disabled />
                <el-input v-else-if="col.readonly && col.key === 'projectCode'" v-model="row.projectCode" disabled />
                <el-input v-else-if="col.readonly && col.key === 'deliverableCount'" :model-value="String(row.deliverableCount)" disabled />
                <el-input v-else-if="col.key === 'name'" v-model="row.name" />
                <el-input v-else-if="col.key === 'summary'" v-model="row.summary" type="textarea" :rows="2" maxlength="100" show-word-limit />
                <el-select v-else-if="col.key === 'method'" v-model="row.method" style="width:100%">
                  <el-option v-for="o in col.options" :key="o" :label="o" :value="o" />
                </el-select>
                <el-select v-else-if="col.key === 'form'" v-model="row.form" style="width:100%">
                  <el-option v-for="o in outcomeFormOptions(row.method)" :key="o" :label="o" :value="o" />
                </el-select>
                <el-date-picker v-else-if="col.key === 'planDate'" v-model="row.planDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
                <el-date-picker v-else-if="col.key === 'actualDate'" v-model="row.actualDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
                <el-select v-else-if="col.key === 'status'" v-model="row.status" style="width:100%">
                  <el-option v-for="o in col.options" :key="o" :label="o" :value="o" />
                </el-select>
                <el-input v-else-if="col.key === 'transformBrief'" v-model="row.transformBrief" type="textarea" :rows="2" />
                <el-input v-else-if="col.key === 'responsibleUnit'" v-model="row.responsibleUnit" />
              </template>
            </el-table-column>
            <el-table-column prop="hint" label="说明" min-width="260" />
          </el-table>
          <el-button v-if="form.outcomes.length > 1" link type="danger" @click="removeRow('outcomes', idx)">删除</el-button>
        </div>
        <el-button link type="primary" @click="addRow('outcomes')">+ 添加成果</el-button>
      </el-tab-pane>

      <!-- 文件夹上传 -->
      <el-tab-pane label="材料文件夹" name="folder">
        <div class="module-tag">板块：项目材料文件夹上传</div>
        <el-table :data="[{ label: '项目材料文件夹', hint: '上传立项/实施佐证材料文件夹，随申报或入库一并存入系统' }]" border class="form-table" size="small">
          <el-table-column prop="label" label="表头" width="140" />
          <el-table-column label="填写" min-width="320">
            <template #default>
              <input ref="folderInput" type="file" webkitdirectory directory multiple hidden @change="onFolderChange" />
              <el-button type="primary" :loading="uploadingFolder" @click="pickFolder">选择文件夹上传</el-button>
              <span class="folder-info">{{ folderSummary }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="hint" label="说明" min-width="280" />
        </el-table>
        <el-table v-if="form.folderFiles.length" :data="form.folderFiles.slice(0, 50)" size="small" class="form-table" style="margin-top:12px" max-height="240">
          <el-table-column prop="relativePath" label="文件路径" show-overflow-tooltip />
          <el-table-column prop="size" label="大小" width="100">
            <template #default="{ row }">{{ (row.size / 1024).toFixed(1) }} KB</template>
          </el-table-column>
        </el-table>
        <p v-if="form.folderFiles.length > 50" class="muted">仅预览前 50 个文件，提交时全部入库</p>
      </el-tab-pane>
    </el-tabs>

    <div class="submit-bar">
      <el-button type="primary" size="large" @click="submit">
        {{ submitMode === 'upload' ? '上传入库' : '提交审签' }}
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.apply-page { max-width: 1100px; }
.guide-card { margin-bottom: 12px; }
.guide-toggle { cursor: pointer; font-size: 13px; color: var(--accent); }
.guide-body { margin-top: 8px; font-size: 12px; line-height: 1.8; }
.toolbar { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
.module-tag { font-size: 13px; font-weight: 600; color: var(--accent); margin: 8px 0 12px; }
.form-table { margin-bottom: 8px; }
.repeat-block { margin-bottom: 16px; padding: 12px; background: var(--panel-2); border-radius: 8px; border: 1px solid var(--line); }
.submit-bar { margin: 24px 0; text-align: center; }
.folder-info { margin-left: 12px; color: var(--muted); font-size: 13px; }
</style>
