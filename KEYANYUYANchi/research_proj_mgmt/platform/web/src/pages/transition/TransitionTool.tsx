import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, FileSpreadsheet, RefreshCcw, Save } from 'lucide-react'
import { api } from '../../api/client'
import type { TransitionRow, TransitionToolData } from '../../api/types'
import { Btn, Card, Empty, Field, Input, KPI, Modal, Select, Tag, Textarea, useToast } from '../../components/ui'
import { wan } from '../../lib/format'

const LEVELS = ['国家级', '地方级', '公司级']

export default function TransitionTool() {
  const toast = useToast()
  const [data, setData] = useState<TransitionToolData | null>(null)
  const [level, setLevel] = useState('')
  const [edit, setEdit] = useState<TransitionRow | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => { api.get<TransitionToolData>('/transition-tool').then(setData) }, [])
  useEffect(load, [load])

  const rows = useMemo(() => (data?.rows || []).filter((r) => !level || r.level === level), [data, level])
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
          <div className="text-[11.5px] text-faint mt-0.5">用于正式平台上线前的专项分表维护、自动汇总总表、批量导入和一键导出；字段口径与 V19 台账保持一致。</div>
        </div>
        <div className="flex items-center gap-2">
          <Btn disabled={busy} onClick={importDemo}><RefreshCcw size={14} />模拟批量导入</Btn>
          <a href="/api/transition-tool/export.xlsx" download><Btn variant="primary"><Download size={14} />一键导出</Btn></a>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3">
        <KPI label="总表记录" value={data.summary.total} unit="行" tone="accent" />
        <KPI label="校验通过" value={data.summary.valid} unit="行" tone="green" />
        <KPI label="待修正" value={data.summary.invalid} unit="行" tone={data.summary.invalid ? 'yellow' : 'green'} />
        <KPI label="分表数量" value={data.subtables.filter((x) => x.count > 0).length} unit="张" />
        <KPI label="字段口径" value={data.fields.length} unit="项" sub={`${byGroup.length} 个板块`} />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Card title="专项分表" className="col-span-3">
          <div className="flex flex-col gap-2">
            <button onClick={() => setLevel('')} className={`text-left px-3 py-2 rounded-lg border cursor-pointer ${level === '' ? 'border-accent text-accent bg-[rgba(56,189,248,0.08)]' : 'border-line2 text-dim hover:text-ink'}`}>
              全部总表 <span className="num float-right">{data.summary.total}</span>
            </button>
            {data.subtables.map((s) => (
              <button key={s.name} onClick={() => setLevel(s.name)} className={`text-left px-3 py-2 rounded-lg border cursor-pointer ${level === s.name ? 'border-accent text-accent bg-[rgba(56,189,248,0.08)]' : 'border-line2 text-dim hover:text-ink'}`}>
                {s.name}专项分表 <span className="num float-right">{s.count}</span>
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
        </Card>

        <Card title={<span className="flex items-center gap-2"><FileSpreadsheet size={15} />自动汇总总表</span>}
          extra={<Tag tone={data.summary.duplicates.length ? 'yellow' : 'green'}>{data.summary.duplicates.length ? `重复 ${data.summary.duplicates.length}` : '无重复项目'}</Tag>}
          className="col-span-9" pad={false}>
          <div className="overflow-x-auto max-h-[calc(100vh-360px)]">
            <table className="dtable">
              <thead><tr><th>来源分表</th><th>项目编号/名称</th><th>级别/渠道</th><th>专业</th><th>经费</th><th>成果转化</th><th>校验</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Tag tone={r.level === '国家级' ? 'accent' : r.level === '地方级' ? 'violet' : 'dim'}>{r.sourceSheet}</Tag>
                      <div className="text-[10.5px] text-faint mt-1">{r.updatedBy} · {r.updatedAt}</div>
                    </td>
                    <td>
                      <div className="num text-accent text-[11px]">{r.code}</div>
                      <div className="max-w-[240px] truncate">{r.name}</div>
                    </td>
                    <td className="text-dim">{r.level}<div className="text-[10.5px] text-faint max-w-[170px] truncate">{r.channel}</div></td>
                    <td className="text-dim">{r.major1}<div className="text-[10.5px] text-faint">{r.major2}</div></td>
                    <td className="num text-dim">{wan(r.totalBudget)} 万<div className="text-[10.5px] text-faint">国拨 {wan(r.centralGrant)} / 自筹 {wan(r.selfFund)}</div></td>
                    <td className="max-w-[190px] truncate text-dim">{r.transformSummary}</td>
                    <td>{r.validation.ok ? <Tag tone="green">通过</Tag> : <Tag tone="yellow">{r.validation.missing.length + r.validation.warnings.length} 项问题</Tag>}</td>
                    <td className="text-right"><Btn size="sm" onClick={() => setEdit(r)}>维护</Btn></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <Empty text="当前分表暂无记录" />}
          </div>
        </Card>
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="维护专项分表记录" width={660}>
        {edit && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="项目编号" required><Input value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} /></Field>
              <Field label="项目名称" required><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="项目级别" required>
                <Select value={edit.level} onChange={(e) => setEdit({ ...edit, level: e.target.value, sourceType: e.target.value, sourceSheet: `${e.target.value}-${edit.major1}` })}>
                  {LEVELS.map((x) => <option key={x}>{x}</option>)}
                </Select>
              </Field>
              <Field label="项目渠道" required><Input value={edit.channel} onChange={(e) => setEdit({ ...edit, channel: e.target.value })} /></Field>
              <Field label="一级专业"><Input value={edit.major1} onChange={(e) => setEdit({ ...edit, major1: e.target.value, sourceSheet: `${edit.level}-${e.target.value}` })} /></Field>
              <Field label="二级专业"><Input value={edit.major2} onChange={(e) => setEdit({ ...edit, major2: e.target.value })} /></Field>
              <Field label="总经费(万元)" required><Input type="number" value={edit.totalBudget} onChange={(e) => setEdit({ ...edit, totalBudget: Number(e.target.value) || 0 })} /></Field>
              <Field label="国拨/自筹(万元)">
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" value={edit.centralGrant} onChange={(e) => setEdit({ ...edit, centralGrant: Number(e.target.value) || 0 })} />
                  <Input type="number" value={edit.selfFund} onChange={(e) => setEdit({ ...edit, selfFund: Number(e.target.value) || 0 })} />
                </div>
              </Field>
            </div>
            <Field label="牵头单位/主要工作内容" required><Textarea rows={2} value={edit.leadWork} onChange={(e) => setEdit({ ...edit, leadWork: e.target.value })} /></Field>
            <Field label="成果转化情况"><Textarea rows={2} value={edit.transformSummary} onChange={(e) => setEdit({ ...edit, transformSummary: e.target.value })} /></Field>
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
