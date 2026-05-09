# Lynx 本地控制台 Bug 修复详细方案

## 1. 背景

问题来源：`D:\all-sunday\openclaw-lynx\.lynx0\58\bug.md`

目标仓库：`C:\Users\24716\.openclaw\extensions\openclaw-lynx-guardian`

这份方案把 bug 清单整理为可执行的产品和工程设计。重点不是单纯调样式，而是把本地控制台从“数据库字段展示”修到“可读、可判断、可追踪的安全运营界面”。

## 2. 总体目标

用户打开控制台后，应该能快速回答这些问题：

- 用户原始输入是什么？
- Agent 实际执行了什么工具、命令或操作？
- 当前记录为什么被允许、告警、审批、放行、阻断或记录？
- 相关审批、放行、链路、会话和检测报告之间是什么关系？
- 页面上的状态颜色、动作标签、风险等级是否和语义一致？
- 详情页是否能先看人能理解的信息，再看原始 JSON？

## 3. 范围

本次修复涉及：

- `frontend/src/app/`
- `frontend/src/api/`
- `frontend/src/components/`
- `frontend/src/hooks/`
- `frontend/src/pages/`
- `frontend/src/styles/`
- `frontend/test/`
- `shared/src/query-dto.ts`
- `backend/internal/routes/`
- `backend/internal/repo/`
- `backend/test/`
- 仅当显示字段源头缺失时，才触碰 `src/console/` 下的采集或构造逻辑

不在本次范围内：

- 修改 `D:\all-works\openclaw`
- 删除高级页面
- 用假数据补全历史记录
- 为没有明确缺陷的 Token 统计和 Skill 供应链页面强行新增功能
- 只凭本地源码修改就宣称 Docker/OpenClaw 运行时已经生效

## 4. 设计原则

### 4.1 原始用户输入优先

页面中的“输入词”“用户输入”只能展示用户真实输入。插件、OpenClaw、系统提示、策略说明、开发者提示、隐藏 guard 文本不能混入用户输入字段。

展示优先级：

1. 使用明确的 `userPromptExcerpt`。
2. 再尝试 `detailJson.userPromptExcerpt` 或 `payloadJson.userPromptExcerpt`。
3. 如果历史记录没有保存用户原文，显示“历史记录未保存用户原始输入”。
4. 不从完整 prompt 上下文里盲目截取用户文本，除非该格式已经被证明并有测试覆盖。

### 4.2 详情入口显式化

问答记录这类密集表格不应该点击整行就弹出抽屉。需要增加“详情”列，由明确按钮打开详情。会话、检测报告这类左右分栏页面可以继续使用行选择，但选中态必须明显。

### 4.3 判断依据前置

审计日志、决策观测、工具调用、放行记录不能只展示状态和原始 JSON。详情里必须先给人可读的判断依据，再把原始数据放在高级区域。

### 4.4 状态颜色必须符合语义

允许、记录、允许并记录、有效、成功、完成应为成功色；告警、需要审批、降级、脱敏应为警告或信息色；拒绝、阻断、失败、撤销、硬拒绝应为危险色。

### 4.5 长 ID 和长文本要可读

表格中展示短 ID，悬浮或详情中显示完整 ID。长理由、范围、命令、路径、JSON 必须换行或使用 tooltip，不能挤出容器。

### 4.6 页面结构先于装饰

本次修复应先解决信息架构：列如何拆、详情如何分区、证据如何解释、分页如何做。颜色和间距只服务于这些结构，不做无关大改版。

## 5. 全局能力设计

### 5.1 全局 Loading

现状：页面局部有 loading，但路由切换和多接口请求时，外层应用看起来没有响应。

设计：

- 新增全局 loading store。
- `fetchJson` 开始请求时增加 pending 计数，`finally` 中减少计数。
- App shell 顶部展示轻量全局加载条或 busy 状态。
- 保留各表格自己的 skeleton 或局部 loading。
- 普通后台刷新不使用全屏遮罩。

建议文件：

