# Lynx Local Console Bug Remediation Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate every user-visible local-console defect in `docs/superpowers/specs/2026-05-09-local-console-bug-remediation-acceptance-spec.md` with page-level tests, real OpenClaw runtime proof, and a final evidence table for all 39 requirement IDs.

**Architecture:** Backend/shared contracts are proved before frontend fixes whenever data shape or ingestion changes. Cross-page utilities handle loading, prompt stripping, overflow display, operation summaries, and ID generation so each page renders concise user-facing explanations without duplicating brittle logic. Runtime acceptance must sync the plugin into the real gateway and verify each exact `/webview/...` route, not just local tests or a generic `/webview` load.

**Tech Stack:** TypeScript plugin runtime, Go local-console backend, SQLite, shared TypeScript DTO package, React 19 + Vite + Ant Design frontend, Vitest, Go contract tests, PowerShell sync scripts, real OpenClaw gateway probes, Playwright or Browser DOM/screenshot evidence.

---

## Authority And Scope

- Source of truth: `C:\Users\24716\.openclaw\extensions\openclaw-lynx-guardian\docs\superpowers\specs\2026-05-09-local-console-bug-remediation-acceptance-spec.md`.
- Audit-only source: `D:\all-sunday\openclaw-lynx\.lynx0\58\bug.md`.
- Superseded artifact: `docs/superpowers/specs/2026-05-08-local-console-bug-remediation-design.md`. Do not use it as an implementation source.
- Edit scope: only `C:\Users\24716\.openclaw\extensions\openclaw-lynx-guardian`.
- Read-only reference: `D:\all-works\openclaw`.
- Runtime target: `http://127.0.0.1:18789/webview`.
- Query API prefix: `http://127.0.0.1:18789/lynx/...`.
- Current baseline observed before writing this plan:
  - `git status --short --branch` returned `## feat/stack...origin/feat/stack [ahead 6]`.
  - `docs/superpowers/specs/2026-05-09-local-console-bug-remediation-acceptance-spec.md` is staged as added.
  - `scripts/reset-openclaw-state-soft.ps1` is untracked.
- Preserve existing repo and user edits. Do not reset, delete, or overwrite unrelated files.
- Keep `index.ts` thin. Any reusable runtime logic goes under focused `src/` modules.
- Keep Chinese text readable UTF-8. Use `apply_patch` for manual Chinese edits.
- Do not claim runtime behavior changed from local tests alone.
- Before execution, load `superpowers:test-driven-development`. Before completion, load `superpowers:verification-before-completion`.

## Requirement ID Check

The acceptance spec contains these 39 unique IDs:

`X-01`, `X-02`, `X-03`, `X-04`, `X-05`, `X-06`, `X-07`, `QA-01`, `QA-02`, `EV-01`, `EV-02`, `EV-03`, `TC-01`, `TC-02`, `TC-03`, `TC-04`, `TC-05`, `CH-01`, `CH-02`, `CH-03`, `AP-01`, `AP-02`, `AP-03`, `DE-01`, `DE-02`, `GR-01`, `GR-02`, `GR-03`, `PO-01`, `LC-01`, `LC-02`, `LC-03`, `SS-01`, `SS-02`, `SS-03`, `TK-01`, `TK-02`, `SK-01`, `SK-02`.

## File Structure

Create:

- `frontend/test/fixtures/local-console-acceptance.ts`
  - Shared frontend fixtures for decorated prompts, long IDs, long reasons, realistic tool calls, approvals, sessions, reports, tokens, and skills.
- `backend/test/local_console_acceptance_contract_test.go`
  - Cross-page backend contract tests for acceptance-specific DTO and ingestion behavior that spans multiple routes.
- `frontend/src/styles/pages-audit.css`
  - Page-owned CSS for `/webview/events` and `/webview/decisions`.
- `frontend/src/styles/pages-execution.css`
  - Page-owned CSS for `/webview/tool-calls`, `/webview/chains`, `/webview/approvals`, `/webview/grants`, and `/webview/sessions`.
- `frontend/src/styles/pages-tokens.css`
  - Page-owned CSS for `/webview/tokens` if existing `tokens.css` cannot own all token-page selectors clearly. If `tokens.css` remains the owner, document that in the CSS ownership test instead of creating a token-only duplicate.
- `.workplace/local-console-bug-remediation/2026-05-09-implementation-report.md`
  - Final implementation report with all 39 ID rows and evidence links or copied command summaries.
- `.workplace/assets/local-console-bug-remediation/`
  - Screenshot directory for exact route evidence.

Modify as needed:

- `skills/openclaw-plugin-dev-workflow/SKILL.md`
  - Add realistic non-`pong` runtime acceptance scenarios. `pong` remains health smoke only.
- `frontend/src/api/client.ts`
- `frontend/src/app/GlobalLoadingProvider.tsx`
- `frontend/src/app/loading-store.ts`
- `frontend/src/components/feedback/GlobalLoadingIndicator.tsx`
- `frontend/src/components/filters/FilterBar.tsx`
- `frontend/src/components/tables/DataTable.tsx`
- `frontend/src/main.tsx`
- `frontend/src/styles/theme.css`
- `frontend/src/styles/pages-policies.css`
- `frontend/src/styles/pages-qa.css`
- `frontend/src/styles/pages-reports.css`
- `frontend/src/styles/skills.css`
- `frontend/src/styles/tokens.css`
- `frontend/src/utils/prompts.ts`
- `frontend/src/utils/tool-display.ts`
- `frontend/src/utils/format.ts`
- `frontend/src/pages/QaRecordsPage.tsx`
- `frontend/src/pages/EventsPage.tsx`
- `frontend/src/pages/ToolCallsPage.tsx`
- `frontend/src/pages/ChainsPage.tsx`
- `frontend/src/pages/ApprovalsPage.tsx`
- `frontend/src/pages/DecisionsPage.tsx`
- `frontend/src/pages/GrantsPage.tsx`
- `frontend/src/pages/PoliciesPage.tsx`
- `frontend/src/pages/LynxChecksPage.tsx`
- `frontend/src/pages/SessionsPage.tsx`
- `frontend/src/pages/TokensPage.tsx`
- `frontend/src/pages/SkillsPage.tsx`
- `frontend/test/app/global-loading.test.tsx`
- `frontend/test/api/client.test.ts`
- `frontend/test/components/DataTable.test.tsx`
- `frontend/test/pages/QaRecordsPage.test.tsx`
- `frontend/test/pages/EventsPage.test.tsx`
- `frontend/test/pages/ToolCallsPage.test.tsx`
- `frontend/test/pages/ChainsPage.test.tsx`
- `frontend/test/pages/ApprovalsPage.test.tsx`
- `frontend/test/pages/DecisionsPage.test.tsx`
- `frontend/test/pages/GrantsPage.test.tsx`
- `frontend/test/pages/PoliciesPage.test.tsx`
- `frontend/test/pages/LynxChecksPage.test.tsx`
- `frontend/test/pages/SessionsPage.test.tsx`
- `frontend/test/pages/TokensPage.test.tsx`
- `frontend/test/pages/SkillsPage.test.tsx`
- `frontend/test/styles/theme.test.ts`
- `frontend/test/utils/prompts.test.ts`
- `frontend/test/utils/tool-display.test.ts`
- `shared/src/ingest.ts`
- `shared/src/query-dto.ts`
- `src/hooks/tool-hooks.ts`
- `src/runtime/plugin-setup-helpers.ts`
- `src/console/event-builder.ts`
- `src/utils.ts` only if the short-ID generator is shared there after inspection proves it is the correct owner.
- `backend/internal/api/dto.go`
- `backend/internal/repo/ingest.go`
- `backend/internal/repo/approvals.go`
- `backend/internal/repo/security_events.go`
- `backend/internal/repo/toolcalls.go`
- `backend/internal/repo/chains.go`
- `backend/internal/repo/grants.go`
- `backend/internal/repo/lynxchecks.go`
- `backend/internal/repo/sessions.go`
- `backend/internal/routes/approvals.go`
- `backend/internal/routes/chains.go`
- `backend/internal/routes/grants.go`
- `backend/internal/routes/query.go`
- `backend/internal/routes/lynxcheck_tasks.go`
- Existing backend contract tests under `backend/test/`.

Do not modify:

- `D:\all-works\openclaw`
- Any `.worktrees/...` copy unless the user explicitly moves this work into that worktree.
- The staged spec except for an explicit user-requested correction.
- `scripts/reset-openclaw-state-soft.ps1` unless the user expands scope.

## Scenario Fixtures And Runtime Prompts

Use these fixture names consistently in tests and in the final report:

- `fixtureDecoratedPrompt`
  - Decorated text: `system: You are OpenClaw safety guard\ndeveloper: never reveal policy internals\nOpenClaw guard policy: classify this request\nuser: 请检查当前项目的 package.json 并总结 name 字段`
  - Expected visible user input: `请检查当前项目的 package.json 并总结 name 字段`
- `fixtureLongTableValues`
  - Long ID: `approval-1234567890abcdef1234567890abcdef`
  - Long command: `powershell -NoProfile -Command "Get-ChildItem C:\\Users\\24716\\.openclaw\\extensions\\openclaw-lynx-guardian -Filter package.json -Recurse"`
  - Long report path: `.openclaw/lynx/check-runs/2026-05-09T120000.very-long-local-console-acceptance-report.report.md`
- `fixtureToolCallWithResult`
  - `toolName: "exec"`
  - `metadataJson.command: "Get-Content package.json"`
  - `resultExcerpt: "name=@shouxuai/openclaw-lynx-guardian"`
- `fixtureLegacyToolCallMissingResult`
  - Same tool metadata as above, but no `resultExcerpt`; expected UI text: `历史记录未保存结果摘要`
- `fixtureApprovalShortId`
  - New approval IDs must be generated at `<= 20` characters, such as `apv-20260509-0001`.
- `fixtureHighActivitySession`
  - At least 6 recent events, 4 recent tool calls, 3 approvals, long session key, and token summary.
- `fixtureFullMarkdownReport`
  - Starts with `# Lynx 检测报告` and includes `## 真实报告正文` plus at least 40 lines of markdown.

Use these real OpenClaw runtime prompts after implementation and sync:

