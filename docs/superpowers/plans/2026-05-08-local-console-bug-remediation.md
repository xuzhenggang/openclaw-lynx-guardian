# Lynx 本地控制台 Bug 修复实施计划

> 执行依据：`docs/superpowers/specs/2026-05-08-local-console-bug-remediation-design.md`

## 0. 执行规则

- 代码改动只放在 `C:\Users\24716\.openclaw\extensions\openclaw-lynx-guardian`。
- 优先 TDD：先写或补测试，再改实现。
- `index.ts` 继续保持入口和 hook 编排职责，除非确实需要生命周期接线，否则不改。
- 保留现有高级页面，不删除页面来规避问题。
- 中文文案、测试名、文档必须保持 UTF-8 可读。
- 本地代码通过测试不等于运行时已生效；插件改动必须经过同步和真实 OpenClaw/webview 路径验证。

建议先创建独立 worktree：

```powershell
git worktree add .worktrees/local-console-bug-remediation -b codex/local-console-bug-remediation
cd .worktrees/local-console-bug-remediation
```

## 1. 基线确认

- [ ] 查看当前 dirty tree。

```powershell
git status --short
```

- [ ] 用 UTF-8 读取 bug 清单，确认问题原文可读。

```powershell
[Console]::OutputEncoding=[System.Text.Encoding]::UTF8
$bytes=[System.IO.File]::ReadAllBytes('D:\all-sunday\openclaw-lynx\.lynx0\58\bug.md')
[System.Text.Encoding]::UTF8.GetString($bytes)
```

- [ ] 快速定位当前页面和 API 文件。

```powershell
rg -n "userPromptExcerpt|finalAnswerExcerpt|riskLevel|resultStatus|policy|grant|approval|tool" frontend/src backend/internal shared/src src/console
```

## 2. 第一阶段：共享基础

目标：先解决会影响所有页面的基础设施，避免后面每个页面重复补丁。

涉及文件：

- `frontend/src/app/loading-store.ts`
- `frontend/src/app/GlobalLoadingProvider.tsx`
- `frontend/src/components/feedback/GlobalLoadingIndicator.tsx`
- `frontend/src/api/client.ts`
- `frontend/src/app/App.tsx`
- `frontend/src/components/feedback/ModalDialog.tsx`
- `frontend/src/components/feedback/SideDrawer.tsx`
- `frontend/src/components/tables/DataTable.tsx`
- `frontend/src/utils/format.ts`
- `frontend/src/utils/status.tsx`

步骤：

- [ ] 为全局 loading 写失败测试，覆盖单请求、并发请求、失败请求。
- [ ] 实现 loading store 和 provider。
- [ ] 在 `fetchJson` 中接入 pending 计数。
- [ ] 在 App shell 中加入全局加载条或 busy 状态。
- [ ] 为 `formatCompactId` 写测试。
- [ ] 实现短 ID 展示工具。
- [ ] 修正弹框、抽屉、表格长文本的通用 padding 和换行。
- [ ] 统一状态和动作颜色映射。

验证：

```powershell
cd frontend
npx.cmd vitest run --no-color --reporter verbose test/app/global-loading.test.tsx test/utils/format.test.ts test/utils/status.test.tsx
```

完成标准：

- 并发请求 loading 计数准确。
- allow/log-only 是成功色。
- deny/block/failed 是危险色。
- 长 ID 和长文本不撑破基础组件。

## 3. 第二阶段：多选筛选契约

目标：状态、事件类型、裁决阶段、执行动作、触发方式、风险等级支持多选，并且前后端语义一致。

涉及文件：

- `shared/src/query-dto.ts`
- `frontend/src/api/qa-records.ts`
- `frontend/src/api/security-events.ts`
- `frontend/src/api/decisions.ts`
- `frontend/src/api/tool-calls.ts`
- `frontend/src/api/lynx-checks.ts`
- `frontend/src/pages/QaRecordsPage.tsx`
- `frontend/src/pages/EventsPage.tsx`
- `frontend/src/pages/DecisionsPage.tsx`
- `frontend/src/pages/ToolCallsPage.tsx`
- `frontend/src/pages/LynxChecksPage.tsx`
- `backend/internal/routes/*`
- `backend/internal/repo/*`

步骤：

