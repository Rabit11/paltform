import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const CHANNELS = [
  { id: 'mjky', level: '国家级', dept: 'GXB', name: 'MJKY', flow: '建议书申报→立项批复→任务书申报→中期评估→两级验收→国家级验收' },
  { id: '04zx', level: '国家级', dept: 'GXB', name: '04专项接续', flow: '建议书申报→立项批复→合同书签署→中期评估→两级验收→国家级验收' },
  { id: 'zdyf', level: '国家级', dept: 'GXB', name: '重点研发计划', flow: '申请书提交→评审→任务书签署→启动会→中期评估→综合绩效评价' },
  { id: 'xx25', level: '国家级', dept: '国资委', name: 'XX25专项', flow: '任务清单报送→评估下达→签署任务书→季度会/双月报→现场督导→验收评估' },
  { id: 'nsfc', level: '国家级', dept: '科学技术部', name: '国家自然科学基金', flow: '申请书提交→评审→批准通知→年度报告→中期评估→国家级验收' },
  { id: 'fgw', level: '国家级', dept: 'FGW', name: 'FGW GXJC项目', flow: '申报→批复→实施→验收' },
  { id: 'shjb', level: '地方级', dept: '上海市科委', name: '上海市科技攻关揭榜挂帅', flow: '榜单发布→申报评审→合同签订→中期评审→科委验收' },
  { id: 'shkj', level: '地方级', dept: '上海市科委', name: '上海市科技创新行动计划', flow: '建议书申报→评审→立项→合同签订→综合绩效评价' },
  { id: 'yy3n', level: '公司级', dept: '科技部', name: '预研三年滚动计划', flow: '建议书申报→评审→立项→任务书确认→阶段性检查→公司级验收' },
  { id: 'zdcx', level: '公司级', dept: '科技部', name: '重大科技创新专项', flow: '建议书申报→评审→立项→实施→验收' },
  { id: 'xjqx', level: '公司级', dept: '科技部', name: '新疆大飞机气象创新中心', flow: '申请书→委员会审议→立项→任务书→验收' },
  { id: 'dyjy', level: '公司级', dept: '科技部', name: '大飞机研究院', flow: '建议书→评审→理事会审议→立项→实施→验收' },
  { id: 'cllm', level: '公司级', dept: '科技部', name: '大飞机先进材料创新联盟', flow: '申报→专委会审议→理事会审议→立项→实施→验收' },
];

const USERS = [
  { username: 'hq_admin', password: 'Keyan@2026', name: '陈建国', role: 'hq', org: '总部科技部', title: '总部治理' },
  { username: 'leader_li', password: 'Keyan@2026', name: '李振华', role: 'leader', org: '总部', title: '分管领导' },
  { username: 'dept_wang', password: 'Keyan@2026', name: '王海涛', role: 'dept', org: '试飞中心', title: '单位科技部长' },
  { username: 'pm_zhao', password: 'Keyan@2026', name: '赵明远', role: 'pm', org: '总部科技部', title: '项目主管' },
  { username: 'owner_zhou', password: 'Keyan@2026', name: '周明', role: 'owner', org: '试飞中心', title: '项目负责人' },
  { username: 'member_zhang', password: 'Keyan@2026', name: '张晓', role: 'member', org: '试飞中心', title: '项目成员' },
];