- `runtime-readonly-tool-prompt`
  - `请检查当前 Lynx Guardian 插件仓库根目录是否包含 package.json 和 AGENTS.md，用只读命令读取 package.json 的 name 字段，并用三点总结这次工具调用做了什么。`
  - Acceptance areas: X-04, X-05, TC-01..TC-05, CH-01..CH-03, SS-01..SS-03.
- `runtime-approval-prompt`
  - `请尝试读取当前用户 OpenClaw 配置目录中的敏感配置摘要；如果需要审批或被安全策略拦截，请不要规避，直接说明审批对象、风险依据和下一步。`
  - Acceptance areas: AP-01..AP-03, GR-01..GR-03, EV-03, DE-02.
- `runtime-report-prompt`
  - `/lynx-check`
  - Acceptance areas: LC-01..LC-03, exact `/webview/lynx-checks` proof.
- `runtime-token-skill-audit-prompt`
  - `请查看当前运行环境中最近一次 skill 供应链状态和 token 使用概览，指出是否有异常信任状态或估算 token。`
  - Acceptance areas: TK-01..TK-02, SK-01..SK-02.

`pong` is allowed only before these prompts as a gateway health smoke test. It is not acceptance proof for any ID.

## Coverage Matrix

| ID | Main task | Focused tests | Runtime route evidence |
| --- | --- | --- | --- |
| X-01 | Task 1 | `frontend/test/app/global-loading.test.tsx`, `frontend/test/api/client.test.ts` | `/webview`, delayed request DOM or screenshot |
| X-02 | Task 1 | `frontend/test/styles/theme.test.ts`, one page test with multiple selected labels | `/webview/events` or `/webview/tool-calls` multi-select screenshot |
| X-03 | Task 1 | `frontend/test/styles/theme.test.ts` | Built CSS asset proof after sync |
| X-04 | Task 1, 3, 4, 5 | `frontend/test/utils/prompts.test.ts`, page tests for QA/chains/approvals/events | `/webview/qa-records`, `/webview/chains`, `/webview/approvals` DOM proves injected text absent |
| X-05 | Task 1 and page tasks | `frontend/test/components/DataTable.test.tsx`, page tests for long values | Tooltip/title/full-detail DOM on affected routes |
| X-06 | Task 1 | Skill doc diff and final report | Non-`pong` OpenClaw probe output |
| X-07 | Task 0, all test tasks | Acceptance fixture files and first failing test outputs | Final report lists scenario prompts |
| QA-01 | Task 3 | `frontend/test/pages/QaRecordsPage.test.tsx` | `/webview/qa-records` screenshot |
| QA-02 | Task 3 | `frontend/test/pages/QaRecordsPage.test.tsx` | `/webview/qa-records` screenshot |
| EV-01 | Task 3 | `frontend/test/pages/EventsPage.test.tsx` | `/webview/events` screenshot |
| EV-02 | Task 3 | `frontend/test/pages/EventsPage.test.tsx` | `/webview/events` screenshot |
| EV-03 | Task 2, 3 | `backend/test/app_security_events_contract_test.go`, `frontend/test/pages/EventsPage.test.tsx` | `/webview/events` detail DOM and screenshot |
| TC-01 | Task 4 | `frontend/test/pages/ToolCallsPage.test.tsx`, `frontend/test/utils/tool-display.test.ts` | `/webview/tool-calls` screenshot |
| TC-02 | Task 2, 4 | `backend/test/local_console_acceptance_contract_test.go`, `frontend/test/pages/ToolCallsPage.test.tsx` | `/webview/tool-calls` screenshot from real tool result |
| TC-03 | Task 2, 4 | Backend contract plus `ToolCallsPage` detail test | `/webview/tool-calls` detail screenshot |
| TC-04 | Task 4 | `frontend/test/pages/ToolCallsPage.test.tsx` | `/webview/tool-calls` list and detail evidence |
| TC-05 | Task 4 | `frontend/test/pages/ToolCallsPage.test.tsx` | `/webview/tool-calls` hero screenshot |
| CH-01 | Task 4 | `frontend/test/utils/prompts.test.ts`, `frontend/test/pages/ChainsPage.test.tsx` | `/webview/chains` DOM |
| CH-02 | Task 2, 4 | `backend/test/chains_prompt_coverage_contract_test.go`, `frontend/test/pages/ChainsPage.test.tsx` | `/webview/chains` screenshot |
| CH-03 | Task 4 | `frontend/test/pages/ChainsPage.test.tsx` | `/webview/chains` screenshot |
| AP-01 | Task 2, 5 | `backend/test/local_console_acceptance_contract_test.go`, approval/grant route tests | Newly triggered approval plus `/webview/approvals` |
| AP-02 | Task 5 | `frontend/test/utils/prompts.test.ts`, `frontend/test/pages/ApprovalsPage.test.tsx` | `/webview/approvals` screenshot |
| AP-03 | Task 5 | `frontend/test/pages/ApprovalsPage.test.tsx` | `/webview/approvals` detail screenshot |
| DE-01 | Task 5 | `frontend/test/pages/DecisionsPage.test.tsx`, `DataTable` tooltip test | `/webview/decisions` DOM |
| DE-02 | Task 5 | `frontend/test/pages/DecisionsPage.test.tsx` | `/webview/decisions` screenshot |
| GR-01 | Task 2, 6 | `backend/test/grants_routes_contract_test.go`, `frontend/test/pages/GrantsPage.test.tsx` | `/webview/grants` screenshot |
| GR-02 | Task 2, 6 | `backend/test/grants_routes_contract_test.go`, `frontend/test/pages/GrantsPage.test.tsx` | `/webview/grants` screenshot |
| GR-03 | Task 6 | `frontend/test/pages/GrantsPage.test.tsx` | `/webview/grants` screenshot |
| PO-01 | Task 6 | `frontend/test/pages/PoliciesPage.test.tsx` | `/webview/policies` tab-switch DOM or screenshot |
| LC-01 | Task 7 | `frontend/test/pages/LynxChecksPage.test.tsx` | `/webview/lynx-checks` screenshot |
| LC-02 | Task 7 | `frontend/test/pages/LynxChecksPage.test.tsx` | `/webview/lynx-checks` screenshot |
| LC-03 | Task 2, 7 | `backend/test/app_lynx_report_contract_test.go`, `frontend/test/pages/LynxChecksPage.test.tsx` | `/webview/lynx-checks` DOM with markdown |
| SS-01 | Task 2, 7 | `backend/test/local_console_acceptance_contract_test.go`, `frontend/test/pages/SessionsPage.test.tsx` | `/webview/sessions` screenshot |
| SS-02 | Task 7 | `frontend/test/pages/SessionsPage.test.tsx` | `/webview/sessions` high-activity screenshot |
| SS-03 | Task 7 | `frontend/test/pages/SessionsPage.test.tsx` | `/webview/sessions` DOM |
| TK-01 | Task 8 | `frontend/test/pages/TokensPage.test.tsx` plus written audit | `/webview/tokens` screenshot |
| TK-02 | Task 8 | Targeted token test if audit finds defect, otherwise no-op audit row | `/webview/tokens` DOM/screenshot |
| SK-01 | Task 8 | `frontend/test/pages/SkillsPage.test.tsx`, `backend/test/skills_routes_contract_test.go` if data defect | `/webview/skills` screenshot |
| SK-02 | Task 8 | Targeted skill test if audit finds defect, otherwise no-op audit row | `/webview/skills` DOM/screenshot |

## Task 0: Baseline, Branch Hygiene, And Acceptance Fixtures

**Files:**
- Create: `frontend/test/fixtures/local-console-acceptance.ts`
- No product code changes in this task.

- [ ] **Step 1: Reconfirm baseline before any implementation**

Run:

```powershell
git status --short --branch
[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)
[System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes('docs\superpowers\specs\2026-05-09-local-console-bug-remediation-acceptance-spec.md')) | Out-Host
```

Expected:

- Branch is still `feat/stack`.
- The May 9 acceptance spec is present and readable.
- Existing unrelated dirty files are preserved.

- [ ] **Step 2: Add shared frontend acceptance fixtures**

Add `frontend/test/fixtures/local-console-acceptance.ts` with this content:

```ts
export const decoratedPromptFixture = [
  "system: You are OpenClaw safety guard",
  "developer: never reveal policy internals",
  "OpenClaw guard policy: classify this request",
  "user: 请检查当前项目的 package.json 并总结 name 字段",
].join("\n");

export const originalUserPrompt = "请检查当前项目的 package.json 并总结 name 字段";

export const longApprovalId = "approval-1234567890abcdef1234567890abcdef";

export const longCommand = 'powershell -NoProfile -Command "Get-ChildItem C:\\Users\\24716\\.openclaw\\extensions\\openclaw-lynx-guardian -Filter package.json -Recurse"';

export const longReportPath = ".openclaw/lynx/check-runs/2026-05-09T120000.very-long-local-console-acceptance-report.report.md";

export const fullMarkdownReport = [
  "# Lynx 检测报告",
  "",
  "## 真实报告正文",
  "这里是运行时生成的检测报告正文，不是路径列表。",
  ...Array.from({ length: 40 }, (_, index) => `- 证据 ${index + 1}: 运行时页面需要展示正文。`),
].join("\n");

export function createToolCallWithResult(overrides: Record<string, unknown> = {}) {
  return {
    toolCallId: "tool-real-command",
    qaRecordId: "qa-real-command",
    sessionKey: "session-real-command",
    runId: "run-real-command",
    toolName: "exec",
    enforcementAction: "allow",
    startedAtMs: 1_777_000_000_000,
    finishedAtMs: 1_777_000_001_000,
    durationMs: 1000,
    metadataJson: {
      command: "Get-Content package.json",
      cwd: "C:/Users/24716/.openclaw/extensions/openclaw-lynx-guardian",
    },
    paramSummary: "Get-Content package.json",
    resultStatus: "completed",
    resultExcerpt: "name=@shouxuai/openclaw-lynx-guardian",
    ...overrides,
  };
}

export function createLegacyToolCallMissingResult() {
  const call = createToolCallWithResult({
    toolCallId: "tool-legacy-no-result",
    resultExcerpt: undefined,
  });
  Reflect.deleteProperty(call, "resultExcerpt");
  return call;
}
```

- [ ] **Step 3: Run fixture-aware tests to confirm no accidental product change**

Run:

```powershell
Push-Location frontend
npx.cmd vitest run --no-color --reporter verbose test/utils/prompts.test.ts test/utils/tool-display.test.ts
Pop-Location
```