- `frontend/src/app/loading-store.ts`
- `frontend/src/app/GlobalLoadingProvider.tsx`
- `frontend/src/components/feedback/GlobalLoadingIndicator.tsx`
- `frontend/src/api/client.ts`
- `frontend/src/app/App.tsx`

验收：

- 任意页面发起 API 请求时，全局 loading 可见。
- 并发多个请求时，只有全部结束后 loading 才消失。
- 请求失败也能正确关闭 loading。

### 5.2 多选筛选

需要支持多选的筛选项：

- 状态
- 事件类型
- 裁决阶段
- 执行动作
- 触发方式
- 风险等级

设计：

- 前端使用 Ant Design `Select mode="multiple"`。
- 空数组不发送 query。
- 多值 query 使用重复 key：`riskLevel=L2&riskLevel=L4`。
- 后端同时兼容逗号格式：`riskLevel=L2,L4`。
- 列表接口和统计接口使用同一组筛选条件。

已有基础：

- `frontend/src/api/client.ts` 已支持数组 query。
- `backend/internal/httpserver/queryparams.go` 已有 `ReadStringSlice`。
- `backend/internal/repo/queryutils.go` 已有 `AppendIn` 和 `AppendRiskLevelIn`。

### 5.3 CSS 拆分

现状：`frontend/src/styles/theme.css` 混合了全局 token、shell、组件、页面私有样式，后续维护风险高。

设计：

- `tokens.css`：颜色、间距、阴影、字体等基础 token。
- `reset.css`：浏览器 reset 和基础元素。
- `shell.css`：侧边栏、顶部栏、主布局。
- `components.css`：按钮、状态标签、表格、过滤栏、弹框、抽屉、通用详情区。
- `pages-qa.css`：问答记录和问答链路样式。
- `pages-audit.css`：审计日志、工具调用、审批、决策、放行。
- `pages-policies.css`：策略配置。
- `pages-reports.css`：检测报告。
- `pages-assets.css`：会话、Token、Skill。

原则：

- 拆 CSS 时不顺手重写视觉。
- 先有测试或截图对比，再大面积移动选择器。
- 页面私有 class 不继续堆到 `theme.css`。

### 5.4 通用详情组件

建议沉淀：

- `DetailSection`：详情分区。
- `DetailFieldGrid`：标签和值的网格。
- `EvidenceList`：判断依据和证据列表。
- `CodeBlockPanel`：JSON、命令输出、报告正文。
- `IdText`：短 ID、完整 ID tooltip、复制入口。

详情结构统一为：

1. 概览：状态、风险、动作、关联对象。
2. 人能读懂的解释：判断依据、处理理由、执行摘要。
3. 关联链路：问答、会话、审批、放行、工具调用。
4. 证据：命中规则、评分、模块、原始事件。
5. 高级数据：原始 JSON 或调试字段。

## 6. 页面级修复方案

### 6.1 概览

问题：

- 缺少全局 loading。
- 总量卡片顺序和其他页面不一致。

方案：

- 接入全局 loading。
- 保持概览卡片一眼可扫，必要时把总量类卡片放在右侧或末尾，和审计日志保持一致。

验收：

- 页面切换和刷新时有全局加载反馈。
- 统计卡片语义清楚，不重复显示“当前筛选范围”。

### 6.2 问答记录

问题：

- 工具次数、审批要求、安全信号说明不清。
- 每个数字下面重复“当前筛选范围”，显得拥挤。
- 需要新增“详情”列，而不是点击整行打开抽屉。
- 问答详情中“最终答复”一直显示“正在加载”。
- 输入词可能混入插件或 OpenClaw 装饰提示词。

方案：

- 修改指标说明：
  - 问答总数：符合筛选条件的问答。
  - 工具调用：关联工具调用次数。
  - 审批请求：触发人工审批的次数。
  - 安全信号：输入、工具、输出检查命中的事件。