- [ ] 为 QA、审计、决策、工具调用、检测报告页面写多选筛选测试。
- [ ] 测试前端 query 发送重复 key，例如 `riskLevel=L2&riskLevel=L4`。
- [ ] 为后端路由写测试，覆盖重复 key 和逗号格式。
- [ ] 将 enum 类筛选状态从 `string` 改为 `string[]`。
- [ ] Ant Design Select 改为 `mode="multiple"`，并设置 `maxTagCount="responsive"`。
- [ ] 后端读取统一使用 `ReadStringSlice`。
- [ ] repo 查询统一使用 `AppendIn` 或 `AppendRiskLevelIn`。
- [ ] 列表和 summary 接口使用同样筛选条件。

验证：

```powershell
cd frontend
npx.cmd vitest run --no-color --reporter verbose test/pages/QaRecordsPage.test.tsx test/pages/EventsPage.test.tsx test/pages/DecisionsPage.test.tsx test/pages/ToolCallsPage.test.tsx test/pages/LynxChecksPage.test.tsx

cd ..\backend
go test ./...
```

完成标准：

- 多选筛选可组合。
- 清空筛选后不会发送空字符串。
- 后端返回结果符合任一选中值，而不是只匹配一个值。

## 4. 第三阶段：用户原文展示

目标：所有“输入词”“用户输入”只展示用户原话，不展示插件或 OpenClaw 注入内容。

涉及文件：

- `frontend/src/utils/prompts.ts`
- `frontend/src/pages/QaRecordsPage.tsx`
- `frontend/src/pages/ChainsPage.tsx`
- `frontend/src/pages/EventsPage.tsx`
- 必要时：`backend/internal/repo/qa_records.go`
- 必要时：`src/console/event-builder.ts`

步骤：

- [ ] 追踪当前 `userPromptExcerpt`、`promptExcerpt`、`contentExcerpt` 来源。
- [ ] 写 `resolveUserVisiblePrompt` 测试。
- [ ] 实现用户原文解析器。
- [ ] QA 列表和详情接入解析器。
- [ ] 多轮链路覆盖输入词接入解析器。
- [ ] 审计日志中用户输入类对象接入解析器。
- [ ] 如果后端已经把装饰 prompt 当成 `userPromptExcerpt` 返回，则修正后端映射或采集源头。

验证：

```powershell
cd frontend
npx.cmd vitest run --no-color --reporter verbose test/utils/prompts.test.ts test/pages/QaRecordsPage.test.tsx test/pages/ChainsPage.test.tsx test/pages/EventsPage.test.tsx
```

完成标准：

- 页面不会把系统、开发者、插件策略、OpenClaw guard 文本展示成用户输入。
- 历史数据缺少用户原文时，明确显示“历史记录未保存用户原始输入”。

## 5. 第四阶段：问答记录

目标：解决问答记录的指标解释、详情入口、最终答复和用户输入问题。

涉及文件：

- `frontend/src/pages/QaRecordsPage.tsx`
- `frontend/src/styles/pages-qa.css` 或当前临时样式位置
- `frontend/test/pages/QaRecordsPage.test.tsx`

步骤：

- [ ] 写测试：表格存在“详情”列。
- [ ] 写测试：点击行不会打开抽屉。
- [ ] 写测试：点击详情按钮打开抽屉。
- [ ] 写测试：最终答复 fallback 正确。
- [ ] 调整指标卡片说明。
- [ ] 删除重复的“当前筛选范围”说明。
- [ ] 添加 sticky 详情列。
- [ ] 移除行点击打开抽屉逻辑。
- [ ] 修正最终答复加载和缺失状态。

验证：

```powershell
cd frontend
npx.cmd vitest run --no-color --reporter verbose test/pages/QaRecordsPage.test.tsx
```

完成标准：

- “详情”列是唯一抽屉入口。
- 最终答复不再长期显示“正在加载”。
- 指标文案清楚，不拥挤。

## 6. 第五阶段：审计日志和决策观测

目标：让审计和决策页面说明“为什么这样判定”，并修正颜色语义和长文本。

涉及文件：

- `frontend/src/pages/EventsPage.tsx`
- `frontend/src/pages/DecisionsPage.tsx`
- `frontend/src/utils/status.tsx`
- `frontend/src/components/detail/*`
- `frontend/test/pages/EventsPage.test.tsx`
- `frontend/test/pages/DecisionsPage.test.tsx`