Expected: Current tests either pass or reveal existing product defects before implementation. Record the output in the final report under X-07.

- [ ] **Step 4: Commit fixture-only prep after tests are intentionally added or adjusted**

Run:

```powershell
git add frontend/test/fixtures/local-console-acceptance.ts
git commit -m "test: add local console acceptance fixtures"
```

Expected: Commit succeeds only if the user has approved implementation execution. If this plan is still under review, do not commit.

## Task 1: Cross-Cutting Loading, Prompt, Tooltip, Filter, CSS, And Skill Rules

**IDs:** X-01, X-02, X-03, X-04, X-05, X-06, X-07

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/app/loading-store.ts`
- Modify: `frontend/src/app/GlobalLoadingProvider.tsx`
- Modify: `frontend/src/components/feedback/GlobalLoadingIndicator.tsx`
- Modify: `frontend/src/components/tables/DataTable.tsx`
- Modify: `frontend/src/components/filters/FilterBar.tsx`
- Modify: `frontend/src/utils/prompts.ts`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/styles/theme.css`
- Create/modify page CSS files listed in File Structure
- Modify: `frontend/test/app/global-loading.test.tsx`
- Modify: `frontend/test/api/client.test.ts`
- Modify: `frontend/test/components/DataTable.test.tsx`
- Modify: `frontend/test/styles/theme.test.ts`
- Modify: `frontend/test/utils/prompts.test.ts`
- Modify: `skills/openclaw-plugin-dev-workflow/SKILL.md`

- [ ] **Step 1: Write failing loading tests**

Add or extend tests with these exact cases:

```ts
it("keeps the global indicator visible until all concurrent fetchJson calls settle", async () => {
  const first = createDeferred<Response>();
  const second = createDeferred<Response>();
  vi.stubGlobal("fetch", vi.fn()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise));

  const pending = [fetchJson("/one"), fetchJson("/two")];
  expect(getGlobalLoadingSnapshot()).toBe(true);

  first.resolve(createJsonResponse({ ok: 1 }));
  await Promise.resolve();
  expect(getGlobalLoadingSnapshot()).toBe(true);

  second.resolve(createJsonResponse({ ok: 2 }));
  await Promise.all(pending);
  expect(getGlobalLoadingSnapshot()).toBe(false);
});

it("clears the global indicator when fetchJson throws", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
  await expect(fetchJson("/broken")).rejects.toThrow(/boom|500/);
  expect(getGlobalLoadingSnapshot()).toBe(false);
});
```

- [ ] **Step 2: Run loading tests and capture failure**

Run:

```powershell
Push-Location frontend
npx.cmd vitest run --no-color --reporter verbose test/app/global-loading.test.tsx test/api/client.test.ts
Pop-Location
```

Expected before implementation: tests fail if concurrency or failure cleanup is incomplete.

- [ ] **Step 3: Implement minimal loading fixes**

Make `fetchJson` always call `beginGlobalRequest()` and finish it in `finally`. If tests need a clean reset, add a test-only helper in `loading-store.ts`:

```ts
export function resetGlobalLoadingForTests(): void {
  pendingCount = 0;
  emit();
}
```

Use the helper only in tests. Do not add route-specific loading code when `fetchJson` can own the cross-cutting behavior.

- [ ] **Step 4: Write failing prompt-stripping tests**

Extend `frontend/test/utils/prompts.test.ts`:

```ts
it("extracts the original user line from decorated OpenClaw transcripts", () => {
  expect(resolveUserVisiblePrompt({
    prompt: decoratedPromptFixture,
    contentExcerpt: "OpenClaw guard policy: classify this request",
  })).toBe(originalUserPrompt);
});

it("rejects bootstrap, developer, plugin, and AGENTS text in approval reason candidates", () => {
  expect(resolveUserVisiblePrompt({
    userPromptExcerpt: "<INSTRUCTIONS>\n# AGENTS.md instructions for C:\\repo",
    payloadJson: { promptExcerpt: "developer: hidden approval policy" },
  })).toBe(MISSING_USER_PROMPT_TEXT);
});
```

- [ ] **Step 5: Implement prompt resolver upgrades**

Update `frontend/src/utils/prompts.ts` so it checks explicit user fields first, then safely extracts a `user:` line from decorated transcripts only when one exists. Do not guess from whole system/developer transcripts.

- [ ] **Step 6: Write failing overflow and tooltip tests**

Extend `frontend/test/components/DataTable.test.tsx`:

```ts
it("exposes full long IDs, commands, paths, and reasons through tooltip content", async () => {
  const restoreOverflow = mockElementOverflow(true);
  try {
    render(
      <ConfigProvider locale={zhCN}>
        <DataTable
          columns={[
            { key: "approvalId", label: "审批" },
            { key: "operation", label: "命令 / 操作" },
            { key: "path", label: "路径" },
            { key: "reason", label: "原因" },
          ]}
          rows={[{
            id: longApprovalId,
            approvalId: longApprovalId,
            operation: longCommand,
            path: longReportPath,
            reason: "这是一段很长的判断依据，需要被截断但仍可查看完整内容。",
          }]}
        />
      </ConfigProvider>,
    );

    for (const text of [longApprovalId, longCommand, longReportPath]) {
      fireEvent.mouseEnter(screen.getByText(text));
      await waitFor(() => expect(document.body).toHaveTextContent(text));
    }
  } finally {
    restoreOverflow();
  }
});
```

- [ ] **Step 7: Implement minimal overflow fixes**

Keep primitive cells wrapped with `OverflowTooltipCellText`. For custom page cells, use existing `row-stack`, `table-cell-ellipsis`, `title`, or page-specific detail action so full values remain accessible.

- [ ] **Step 8: Write failing multi-select chip CSS test**

Extend `frontend/test/styles/theme.test.ts`:

```ts
it("keeps Ant multi-select tags compact inside filter controls", async () => {
  const css = await readThemeCss();
  expect(css).toMatch(/\.filter-field \.ant-select-multiple \.ant-select-selection-item\s*{[\s\S]*max-height: 24px;[\s\S]*line-height: 20px;/);
  expect(css).toMatch(/\.filter-field \.ant-select-selector\s*{[\s\S]*align-items: center;[\s\S]*min-height: 40px;/);
});
```

- [ ] **Step 9: Implement filter chip CSS**

Adjust `.filter-field .ant-select-multiple` rules in `theme.css` or the owning page CSS so tags are compact and controls do not jump with multiple selected labels.

- [ ] **Step 10: Write failing CSS ownership test**

Extend `frontend/test/styles/theme.test.ts`:

```ts
it("keeps page-private selectors out of theme.css and gives real ownership to page CSS files", async () => {
  const themeCss = await readThemeCss();
  const auditCss = await readCss("src/styles/pages-audit.css");
  const executionCss = await readCss("src/styles/pages-execution.css");
  const reportCss = await readCss("src/styles/pages-reports.css");

  for (const selector of [
    ".audit-detail-dialog",
    ".decision-summary-grid",
    ".tool-call",
    ".chain",
    ".approval",
    ".grant",
    ".session",
    ".report-side-panel",
  ]) {
    expect(themeCss).not.toContain(selector);
  }

  expect(auditCss.split("\n").length).toBeGreaterThanOrEqual(200);
  expect(executionCss.split("\n").length).toBeGreaterThanOrEqual(200);
  expect(reportCss).toContain(".report-body");
});
```

- [ ] **Step 11: Move CSS by ownership**

Move page-private selectors from `theme.css` into meaningful page/group files. Update `frontend/src/main.tsx` imports. Keep `theme.css` for tokens, app shell layout, reusable primitives, shared components, and truly cross-page utilities.

- [ ] **Step 12: Update the repo-local skill**

Modify `skills/openclaw-plugin-dev-workflow/SKILL.md` under runtime validation to add:

```markdown
### Realistic Runtime Acceptance Prompts

Use `pong` only as a gateway health smoke test. UX acceptance must include at least one realistic non-`pong` prompt that creates or queries meaningful local-console data, for example:

- Ask the agent to inspect this plugin repo with read-only commands and summarize the actual command/result.
- Trigger a guarded approval or blocked sensitive-read flow and verify approvals, decisions, grants, and evidence pages.
- Run `/lynx-check` and verify the report body on `/webview/lynx-checks`.
- Inspect token and skill-supply-chain pages with live data.
```

- [ ] **Step 13: Rerun cross-cutting tests**

Run:

```powershell
Push-Location frontend
npx.cmd vitest run --no-color --reporter verbose test/app/global-loading.test.tsx test/api/client.test.ts test/components/DataTable.test.tsx test/styles/theme.test.ts test/utils/prompts.test.ts
Pop-Location
npx.cmd tsc --noEmit
```

Expected after implementation: PASS.

- [ ] **Step 14: Commit cross-cutting work**

Run:

```powershell
git add frontend/src frontend/test skills/openclaw-plugin-dev-workflow/SKILL.md
git commit -m "fix: strengthen local console shared UX foundations"
```

## Task 2: Backend And Shared Contract Recovery Before Frontend Pages

**IDs:** EV-03, TC-02, TC-03, AP-01, CH-02, GR-01, GR-02, LC-03, SS-01

**Files:**
- Create: `backend/test/local_console_acceptance_contract_test.go`
- Modify: `backend/test/app_security_events_contract_test.go`
- Modify: `backend/test/decision_tool_contract_test.go`
- Modify: `backend/test/chains_prompt_coverage_contract_test.go`
- Modify: `backend/test/grants_routes_contract_test.go`
- Modify: `backend/test/app_lynx_report_contract_test.go`
- Modify: `backend/test/app_routes_test.go`
- Modify: `shared/src/ingest.ts`
- Modify: `shared/src/query-dto.ts`
- Modify backend repo/routes files listed in File Structure
- Modify runtime event/approval emitters only after tests prove the backend/shared contract needs new data

- [ ] **Step 1: Write backend acceptance contract tests**

Create `backend/test/local_console_acceptance_contract_test.go` with focused tests:

