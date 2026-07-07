# 科研项目管理平台 · 会话与记忆打包

发给同事的上下文包，内容：

| 文件 | 说明 |
|---|---|
| session-readable.md | 本次 Claude 会话的可读版对话记录（推荐先读这个） |
| session-transcript.jsonl | 会话原始记录（含全部工具调用输入输出、截图 base64），可导入 Claude Code 继续 |
| memory/MEMORY.md | Claude 记忆索引 |
| memory/keyan-platform-presales.md | 项目记忆正文：文件位置、方案定位、需求关键口径与已知矛盾、demo 各功能的实现要点与改动注意事项（**接手前必读**） |

## 项目材料位置

所有交付物在 `c:\Users\wangz\Desktop\管理\`：需求原文 extracted.txt、交互 Demo（科研项目管理平台Demo.html）、客户展示页（科研项目管理平台客户展示.html）、Demo 演示方案 / 开发方案 / 需求深化价值说明（客户版）/ 本体架构深度研究报告 等。

## 接手注意（来自 memory）

1. Demo 主脚本被多轮修改过，**禁止整体覆盖 script 块**，改动必须用"逐处校验唯一性"的补丁式替换（PowerShell 补丁脚本需 UTF-8 BOM，否则中文路径乱码）。
2. 需求文档内部矛盾：协作评价等级四档 vs 三档，已列为蓝图澄清项。
3. 后评价口径：仅超 1 亿项目、最终验收后 3 年内。
4. 经费两套体系独立，看板只做"汇总观察口径"。