步骤：

- [ ] 写状态颜色测试。
- [ ] 写审计日志测试：总安全事件卡片在右侧。
- [ ] 写审计日志测试：拥挤列被拆分。
- [ ] 写审计日志测试：详情包含“判断依据”。
- [ ] 写决策观测测试：长理由有 tooltip 或省略处理。
- [ ] 写决策观测测试：评分和证据用中文标签展示。
- [ ] 实现判断依据派生逻辑。
- [ ] 详情中把原始 JSON 放到高级区域。

验证：

```powershell
cd frontend
npx.cmd vitest run --no-color --reporter verbose test/utils/status.test.tsx test/pages/EventsPage.test.tsx test/pages/DecisionsPage.test.tsx
```

完成标准：

- 允许不再显示成红色。
- 审计和决策详情都能看到可读判断依据。
- 长决策理由不破坏表格。

## 7. 第六阶段：工具调用

目标：列表展示具体命令或操作，详情展示执行上下文。

涉及文件：

- `frontend/src/pages/ToolCallsPage.tsx`
- `frontend/src/utils/tool-display.ts`
- 必要时：`backend/internal/repo/toolcalls.go`
- `frontend/test/pages/ToolCallsPage.test.tsx`
- `frontend/test/utils/tool-display.test.ts`

步骤：

- [ ] 写工具操作解析测试。
- [ ] 写页面测试：表格包含“命令/操作”列。
- [ ] 写页面测试：详情包含命令、工作目录、参数、结果摘要、错误信息。
- [ ] 实现 `resolveToolOperation`。
- [ ] 页面接入命令/操作列。
- [ ] 如果后端隐藏了已存命令元数据，补充返回字段。
- [ ] 修复详情 padding 和长文本换行。

验证：

```powershell
cd frontend
npx.cmd vitest run --no-color --reporter verbose test/utils/tool-display.test.ts test/pages/ToolCallsPage.test.tsx

cd ..\backend
go test ./...
```

完成标准：

- 有命令数据的工具调用在列表可见。
- 缺少历史命令时显示明确缺失提示，不伪造。

## 8. 第七阶段：多轮链路

目标：把链路、会话、覆盖输入词和关联关系拆开，让用户看懂多轮链路为什么相关。

涉及文件：

- `frontend/src/pages/ChainsPage.tsx`
- `frontend/src/utils/chains.ts`
- 必要时：`frontend/src/api/chains.ts`
- 必要时：`backend/internal/repo/chains.go`
- `frontend/test/pages/ChainsPage.test.tsx`

步骤：

- [ ] 写测试：表格列包含“链路、会话、关联问答、风险线索、人工动作、详情”。
- [ ] 写测试：渠道筛选是下拉框。
- [ ] 写测试：详情包含“关联关系”时间线。
- [ ] 拆分链路表格列。
- [ ] 用户输入展示接入第三阶段解析器。
- [ ] 实现渠道选项来源。
- [ ] 详情增加关系依据和覆盖问答时间线。

验证：

```powershell
cd frontend
npx.cmd vitest run --no-color --reporter verbose test/pages/ChainsPage.test.tsx
```

完成标准：

- 不再把链路、会话、覆盖输入词挤在一个单元格。
- 详情能看懂关联原因。

## 9. 第八阶段：审批、决策、放行可读性

目标：短 ID、tooltip、放行范围和执行链路清楚可读。

涉及文件：

- `frontend/src/pages/ApprovalsPage.tsx`
- `frontend/src/pages/DecisionsPage.tsx`
- `frontend/src/pages/GrantsPage.tsx`
- `frontend/src/utils/format.ts`
- `frontend/src/utils/grants.ts`
- `frontend/test/pages/ApprovalsPage.test.tsx`
- `frontend/test/pages/GrantsPage.test.tsx`

步骤：

- [ ] 写审批管理短 ID 测试。
- [ ] 写放行记录短 ID 测试。
- [ ] 写放行详情测试：包含关联执行链路。
- [ ] 写放行 scope 测试：范围拆成字段且不溢出。
- [ ] 审批表格接入短 ID。
- [ ] 放行表格接入短 ID。
- [ ] 实现 scope renderer。
- [ ] 放行详情增加授权上下文、关联执行链路、放行范围、撤销/过期信息。