- 删除每张卡片下重复的“当前筛选范围”。
- 表格新增 sticky 的“详情”列，按钮打开抽屉。
- 行点击只负责选中或无动作，不触发抽屉。
- 最终答复展示优先级：
  1. detail 的 `finalAnswerExcerpt`。
  2. list item 的 `finalAnswerExcerpt`。
  3. 已完成但没有保存答复时显示“历史记录未保存最终答复”。
  4. 详情加载失败时显示“详情加载失败”。
- 用户输入统一走用户原文解析器。

验收：

- 点击行不会弹抽屉。
- 点击“详情”按钮才打开抽屉。
- 最终答复不再永久显示“正在加载”。
- 页面不展示隐藏提示词。

### 6.3 审计日志

问题：

- “总安全事件”应和概览一样放到最右边。
- 某些列信息挤在一起，不容易理解。
- 策略显示允许时，处置动作却使用红色标签。
- 缺少判断依据。

方案：

- 调整统计卡片顺序，把总量类卡片放右侧。
- 拆分拥挤列，把对象、动作、记录 ID、风险信息分开。
- 统一动作和策略标签的颜色映射。
- 详情增加“判断依据”区：
  - 命中规则
  - 命中模块
  - 风险等级
  - 评分明细
  - 关键证据
  - 原始审计事件摘要

验收：

- allow 或 log-only 显示绿色或成功色。
- deny 或 block 显示危险色。
- 详情里能看到“为什么这样判断”。

### 6.4 工具调用

问题：

- 大量工具调用没有结果摘要。
- 列表没有展示具体执行命令或操作。
- 详情文本贴边、超框。

方案：

- 表格增加“命令/操作”列。
- 从以下字段推导操作展示：
  1. `metadataJson.command`
  2. `metadataJson.args`
  3. `paramSummary`
  4. `resultExcerpt`
  5. 缺失时显示“历史记录未保存具体命令”
- 详情分区展示：
  - 工具
  - 具体操作
  - 命令
  - 工作目录
  - 参数
  - 结果状态
  - 结果摘要
  - 错误信息
  - 原始数据
- 抽屉和弹框 body 增加统一左右 padding。

验收：

- 有命令数据的工具调用能直接在列表看到命令。
- 无历史命令数据时，不伪造命令。
- 长文本不会贴边或溢出。

### 6.5 多轮链路

问题：

- 多轮链路之间的关系不明确。
- 输入词可能展示插件或 OpenClaw 增加的提示词。
- 详情杂乱，没有逻辑。
- 渠道不应手输，应下拉选择。
- 链路、会话、覆盖输入词挤在同一列。

方案：

- 表格列拆为：
  - 链路
  - 会话
  - 关联问答
  - 最近风险线索
  - 人工动作
  - 详情
- 详情中增加“关联关系”时间线：
  - 同一会话
  - 覆盖问答
  - 审批或放行
  - 最近拒绝
  - 污点或敏感目标
  - 关联工具调用
- 输入词统一走用户原文解析器。
- 渠道筛选使用下拉框：
  - 优先使用后端元数据接口。
  - 如果暂时没有元数据接口，从当前页数据和已知渠道中生成选项。

验收：

- 表格不再把链路、会话、覆盖输入词堆到一个单元格。
- 详情能说明“这些对话为什么属于同一链路”。
- 渠道筛选不是自由文本输入。

### 6.6 审批管理

问题：

- ID 太长，影响阅读。

方案：

- 表格使用短 ID，例如前 8 位加后 4 位。
- tooltip 或详情展示完整 ID。
- 详情中 ID 自动换行，不撑破布局。

验收：

- 列表可读。
- 完整 ID 仍然可查。

### 6.7 决策观测

问题：

- 决策理由过长，需要 tooltip。
- 评分和证据里英文太多，不适合直接给用户看。

方案：

- 长决策理由使用 tooltip 和文本省略。
- 详情中把评分和证据本地化为中文标签：
  - 评分明细
  - 证据
  - 规则
  - 来源
  - 状态
  - 权重
- 原始英文 key 可以留在高级原始数据区，但不作为主要展示。

验收：

