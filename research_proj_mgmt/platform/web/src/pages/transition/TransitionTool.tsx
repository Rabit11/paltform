import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileSpreadsheet, RefreshCcw, Save, UploadCloud } from 'lucide-react'
import { api, apiUpload } from '../../api/client'
import type { TransitionRow, TransitionToolData } from '../../api/types'
import { Btn, Card, Empty, Field, Input, KPI, Modal, Select, Tag, Textarea, useToast } from '../../components/ui'
import { wan } from '../../lib/format'
import { resolveCascade, resolveOrgOfficeFromCascade } from '../../lib/cascadePath'

type UploadMode = 'replace' | 'merge'
type ImportReport = {
  file: string
  mode: UploadMode
  imported: number
  added: number
  updated: number
  skipped: number
  errors?: { row?: number | string; name?: string; issue: string }[]
  issues?: { sheet?: string; row?: number; issue: string }[]
}

type FilterState = { level: string; sourceChannel: string; orgOffice: string; projectType: string }

const EMPTY_FILTER: FilterState = { level: '', sourceChannel: '', orgOffice: '', projectType: '' }

export default function TransitionTool() {
  const toast = useToast()
  const [data, setData] = useState<TransitionToolData | null>(null)
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTER)
  const [filterDriver, setFilterDriver] = useState<keyof FilterState | ''>('')
  const [edit, setEdit] = useState<TransitionRow | null>(null)
  const [editDriver, setEditDriver] = useState<keyof FilterState | ''>('')
  const [busy, setBusy] = useState(false)
  const [reports, setReports] = useState<ImportReport[]>([])
  const uploadRef = useRef<HTMLInputElement | null>(null)
  const uploadModeRef = useRef<UploadMode>('merge')

  const load = useCallback(() => { api.get<TransitionToolData>('/transition-tool').then(setData) }, [])
  useEffect(load, [load])

  const cascade = data?.cascade

  const filterResolved = useMemo(() => {
    if (!cascade) {
      return {
        next: filters,
        options: { levels: ['国家级', '地方级', '公司级'], sources: [] as string[], offices: [] as string[], types: [] as string[] },
      }
    }
    return resolveCascade(cascade, filters, {
      mode: 'filter',
      driver: filterDriver,
      reverseBackfill: true,
      forwardClear: true,
    })
  }, [cascade, filters, filterDriver])

  useEffect(() => {
    if (!cascade) return
    const n = filterResolved.next
    if (
      n.level !== filters.level
      || n.sourceChannel !== filters.sourceChannel
      || n.orgOffice !== filters.orgOffice
      || n.projectType !== filters.projectType
    ) {
      setFilters({
        level: n.level,
        sourceChannel: n.sourceChannel,
        orgOffice: n.orgOffice,
        projectType: n.projectType,
      })
    }
  }, [cascade, filterResolved.next, filters])

  const editResolved = useMemo(() => {
    if (!cascade || !edit) return null
    return resolveCascade(cascade, {
      level: edit.level,
      sourceChannel: edit.sourceChannel || edit.channel,
      orgOffice: edit.orgOffice,
      projectType: edit.projectType || edit.sourceSheet,
    }, { mode: 'edit', driver: editDriver, reverseBackfill: true, forwardClear: true })
  }, [cascade, edit, editDriver])

  useEffect(() => {
    if (!edit || !editResolved) return
    const n = editResolved.next
    if (
      n.level !== edit.level
      || n.sourceChannel !== (edit.sourceChannel || edit.channel)
      || n.orgOffice !== (edit.orgOffice || '')
      || n.projectType !== (edit.projectType || edit.sourceSheet)
    ) {
      setEdit({
        ...edit,
        level: n.level,
        sourceChannel: n.sourceChannel,
        channel: n.sourceChannel,
        orgOffice: n.orgOffice,
        projectType: n.projectType,
        sourceType: n.projectType,
        sourceSheet: n.projectType,
      })
    }
  }, [edit, editResolved])

  const rows = useMemo(() => {
    const f = filterResolved.next
    return (data?.rows || []).filter((r) => {
      const office = cascade ? resolveOrgOfficeFromCascade(cascade, r) : (r.orgOffice || '')
      if (f.level && r.level !== f.level) return false
      if (f.sourceChannel && (r.sourceChannel || r.channel) !== f.sourceChannel) return false
      if (f.orgOffice && office !== f.orgOffice) return false
      if (f.projectType && (r.projectType || r.sourceSheet) !== f.projectType) return false
      return true
    })
  }, [data, filterResolved.next, cascade])

  const byGroup = useMemo(() => {
    const g: Record<string, number> = {}
    for (const f of data?.fields || []) g[f.group] = (g[f.group] || 0) + 1
    return Object.entries(g)
  }, [data])

  const importDemo = async () => {
    setBusy(true)
    try {
      const r = await api.post<{ imported: number }>('/transition-tool/import-demo')
      toast(`已按 V19 字段口径模拟批量导入 ${r.imported} 行`)
      load()
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }

  const pickFiles = (mode: UploadMode) => {
    uploadModeRef.current = mode
    uploadRef.current?.click()
  }

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const mode = uploadModeRef.current
    setBusy(true)
    const nextReports: ImportReport[] = []
    try {
      for (let i = 0; i < files.length; i += 1) {
        const upload = await apiUpload(files[i])
        const importMode: UploadMode = mode === 'replace' && i > 0 ? 'merge' : mode
        const report = await api.post<ImportReport>('/transition-tool/import-upload', { uploadId: upload.id, mode: importMode })
        nextReports.push(report)
      }
      setReports(nextReports)
      const added = nextReports.reduce((s, x) => s + x.added, 0)
      const updated = nextReports.reduce((s, x) => s + x.updated, 0)
      toast(`上传完成：新增 ${added} 行，更新 ${updated} 行`)
      load()
    } catch (e) {
      toast((e as Error).message, 'err')
    } finally {
      if (uploadRef.current) uploadRef.current.value = ''
      setBusy(false)
    }
  }

  const save = async () => {
    if (!edit) return
    if (editResolved && !editResolved.valid) {
      toast('层级/渠道/司局/项目类型组合不合法', 'err')
      return
    }
    setBusy(true)
    try {
      await api.post('/transition-tool/records', edit)
      toast('分表记录已保存，总表已自动汇总更新')
      setEdit(null); load()
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }

  const applyFilter = (key: keyof FilterState, value: string) => {
    setFilterDriver(key)
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  if (!data) return <div className="text-faint text-sm py-20 text-center">正在加载表单过渡工具…</div>

  return (
    <div className="flex flex-col gap-4 fade-up">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold">表单过渡工具</div>
          <div className="text-[11.5px] text-faint mt-0.5">用于正式平台上线前的专项分表维护、自动汇总总表、批量导入和一键导出；拆分依据为样例表 D 列“项目类型”。司局/处室仅辅助筛选，不写入 Excel。</div>
        </div>
        <div className="flex items-center gap-2">
          <input ref={uploadRef} type="file" accept=".xlsx,.xls" multiple className="hidden" onChange={(e) => importFiles(e.target.files)} />
          <Btn disabled={busy} onClick={() => pickFiles('replace')}><UploadCloud size={14} />重新导入总表</Btn>
          <Btn disabled={busy} onClick={() => pickFiles('merge')}><UploadCloud size={14} />批量上传分表</Btn>
          <Btn disabled={busy} onClick={importDemo}><RefreshCcw size={14} />模拟批量导入</Btn>
          <a href="/api/transition-tool/export.xlsx" download><Btn variant="primary"><Download size={14} />导出总表+分表</Btn></a>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3">
        <KPI label="总表记录" value={data.summary.total} unit="行" tone="accent" />
        <KPI label="校验通过" value={data.summary.valid} unit="行" tone="green" />
        <KPI label="待修正" value={data.summary.invalid} unit="行" tone={data.summary.invalid ? 'yellow' : 'green'} />
        <KPI label="项目类型分表" value={data.subtables.filter((x) => x.count > 0).length} unit="张" />
        <KPI label="总经费合计" value={data.summary.totalBudget || 0} unit="万元" decimals={1} sub={`国拨 ${wan(data.summary.centralGrant, 1)} / 自筹 ${wan(data.summary.selfFund, 1)}`} />
      </div>

      <Card title="双向级联筛选" extra={<Btn size="sm" onClick={() => { setFilterDriver(''); setFilters(EMPTY_FILTER) }}>清空</Btn>}>
        <div className="grid grid-cols-4 gap-3">
          <Field label="全部层级">
            <Select value={filters.level} onChange={(e) => applyFilter('level', e.target.value)}>
              <option value="">全部层级</option>
              {filterResolved.options.levels.map((x) => <option key={x}>{x}</option>)}
            </Select>
          </Field>
          <Field label="全部渠道">
            <Select value={filters.sourceChannel} onChange={(e) => applyFilter('sourceChannel', e.target.value)}>
              <option value="">全部渠道</option>
              {filterResolved.options.sources.map((x) => <option key={x}>{x}</option>)}
            </Select>
          </Field>
          <Field label="全部司局/处室" hint="辅助筛选，不写入 Excel">
            <Select value={filters.orgOffice} onChange={(e) => applyFilter('orgOffice', e.target.value)}>
              <option value="">全部司局/处室</option>
              {filterResolved.options.offices.map((x) => <option key={x}>{x}</option>)}
            </Select>
          </Field>
          <Field label="全部项目类型">
            <Select value={filters.projectType} onChange={(e) => applyFilter('projectType', e.target.value)}>
              <option value="">全部项目类型</option>
              {filterResolved.options.types.map((x) => <option key={x}>{x}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      <div className="grid grid-cols-12 gap-4">
        <Card title="项目类型分表" className="col-span-3">
          <div className="flex flex-col gap-2">
            <button onClick={() => applyFilter('projectType', '')} className={`text-left px-3 py-2 rounded-lg border cursor-pointer ${filters.projectType === '' ? 'border-accent text-accent bg-[rgba(56,189,248,0.08)]' : 'border-line2 text-dim hover:text-ink'}`}>
              全部总表 <span className="num float-right">{data.summary.total}</span>
            </button>
            {data.subtables.map((s) => (
              <button key={s.name} onClick={() => applyFilter('projectType', s.name)} className={`text-left px-3 py-2 rounded-lg border cursor-pointer ${filters.projectType === s.name ? 'border-accent text-accent bg-[rgba(56,189,248,0.08)]' : 'border-line2 text-dim hover:text-ink'}`}>
                {s.name} <span className="num float-right">{s.count}</span>
                <div className="text-[10.5px] text-faint mt-1">经费 {wan(s.totalBudget, 1)} 万 · 问题 {s.invalid || 0}</div>
              </button>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-line">
            <div className="text-[11px] tracking-wider text-faint mb-2">字段板块</div>
            <div className="flex flex-wrap gap-1.5">
              {byGroup.map(([g, n]) => <Tag key={g} tone="dim">{g} · {n}</Tag>)}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-line">
            <div className="text-[11px] tracking-wider text-faint mb-2">接口待补充</div>
            <div className="flex flex-col gap-1.5">
              {data.pending.map((p) => <span key={p} className="text-[11.5px] text-syellow">· {p}</span>)}
            </div>
          </div>
          {reports.length > 0 && (
            <div className="mt-4 pt-4 border-t border-line">
              <div className="text-[11px] tracking-wider text-faint mb-2">最近导入</div>
              <div className="flex flex-col gap-2">
                {reports.map((r) => (
                  <div key={`${r.file}-${r.mode}`} className="rounded-lg border border-line2 px-2.5 py-2">
                    <div className="text-[11.5px] text-dim truncate">{r.file}</div>
                    <div className="text-[10.5px] text-faint mt-1">解析 {r.imported} · 新增 {r.added} · 更新 {r.updated} · 跳过 {r.skipped}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card title={<span className="flex items-center gap-2"><FileSpreadsheet size={15} />自动汇总总表</span>}
          extra={<Tag tone={data.summary.duplicates.length ? 'yellow' : 'green'}>{data.summary.duplicates.length ? `重复 ${data.summary.duplicates.length}` : '无重复项目'}</Tag>}
          className="col-span-9" pad={false}>
          <div className="overflow-x-auto max-h-[calc(100vh-420px)]">
            <table className="dtable">
              <thead><tr><th>项目类型</th><th>序号/项目名称</th><th>级别/渠道/司局</th><th>单位/状态</th><th>经费</th><th>成果转化</th><th>校验</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const office = cascade ? resolveOrgOfficeFromCascade(cascade, r) : (r.orgOffice || '')
                  return (
                    <tr key={r.id}>
                      <td>
                        <Tag tone={r.level === '国家级' ? 'accent' : r.level === '地方级' ? 'violet' : 'dim'}>{r.projectType || r.sourceSheet}</Tag>
                        <div className="text-[10.5px] text-faint mt-1">{r.updatedBy} · {r.updatedAt}</div>
                      </td>
                      <td>
                        <div className="num text-accent text-[11px]">序号 {r.serial || r.code || '—'}</div>
                        <div className="max-w-[240px] truncate">{r.name}</div>
                      </td>
                      <td className="text-dim">
                        {r.level}
                        <div className="text-[10.5px] text-faint max-w-[190px] truncate">{r.sourceChannel || r.channel || '—'}</div>
                        <div className="text-[10.5px] text-faint max-w-[190px] truncate">{office || '未归类'}</div>
                      </td>
                      <td className="text-dim">{r.responsibleUnit || r.demandUnit || '—'}<div className="text-[10.5px] text-faint">{r.projectStatus || r.acceptanceStatus || '—'}</div></td>
                      <td className="num text-dim">{wan(r.totalBudget)} 万<div className="text-[10.5px] text-faint">国拨 {wan(r.centralGrant)} / 自筹 {wan(r.selfFund)}</div></td>
                      <td className="max-w-[190px] truncate text-dim">{r.transformSummary}</td>
                      <td>{r.validation.ok ? <Tag tone="green">通过</Tag> : <Tag tone="yellow">{r.validation.missing.length + r.validation.warnings.length} 项问题</Tag>}</td>
                      <td className="text-right"><Btn size="sm" onClick={() => { setEditDriver(''); setEdit(r) }}>维护</Btn></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {rows.length === 0 && <Empty text="当前筛选下暂无记录" />}
          </div>
        </Card>
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="维护专项分表记录" width={680}>
        {edit && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="序号"><Input value={edit.serial || ''} onChange={(e) => setEdit({ ...edit, serial: e.target.value, code: e.target.value })} /></Field>
              <Field label="项目名称" required><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="项目级别" required>
                <Select value={edit.level} onChange={(e) => {
                  setEditDriver('level')
                  setEdit({ ...edit, level: e.target.value })
                }}>
                  {(editResolved?.options.levels || ['国家级', '地方级', '公司级']).map((x) => <option key={x}>{x}</option>)}
                </Select>
              </Field>
              <Field label="项目来源/渠道" required>
                <Select value={edit.sourceChannel || edit.channel || ''} onChange={(e) => {
                  setEditDriver('sourceChannel')
                  setEdit({ ...edit, sourceChannel: e.target.value, channel: e.target.value })
                }}>
                  <option value="">请选择</option>
                  {(editResolved?.options.sources || []).map((x) => <option key={x}>{x}</option>)}
                </Select>
              </Field>
              <Field label="司局/处室" hint="辅助字段，不导出 Excel">
                <Select value={edit.orgOffice || ''} onChange={(e) => {
                  setEditDriver('orgOffice')
                  setEdit({ ...edit, orgOffice: e.target.value })
                }}>
                  <option value="">请选择</option>
                  {(editResolved?.options.offices || []).map((x) => <option key={x}>{x}</option>)}
                </Select>
              </Field>
              <Field label="项目类型" required>
                <Select value={edit.projectType || edit.sourceSheet || ''} onChange={(e) => {
                  setEditDriver('projectType')
                  setEdit({ ...edit, projectType: e.target.value, sourceType: e.target.value, sourceSheet: e.target.value })
                }}>
                  <option value="">请选择</option>
                  {(editResolved?.options.types || []).map((x) => <option key={x}>{x}</option>)}
                </Select>
              </Field>
              <Field label="责任单位" required><Input value={edit.responsibleUnit || ''} onChange={(e) => setEdit({ ...edit, responsibleUnit: e.target.value })} /></Field>
              <Field label="项目状态" required><Input value={edit.projectStatus || ''} onChange={(e) => setEdit({ ...edit, projectStatus: e.target.value })} /></Field>
              <Field label="内部负责人"><Input value={edit.owner || ''} onChange={(e) => setEdit({ ...edit, owner: e.target.value })} /></Field>
              <Field label="总经费(万元)" required><Input type="number" value={edit.totalBudget ?? ''} onChange={(e) => setEdit({ ...edit, totalBudget: Number(e.target.value) || 0 })} /></Field>
              <Field label="国拨/自筹(万元)">
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" value={edit.centralGrant ?? ''} onChange={(e) => setEdit({ ...edit, centralGrant: Number(e.target.value) || 0 })} />
                  <Input type="number" value={edit.selfFund ?? ''} onChange={(e) => setEdit({ ...edit, selfFund: Number(e.target.value) || 0 })} />
                </div>
              </Field>
            </div>
            <Field label="产生成果名称"><Textarea rows={2} value={edit.resultNames || ''} onChange={(e) => setEdit({ ...edit, resultNames: e.target.value, transformSummary: e.target.value || edit.transformSummary })} /></Field>
            <Field label="成果转化情况"><Textarea rows={2} value={edit.transformSummary || ''} onChange={(e) => setEdit({ ...edit, transformSummary: e.target.value })} /></Field>
            {editResolved && !editResolved.valid && (
              <div className="rounded-lg border border-[rgba(248,113,113,0.32)] bg-[rgba(248,113,113,0.08)] px-3 py-2 text-[12px] text-sred">
                当前四级组合不在合法路径表内，请修正后再保存
              </div>
            )}
            {!edit.validation?.ok && (
              <div className="rounded-lg border border-[rgba(251,191,36,0.32)] bg-[rgba(251,191,36,0.08)] px-3 py-2 text-[12px] text-syellow">
                {edit.validation.missing.concat(edit.validation.warnings).join('；') || '保存后将重新校验'}
              </div>
            )}
            <div className="flex justify-end gap-2.5">
              <Btn onClick={() => setEdit(null)}>取消</Btn>
              <Btn variant="primary" disabled={busy || (editResolved ? !editResolved.valid : false)} onClick={save}><Save size={14} />保存并汇总</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
