# 科研项目信息化管理平台全栈骨架设计

> 日期：2026-07-06  
> 需求依据：`科研项目信息化管理平台需求V18.docx`  
> 本地抽取依据：`.codex_work/requirements_v18_extract.txt`  
> 目标交付：从现有客户展示材料推进到可运行的全栈平台首版。

## 1. 背景与目标

当前目录中已有需求文档、客户展示 HTML、需求覆盖矩阵和展示 Deck 规格，但没有可运行的平台工程。用户确认选择“全栈工程骨架”路线，因此首版目标不是继续制作演示页，而是建立一个能本地运行、能承载真实业务对象和规则的科研项目管理平台。

首版平台必须把 V18 需求中的管理对象、角色权限、生命周期、台账字段、预警规则、验收前置条件和结果闭环转化为工程结构。它不追求一次性达到生产系统完整度，但要让后续接入认证、数据库、真实接口和复杂审批引擎时有清晰边界。

## 2. 首版范围

首版采用“可运行全栈骨架 + 关键业务闭环”范围。

必须包含：

- 项目一本账：展示项目所属信息、团队、年度目标、经费、交付物、协作评价、成果转化等核心字段。
- 角色工作台：项目团队、责任总师、管理团队、财务团队、超级管理员五类角色的视图和权限边界。
- 立项备案：按项目层级和渠道维护项目来源、材料要求、审批状态和备案归档状态。
- 实施管理：项目基本信息、里程碑、计划管理、经费执行、评估检查、项目变更和数据变更。
- 四色预警：绿色、蓝色、黄色、红色，黄色为节点到期前 30 天，红色为超期未完成。
- 经费双轨：项目级经费执行账与总部预算控制账分离展示。
- 验收门禁：里程碑闭环、外协交付物验收、节点经费匹配核销、核心交付物已交付后才允许提交验收。
- 交付物与成果转化：一项交付物一行，成果包为最小转化管理单元，成果编号全局唯一，交付物和成果包双向绑定。
- 协作单位评价：参研单位和外协单位均覆盖，验收或外协合同验收后 30 日内触发评价。
- 后评价：项目最终公司验收后 3 年内办理，评价结果进入台账和看板。
- 审计留痕：关键创建、更新、提交、审批、驳回、验收校验、成果绑定和后评价动作写入审计日志。
- 模拟系统联动：计划、财务、合同、档案、专业系统以模拟数据源进入平台，形成后续真实接口的适配边界。

首版不包含：

- 企业 SSO、组织目录同步、细粒度 ABAC/RBAC 权限策略。
- 真实外部系统接口写回。
- 复杂 BPMN 审批引擎。
- 文件在线预览、电子签章、OCR、全文检索。
- 生产部署、高可用、等保、安全加固和数据库迁移治理。
- AI 助手和本体图数据库运行时。首版只预留对象关系和审计数据结构。

## 3. 技术架构

### 3.1 后端

后端采用 FastAPI + SQLite + SQLAlchemy。

原因：

- FastAPI 足够轻量，适合快速建立清晰 API 边界。
- SQLite 方便本地运行和交付，不要求用户先安装数据库。
- SQLAlchemy 让数据模型后续可迁移到 PostgreSQL。
- Pydantic schema 能把需求字段和接口契约明确化。

后端模块：

- `app/main.py`：FastAPI 应用入口、路由注册、CORS。
- `app/database.py`：SQLite 连接、会话管理。
- `app/models.py`：核心 ORM 模型。
- `app/schemas.py`：请求和响应 schema。
- `app/services/status.py`：四色状态、临期和超期计算。
- `app/services/acceptance.py`：验收前置条件校验。
- `app/services/audit.py`：审计日志写入。
- `app/routers/projects.py`：项目一本账、详情、创建、更新。
- `app/routers/lifecycle.py`：立项、实施、验收、成果转化、后评价相关动作。
- `app/routers/dashboard.py`：看板统计、预警列表。
- `app/routers/reference.py`：渠道、角色、字典和模拟系统数据。
- `app/seed.py`：示例数据初始化。

