import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CANDIDATE_PATHS = [
  join(__dirname, '..', 'config', 'major1-major2.json'),
];

let cached = null;

function loadMajorFile() {
  for (const file of CANDIDATE_PATHS) {
    if (!existsSync(file)) continue;
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    const major1 = Array.isArray(raw.major1) ? raw.major1.slice() : [];
    const major2ByMajor1 = raw.major2ByMajor1 && typeof raw.major2ByMajor1 === 'object'
      ? raw.major2ByMajor1
      : {};
    const major2 = [];
    for (const list of Object.values(major2ByMajor1)) {
      for (const m of list || []) {
        if (m && !major2.includes(m)) major2.push(m);
      }
    }
    return {
      file,
      version: raw.version || '1.0.0',
      updated: raw.updated || '',
      source: raw.source || '',
      note: raw.note || '',
      major1,
      major2,
      major2ByMajor1,
    };
  }
  throw new Error(`未找到专业字典文件，已尝试：${CANDIDATE_PATHS.join(' | ')}`);
}

export function getMajorConfig(forceReload = false) {
  if (!cached || forceReload) cached = loadMajorFile();
  return cached;
}

/** 二级编码前两位 → 一级编码 */
export function major1CodeFromMajor2(major2) {
  const m = String(major2 || '').match(/^(\d{2})\d{2}-/);
  return m ? m[1] : '';
}

export function findMajor1ByCode(code) {
  const c = String(code || '');
  return getMajorConfig().major1.find((x) => x.startsWith(`${c}-`)) || '';
}

export function majorsForMajor1(major1) {
  const cfg = getMajorConfig();
  if (!major1) return cfg.major2.slice();
  return (cfg.major2ByMajor1[major1] || []).slice();
}

/** 校验一级/二级是否在字典内且编码严格对应 */
export function validateMajorPair(major1, major2) {
  const cfg = getMajorConfig();
  const m1 = String(major1 || '').trim();
  const m2 = String(major2 || '').trim();
  if (!m1 && !m2) return { ok: true, major1: '', major2: '' };
  if (m1 && !cfg.major1.includes(m1)) {
    return { ok: false, error: `一级专业「${m1}」不在附件1专业字典内` };
  }
  if (m2 && !cfg.major2.includes(m2)) {
    return { ok: false, error: `二级专业「${m2}」不在附件1专业字典内` };
  }
  if (m1 && m2) {
    const allowed = cfg.major2ByMajor1[m1] || [];
    if (!allowed.includes(m2)) {
      return {
        ok: false,
        error: `二级专业「${m2}」不属于一级专业「${m1}」（须按附件1编码前两位严格对应）`,
      };
    }
  }
  if (!m1 && m2) {
    const code = major1CodeFromMajor2(m2);
    const inferred = findMajor1ByCode(code);
    if (!inferred) {
      return { ok: false, error: `无法从二级专业「${m2}」反推一级专业` };
    }
    return { ok: true, major1: inferred, major2: m2, inferred: true };
  }
  return { ok: true, major1: m1, major2: m2 };
}

export function majorPayload() {
  const cfg = getMajorConfig();
  return {
    version: cfg.version,
    updated: cfg.updated,
    source: cfg.source,
    note: cfg.note,
    major1: cfg.major1,
    major2: cfg.major2,
    major2ByMajor1: cfg.major2ByMajor1,
  };
}