验证：

```powershell
cd frontend
npx.cmd vitest run --no-color --reporter verbose test/pages/ApprovalsPage.test.tsx test/pages/DecisionsPage.test.tsx test/pages/GrantsPage.test.tsx
```

完成标准：

- 长 ID 不再直接占满表格。
- 放行范围不溢出。
- 放行详情能说明与问答、审批、工具调用的关系。

## 10. 第九阶段：策略配置分页和布局

目标：策略配置从“三个小表格挤在一起”改为概览加分区列表，并增加后端分页。

涉及文件：

- `backend/internal/api/policy_dto.go`
- `backend/internal/routes/policy.go`
- `backend/internal/repo/policy.go`
- `frontend/src/api/policies.ts`
- `frontend/src/pages/PoliciesPage.tsx`
- `frontend/src/styles/pages-policies.css`
- `backend/test/*policy*`
- `frontend/test/pages/PoliciesPage.test.tsx`

步骤：

- [ ] 写后端分页接口测试：`/protected-resources`。
- [ ] 写后端分页接口测试：`/policy-rules?kind=blacklist`。
- [ ] 写后端分页接口测试：`/policy-rules?kind=allowlist`。
- [ ] 实现 repo count 和 limit/offset。
- [ ] 实现路由和 DTO。
- [ ] 保留 `/policies` 概览接口。
- [ ] 写前端测试：tabs 或 segmented control 切换三类列表。
- [ ] 写前端测试：每个列表都有分页。
- [ ] 写前端测试：弹框按钮居中或靠右。
- [ ] 页面改为顶部概览卡片加单表格区域。

验证：

```powershell
cd backend
go test ./...

cd ..\frontend
npx.cmd vitest run --no-color --reporter verbose test/pages/PoliciesPage.test.tsx
```

完成标准：

- 三类列表都是后端分页。
- 页面一次只展示一个主列表。
- 普通策略行不需要频繁横向滚动。

## 11. 第十阶段：检测报告和会话

目标：检测报告详情分区清楚，会话右侧详情更完整、选中态更明显。

涉及文件：

- `frontend/src/pages/LynxChecksPage.tsx`
- `frontend/src/pages/SessionsPage.tsx`
- `frontend/test/pages/LynxChecksPage.test.tsx`
- `frontend/test/pages/SessionsPage.test.tsx`

步骤：

- [ ] 写检测报告测试：右侧详情包含“报告元信息、投递状态、报告正文、文件和路径索引”。
- [ ] 写检测报告测试：点击报告行会更新右侧详情。
- [ ] 实现检测报告分区详情。
- [ ] 写会话测试：点击会话行后标题和详情明显变化。
- [ ] 写会话测试：详情包含渠道、请求人、群聊状态、事件数、最近工具、最近审批、最近安全事件、token 摘要。
- [ ] 实现会话详情补充字段。

验证：

```powershell
cd frontend
npx.cmd vitest run --no-color --reporter verbose test/pages/LynxChecksPage.test.tsx test/pages/SessionsPage.test.tsx
```

完成标准：

- 检测报告正文和元信息不混在一起。
- 会话右侧详情对不同选中行有明显变化。

## 12. 第十一阶段：CSS 拆分

目标：把页面私有 class 从 `theme.css` 中拆出，降低维护风险。

涉及文件：

- `frontend/src/main.tsx`
- `frontend/src/styles/theme.css`
- `frontend/src/styles/shell.css`
- `frontend/src/styles/components.css`
- `frontend/src/styles/pages-qa.css`
- `frontend/src/styles/pages-audit.css`
- `frontend/src/styles/pages-policies.css`
- `frontend/src/styles/pages-reports.css`
- `frontend/src/styles/pages-assets.css`
- `frontend/test/styles/theme.test.ts`

步骤：

- [ ] 写 CSS 归属测试，确认 QA、report、policy 等页面 class 不在 `theme.css`。
- [ ] 拆 shell 布局样式。
- [ ] 拆共享组件样式。
- [ ] 拆 QA 页面样式。
- [ ] 拆审计和控制面页面样式。
- [ ] 拆策略页面样式。
- [ ] 拆检测报告页面样式。
- [ ] 拆会话、Token、Skill 页面样式。
- [ ] 调整 `main.tsx` 样式导入顺序。

