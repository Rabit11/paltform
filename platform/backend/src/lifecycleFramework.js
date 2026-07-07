/** 需求 V18 · 三、全生命周期整体架构与总流程 ·（一）整体功能架构 */
export const LIFECYCLE_FRAMEWORK = {
  title: '全生命周期整体架构与总流程',
  subtitle: '整体功能架构',
  classification: {
    label: '科研项目分类',
    levels: ['国家级', '地方级', '公司级'],
    note: '立项后层级原则上不允许变更；新增/终止渠道需责任单位申请、总部审批',
  },
  hub: {
    label: '平台五大核心业务模块',
    modules: ['项目总览', '立项阶段', '实施阶段', '验收阶段', '成果转化'],
  },
  stages: [
    {
      id: 'overview',
      name: '项目总览',
      icon: 'overview',
      summary: '系统自动归集台账 + 总部专属可视化看板',
      items: [
        { title: '项目台账', desc: '立项、实施、验收全流程自动归集，无需二级单位手工填报', route: '/ledger' },
        { title: '可视化看板', desc: '总部专属，依托全平台归集数据自动生成，支撑总部决策分析', route: '/board', roles: ['mgmt_hq'] },
      ],
    },
    {
      id: 'initiation',
      name: '立项阶段',
      icon: 'initiation',
      summary: '按项目类型差异化配置附件 → 二级单位内部立项审批 → 对接总部线上审签 → 立项完成 → 上传材料',
      items: [
        { title: '项目申报', desc: '按渠道差异化材料清单，线上审签单审批流转', route: '/apply' },
        { title: '项目立项', desc: '审批完成后上传任务书、立项批复等佐证材料，提交总部备案归档' },
        { title: '渠道流程', desc: '13 个渠道各差异化全周期管理流程', route: '/channels' },
      ],
    },
    {
      id: 'implementation',
      name: '实施阶段',
      icon: 'implementation',
      summary: '基础信息完善 · 里程碑 · 计划 · 经费 四大子模块',
      items: [
        { title: '项目基础信息完善', desc: '自动回显立项数据，缺失字段由二级单位补充，实现动态信息汇总建档' },
        { title: '里程碑管理', desc: '年初抓取各单位综合计划 + 实时同步完成状态 + 超期四色预警 + 延期走项目变更审批' },
        { title: '计划管理', desc: '自动抓取 CMOS 系统计划 + 四色状态提醒 + 完成后审批销项', route: '/risks' },
        { title: '项目经费', desc: '实时抓取各单位经费管理平台数据；里程碑闭环销项后才可预算核销（两套体系独立）', route: '/ledger' },
      ],
    },
    {
      id: 'acceptance',
      name: '验收阶段',
      icon: 'acceptance',
      summary: '分级差异化验收 + 成果归档 + 协作单位评价',
      items: [
        { title: '分级项目验收', desc: '按项目层级自动匹配验收表单（国家级/地方级/公司级差异化验收栏）' },
        { title: '交付物', desc: '专利、软著、样机、设备等成果入库归档，与成果包双向绑定' },
        { title: '协作单位评价', desc: '验收/外协合同完成后 30 日内完成；不合格单位纳入黑名单', route: '/partners' },
      ],
    },
    {
      id: 'transformation',
      name: '成果转化',
      icon: 'transformation',
      summary: '持续进展维护，数据自动同步至项目台账与可视化看板',
      items: [
        { title: '成果转化台账', desc: '单项/打包转化，统一归集转化路径、进展、成效', route: '/outcomes' },
      ],
    },
  ],
  postEvaluation: {
    name: '后评价阶段',
    trigger: '项目终审完成后 3 年内启动；仅超 1 亿项目适用后评价',
    summary: '全生命周期收尾环节，评价结果归集至台账与看板',
    steps: [
      '填报后评价资料',
      '二级总师技术把关',
      '二级单位部门初审',
      '单位分管领导审批',
      '数据同步至项目台账与可视化看板',
    ],
  },
  closedLoop: '全流程业务数据同步汇总至可视化看板，项目资料统一线上归档，实现全生命周期闭环管理',
};