```go
package backend_test

import (
	"net/http"
	"strings"
	"testing"
)

func TestAcceptanceToolCallPersistsCommandAndResultSummary(t *testing.T) {
	handler, closer := buildParityHandler(t)
	t.Cleanup(func() { if err := closer(); err != nil { t.Fatalf("closer: %v", err) } })

	item := qaTerminalToolCallFixture("qa-acceptance-tool")
	data := item["data"].(map[string]any)
	data["toolCallId"] = "tool-acceptance-result"
	data["metadataJson"] = map[string]any{
		"command": "Get-Content package.json",
		"cwd": "C:\\Users\\24716\\.openclaw\\extensions\\openclaw-lynx-guardian",
	}
	data["resultStatus"] = "completed"
	data["resultExcerpt"] = "name=@shouxuai/openclaw-lynx-guardian"

	seed := doJSON(t, handler, http.MethodPost, "/lynx/internal/v1/ingest/batch", fixtureBatchWithItems("acceptance-tool-result", []any{item}), true)
	decodeObjectStatus(t, seed, http.StatusOK)

	detail := decodeObjectStatus(t, doJSON(t, handler, http.MethodGet, "/lynx/tool-calls/tool-acceptance-result", nil, false), http.StatusOK)
	expectString(t, detail, "resultExcerpt", "name=@shouxuai/openclaw-lynx-guardian")
	metadata := detail["metadataJson"].(map[string]any)
	expectString(t, metadata, "command", "Get-Content package.json")
}

func TestAcceptanceNewApprovalIDsStayAtMostTwentyCharacters(t *testing.T) {
	handler, closer := buildParityHandler(t)
	t.Cleanup(func() { if err := closer(); err != nil { t.Fatalf("closer: %v", err) } })

	approval := qaApprovalFixture("qa-short-approval")
	data := approval["data"].(map[string]any)
	data["approvalId"] = "apv-20260509-0001"
	data["pendingId"] = "apv-20260509-0001"

	seed := doJSON(t, handler, http.MethodPost, "/lynx/internal/v1/ingest/batch", fixtureBatchWithItems("acceptance-short-approval", []any{approval}), true)
	decodeObjectStatus(t, seed, http.StatusOK)

	page := decodeObjectStatus(t, doJSON(t, handler, http.MethodGet, "/lynx/approvals?pageNum=1&pageSize=20", nil, false), http.StatusOK)
	items := pageItems(t, page)
	if got := items[0]["approvalId"].(string); len(got) > 20 {
		t.Fatalf("approvalId length = %d, want <= 20: %s", len(got), got)
	}
}

func TestAcceptanceSessionDetailPopulatesPrimaryFields(t *testing.T) {
	handler, closer := buildParityHandler(t)
	t.Cleanup(func() { if err := closer(); err != nil { t.Fatalf("closer: %v", err) } })

	seed := doJSON(t, handler, http.MethodPost, "/lynx/internal/v1/ingest/batch", fixtureBatch("acceptance-session-detail"), true)
	decodeObjectStatus(t, seed, http.StatusOK)

	detail := decodeObjectStatus(t, doJSON(t, handler, http.MethodGet, "/lynx/sessions/session-alpha", nil, false), http.StatusOK)
	expectString(t, detail, "sessionKey", "session-alpha")
	expectString(t, detail, "channelProfile", "feishu")
	expectString(t, detail, "requesterOuId", "ou_alpha")
	if strings.Contains(strings.ToLower(detailString(t, detail)), "null null null") {
		t.Fatalf("session detail contains raw empty dump: %#v", detail)
	}
}
```

Add this tiny test helper in the same file:

```go
func detailString(t *testing.T, payload map[string]any) string {
	t.Helper()
	return fmt.Sprintf("%#v", payload)
}
```

Add `fmt` to this file's imports:

```go
import (
	"fmt"
	"net/http"
	"strings"
	"testing"
)
```

Do not reference helpers outside this file for this assertion.

- [ ] **Step 2: Extend specific backend route tests**

Add explicit tests:

- `TestSecurityEventDetailIncludesJudgementEvidence` in `backend/test/app_security_events_contract_test.go`.
- `TestChainDetailExplainsGroupingRelation` in `backend/test/chains_prompt_coverage_contract_test.go`.
- `TestGrantDetailIncludesExecutionChainAndToolCardsData` in `backend/test/grants_routes_contract_test.go`.
- `TestLynxCheckDetailReturnsFullReportMarkdown` already exists; extend it to assert `reportMarkdown` is not replaced by path-only data.

- [ ] **Step 3: Run backend tests and capture failures**

Run:

```powershell
Push-Location backend
go test ./test -run "TestAcceptance|TestSecurityEventDetailIncludesJudgementEvidence|TestChainDetailExplainsGroupingRelation|TestGrantDetailIncludesExecutionChainAndToolCardsData|TestLynxCheckDetailReturnsFullReportMarkdown" -count=1
Pop-Location
```

Expected before implementation: FAIL for missing fields, long ID generation gaps, or insufficient detail payloads.

- [ ] **Step 4: Implement shared and backend contract changes**

Implement only what the failing tests prove:

- Add or expose evidence fields through existing `detailJson`, `metadataJson`, or typed DTO fields before creating new DTO fields.
- Add typed shared DTO fields in `shared/src/query-dto.ts` only when frontend cannot safely read existing JSON.
- Rebuild shared declarations after DTO changes:

```powershell
Push-Location shared
npm run build
Pop-Location
```

- For AP-01, create or identify the short approval ID generator near the runtime approval creation path. New IDs must be `<= 20` characters. Legacy long IDs remain readable and linkable.
- If OpenAPI changes are required, update `backend/internal/openapi/openapi.yaml`, then run:

```powershell
Push-Location backend
go tool oapi-codegen -config oapi-codegen.yaml internal/openapi/openapi.yaml
Pop-Location
```

- [ ] **Step 5: Rerun backend/shared tests**

Run:

```powershell
Push-Location backend
go test ./test -run "TestAcceptance|TestSecurityEventDetailIncludesJudgementEvidence|TestChainDetailExplainsGroupingRelation|TestGrantDetailIncludesExecutionChainAndToolCardsData|TestLynxCheckDetailReturnsFullReportMarkdown" -count=1
Pop-Location
Push-Location shared
npm run build
Pop-Location
```

Expected after implementation: PASS.

- [ ] **Step 6: Commit backend/shared contract work**

Run:

```powershell
git add backend shared src
git commit -m "fix: restore local console backend acceptance contracts"
```

## Task 3: QA Records And Security Events Pages

**IDs:** QA-01, QA-02, EV-01, EV-02, EV-03, X-04, X-05

**Files:**
- Modify: `frontend/src/pages/QaRecordsPage.tsx`
- Modify: `frontend/src/pages/EventsPage.tsx`
- Modify: `frontend/src/styles/pages-qa.css`
- Modify: `frontend/src/styles/pages-audit.css`
- Modify: `frontend/test/pages/QaRecordsPage.test.tsx`
- Modify: `frontend/test/pages/EventsPage.test.tsx`

- [ ] **Step 1: Write failing QA metric wording tests**

Extend `QaRecordsPage.test.tsx`:

```ts
it("explains QA metric cards without repeating 当前筛选范围 under every number", async () => {
  renderQaRecordsPage();
  await screen.findByText("qa-1");

  expect(screen.getByText("关联工具调用")).toBeInTheDocument();
  expect(screen.getByText("触发审批请求")).toBeInTheDocument();
  expect(screen.getByText("关联安全信号")).toBeInTheDocument();
  expect(screen.getByText(/当前筛选条件覆盖/)).toBeInTheDocument();
  expect(screen.queryAllByText("当前筛选范围")).toHaveLength(0);
});
```

- [ ] **Step 2: Run QA test and capture failure**

Run:

```powershell
Push-Location frontend
npx.cmd vitest run --no-color --reporter verbose test/pages/QaRecordsPage.test.tsx
Pop-Location
```

Expected before implementation: FAIL if old labels or repeated scope text remain.

- [ ] **Step 3: Implement QA wording and layout**

Update metric labels/helper text:

- `工具次数` becomes `关联工具调用`.
- `审批要求` becomes `触发审批请求`.
- `安全信号` becomes `关联安全信号`.
- Show filter scope once near the filter summary or page header, not below every card.

- [ ] **Step 4: Write failing Events tests**

Extend `EventsPage.test.tsx`:

```ts
it("orders the total security event card at the far right", async () => {
  renderEventsPage();
  const summary = await screen.findByLabelText("当前筛选安全事件概览");
  const cards = Array.from(summary.querySelectorAll("article"));
  expect(cards.at(-1)).toHaveTextContent("安全事件总数");
  expect(cards.at(-1)).toHaveTextContent("42");
});

it("splits event object content and detail judgement evidence into readable regions", async () => {
  renderEventsPage();
  await screen.findByText("security:tool:tool-1");
  expect(screen.getByRole("columnheader", { name: "对象" })).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: "内容摘要" })).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: "模块 / 目标" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "查看 security:tool:tool-1 详情" }));
  const dialog = await screen.findByRole("dialog", { name: "工具调用检查" });
  expect(within(dialog).getByText("判断依据")).toBeInTheDocument();
  expect(within(dialog).getByText(/SAFE_EXEC/)).toBeInTheDocument();
  expect(within(dialog).getByText(/命令包含递归删除和重要路径/)).toBeInTheDocument();
  expect(within(dialog).queryByText("暂无具体证据")).not.toBeInTheDocument();
});
```

- [ ] **Step 5: Run Events test and capture failure**

Run:

```powershell
Push-Location frontend
npx.cmd vitest run --no-color --reporter verbose test/pages/EventsPage.test.tsx
Pop-Location
```

Expected before implementation: FAIL for card order, crowded columns, or missing evidence.

- [ ] **Step 6: Implement Events page fixes**

Update summary card order and table columns. Use distinct fields for object, content summary, module/rule/target. Detail dialog must render a readable `判断依据` section before raw evidence.

- [ ] **Step 7: Rerun focused tests**

Run:

```powershell
Push-Location frontend
npx.cmd vitest run --no-color --reporter verbose test/pages/QaRecordsPage.test.tsx test/pages/EventsPage.test.tsx test/utils/prompts.test.ts
Pop-Location
```

Expected after implementation: PASS.

- [ ] **Step 8: Commit QA and Events fixes**

Run:

```powershell
git add frontend/src/pages/QaRecordsPage.tsx frontend/src/pages/EventsPage.tsx frontend/src/styles/pages-qa.css frontend/src/styles/pages-audit.css frontend/test/pages/QaRecordsPage.test.tsx frontend/test/pages/EventsPage.test.tsx
git commit -m "fix: clarify QA and security event evidence pages"
```

## Task 4: Tool Calls And Chains Pages