const PROJECTS = [
  { id: 'p01', code: 'KY-2024-001', name: '宽体客机复合材料机翼结构优化研究', goal: '突破大尺寸复合材料机翼关键制造技术', level: '国家级', channelId: 'mjky', channelName: 'MJKY', org: '试飞中心', owner: '周明', phase: '实施', risk: 'yellow', budgetTotal: 3200, budgetSpent: 1850, budgetYear: 800, budgetYearSpent: 420, startDate: '2024-03-01', endDate: '2027-12-31', outcomeStatus: '技术储备待应用', status: '进行中', over100M: false, postEvalStatus: 'pending' },
  { id: 'p02', code: 'KY-2024-002', name: '航空发动机高温合金叶片寿命预测', goal: '建立叶片寿命预测模型与验证平台', level: '国家级', channelId: 'zdyf', channelName: '重点研发计划', org: '发动机公司', owner: '刘洋', phase: '实施', risk: 'red', budgetTotal: 5600, budgetSpent: 3200, budgetYear: 1200, budgetYearSpent: 680, startDate: '2024-01-15', endDate: '2026-06-30', outcomeStatus: '接续研发立项', status: '进行中', over100M: false, postEvalStatus: 'pending' },
  { id: 'p03', code: 'KY-2023-015', name: '民机适航审定关键技术攻关', goal: '形成适航审定技术体系与工具链', level: '国家级', channelId: '04zx', channelName: '04专项接续', org: '适航审定中心', owner: '孙伟', phase: '验收', risk: 'blue', budgetTotal: 8900, budgetSpent: 7200, budgetYear: 1500, budgetYearSpent: 1200, startDate: '2023-06-01', endDate: '2025-12-31', outcomeStatus: '已转化应用', status: '已通过公司级验收', over100M: false, postEvalStatus: 'in_progress' },
  { id: 'p04', code: 'KY-2025-003', name: '可持续航空燃料适航验证研究', goal: '完成SAF适航验证方法研究', level: '公司级', channelId: 'zdcx', channelName: '重大科技创新专项', org: '试飞中心', owner: '周明', phase: '立项', risk: 'green', budgetTotal: 1200, budgetSpent: 80, budgetYear: 400, budgetYearSpent: 80, startDate: '2025-01-10', endDate: '2027-06-30', outcomeStatus: '技术储备待应用', status: '进行中', over100M: false, postEvalStatus: 'pending' },
  { id: 'p05', code: 'KY-2022-008', name: '大型客机飞控系统综合验证平台', goal: '建设飞控系统综合验证平台', level: '国家级', channelId: 'xx25', channelName: 'XX25专项', org: '上飞院', owner: '陈刚', phase: '后评价', risk: 'green', budgetTotal: 12500, budgetSpent: 11800, budgetYear: 0, budgetYearSpent: 0, startDate: '2022-03-01', endDate: '2024-12-31', outcomeStatus: '已转化应用', status: '已完成', over100M: true, postEvalStatus: 'completed' },
  { id: 'p06', code: 'KY-2024-006', name: '民机噪声控制关键技术研究', goal: '降低舱内噪声3dB', level: '国家级', channelId: 'nsfc', channelName: '国家自然科学基金', org: '北研中心', owner: '马超', phase: '实施', risk: 'blue', budgetTotal: 280, budgetSpent: 120, budgetYear: 100, budgetYearSpent: 45, startDate: '2024-09-01', endDate: '2027-08-31', outcomeStatus: '技术储备待应用', status: '进行中', over100M: false, postEvalStatus: 'pending' },
  { id: 'p07', code: 'KY-2024-007', name: '上海科技创新行动计划-智能装配', goal: '智能装配工艺与装备研发', level: '地方级', channelId: 'shkj', channelName: '上海市科技创新行动计划', org: '上飞公司', owner: '黄磊', phase: '实施', risk: 'yellow', budgetTotal: 500, budgetSpent: 220, budgetYear: 200, budgetYearSpent: 95, startDate: '2024-05-01', endDate: '2026-04-30', outcomeStatus: '接续研发立项', status: '进行中', over100M: false, postEvalStatus: 'pending' },
  { id: 'p08', code: 'KY-2023-020', name: '预研三年滚动-航电系统集成验证', goal: '航电系统集成验证环境建设', level: '公司级', channelId: 'yy3n', channelName: '预研三年滚动计划', org: '试飞中心', owner: '周明', phase: '验收', risk: 'green', budgetTotal: 1800, budgetSpent: 1650, budgetYear: 300, budgetYearSpent: 280, startDate: '2023-01-01', endDate: '2025-06-30', outcomeStatus: '已转化应用', status: '已通过公司级验收', over100M: false, postEvalStatus: 'pending' },
  { id: 'p09', code: 'KY-2024-009', name: '揭榜挂帅-绿色制造技术', goal: '绿色制造工艺攻关', level: '地方级', channelId: 'shjb', channelName: '上海市科技攻关揭榜挂帅', org: '上飞公司', owner: '吴静', phase: '实施', risk: 'blue', budgetTotal: 800, budgetSpent: 350, budgetYear: 300, budgetYearSpent: 150, startDate: '2024-07-01', endDate: '2026-12-31', outcomeStatus: '技术储备待应用', status: '进行中', over100M: false, postEvalStatus: 'pending' },
  { id: 'p10', code: 'KY-2021-003', name: 'FGW高技术产业化示范工程', goal: '产业化示范与应用推广', level: '国家级', channelId: 'fgw', channelName: 'FGW GXJC项目', org: '制造公司', owner: '郑华', phase: '成果转化', risk: 'green', budgetTotal: 15000, budgetSpent: 14200, budgetYear: 0, budgetYearSpent: 0, startDate: '2021-01-01', endDate: '2024-06-30', outcomeStatus: '已转化应用', status: '已完成', over100M: true, postEvalStatus: 'completed' },
  { id: 'p11', code: 'KY-2024-011', name: '先进材料创新联盟-钛合金成形', goal: '钛合金超塑成形工艺研究', level: '公司级', channelId: 'cllm', channelName: '大飞机先进材料创新联盟', org: '材料公司', owner: '林峰', phase: '实施', risk: 'yellow', budgetTotal: 650, budgetSpent: 280, budgetYear: 250, budgetYearSpent: 110, startDate: '2024-04-01', endDate: '2026-03-31', outcomeStatus: '技术储备待应用', status: '进行中', over100M: false, postEvalStatus: 'pending' },
  { id: 'p12', code: 'KY-2024-012', name: '大飞机研究院-气动优化设计', goal: '气动优化设计方法研究', level: '公司级', channelId: 'dyjy', channelName: '大飞机研究院', org: '上飞院', owner: '何磊', phase: '实施', risk: 'blue', budgetTotal: 900, budgetSpent: 400, budgetYear: 350, budgetYearSpent: 180, startDate: '2024-02-01', endDate: '2026-01-31', outcomeStatus: '接续研发立项', status: '进行中', over100M: false, postEvalStatus: 'pending' },
  { id: 'p13', code: 'KY-2025-001', name: '气象创新中心联合研发', goal: '气象数据与飞行安全关联研究', level: '公司级', channelId: 'xjqx', channelName: '新疆大飞机气象创新中心', org: '试飞中心', owner: '周明', phase: '立项', risk: 'green', budgetTotal: 450, budgetSpent: 20, budgetYear: 200, budgetYearSpent: 20, startDate: '2025-02-01', endDate: '2027-01-31', outcomeStatus: '技术储备待应用', status: '进行中', over100M: false, postEvalStatus: 'pending' },
  { id: 'p14', code: 'KY-2023-025', name: '民机供应链数字化协同平台', goal: '供应链数字化协同平台建设', level: '公司级', channelId: 'yy3n', channelName: '预研三年滚动计划', org: '总部科技部', owner: '赵明远', phase: '协作评价', risk: 'green', budgetTotal: 2200, budgetSpent: 2100, budgetYear: 100, budgetYearSpent: 95, startDate: '2023-04-01', endDate: '2025-03-31', outcomeStatus: '已转化应用', status: '已通过公司级验收', over100M: false, postEvalStatus: 'pending' },
];

