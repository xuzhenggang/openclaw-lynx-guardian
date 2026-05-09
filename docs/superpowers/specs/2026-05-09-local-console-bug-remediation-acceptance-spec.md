# Lynx Local Console Bug Remediation Acceptance Spec

> **Authority:** This spec is derived from `D:\all-sunday\openclaw-lynx\.lynx0\58\bug.md` and supersedes `docs/superpowers/specs/2026-05-08-local-console-bug-remediation-design.md` for this remediation round.
>
> **Scope rule:** Do not carry old-plan items into this round unless they are listed in the current `bug.md` or are required to prove one of the IDs below.
>
> **Implementation gate:** This document is the acceptance spec only. The next Superpowers artifact should be an implementation plan under `docs/superpowers/plans/` that maps every ID below to tests, code changes, runtime proof, and final report rows.

## Goal

Fix the actual user-visible defects listed in `bug.md` without drifting into broad redesign. Each bug must become a traceable requirement with page-level proof. The intended result is that a user can open the local console and understand loading state, filters, prompts, audit reasoning, commands, decisions, approvals, grants, reports, sessions, tokens, and skills without first reading raw IDs or JSON.

## Target Runtime

- Repo: `C:\Users\24716\.openclaw\extensions\openclaw-lynx-guardian`
- Branch baseline: `feat/stack`
- Primary runtime: `http://127.0.0.1:18789/webview`
- Query API prefix: `http://127.0.0.1:18789/lynx/...`
- Do not edit: `D:\all-works\openclaw`

## Source Artifacts

- Bug list: `D:\all-sunday\openclaw-lynx\.lynx0\58\bug.md`
- Screenshot folder: `D:\all-sunday\openclaw-lynx\.lynx0\58\image`
- Screenshot references below use the paths from that bug folder.

## Completion Contract

An ID is complete only when all applicable items are true:

1. A focused frontend, backend, shared-contract, or workflow test covers the requirement.
2. The exact `/webview/...` route is verified after syncing to the real OpenClaw runtime.
3. Visual/layout requirements have screenshot or DOM evidence, not only HTTP 200 or local unit tests.
4. Runtime verification uses realistic daily-use prompts, not only `pong`.
5. If a field cannot be populated for old historical data, the UI says why clearly and the new ingestion path is proven to populate it.
6. The final implementation report includes every ID in this spec with status, test evidence, runtime evidence, and notes.

## Cross-Cutting Requirements

Likely files:

- `frontend/src/api/client.ts`
- `frontend/src/app/GlobalLoadingProvider.tsx`
- `frontend/src/app/loading-store.ts`
- `frontend/src/components/feedback/GlobalLoadingIndicator.tsx`
- `frontend/src/components/filters/FilterBar.tsx`
- `frontend/src/components/tables/DataTable.tsx`
- `frontend/src/utils/prompts.ts`
- `frontend/src/styles/theme.css`
- page-level CSS files under `frontend/src/styles/`
- `skills/openclaw-plugin-dev-workflow/SKILL.md`

