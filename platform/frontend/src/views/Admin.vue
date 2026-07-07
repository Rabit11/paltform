<script setup>
import { ref, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../api';
import { roleLabel } from '../roles';

const tab = ref('users');
const users = ref([]);
const personnel = ref([]);
const roles = ref([]);
const loading = ref(false);

const userDialog = ref(false);
const userForm = ref(emptyUserForm());
const editingUserId = ref(null);

const personnelDialog = ref(false);
const personnelForm = ref({ name: '', specialty: '', org: '' });
const editingPersonnelId = ref(null);

function emptyUserForm() {
  return { username: '', password: '', name: '', role: 'project_team', org: '', title: '', teamRole: '' };
}

const roleOptions = computed(() =>
  roles.value.map((r) => ({ value: r.id, label: r.label })),
);

async function loadAll() {
  loading.value = true;
  try {
    const [u, p, r] = await Promise.all([
      api.get('/admin/users'),
      api.get('/admin/personnel'),
      api.get('/meta/roles'),
    ]);
    users.value = u.data;
    personnel.value = p.data;
    roles.value = r.data;
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '加载失败');
  } finally {
    loading.value = false;
  }
}

function openUserCreate() {
  editingUserId.value = null;
  userForm.value = emptyUserForm();
  userDialog.value = true;
}

function openUserEdit(row) {
  editingUserId.value = row.id;
  userForm.value = {
    username: row.username,
    password: '',
    name: row.name,
    role: row.role,
    org: row.org || '',
    title: row.title || '',
    teamRole: row.teamRole || '',
  };
  userDialog.value = true;
}

async function saveUser() {
  const f = userForm.value;
  if (!f.name?.trim() || !f.role) {
    ElMessage.warning('请填写姓名和角色');
    return;
  }
  try {
    if (editingUserId.value) {
      const payload = {
        name: f.name,
        role: f.role,
        org: f.org,
        title: f.title,
        teamRole: f.teamRole,
      };
      if (f.password) payload.password = f.password;
      await api.put(`/admin/users/${editingUserId.value}`, payload);
      ElMessage.success('账号已更新');
    } else {
      if (!f.username?.trim() || !f.password) {
        ElMessage.warning('新建账号需填写用户名和密码');
        return;
      }
      await api.post('/admin/users', f);
      ElMessage.success('账号已创建');
    }
    userDialog.value = false;
    await loadAll();
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '保存失败');
  }
}

async function syncDemoUsers() {
  try {
    const { data } = await api.post('/admin/sync-demo-users');
    ElMessage.success(data.message || '演示账号已同步');
    await loadAll();
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '同步失败');
  }
}

async function removeUser(row) {
  try {
    await ElMessageBox.confirm(`确定删除账号「${row.username}」？`, '删除确认', { type: 'warning' });
    await api.delete(`/admin/users/${row.id}`);
    ElMessage.success('已删除');
    await loadAll();
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.response?.data?.error || '删除失败');
  }
}

function openPersonnelCreate() {
  editingPersonnelId.value = null;
  personnelForm.value = { name: '', specialty: '', org: '' };
  personnelDialog.value = true;
}

function openPersonnelEdit(row) {
  editingPersonnelId.value = row.id;
  personnelForm.value = { name: row.name, specialty: row.specialty, org: row.org || '' };
  personnelDialog.value = true;
}

async function savePersonnel() {
  const f = personnelForm.value;
  if (!f.name?.trim() || !f.specialty?.trim()) {
    ElMessage.warning('请填写姓名和专业');
    return;
  }
  try {
    if (editingPersonnelId.value) {
      await api.put(`/admin/personnel/${editingPersonnelId.value}`, f);
      ElMessage.success('人员已更新');
    } else {
      await api.post('/admin/personnel', f);
      ElMessage.success('人员已添加');
    }
    personnelDialog.value = false;
    await loadAll();
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '保存失败');
  }
}

async function removePersonnel(row) {
  try {
    await ElMessageBox.confirm(`确定删除人员「${row.name}」？`, '删除确认', { type: 'warning' });
    await api.delete(`/admin/personnel/${row.id}`);
    ElMessage.success('已删除');
    await loadAll();
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.response?.data?.error || '删除失败');
  }
}

onMounted(loadAll);
</script>