- 表格不会被长理由撑乱。
- 用户不需要看英文 JSON key 才能理解判断。

### 6.8 放行记录

问题：

- 详情缺少类似问答记录中的执行链路。
- 范围内容不清楚，并且会溢出。
- 放行 ID 难以理解。

方案：

- 表格使用短 grant ID 和短 approval ID。
- 详情分区：
  - 放行概览
  - 授权上下文
  - 关联执行链路
  - 放行范围
  - 撤销或过期信息
  - 原始数据
- scope 不再渲染成一条长字符串，而是拆为标签字段：
  - 路径
  - 工具
  - 会话
  - 风险级别
  - 有效期

验收：

- 范围不溢出。
- 放行记录能看出它和哪次问答、审批或工具调用有关。

### 6.9 策略配置

问题：

- 黑白名单列表太小，正常数据需要左右滑。
- 受保护目录、黑名单、白名单接口都需要分页。
- 页面布局需要重设，或拆分为更清楚的视图。
- 弹框按钮放在左边不协调。

方案：

- 保留 `/policies` 作为概览接口，返回版本和计数。
- 新增分页接口：
  - `GET /protected-resources?pageNum=1&pageSize=20&q=&enabled=`
  - `GET /policy-rules?kind=blacklist&pageNum=1&pageSize=20&q=&scope=&patternType=&enabled=`
  - `GET /policy-rules?kind=allowlist&pageNum=1&pageSize=20&q=&scope=&patternType=&enabled=`
- 返回统一分页结构：

```ts
{
  items: T[];
  total: number;
  pageNum: number;
  pageSize: number;
  totalPages: number;
}
```

- 页面布局：
  - 顶部概览卡片。
  - 中部使用 tabs 或 segmented control 切换“目录防护”“黑名单”“白名单”。
  - 每次只展示一个 full-width 表格。
  - 表格自带分页。
  - 弹框按钮居中或靠右。

验收：

- 三类列表都有后端分页。
- 普通数据行不需要频繁横向滚动。
- 页面不再同时挤三个小表格。

### 6.10 检测报告

问题：

- 详情上下内容不搭，容易误以为所有内容都属于同一个检测报告正文。

方案：

- 保持左侧报告列表、右侧详情区。
- 右侧分区：
  - 报告元信息
  - 投递状态
  - 报告正文
  - 文件和路径索引
- Markdown 正文独立展示，不和元信息混成一个块。

验收：

- 用户能明确区分报告正文和报告元数据。
- 报告正文不被截断。

### 6.11 会话

问题：

- 点击会话行后右侧详情变化不明显。
- 右侧详细信息不完整。

方案：

- 保留现有左右分栏布局。
- 选中行样式更明显。
- 右侧标题随选中会话明显变化。
- 详情补充：
  - 会话 key
  - 渠道和渠道 ID
  - 请求人
  - 是否群聊
  - 事件数
  - 最近工具调用
  - 最近审批
  - 最近安全事件
  - token 摘要
- 可参考 OpenClaw 会话信息密度，但不照搬布局。

验收：

- 点击不同会话时，右侧变化清楚可见。
- 缺失数据以“暂无”展示，不留空。

### 6.12 Token 统计和 Skill 供应链

问题：

- bug 清单只留下标题，没有具体缺陷。

方案：

- 作为残留审计目标处理，不新增猜测功能。
- 确认是否继承：
  - 全局 loading
  - ID/哈希换行或 tooltip
  - 表格 padding
  - 页面私有 CSS 拆分
  - 无虚假导出按钮

验收：

- 如果没有发现具体缺陷，不做功能变更。
- 如果共享修复暴露出溢出或样式问题，按具体问题修。

## 7. 数据和接口设计

### 7.1 多选筛选接口

前端 query：

```text
riskLevel=L2&riskLevel=L4
status=completed&status=failed
```

后端兼容：

```text
riskLevel=L2,L4
status=completed,failed
```

建议覆盖接口：