| ID | Source item | Requirement | Acceptance evidence |
| --- | --- | --- | --- |
| X-01 | "概览需要增加全局的loading状态，来控制全局的loading效果。可以使用React的Context来实现这个功能。" | Implement app-level request loading through a shared provider/store. All `fetchJson` calls must increment/decrement a global pending count, handle concurrent requests, and clear after failures. Overview and any route with active requests must show a consistent global loading indicator. | Unit tests for single request, concurrent requests, and failed request cleanup. Runtime DOM/screenshot evidence showing the indicator during a delayed request on `/webview` or a page route. |
| X-02 | "下拉框多选的标签占据了全部高度，很不协调，看是增加输入框上下padding好，还是减少标签高度好。" | Multi-select filter chips must be visually balanced. Selected tags must not occupy the full control height, force awkward vertical alignment, or cause the filter bar to jump. Fix may use chip height, line-height, vertical padding, or a compact selected-value renderer. | Component/page test with multiple selected labels. Runtime screenshot evidence for at least one page containing multi-select filters. |
| X-03 | "theme.css拆分力度不够，每个拆分文件都应该至少分担几百行" | Move page-private selectors out of `theme.css` into meaningful page/group CSS files. Splits must be real ownership, not token-only files. Major touched page groups must have substantial page-owned CSS, and `theme.css` must keep only global tokens, layout primitives, shared components, and truly cross-page utilities. | Selector ownership check showing no page-private selectors remain in `theme.css`. Diff evidence showing page CSS files own the moved rules. Runtime CSS asset proof after build/sync. |
| X-04 | "页面中的 输入词 显示的话应该只显示用户输入的原话，插件或者openclaw插入增加的装饰提示词不应该显示在页面上。" | Any field rendered as 输入词、用户问题、提示词、审批理由摘要, or similar user-input text must show only the original user input. OpenClaw bootstrap text, plugin guard text, developer/system instructions, policy decorations, and generated wrappers must be stripped from user-facing prompt fields. | Utility tests with decorated fixtures, including English bootstrap/developer text. Page tests for QA, 多轮链路, 审批管理, and any affected audit/detail surfaces. Runtime evidence showing decorated text absent. |
| X-05 | "列表中容器超长的内容加上省略号号还应该增加tooltip来显示完整内容" | Long list/table content must be contained with ellipsis or line clamp and expose full content through `title`, tooltip, or an explicit detail action. This applies to IDs, commands, paths, reasons, prompts, approval strings, report paths, and session keys. | Shared table/cell tests and page tests for tool calls, approvals, decisions, reports, and sessions. Runtime DOM evidence showing tooltip/title/full-detail access. |
| X-06 | "测试案例不能只用简单的pong...要记录到开发skill" | Update the development workflow guidance so runtime acceptance uses realistic daily-use prompts that exercise prompt display, tool calls, approvals, security events, result summaries, and report rendering. `pong` may remain only as a health smoke test, not as UX acceptance proof. | `skills/openclaw-plugin-dev-workflow/SKILL.md` updated. Final plan and report list the realistic prompts used. Runtime evidence includes at least one non-`pong` end-to-end probe. |
| X-07 | "当前实例测试的测试样例效果很差...很多问题没有暴露出来" | The implementation plan must define scenario fixtures and runtime prompts before coding. Fixtures must include long prompts, decorated prompts, tool execution, missing historical fields, long IDs, report paths, and session detail data. | Plan contains concrete fixture names/prompts. Tests fail before implementation for the relevant defects. |

## 问答记录 Page

Route:

- `/webview/qa-records`

Likely files:

- `frontend/src/pages/QaRecordsPage.tsx`
- `frontend/src/utils/qa-records.ts`
- `frontend/src/utils/prompts.ts`
- `frontend/src/components/cards/MetricCard.tsx`
- `frontend/src/styles/pages-qa.css`
- `frontend/test/pages/QaRecordsPage.test.tsx`
- `backend/internal/repo/qa_records.go`
- `backend/test/app_qa_records_contract_test.go`

| ID | Source item | Requirement | Acceptance evidence |
| --- | --- | --- | --- |
| QA-01 | "工具次数，审批要求，安全信号是什么意思？" | Metric cards must use user-readable labels and helper text. 工具次数 means related tool call count, 审批要求 means approval requests triggered by the QA record/filter scope, and 安全信号 means related security signals/events. | Page test/DOM evidence showing revised labels or concise helper text. Screenshot after sync. |
| QA-02 | "当前筛选范围这几个字 还是放在数字下面？显得拥挤还重复" | Remove repeated "当前筛选范围" text from each metric card. If filter scope must be shown, show it once near the filter bar or page summary, not below every number. | Page test asserting metric cards do not repeat the phrase. Runtime screenshot evidence. |

## 审计日志 Page

Route:

- `/webview/events`

Likely files:

- `frontend/src/pages/EventsPage.tsx`
- `frontend/src/api/events.ts`
- `frontend/src/api/security-events.ts`
- `frontend/src/utils/status.tsx`
- `frontend/src/styles/pages-audit.css`
- `frontend/test/pages/EventsPage.test.tsx`
- `backend/internal/repo/security_events.go`
- `backend/internal/repo/events.go`
- `backend/test/app_security_events_contract_test.go`

