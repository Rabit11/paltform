import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Database, GitBranch, ShieldCheck, Sparkles } from 'lucide-react'
import { useSession, ROLE_HOME, ROLE_LABEL } from '../store/session'
import type { User } from '../store/session'
import { Logo, ArtAirfoilFlow, ArtFeaMesh, ArtVortexStreet } from '../components/art'
import {
  IconAdmin,
  IconChief,
  IconCockpit,
  IconFunds,
  IconTransform,
  IconWorkbench,
} from '../components/icons'

const ROLE_META: Record<User['role'], { icon: ReactNode; desc: string; order: number; accent: string }> = {
  leader: {
    icon: <IconCockpit size={20} />,
    desc: '可视化看板 / 项目台账 / 成果转化台账只读查看',
    order: 1,
    accent: '决策查看',
  },
  mgmt: {
    icon: <IconCockpit size={20} />,
    desc: '全域台账、驾驶舱、审批终审、风险统筹',
    order: 2,
    accent: '总部管理',
  },
  team: {
    icon: <IconWorkbench size={20} />,
    desc: '项目申报、里程碑填报、计划办结、变更发起',
    order: 3,
    accent: '项目执行',
  },
  chief: {
    icon: <IconChief size={20} />,
    desc: '建议书、任务书、验收材料技术把关与线上评审',
    order: 4,
    accent: '技术复核',
  },
  finance: {
    icon: <IconFunds size={20} />,
    desc: '经费执行核销、预算台账、总部拨付管控',
    order: 5,
    accent: '经费管控',
  },
  admin: {
    icon: <IconAdmin size={20} />,
    desc: '渠道字典、权限矩阵、流程模板、审计日志',
    order: 6,
    accent: '系统配置',
  },
}

const V19_POINTS = [
  { icon: <ShieldCheck size={14} />, text: '新增领导只读角色' },
  { icon: <IconTransform size={14} />, text: '成果转化独立台账' },
  { icon: <Database size={14} />, text: 'V19 台账字段口径' },
  { icon: <GitBranch size={14} />, text: '表单过渡工具' },
]