验证：

```powershell
cd frontend
npx.cmd vitest run --no-color --reporter verbose test/styles/theme.test.ts
npm.cmd run test
```

完成标准：

- `theme.css` 不再承载大量页面私有样式。
- 页面行为和布局没有因为移动 CSS 发生明显回退。

## 13. 第十二阶段：Token 统计和 Skill 供应链残留审计

目标：不新增猜测功能，只检查共享修复是否覆盖这两个页面。

涉及文件：

- 仅在发现具体问题时修改：
  - `frontend/src/pages/TokensPage.tsx`
  - `frontend/src/pages/SkillsPage.tsx`
  - 对应测试

步骤：

- [ ] 运行现有 Token 和 Skill 页面测试。
- [ ] 检查是否有长 ID、哈希、路径溢出。
- [ ] 检查是否接入全局 loading。
- [ ] 检查页面私有 CSS 是否已拆分。
- [ ] 只修具体发现的问题。

验证：

```powershell
cd frontend
npx.cmd vitest run --no-color --reporter verbose test/pages/TokensPage.test.tsx test/pages/SkillsPage.test.tsx
```

完成标准：

- 没有具体缺陷时不强行加功能。
- 发现溢出、loading 或样式问题时有对应修复和测试。

## 14. 全量本地验证

- [ ] 前端类型、测试、构建。

```powershell
cd frontend
npx.cmd tsc --noEmit --pretty false
npm.cmd run test
npm.cmd run build -- --clearScreen false
```

- [ ] 后端测试。

```powershell
cd backend
go test ./...
```

- [ ] shared 和插件 TypeScript。

```powershell
npm --prefix shared run build
npx.cmd tsc --noEmit
```

- [ ] diff 和中文编码检查。

```powershell
git diff --check
[Console]::OutputEncoding=[System.Text.Encoding]::UTF8
$mojibakePattern = [string]::Join('|', @([char]0x00C3, [char]0xFFFD, [char]0x951F, [char]0x9225, [char]0x95BF))
Select-String -Path frontend/src/**/*.tsx,frontend/src/**/*.ts,frontend/src/styles/*.css,backend/**/*.go,shared/src/*.ts -Pattern $mojibakePattern -ErrorAction SilentlyContinue
```

完成标准：

- 无 whitespace error。
- 触碰文件中没有新增乱码中文。
- 失败项必须记录原因，不把失败测试说成通过。

## 15. 运行时同步和真实路径验证

- [ ] 验证同步前置条件。

```powershell
node scripts/verify-dev-sync.mjs
```

- [ ] 同步到 OpenClaw 运行时。

```powershell
.\scripts\sync-openclaw-dev-ready.ps1 --logs 200
```

- [ ] 检查 gateway 健康。

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:18789/healthz
```

- [ ] 检查关键 webview 页面。

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:18789/webview/qa-records
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:18789/webview/events
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:18789/webview/tool-calls
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:18789/webview/chains
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:18789/webview/policies
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:18789/webview/lynx-checks
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:18789/webview/sessions
```

- [ ] 运行真实 OpenClaw agent 路径。

```powershell
docker exec openclaw-openclaw-gateway-1 sh -lc "openclaw agent --agent main --message 'test message' --json --timeout 90 2>&1"
```

完成标准：

- 同步成功。
- healthz 返回 200。
- 关键 webview 路径可访问。
- real agent 路径能触达运行时；如果 pairing 阻断，记录准确错误，并说明哪些运行时路径已经验证。

## 16. 完成定义

全部完成必须同时满足：

- bug 清单中的每类问题都有实现、测试或明确验证记录。
- 多选筛选前后端一致。
- 用户输入展示不泄露隐藏装饰提示词。
- 问答记录通过显式详情列打开抽屉。
- 工具调用能展示具体命令或操作。
- 审计日志和决策观测有判断依据。
- 审批和放行 ID 可读，放行范围不溢出。
- 策略配置有分页接口和更合理布局。
- 检测报告和会话详情结构清晰。
- CSS 页面私有样式不再堆在 `theme.css`。
- 本地测试和构建通过，或失败项有准确原因。
- 运行时同步和真实 OpenClaw/webview 验证完成。