| ID | Source item | Requirement | Acceptance evidence |
| --- | --- | --- | --- |
| EV-01 | "和概览一样，把总的安全事件卡片放到最右边，现在还在最左边" | Summary cards must place the total security-event count at the far right, matching the overview ordering. | Page test or DOM assertion for card order. Runtime screenshot evidence. |
| EV-02 | "这一列信息挤在一起让人很难理解，对象/内容还是放在一列了" | Split crowded object/content information into readable columns or named stacked fields. Object, content, module, event ID, and related target must not be jammed into one unclear cell. | Page test for separate labels/columns or named cell regions. Runtime screenshot evidence. |
| EV-03 | "这里没有判断依据啊，应该增加一个判断依据，来说明为什么会有这样的判断，证据栏还是没有具体证据" | Event detail must include a readable 判断依据 section before raw data. It must explain the triggering module/rule, risk level, decision/action, and concrete evidence. Evidence must not be an empty or generic label when backend data exists. | Backend contract test for evidence fields. Page test finds 判断依据 and concrete evidence text. Runtime DOM/screenshot evidence. |

## 工具调用 Page

Route:

- `/webview/tool-calls`

Likely files:

- `frontend/src/pages/ToolCallsPage.tsx`
- `frontend/src/api/tool-calls.ts`
- `frontend/src/utils/tool-display.ts`
- `frontend/src/styles/pages-toolcalls.css`
- `frontend/test/pages/ToolCallsPage.test.tsx`
- `frontend/test/utils/tool-display.test.ts`
- `backend/internal/repo/toolcalls.go`
- `backend/internal/repo/ingest.go`
- `backend/internal/routes/query.go`
- `backend/test/decision_tool_contract_test.go`

| ID | Source item | Requirement | Acceptance evidence |
| --- | --- | --- | --- |
| TC-01 | "列表应该展示这个工具具体执行的命令和操作啊" | Tool call list must show the concrete command, action, or operation summary when stored. The primary visible description must not be only `tool_call_id`. | Page test with command metadata showing command/action in the table. Runtime screenshot evidence. |
| TC-02 | "几乎所有工具调用都没有结果摘要" | Capture and display result summary when the tool result exists. For legacy rows that truly lack result summary, show a clear historical-data message, not a silent "暂无" as if the current system failed. | Backend ingestion/repo test for result summary persistence. Page test for present summary and legacy missing-summary fallback. |
| TC-03 | "详情里这几个值不能显示暂无啊，然后执行命令必须有具体值" | Detail cards for current/new tool calls must contain concrete command/action, status, result summary, and related context. Missing values must be limited to documented legacy data gaps. | Detail page test with a new fixture proving fields are populated. Runtime proof from a non-`pong` tool-call scenario. |
| TC-04 | "具体命令也应该标注在详情卡片里，然后放在工具调用概览里" | The command/action must appear both in the list overview and in the detail header/card, using the same resolver so the user immediately knows what the call did. | Test checks list and detail both contain the command/action. Screenshot evidence. |
| TC-05 | "这个不应该放ID,应该放执行的命令，或者工具调用的摘要信息，来让用户快速知道这个工具调用是干什么的" | Tool detail hero/overview must use a human summary such as `exec: <command>` or `<tool>: <operation>`. Full ID can remain secondary, tooltip, or metadata, but not the main title. | Page test ensures hero title is not just a call ID. Runtime screenshot evidence. |

## 多轮链路 Page

Route:

- `/webview/chains`

Likely files:

- `frontend/src/pages/ChainsPage.tsx`
- `frontend/src/api/chains.ts`
- `frontend/src/utils/prompts.ts`
- `frontend/src/styles/pages-chains.css`
- `frontend/test/pages/ChainsPage.test.tsx`
- `backend/internal/chain/service.go`
- `backend/internal/repo/chains.go`
- `backend/internal/routes/chains.go`
- `backend/test/chains_prompt_coverage_contract_test.go`