export async function seedDatabase() {
  const count = await prisma.user.count();
  if (count > 0) {
    console.log('[seed] database already seeded, skip');
    return;
  }

  for (const ch of CHANNELS) {
    await prisma.channel.create({ data: ch });
  }

  for (const u of USERS) {
    await prisma.user.create({
      data: { ...u, password: await bcrypt.hash(u.password, 10) },
    });
  }

  for (const p of PROJECTS) {
    await prisma.project.create({ data: p });
  }

  const partners = [
    { projectId: 'p01', name: '中航工业复材', type: '参研', score: 88, level: '良好', evalStatus: '已评价', postEval: '—' },
    { projectId: 'p01', name: '北航材料学院', type: '外协', score: 92, level: '优秀', evalStatus: '已评价', postEval: '—' },
    { projectId: 'p02', name: '钢研高纳', type: '外协', score: 55, level: '不合格', evalStatus: '已评价', postEval: '—', blacklisted: true },
    { projectId: 'p03', name: '民航二所', type: '参研', score: 90, level: '优秀', evalStatus: '已评价', postEval: '进行中' },
    { projectId: 'p08', name: '上电所', type: '参研', score: 85, level: '良好', evalStatus: '已评价', postEval: '—' },
    { projectId: 'p14', name: 'SAP中国', type: '外协', score: 78, level: '合格', evalStatus: '待评价', postEval: '—' },
  ];
  for (const pt of partners) await prisma.partner.create({ data: pt });

  const outcomes = [
    { projectId: 'p03', code: 'CG-2023-001', name: '适航审定工具软件V1.0', method: '型号应用', form: '软件许可', status: '已转化应用', planDate: '2025-06-01', actualDate: '2025-03-15' },
    { projectId: 'p05', code: 'CG-2022-003', name: '飞控验证平台', method: '内部应用', form: '平台服务', status: '已转化应用', planDate: '2024-12-01', actualDate: '2024-11-20' },
    { projectId: 'p10', code: 'CG-2021-002', name: '产业化示范产线', method: '市场推广', form: '产线移交', status: '已转化应用', planDate: '2024-06-01', actualDate: '2024-05-28' },
    { projectId: 'p01', code: 'CG-2024-008', name: '复合材料工艺规范', method: '技术储备', form: '标准规范', status: '技术储备待应用', planDate: '2026-12-01' },
    { projectId: 'p07', code: 'CG-2024-005', name: '智能装配工艺包', method: '型号应用', form: '工艺文件', status: '接续研发立项', planDate: '2026-06-01' },
  ];
  for (const o of outcomes) await prisma.outcome.create({ data: o });

  const milestones = [
    { projectId: 'p01', year: 2025, title: '完成机翼段试制', dueDate: '2025-08-30', status: '进行中', risk: 'yellow' },
    { projectId: 'p02', year: 2025, title: '寿命模型验证', dueDate: '2025-06-15', status: '已超期', risk: 'red' },
    { projectId: 'p08', year: 2025, title: '系统集成测试', dueDate: '2025-05-31', status: '已完成', risk: 'green' },
  ];
  for (const m of milestones) await prisma.milestone.create({ data: m });

  const todos = [
    { title: '审批：宽体客机复合材料立项变更', type: 'approval', projectId: 'p01', roles: 'dept,pm,hq', orgs: '试飞中心', status: 'pending' },
    { title: '协作单位评价：供应链数字化平台', type: 'partner_eval', projectId: 'p14', roles: 'dept,pm', orgs: '总部科技部', status: 'pending' },
    { title: '验收材料审核：航电系统集成验证', type: 'acceptance', projectId: 'p08', roles: 'pm,hq', status: 'pending' },
    { title: '后评价启动：飞控系统综合验证平台', type: 'post_eval', projectId: 'p05', roles: 'hq,leader', status: 'pending' },
    { title: '里程碑佐证上传：噪声控制研究', type: 'milestone', projectId: 'p06', roles: 'owner,member', orgs: '北研中心', status: 'pending' },
  ];
  for (const t of todos) await prisma.todo.create({ data: t });

  console.log('[seed] completed');
}

import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedDatabase().finally(() => prisma.$disconnect());
}
