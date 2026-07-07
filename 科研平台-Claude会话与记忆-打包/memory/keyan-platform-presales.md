---
name: keyan-platform-presales
description: 科研项目管理平台售前项目——文件位置、方案定位（AI原生+本体架构）、需求关键口径与已知矛盾
metadata: 
  node_type: memory
  type: project
  originSessionId: 70454280-2f91-4b3c-accb-1ffc7ead3a2e
---

用户团队（AI 公司）在做「科研项目信息化管理平台」售前方案，材料都在 `c:\Users\wangz\Desktop\管理\`：需求原文 extracted.txt（docx 提取）、交互 Demo（科研项目管理平台Demo.html）、客户展示页（科研项目管理平台客户展示.html）、开发方案/Demo演示方案/本体架构研究报告/需求深化价值说明（客户版）等 md。

方案定位：AI 原生 + 本体（对象/关系/动作/权限）架构，对标 Palantir Ontology / Fabric IQ；「需求深化与方案优化说明.md」是内部版，「需求深化价值说明（客户版）.md」是给客户的版本（AI 为差异化核心，第四章）。

需求关键口径（2026-07 确认）：四色状态（红>黄>蓝>绿，30 天临期）；验收后 30 日内协作单位评价；后评价仅超 1 亿项目、最终验收后 3 年内；经费两套体系（二级单位执行 vs 总部拨付）独立存储互不联动；**需求文档内部矛盾**：协作评价等级功能架构章节为四档（优秀/良好/合格/不合格），细则与台账说明为三档——已列为蓝图阶段澄清项。

Demo 已按需求回归：生命周期顺序（验收→协作评价→成果转化→后评价）、后评价"不适用（未超1亿）"、经费"汇总观察口径"标注、审批记录卡片、智能填报模拟（extractBtn）、AI 回答带"依据"角标。Demo 现为多角色版：全屏登录页（#loginScreen，6 张 persona 卡）+ 14 个示例项目 + 6 种身份（hq/leader/dept/pm/owner 周明/member 张晓）；每个角色首页是不同工作台（renderDashboard 按角色分支：总部治理台/领导驾驶舱/单位治理台/执行监控台/负责人工作台/我的工作台），roleDefs 控制菜单、数据范围（scope）、导出权限；待办审批视图（todos 按角色+范围过滤）、导出/验收前置校验双拦截演示；侧边栏 userCard+logoutBtn 切换账号。新增「立项申报」视图（#apply，仅 member/owner/pm 可见）：层级→渠道联动材料清单（channelMap）、AI 抽取一键回填（fillApplyForm）、提交审签生成项目对象并推 dept/hq 待办（submitApply）。**注意：demo 主脚本已被用户会话多次外部修改（V3-V5 polish：侧边栏折叠、项目档案改名、5 个附加 script 块、syncTopUser），不可整体覆盖 script 块，必须用逐处校验唯一性的补丁式替换（见 scratchpad patch_apply.ps1 模式；ps1 需 UTF-8 BOM 否则中文路径乱码）。「需求深化」亮点章节在客户展示页（#enhance），不在 Demo 里。

本体交互四件套已加入 demo（2026-07-04，参考 Palantir Ontology）：① 关系穿透——档案页承担单位/负责人为 pivotSearch 芯片（跳台账过滤）、协作单位名点开 partnerProfile 画像弹窗（objModal 通用弹窗，点行穿透并 closeModal）、链路图节点委托点击（objectGraph delegation：交付物/成果包→outcome 带权限校验、渠道/责任团队→pivot）；② impactPartner 影响传导分析（总部治理台黑名单行"影响分析"按钮，沿 单位→合同→项目→成果包 展开）；③ aiDraftChange——AI 红色项目回答尾部"生成延期变更草稿"按钮，推 owner 待办（tid=aidraft-*防重复），话术"AI 只提议不执行"；④ auditFor 操作留痕卡（档案页，含 AI 核验记录一条，"人与 AI 同轨"）。

项目档案已改为纯穿透式（2026-07-04，用户决策）：导航无"项目档案"按钮（V5 分组标签"项目执行"锚点已改指 risk 按钮），只能从台账/工作台/风险板等列表点击进入；档案页顶部有面包屑（lastListView 记录来源视图）+ goBack() 返回 + stepProject(±1) 上下翻页（范围=scopedBase）。roleDefs.views 仍保留 "detail"（switchView 权限校验用）。

页头工具栏已情境化（2026-07-04，用户要求「不是每页都用 + 低调科技风 + 字不重叠」）：主脚本 `viewTools` 配置每视图可见控件（ledger 全套搜索/层级/状态/摘要、portfolio 层级+状态+摘要、dashboard 仅 hq/leader/dept/pm 见摘要按钮、其余视图全隐藏整条 .filters），`applyTools()` 在 switchView 内调用，`list()` 只读当前视图可见的筛选器（risk/outcome/partner 用 scopedBase，全局筛选器对它们本就无效）；切到 ledger 时 switchView 会补一次 renderLedger(list())。CSS `</style>` 前有「覆盖层：页头情境化+低调科技风」（.top flex-wrap 防标题与筛选器重叠、.filters.off 隐藏、收敛 h1 光晕/hover 位移/霓虹 glow）。已用无头 Edge 截图验证 4 视图（scratchpad shot_*.png，测试副本 demo_test.html 带 hash 自动登录钩子）。

台账列随角色配置（2026-07-04，用户要求）：主脚本 `ledgerCols` 按角色定义列集（member 执行列「下一节点」/owner 里程碑+经费执行/pm 临期节点+材料健康/dept 总预算·已支出·执行率/leader 宏观/hq 全景 11 列含协作·后评价·操作「进入档案」），renderLedger 动态渲染 `#ledgerHead`（原静态 thead 已改 `<tr id="ledgerHead">`）并暴露 window.ledgerColMeta；**列筛选脚本已重写为自适应版**：按 `th[data-k]` 每次 render 后 bindHead() 重绑（不再固定索引一次性初始化），空态 colspan 取 colMeta 长度，排序/全选清空后 reopen(k) 按 k 找新列（旧 btn 随 thead 重建失效）；可筛选字段 level/channel/org/owner/phase/risk/outcome。已无头 Edge 截图验证 member/dept/hq（shot_lc_*.png）。