| ID | Source item | Requirement | Acceptance evidence |
| --- | --- | --- | --- |
| CH-01 | "输入词显示的话应该只显示用户输入的原话，插件或openclaw增加的提示词不应该显示出来" | Chain list/detail must use the shared original-user-prompt resolver. Decorated bootstrap/plugin/OpenClaw text must not appear as 输入词. | Prompt utility test and Chains page test with decorated fixture. Runtime evidence. |
| CH-02 | "多轮链路有太多输入词了，你把这几个对话具体的关联关系写在上面吧，为什么他们被视为同一条链路上的对话。" | Each chain detail must show a clear 关联关系 explanation above the conversation/prompt list. It must state why records are grouped, such as same session, same QA, same tool chain, shared approval/grant, or risk-signal continuity. | Backend/detail DTO test if relation data is enriched. Page test for 关联关系 section. Screenshot evidence. |
| CH-03 | "这一列的内容太多了，链路和会话扯在一起了，还加上了覆盖输入词" | Separate chain ID, session/conversation, and covered prompt into distinct fields/columns/sections. Do not combine them into one overloaded cell. | Page test for distinct labels/columns. Runtime screenshot evidence. |

## 审批管理 Page

Route:

- `/webview/approvals`

Likely files:

- `frontend/src/pages/ApprovalsPage.tsx`
- `frontend/src/api/approvals.ts`
- `frontend/src/utils/format.ts`
- `frontend/src/utils/prompts.ts`
- `frontend/src/styles/pages-approvals.css`
- `frontend/test/pages/ApprovalsPage.test.tsx`
- `shared/src/ingest.ts`
- `shared/src/query-dto.ts`
- `backend/internal/repo/ingest.go`
- `backend/internal/repo/approvals.go`
- `backend/internal/routes/approvals.go`
- `backend/test/app_routes_test.go`

| ID | Source item | Requirement | Acceptance evidence |
| --- | --- | --- | --- |
| AP-01 | "ID实在是太长了吧，我的意思不是减短页面显示的ID，而是数据库存储ID就不要这么长，超出20个字符长度的ID就不合理了" | New approval IDs stored in the database must be at most 20 characters. This is not just a UI abbreviation. ID generation, ingestion, and related foreign-key references must use the short ID format for new rows while handling legacy long IDs safely. | Backend tests for new approval ID generation/storage length `<= 20`. Ingest/repo tests proving related grants/tool calls/QA links still resolve. Runtime proof from a newly triggered approval. |
| AP-02 | Screenshot `image/bug/1778295707757.png` showing long bootstrap/developer text in approval reason | Approval list/detail must show a human-readable protected operation and original user request, not raw OpenClaw bootstrap or developer/system text. Long reason text must be contained with tooltip/detail access. | Prompt-stripping tests for approval fixtures. Page test proving no bootstrap text is visible in the list. Runtime screenshot evidence. |
| AP-03 | Screenshot-only approval readability issue | Approval detail must explain requester, requested operation, target resource/tool, risk level, current status, and evidence in readable Chinese. Raw IDs and raw JSON can be secondary, not the main explanation. | Page test checks these labels. Runtime screenshot evidence. |

## 决策观测 Page

Route:

- `/webview/decisions`

Likely files:

- `frontend/src/pages/DecisionsPage.tsx`
- `frontend/src/api/decisions.ts`
- `frontend/src/utils/status.tsx`
- `frontend/src/styles/pages-decisions.css`
- `frontend/test/pages/DecisionsPage.test.tsx`
- `backend/internal/repo/decisions.go`
- `backend/internal/routes/decision.go`
- `backend/test/decision_routes_contract_test.go`

| ID | Source item | Requirement | Acceptance evidence |
| --- | --- | --- | --- |
| DE-01 | "决策理由超长也应该增加tooltip" | Long decision reason in the table must be truncated/contained and expose full text through `title`, tooltip, or detail. It must not stretch the row. | Page test for tooltip/title and long text containment. Runtime screenshot/DOM evidence. |
| DE-02 | "详情这里不应该显示ID，应该显示决策的摘要信息，来让用户快速知道这个决策是干什么的" | Decision detail hero/summary must describe what the decision did: stage, module, risk, action, target, and reason summary. Full decision ID can remain secondary metadata, not the main visible summary. | Page test ensures hero summary is not just an ID. Runtime screenshot evidence. |