- `/qa-records`：`status[]`、`riskLevel[]`
- `/security-events`：`eventKind[]`、`riskLevel[]`、`enforcementAction[]`
- `/decisions`：`stage[]`、`action[]`、`riskLevel[]`
- `/tool-calls`：`resultStatus[]`、`riskLevel[]`、`enforcementAction[]`
- `/lynx-checks`：`status[]`、`trigger[]`
- `/approvals`：`resolution[]`、`riskLevel[]`

### 7.2 工具操作展示字段

前端可先派生：

```ts
interface ToolOperationDisplay {
  operationLabel: string;
  command?: string;
  cwd?: string;
  args?: string[];
  resultSummary?: string;
  hasStoredCommandDetail: boolean;
}
```

如果后端没有返回已保存的命令元数据，再补充后端 DTO 或采集逻辑。

### 7.3 判断依据字段

展示优先级：

1. `detailJson.judgmentBasis`
2. `matchedRules`
3. `matchedModules`
4. `scoreBreakdown`
5. `evidence`
6. 原始审计事件摘要

如果逻辑变复杂，再把前端派生逻辑下沉为后端稳定字段。

## 8. 验证策略

前端局部测试：

```powershell
cd frontend
npx.cmd vitest run --no-color --reporter verbose test/pages/QaRecordsPage.test.tsx
npx.cmd vitest run --no-color --reporter verbose test/pages/EventsPage.test.tsx
npx.cmd vitest run --no-color --reporter verbose test/pages/ToolCallsPage.test.tsx
npx.cmd vitest run --no-color --reporter verbose test/pages/PoliciesPage.test.tsx
```

后端测试：

```powershell
cd backend
go test ./...
```

类型和构建：

```powershell
cd frontend
npx.cmd tsc --noEmit --pretty false
npm.cmd run build -- --clearScreen false

cd ..
npm --prefix shared run build
npx.cmd tsc --noEmit
```

最终 diff 和编码：

```powershell
git diff --check
[Console]::OutputEncoding=[System.Text.Encoding]::UTF8
$mojibakePattern = [string]::Join('|', @([char]0x00C3, [char]0xFFFD, [char]0x951F, [char]0x9225, [char]0x95BF))
Select-String -Path frontend/src/**/*.tsx,frontend/src/**/*.ts,frontend/src/styles/*.css,backend/**/*.go,shared/src/*.ts -Pattern $mojibakePattern -ErrorAction SilentlyContinue
```

运行时同步和证明：

```powershell
node scripts/verify-dev-sync.mjs
.\scripts\sync-openclaw-dev-ready.ps1 --logs 200
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:18789/healthz
docker exec openclaw-openclaw-gateway-1 sh -lc "openclaw agent --agent main --message 'test message' --json --timeout 90 2>&1"
```

如果 real agent 路径被 pairing 阻断，需要记录准确错误，并用 gateway/webview/API 路径作为部分运行时证明。

## 9. 推荐交付顺序

1. 共享基础：全局 loading、短 ID、详情 padding、状态颜色、多选基础组件。
2. 筛选契约：前后端多选筛选一致。
3. 问答记录：详情列、最终答复 fallback、指标说明、用户原文展示。
4. 审计日志和工具调用：判断依据、命令/操作展示、结果摘要。
5. 多轮链路、审批、决策、放行：关系、证据、范围、ID 可读性。
6. 策略配置：分页接口和页面布局重设。
7. 检测报告和会话：右侧详情信息架构修正。
8. CSS 拆分和 Token/Skill 残留审计。
9. 全量本地验证、同步到 OpenClaw 运行时、真实路径验证。

## 10. 风险控制

- 不在一次 patch 中同时做 CSS 大拆分和所有页面重构，除非已有足够测试覆盖。
- 不改变硬拒绝、审批、放行等安全语义。
- 不把隐藏 prompt 当作用户输入展示。
- 不为旧记录伪造不存在的命令或结果摘要。
- 不只看截图验收，必须结合测试、API payload、运行时同步结果。
- 代码落地建议放在独立 worktree，完成后再由用户确认是否合回主工作区。
