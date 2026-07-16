import type { TransitionCascade } from '../api/types'

export type CascadePartial = {
  level?: string
  sourceChannel?: string
  orgOffice?: string
  projectType?: string
}

export type CascadeResolveResult = {
  next: Required<CascadePartial>
  options: {
    levels: string[]
    sources: string[]
    offices: string[]
    types: string[]
  }
  valid: boolean
  issues: string[]
}

type CascadePath = {
  level: string
  sourceChannel: string
  orgOffice: string
  projectType: string
}

function unique(list: string[]) {
  return [...new Set(list.filter(Boolean))]
}

/** 从 cascade 索引展开为路径表（优先用服务端 paths） */
export function flattenCascadePaths(cascade: TransitionCascade): CascadePath[] {
  if (cascade.paths?.length) {
    return cascade.paths.filter((p) => p.level && p.sourceChannel && p.orgOffice && p.projectType)
  }
  const out: CascadePath[] = []
  const treeLevels = cascade.levels || []
  for (const level of treeLevels) {
    const bySource = cascade.typesByLevelSourceOffice?.[level] || {}
    for (const [sourceChannel, byOffice] of Object.entries(bySource)) {
      for (const [orgOffice, types] of Object.entries(byOffice || {})) {
        for (const projectType of types || []) {
          out.push({ level, sourceChannel, orgOffice, projectType })
        }
      }
    }
  }
  return out
}

function pathByTypeMap(cascade: TransitionCascade, paths: CascadePath[]) {
  if (cascade.pathByType && Object.keys(cascade.pathByType).length) return cascade.pathByType
  const map: Record<string, CascadePath> = {}
  for (const p of paths) {
    if (!map[p.projectType]) map[p.projectType] = p
  }
  return map
}

/**
 * 双向级联：
 * - 正向：改上层时，不兼容的下游立即清空
 * - 反向：改类型时唯一路径满回填；渠道/司局仅在上层为空时回填
 */
export function resolveCascade(
  cascade: TransitionCascade,
  partial: CascadePartial,
  opts?: {
    mode?: 'filter' | 'edit'
    driver?: 'level' | 'sourceChannel' | 'orgOffice' | 'projectType' | ''
    reverseBackfill?: boolean
    forwardClear?: boolean
    allSources?: string[]
    allTypes?: string[]
  },
): CascadeResolveResult {
  const reverseBackfill = opts?.reverseBackfill !== false
  const forwardClear = opts?.forwardClear !== false
  const driver = opts?.driver || ''
  const paths = flattenCascadePaths(cascade)
  const byType = pathByTypeMap(cascade, paths)
  const issues: string[] = []

  let level = partial.level || ''
  let sourceChannel = partial.sourceChannel || ''
  let orgOffice = partial.orgOffice || ''
  let projectType = partial.projectType || ''

  if (driver === 'projectType' && reverseBackfill && projectType && byType[projectType]) {
    const hit = byType[projectType]
    level = hit.level
    sourceChannel = hit.sourceChannel
    orgOffice = hit.orgOffice
  }

  if (forwardClear || driver === 'level' || driver === 'sourceChannel' || driver === 'orgOffice') {
    if (level && !paths.some((p) => p.level === level)) {
      level = ''
      issues.push('层级不在级联配置中，已清空')
    }

    if (sourceChannel) {
      const channelOk = paths.some((p) => (!level || p.level === level) && p.sourceChannel === sourceChannel)
      if (!channelOk) {
        sourceChannel = ''
        orgOffice = ''
        projectType = ''
        issues.push('渠道与当前层级不兼容，已清空下游')
      }
    }

    if (orgOffice) {
      const officeOk = paths.some((p) =>
        (!level || p.level === level)
        && (!sourceChannel || p.sourceChannel === sourceChannel)
        && p.orgOffice === orgOffice)
      if (!officeOk) {
        orgOffice = ''
        projectType = ''
        issues.push('司局/处室与当前层级·渠道不兼容，已清空类型')
      }
    }

    if (projectType && driver !== 'projectType') {
      const typeOk = paths.some((p) =>
        (!level || p.level === level)
        && (!sourceChannel || p.sourceChannel === sourceChannel)
        && (!orgOffice || p.orgOffice === orgOffice)
        && p.projectType === projectType)
      if (!typeOk) {
        projectType = ''
        issues.push('项目类型与当前上层选择不兼容，已清空')
      }
    }
  }

  if (driver !== 'projectType' && reverseBackfill && projectType && byType[projectType]) {
    const hit = byType[projectType]
    const conflict =
      (level && level !== hit.level)
      || (sourceChannel && sourceChannel !== hit.sourceChannel)
      || (orgOffice && orgOffice !== hit.orgOffice)
    if (!conflict) {
      if (!level) level = hit.level
      if (!sourceChannel) sourceChannel = hit.sourceChannel
      if (!orgOffice) orgOffice = hit.orgOffice
    }
  }

  if (reverseBackfill && sourceChannel && !level) {
    const levels = unique(paths.filter((p) => p.sourceChannel === sourceChannel).map((p) => p.level))
    if (levels.length === 1) level = levels[0]
  }
  if (reverseBackfill && orgOffice && (!sourceChannel || !level)) {
    const pool = paths.filter((p) =>
      p.orgOffice === orgOffice
      && (!level || p.level === level)
      && (!sourceChannel || p.sourceChannel === sourceChannel))
    const levels = unique(pool.map((p) => p.level))
    const sources = unique(pool.map((p) => p.sourceChannel))
    if (!level && levels.length === 1) level = levels[0]
    if (!sourceChannel && sources.length === 1) sourceChannel = sources[0]
  }

  const allLevels = cascade.levels?.length ? cascade.levels : unique(paths.map((p) => p.level))
  const sourcePool = level ? paths.filter((p) => p.level === level) : paths
  let sources = unique(sourcePool.map((p) => p.sourceChannel))
  if (opts?.allSources?.length) {
    sources = sources.filter((s) => opts.allSources!.includes(s))
    if (!sources.length) sources = unique(sourcePool.map((p) => p.sourceChannel))
  }

  const officePool = paths.filter((p) => {
    if (level && p.level !== level) return false
    if (sourceChannel && p.sourceChannel !== sourceChannel) return false
    return true
  })
  const offices = unique(officePool.map((p) => p.orgOffice))

  const typePool = paths.filter((p) => {
    if (level && p.level !== level) return false
    if (sourceChannel && p.sourceChannel !== sourceChannel) return false
    if (orgOffice && p.orgOffice !== orgOffice) return false
    return true
  })
  let types = unique(typePool.map((p) => p.projectType))
  if (!types.length && opts?.allTypes?.length) {
    types = level && cascade.typesByLevel?.[level]?.length
      ? cascade.typesByLevel[level]
      : opts.allTypes
  }

  if (opts?.mode === 'edit' && reverseBackfill && !projectType && types.length === 1) {
    projectType = types[0]
    const hit = byType[projectType]
    if (hit) {
      if (!orgOffice) orgOffice = hit.orgOffice
      if (!sourceChannel) sourceChannel = hit.sourceChannel
      if (!level) level = hit.level
    }
  }

  const next = { level, sourceChannel, orgOffice, projectType }
  const valid = !level && !sourceChannel && !orgOffice && !projectType
    ? true
    : paths.some((p) =>
      (!level || p.level === level)
      && (!sourceChannel || p.sourceChannel === sourceChannel)
      && (!orgOffice || p.orgOffice === orgOffice)
      && (!projectType || p.projectType === projectType))

  return {
    next,
    options: {
      levels: allLevels,
      sources,
      offices,
      types,
    },
    valid,
    issues,
  }
}