台账表头列筛选（2026-07-04，用户要求参考成熟 PM 平台，**已被上述自适应版取代，原实现记录如下**）：独立脚本块（文件末尾最后一个 script，Excel/Airtable 式列头菜单）——层级/渠道/承担单位/负责人/阶段/风险 6 列漏斗按钮（SVG 图标），菜单挂 body、fixed 定位（.table overflow:hidden 会裁剪，勿改 absolute），多选值+计数+升降序+全选清空+Esc/外点关闭+aria-sort+空态行带清除按钮；**通过包装 window.renderLedger / window.setRole 实现，未改主脚本内部**；`sel` 对象有键即该列筛选激活（空 Set=清空=0 行）；切角色自动重置筛选。配套改动：viewTools.ledger 收敛为 ['search','action']（层级/状态下拉从页头移除，列筛选取代，portfolio 不变）；exportBtn/demoAction 在台账页改用 window.ledgerVisibleRows（所见即所得）。CSS 在覆盖层末尾「表头列筛选」段。已截图验证默认/菜单开/筛选生效 3 状态（scratchpad shot_flt_*.png；headless 下菜单坐标因字体加载时序略偏，真实交互无此问题）。pivotSearch 跳台账走 searchInput，与列筛选正交无冲突。品牌区副标题溢出已修（2026-07-04）：后期 polish 注入的 `.brand span{white-space:nowrap!important}` 导致英文 tagline 超出侧边栏，覆盖层末尾用更高特异性 `.sidebar .brand span{white-space:normal!important}` + `.brand>div{min-width:0}` 允许换行（同为 !important 时特异性取胜，与注入顺序无关）。

成果转化/协作评价列筛选（2026-07-04）：新增文件末尾独立脚本块（DOM 后处理模式，区别于台账的数据前置过滤）——包装 window.outcome/window.partner，渲染后按 tr[data-id]→projects 查数据、display:none 隐藏不匹配行、appendChild 重排序；静态表头按固定列索引注入漏斗（这两表 thead 不随角色重建，无需 bindHead）。outcome 筛选列：转化方式/状态（OUT_ORD 排序）；partner：协作单位/协作类型/等级（plevel 派生值，LV_ORD）/后评价状态 + 评分列 sortOnly（双箭头 SVG 图标非漏斗）。清除筛选 chip 插入 .head 徽标旁（包一层 flex span 保持 justify-between 布局）。跨脚本块菜单互斥：本块 doc click 用**捕获阶段**（台账块按钮的 stopPropagation 拦不住），开菜单时先 remove 所有 .col-menu（含台账块的，其状态自愈）；setRole 再包装一层重置本块两表状态。截图验证 shot_tbl_outcome/partner.png。

《本体架构深度研究报告（多源核查版）.md》（2026-07-04）：deep-research 工作流产出（两轮，因会话限额分段跑完），17 条 Palantir 官方论断过 3 票对抗核查（✅标记）、其余为一手来源未投票（◽）；含微软 Fabric IQ/SAP/西门子 2025-2026 同构产品对比、DINGO/香港创新科技署/Hercules/CRC1625 科研领域落地案例（CRC1625 提效 7 倍）、语义漂移风险与对策。写方案/汇报材料引用它，旧版《科研项目管理平台本体架构研究报告.md》保留但已被取代。
