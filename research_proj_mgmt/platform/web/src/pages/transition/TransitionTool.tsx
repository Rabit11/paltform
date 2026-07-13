import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Download, FileSpreadsheet, Save, Search, UploadCloud, XCircle } from 'lucide-react'
import { api, apiUpload } from '../../api/client'
import type { TransitionImportBatch, TransitionRow, TransitionToolData } from '../../api/types'
import { Btn, Card, Empty, Field, Input, KPI, Modal, Select, Tag, Textarea, useToast } from '../../components/ui'
import { wan } from '../../lib/format'

const LEVELS = ['国家级', '地方级', '公司级']
type UploadMode = 'replace' | 'merge'
type ImportUploadResponse = { batch: TransitionImportBatch }
type TransitionFieldMeta = TransitionToolData['fields'][number]

function excelColName(index: number) {
  let n = index + 1
  let name = ''
  while (n > 0) {
    const mod = (n - 1) % 26
    name = String.fromCharCode(65 + mod) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

function fieldMinWidth(field: TransitionFieldMeta) {
  return Math.max(86, Math.min(260, (field.width || 14) * 8))
}

function transitionCellValue(row: TransitionRow, field: TransitionFieldMeta) {
  const values: Record<string, unknown> = {
    serial: row.serial || row.code,
    sourceChannel: row.sourceChannel || row.channel,
    projectType: row.projectType || row.sourceSheet,
    demandUnit: row.demandUnit,
    responsibleUnit: row.responsibleUnit,
    totalBudget: row.totalBudget,
    centralGrant: row.centralGrant,
    internalGrant: row.internalGrant,
    selfFund: row.selfFund,
    internalSelfFund: row.internalSelfFund,
    spent: row.spent,
    budget2026: row.budget2026,
    budget2026Actual: row.budget2026Actual,
    closedActualBudget: row.closedActualBudget,
    closedGrantSpent: row.closedGrantSpent,
    closedSelfSpent: row.closedSelfSpent,
    resultCount: row.resultCount,
    convertedCount: row.convertedCount,
    reserveCount: row.reserveCount,
  }
  const value = Object.prototype.hasOwnProperty.call(values, field.code)
    ? values[field.code]
    : (row as unknown as Record<string, unknown>)[field.code]
  if (value == null || value === '') return '—'
  if (field.number && typeof value === 'number') return wan(value, 1)
  return String(value)
}

export default function TransitionTool() {
  const toast = useToast()
  const [data, setData] = useState<TransitionToolData | null>(null)
  const [kw, setKw] = useState('')
  const [level, setLevel] = useState('')
  const [channel, setChannel] = useState('')
  const [unit, setUnit] = useState('')
  const [status, setStatus] = useState('')
  const [color, setColor] = useState('')
  const [projectType, setProjectType] = useState('')
  const [edit, setEdit] = useState<TransitionRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [previewBatches, setPreviewBatches] = useState<TransitionImportBatch[]>([])
  const [activeBatchId, setActiveBatchId] = useState<number | null>(null)
  const uploadRef = useRef<HTMLInputElement | null>(null)
  const uploadModeRef = useRef<UploadMode>('merge')

  const load = useCallback(() => { api.get<TransitionToolData>('/transition-tool').then(setData) }, [])
  useEffect(load, [load])

  const rows = useMemo(() => (data?.rows || []).filter((r) => {
    if (projectType && (r.projectType || r.sourceSheet) !== projectType) return false
    if (level && r.level !== level) return false
    if (channel && (r.sourceChannel || r.channel) !== channel) return false
    if (unit && ![r.responsibleUnit, r.demandUnit, r.center].some((x) => x === unit)) return false
    if (status && (r.projectStatus || r.acceptanceStatus) !== status) return false
    if (color && r.color !== color) return false
    if (kw.trim()) {
      const needle = kw.trim().toLowerCase()
      const hay = [r.serial, r.code, r.name, r.projectType, r.sourceChannel, r.responsibleUnit].join(' ').toLowerCase()
      if (!hay.includes(needle)) return false
    }
    return true
  }), [data, projectType, level, channel, unit, status, color, kw])
  const filteredSummary = useMemo(() => ({
    total: rows.length,
    valid: rows.filter((r) => r.validation.ok).length,
    invalid: rows.filter((r) => !r.validation.ok).length,
    budget: rows.reduce((s, r) => s + (Number(r.totalBudget) || 0), 0),
    centralGrant: rows.reduce((s, r) => s + (Number(r.centralGrant) || 0), 0),
    selfFund: rows.reduce((s, r) => s + (Number(r.selfFund) || 0), 0),
  }), [rows])
  const exportQuery = useMemo(() => {
    const q = new URLSearchParams()
    if (kw.trim()) q.set('kw', kw.trim())
    if (projectType) q.set('projectType', projectType)
    if (level) q.set('level', level)
    if (channel) q.set('channel', channel)
    if (unit) q.set('unit', unit)
    if (status) q.set('status', status)
    if (color) q.set('color', color)
    const s = q.toString()
    return s ? `?${s}` : ''
  }, [kw, projectType, level, channel, unit, status, color])
  const excelFields = useMemo(
    () => [...(data?.fields || [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)),
    [data],
  )
  const excelGroups = useMemo(() => {
    const groups: { name: string; span: number }[] = []
    for (const field of excelFields) {
      const last = groups[groups.length - 1]
      if (last && last.name === field.group) last.span += 1
      else groups.push({ name: field.group, span: 1 })
    }
    return groups
  }, [excelFields])
  const latestBatch = useMemo(() => data?.batches[0] || null, [data])
  const currentTypeCount = useMemo(() => {
    const set = new Set(rows.map((r) => r.projectType || r.sourceSheet).filter(Boolean))
    return set.size
  }, [rows])
  const activeBatch = useMemo(
    () => previewBatches.find((x) => x.id === activeBatchId) || null,
    [previewBatches, activeBatchId],
  )

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
    const batches: TransitionImportBatch[] = []
    try {
      for (let i = 0; i < files.length; i += 1) {
        const upload = await apiUpload(files[i])
        const importMode: UploadMode = mode === 'replace' && i > 0 ? 'merge' : mode
        const result = await api.post<ImportUploadResponse>('/transition-tool/import-upload', { uploadId: upload.id, mode: importMode })
        batches.push(result.batch)
      }
      setPreviewBatches(batches)
      setActiveBatchId(batches[0]?.id || null)
      const added = batches.reduce((s, x) => s + x.added_count, 0)
      const updated = batches.reduce((s, x) => s + x.updated_count, 0)
      const invalid = batches.reduce((s, x) => s + x.invalid_count, 0)
      toast(`预校验完成：待新增 ${added} 行，待更新 ${updated} 行，问题 ${invalid} 行`)
      load()
    } catch (e) {
      toast((e as Error).message, 'err')
    } finally {
      if (uploadRef.current) uploadRef.current.value = ''
      setBusy(false)
    }
  }

  const openBatch = async (id: number) => {
    setBusy(true)
    try {
      const r = await api.get<{ batch: TransitionImportBatch }>(`/transition-tool/import-batches/${id}`)
      setPreviewBatches((old) => {
        const rest = old.filter((x) => x.id !== r.batch.id)
        return [r.batch, ...rest]
      })
      setActiveBatchId(r.batch.id)
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }

  const confirmBatch = async (id: number) => {
    setBusy(true)
    try {
      const r = await api.post<{ batch: TransitionImportBatch }>(`/transition-tool/import-batches/${id}/confirm`)
      toast(`已确认入库：新增 ${r.batch.added_count} 行，更新 ${r.batch.updated_count} 行`)
      setPreviewBatches((old) => old.filter((x) => x.id !== id))
      setActiveBatchId(null)
      load()
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }

  const cancelBatch = async (id: number) => {
    setBusy(true)
    try {
      await api.post(`/transition-tool/import-batches/${id}/cancel`)
      toast('已取消该导入批次，未写入总表')
      setPreviewBatches((old) => old.filter((x) => x.id !== id))
      setActiveBatchId(null)
      load()
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }

  const save = async () => {
    if (!edit) return
    setBusy(true)
    try {
      await api.post('/transition-tool/records', edit)
      toast('分表记录已保存，总表已自动汇总更新')
      setEdit(null); load()
    } catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }

  if (!data) return <div className="text-faint text-sm py-20 text-center">正在加载表单过渡工具…</div>

  return (
    <div className="flex flex-col gap-4 fade-up">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold">表单过渡工具</div>
          <div className="text-[11.5px] text-faint mt-0.5">字段、项目类型、一级/二级专业均以《预先研究项目信息-表头 (1).xlsx》为准；样例表仅用于导入测试，不作为完整字典。</div>
        </div>
      </div>

      <Card pad className="!p-3.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <input ref={uploadRef} type="file" accept=".xlsx,.xls" multiple className="hidden" onChange={(e) => importFiles(e.target.files)} />
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <Input aria-label="搜索" placeholder="序号 / 项目名称 / 编号" value={kw} onChange={(e) => setKw(e.target.value)} style={{ width: 230, paddingLeft: 32 }} />
          </div>
          <Select aria-label="层级" value={level} onChange={(e) => setLevel(e.target.value)} style={{ width: 108 }}>
            <option value="">全部层级</option>
            {(data.filterOptions.levels || LEVELS).map((x) => <option key={x}>{x}</option>)}
          </Select>
          <Select aria-label="渠道" value={channel} onChange={(e) => setChannel(e.target.value)} style={{ width: 180 }}>
            <option value="">全部渠道</option>
            {data.filterOptions.channels.map((x) => <option key={x}>{x}</option>)}
          </Select>
          <Select aria-label="项目类型" value={projectType} onChange={(e) => setProjectType(e.target.value)} style={{ width: 180 }}>
            <option value="">全部项目类型</option>
            {data.dictionaries.projectTypes.concat(data.subtables.map((x) => x.name)).filter((x, i, a) => x && a.indexOf(x) === i).map((x) => <option key={x}>{x}</option>)}
          </Select>
          <Select aria-label="单位" value={unit} onChange={(e) => setUnit(e.target.value)} style={{ width: 150 }}>
            <option value="">全部单位</option>
            {data.filterOptions.units.map((x) => <option key={x}>{x}</option>)}
          </Select>
          <Select aria-label="状态" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 120 }}>
            <option value="">全部状态</option>
            {data.filterOptions.statuses.map((x) => <option key={x}>{x}</option>)}
          </Select>
          <Select aria-label="预警" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 110 }}>
            <option value="">全部预警</option>
            <option value="red">红</option><option value="yellow">黄</option><option value="blue">蓝</option><option value="green">绿</option>
          </Select>
          <div className="grow" />
          <Btn disabled={busy} onClick={() => pickFiles('replace')}><UploadCloud size={14} />预校验总表</Btn>
          <Btn disabled={busy} onClick={() => pickFiles('merge')}><UploadCloud size={14} />预校验分表</Btn>
          <a href={`/api/transition-tool/export.xlsx${exportQuery}`} download><Btn variant="primary"><Download size={14} />导出 Excel</Btn></a>
          <a href={`/api/transition-tool/export-package.zip${exportQuery}`} download><Btn variant="primary"><Download size={14} />导出分表包</Btn></a>
        </div>
      </Card>

      <Card
        title={<span className="flex items-center gap-2"><FileSpreadsheet size={15} />预先研究项目信息</span>}
        extra={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Tag tone="accent">{filteredSummary.total} 行</Tag>
            <Tag tone="dim">{excelFields.length} 列 · A:AN</Tag>
            <Tag tone={filteredSummary.invalid ? 'yellow' : 'green'}>{filteredSummary.invalid ? `待修正 ${filteredSummary.invalid}` : '校验通过'}</Tag>
            <Tag tone="dim">项目类型 {currentTypeCount}</Tag>
            <Tag tone="dim">经费 {wan(filteredSummary.budget, 1)} 万</Tag>
            {data.summary.duplicates.length > 0 && <Tag tone="yellow">重复 {data.summary.duplicates.length}</Tag>}
            {latestBatch && <button onClick={() => openBatch(latestBatch.id)} className="chip hover:text-accent">{latestBatch.status} · {latestBatch.file_name}</button>}
          </div>
        }
        pad={false}
        className="overflow-hidden"
      >
        <div className="overflow-x-auto max-h-[calc(100vh-260px)]">
          <table className="excel-ledger-table">
            <thead>
              <tr>
                {excelGroups.map((group) => (
                  <th key={group.name} colSpan={group.span} className="excel-group">{group.name}</th>
                ))}
              </tr>
              <tr>
                {excelFields.map((field, i) => (
                  <th key={field.code} style={{ minWidth: fieldMinWidth(field) }}>
                    <span className="excel-col">{excelColName(field.index ?? i)}</span>
                    {field.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} onClick={() => setEdit(row)} className={!row.validation.ok ? 'row-warning' : ''}>
                  {excelFields.map((field) => {
                    const value = transitionCellValue(row, field)
                    const isNumber = field.number || typeof (row as unknown as Record<string, unknown>)[field.code] === 'number'
                    return (
                      <td
                        key={field.code}
                        title={value}
                        className={`${isNumber ? 'num text-right' : ''} ${field.code === 'name' ? 'font-medium text-ink' : ''}`}
                        style={{ minWidth: fieldMinWidth(field), maxWidth: fieldMinWidth(field) + 70 }}
                      >
                        {value}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <Empty text="当前筛选条件下暂无记录" />}
        </div>
      </Card>

      <Modal open={!!activeBatch} onClose={() => setActiveBatchId(null)} title="导入批次校验预览" width={960}>
        {activeBatch && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-5 gap-3">
              <KPI label="解析记录" value={activeBatch.parsed_count} unit="行" />
              <KPI label="待新增" value={activeBatch.added_count} unit="行" tone="green" />
              <KPI label="待更新" value={activeBatch.updated_count} unit="行" tone="accent" />
              <KPI label="问题行" value={activeBatch.invalid_count} unit="行" tone={activeBatch.invalid_count ? 'yellow' : 'green'} />
              <div className="card px-4 py-3 flex flex-col gap-1 min-w-0">
                <div className="text-[11.5px] tracking-wider text-dim">批次状态</div>
                <div className="text-[22px] leading-8 font-semibold">{activeBatch.status}</div>
              </div>
            </div>

            <div className="rounded-lg border border-line2 px-3.5 py-3">
              <div className="flex items-center gap-2">
                {activeBatch.invalid_count ? <XCircle size={16} className="text-syellow" /> : <CheckCircle2 size={16} className="text-sgreen" />}
                <div className="text-[12.5px] font-medium">{activeBatch.file_name}</div>
                <Tag tone={activeBatch.mode === 'replace' ? 'yellow' : 'accent'}>{activeBatch.mode === 'replace' ? '总表替换' : '分表合并'}</Tag>
              </div>
              <div className="text-[11.5px] text-faint mt-1.5">上传人：{activeBatch.uploaded_by} · 上传时间：{activeBatch.uploaded_at}</div>
              {activeBatch.issues.length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  {activeBatch.issues.slice(0, 4).map((x, i) => <div key={i} className="text-[11.5px] text-syellow">{x.sheet || '工作表'}：{x.issue}</div>)}
                </div>
              )}
            </div>

            <div className="overflow-x-auto max-h-[360px] rounded-lg border border-line">
              <table className="dtable">
                <thead><tr><th>动作</th><th>行号</th><th>项目类型</th><th>项目名称</th><th>校验结果</th><th>说明</th></tr></thead>
                <tbody>
                  {(activeBatch.rows || []).slice(0, 120).map((x) => (
                    <tr key={x.id}>
                      <td>
                        <Tag tone={x.action === 'add' ? 'green' : x.action === 'update' ? 'accent' : 'yellow'}>
                          {x.action === 'add' ? '新增' : x.action === 'update' ? '更新' : '跳过'}
                        </Tag>
                      </td>
                      <td className="num text-dim">{x.rowNo || '—'}</td>
                      <td className="text-dim">{x.projectType || '未分类'}</td>
                      <td className="max-w-[280px] truncate">{x.projectName || x.row.name || '—'}</td>
                      <td>{x.validation.ok ? <Tag tone="green">通过</Tag> : <Tag tone="yellow">不通过</Tag>}</td>
                      <td className={x.issue ? 'text-syellow max-w-[360px]' : 'text-faint'}>
                        {x.issue || x.validation.missing.concat(x.validation.warnings).join('；') || '确认后写入台账'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(activeBatch.rows || []).length === 0 && <Empty text="该批次暂无行级明细" />}
            </div>

            {activeBatch.invalid_count > 0 && (
              <div className="rounded-lg border border-[rgba(251,191,36,0.32)] bg-[rgba(251,191,36,0.08)] px-3 py-2 text-[12px] text-syellow">
                存在问题行，系统不会入库。请按校验说明修正 Excel 后重新上传。
              </div>
            )}

            <div className="flex justify-end gap-2.5">
              {['待确认', '待修正'].includes(activeBatch.status) && <Btn disabled={busy} onClick={() => cancelBatch(activeBatch.id)}>取消批次</Btn>}
              <Btn variant="primary" disabled={busy || activeBatch.status !== '待确认' || activeBatch.invalid_count > 0} onClick={() => confirmBatch(activeBatch.id)}>
                <CheckCircle2 size={14} />确认入库
              </Btn>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="维护专项分表记录" width={660}>
        {edit && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="序号"><Input value={edit.serial || ''} onChange={(e) => setEdit({ ...edit, serial: e.target.value, code: e.target.value })} /></Field>
              <Field label="项目名称" required><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="项目级别" required>
                <Select value={edit.level} onChange={(e) => setEdit({ ...edit, level: e.target.value })}>
                  {LEVELS.map((x) => <option key={x}>{x}</option>)}
                </Select>
              </Field>
              <Field label="项目来源/渠道" required>
                <Select value={edit.sourceChannel || edit.channel || ''} onChange={(e) => setEdit({ ...edit, sourceChannel: e.target.value, channel: e.target.value })}>
                  <option value="">请选择</option>
                  {data.dictionaries.sourceChannels.concat(data.filterOptions.channels).filter((x, i, a) => x && a.indexOf(x) === i).map((x) => <option key={x}>{x}</option>)}
                </Select>
              </Field>
              <Field label="项目类型" required>
                <Select value={edit.projectType || edit.sourceSheet || ''} onChange={(e) => setEdit({ ...edit, projectType: e.target.value, sourceType: e.target.value, sourceSheet: e.target.value })}>
                  <option value="">请选择</option>
                  {data.dictionaries.projectTypes.concat(data.subtables.map((x) => x.name)).filter((x, i, a) => x && a.indexOf(x) === i).map((x) => <option key={x}>{x}</option>)}
                </Select>
              </Field>
              <Field label="一级专业">
                <Select value={edit.major1 || ''} onChange={(e) => setEdit({ ...edit, major1: e.target.value })}>
                  <option value="">请选择</option>
                  {data.dictionaries.major1.map((x) => <option key={x}>{x}</option>)}
                </Select>
              </Field>
              <Field label="二级专业">
                <Select value={edit.major2 || ''} onChange={(e) => setEdit({ ...edit, major2: e.target.value })}>
                  <option value="">请选择</option>
                  {data.dictionaries.major2.map((x) => <option key={x}>{x}</option>)}
                </Select>
              </Field>
              <Field label="所中心"><Input value={edit.center || ''} onChange={(e) => setEdit({ ...edit, center: e.target.value })} /></Field>
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
            {!edit.validation?.ok && (
              <div className="rounded-lg border border-[rgba(251,191,36,0.32)] bg-[rgba(251,191,36,0.08)] px-3 py-2 text-[12px] text-syellow">
                {edit.validation.missing.concat(edit.validation.warnings).join('；') || '保存后将重新校验'}
              </div>
            )}
            <div className="flex justify-end gap-2.5">
              <Btn onClick={() => setEdit(null)}>取消</Btn>
              <Btn variant="primary" disabled={busy} onClick={save}><Save size={14} />保存并汇总</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
