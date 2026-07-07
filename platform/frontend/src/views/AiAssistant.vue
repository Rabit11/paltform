<script setup>
import { ref } from 'vue';
import api from '../api';

const question = ref('');
const messages = ref([]);
const loading = ref(false);

const presets = [
  '当前有哪些红色预警项目？',
  '有哪些临期项目？',
  '范围内经费执行情况如何？',
];

async function ask(q) {
  const text = q || question.value;
  if (!text.trim()) return;
  messages.value.push({ role: 'user', text });
  question.value = '';
  loading.value = true;
  try {
    const { data } = await api.post('/ai/chat', { question: text });
    messages.value.push({ role: 'ai', text: data.answer, citations: data.citations });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div>
    <h2 class="page-title">智能问答助手</h2>
    <p class="muted">台账 Copilot · 回答带依据角标 · 经费为汇总观察口径</p>
    <div class="chat">
      <div class="msgs">
        <div v-for="(m, i) in messages" :key="i" :class="['msg', m.role]">
          <div>{{ m.text }}</div>
          <div v-if="m.citations" class="cite">依据：{{ m.citations.join(' · ') }}</div>
        </div>
        <div v-if="loading" class="msg ai muted">思考中…</div>
      </div>
      <div class="presets">
        <el-button v-for="p in presets" :key="p" size="small" @click="ask(p)">{{ p }}</el-button>
      </div>
      <div class="input-row">
        <el-input v-model="question" placeholder="自然语言查询台账…" @keyup.enter="ask()" />
        <el-button type="primary" :loading="loading" @click="ask()">发送</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat { max-width: 720px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 16px; }
.msgs { min-height: 280px; max-height: 420px; overflow: auto; margin-bottom: 12px; }
.msg { padding: 10px 14px; border-radius: 10px; margin-bottom: 8px; font-size: 14px; line-height: 1.6; }
.msg.user { background: rgba(59,130,246,0.15); margin-left: 40px; }
.msg.ai { background: var(--panel-2); margin-right: 40px; }
.cite { font-size: 11px; color: var(--muted); margin-top: 6px; }
.presets { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.input-row { display: flex; gap: 8px; }
</style>
