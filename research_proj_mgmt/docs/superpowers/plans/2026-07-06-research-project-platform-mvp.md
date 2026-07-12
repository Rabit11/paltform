# Research Project Platform MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a locally runnable full-stack research project management platform MVP from the approved V18 requirements design.

**Architecture:** The backend is a FastAPI application with SQLite persistence, SQLAlchemy models, deterministic business-rule services, and REST endpoints. The frontend is a React/Vite/TypeScript workbench that consumes those endpoints and presents the project ledger, lifecycle details, acceptance gate, transformation ledger, integrations, and audit log.

**Tech Stack:** Python 3, FastAPI, SQLAlchemy, Pydantic, pytest, SQLite, React, Vite, TypeScript, CSS.

---

## Scope Check

The approved spec covers several business areas, but they form one testable MVP because they all operate around the same `Project` lifecycle and shared audit/status rules. This plan keeps the first implementation to one coherent product slice: local database, seeded projects, deterministic rules, REST API, React workbench, and verification. Enterprise authentication, real external-system writeback, BPMN, file preview, AI, and production deployment remain outside this plan.

## File Structure

Create:

- `README.md`: local run, test, and verification instructions.
- `backend/requirements.txt`: Python dependencies.
- `backend/pytest.ini`: pytest import path and options.
- `backend/app/__init__.py`: backend package marker.
- `backend/app/database.py`: SQLAlchemy engine/session/base.
- `backend/app/models.py`: ORM models for projects, lifecycle objects, result packages, and audit events.
- `backend/app/schemas.py`: Pydantic response and request models.
- `backend/app/seed.py`: deterministic demo data.
- `backend/app/main.py`: FastAPI app and router registration.
- `backend/app/services/status.py`: four-color status and priority calculations.
- `backend/app/services/acceptance.py`: acceptance gate checks.
- `backend/app/services/audit.py`: audit event creation.
- `backend/app/routers/projects.py`: project ledger and detail endpoints.
- `backend/app/routers/lifecycle.py`: milestone, change, acceptance, deliverable, transformation, partner evaluation, and post-evaluation endpoints.
- `backend/app/routers/dashboard.py`: summary and warning endpoints.
- `backend/app/routers/reference.py`: roles, channels, and mock integration sources.
- `backend/tests/test_status.py`: status service tests.
- `backend/tests/test_acceptance.py`: acceptance service tests.
- `backend/tests/test_api.py`: API smoke and rule tests.
- `frontend/package.json`: frontend scripts and dependencies.
- `frontend/tsconfig.json`: TypeScript settings.
- `frontend/index.html`: Vite entry HTML.
- `frontend/src/main.tsx`: React bootstrap.
- `frontend/src/App.tsx`: layout, navigation, role state, page routing.
- `frontend/src/api/client.ts`: REST client.
- `frontend/src/data/types.ts`: API data types.
- `frontend/src/components/DataTable.tsx`: compact table component.
- `frontend/src/components/StatusBadge.tsx`: four-color status badge.
- `frontend/src/components/RoleSwitcher.tsx`: role selector.
- `frontend/src/pages/Dashboard.tsx`: dashboard summary.
- `frontend/src/pages/Ledger.tsx`: project ledger.
- `frontend/src/pages/ProjectDetail.tsx`: lifecycle detail.
- `frontend/src/pages/Initiation.tsx`: initiation filing, channel, and material status.
- `frontend/src/pages/Execution.tsx`: milestones, plans, budgets, changes.
- `frontend/src/pages/Acceptance.tsx`: acceptance gate, deliverables, partner evaluations.
- `frontend/src/pages/Transformation.tsx`: result packages.
- `frontend/src/pages/PostEvaluation.tsx`: post-evaluation list.
- `frontend/src/pages/Integrations.tsx`: mock system integrations.
- `frontend/src/pages/AuditLog.tsx`: audit event table.
- `frontend/src/styles.css`: management-workbench visual system.

Modify:

- `.gitignore`: keep `.venv/`, `node_modules/`, build output, logs, and local SQLite files ignored. It already contains the needed entries; only modify it if verification finds a missing generated path.

## Task 1: Backend Project Foundation

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/pytest.ini`
- Create: `backend/app/__init__.py`
- Create: `backend/app/database.py`
- Create: `backend/tests/test_status.py`

- [ ] **Step 1: Create backend dependency files**

Create `backend/requirements.txt`:

```txt
fastapi==0.115.6
uvicorn[standard]==0.34.0
SQLAlchemy==2.0.36
pydantic==2.10.4
pytest==8.3.4
httpx==0.28.1
```

Create `backend/pytest.ini`:

```ini
[pytest]
pythonpath = .
testpaths = tests
addopts = -q
```

- [ ] **Step 2: Create database foundation**

Create `backend/app/__init__.py` as an empty package marker.

Create `backend/app/database.py`:

```python
from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

BASE_DIR = Path(__file__).resolve().parents[1]
DATABASE_URL = f"sqlite:///{BASE_DIR / 'research_platform.db'}"


class Base(DeclarativeBase):
    pass


engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 3: Write the first failing backend rule test**

Create `backend/tests/test_status.py`:

```python
from datetime import date, timedelta

from app.services.status import WarningStatus, calculate_warning_status, highest_warning


def test_completed_item_is_green():
    assert calculate_warning_status(date.today(), True) == WarningStatus.GREEN


def test_future_item_more_than_30_days_is_blue():
    due_date = date.today() + timedelta(days=45)
    assert calculate_warning_status(due_date, False) == WarningStatus.BLUE


def test_future_item_within_30_days_is_yellow():
    due_date = date.today() + timedelta(days=30)
    assert calculate_warning_status(due_date, False) == WarningStatus.YELLOW


def test_past_incomplete_item_is_red():
    due_date = date.today() - timedelta(days=1)
    assert calculate_warning_status(due_date, False) == WarningStatus.RED


def test_project_warning_uses_highest_priority():
    assert highest_warning(
        [WarningStatus.GREEN, WarningStatus.YELLOW, WarningStatus.RED, WarningStatus.BLUE]
    ) == WarningStatus.RED
```

- [ ] **Step 4: Run the failing status tests**

Run:

```powershell
cd backend
python -m pytest tests/test_status.py -q
```

Expected: FAIL with `ModuleNotFoundError: No module named 'app.services'`.

- [ ] **Step 5: Commit backend foundation**

Run:

```powershell
git add backend/requirements.txt backend/pytest.ini backend/app/__init__.py backend/app/database.py backend/tests/test_status.py
git commit -m "test: add backend rule test scaffold"
```

## Task 2: Four-Color Status Service

**Files:**
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/status.py`
- Modify: `backend/tests/test_status.py`

- [ ] **Step 1: Implement the status service**

Create `backend/app/services/__init__.py` as an empty package marker.

Create `backend/app/services/status.py`:

```python
from datetime import date
from enum import StrEnum


class WarningStatus(StrEnum):
    GREEN = "green"
    BLUE = "blue"
    YELLOW = "yellow"
    RED = "red"


_PRIORITY = {
    WarningStatus.GREEN: 0,
    WarningStatus.BLUE: 1,
    WarningStatus.YELLOW: 2,
    WarningStatus.RED: 3,
}


def calculate_warning_status(due_date: date | None, completed: bool, today: date | None = None) -> WarningStatus:
    current = today or date.today()
    if completed:
        return WarningStatus.GREEN
    if due_date is None:
        return WarningStatus.BLUE
    days_remaining = (due_date - current).days
    if days_remaining < 0:
        return WarningStatus.RED
    if days_remaining <= 30:
        return WarningStatus.YELLOW
    return WarningStatus.BLUE


def highest_warning(statuses: list[WarningStatus | str]) -> WarningStatus:
    if not statuses:
        return WarningStatus.GREEN
    normalized = [WarningStatus(status) for status in statuses]
    return max(normalized, key=lambda status: _PRIORITY[status])
```

- [ ] **Step 2: Run the status tests**

Run:

```powershell
cd backend
python -m pytest tests/test_status.py -q
```

Expected: PASS, five tests pass.

- [ ] **Step 3: Add deterministic date coverage**

Append to `backend/tests/test_status.py`:

```python
def test_status_accepts_explicit_today_for_seeded_data():
    today = date(2026, 7, 6)
    assert calculate_warning_status(date(2026, 8, 20), False, today) == WarningStatus.BLUE
    assert calculate_warning_status(date(2026, 7, 20), False, today) == WarningStatus.YELLOW
    assert calculate_warning_status(date(2026, 7, 1), False, today) == WarningStatus.RED