## 放行记录 Page

Route:

- `/webview/grants`

Likely files:

- `frontend/src/pages/GrantsPage.tsx`
- `frontend/src/api/grants.ts`
- `frontend/src/utils/grants.ts`
- `frontend/src/utils/tool-display.ts`
- `frontend/src/styles/pages-grants.css`
- `frontend/test/pages/GrantsPage.test.tsx`
- `backend/internal/grants/service.go`
- `backend/internal/repo/grants.go`
- `backend/internal/routes/grants.go`
- `backend/test/grants_routes_contract_test.go`

| ID | Source item | Requirement | Acceptance evidence |
| --- | --- | --- | --- |
| GR-01 | "放行记录应该增加类似于问答记录中的执行链路的显示，现在的执行链路还是显示不清" | Grant detail must show a related execution chain section similar to QA, connecting QA record, approval, grant, session/conversation, and related tool calls. | Backend/detail test if DTO is enriched. Page test for execution-chain section. Runtime screenshot evidence. |
| GR-02 | "应该一个工具调用一个卡片来展示，工具调用里展示这个工具调用的具体命令和操作" | Related tool calls in grant detail must render as one card per tool call. Each card must show concrete command/action/operation and result/status where available. | Page test with multiple tool calls. Runtime screenshot evidence. |
| GR-03 | "正常用户都看不懂这些范围是什么意思？" | Grant scope must be translated into readable Chinese labels and grouped fields. Internal keys like `approvedRiskLevel`, `grantWindowMs`, `scopeType`, and `targetHash` must be explained as user-facing concepts. | Page test checks Chinese labels and absence of raw internal-key-only display in primary scope. Screenshot evidence. |

## 策略配置 Page

Route:

- `/webview/policies`

Likely files:

- `frontend/src/pages/PoliciesPage.tsx`
- `frontend/src/api/policies.ts`
- `frontend/src/styles/pages-policies.css`
- `frontend/test/pages/PoliciesPage.test.tsx`
- `backend/internal/repo/policy.go`
- `backend/internal/routes/policy.go`
- `backend/test/policy_routes_contract_test.go`

| ID | Source item | Requirement | Acceptance evidence |
| --- | --- | --- | --- |
| PO-01 | "切换列表标签闪屏，增加loading效果避免闪屏" | Switching policy list tabs must show a stable loading state instead of flashing blank/incorrect content. The active tab, previous content, and loading placeholder must not visually fight each other. | Page test with delayed list fetch. Runtime screenshot/DOM evidence during tab switch. |

## 检测报告 Page

Route:

- `/webview/lynx-checks`

Likely files:

- `frontend/src/pages/LynxChecksPage.tsx`
- `frontend/src/api/lynx-checks.ts`
- `frontend/src/styles/pages-reports.css`
- `frontend/test/pages/LynxChecksPage.test.tsx`
- `backend/internal/repo/lynxchecks.go`
- `backend/internal/repo/lynxcheck_tasks.go`
- `backend/internal/routes/lynxcheck_tasks.go`
- `backend/test/app_lynx_report_contract_test.go`
- `backend/test/lynxcheck_tasks_routes_contract_test.go`

| ID | Source item | Requirement | Acceptance evidence |
| --- | --- | --- | --- |
| LC-01 | "详情里还是有问题，报告路径的文字也竖起来了，这里ID也不重复显示了，报告正文占比太小了" | Report detail must prioritize the report body. The selected report ID must not be repeated as the primary content, paths must wrap horizontally without vertical broken text, and the report body must receive the largest useful area. | Page test for section order and no duplicate ID hero. Runtime screenshot evidence. |
| LC-02 | "下半部分这里的部分可以去掉了，不需要一次展示全部的报告路径" | Remove the always-visible full file/path index from the lower detail area. If path history is needed, make it collapsed, secondary, or available through an explicit action, not displayed as a long list by default. | Page test proving path index is not expanded by default. Runtime screenshot evidence. |
| LC-03 | Report body visibility implied by "报告正文占比太小" | Actual markdown report body must be visible and primary when available. Metadata, delivery status, and paths must be separate secondary sections. | Backend test for `reportMarkdown` delivery. Page test and runtime DOM evidence showing real markdown text. |