### 3.2 前端

前端采用 React + Vite + TypeScript。

原因：

- 当前目录没有既有应用框架，Vite 启动快，适合本地平台首版。
- TypeScript 有利于保持字段、状态和 API 契约稳定。
- 需求本身是管理平台，不需要营销页式结构，应采用工作台布局。

前端模块：

- `src/App.tsx`：应用框架、路由和布局。
- `src/api/client.ts`：后端 API 客户端。
- `src/data/types.ts`：前端类型定义。
- `src/pages/Dashboard.tsx`：管理看板和预警概览。
- `src/pages/Ledger.tsx`：项目一本账。
- `src/pages/ProjectDetail.tsx`：项目全生命周期详情。
- `src/pages/Initiation.tsx`：立项备案和材料状态。
- `src/pages/Execution.tsx`：里程碑、计划、经费、变更。
- `src/pages/Acceptance.tsx`：验收门禁、交付物和协作评价。
- `src/pages/Transformation.tsx`：成果包和成果转化。
- `src/pages/PostEvaluation.tsx`：后评价。
- `src/pages/AuditLog.tsx`：审计日志。
- `src/pages/Integrations.tsx`：模拟外部系统联动。
- `src/components/StatusBadge.tsx`：四色状态组件。
- `src/components/DataTable.tsx`：通用表格。
- `src/components/RoleSwitcher.tsx`：角色切换与视图过滤。

## 4. 核心数据模型

首版以需求文档表格为对象来源，优先实现以下实体。

### 4.1 Project

项目一本账主对象。

关键字段：

- `id`
- `project_code`
- `name`
- `goal`
- `level`
- `channel`
- `department`
- `lead_unit`
- `start_date`
- `end_date`
- `status`
- `warning_status`
- `transformation_status`
- `created_at`
- `updated_at`

### 4.2 ProjectTeamMember

覆盖项目负责人、技术负责人、项目主管、一级总师、二级总师、总部处室处长、总部处室主管、单位科技部长、单位科技主管、总部财务主管、单位财务部长、单位财务主管等角色字段。

### 4.3 Milestone

年度目标和里程碑节点。

关键字段：

- `project_id`
- `year`
- `title`
- `planned_finish_date`
- `actual_finish_date`
- `budget_amount`
- `evidence_status`
- `closure_status`
- `warning_status`

### 4.4 PlanItem

模拟来自 CMOS 或计划管理系统的待办和已完成计划。

关键字段：

- `project_id`
- `source_system`
- `title`
- `due_date`
- `completion_status`
- `approval_status`
- `warning_status`

### 4.5 BudgetRecord

项目级经费执行账。

关键字段：

- `project_id`
- `year`
- `total_budget`
- `annual_budget`
- `annual_spent`
- `paid_amount`
- `verified_amount`
- `verification_status`

### 4.6 HeadquartersBudget

总部预算控制账。

关键字段：

- `unit`
- `year`
- `approved_limit`
- `allocated_amount`
- `remaining_amount`
- `clearing_status`

### 4.7 ChangeRequest

项目变更和数据变更统一入口。

关键字段：

- `project_id`
- `change_type`
- `change_scope`
- `reason`
- `evidence`
- `approval_status`
- `requires_legal_review`
- `submitted_at`
- `decided_at`

### 4.8 Deliverable

验收交付物。

关键字段：

- `project_id`
- `name`
- `type`
- `due_date`
- `delivered_at`
- `status`
- `ownership`
- `result_package_id`
- `warning_status`

### 4.9 PartnerEvaluation

协作单位评价。

关键字段：

- `project_id`
- `partner_name`
- `partner_type`
- `score`
- `grade`
- `evaluation_due_date`
- `evaluation_date`
- `evidence_status`
- `blacklist_recommended`

### 4.10 ResultPackage