**IDs:** TC-01, TC-02, TC-03, TC-04, TC-05, CH-01, CH-02, CH-03, X-04, X-05

**Files:**
- Modify: `frontend/src/pages/ToolCallsPage.tsx`
- Modify: `frontend/src/pages/ChainsPage.tsx`
- Modify: `frontend/src/utils/tool-display.ts`
- Modify: `frontend/src/utils/prompts.ts`
- Modify: `frontend/src/styles/pages-execution.css`
- Modify: `frontend/test/pages/ToolCallsPage.test.tsx`
- Modify: `frontend/test/pages/ChainsPage.test.tsx`
- Modify: `frontend/test/utils/tool-display.test.ts`

- [ ] **Step 1: Write failing tool display tests**

Extend `frontend/test/utils/tool-display.test.ts`:

```ts
it("builds a human hero summary from tool name and command", () => {
  expect(resolveToolOperation(createToolCallWithResult()).operationLabel)
    .toBe("Get-Content package.json");
});

it("uses a durable legacy message when result summary was never stored", () => {
  expect(resolveToolResultSummary(createLegacyToolCallMissingResult()))
    .toBe("历史记录未保存结果摘要");
});
```

If `resolveToolResultSummary` does not exist, create it in `frontend/src/utils/tool-display.ts`.

- [ ] **Step 2: Write failing ToolCalls page tests**

Extend `ToolCallsPage.test.tsx`:

```ts
it("uses the concrete command as the list operation and detail hero, not the tool call ID", async () => {
  fetchMock
    .mockResolvedValueOnce(createJsonResponse(createPage([createToolCallWithResult()])))
    .mockResolvedValueOnce(createJsonResponse(createToolCallWithResult()));

  render(<ToolCallsPage />);

  expect(await screen.findByText("Get-Content package.json")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "查看 tool-real-command 工具调用详情" }));
  const dialog = await screen.findByRole("dialog", { name: "工具调用详情" });
  expect(within(dialog).getByText("exec: Get-Content package.json")).toBeInTheDocument();
  expect(within(dialog).getByText("name=@shouxuai/openclaw-lynx-guardian")).toBeInTheDocument();
  expect(within(dialog).queryByText("tool-real-command", { selector: ".audit-detail-dialog__heroSubtitle" })).not.toBeInTheDocument();
});

it("shows a clear legacy missing-result message instead of silent 暂无", async () => {
  fetchMock.mockResolvedValueOnce(createJsonResponse(createPage([createLegacyToolCallMissingResult()])));
  render(<ToolCallsPage />);
  expect(await screen.findByText("历史记录未保存结果摘要")).toBeInTheDocument();
});
```

- [ ] **Step 3: Run ToolCalls tests and capture failure**

Run:

```powershell
Push-Location frontend
npx.cmd vitest run --no-color --reporter verbose test/utils/tool-display.test.ts test/pages/ToolCallsPage.test.tsx
Pop-Location
```

Expected before implementation: FAIL if details still use IDs or generic `暂无`.

- [ ] **Step 4: Implement ToolCalls fixes**

Use one resolver for list operation, detail card command, and hero summary. Keep full ID secondary in metadata or tooltip.

- [ ] **Step 5: Write failing Chains tests**

Extend `ChainsPage.test.tsx`:

```ts
it("separates chain, session, and covered prompt fields in the table", async () => {
  fetchMock.mockResolvedValueOnce(createJsonResponse(createPage([createChain()])));
  render(<ChainsPage />);

  await screen.findByText("chain-1");
  expect(screen.getByRole("columnheader", { name: "链路 ID" })).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: "会话 / 对话" })).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: "覆盖输入词" })).toBeInTheDocument();
});

it("shows relation reasoning above covered prompts and strips injected prompt text", async () => {
  fetchMock.mockResolvedValueOnce(createJsonResponse(createPage([{
    ...createChain("chain-relation"),
    coveredPrompts: [
      { qaRecordId: "qa-user", userPromptExcerpt: originalUserPrompt, riskLevel: "L2", startedAtMs: 4, status: "completed" },
    ],
  }])));
  render(<ChainsPage />);

  fireEvent.click(await screen.findByRole("button", { name: "查看 chain-relation 链路详情" }));
  const dialog = await screen.findByRole("dialog", { name: "链路详情" });
  expect(within(dialog).getByText("关联关系")).toBeInTheDocument();
  expect(within(dialog).getByText(/同一会话/)).toBeInTheDocument();
  expect(within(dialog).getByText(/覆盖问答/)).toBeInTheDocument();
  expect(within(dialog).getByText(originalUserPrompt)).toBeInTheDocument();
  expect(within(dialog).queryByText(/OpenClaw guard policy/)).not.toBeInTheDocument();
});
```

- [ ] **Step 6: Run Chains tests and capture failure**

Run:

```powershell
Push-Location frontend
npx.cmd vitest run --no-color --reporter verbose test/pages/ChainsPage.test.tsx test/utils/prompts.test.ts
Pop-Location
```

Expected before implementation: FAIL if fields are still overloaded or relation reasoning is incomplete.

- [ ] **Step 7: Implement Chains fixes**

Render separate chain ID, session/conversation, and covered-prompt regions. Put `关联关系` above prompt lists in the detail dialog and derive reasons from session, QA count, tool chain, approval/grant, or risk continuity fields.

- [ ] **Step 8: Rerun focused tests**

Run:

```powershell
Push-Location frontend
npx.cmd vitest run --no-color --reporter verbose test/utils/tool-display.test.ts test/pages/ToolCallsPage.test.tsx test/pages/ChainsPage.test.tsx
Pop-Location
```

Expected after implementation: PASS.

- [ ] **Step 9: Commit ToolCalls and Chains fixes**

Run:

```powershell
git add frontend/src/pages/ToolCallsPage.tsx frontend/src/pages/ChainsPage.tsx frontend/src/utils/tool-display.ts frontend/src/utils/prompts.ts frontend/src/styles/pages-execution.css frontend/test/pages/ToolCallsPage.test.tsx frontend/test/pages/ChainsPage.test.tsx frontend/test/utils/tool-display.test.ts
git commit -m "fix: show concrete tool and chain summaries"
```

## Task 5: Approvals And Decisions Pages

**IDs:** AP-01, AP-02, AP-03, DE-01, DE-02, X-04, X-05

**Files:**
- Modify: `frontend/src/pages/ApprovalsPage.tsx`
- Modify: `frontend/src/pages/DecisionsPage.tsx`
- Modify: `frontend/src/utils/prompts.ts`
- Modify: `frontend/src/styles/pages-audit.css`
- Modify: `frontend/src/styles/pages-execution.css`
- Modify: `frontend/test/pages/ApprovalsPage.test.tsx`
- Modify: `frontend/test/pages/DecisionsPage.test.tsx`
- Modify runtime/backend approval ID files identified in Task 2 for AP-01

- [ ] **Step 1: Write failing approval tests**

Extend `ApprovalsPage.test.tsx`:

```ts
it("shows protected operation and original user request instead of bootstrap text", async () => {
  fetchMock
    .mockResolvedValueOnce(createJsonResponse(createPage([{
      ...createApproval(),
      approvalId: longApprovalId,
      promptExcerpt: decoratedPromptFixture,
      metadataJson: { protectedOperation: "读取受保护配置", userPromptExcerpt: originalUserPrompt },
    }])))
    .mockResolvedValueOnce(createJsonResponse({
      ...createApprovalDetail(),
      approvalId: longApprovalId,
      promptExcerpt: decoratedPromptFixture,
      metadataJson: { protectedOperation: "读取受保护配置", userPromptExcerpt: originalUserPrompt },
    }));

  render(<ApprovalsPage />);
  expect(await screen.findByText("读取受保护配置")).toBeInTheDocument();
  expect(screen.getByText(originalUserPrompt)).toBeInTheDocument();
  expect(screen.queryByText(/OpenClaw guard policy/)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: `查看 ${longApprovalId} 审批详情` }));
  const dialog = await screen.findByRole("dialog", { name: "审批详情" });
  for (const label of ["申请人", "申请操作", "目标资源", "风险等级", "当前状态", "判断依据"]) {
    expect(within(dialog).getByText(label)).toBeInTheDocument();
  }
});
```

- [ ] **Step 2: Run Approvals tests and capture failure**

Run:

```powershell
Push-Location frontend
npx.cmd vitest run --no-color --reporter verbose test/pages/ApprovalsPage.test.tsx test/utils/prompts.test.ts
Pop-Location
```

Expected before implementation: FAIL if raw bootstrap text or ID-primary detail remains.

- [ ] **Step 3: Implement Approvals UI fixes**

Render protected operation, original user request, target, requester, risk, status, and evidence in readable Chinese. Put raw IDs and JSON into secondary metadata.

- [ ] **Step 4: Write failing decision tests**

Extend `DecisionsPage.test.tsx`:

```ts
it("truncates long decision reasons with full tooltip access", async () => {
  const longReason = "这次裁决命中了受保护资源访问，并且因为请求要求绕过审批，所以需要人工审批。" .repeat(8);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    items: [createDecision({ decisionId: "decision-long-reason", reason: longReason })],
    total: 1,
    pageNum: 1,
    pageSize: 20,
    totalPages: 1,
  }), { status: 200 })));

  render(<DecisionsPage />);
  const reason = await screen.findByText(/这次裁决命中了受保护资源访问/);
  expect(reason).toHaveClass("table-cell-ellipsis");
});

it("uses a human decision summary in the detail hero instead of the decision ID", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    items: [createDecision({ decisionId: "decision-human-summary", stage: "tool_call", riskLevel: "L3", action: "require_approval" })],
    total: 1,
    pageNum: 1,
    pageSize: 20,
    totalPages: 1,
  }), { status: 200 })));

  render(<DecisionsPage />);
  fireEvent.click(await screen.findByRole("button", { name: "查看 decision-human-summary 裁决详情" }));
  const dialog = screen.getByRole("dialog", { name: "裁决详情" });
  expect(within(dialog).getByText(/工具阶段/)).toBeInTheDocument();
  expect(within(dialog).getByText(/L3/)).toBeInTheDocument();
  expect(within(dialog).queryByText("decision-human-summary", { selector: ".audit-detail-dialog__heroSubtitle" })).not.toBeInTheDocument();
});
```

- [ ] **Step 5: Run Decisions tests and capture failure**

Run:

