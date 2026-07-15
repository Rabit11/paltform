import type { Four } from '../lib/status'

export interface Team {
  owner: string; tech: string; pm: string; chief1: string; chief2: string
  hqHead: string; hqStaff: string; unitDeptHead: string; unitStaff: string
  finHq: string; finHead: string; finStaff: string
}

export interface Project {
  id: number; code: string; wbs: string | null; name: string; goal: string; year_goal: string | null
  level: string; channel_id: number; lead_unit_id: number
  partners: { name: string; work: string }[]
  team: Team; tags: string[]
  start: string; end: string; status: string; total_budget: number
  transform_status: string | null; accepted_at: string | null
  color: Four; msTotal: number; msDone: number; progress: number
  nextMilestone: { title: string; due: string; daysLeft: number } | null
  spentAll: number; yearBudget: number; yearSpent: number
  delivered: number; delivTotal: number
  v19: {
    major1: string; major2: string; launchMonth: string; endMonth: string; projectMonths: number | null
    managerUnit: string; demandUnit: string; responsibleUnit: string; leadWork: string; plannedPartners: string
    centralGrant: number; selfFund: number; internalFund: number; cumulativeSpent: number; closingActual: number | null
    executionRate: number; deliverableSummary: string; collaboratorSummary: string; transformCount: number; transformSummary: string
  }
}

export interface Milestone {
  id: number; project_id: number; year: number; seq: number; title: string
  due: string; done_at: string | null; evidence: string | null; delay_reason: string | null
  color: Four; daysLeft: number
}

export interface PlanRow {
  id: number; project_id: number; title: string; source: string; due: string
  done_at: string | null; status: string; color: Four
}

export interface Fund { id: number; project_id: number; year: number; budget: number; spent: number; writeoffs: { date: string; amount: number; voucher: string; note: string }[] }

export interface Deliverable { id: number; project_id: number; name: string; type: string; due: string | null; delivered_at: string | null; owner: string; package_id: number | null; color: Four }

export interface Pkg {
  id: number; code: string; name: string; project_id: number; mode: string; form: string
  plan_date: string | null; actual_date: string | null; status: string; brief: string; detail: string
  unit_id: number; color: Four; deliverableCount: number
}

export interface Collaborator {
  id: number; project_id: number; name: string; ctype: string
  scores: { tech: number; quality: number; schedule: number; service: number; compliance: number } | null
  total: number | null; grade: string | null; eval_date: string | null; evaluator: string | null
  blacklisted: number; note: string | null; pname?: string; pcode?: string
  deadline?: string | null; daysLeft?: number | null
}

export interface ApprovalStep { title: string; assignee: string; status: 'approved' | 'current' | 'pending' | 'rejected'; at: string | null; comment: string | null; actor?: string }

export interface Approval {
  id: number; type: string; title: string; project_id: number | null; initiator: string
  unit_id: number; created_at: string; status: string; current_step: number
  steps: ApprovalStep[]; payload: Record<string, unknown>
  projectName?: string; projectCode?: string
}

export interface AlertRow {
  id: number; project_id: number | null; kind: string; level: 'red' | 'yellow'; title: string
  due: string | null; created_at: string; channels: string; recipients: string; read: number
  pname?: string; pcode?: string
}

export interface PostEval {
  id: number; project_id: number; status: string; deadline: string; started_at: string | null
  finished_at: string | null; conclusion: string | null
  scores: { goal: number; schedule: number; budget: number; output: number; collab: number; risk: number } | null
  pname?: string; pcode?: string; total_budget?: number
}

export interface ChangeRow { id: number; project_id: number; kind: string; category: string; detail: string; reason: string; status: string; created_at: string }

export interface Doc { id: number; project_id: number; phase: string; name: string; uploaded_at: string; uploader: string; size_kb: number; file_path: string | null }

export interface ProjectFull extends Project {
  channelName: string; channelFlow: string[]; channelFiling: string[]; channelAssess: string[]; unitName: string; unitShort: string
  milestones: Milestone[]; plans: PlanRow[]; funds: Fund[]; deliverables: Deliverable[]
  packages: Pkg[]; collaborators: Collaborator[]; approvals: Approval[]
  changes: ChangeRow[]; documents: Doc[]; postEval: PostEval | null
}