成果转化包。

关键字段：

- `result_code`
- `project_id`
- `name`
- `summary`
- `transformation_method`
- `transformation_form`
- `planned_date`
- `actual_date`
- `status`
- `responsible_unit`
- `linked_deliverable_count`

### 4.11 PostEvaluation

后评价。

关键字段：

- `project_id`
- `due_date`
- `started_at`
- `completed_at`
- `goal_score`
- `schedule_score`
- `budget_score`
- `result_score`
- `partner_score`
- `risk_score`
- `approval_status`

### 4.12 AuditEvent

审计日志。

关键字段：

- `actor_role`
- `actor_name`
- `entity_type`
- `entity_id`
- `action`
- `summary`
- `before_json`
- `after_json`
- `created_at`

## 5. 业务规则

### 5.1 四色状态

状态计算规则：

- 绿色：节点或对象已完成，审核通过。
- 蓝色：未完成且距离到期时间大于 30 天。
- 黄色：未完成且距离到期时间小于等于 30 天。
- 红色：到期日已过且未完成。

项目整体预警取子对象最高优先级，优先级为红、黄、蓝、绿。

### 5.2 验收门禁

提交项目验收前必须全部满足：

- 全部里程碑闭环。
- 外协交付物验收合格。
- 节点经费匹配核销完成。
- 全部核心交付物为已交付。
- 必填验收材料齐套。

不满足时，后端返回阻断原因列表，前端以门禁面板展示。

### 5.3 成果转化绑定

规则：

- 只有已交付的交付物可绑定成果包。
- 一个成果包可绑定多项交付物。
- 成果编号由系统自动生成且全局唯一。
- 成果转化状态回写到项目一本账和交付物记录。

### 5.4 协作评价

规则：

- 参研单位自项目验收完成后 30 日内评价。
- 外协单位自外协合同验收后 30 日内评价。
- 评分等级：优秀大于等于 90，良好大于等于 80 且小于 90，合格大于等于 60 且小于 80，不合格小于 60。
- 不合格单位只在首版标记为建议纳入黑名单，不实现真实法务流程。

### 5.5 后评价

规则：

- 项目最终公司验收后 3 年内办理后评价。
- 首版示例数据优先展示超 1 亿项目的后评价触发。
- 后评价结果进入项目详情、一本账和看板统计。

## 6. 页面设计

首屏不是落地页，而是平台工作台。

### 6.1 布局

- 左侧导航：看板、项目一本账、立项备案、实施管理、验收管理、成果转化、后评价、系统联动、审计日志。
- 顶部栏：当前角色、当前单位、全局搜索、关键预警数量。
- 主内容区：数据表、详情页、流程状态和规则校验面板。

视觉风格采用管理平台风格：信息密度高、层级清晰、控件稳定、少装饰。避免客户展示 Deck 中的演示式大画面。

### 6.2 关键页面

看板：

- 项目数量、经费执行、里程碑预警、验收待提交、成果转化进度、后评价待办。
- 支持按年度、项目层级、渠道、承担单位筛选。

项目一本账：

- 表格展示项目核心字段。
- 支持搜索、状态筛选、层级筛选。
- 点击进入项目全生命周期详情。

项目详情：

- 顶部项目画像。
- 标签页：基础信息、立项、实施、经费、变更、验收、交付物、成果、后评价、审计。

实施管理：

- 里程碑状态列表。
- 计划同步列表。
- 经费执行账和总部预算控制账并列但不混合。
- 项目变更入口。

验收管理：

- 验收门禁面板。
- 阻断项清单。
- 交付物一项一行。
- 协作单位评价倒计时。

成果转化：

- 成果包台账。
- 交付物绑定关系。
- 转化方式、形式、状态和计划时间。

系统联动：

- 展示模拟来源：计划管理系统、财务平台、合同采购系统、档案系统、DOORS、CMOS。
- 每个来源标记读入字段、确认角色、失败时的人工替代方式。