export default function Login() {
  const { boot, login } = useSession()
  const nav = useNavigate()

  if (!boot) {
    return (
      <div className="h-full flex items-center justify-center text-faint text-sm blueprint-bg">
        正在连接科研项目管理平台...
      </div>
    )
  }

  const users = [...boot.users].sort((a, b) => ROLE_META[a.role].order - ROLE_META[b.role].order)
  const enabledChannels = boot.channels.filter((x) => x.enabled).length
  const managedUnits = boot.units.filter((x) => x.kind === 'unit').length
  const levels = Array.from(new Set(boot.channels.map((x) => x.level))).length

  return (
    <div className="h-full blueprint-bg overflow-y-auto">
      <div className="min-h-full max-w-[1320px] mx-auto px-5 sm:px-8 xl:px-10 py-8 sm:py-10 flex flex-col">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-10 xl:mb-14">
          <div className="flex items-center gap-3">
            <Logo size={38} />
            <div className="leading-tight">
              <div className="text-[15px] font-semibold tracking-wide">科研项目信息化管理平台</div>
              <div className="text-[10px] text-faint tracking-[0.24em]">SCIENTIFIC RESEARCH PROJECT MANAGEMENT</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-faint num">
            <span className="chip">V19 二次完善版</span>
            <span className="chip">演示环境 DEMO</span>
            <span>{boot.today.replace(/-/g, '.')}</span>
          </div>
        </header>

        <div className="grow grid xl:grid-cols-[1.02fr_0.98fr] gap-9 xl:gap-14 items-center">
          <section className="fade-up">
            <div className="inline-flex items-center gap-2 text-[11px] tracking-[0.26em] text-accent mb-4">
              <Sparkles size={14} />
              一本账 / 全生命周期 / 分级管控
            </div>
            <h1 className="text-[30px] sm:text-[36px] leading-[1.22] font-bold mb-3">
              科研项目全生命周期<br className="hidden sm:block" /> 信息化管控体系
            </h1>
            <p className="text-[13px] sm:text-[13.5px] leading-6 text-dim mb-5 max-w-[560px]">
              继承 V18 登录页的角色化入口和科研蓝图视觉，按 V19 反馈补充领导决策查看、项目台账字段口径、
              可视化看板逻辑、成果转化独立台账和表单过渡工具。后评价按本轮反馈暂缓建设，避免干扰当前演示主线。
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-[640px] mb-8">
              {V19_POINTS.map((x) => (
                <div key={x.text} className="card px-3 py-2 flex items-center gap-2 text-[11.5px] text-dim">
                  <span className="text-accent shrink-0">{x.icon}</span>
                  <span className="truncate">{x.text}</span>
                </div>
              ))}
            </div>

            <div className="text-[11.5px] tracking-[0.18em] text-faint mb-3">选择角色进入演示</div>
            <div className="flex flex-col gap-2.5 max-w-[620px]">
              {users.map((u, i) => {
                const off = u.status !== '在岗'
                const meta = ROLE_META[u.role]
                return (
                  <button
                    key={u.id}
                    disabled={off}
                    onClick={() => {
                      if (!off) {
                        login(u)
                        nav(ROLE_HOME[u.role])
                      }
                    }}
                    className={`card group flex items-center gap-4 px-4 sm:px-5 py-3.5 text-left transition-all duration-200 fade-up ${
                      off ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer hover:border-[rgba(56,189,248,0.45)] hover:bg-[rgba(56,189,248,0.05)]'
                    }`}
                    style={{ animationDelay: `${i * 55}ms` }}
                  >
                    <span className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-accent bg-[rgba(56,189,248,0.1)] border border-[rgba(56,189,248,0.25)]">
                      {meta.icon}
                    </span>
                    <span className="grow min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-semibold">{u.name}</span>
                        <span className="chip">{ROLE_LABEL[u.role]}</span>
                        <span className="chip">{meta.accent}</span>
                        {off && (
                          <span className="chip" style={{ color: '#F87171', borderColor: 'rgba(248,113,113,0.4)' }}>
                            已离岗 / 权限已回收
                          </span>
                        )}
                      </span>
                      <span className="block text-[11.5px] text-faint mt-1 truncate">{u.title} / {meta.desc}</span>
                    </span>
                    <ChevronRight size={16} className="text-faint group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                )
              })}
            </div>
          </section>

          <section className="hidden xl:flex flex-col gap-3.5 fade-up" style={{ animationDelay: '120ms' }}>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                ['项目层级', `${levels}`],
                ['立项渠道', `${enabledChannels}`],
                ['承担单位', `${managedUnits}`],
              ].map(([k, v]) => (
                <div key={k} className="card px-3.5 py-2 flex items-baseline justify-between gap-2.5">
                  <span className="text-[10.5px] text-faint">{k}</span>
                  <span className="num text-[18px] font-semibold text-accent">{v}</span>
                </div>
              ))}
            </div>
            <ArtAirfoilFlow className="w-full" />
            <div className="grid grid-cols-2 gap-3.5">
              <ArtFeaMesh className="w-full" />
              <ArtVortexStreet className="w-full" />
            </div>
          </section>
        </div>

        <footer className="mt-10 xl:mt-12 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-[10.5px] text-faint">
          <span>
            依据《科研项目信息化管理平台需求 V18/V19》构建 / 交互演示版 /{' '}
            <a href="/traceability.html" target="_blank" rel="noreferrer" className="text-accent hover:underline">
              需求对照矩阵
            </a>
          </span>
          <span className="num tracking-widest">RED / YELLOW / BLUE / GREEN 四色管控</span>
        </footer>
      </div>
    </div>
  )
}