## 会话 Page

Route:

- `/webview/sessions`

Likely files:

- `frontend/src/pages/SessionsPage.tsx`
- `frontend/src/api/sessions.ts`
- `frontend/src/styles/pages-sessions.css`
- `frontend/test/pages/SessionsPage.test.tsx`
- `backend/internal/repo/sessions.go`
- `backend/internal/routes/query.go`
- `backend/test/app_routes_test.go`

| ID | Source item | Requirement | Acceptance evidence |
| --- | --- | --- | --- |
| SS-01 | "详细信息这里怎么全是暂无啊" | Session detail must populate available fields from backend data. Unknown fields should be hidden, grouped under "未采集", or explained; the primary panel must not be dominated by "暂无". | Backend session detail test for populated fixture. Page test asserting primary detail is not mostly "暂无". Runtime screenshot evidence. |
| SS-02 | "下面这一串实在是太多了，如果内容这么多，就不适合左右对比的布局了，很多信息给到用户也没用啊" | Redesign session detail density. Long recent tools, approvals, security events, and token data must be summarized and grouped; full lists should be collapsed, paged, linked, or shown in a secondary section. The right panel must not become a long raw dump. | Page test for grouped summaries/collapsible secondary details. Runtime screenshot evidence on a high-activity session. |
| SS-03 | Screenshots `image/bug/1778297236545.png` and `image/bug/1778297306380.png` | Recent activity rows must use human summaries instead of long raw IDs where possible, with full IDs available through tooltip/detail. | Page test for compact summaries and tooltip/title. Runtime DOM evidence. |

## Token统计 Page

Route:

- `/webview/tokens`

Likely files:

- `frontend/src/pages/TokensPage.tsx`
- `frontend/src/api/tokens.ts`
- `frontend/src/styles/pages-tokens.css`
- `frontend/src/pages/TokensPage.test.tsx`
- `backend/internal/repo/tokens.go`

| ID | Source item | Requirement | Acceptance evidence |
| --- | --- | --- | --- |
| TK-01 | Empty section heading "Token统计：" | This page must not be ignored. Perform an explicit audit for loading state, long session IDs, overflow/tooltips, actual vs estimated token wording, chart/table readability, empty state, and runtime data correctness. | Written audit result in the implementation report. Screenshot/DOM evidence for `/webview/tokens`. |
| TK-02 | No concrete defect text supplied | Do not invent unrelated token features. If the audit finds a concrete defect, add targeted tests and fix it; if not, record "audited, no concrete defect found" with evidence. | Test evidence if fixed; otherwise screenshot/DOM evidence and no-op audit entry. |

## skill供应链 Page

Route:

- `/webview/skills`

Likely files:

- `frontend/src/pages/SkillsPage.tsx`
- `frontend/src/api/skills.ts`
- `frontend/src/styles/skills.css`
- `frontend/src/pages/SkillsPage.test.tsx`
- `backend/internal/repo/skills.go`
- `backend/internal/routes/skills.go`
- `backend/test/skills_routes_contract_test.go`

| ID | Source item | Requirement | Acceptance evidence |
| --- | --- | --- | --- |
| SK-01 | Empty section heading "skill供应链：" | This page must not be ignored. Perform an explicit audit for loading state, trust-state wording, path/hash overflow, tooltip/full-value access, finding summary readability, source/channel labels, empty state, and runtime data correctness. | Written audit result in the implementation report. Screenshot/DOM evidence for `/webview/skills`. |
| SK-02 | No concrete defect text supplied | Do not invent unrelated skill-supply-chain features. If the audit finds a concrete defect, add targeted tests and fix it; if not, record "audited, no concrete defect found" with evidence. | Test evidence if fixed; otherwise screenshot/DOM evidence and no-op audit entry. |