```

- [ ] **Step 4: Run all status tests again**

Run:

```powershell
cd backend
python -m pytest tests/test_status.py -q
```

Expected: PASS, six tests pass.

- [ ] **Step 5: Commit status service**

Run:

```powershell
git add backend/app/services/__init__.py backend/app/services/status.py backend/tests/test_status.py
git commit -m "feat: add four-color warning rules"
```

## Task 3: Backend Models, Seed Data, and Acceptance Rules

**Files:**
- Create: `backend/app/models.py`
- Create: `backend/app/services/acceptance.py`
- Create: `backend/app/seed.py`
- Create: `backend/tests/test_acceptance.py`

- [ ] **Step 1: Write failing acceptance tests**

Create `backend/tests/test_acceptance.py`:

```python
from app.services.acceptance import AcceptanceInput, check_acceptance_gate


def test_acceptance_gate_blocks_incomplete_project():
    result = check_acceptance_gate(
        AcceptanceInput(
            milestones_closed=False,
            outsourced_deliverables_accepted=True,
            budget_verified=True,
            core_deliverables_delivered=True,
            materials_complete=True,
        )
    )

    assert result.allowed is False
    assert "全部里程碑必须闭环" in result.blockers


def test_acceptance_gate_allows_complete_project():
    result = check_acceptance_gate(
        AcceptanceInput(
            milestones_closed=True,
            outsourced_deliverables_accepted=True,
            budget_verified=True,
            core_deliverables_delivered=True,
            materials_complete=True,
        )
    )

    assert result.allowed is True
    assert result.blockers == []
```

- [ ] **Step 2: Run the failing acceptance tests**

Run:

```powershell
cd backend
python -m pytest tests/test_acceptance.py -q
```

Expected: FAIL with `ModuleNotFoundError` or missing `app.services.acceptance`.

- [ ] **Step 3: Implement acceptance service**

Create `backend/app/services/acceptance.py`:

```python
from pydantic import BaseModel


class AcceptanceInput(BaseModel):
    milestones_closed: bool
    outsourced_deliverables_accepted: bool
    budget_verified: bool
    core_deliverables_delivered: bool
    materials_complete: bool


class AcceptanceResult(BaseModel):
    allowed: bool
    blockers: list[str]


def check_acceptance_gate(payload: AcceptanceInput) -> AcceptanceResult:
    blockers: list[str] = []
    if not payload.milestones_closed:
        blockers.append("全部里程碑必须闭环")
    if not payload.outsourced_deliverables_accepted:
        blockers.append("外协交付物必须验收合格")
    if not payload.budget_verified:
        blockers.append("节点经费必须完成匹配核销")
    if not payload.core_deliverables_delivered:
        blockers.append("核心交付物必须全部更新为已交付")
    if not payload.materials_complete:
        blockers.append("验收材料必须齐套")
    return AcceptanceResult(allowed=len(blockers) == 0, blockers=blockers)