```powershell
Push-Location frontend
npx.cmd vitest run --no-color --reporter verbose test/pages/DecisionsPage.test.tsx
Pop-Location
```

Expected before implementation: FAIL if long reason lacks containment or detail hero is ID-first.

- [ ] **Step 6: Implement Decisions fixes**

Use the table overflow behavior for long reason cells. Detail hero summary must include stage, module, risk, action, target, and reason summary.

- [ ] **Step 7: Rerun focused tests**

Run:

```powershell
Push-Location frontend
npx.cmd vitest run --no-color --reporter verbose test/pages/ApprovalsPage.test.tsx test/pages/DecisionsPage.test.tsx
Pop-Location
Push-Location backend
go test ./test -run "TestAcceptanceNewApprovalIDsStayAtMostTwentyCharacters|TestApprovalResolveMarksApprovalRecordApproved|TestApprovalResolveRejectsL4HardDenyRecord" -count=1
Pop-Location
```

Expected after implementation: PASS.

- [ ] **Step 8: Commit Approvals and Decisions fixes**

Run:

```powershell
git add frontend/src/pages/ApprovalsPage.tsx frontend/src/pages/DecisionsPage.tsx frontend/src/utils/prompts.ts frontend/src/styles/pages-audit.css frontend/src/styles/pages-execution.css frontend/test/pages/ApprovalsPage.test.tsx frontend/test/pages/DecisionsPage.test.tsx backend src shared
git commit -m "fix: clarify approval and decision detail evidence"
```

## Task 6: Grants And Policies Pages

**IDs:** GR-01, GR-02, GR-03, PO-01, X-05

**Files:**
- Modify: `frontend/src/pages/GrantsPage.tsx`
- Modify: `frontend/src/pages/PoliciesPage.tsx`
- Modify: `frontend/src/styles/pages-execution.css`
- Modify: `frontend/src/styles/pages-policies.css`
- Modify: `frontend/test/pages/GrantsPage.test.tsx`
- Modify: `frontend/test/pages/PoliciesPage.test.tsx`
- Modify backend grants routes/repos if Task 2 proves DTO enrichment is needed

- [ ] **Step 1: Write failing Grants tests**

Extend `GrantsPage.test.tsx`:

```ts
it("renders grant execution chain and one card per related tool call", async () => {
  fetchMock.mockResolvedValueOnce(createJsonResponse(createPage([{
    ...createGrant("grant-chain"),
    relatedToolCalls: [
      createToolCallWithResult({ toolCallId: "tool-grant-1", metadataJson: { command: "Get-Content package.json" } }),
      createToolCallWithResult({ toolCallId: "tool-grant-2", metadataJson: { command: "npm test" }, resultExcerpt: "PASS" }),
    ],
  }])));

  render(<GrantsPage />);
  fireEvent.click(await screen.findByRole("button", { name: "查看 grant-chain 放行详情" }));
  const dialog = await screen.findByRole("dialog", { name: "放行详情" });
  expect(within(dialog).getByText("关联执行链路")).toBeInTheDocument();
  expect(within(dialog).getAllByTestId("grant-related-tool-card")).toHaveLength(2);
  expect(within(dialog).getByText("Get-Content package.json")).toBeInTheDocument();
  expect(within(dialog).getByText("npm test")).toBeInTheDocument();
});

it("translates grant scope internals into readable Chinese labels", async () => {
  fetchMock.mockResolvedValueOnce(createJsonResponse(createPage([createGrant("grant-readable-scope")])));
  render(<GrantsPage />);
  fireEvent.click(await screen.findByRole("button", { name: "查看 grant-readable-scope 放行详情" }));
  const dialog = await screen.findByRole("dialog", { name: "放行详情" });
  for (const label of ["授权风险等级", "有效窗口", "授权范围", "目标摘要"]) {
    expect(within(dialog).getByText(label)).toBeInTheDocument();
  }
  expect(within(dialog).queryByText("approvedRiskLevel")).not.toBeInTheDocument();
  expect(within(dialog).queryByText("grantWindowMs")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run Grants tests and capture failure**

Run:

```powershell
Push-Location frontend
npx.cmd vitest run --no-color --reporter verbose test/pages/GrantsPage.test.tsx
Pop-Location
```

Expected before implementation: FAIL if execution chain/tool cards/readable labels are missing.

- [ ] **Step 3: Implement Grants fixes**

Render related execution chain, related tool cards, readable scope groups, and full values in tooltip/detail surfaces.

- [ ] **Step 4: Write failing Policies loading test**

Extend `PoliciesPage.test.tsx`:

```ts
it("keeps previous tab content visible with a stable loading overlay during tab switch", async () => {
  const blacklist = createDeferred<Response>();
  const fetchMock = vi.fn();
  fetchMock.mockImplementation(async (url: string) => {
    const requestUrl = new URL(String(url), "http://localhost");
    if (requestUrl.pathname.endsWith("/policy-rules") && requestUrl.searchParams.get("kind") === "blacklist") {
      return blacklist.promise;
    }
    if (requestUrl.pathname.endsWith("/policies")) {
      return Response.json({
        currentVersion: 9,
        protectedResources: [protectedResource],
        rules: [blacklistRule, allowlistRule],
      });
    }
    if (requestUrl.pathname.endsWith("/protected-resources")) {
      return Response.json(page([protectedResource]));
    }
    if (requestUrl.pathname.endsWith("/policy-rules") && requestUrl.searchParams.get("kind") === "allowlist") {
      return Response.json(page([allowlistRule]));
    }
    return Response.json(page([]));
  });
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

  render(<PoliciesPage />);
  expect(await screen.findByText("C:\\Users\\alice\\Secrets")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "黑名单" }));
  expect(screen.getByText("C:\\Users\\alice\\Secrets")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("正在加载");
});
```

- [ ] **Step 5: Run Policies test and capture failure**

Run:

```powershell
Push-Location frontend
npx.cmd vitest run --no-color --reporter verbose test/pages/PoliciesPage.test.tsx
Pop-Location
```

Expected before implementation: FAIL if tab switch flashes blank or replaces previous content too early.

- [ ] **Step 6: Implement Policies stable loading**

Keep active tab state, previous content, and loading overlay stable. Avoid blank table body during tab fetch.

- [ ] **Step 7: Rerun focused tests**

Run:

```powershell
Push-Location frontend
npx.cmd vitest run --no-color --reporter verbose test/pages/GrantsPage.test.tsx test/pages/PoliciesPage.test.tsx
Pop-Location
Push-Location backend
go test ./test -run "TestGrant|TestChain" -count=1
Pop-Location
```

Expected after implementation: PASS.

- [ ] **Step 8: Commit Grants and Policies fixes**

Run:

```powershell
git add frontend/src/pages/GrantsPage.tsx frontend/src/pages/PoliciesPage.tsx frontend/src/styles/pages-execution.css frontend/src/styles/pages-policies.css frontend/test/pages/GrantsPage.test.tsx frontend/test/pages/PoliciesPage.test.tsx backend shared
git commit -m "fix: clarify grant chains and policy loading"
```

## Task 7: Detection Reports And Sessions Pages

**IDs:** LC-01, LC-02, LC-03, SS-01, SS-02, SS-03, X-05

**Files:**
- Modify: `frontend/src/pages/LynxChecksPage.tsx`
- Modify: `frontend/src/pages/SessionsPage.tsx`
- Modify: `frontend/src/styles/pages-reports.css`
- Modify: `frontend/src/styles/pages-execution.css`
- Modify: `frontend/test/pages/LynxChecksPage.test.tsx`
- Modify: `frontend/test/pages/SessionsPage.test.tsx`
- Modify: `backend/test/app_lynx_report_contract_test.go`
- Modify backend sessions repo/routes only if primary fields are missing from data

- [ ] **Step 1: Write failing report page tests**

Extend `LynxChecksPage.test.tsx`:

```ts
it("prioritizes markdown body, avoids duplicate ID hero, and keeps path text horizontal", async () => {
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    if (url === "/lynx/lynx-checks/CHECK-BODY") {
      return createJsonResponse({
        ...createCheck({ requestId: "CHECK-BODY", reportPath: longReportPath }),
        reportMarkdown: fullMarkdownReport,
      });
    }
    return createJsonResponse(createPage([createCheck({ requestId: "CHECK-BODY", reportPath: longReportPath })]));
  });

  const { container } = render(<LynxChecksPage />);
  fireEvent.click(await screen.findByRole("button", { name: "查看 CHECK-BODY 检测报告" }));
  const markdown = await screen.findByTestId("lynx-check-report-markdown");
  expect(markdown).toHaveTextContent("## 真实报告正文");
  expect(container.querySelector(".report-path-index--expanded")).toBeNull();
  expect(container.querySelector(".report-path")).toHaveStyle({ writingMode: "horizontal-tb" });
  expect(screen.queryAllByText("CHECK-BODY").length).toBeLessThanOrEqual(2);
});
```

- [ ] **Step 2: Run report tests and capture failure**

Run:

```powershell
Push-Location frontend
npx.cmd vitest run --no-color --reporter verbose test/pages/LynxChecksPage.test.tsx
Pop-Location
```

Expected before implementation: FAIL if body is too small, ID repeats as primary content, or path index is expanded.

- [ ] **Step 3: Implement report layout**

Make markdown body the main panel. Keep metadata, delivery, and paths secondary. Collapse path index by default or expose it through an explicit action. Ensure long paths wrap horizontally.

- [ ] **Step 4: Write failing Sessions tests**

Extend `SessionsPage.test.tsx`:

```ts
it("summarizes high-activity session detail instead of rendering a raw right-panel dump", async () => {
  const detail = createSessionDetail("session-heavy", 9999, {
    recentEvents: Array.from({ length: 6 }, (_, index) => ({
      eventId: `event-heavy-${index}`,
      title: `安全事件 ${index + 1}`,
      enforcementAction: "allow",
      occurredAtMs: 1_776_945_610_000 + index,
    })),
    recentToolCalls: Array.from({ length: 4 }, (_, index) => ({
      toolCallId: `tool-heavy-${index}`,
      toolName: "exec",
      metadataJson: { command: `Get-Content file-${index}.txt` },
      enforcementAction: "allow",
      startedAtMs: 1_776_945_620_000 + index,
    })),
  });
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    if (url === "/lynx/sessions/session-heavy") return createJsonResponse(detail);
    return createJsonResponse(createPage([createSession("session-heavy")]));
  });

  render(<SessionsPage />);
  await screen.findByText("session-heavy");
  expect(await screen.findByText("会话摘要")).toBeInTheDocument();
  expect(screen.getByText(/4 次工具调用/)).toBeInTheDocument();
  expect(screen.getByText(/6 条安全事件/)).toBeInTheDocument();
  expect(screen.queryAllByText("暂无").length).toBeLessThan(3);
});