## Required Runtime Verification Matrix

After implementation and sync, verify every route below. Route-level proof must be for the exact affected page, not a generic `/webview` load.

| Area | Route | Minimum proof |
| --- | --- | --- |
| Overview/global | `/webview` | Global loading indicator proof and realistic scenario data. |
| 问答记录 | `/webview/qa-records` | Metric wording and repeated-scope removal. |
| 审计日志 | `/webview/events` | Card order, split object/content, 判断依据, concrete evidence. |
| 工具调用 | `/webview/tool-calls` | Command/action in list and detail, result summary, no ID-as-primary title. |
| 多轮链路 | `/webview/chains` | Original prompt only, relation explanation, separated chain/session/prompt fields. |
| 审批管理 | `/webview/approvals` | New short stored approval ID, no bootstrap text as user reason, readable detail. |
| 决策观测 | `/webview/decisions` | Long reason tooltip, summary instead of ID in detail hero. |
| 放行记录 | `/webview/grants` | Execution-chain section, one card per related tool call, readable scope labels. |
| 策略配置 | `/webview/policies` | Stable loading state during tab switch. |
| 检测报告 | `/webview/lynx-checks` | Report body primary, path text not vertical, file/path index not expanded by default. |
| 会话 | `/webview/sessions` | Detail not dominated by 暂无, high-activity session summarized instead of raw dump. |
| Token统计 | `/webview/tokens` | Explicit audit result and screenshot/DOM evidence. |
| skill供应链 | `/webview/skills` | Explicit audit result and screenshot/DOM evidence. |

Required command family:

```powershell
node scripts/verify-dev-sync.mjs
.\scripts\sync-openclaw-dev-ready.ps1 --logs 200
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:18789/healthz
docker exec openclaw-openclaw-gateway-1 sh -lc "openclaw agent --agent main --message '<realistic non-pong acceptance prompt>' --json --timeout 90 2>&1"
```

## Final Report Template

Do not collapse these rows. Every ID must have a status and evidence.

| ID | Status | Test evidence | Runtime evidence | Notes |
| --- | --- | --- | --- | --- |
| X-01 | pending/done/blocked | | | |
| X-02 | pending/done/blocked | | | |
| X-03 | pending/done/blocked | | | |
| X-04 | pending/done/blocked | | | |
| X-05 | pending/done/blocked | | | |
| X-06 | pending/done/blocked | | | |
| X-07 | pending/done/blocked | | | |
| QA-01 | pending/done/blocked | | | |
| QA-02 | pending/done/blocked | | | |
| EV-01 | pending/done/blocked | | | |
| EV-02 | pending/done/blocked | | | |
| EV-03 | pending/done/blocked | | | |
| TC-01 | pending/done/blocked | | | |
| TC-02 | pending/done/blocked | | | |
| TC-03 | pending/done/blocked | | | |
| TC-04 | pending/done/blocked | | | |
| TC-05 | pending/done/blocked | | | |
| CH-01 | pending/done/blocked | | | |
| CH-02 | pending/done/blocked | | | |
| CH-03 | pending/done/blocked | | | |
| AP-01 | pending/done/blocked | | | |
| AP-02 | pending/done/blocked | | | |
| AP-03 | pending/done/blocked | | | |
| DE-01 | pending/done/blocked | | | |
| DE-02 | pending/done/blocked | | | |
| GR-01 | pending/done/blocked | | | |
| GR-02 | pending/done/blocked | | | |
| GR-03 | pending/done/blocked | | | |
| PO-01 | pending/done/blocked | | | |
| LC-01 | pending/done/blocked | | | |
| LC-02 | pending/done/blocked | | | |
| LC-03 | pending/done/blocked | | | |
| SS-01 | pending/done/blocked | | | |
| SS-02 | pending/done/blocked | | | |
| SS-03 | pending/done/blocked | | | |
| TK-01 | pending/done/blocked | | | |
| TK-02 | pending/done/blocked | | | |
| SK-01 | pending/done/blocked | | | |
| SK-02 | pending/done/blocked | | | |