```

- [ ] **Step 4: Implement ORM models**

Create `backend/app/models.py`:

```python
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    goal: Mapped[str] = mapped_column(Text)
    level: Mapped[str] = mapped_column(String(40), index=True)
    channel: Mapped[str] = mapped_column(String(80), index=True)
    department: Mapped[str] = mapped_column(String(120))
    lead_unit: Mapped[str] = mapped_column(String(120))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(40), default="进行中")
    warning_status: Mapped[str] = mapped_column(String(20), default="blue")
    transformation_status: Mapped[str] = mapped_column(String(40), default="未启动")
    acceptance_submitted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    team_members: Mapped[list["ProjectTeamMember"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    milestones: Mapped[list["Milestone"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    plans: Mapped[list["PlanItem"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    budgets: Mapped[list["BudgetRecord"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    changes: Mapped[list["ChangeRequest"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    deliverables: Mapped[list["Deliverable"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    partner_evaluations: Mapped[list["PartnerEvaluation"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    result_packages: Mapped[list["ResultPackage"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    post_evaluations: Mapped[list["PostEvaluation"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class ProjectTeamMember(Base):
    __tablename__ = "project_team_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    role: Mapped[str] = mapped_column(String(80))
    name: Mapped[str] = mapped_column(String(80))
    employee_no: Mapped[str] = mapped_column(String(40))
    project: Mapped[Project] = relationship(back_populates="team_members")


class Milestone(Base):
    __tablename__ = "milestones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    year: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(200))
    planned_finish_date: Mapped[date] = mapped_column(Date)
    actual_finish_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    budget_amount: Mapped[float] = mapped_column(Float, default=0)
    evidence_status: Mapped[str] = mapped_column(String(40), default="待上传")
    closure_status: Mapped[str] = mapped_column(String(40), default="未闭环")
    warning_status: Mapped[str] = mapped_column(String(20), default="blue")
    project: Mapped[Project] = relationship(back_populates="milestones")


class PlanItem(Base):
    __tablename__ = "plan_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    source_system: Mapped[str] = mapped_column(String(80), default="CMOS")
    title: Mapped[str] = mapped_column(String(200))
    due_date: Mapped[date] = mapped_column(Date)
    completion_status: Mapped[str] = mapped_column(String(40), default="待办")
    approval_status: Mapped[str] = mapped_column(String(40), default="未提交")
    warning_status: Mapped[str] = mapped_column(String(20), default="blue")
    project: Mapped[Project] = relationship(back_populates="plans")


class BudgetRecord(Base):
    __tablename__ = "budget_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    year: Mapped[int] = mapped_column(Integer)
    total_budget: Mapped[float] = mapped_column(Float)
    annual_budget: Mapped[float] = mapped_column(Float)
    annual_spent: Mapped[float] = mapped_column(Float)
    paid_amount: Mapped[float] = mapped_column(Float)
    verified_amount: Mapped[float] = mapped_column(Float)
    verification_status: Mapped[str] = mapped_column(String(40), default="待核销")
    project: Mapped[Project] = relationship(back_populates="budgets")


class HeadquartersBudget(Base):
    __tablename__ = "headquarters_budgets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    unit: Mapped[str] = mapped_column(String(120))
    year: Mapped[int] = mapped_column(Integer)
    approved_limit: Mapped[float] = mapped_column(Float)
    allocated_amount: Mapped[float] = mapped_column(Float)
    remaining_amount: Mapped[float] = mapped_column(Float)
    clearing_status: Mapped[str] = mapped_column(String(40), default="执行中")


class ChangeRequest(Base):
    __tablename__ = "change_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    change_type: Mapped[str] = mapped_column(String(40))
    change_scope: Mapped[str] = mapped_column(String(120))
    reason: Mapped[str] = mapped_column(Text)
    evidence: Mapped[str] = mapped_column(String(200))
    approval_status: Mapped[str] = mapped_column(String(40), default="待审核")
    requires_legal_review: Mapped[bool] = mapped_column(Boolean, default=False)
    submitted_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    project: Mapped[Project] = relationship(back_populates="changes")


class Deliverable(Base):
    __tablename__ = "deliverables"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    name: Mapped[str] = mapped_column(String(200))
    type: Mapped[str] = mapped_column(String(80))
    due_date: Mapped[date] = mapped_column(Date)
    delivered_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="待交付")
    ownership: Mapped[str] = mapped_column(String(120), default="公司")
    result_package_id: Mapped[int | None] = mapped_column(ForeignKey("result_packages.id"), nullable=True)
    warning_status: Mapped[str] = mapped_column(String(20), default="blue")
    project: Mapped[Project] = relationship(back_populates="deliverables")


class PartnerEvaluation(Base):
    __tablename__ = "partner_evaluations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    partner_name: Mapped[str] = mapped_column(String(160))
    partner_type: Mapped[str] = mapped_column(String(40))
    score: Mapped[float] = mapped_column(Float)
    grade: Mapped[str] = mapped_column(String(40))
    evaluation_due_date: Mapped[date] = mapped_column(Date)
    evaluation_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    evidence_status: Mapped[str] = mapped_column(String(40), default="待上传")
    blacklist_recommended: Mapped[bool] = mapped_column(Boolean, default=False)
    project: Mapped[Project] = relationship(back_populates="partner_evaluations")


class ResultPackage(Base):
    __tablename__ = "result_packages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    result_code: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    name: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(Text)
    transformation_method: Mapped[str] = mapped_column(String(80))
    transformation_form: Mapped[str] = mapped_column(String(80))
    planned_date: Mapped[date] = mapped_column(Date)
    actual_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="洽谈中")
    responsible_unit: Mapped[str] = mapped_column(String(120))
    linked_deliverable_count: Mapped[int] = mapped_column(Integer, default=0)
    project: Mapped[Project] = relationship(back_populates="result_packages")


class PostEvaluation(Base):
    __tablename__ = "post_evaluations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    due_date: Mapped[date] = mapped_column(Date)
    started_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    completed_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    goal_score: Mapped[float] = mapped_column(Float, default=0)
    schedule_score: Mapped[float] = mapped_column(Float, default=0)
    budget_score: Mapped[float] = mapped_column(Float, default=0)
    result_score: Mapped[float] = mapped_column(Float, default=0)
    partner_score: Mapped[float] = mapped_column(Float, default=0)
    risk_score: Mapped[float] = mapped_column(Float, default=0)
    approval_status: Mapped[str] = mapped_column(String(40), default="待发起")
    project: Mapped[Project] = relationship(back_populates="post_evaluations")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_role: Mapped[str] = mapped_column(String(80))
    actor_name: Mapped[str] = mapped_column(String(80))
    entity_type: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[int] = mapped_column(Integer)
    action: Mapped[str] = mapped_column(String(80))
    summary: Mapped[str] = mapped_column(Text)
    before_json: Mapped[str] = mapped_column(Text, default="{}")
    after_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
```

- [ ] **Step 5: Implement seed data**

Create `backend/app/seed.py`:

```python
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models import (
    AuditEvent,
    BudgetRecord,
    Deliverable,
    HeadquartersBudget,
    Milestone,
    PartnerEvaluation,
    PlanItem,
    PostEvaluation,
    Project,
    ProjectTeamMember,
    ResultPackage,
)
from app.services.status import calculate_warning_status, highest_warning


TODAY = date(2026, 7, 6)


def seed_database(db: Session) -> None:
    if db.query(Project).count() > 0:
        return

    projects = [
        Project(
            project_code="KY-2026-FED-001",
            name="高温复合材料工艺验证项目",
            goal="形成高温复合材料关键工艺验证依据和阶段成果。",
            level="联邦级",
            channel="重点研发计划",
            department="科研管理部",
            lead_unit="单位甲",
            start_date=date(2026, 1, 15),
            end_date=date(2027, 12, 31),
            status="进行中",
            transformation_status="未启动",
        ),
        Project(
            project_code="KY-2026-REG-002",
            name="绿色制造试验平台项目",
            goal="完成试验平台阶段检查和成果转化准备。",
            level="洲级",
            channel="科技创新行动计划",
            department="科研管理部",
            lead_unit="单位乙",
            start_date=date(2025, 9, 1),
            end_date=date(2026, 12, 20),
            status="进行中",
            transformation_status="洽谈中",
        ),
        Project(
            project_code="KY-2025-CORP-003",
            name="数字化试验数据治理项目",
            goal="沉淀试验数据治理流程并完成后评价准备。",
            level="公司级",
            channel="预研三年滚动计划",
            department="科研管理部",
            lead_unit="单位丙",
            start_date=date(2024, 3, 1),
            end_date=date(2025, 11, 30),
            status="已通过公司级验收",
            transformation_status="已转化应用",
            acceptance_submitted=True,
        ),
    ]
    db.add_all(projects)
    db.flush()

    for project in projects:
        db.add_all(
            [
                ProjectTeamMember(project_id=project.id, role="项目负责人", name="张工", employee_no="E1001"),
                ProjectTeamMember(project_id=project.id, role="一级总师", name="李总师", employee_no="E2001"),
                ProjectTeamMember(project_id=project.id, role="单位财务主管", name="王财务", employee_no="E3001"),
            ]
        )

    fed, regional, corp = projects
    db.add_all(
        [
            Milestone(project_id=fed.id, year=2026, title="完成工艺方案评审", planned_finish_date=TODAY - timedelta(days=5), budget_amount=120, evidence_status="待上传", closure_status="未闭环"),
            Milestone(project_id=fed.id, year=2026, title="完成试验件制造", planned_finish_date=TODAY + timedelta(days=55), budget_amount=180, evidence_status="待上传", closure_status="未闭环"),
            Milestone(project_id=regional.id, year=2026, title="完成阶段性检查", planned_finish_date=TODAY + timedelta(days=20), budget_amount=90, evidence_status="已上传", closure_status="未闭环"),
            Milestone(project_id=corp.id, year=2025, title="完成验收评审", planned_finish_date=date(2025, 10, 15), actual_finish_date=date(2025, 10, 10), budget_amount=60, evidence_status="已上传", closure_status="已闭环"),
        ]
    )
    db.flush()

    for milestone in db.query(Milestone).all():
        milestone.warning_status = calculate_warning_status(
            milestone.planned_finish_date,
            milestone.closure_status == "已闭环",
            TODAY,
        ).value

    db.add_all(
        [
            PlanItem(project_id=fed.id, title="CMOS 待办计划办结", due_date=TODAY + timedelta(days=18), completion_status="待办"),
            PlanItem(project_id=regional.id, title="阶段检查结论归档", due_date=TODAY + timedelta(days=40), completion_status="待办"),
            PlanItem(project_id=corp.id, title="验收材料归档", due_date=date(2025, 11, 1), completion_status="已完成", approval_status="已办结", warning_status="green"),
            BudgetRecord(project_id=fed.id, year=2026, total_budget=800, annual_budget=300, annual_spent=160, paid_amount=150, verified_amount=80, verification_status="部分核销"),
            BudgetRecord(project_id=regional.id, year=2026, total_budget=420, annual_budget=160, annual_spent=90, paid_amount=80, verified_amount=80, verification_status="已核销"),
            BudgetRecord(project_id=corp.id, year=2025, total_budget=220, annual_budget=80, annual_spent=76, paid_amount=76, verified_amount=76, verification_status="已核销"),
            HeadquartersBudget(unit="单位甲", year=2026, approved_limit=500, allocated_amount=260, remaining_amount=240),
            HeadquartersBudget(unit="单位乙", year=2026, approved_limit=300, allocated_amount=150, remaining_amount=150),
        ]
    )

    db.add_all(
        [
            Deliverable(project_id=fed.id, name="工艺验证报告", type="技术报告", due_date=TODAY + timedelta(days=25), status="待交付", ownership="公司"),
            Deliverable(project_id=regional.id, name="试验平台软件著作权", type="软著", due_date=TODAY + timedelta(days=75), delivered_at=TODAY - timedelta(days=3), status="已交付", ownership="公司"),
            Deliverable(project_id=corp.id, name="数据治理规范", type="技术标准", due_date=date(2025, 10, 1), delivered_at=date(2025, 9, 20), status="已交付", ownership="公司"),
        ]
    )
    db.flush()

    package = ResultPackage(
        result_code="CG-2026-0001",
        project_id=regional.id,
        name="绿色制造试验平台成果包",
        summary="面向试验平台的工艺数据采集和阶段检查成果。",
        transformation_method="向型号转化",
        transformation_form="装机",
        planned_date=TODAY + timedelta(days=90),
        status="洽谈中",
        responsible_unit="单位乙",
        linked_deliverable_count=1,
    )
    db.add(package)
    db.add_all(
        [
            PartnerEvaluation(project_id=corp.id, partner_name="协作单位甲", partner_type="参研", score=86, grade="良好", evaluation_due_date=date(2025, 12, 30), evaluation_date=date(2025, 12, 15), evidence_status="已上传"),
            PostEvaluation(project_id=corp.id, due_date=date(2028, 11, 30), approval_status="待发起"),
            AuditEvent(actor_role="系统", actor_name="seed", entity_type="Project", entity_id=fed.id, action="seed", summary="初始化联邦级示例项目"),
        ]
    )
    db.flush()

    for project in projects:
        project.warning_status = highest_warning([item.warning_status for item in project.milestones]).value

    db.commit()
```

- [ ] **Step 6: Run rule tests**

Run:

```powershell
cd backend
python -m pytest tests/test_status.py tests/test_acceptance.py -q
```

Expected: PASS.

- [ ] **Step 7: Commit models and rules**

Run:

```powershell
git add backend/app/models.py backend/app/services/acceptance.py backend/app/seed.py backend/tests/test_acceptance.py
git commit -m "feat: add platform data model and acceptance rules"
```

## Task 4: Backend API and Audit Service

**Files:**
- Create: `backend/app/services/audit.py`
- Create: `backend/app/schemas.py`
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/routers/projects.py`
- Create: `backend/app/routers/lifecycle.py`
- Create: `backend/app/routers/dashboard.py`
- Create: `backend/app/routers/reference.py`
- Create: `backend/app/main.py`
- Create: `backend/tests/test_api.py`

- [ ] **Step 1: Write failing API tests**

Create `backend/tests/test_api.py`:

```python
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_project_ledger_returns_seeded_projects():
    response = client.get("/api/projects")
    assert response.status_code == 200
    payload = response.json()
    assert len(payload) >= 3
    assert {item["level"] for item in payload} >= {"联邦级", "洲级", "公司级"}


def test_acceptance_gate_blocks_seeded_incomplete_project():
    projects = client.get("/api/projects").json()
    project_id = next(item["id"] for item in projects if item["project_code"] == "KY-2026-FED-001")
    response = client.get(f"/api/projects/{project_id}/acceptance-gate")
    assert response.status_code == 200
    payload = response.json()
    assert payload["allowed"] is False
    assert "全部里程碑必须闭环" in payload["blockers"]


def test_binding_unfinished_deliverable_is_rejected():
    projects = client.get("/api/projects").json()
    project_id = next(item["id"] for item in projects if item["project_code"] == "KY-2026-FED-001")
    detail = client.get(f"/api/projects/{project_id}").json()
    deliverable_id = detail["deliverables"][0]["id"]

    response = client.post(
        "/api/result-packages",
        json={
            "project_id": project_id,
            "name": "未完成成果包",
            "summary": "用于验证未交付成果不能绑定。",
            "transformation_method": "向市场转化",
            "transformation_form": "许可",
            "planned_date": "2026-12-20",
            "responsible_unit": "单位甲",
            "deliverable_ids": [deliverable_id],
        },
    )

    assert response.status_code == 400
    assert "只有已交付的交付物可绑定成果包" in response.json()["detail"]
```

- [ ] **Step 2: Run failing API tests**

Run:

```powershell
cd backend
python -m pytest tests/test_api.py -q
```

Expected: FAIL because `app.main` and routers are not implemented.

- [ ] **Step 3: Implement audit service**

Create `backend/app/services/audit.py`:

```python
import json
from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditEvent


def record_audit(
    db: Session,
    *,
    actor_role: str,
    actor_name: str,
    entity_type: str,
    entity_id: int,
    action: str,
    summary: str,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
) -> AuditEvent:
    event = AuditEvent(
        actor_role=actor_role,
        actor_name=actor_name,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        summary=summary,
        before_json=json.dumps(before or {}, ensure_ascii=False),
        after_json=json.dumps(after or {}, ensure_ascii=False),
    )
    db.add(event)
    db.flush()
    return event
```

- [ ] **Step 4: Implement API schemas**

Create `backend/app/schemas.py`:

```python
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class ProjectSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_code: str
    name: str
    goal: str
    level: str
    channel: str
    lead_unit: str
    start_date: date
    end_date: date
    status: str
    warning_status: str
    transformation_status: str


class TeamMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    name: str
    employee_no: str


class MilestoneOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    year: int
    title: str
    planned_finish_date: date
    actual_finish_date: date | None
    budget_amount: float
    evidence_status: str
    closure_status: str
    warning_status: str


class PlanItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_system: str
    title: str
    due_date: date
    completion_status: str
    approval_status: str
    warning_status: str


class BudgetRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    year: int
    total_budget: float
    annual_budget: float
    annual_spent: float
    paid_amount: float
    verified_amount: float
    verification_status: str


class ChangeRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    change_type: str
    change_scope: str
    reason: str
    evidence: str
    approval_status: str
    requires_legal_review: bool


class DeliverableOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: str
    due_date: date
    delivered_at: date | None
    status: str
    ownership: str
    result_package_id: int | None
    warning_status: str


class PartnerEvaluationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    partner_name: str
    partner_type: str
    score: float
    grade: str
    evaluation_due_date: date
    evaluation_date: date | None
    evidence_status: str
    blacklist_recommended: bool


class ResultPackageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    result_code: str
    project_id: int
    name: str
    summary: str
    transformation_method: str
    transformation_form: str
    planned_date: date
    actual_date: date | None
    status: str
    responsible_unit: str
    linked_deliverable_count: int


class PostEvaluationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    due_date: date
    started_at: date | None
    completed_at: date | None
    approval_status: str


class ProjectDetail(ProjectSummary):
    team_members: list[TeamMemberOut]
    milestones: list[MilestoneOut]
    plans: list[PlanItemOut]
    budgets: list[BudgetRecordOut]
    changes: list[ChangeRequestOut]
    deliverables: list[DeliverableOut]
    partner_evaluations: list[PartnerEvaluationOut]
    result_packages: list[ResultPackageOut]
    post_evaluations: list[PostEvaluationOut]


class AcceptanceGateOut(BaseModel):
    allowed: bool
    blockers: list[str]


class ResultPackageCreate(BaseModel):
    project_id: int
    name: str
    summary: str
    transformation_method: str
    transformation_form: str
    planned_date: date
    responsible_unit: str
    deliverable_ids: list[int]


class AuditEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    actor_role: str
    actor_name: str
    entity_type: str
    entity_id: int
    action: str
    summary: str
    created_at: datetime
```

- [ ] **Step 5: Implement routers**

Create `backend/app/routers/__init__.py` as an empty package marker.

Create `backend/app/routers/projects.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Project
from app.schemas import ProjectDetail, ProjectSummary

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[ProjectSummary])
def list_projects(db: Session = Depends(get_db)) -> list[Project]:
    return db.query(Project).order_by(Project.id).all()


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(project_id: int, db: Session = Depends(get_db)) -> Project:
    project = (
        db.query(Project)
        .options(
            selectinload(Project.team_members),
            selectinload(Project.milestones),
            selectinload(Project.plans),
            selectinload(Project.budgets),
            selectinload(Project.changes),
            selectinload(Project.deliverables),
            selectinload(Project.partner_evaluations),
            selectinload(Project.result_packages),
            selectinload(Project.post_evaluations),
        )
        .filter(Project.id == project_id)
        .first()
    )
    if project is None:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project
```

Create `backend/app/routers/lifecycle.py`:

```python
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Deliverable, Milestone, Project, ResultPackage
from app.schemas import AcceptanceGateOut, ResultPackageCreate, ResultPackageOut
from app.services.acceptance import AcceptanceInput, check_acceptance_gate
from app.services.audit import record_audit

router = APIRouter(prefix="/api", tags=["lifecycle"])


def _acceptance_input(project: Project) -> AcceptanceInput:
    return AcceptanceInput(
        milestones_closed=all(item.closure_status == "已闭环" for item in project.milestones),
        outsourced_deliverables_accepted=all(item.status == "已交付" for item in project.deliverables if "外协" in item.ownership),
        budget_verified=all(item.verification_status == "已核销" for item in project.budgets),
        core_deliverables_delivered=all(item.status == "已交付" for item in project.deliverables),
        materials_complete=any(item.evidence_status == "已上传" for item in project.milestones),
    )


@router.get("/projects/{project_id}/acceptance-gate", response_model=AcceptanceGateOut)
def get_acceptance_gate(project_id: int, db: Session = Depends(get_db)) -> AcceptanceGateOut:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="项目不存在")
    return check_acceptance_gate(_acceptance_input(project))


@router.post("/projects/{project_id}/acceptance/submit", response_model=AcceptanceGateOut)
def submit_acceptance(project_id: int, db: Session = Depends(get_db)) -> AcceptanceGateOut:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="项目不存在")
    result = check_acceptance_gate(_acceptance_input(project))
    if result.allowed:
        project.acceptance_submitted = True
        project.status = "验收提交中"
        record_audit(db, actor_role="管理团队", actor_name="系统演示用户", entity_type="Project", entity_id=project.id, action="submit_acceptance", summary="提交项目验收申请")
        db.commit()
    return result


@router.post("/result-packages", response_model=ResultPackageOut)
def create_result_package(payload: ResultPackageCreate, db: Session = Depends(get_db)) -> ResultPackage:
    project = db.get(Project, payload.project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="项目不存在")

    deliverables = db.query(Deliverable).filter(Deliverable.id.in_(payload.deliverable_ids)).all()
    if len(deliverables) != len(payload.deliverable_ids):
        raise HTTPException(status_code=404, detail="交付物不存在")
    if any(item.status != "已交付" for item in deliverables):
        raise HTTPException(status_code=400, detail="只有已交付的交付物可绑定成果包")

    result = ResultPackage(
        result_code=f"CG-{datetime.now().year}-{db.query(ResultPackage).count() + 1:04d}",
        project_id=project.id,
        name=payload.name,
        summary=payload.summary,
        transformation_method=payload.transformation_method,
        transformation_form=payload.transformation_form,
        planned_date=payload.planned_date,
        responsible_unit=payload.responsible_unit,
        linked_deliverable_count=len(deliverables),
    )
    db.add(result)
    db.flush()
    for deliverable in deliverables:
        deliverable.result_package_id = result.id
    project.transformation_status = result.status
    record_audit(db, actor_role="项目团队", actor_name="系统演示用户", entity_type="ResultPackage", entity_id=result.id, action="create_result_package", summary=f"创建成果包 {result.name}")
    db.commit()
    db.refresh(result)
    return result
```

Create `backend/app/routers/dashboard.py`:

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Deliverable, Milestone, PostEvaluation, Project

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
def get_summary(db: Session = Depends(get_db)) -> dict[str, int]:
    return {
        "project_count": db.query(Project).count(),
        "red_warning_count": db.query(Milestone).filter(Milestone.warning_status == "red").count(),
        "yellow_warning_count": db.query(Milestone).filter(Milestone.warning_status == "yellow").count(),
        "pending_acceptance_count": db.query(Project).filter(Project.acceptance_submitted.is_(False)).count(),
        "pending_deliverable_count": db.query(Deliverable).filter(Deliverable.status != "已交付").count(),
        "post_evaluation_count": db.query(PostEvaluation).count(),
    }
```

Create `backend/app/routers/reference.py`:

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuditEvent
from app.schemas import AuditEventOut

router = APIRouter(prefix="/api", tags=["reference"])


@router.get("/reference/roles")
def roles() -> list[dict[str, str]]:
    return [
        {"key": "project_team", "label": "项目团队", "scope": "本人关联项目填报和提交"},
        {"key": "chief_engineer", "label": "责任总师", "scope": "技术把关和材料评审"},
        {"key": "management", "label": "管理团队", "scope": "计划、经费、风险、评价和督办"},
        {"key": "finance", "label": "财务团队", "scope": "经费核对、付款、核销和异常监管"},
        {"key": "admin", "label": "超级管理员", "scope": "字典、渠道、流程模板和运维配置"},
    ]


@router.get("/reference/channels")
def channels() -> list[dict[str, str]]:
    return [
        {"level": "联邦级", "name": "重点研发计划"},
        {"level": "联邦级", "name": "联邦自然科学基金"},
        {"level": "洲级", "name": "科技创新行动计划"},
        {"level": "公司级", "name": "预研三年滚动计划"},
    ]


@router.get("/integrations/mock-sources")
def mock_sources() -> list[dict[str, str]]:
    return [
        {"system": "计划管理系统 / CMOS", "read": "计划节点、待办状态、办结结果", "confirm": "项目团队提交，二级单位管理团队终审", "fallback": "批量导入计划清单"},
        {"system": "财务平台", "read": "预算、支出、付款、核销", "confirm": "财务团队核对", "fallback": "二级单位财务上传凭证"},
        {"system": "合同采购系统", "read": "外协合同、付款节点、合同验收", "confirm": "管理团队和财务团队复核", "fallback": "合同材料上传归档"},
        {"system": "档案系统", "read": "归档材料状态", "confirm": "管理团队确认归档", "fallback": "平台保留线上归档副本"},
        {"system": "DOORS / 专业系统", "read": "需求、试验、构型、技术状态引用", "confirm": "责任总师复核", "fallback": "人工维护引用关系"},
    ]


@router.get("/audit-events", response_model=list[AuditEventOut])
def audit_events(db: Session = Depends(get_db)) -> list[AuditEvent]:
    return db.query(AuditEvent).order_by(AuditEvent.id.desc()).all()
```

- [ ] **Step 6: Implement FastAPI entrypoint**

Create `backend/app/main.py`:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, SessionLocal, engine
from app.routers import dashboard, lifecycle, projects, reference
from app.seed import seed_database

Base.metadata.create_all(bind=engine)
with SessionLocal() as db:
    seed_database(db)

app = FastAPI(title="Research Project Management Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(lifecycle.router)
app.include_router(dashboard.router)
app.include_router(reference.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 7: Run API tests**

Run:

```powershell
cd backend
python -m pytest -q
```

Expected: PASS.

- [ ] **Step 8: Run the backend app manually**

Run:

```powershell
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

Expected: server starts and `http://127.0.0.1:8000/api/health` returns `{"status":"ok"}`.

- [ ] **Step 9: Commit backend API**

Run:

```powershell
git add backend/app/services/audit.py backend/app/schemas.py backend/app/routers backend/app/main.py backend/tests/test_api.py
git commit -m "feat: add platform REST API"
```

## Task 5: Frontend Foundation and API Client

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/data/types.ts`
- Create: `frontend/src/styles.css`

- [ ] **Step 1: Create frontend package files**

Create `frontend/package.json`:

```json
{
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc && vite build",
    "preview": "vite preview --host 127.0.0.1"
  },
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "vite": "latest",
    "typescript": "latest",
    "react": "latest",
    "react-dom": "latest",
    "lucide-react": "latest"
  },
  "devDependencies": {
    "@types/react": "latest",
    "@types/react-dom": "latest"
  }
}
```

Create `frontend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": []
}
```

Create `frontend/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>科研项目管理平台</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create TypeScript data types**

Create `frontend/src/data/types.ts`:

```ts
export type WarningStatus = "green" | "blue" | "yellow" | "red";

export interface ProjectSummary {
  id: number;
  project_code: string;
  name: string;
  goal: string;
  level: string;
  channel: string;
  lead_unit: string;
  start_date: string;
  end_date: string;
  status: string;
  warning_status: WarningStatus;
  transformation_status: string;
}

export interface Milestone {
  id: number;
  year: number;
  title: string;
  planned_finish_date: string;
  actual_finish_date: string | null;
  budget_amount: number;
  evidence_status: string;
  closure_status: string;
  warning_status: WarningStatus;
}

export interface PlanItem {
  id: number;
  source_system: string;
  title: string;
  due_date: string;
  completion_status: string;
  approval_status: string;
  warning_status: WarningStatus;
}

export interface BudgetRecord {
  id: number;
  year: number;
  total_budget: number;
  annual_budget: number;
  annual_spent: number;
  paid_amount: number;
  verified_amount: number;
  verification_status: string;
}

export interface Deliverable {
  id: number;
  name: string;
  type: string;
  due_date: string;
  delivered_at: string | null;
  status: string;
  ownership: string;
  result_package_id: number | null;
  warning_status: WarningStatus;
}

export interface ResultPackage {
  id: number;
  result_code: string;
  project_id: number;
  name: string;
  summary: string;
  transformation_method: string;
  transformation_form: string;
  planned_date: string;
  actual_date: string | null;
  status: string;
  responsible_unit: string;
  linked_deliverable_count: number;
}

export interface PartnerEvaluation {
  id: number;
  partner_name: string;
  partner_type: string;
  score: number;
  grade: string;
  evaluation_due_date: string;
  evaluation_date: string | null;
  evidence_status: string;
  blacklist_recommended: boolean;
}

export interface PostEvaluation {
  id: number;
  due_date: string;
  started_at: string | null;
  completed_at: string | null;
  approval_status: string;
}

export interface ProjectDetail extends ProjectSummary {
  team_members: Array<{ id: number; role: string; name: string; employee_no: string }>;
  milestones: Milestone[];
  plans: PlanItem[];
  budgets: BudgetRecord[];
  changes: Array<{ id: number; change_type: string; change_scope: string; reason: string; evidence: string; approval_status: string; requires_legal_review: boolean }>;
  deliverables: Deliverable[];
  partner_evaluations: PartnerEvaluation[];
  result_packages: ResultPackage[];
  post_evaluations: PostEvaluation[];
}

export interface AcceptanceGate {
  allowed: boolean;
  blockers: string[];
}

export interface DashboardSummary {
  project_count: number;
  red_warning_count: number;
  yellow_warning_count: number;
  pending_acceptance_count: number;
  pending_deliverable_count: number;
  post_evaluation_count: number;
}

export interface AuditEvent {
  id: number;
  actor_role: string;
  actor_name: string;
  entity_type: string;
  entity_id: number;
  action: string;
  summary: string;
  created_at: string;
}
```

- [ ] **Step 3: Create API client**

Create `frontend/src/api/client.ts`:

```ts
import type { AcceptanceGate, AuditEvent, DashboardSummary, ProjectDetail, ProjectSummary } from "../data/types";

const API_BASE = "http://127.0.0.1:8000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  summary: () => request<DashboardSummary>("/dashboard/summary"),
  projects: () => request<ProjectSummary[]>("/projects"),
  project: (id: number) => request<ProjectDetail>(`/projects/${id}`),
  acceptanceGate: (id: number) => request<AcceptanceGate>(`/projects/${id}/acceptance-gate`),
  submitAcceptance: (id: number) => request<AcceptanceGate>(`/projects/${id}/acceptance/submit`, { method: "POST" }),
  roles: () => request<Array<{ key: string; label: string; scope: string }>>("/reference/roles"),
  integrations: () => request<Array<{ system: string; read: string; confirm: string; fallback: string }>>("/integrations/mock-sources"),
  auditEvents: () => request<AuditEvent[]>("/audit-events"),
};
```

- [ ] **Step 4: Create bootstrap and CSS**

Create `frontend/src/main.tsx`:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

Create `frontend/src/styles.css` with the first layout tokens:

```css
:root {
  font-family: Inter, "Microsoft YaHei", system-ui, sans-serif;
  color: #1f2933;
  background: #edf1f5;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 1180px;
}

button,
select,
input {
  font: inherit;
}

.app-shell {
  display: grid;
  grid-template-columns: 248px 1fr;
  min-height: 100vh;
}

.sidebar {
  background: #17324d;
  color: #fff;
  padding: 20px 16px;
}

.brand {
  font-size: 18px;
  font-weight: 700;
  line-height: 1.35;
  margin-bottom: 24px;
}

.nav-button {
  width: 100%;
  border: 0;
  background: transparent;
  color: #dbe8f5;
  text-align: left;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
}

.nav-button.active {
  background: #2f5878;
  color: #fff;
}

.main {
  padding: 20px 24px 36px;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.page-title {
  margin: 0;
  font-size: 24px;
  line-height: 1.25;
}

.panel {
  background: #fff;
  border: 1px solid #d7dee8;
  border-radius: 8px;
  padding: 16px;
}

.grid {
  display: grid;
  gap: 14px;
}

.grid.cols-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.metric {
  background: #fff;
  border: 1px solid #d7dee8;
  border-radius: 8px;
  padding: 16px;
}

.metric strong {
  display: block;
  font-size: 28px;
  margin-top: 8px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.data-table th,
.data-table td {
  border-bottom: 1px solid #e2e8f0;
  padding: 10px 8px;
  text-align: left;
  vertical-align: top;
}

.data-table th {
  color: #526476;
  font-weight: 600;
  background: #f8fafc;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  min-width: 56px;
  justify-content: center;
  border-radius: 999px;
  padding: 3px 8px;
  font-size: 12px;
  font-weight: 700;
}

.status-green {
  background: #daf5e4;
  color: #17693a;
}

.status-blue {
  background: #dceeff;
  color: #1f5c94;
}

.status-yellow {
  background: #fff0bf;
  color: #8a5a00;
}

.status-red {
  background: #ffe0df;
  color: #9f1f1b;
}

.split {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 14px;
}

.section-title {
  margin: 0 0 10px;
  font-size: 16px;
}
```

- [ ] **Step 5: Install frontend dependencies and run build failure check**

Run:

```powershell
cd frontend
npm install
npm run build
```

Expected: FAIL with TypeScript error because `src/App.tsx` does not exist yet.

- [ ] **Step 6: Commit frontend foundation**

Run:

```powershell
git add frontend/package.json frontend/tsconfig.json frontend/index.html frontend/src/main.tsx frontend/src/api/client.ts frontend/src/data/types.ts frontend/src/styles.css
git commit -m "feat: add frontend workbench foundation"
```

## Task 6: Frontend Workbench Components and Pages

**Files:**
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/components/DataTable.tsx`
- Create: `frontend/src/components/StatusBadge.tsx`
- Create: `frontend/src/components/RoleSwitcher.tsx`
- Create: `frontend/src/pages/Dashboard.tsx`
- Create: `frontend/src/pages/Ledger.tsx`
- Create: `frontend/src/pages/ProjectDetail.tsx`
- Create: `frontend/src/pages/Initiation.tsx`
- Create: `frontend/src/pages/Execution.tsx`
- Create: `frontend/src/pages/Acceptance.tsx`
- Create: `frontend/src/pages/Transformation.tsx`
- Create: `frontend/src/pages/PostEvaluation.tsx`
- Create: `frontend/src/pages/Integrations.tsx`
- Create: `frontend/src/pages/AuditLog.tsx`

- [ ] **Step 1: Create reusable components**

Create `frontend/src/components/StatusBadge.tsx`:

```tsx
import type { WarningStatus } from "../data/types";

const labels: Record<WarningStatus, string> = {
  green: "绿色",
  blue: "蓝色",
  yellow: "黄色",
  red: "红色",
};

export function StatusBadge({ status }: { status: WarningStatus }) {
  return <span className={`status-badge status-${status}`}>{labels[status]}</span>;
}
```

Create `frontend/src/components/DataTable.tsx`:

```tsx
import type { ReactNode } from "react";

interface Column<T> {
  key: string;
  title: string;
  render: (row: T) => ReactNode;
}

export function DataTable<T>({ columns, rows }: { columns: Column<T>[]; rows: T[] }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key}>{column.title}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            {columns.map((column) => (
              <td key={column.key}>{column.render(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

Create `frontend/src/components/RoleSwitcher.tsx`:

```tsx
const roles = ["项目团队", "责任总师", "管理团队", "财务团队", "超级管理员"];

export function RoleSwitcher({ role, onRoleChange }: { role: string; onRoleChange: (role: string) => void }) {
  return (
    <label>
      当前角色{" "}
      <select value={role} onChange={(event) => onRoleChange(event.target.value)}>
        {roles.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </label>
  );
}
```

- [ ] **Step 2: Create dashboard and ledger pages**

Create `frontend/src/pages/Dashboard.tsx`:

```tsx
import { useEffect, useState } from "react";

import { api } from "../api/client";
import type { DashboardSummary } from "../data/types";

export function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    api.summary().then(setSummary).catch(console.error);
  }, []);

  if (!summary) return <div className="panel">加载看板数据...</div>;

  return (
    <div className="grid cols-3">
      <div className="metric">项目总数<strong>{summary.project_count}</strong></div>
      <div className="metric">红色告警<strong>{summary.red_warning_count}</strong></div>
      <div className="metric">黄色预警<strong>{summary.yellow_warning_count}</strong></div>
      <div className="metric">待验收项目<strong>{summary.pending_acceptance_count}</strong></div>
      <div className="metric">待交付成果<strong>{summary.pending_deliverable_count}</strong></div>
      <div className="metric">后评价任务<strong>{summary.post_evaluation_count}</strong></div>
    </div>
  );
}
```

Create `frontend/src/pages/Ledger.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";

import { api } from "../api/client";
import { DataTable } from "../components/DataTable";
import { StatusBadge } from "../components/StatusBadge";
import type { ProjectSummary } from "../data/types";

export function Ledger({ onOpenProject }: { onOpenProject: (id: number) => void }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [level, setLevel] = useState("全部");

  useEffect(() => {
    api.projects().then(setProjects).catch(console.error);
  }, []);

  const filtered = useMemo(
    () => (level === "全部" ? projects : projects.filter((project) => project.level === level)),
    [level, projects],
  );

  return (
    <div className="panel">
      <div className="topbar">
        <h2 className="section-title">项目一本账</h2>
        <select value={level} onChange={(event) => setLevel(event.target.value)}>
          <option>全部</option>
          <option>联邦级</option>
          <option>洲级</option>
          <option>公司级</option>
        </select>
      </div>
      <DataTable
        rows={filtered}
        columns={[
          { key: "code", title: "项目编号", render: (row) => row.project_code },
          { key: "name", title: "项目名称", render: (row) => <button onClick={() => onOpenProject(row.id)}>{row.name}</button> },
          { key: "level", title: "层级", render: (row) => row.level },
          { key: "channel", title: "渠道", render: (row) => row.channel },
          { key: "unit", title: "牵头单位", render: (row) => row.lead_unit },
          { key: "status", title: "项目状态", render: (row) => row.status },
          { key: "warning", title: "预警", render: (row) => <StatusBadge status={row.warning_status} /> },
          { key: "result", title: "成果转化", render: (row) => row.transformation_status },
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 3: Create project detail and execution pages**

Create `frontend/src/pages/ProjectDetail.tsx`:

```tsx
import { useEffect, useState } from "react";

import { api } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";
import type { ProjectDetail as ProjectDetailType } from "../data/types";

export function ProjectDetail({ projectId }: { projectId: number }) {
  const [project, setProject] = useState<ProjectDetailType | null>(null);

  useEffect(() => {
    api.project(projectId).then(setProject).catch(console.error);
  }, [projectId]);

  if (!project) return <div className="panel">加载项目详情...</div>;

  return (
    <div className="grid">
      <div className="panel">
        <h2 className="section-title">{project.name}</h2>
        <p>{project.goal}</p>
        <p>
          {project.project_code} / {project.level} / {project.channel} / {project.lead_unit} / <StatusBadge status={project.warning_status} />
        </p>
      </div>
      <div className="split">
        <div className="panel">
          <h3 className="section-title">角色边界</h3>
          <ul>
            {project.team_members.map((member) => (
              <li key={member.id}>{member.role}：{member.name}（{member.employee_no}）</li>
            ))}
          </ul>
        </div>
        <div className="panel">
          <h3 className="section-title">生命周期对象</h3>
          <p>里程碑 {project.milestones.length} 项，计划 {project.plans.length} 项，经费记录 {project.budgets.length} 项，交付物 {project.deliverables.length} 项，成果包 {project.result_packages.length} 项。</p>
        </div>
      </div>
    </div>
  );
}
```

Create `frontend/src/pages/Execution.tsx`:

```tsx
import { useEffect, useState } from "react";

import { api } from "../api/client";
import { DataTable } from "../components/DataTable";
import { StatusBadge } from "../components/StatusBadge";
import type { ProjectDetail } from "../data/types";

export function Execution({ projectId }: { projectId: number }) {
  const [project, setProject] = useState<ProjectDetail | null>(null);

  useEffect(() => {
    api.project(projectId).then(setProject).catch(console.error);
  }, [projectId]);

  if (!project) return <div className="panel">加载实施管理...</div>;

  return (
    <div className="grid">
      <div className="panel">
        <h2 className="section-title">里程碑与计划管理</h2>
        <DataTable
          rows={project.milestones}
          columns={[
            { key: "title", title: "里程碑", render: (row) => row.title },
            { key: "date", title: "计划完成", render: (row) => row.planned_finish_date },
            { key: "budget", title: "节点预算", render: (row) => `${row.budget_amount} 万元` },
            { key: "closure", title: "闭环状态", render: (row) => row.closure_status },
            { key: "warning", title: "预警", render: (row) => <StatusBadge status={row.warning_status} /> },
          ]}
        />
      </div>
      <div className="panel">
        <h2 className="section-title">经费执行账</h2>
        <DataTable
          rows={project.budgets}
          columns={[
            { key: "year", title: "年度", render: (row) => row.year },
            { key: "budget", title: "年度预算", render: (row) => `${row.annual_budget} 万元` },
            { key: "spent", title: "年度支出", render: (row) => `${row.annual_spent} 万元` },
            { key: "verified", title: "核销金额", render: (row) => `${row.verified_amount} 万元` },
            { key: "status", title: "核销状态", render: (row) => row.verification_status },
          ]}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create initiation filing page**

Create `frontend/src/pages/Initiation.tsx`:

```tsx
import { useEffect, useState } from "react";

import { api } from "../api/client";
import type { ProjectDetail } from "../data/types";

export function Initiation({ projectId }: { projectId: number }) {
  const [project, setProject] = useState<ProjectDetail | null>(null);

  useEffect(() => {
    api.project(projectId).then(setProject).catch(console.error);
  }, [projectId]);

  if (!project) return <div className="panel">加载立项备案...</div>;

  const materialRows = [
    { name: "项目建议书 / 申请书", status: project.level === "公司级" ? "已归档" : "待补充" },
    { name: "立项批复 / 立项通知", status: project.status.includes("验收") ? "已归档" : "备案中" },
    { name: "任务书 / 合同文本", status: project.deliverables.length > 0 ? "已关联" : "待关联" },
  ];

  return (
    <div className="grid">
      <div className="panel">
        <h2 className="section-title">立项备案</h2>
        <p>{project.name}</p>
        <p>项目层级：{project.level} / 渠道：{project.channel} / 牵头单位：{project.lead_unit}</p>
      </div>
      <div className="panel">
        <h3 className="section-title">材料状态</h3>
        <ul>
          {materialRows.map((row) => (
            <li key={row.name}>{row.name}：{row.status}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create acceptance and transformation pages**

Create `frontend/src/pages/Acceptance.tsx`:

```tsx
import { useEffect, useState } from "react";

import { api } from "../api/client";
import { DataTable } from "../components/DataTable";
import { StatusBadge } from "../components/StatusBadge";
import type { AcceptanceGate, ProjectDetail } from "../data/types";

export function Acceptance({ projectId }: { projectId: number }) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [gate, setGate] = useState<AcceptanceGate | null>(null);

  useEffect(() => {
    api.project(projectId).then(setProject).catch(console.error);
    api.acceptanceGate(projectId).then(setGate).catch(console.error);
  }, [projectId]);

  if (!project || !gate) return <div className="panel">加载验收门禁...</div>;

  return (
    <div className="grid">
      <div className="panel">
        <h2 className="section-title">验收提交门禁</h2>
        <p>{gate.allowed ? "前置条件已满足，可以提交验收。" : "前置条件未满足，系统阻断验收提交。"}</p>
        <ul>
          {gate.blockers.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="panel">
        <h2 className="section-title">交付物</h2>
        <DataTable
          rows={project.deliverables}
          columns={[
            { key: "name", title: "交付物", render: (row) => row.name },
            { key: "type", title: "类型", render: (row) => row.type },
            { key: "due", title: "到期", render: (row) => row.due_date },
            { key: "status", title: "状态", render: (row) => row.status },
            { key: "warning", title: "预警", render: (row) => <StatusBadge status={row.warning_status} /> },
          ]}
        />
      </div>
    </div>
  );
}
```

Create `frontend/src/pages/Transformation.tsx`:

```tsx
import { useEffect, useState } from "react";

import { api } from "../api/client";
import { DataTable } from "../components/DataTable";
import type { ProjectDetail } from "../data/types";

export function Transformation({ projectId }: { projectId: number }) {
  const [project, setProject] = useState<ProjectDetail | null>(null);

  useEffect(() => {
    api.project(projectId).then(setProject).catch(console.error);
  }, [projectId]);

  if (!project) return <div className="panel">加载成果转化...</div>;

  return (
    <div className="panel">
      <h2 className="section-title">成果包台账</h2>
      <DataTable
        rows={project.result_packages}
        columns={[
          { key: "code", title: "成果编号", render: (row) => row.result_code },
          { key: "name", title: "成果包", render: (row) => row.name },
          { key: "method", title: "转化方式", render: (row) => row.transformation_method },
          { key: "form", title: "转化形式", render: (row) => row.transformation_form },
          { key: "date", title: "计划时间", render: (row) => row.planned_date },
          { key: "count", title: "绑定交付物", render: (row) => row.linked_deliverable_count },
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 6: Create post-evaluation, integrations, and audit pages**

Create `frontend/src/pages/PostEvaluation.tsx`:

```tsx
import { useEffect, useState } from "react";

import { api } from "../api/client";
import { DataTable } from "../components/DataTable";
import type { ProjectSummary } from "../data/types";

export function PostEvaluation() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  useEffect(() => {
    api.projects().then(setProjects).catch(console.error);
  }, []);

  return (
    <div className="panel">
      <h2 className="section-title">后评价任务</h2>
      <DataTable
        rows={projects.filter((project) => project.status.includes("验收"))}
        columns={[
          { key: "code", title: "项目编号", render: (row) => row.project_code },
          { key: "name", title: "项目名称", render: (row) => row.name },
          { key: "unit", title: "牵头单位", render: (row) => row.lead_unit },
          { key: "status", title: "状态", render: (row) => row.status },
        ]}
      />
    </div>
  );
}
```

Create `frontend/src/pages/Integrations.tsx`:

```tsx
import { useEffect, useState } from "react";

import { api } from "../api/client";
import { DataTable } from "../components/DataTable";

interface IntegrationSource {
  system: string;
  read: string;
  confirm: string;
  fallback: string;
}

export function Integrations() {
  const [sources, setSources] = useState<IntegrationSource[]>([]);

  useEffect(() => {
    api.integrations().then(setSources).catch(console.error);
  }, []);

  return (
    <div className="panel">
      <h2 className="section-title">模拟系统联动</h2>
      <DataTable
        rows={sources}
        columns={[
          { key: "system", title: "系统", render: (row) => row.system },
          { key: "read", title: "读入字段", render: (row) => row.read },
          { key: "confirm", title: "确认角色", render: (row) => row.confirm },
          { key: "fallback", title: "替代方式", render: (row) => row.fallback },
        ]}
      />
    </div>
  );
}
```

Create `frontend/src/pages/AuditLog.tsx`:

```tsx
import { useEffect, useState } from "react";

import { api } from "../api/client";
import { DataTable } from "../components/DataTable";
import type { AuditEvent } from "../data/types";

export function AuditLog() {
  const [events, setEvents] = useState<AuditEvent[]>([]);

  useEffect(() => {
    api.auditEvents().then(setEvents).catch(console.error);
  }, []);

  return (
    <div className="panel">
      <h2 className="section-title">审计日志</h2>
      <DataTable
        rows={events}
        columns={[
          { key: "time", title: "时间", render: (row) => new Date(row.created_at).toLocaleString() },
          { key: "actor", title: "角色", render: (row) => `${row.actor_role} / ${row.actor_name}` },
          { key: "entity", title: "对象", render: (row) => `${row.entity_type} #${row.entity_id}` },
          { key: "action", title: "动作", render: (row) => row.action },
          { key: "summary", title: "摘要", render: (row) => row.summary },
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 7: Create App routing shell**

Create `frontend/src/App.tsx`:

```tsx
import { type ComponentType, useState } from "react";
import { ClipboardList, Database, FileCheck2, GitBranch, Home, Landmark, Layers, ScrollText } from "lucide-react";

import { RoleSwitcher } from "./components/RoleSwitcher";
import { Acceptance } from "./pages/Acceptance";
import { AuditLog } from "./pages/AuditLog";
import { Dashboard } from "./pages/Dashboard";
import { Execution } from "./pages/Execution";
import { Initiation } from "./pages/Initiation";
import { Integrations } from "./pages/Integrations";
import { Ledger } from "./pages/Ledger";
import { PostEvaluation } from "./pages/PostEvaluation";
import { ProjectDetail } from "./pages/ProjectDetail";
import { Transformation } from "./pages/Transformation";

type PageKey = "dashboard" | "ledger" | "detail" | "initiation" | "execution" | "acceptance" | "transformation" | "post" | "integrations" | "audit";

const navItems: Array<{ key: PageKey; label: string; icon: ComponentType<{ size?: number }> }> = [
  { key: "dashboard", label: "管理看板", icon: Home },
  { key: "ledger", label: "项目一本账", icon: Database },
  { key: "detail", label: "项目详情", icon: ClipboardList },
  { key: "initiation", label: "立项备案", icon: ClipboardList },
  { key: "execution", label: "实施管理", icon: GitBranch },
  { key: "acceptance", label: "验收管理", icon: FileCheck2 },
  { key: "transformation", label: "成果转化", icon: Layers },
  { key: "post", label: "后评价", icon: Landmark },
  { key: "integrations", label: "系统联动", icon: GitBranch },
  { key: "audit", label: "审计日志", icon: ScrollText },
];

export default function App() {
  const [page, setPage] = useState<PageKey>("dashboard");
  const [role, setRole] = useState("管理团队");
  const [activeProjectId, setActiveProjectId] = useState(1);

  const openProject = (id: number) => {
    setActiveProjectId(id);
    setPage("detail");
  };

  const renderPage = () => {
    if (page === "dashboard") return <Dashboard />;
    if (page === "ledger") return <Ledger onOpenProject={openProject} />;
    if (page === "detail") return <ProjectDetail projectId={activeProjectId} />;
    if (page === "initiation") return <Initiation projectId={activeProjectId} />;
    if (page === "execution") return <Execution projectId={activeProjectId} />;
    if (page === "acceptance") return <Acceptance projectId={activeProjectId} />;
    if (page === "transformation") return <Transformation projectId={activeProjectId} />;
    if (page === "post") return <PostEvaluation />;
    if (page === "integrations") return <Integrations />;
    return <AuditLog />;
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">科研项目信息化管理平台</div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.key} className={`nav-button ${page === item.key ? "active" : ""}`} onClick={() => setPage(item.key)}>
              <Icon size={16} /> {item.label}
            </button>
          );
        })}
      </aside>
      <main className="main">
        <div className="topbar">
          <h1 className="page-title">全生命周期一本账工作台</h1>
          <RoleSwitcher role={role} onRoleChange={setRole} />
        </div>
        {renderPage()}
      </main>
    </div>
  );
}
```

- [ ] **Step 8: Run frontend build**

Run:

```powershell
cd frontend
npm run build
```

Expected: PASS and Vite writes `dist/`.

- [ ] **Step 9: Commit frontend pages**

Run:

```powershell
git add frontend/src
git commit -m "feat: add platform workbench UI"
```

## Task 7: Runtime Verification and Documentation

**Files:**
- Create: `README.md`
- Modify: `.gitignore` only if generated files not already ignored.

- [ ] **Step 1: Write README**

Create `README.md`:

```markdown
# 科研项目信息化管理平台 MVP

本项目是基于 `科研项目信息化管理平台需求V18.docx` 的本地可运行全栈骨架。首版覆盖项目一本账、角色视图、实施管理、四色预警、验收门禁、成果转化、后评价、模拟系统联动和审计日志。

## 后端

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m pytest -q
python -m uvicorn app.main:app --reload --port 8000
```

健康检查：

```text
http://127.0.0.1:8000/api/health
```

## 前端

```powershell
cd frontend
npm install
npm run build
npm run dev
```

访问：

```text
http://127.0.0.1:5173
```

## 首版边界

- 本地 SQLite 数据库和 seed 数据用于演示。
- 角色切换用于工作台视图演示，不是企业级认证授权。
- 外部系统联动是模拟数据源，不执行真实写回。
- 验收门禁、四色预警、成果绑定和审计日志是真实后端规则。
```

- [ ] **Step 2: Run full backend tests**

Run:

```powershell
cd backend
python -m pytest -q
```

Expected: PASS.

- [ ] **Step 3: Run frontend build**

Run:

```powershell
cd frontend
npm run build
```

Expected: PASS.

- [ ] **Step 4: Start local servers**

Terminal 1:

```powershell
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

Terminal 2:

```powershell
cd frontend
npm run dev
```

Expected:

- Backend listens on `http://127.0.0.1:8000`.
- Frontend listens on `http://127.0.0.1:5173`.

- [ ] **Step 5: Browser smoke test**

Open `http://127.0.0.1:5173` and verify:

- The first screen is the platform workbench, not a marketing page.
- Dashboard metrics load from the backend.
- Project ledger shows at least three seeded projects.
- Opening a project shows lifecycle counts and role members.
- Initiation page shows project level, channel, filing state, and material status.
- Execution page shows milestone warning badges.
- Acceptance page shows blockers for `KY-2026-FED-001`.
- Transformation page shows the seeded result package.
- Integrations page lists mock sources and fallback paths.
- Audit page lists at least the seed audit event.
- Browser console has no red errors.

- [ ] **Step 6: Commit documentation and verification state**

Run:

```powershell
git add README.md
git commit -m "docs: add local run instructions"
git status --short
```

Expected: only pre-existing untracked files remain, such as original DOCX, existing customer deck files, legacy docs, and assets.

## Self-Review Notes

Spec coverage:

- Project ledger: Task 3 models, Task 4 API, Task 6 ledger/detail pages.
- Role workbench: Task 3 team members, Task 6 role switcher and role display.
- Initiation: Task 6 includes a dedicated filing page with project level, channel, filing state, and material status.
- Implementation management: Task 3 milestones/plans/budgets/changes model, Task 6 execution page.
- Four-color warning: Task 2 service and tests, Task 3 seeded warning statuses, Task 6 badges.
- Dual-track budget: Task 3 project budgets and headquarters budget model, Task 6 execution budget table.
- Acceptance gate: Task 3 service/tests, Task 4 endpoint/tests, Task 6 page.
- Deliverables and transformation: Task 3 models, Task 4 result package API rule, Task 6 acceptance/transformation pages.
- Partner evaluation and post-evaluation: Task 3 models/seed, Task 6 post-evaluation page.
- Audit trail: Task 4 audit service/API, Task 6 audit page.
- Mock integrations: Task 4 reference router, Task 6 integrations page.
- Verification and run instructions: Task 7.