export function resolveOrgOfficeFromCascade(
  cascade: TransitionCascade,
  row: { orgOffice?: string; projectType?: string; sourceSheet?: string },
) {
  if (row.orgOffice) return row.orgOffice
  const type = row.projectType || row.sourceSheet || ''
  return cascade.pathByType?.[type]?.orgOffice || cascade.officeByType?.[type]?.office || ''
}

export function channelLabel(c: {
  source_channel?: string
  org_office?: string
  org?: string
  name: string
}) {
  const parts = [c.source_channel || '', c.org_office || c.org || '', c.name || ''].filter(Boolean)
  return parts.join(' → ') || '—'
}

/** 项目详情「项目渠道」展示：工信部 → 司局/处室 → 项目类型 */
export function formatProjectChannelPath(p: {
  sourceChannel?: string
  orgOffice?: string
  projectType?: string
  channelName?: string
}) {
  return channelLabel({
    source_channel: p.sourceChannel,
    org_office: p.orgOffice,
    name: p.projectType || p.channelName || '',
  })
}

/** 台账/驾驶舱筛选用叶子渠道条目 */
export type FilterChannel = {
  id: number
  name: string
  level: string
  source_channel?: string
  org_office?: string
  org?: string
  enabled?: number
}

/** 按层级收窄渠道叶子（启用项；空层级=全部） */
export function filterChannelsByLevel(channels: FilterChannel[], level: string) {
  return channels.filter((c) => c.enabled !== 0 && (!level || c.level === level))
}

/** 按 C 列 source_channel 做 optgroup 分组（组内按项目类型名排序） */
export function groupChannelsBySource(channels: FilterChannel[]) {
  const order: string[] = []
  const map = new Map<string, FilterChannel[]>()
  for (const c of channels) {
    const key = c.source_channel || '未归类'
    if (!map.has(key)) {
      map.set(key, [])
      order.push(key)
    }
    map.get(key)!.push(c)
  }
  for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
  return order.map((source) => ({ source, items: map.get(source)! }))
}

/**
 * 层级 ↔ 渠道叶子双向联动（筛选态）
 * - 改层级：渠道不兼容则清空
 * - 改渠道：层级冲突或为空时回填渠道所属层级
 */
export function syncLevelChannelFilter(
  channels: FilterChannel[],
  next: { level?: string; channelId?: string },
  driver: 'level' | 'channel',
): { level: string; channelId: string } {
  let level = next.level || ''
  let channelId = next.channelId || ''
  const enabled = channels.filter((c) => c.enabled !== 0)

  if (driver === 'level') {
    if (channelId) {
      const hit = enabled.find((c) => String(c.id) === String(channelId))
      if (!hit || (level && hit.level !== level)) channelId = ''
    }
  }

  if (driver === 'channel') {
    if (channelId) {
      const hit = enabled.find((c) => String(c.id) === String(channelId))
      if (hit) {
        if (!level || level !== hit.level) level = hit.level
      } else {
        channelId = ''
      }
    }
  }

  return { level, channelId }
}