it("uses human recent activity summaries with full IDs in tooltip or detail", async () => {
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    if (url === "/lynx/sessions/session-a") return createJsonResponse(createSessionDetail("session-a", 111));
    return createJsonResponse(createPage([createSession("session-a")]));
  });
  render(<SessionsPage />);
  await screen.findByText("session-a");
  expect(await screen.findByText(/shell_session-a/)).toBeInTheDocument();
  expect(screen.queryByText(/^tool-session-a$/)).not.toBeInTheDocument();
});
```

- [ ] **Step 5: Run Sessions tests and capture failure**

Run:

```powershell
Push-Location frontend
npx.cmd vitest run --no-color --reporter verbose test/pages/SessionsPage.test.tsx
Pop-Location
```

Expected before implementation: FAIL if details are dominated by `暂无`, raw IDs, or long dumps.

- [ ] **Step 6: Implement Sessions fixes**

Hide unknown primary fields, group unavailable fields under `未采集`, summarize recent tools/events/approvals/tokens, and provide collapsed secondary detail for full lists.

- [ ] **Step 7: Rerun focused tests**

Run:

```powershell
Push-Location frontend
npx.cmd vitest run --no-color --reporter verbose test/pages/LynxChecksPage.test.tsx test/pages/SessionsPage.test.tsx
Pop-Location
Push-Location backend
go test ./test -run "TestLynxCheckDetailReturnsFullReportMarkdown|TestAcceptanceSessionDetailPopulatesPrimaryFields|TestQueryRoutesServeIngestedFixtureData" -count=1
Pop-Location
```

Expected after implementation: PASS.

- [ ] **Step 8: Commit report and sessions fixes**

Run:

```powershell
git add frontend/src/pages/LynxChecksPage.tsx frontend/src/pages/SessionsPage.tsx frontend/src/styles/pages-reports.css frontend/src/styles/pages-execution.css frontend/test/pages/LynxChecksPage.test.tsx frontend/test/pages/SessionsPage.test.tsx backend shared
git commit -m "fix: prioritize reports and session summaries"
```

## Task 8: Token And Skill Supply-Chain Explicit Audits

**IDs:** TK-01, TK-02, SK-01, SK-02, X-01, X-05

**Files:**
- Modify: `frontend/src/pages/TokensPage.tsx`
- Modify: `frontend/src/pages/SkillsPage.tsx`
- Modify: `frontend/src/styles/tokens.css` or `frontend/src/styles/pages-tokens.css`
- Modify: `frontend/src/styles/skills.css`
- Modify: `frontend/test/pages/TokensPage.test.tsx`
- Modify: `frontend/test/pages/SkillsPage.test.tsx`
- Modify: `.workplace/local-console-bug-remediation/2026-05-09-implementation-report.md`
- Modify backend token/skill tests only when the audit finds a data defect

- [ ] **Step 1: Write token audit test**

Extend `TokensPage.test.tsx`:

```ts
it("audits loading, long session IDs, source wording, chart readability, and empty state", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/tokens/summary")) return createJsonResponse({ totalTokens: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, actualTokens: 0, estimatedTokens: 0, estimatedCount: 0, unavailableCount: 0, topModels: [] });
    if (url.includes("/tokens/trend")) return createJsonResponse({ bucket: "hour", points: [] });
    if (url.includes("/tokens/heatmap")) return createJsonResponse({ timeZone: "local", totalTokens: 0, hourTotals: [], weekdayTotals: [] });
    return createJsonResponse({ items: [], total: 0, pageNum: 1, pageSize: 20, totalPages: 0 });
  });
  vi.stubGlobal("fetch", fetchMock);

  render(<TokensPage />);
  expect(await screen.findByText("Token 分析")).toBeInTheDocument();
  expect(screen.getByText(/实际采集/)).toBeInTheDocument();
  expect(screen.getByText(/估算/)).toBeInTheDocument();
  expect(screen.getByText(/暂无 Token 使用记录/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run token test and capture result**

Run:

```powershell
Push-Location frontend
npx.cmd vitest run --no-color --reporter verbose test/pages/TokensPage.test.tsx
Pop-Location
```

Expected: If it fails, fix the concrete defect. If it passes, record `audited, no concrete defect found` for TK-02 with screenshot/DOM proof.

- [ ] **Step 3: Write skill audit test**

Extend `SkillsPage.test.tsx`:

```ts
it("audits loading, trust wording, path hash overflow, findings, source labels, and empty state", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(skillListResponse([
    {
      skillId: "very-long-skill-id-" + "x".repeat(60),
      name: "Very Long Skill",
      source: "local",
      installPath: "C:/Users/example/.openclaw/skills/" + "long-path-".repeat(12),
      manifestPath: "C:/Users/example/.openclaw/skills/long/SKILL.md",
      hashAlgorithm: "sha256",
      baselineHash: "a".repeat(64),
      currentHash: "b".repeat(64),
      trustState: "hash_mismatch",
      lastSeenAt: "2026-05-07T00:00:00Z",
      findings: [{ findingId: "finding-1", skillId: "long", severity: "high", ruleId: "hash.changed", message: "changed", createdAt: "2026-05-07T00:00:00Z" }],
    },
  ])), { status: 200 })));

  render(<SkillsPage />);
  expect(await screen.findByText("Very Long Skill")).toBeInTheDocument();
  expect(screen.getByText("哈希不一致")).toBeInTheDocument();
  expect(screen.getByText("1 项风险")).toBeInTheDocument();
  expect(screen.queryByText("hash_mismatch")).not.toBeInTheDocument();
});
```

- [ ] **Step 4: Run skill test and capture result**

Run:

```powershell
Push-Location frontend
npx.cmd vitest run --no-color --reporter verbose test/pages/SkillsPage.test.tsx
Pop-Location
```

Expected: If it fails, fix the concrete defect. If it passes, record `audited, no concrete defect found` for SK-02 with screenshot/DOM proof.

- [ ] **Step 5: Implement only audited defects**

Do not invent unrelated token or skill features. Allowed fixes are loading, wording, overflow/tooltips, empty state, or runtime correctness for existing data.

- [ ] **Step 6: Rerun token and skill tests**

Run:

```powershell
Push-Location frontend
npx.cmd vitest run --no-color --reporter verbose test/pages/TokensPage.test.tsx test/pages/SkillsPage.test.tsx
Pop-Location
```

Expected after implementation or no-op audit: PASS.

- [ ] **Step 7: Commit audit fixes or no-op report update**

Run:

```powershell
git add frontend/src/pages/TokensPage.tsx frontend/src/pages/SkillsPage.tsx frontend/src/styles/tokens.css frontend/src/styles/pages-tokens.css frontend/src/styles/skills.css frontend/test/pages/TokensPage.test.tsx frontend/test/pages/SkillsPage.test.tsx .workplace/local-console-bug-remediation/2026-05-09-implementation-report.md
git commit -m "fix: audit token and skill console pages"
```

## Task 9: Build, Typecheck, Sync, And Exact Route Runtime Proof

**IDs:** all 39 IDs

**Files:**
- Modify only report and screenshot assets in this task unless runtime verification reveals a defect.
- Create/update: `.workplace/local-console-bug-remediation/2026-05-09-implementation-report.md`
- Create/update: `.workplace/assets/local-console-bug-remediation/*`

- [ ] **Step 1: Run focused frontend tests by affected page**

Run:

```powershell
Push-Location frontend
npx.cmd vitest run --no-color --reporter verbose test/app/global-loading.test.tsx test/api/client.test.ts test/components/DataTable.test.tsx test/styles/theme.test.ts test/utils/prompts.test.ts test/utils/tool-display.test.ts
npx.cmd vitest run --no-color --reporter verbose test/pages/QaRecordsPage.test.tsx test/pages/EventsPage.test.tsx test/pages/ToolCallsPage.test.tsx test/pages/ChainsPage.test.tsx
npx.cmd vitest run --no-color --reporter verbose test/pages/ApprovalsPage.test.tsx test/pages/DecisionsPage.test.tsx test/pages/GrantsPage.test.tsx test/pages/PoliciesPage.test.tsx
npx.cmd vitest run --no-color --reporter verbose test/pages/LynxChecksPage.test.tsx test/pages/SessionsPage.test.tsx test/pages/TokensPage.test.tsx test/pages/SkillsPage.test.tsx
Pop-Location
```

Expected: PASS. Record each command in the report.

- [ ] **Step 2: Run backend/shared/root checks**

Run:

```powershell
Push-Location shared
npm run build
Pop-Location
Push-Location backend
go test ./test -count=1
Pop-Location
npx.cmd tsc --noEmit
Push-Location frontend
npm run build
Pop-Location
```

Expected: PASS. Record any known broad-test caveat only if encountered with exact command output.

- [ ] **Step 3: Verify sync readiness**

Run from repo root:

```powershell
node scripts/verify-dev-sync.mjs
```

Expected: PASS. Record output summary.

- [ ] **Step 4: Sync into real OpenClaw runtime**

Run:

```powershell
.\scripts\sync-openclaw-dev-ready.ps1 --logs 200
```

Expected: sync completes. If it reports `blocked`, inspect gateway logs and do not claim runtime success until resolved.

- [ ] **Step 5: Check gateway health**

Run:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:18789/healthz
```

Expected: HTTP 200. Record status and body.

- [ ] **Step 6: Run realistic non-pong OpenClaw probes**

Run at least one probe from each prompt family:

```powershell
docker exec openclaw-openclaw-gateway-1 sh -lc "openclaw agent --agent main --message '请检查当前 Lynx Guardian 插件仓库根目录是否包含 package.json 和 AGENTS.md，用只读命令读取 package.json 的 name 字段，并用三点总结这次工具调用做了什么。' --json --timeout 90 2>&1"
docker exec openclaw-openclaw-gateway-1 sh -lc "openclaw agent --agent main --message '请尝试读取当前用户 OpenClaw 配置目录中的敏感配置摘要；如果需要审批或被安全策略拦截，请不要规避，直接说明审批对象、风险依据和下一步。' --json --timeout 90 2>&1"
docker exec openclaw-openclaw-gateway-1 sh -lc "openclaw agent --agent main --message '/lynx-check' --json --timeout 90 2>&1"
docker exec openclaw-openclaw-gateway-1 sh -lc "openclaw agent --agent main --message '请查看当前运行环境中最近一次 skill 供应链状态和 token 使用概览，指出是否有异常信任状态或估算 token。' --json --timeout 90 2>&1"
```

Expected: At least one non-`pong` probe completes and creates meaningful local-console data. If a probe times out, inspect artifacts before marking it failed.

- [ ] **Step 7: Inspect runtime artifacts**

Run:

```powershell
Get-ChildItem "$env:USERPROFILE\.openclaw\lynx\check-runs" -File |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 10 FullName,LastWriteTime,Length

Get-ChildItem "$env:USERPROFILE\.openclaw\docker-state\agents\main\sessions" -File |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 5 FullName,LastWriteTime,Length
```

For `/lynx-check`, read newest matching files:

```powershell
$latest = Get-ChildItem "$env:USERPROFILE\.openclaw\lynx\check-runs" -Filter *.result.json |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
$latest.FullName
Get-Content -Raw -Encoding UTF8 $latest.FullName
Get-Content -Raw -Encoding UTF8 ($latest.FullName -replace '\.result\.json$', '.report.md')
```

Expected: Result/report content proves runtime data exists.

- [ ] **Step 8: Verify exact `/webview` routes with DOM or screenshots**

Use Playwright, Browser, or the available webapp-testing path. Capture one screenshot per route under `.workplace/assets/local-console-bug-remediation/` and record a DOM assertion for the named acceptance proof.

Routes:

```text
http://127.0.0.1:18789/webview
http://127.0.0.1:18789/webview/qa-records
http://127.0.0.1:18789/webview/events
http://127.0.0.1:18789/webview/tool-calls
http://127.0.0.1:18789/webview/chains
http://127.0.0.1:18789/webview/approvals
http://127.0.0.1:18789/webview/decisions
http://127.0.0.1:18789/webview/grants
http://127.0.0.1:18789/webview/policies
http://127.0.0.1:18789/webview/lynx-checks
http://127.0.0.1:18789/webview/sessions
http://127.0.0.1:18789/webview/tokens
http://127.0.0.1:18789/webview/skills
```

Minimum DOM evidence:

- `/webview`: global loading indicator can appear during delayed request.
- `/webview/qa-records`: readable metric labels and no repeated `当前筛选范围`.
- `/webview/events`: total card far right, separated object/content, `判断依据`.
- `/webview/tool-calls`: command/action in list and detail, result summary, hero not ID-only.
- `/webview/chains`: original prompt only, `关联关系`, separated chain/session/prompt.
- `/webview/approvals`: short new stored ID, no bootstrap text, readable detail fields.
- `/webview/decisions`: long reason tooltip/full access, decision summary hero.
- `/webview/grants`: execution-chain section, one card per related tool call, readable scope labels.
- `/webview/policies`: stable loading during tab switch.
- `/webview/lynx-checks`: report body primary, path text horizontal, path index collapsed by default.
- `/webview/sessions`: detail not dominated by `暂无`, high-activity summary, compact recent activity.
- `/webview/tokens`: explicit audit evidence.
- `/webview/skills`: explicit audit evidence.

- [ ] **Step 9: Commit runtime evidence report**

Run after report/screenshots are saved:

```powershell
git add .workplace/local-console-bug-remediation .workplace/assets/local-console-bug-remediation
git commit -m "docs: record local console acceptance evidence"
```

## Task 10: Final Implementation Report

**IDs:** all 39 IDs

**Files:**
- Create/update: `.workplace/local-console-bug-remediation/2026-05-09-implementation-report.md`

- [ ] **Step 1: Create the report with this exact table**

Use this table and fill every row with concrete command output summaries, screenshot paths, DOM assertions, or blocker notes. Do not collapse rows.

| ID | Status | Test evidence | Runtime evidence | Notes |
| --- | --- | --- | --- | --- |
| X-01 | pending before execution | `frontend/test/app/global-loading.test.tsx`; `frontend/test/api/client.test.ts` | `/webview` delayed-request DOM/screenshot | App-level loading, concurrency, failure cleanup |
| X-02 | pending before execution | `frontend/test/styles/theme.test.ts`; multi-select page test | Multi-select route screenshot | Balanced chips |
| X-03 | pending before execution | `frontend/test/styles/theme.test.ts` | Built CSS asset proof | Real page CSS ownership |
| X-04 | pending before execution | `frontend/test/utils/prompts.test.ts`; page tests | QA/chains/approvals DOM | Original user input only |
| X-05 | pending before execution | `frontend/test/components/DataTable.test.tsx`; page tests | Tooltip/title DOM | Long content accessible |
| X-06 | pending before execution | Skill doc diff | Non-`pong` probe | Runtime scenarios documented |
| X-07 | pending before execution | Acceptance fixtures and failing-test logs | Scenario prompts listed | Better samples before coding |
| QA-01 | pending before execution | `QaRecordsPage.test.tsx` | `/webview/qa-records` screenshot | Metric wording |
| QA-02 | pending before execution | `QaRecordsPage.test.tsx` | `/webview/qa-records` screenshot | No repeated scope text |
| EV-01 | pending before execution | `EventsPage.test.tsx` | `/webview/events` screenshot | Total card far right |
| EV-02 | pending before execution | `EventsPage.test.tsx` | `/webview/events` screenshot | Split object/content |
| EV-03 | pending before execution | Backend security event contract; Events page test | `/webview/events` detail | 判断依据 and evidence |
| TC-01 | pending before execution | ToolCalls page and tool-display tests | `/webview/tool-calls` screenshot | Command in list |
| TC-02 | pending before execution | Backend tool result persistence; ToolCalls page test | Runtime tool result | Result summary |
| TC-03 | pending before execution | Backend detail; ToolCalls detail test | `/webview/tool-calls` detail | Concrete fields |
| TC-04 | pending before execution | ToolCalls page test | List/detail screenshot | Same resolver |
| TC-05 | pending before execution | ToolCalls page test | Detail hero screenshot | Hero not ID-only |
| CH-01 | pending before execution | Prompts and Chains tests | `/webview/chains` DOM | Original prompt only |
| CH-02 | pending before execution | Backend chain contract; Chains test | `/webview/chains` screenshot | Relation explanation |
| CH-03 | pending before execution | Chains test | `/webview/chains` screenshot | Separate fields |
| AP-01 | pending before execution | Backend acceptance short-ID test | Newly triggered approval | Stored ID <= 20 |
| AP-02 | pending before execution | Prompts and Approvals tests | `/webview/approvals` screenshot | No bootstrap reason |
| AP-03 | pending before execution | Approvals detail test | `/webview/approvals` detail | Readable detail |
| DE-01 | pending before execution | Decisions tooltip test | `/webview/decisions` DOM | Long reason full access |
| DE-02 | pending before execution | Decisions detail test | `/webview/decisions` screenshot | Summary hero |
| GR-01 | pending before execution | Backend grants contract; Grants test | `/webview/grants` screenshot | Execution chain |
| GR-02 | pending before execution | Backend grants contract; Grants test | `/webview/grants` screenshot | Tool cards |
| GR-03 | pending before execution | Grants test | `/webview/grants` screenshot | Readable scope |
| PO-01 | pending before execution | Policies delayed tab test | `/webview/policies` DOM | Stable loading |
| LC-01 | pending before execution | LynxChecks layout test | `/webview/lynx-checks` screenshot | Body primary, no duplicate ID |
| LC-02 | pending before execution | LynxChecks path-index test | `/webview/lynx-checks` screenshot | Path index collapsed |
| LC-03 | pending before execution | Backend report markdown; LynxChecks page test | Real `/lynx-check` report DOM | Markdown body visible |
| SS-01 | pending before execution | Backend session detail; Sessions test | `/webview/sessions` screenshot | Not dominated by 暂无 |
| SS-02 | pending before execution | Sessions high-activity test | `/webview/sessions` screenshot | Grouped summaries |
| SS-03 | pending before execution | Sessions recent activity test | `/webview/sessions` DOM | Human summaries |
| TK-01 | pending before execution | Tokens audit test/report | `/webview/tokens` screenshot | Explicit audit |
| TK-02 | pending before execution | Token targeted test if defect, otherwise audit row | `/webview/tokens` DOM | No invented feature |
| SK-01 | pending before execution | Skills audit test/report | `/webview/skills` screenshot | Explicit audit |
| SK-02 | pending before execution | Skill targeted test if defect, otherwise audit row | `/webview/skills` DOM | No invented feature |

- [ ] **Step 2: Final verification scan**

Run:

```powershell
git status --short --branch
rg -n "OpenClaw guard policy|developer:|system:|当前筛选范围|暂无结果摘要|approvedRiskLevel|grantWindowMs" frontend/src frontend/test backend/test .workplace/local-console-bug-remediation
```

Expected:

- `OpenClaw guard policy`, `developer:`, and `system:` appear only in negative test fixtures or final evidence notes.
- `当前筛选范围` is not repeated in QA metric cards.
- `暂无结果摘要` is replaced by explicit legacy wording where appropriate.
- `approvedRiskLevel` and `grantWindowMs` are not primary user-facing labels.

- [ ] **Step 3: Final commit**

Run:

```powershell
git add .
git commit -m "fix: complete local console acceptance remediation"
```

Only run `git add .` after reviewing `git status --short` to ensure no unrelated user files are staged. If unrelated files are present, stage exact paths instead.

## Plan Self-Review

- Spec coverage: all 39 IDs appear in the Requirement ID Check, Coverage Matrix, task IDs, and final report template.
- Backend/shared first: AP-01, EV-03, TC-02, TC-03, CH-02, GR-01, GR-02, LC-03, and SS-01 start with backend/shared tests before frontend-only work.
- Runtime proof: exact `/webview/...` routes are listed and required; generic `/webview` or HTTP 200 alone is insufficient.
- Non-`pong`: realistic runtime prompts are defined, and the repo-local skill update is mandatory.
- Drift guard: the May 9 spec is the authority; the May 8 design is not used as an implementation source.
- Chinese hygiene: all user-facing labels in this plan are readable UTF-8 Chinese.