审计日志：

- 展示关键业务动作。
- 支持按项目、角色、实体类型、动作筛选。

## 7. API 设计

首版 API 使用 REST。

主要端点：

- `GET /api/health`
- `GET /api/dashboard/summary`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/{project_id}`
- `PATCH /api/projects/{project_id}`
- `GET /api/projects/{project_id}/timeline`
- `POST /api/projects/{project_id}/milestones`
- `PATCH /api/milestones/{milestone_id}`
- `POST /api/projects/{project_id}/changes`
- `PATCH /api/changes/{change_id}/decision`
- `GET /api/projects/{project_id}/acceptance-gate`
- `POST /api/projects/{project_id}/acceptance/submit`
- `POST /api/projects/{project_id}/deliverables`
- `POST /api/result-packages`
- `POST /api/result-packages/{result_id}/bind-deliverable`
- `POST /api/projects/{project_id}/partner-evaluations`
- `POST /api/projects/{project_id}/post-evaluations`
- `GET /api/audit-events`
- `GET /api/reference/channels`
- `GET /api/reference/roles`
- `GET /api/integrations/mock-sources`

## 8. 测试策略

后端测试：

- 四色状态计算。
- 项目整体预警优先级。
- 验收门禁阻断条件。
- 成果包只能绑定已交付交付物。
- 协作评价等级计算。
- 后评价 due date 计算。
- 审计日志在关键动作后生成。

前端测试：

- 页面可渲染。
- 角色切换后视图过滤有效。
- 项目一本账筛选有效。
- 验收门禁阻断原因可见。
- 成果包绑定操作反馈清晰。

端到端验证：

- 本地启动后端和前端。
- 浏览器访问首页。
- 打开一本账、项目详情、验收门禁、成果转化、审计日志。
- 检查控制台无错误，关键 UI 不溢出。

## 9. 示例数据

首版 seed 至少包含 3 个项目：

- 联邦级项目：包含多级立项材料、里程碑、预算、验收门禁未通过示例。
- 洲级项目：包含阶段检查、黄色预警、成果转化进行中示例。
- 公司级项目：包含已验收、协作单位评价、后评价待办示例。

示例数据必须脱敏，不使用真实敏感项目名称。项目名可采用“高温复合材料工艺验证项目”等通用名称。

## 10. 实施顺序

1. 初始化工程结构。
2. 建立后端数据模型、seed、状态规则和验收门禁服务。
3. 建立 REST API 和基础测试。
4. 建立前端 Vite 工程、布局、路由和 API 客户端。
5. 实现看板、一本账、项目详情、实施管理、验收管理、成果转化、审计日志。
6. 完成浏览器验证和端到端冒烟测试。
7. 补充运行说明。

## 11. 风险与处理

- 风险：需求文档覆盖面很大，首版容易膨胀。处理：只实现关键闭环，生产级审批、外部接口和 SSO 进入后续阶段。
- 风险：字段过多导致页面难用。处理：一本账展示核心字段，详情页分标签承载全量对象。
- 风险：审批流复杂。处理：首版用状态和动作模拟审批，不引入 BPMN。
- 风险：外部系统不可接入。处理：首版实现模拟数据源和接口边界说明。
- 风险：权限被误认为生产可用。处理：首版角色切换只做视图和动作限制演示，明确不是企业级认证授权。

## 12. 验收标准

首版完成时必须满足：

- 运行一个命令或两组命令可启动后端和前端。
- 首页直接进入平台工作台。
- 项目一本账能展示、筛选、进入详情。
- 项目详情能看到生命周期关键对象。
- 四色状态和 30 天预警由规则计算，不是纯静态标签。
- 验收门禁能返回阻断原因，满足条件后允许提交。
- 成果包能绑定已交付交付物，拒绝未交付交付物。
- 关键动作能写入审计日志。
- 至少有后端测试覆盖核心规则。
- 浏览器验证无控制台错误和明显布局溢出。

