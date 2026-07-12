import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession, ROLE_HOME, ROLE_LABEL } from '../store/session'
import type { User } from '../store/session'
import { Logo, ArtAirfoilFlow, ArtFeaMesh, ArtVortexStreet } from '../components/art'
import { IconCockpit, IconWorkbench, IconChief, IconFunds, IconAdmin } from '../components/icons'
import { ChevronRight } from 'lucide-react'

const ROLE_META: Record<User['role'], { icon: ReactNode; desc: string; order: number }> = {
  leader: { icon: <IconCockpit size={20} />, desc: '可视化看板 · 项目台账 · 成果转化台账只读查看', order: 1 },
  mgmt: { icon: <IconCockpit size={20} />, desc: '全域台账 · 可视化驾驶舱 · 审批终审 · 风险统筹', order: 2 },
  team: { icon: <IconWorkbench size={20} />, desc: '项目申报 · 里程碑填报 · 计划办结 · 变更发起', order: 3 },
  chief: { icon: <IconChief size={20} />, desc: '建议书/任务书/验收技术把关 · 线上评审', order: 4 },
  finance: { icon: <IconFunds size={20} />, desc: '经费执行核销 · 预算台账 · 总部拨付管控', order: 5 },
  admin: { icon: <IconAdmin size={20} />, desc: '渠道字典 · 权限矩阵 · 流程模板 · 审计日志', order: 6 },
}

export default function Login() {
  const { boot, login } = useSession()
  const nav = useNavigate()
  if (!boot) return <div className="h-full flex items-center justify-center text-faint text-sm">正在连接平台…</div>

  const users = [...boot.users].sort((a, b) => ROLE_META[a.role].order - ROLE_META[b.role].order)

  return (
    <div className="h-full blueprint-bg overflow-y-auto">
      <div className="min-h-full max-w-[1280px] mx-auto px-10 py-10 flex flex-col">
        {/* 顶栏 */}
        <header className="flex items-center justify-between mb-14">
          <div className="flex items-center gap-3">
            <Logo size={38} />
            <div className="leading-tight">
              <div className="text-[15px] font-semibold tracking-wide">科研项目信息化管理平台</div>
              <div className="text-[10px] text-faint tracking-[0.3em]">SCIENTIFIC RESEARCH PROJECT MANAGEMENT</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-faint num">
            <span className="chip">演示环境 DEMO</span>
            <span>{boot.today.replace(/-/g, '.')}</span>
          </div>
        </header>

        <div className="grow grid grid-cols-[1.05fr_1fr] gap-14 items-center">
          {/* 左侧：标题 + 角色入口 */}
          <div className="fade-up">
            <div className="text-[11px] tracking-[0.35em] text-accent mb-4">一本账 · 全生命周期 · 分级管控</div>
            <h1 className="text-[34px] leading-[1.25] font-bold mb-3">
              科研项目全生命周期<br />信息化管控体系
            </h1>
            <p className="text-[13px] leading-6 text-dim mb-8 max-w-[460px]">
              覆盖国家级、地方级、公司级三大层级 15 条立项渠道，贯通申报立项、过程实施、结题验收、
              成果转化全链条，四色状态实时预警，支撑总部决策分析。后评价按 V19 本轮反馈暂缓建设。
            </p>

            <div className="text-[11.5px] tracking-[0.2em] text-faint mb-3">选择角色进入演示</div>
            <div className="flex flex-col gap-2.5 max-w-[520px]">
              {users.map((u, i) => {
                const off = u.status === '已离岗'
                return (
                  <button key={u.id} disabled={off}
                    onClick={() => { if (!off) { login(u); nav(ROLE_HOME[u.role]) } }}
                    className={`card group flex items-center gap-4 px-5 py-3.5 text-left transition-all duration-200 fade-up ${
                      off ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer hover:border-[rgba(56,189,248,0.45)] hover:bg-[rgba(56,189,248,0.05)]'}`}
                    style={{ animationDelay: `${i * 60}ms` }}>
                    <span className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-accent bg-[rgba(56,189,248,0.1)] border border-[rgba(56,189,248,0.25)]">
                      {ROLE_META[u.role].icon}
                    </span>
                    <span className="grow min-w-0">
                      <span className="flex items-center gap-2.5">
                        <span className="text-[14px] font-semibold">{u.name}</span>
                        <span className="chip">{ROLE_LABEL[u.role]}</span>
                        {off && <span className="chip" style={{ color: '#F87171', borderColor: 'rgba(248,113,113,0.4)' }}>已离岗 · 权限已回收</span>}
                      </span>
                      <span className="block text-[11.5px] text-faint mt-0.5 truncate">{u.title} · {ROLE_META[u.role].desc}</span>
                    </span>
                    <ChevronRight size={16} className="text-faint group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                )
              })}
            </div>
          </div>

          {/* 右侧：科研主题图组（气动 / 结构 / 流体） */}
          <div className="hidden xl:flex flex-col gap-3.5 fade-up" style={{ animationDelay: '120ms' }}>
            <div className="flex gap-2.5 justify-end">
              {[['在库项目', '41'], ['立项渠道', '15'], ['承担单位', '6']].map(([k, v]) => (
                <div key={k} className="card px-3.5 py-1.5 flex items-baseline gap-2.5">
                  <span className="text-[10.5px] text-faint">{k}</span>
                  <span className="num text-[17px] font-semibold text-accent">{v}</span>
                </div>
              ))}
            </div>
            <ArtAirfoilFlow className="w-full" />
            <div className="grid grid-cols-2 gap-3.5">
              <ArtFeaMesh className="w-full" />
              <ArtVortexStreet className="w-full" />
            </div>
          </div>
        </div>

        <footer className="mt-12 flex items-center justify-between text-[10.5px] text-faint">
          <span>
            依据《科研项目信息化管理平台需求 V18/V19》构建 · 交互演示版 ·{' '}
            <a href="/traceability.html" target="_blank" rel="noreferrer" className="text-accent hover:underline">
              需求对照矩阵（70 条逐项核对）
            </a>
          </span>
          <span className="num tracking-widest">RED · YELLOW · BLUE · GREEN 四色管控</span>
        </footer>
      </div>
    </div>
  )
}