export interface Dashboard {
  today: string
  kpis: {
    total: number; active: number; totalBudget: number; yearBudget: number; yearSpent: number
    execRate: number; totalExecRate: number; red: number; yellow: number; deliverables: number; packagesDone: number
    blacklist: number; pendingApprovals: number
  }
  byLevel: { level: string; count: number; budget: number }[]
  byUnit: { unit: string; count: number; budget: number; red: number; yellow: number; blue: number; green: number }[]
  unitLevelMatrix: { unit: string; 国家级: number; 地方级: number; 公司级: number; active: number; accepted: number }[]
  byChannel: { channel: string; key: string; level: string; count: number }[]
  fundsTrend: { year: number; budget: number; spent: number }[]
  statusDist: { status: string; count: number }[]
  delivByType: { type: string; delivered: number; pending: number }[]
  transform: { stage: string; count: number }[]
  transformSummary: { total: number; done: number; running: number; notStarted: number; overdue: number }
  modelTransform: { model: string; count: number; done: number; running: number; overdue: number }[]
  planStats: { total: number; todo: number; done: number; finishRate: number; colors: Record<Four, number>; cmosSync: string | null }
  fundStructure: {
    total: number; centralGrant: number; selfFund: number; internalFund: number
    activeTotal: number; activeCentralGrant: number; activeSelfFund: number; totalExecRate: number
  }
  risks: { kind: string; color: Four; project: string; projectId: number; title: string; due: string; days: number; unit: string }[]
  colorDist: { color: Four; count: number }[]
  msColors: Record<Four, number>
}

export interface TransformRow extends Pkg {
  pname: string; pcode: string; level: string; pstatus: string; unitShort: string
  deliverables: { name: string; type: string; delivered_at: string | null }[]
  target: string
}

export interface TransformationData {
  rows: TransformRow[]
  stats: { total: number; model: number; market: number; done: number; overdue: number }
  readonly: boolean
}

export interface DuplicateMatch {
  id: number; code: string; name: string; level: string; channelId: number; unitId: number
  status: string; owner: string; similarity: number; hitFields: string[]; suggestion: string
}

export interface TransitionField { group: string; code: string; label: string; required: boolean; index?: number; width?: number; number?: boolean }
export interface TransitionCascade {
  version?: string
  updated?: string
  rules?: Record<string, unknown>
  levels: string[]
  sourcesByLevel: Record<string, string[]>
  typesByLevel?: Record<string, string[]>
  typesByLevelSource: Record<string, Record<string, string[]>>
  officesByLevelSource: Record<string, Record<string, string[]>>
  typesByLevelSourceOffice: Record<string, Record<string, Record<string, string[]>>>
  officeByType: Record<string, { level: string; source: string; office: string }>
  pathByType: Record<string, { level: string; sourceChannel: string; orgOffice: string; projectType: string }>
  paths?: { level: string; sourceChannel: string; orgOffice: string; projectType: string }[]
  tree?: Record<string, Record<string, Record<string, string[]>>>
}
export interface TransitionRow {
  id: string; sourceType: string; sourceSheet: string; sourceFile?: string; sourceRow?: number
  code: string; serial?: string; name: string; level: string; channel: string; sourceChannel?: string; orgOffice?: string; projectType?: string
  major1: string; major2: string; center?: string; managerUnit?: string; demandUnit: string; responsibleUnit?: string; leadWork: string
  projectStatus?: string; acceptanceStatus?: string; owner?: string; approvalMonth?: string; startMonth?: string; endMonth?: string; duration?: string | number
  totalBudget: number | null; centralGrant: number | null; internalGrant?: number | null; selfFund: number | null; internalSelfFund?: number | null
  spent?: number | null; budget2026?: number | null; budget2026Actual?: number | null; budget2026Rate?: string
  closedActualBudget?: number | null; closedGrantSpent?: number | null; closedSelfSpent?: number | null; closedExecutionRate?: string; executionRate?: string
  resultCount?: number | null; resultNames?: string; convertedCount?: number | null; convertedNames?: string; convertedMonth?: string; convertedModel?: string
  reserveCount?: number | null; reserveNames?: string; reserveYear?: string; remarks?: string
  transformSummary: string; updatedBy: string; updatedAt: string
  validation: { ok: boolean; missing: string[]; warnings: string[] }
}
export interface TransitionToolData {
  fields: TransitionField[]
  cascade?: TransitionCascade
  rows: TransitionRow[]
  subtables: { name: string; count: number; totalBudget?: number; invalid?: number }[]
  summary: { total: number; valid: number; invalid: number; duplicates: string[]; lastUpdated: string | null; totalBudget?: number; centralGrant?: number; selfFund?: number }
  pending: string[]
}
