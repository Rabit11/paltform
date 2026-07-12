import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
mkdirSync(DATA_DIR, { recursive: true });

export const DB_PATH = join(DATA_DIR, 'platform.db');

export function openDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  return db;
}

export function createSchema(db) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS units (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    short TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'unit'   -- unit | hq
  );

  CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    level TEXT NOT NULL,                -- 国家级 | 地方级 | 公司级
    org TEXT,                           -- 渠道部门（部委/委局）
    dept TEXT,                          -- 内部管理处室
    flow_json TEXT NOT NULL,            -- 全周期流程节点数组
    declare_json TEXT NOT NULL,         -- 申报需提交材料
    filing_json TEXT NOT NULL,          -- 立项需提交材料
    approve_chain_json TEXT NOT NULL,   -- 申报审签链（渠道差异化）
    declare_mode TEXT NOT NULL DEFAULT '审批',   -- 审批 | 报备
    assess_json TEXT NOT NULL DEFAULT '[]',      -- 评估检查内容（渠道差异化）
    enabled INTEGER NOT NULL DEFAULT 1           -- 渠道启用/终止
  );

  CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,                 -- team | chief | mgmt | finance | admin | leader
    scope TEXT NOT NULL DEFAULT 'unit', -- hq | unit | self
    unit_id INTEGER,
    title TEXT,
    avatar TEXT,
    status TEXT NOT NULL DEFAULT '在岗' -- 在岗 | 已离岗（权限自动回收）
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,          -- 平台编号 KY-2024-017
    wbs TEXT,                           -- WBS 编号
    name TEXT NOT NULL,
    goal TEXT,
    year_goal TEXT,
    level TEXT NOT NULL,
    channel_id INTEGER NOT NULL,
    lead_unit_id INTEGER NOT NULL,
    partners_json TEXT NOT NULL DEFAULT '[]',   -- [{name, work}]
    team_json TEXT NOT NULL DEFAULT '{}',       -- {owner,tech,pm,chief1,chief2,hqChief,hqStaff,unitDeptHead,unitStaff,finHq,finHead,finStaff}
    start TEXT NOT NULL,
    end TEXT NOT NULL,
    status TEXT NOT NULL,               -- 草稿|申报中|立项中|实施中|验收中|已验收|已终止
    total_budget REAL NOT NULL,         -- 万元
    transform_status TEXT,              -- 已转化应用|接续研发立项|技术储备待应用|NULL
    accepted_at TEXT,                   -- 验收办结日期（协作评价30日倒计时锚点）
    tags_json TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS milestones (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    seq INTEGER NOT NULL,
    title TEXT NOT NULL,
    due TEXT NOT NULL,
    done_at TEXT,
    evidence TEXT,
    delay_reason TEXT
  );

  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'CMOS',
    due TEXT NOT NULL,
    done_at TEXT,
    status TEXT NOT NULL DEFAULT '待办'  -- 待办|办结审批中|已完成
  );

  CREATE TABLE IF NOT EXISTS funds (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    budget REAL NOT NULL,
    spent REAL NOT NULL,
    writeoffs_json TEXT NOT NULL DEFAULT '[]'   -- [{date, amount, voucher, milestone}]
  );

  CREATE TABLE IF NOT EXISTS funding_pool (
    year INTEGER PRIMARY KEY,
    total REAL NOT NULL,
    note TEXT
  );

  CREATE TABLE IF NOT EXISTS funding_quota (
    id INTEGER PRIMARY KEY,
    year INTEGER NOT NULL,
    unit_id INTEGER NOT NULL,
    quota REAL NOT NULL,
    paid REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS funding_requests (
    id INTEGER PRIMARY KEY,
    year INTEGER NOT NULL,
    unit_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    purpose TEXT,
    status TEXT NOT NULL DEFAULT '待审批',  -- 待审批|已拨付|已驳回
    created_at TEXT NOT NULL,
    decided_at TEXT
  );

  CREATE TABLE IF NOT EXISTS deliverables (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,                 -- 专利|论文|软著|技术标准|原理样机|设备|成套技术成果
    due TEXT,
    delivered_at TEXT,
    owner TEXT NOT NULL DEFAULT '公司', -- 权属
    package_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS packages (
    id INTEGER PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,          -- 成果编号 CG-2026-001
    name TEXT NOT NULL,
    project_id INTEGER NOT NULL,
    mode TEXT NOT NULL,                 -- 向型号转化|向市场转化
    form TEXT NOT NULL,                 -- 装机|未装机|转让|许可|联合实施|作价投资|其他
    plan_date TEXT,
    actual_date TEXT,
    status TEXT NOT NULL,               -- 未启动|洽谈中|已签协议|已完成
    brief TEXT,
    detail TEXT,
    unit_id INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS collaborators (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    ctype TEXT NOT NULL,                -- 参研|外协
    scores_json TEXT,                   -- {tech,quality,schedule,service,compliance}
    total REAL,
    grade TEXT,                         -- 优秀|良好|合格|不合格
    eval_date TEXT,
    evaluator TEXT,
    blacklisted INTEGER NOT NULL DEFAULT 0,
    note TEXT
  );

  CREATE TABLE IF NOT EXISTS post_evals (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    status TEXT NOT NULL,               -- 待启动|进行中|已完成
    deadline TEXT NOT NULL,             -- 验收后3年
    started_at TEXT,
    finished_at TEXT,
    conclusion TEXT,
    scores_json TEXT                    -- {goal,schedule,budget,output,collab,risk}
  );

  CREATE TABLE IF NOT EXISTS approvals (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,                 -- declaration|filing|change|data_change|milestone_close|plan_finish|acceptance|funding|package|evaluation|post_eval
    title TEXT NOT NULL,
    project_id INTEGER,
    initiator TEXT NOT NULL,
    unit_id INTEGER,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT '审批中',   -- 审批中|已通过|已驳回|已撤销
    current_step INTEGER NOT NULL DEFAULT 0,
    steps_json TEXT NOT NULL,           -- [{title, assignee, role, status, at, comment}]
    payload_json TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS changes (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    kind TEXT NOT NULL,                 -- 项目变更|数据变更
    category TEXT,                      -- 延期|经费|外协方|付款节点|核心指标|数据修正
    detail TEXT,
    reason TEXT,
    status TEXT NOT NULL DEFAULT '审批中',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    phase TEXT NOT NULL,                -- 申报|立项|实施|验收|成果转化|后评价
    name TEXT NOT NULL,
    uploaded_at TEXT NOT NULL,
    uploader TEXT,
    size_kb INTEGER,
    file_path TEXT                      -- 真实上传文件的存储路径（种子文档为 NULL）
  );

  CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY,
    orig_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime TEXT,
    size_kb INTEGER,
    uploaded_at TEXT NOT NULL,
    uploader TEXT,
    project_id INTEGER,                 -- 归档后关联项目
    text_chars INTEGER,
    extracted_json TEXT                 -- AI 识读结果留档
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY,
    project_id INTEGER,
    kind TEXT NOT NULL,                 -- 里程碑|交付物|验收|经费|后评价|成果转化
    level TEXT NOT NULL,                -- red|yellow
    title TEXT NOT NULL,
    due TEXT,
    created_at TEXT NOT NULL,
    channels TEXT NOT NULL DEFAULT '站内,邮箱,蓝信',
    recipients TEXT NOT NULL DEFAULT '项目团队、对应管理团队',
    read INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY,
    ts TEXT NOT NULL,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    detail TEXT
  );
  `);
}