<template>
  <div>
    <h2 class="page-title">平台运维与人员管理</h2>
    <p class="muted">超级管理员 · 管理全部平台账号与人员库 · 演示账号重启后自动同步密码 Keyan@2026</p>

    <el-tabs v-model="tab" style="margin-top:16px">
      <el-tab-pane label="平台账号" name="users">
        <div class="toolbar">
          <el-button type="primary" @click="openUserCreate">新增账号</el-button>
          <el-button @click="syncDemoUsers">同步演示账号</el-button>
          <span class="hint">共 {{ users.length }} 个账号 · 演示密码 Keyan@2026</span>
        </div>
        <el-table v-loading="loading" :data="users" stripe class="data-table">
          <el-table-column prop="username" label="用户名" width="120" />
          <el-table-column prop="name" label="姓名" width="100" />
          <el-table-column label="角色" width="150">
            <template #default="{ row }">{{ roleLabel(row.role) }}</template>
          </el-table-column>
          <el-table-column prop="org" label="单位" width="120" show-overflow-tooltip />
          <el-table-column prop="title" label="岗位" width="120" show-overflow-tooltip />
          <el-table-column prop="teamRole" label="团队角色" width="110" />
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openUserEdit(row)">编辑</el-button>
              <el-button link type="danger" @click="removeUser(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="人员库" name="personnel">
        <div class="toolbar">
          <el-button type="primary" @click="openPersonnelCreate">新增人员</el-button>
          <span class="hint">共 {{ personnel.length }} 人 · 用于看板人员专业统计</span>
        </div>
        <el-table v-loading="loading" :data="personnel" stripe class="data-table">
          <el-table-column prop="name" label="姓名" width="120" />
          <el-table-column prop="specialty" label="专业领域" min-width="180" />
          <el-table-column prop="org" label="单位" width="140" />
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openPersonnelEdit(row)">编辑</el-button>
              <el-button link type="danger" @click="removePersonnel(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="运维配置" name="config">
        <el-table :data="[
          { name: '渠道字典维护', desc: '15 个立项渠道，支持新增/终止审批后维护', status: '演示' },
          { name: '流程模板配置', desc: '各渠道差异化审批链、材料清单', status: '演示' },
          { name: '四色预警规则', desc: '红>黄>蓝>绿，临期 30 天自动触发', status: '已启用' },
          { name: '演示账号同步', desc: '服务启动时自动 upsert 全部 V18 演示账号', status: '已启用' },
        ]" stripe class="data-table">
          <el-table-column prop="name" label="配置项" width="180" />
          <el-table-column prop="desc" label="说明" min-width="320" />
          <el-table-column prop="status" label="状态" width="100" />
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="userDialog" :title="editingUserId ? '编辑账号' : '新增账号'" width="480px">
      <el-form label-width="88px">
        <el-form-item label="用户名" required>
          <el-input v-model="userForm.username" :disabled="!!editingUserId" placeholder="登录用户名" />
        </el-form-item>
        <el-form-item :label="editingUserId ? '新密码' : '密码'" :required="!editingUserId">
          <el-input v-model="userForm.password" type="password" show-password :placeholder="editingUserId ? '留空则不修改' : 'Keyan@2026'" />
        </el-form-item>
        <el-form-item label="姓名" required>
          <el-input v-model="userForm.name" />
        </el-form-item>
        <el-form-item label="角色" required>
          <el-select v-model="userForm.role" style="width:100%">
            <el-option v-for="o in roleOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="单位">
          <el-input v-model="userForm.org" placeholder="如：试飞中心" />
        </el-form-item>
        <el-form-item label="岗位">
          <el-input v-model="userForm.title" />
        </el-form-item>
        <el-form-item label="团队角色">
          <el-input v-model="userForm.teamRole" placeholder="项目团队专用：项目责任人等" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="userDialog = false">取消</el-button>
        <el-button type="primary" @click="saveUser">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="personnelDialog" :title="editingPersonnelId ? '编辑人员' : '新增人员'" width="440px">
      <el-form label-width="88px">
        <el-form-item label="姓名" required>
          <el-input v-model="personnelForm.name" />
        </el-form-item>
        <el-form-item label="专业领域" required>
          <el-input v-model="personnelForm.specialty" placeholder="如：材料科学与工程" />
        </el-form-item>
        <el-form-item label="单位">
          <el-input v-model="personnelForm.org" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="personnelDialog = false">取消</el-button>
        <el-button type="primary" @click="savePersonnel">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}
.hint {
  color: var(--muted);
  font-size: 13px;
}
</style>
