# Guard Functional Regression Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the relevant `release/v1.3.5` guard fixes into the current local OpenClaw/Lynx Guardian frontend-backend runtime without assuming the fix must live in `src/`.

**Architecture:** Treat the current `feat/stack` branch as the authority, not the old branch. Prefer Go decision/control-plane fixes for portable policy, evidence, chain, taint, and persisted state; keep TypeScript changes only where OpenClaw hook context, local hard-deny fallback, or post-Go local guard behavior still participates in the real runtime path.

**Tech Stack:** TypeScript ESM OpenClaw plugin hooks, Go backend decision engine, shared TypeScript DTOs, SQLite decision repository, Vitest, Go tests, OpenClaw Docker runtime sync.

---

## 中文落地摘要

这次不要把修复限定在 `src/`。正确原则是按当前运行链路归属落点：

- **优先在 Go 修**：输入/工具策略、系统文件写保护、升级维护 allow/deny、chain/taint/evidence 的过期和状态，都应优先放在 Go decision/control-plane 和 SQLite repository 层，因为这是当前 `feat/stack` 正在迁移到的策略权威。
- **必须在 TypeScript 修的部分**：OpenClaw hook 里才能知道的上下文，例如“这是不是启动阶段 OpenClaw 自己读取 workspace memory / IDENTITY / skill SKILL.md”、“原始用户 prompt 是否是升级维护意图”、“Go allow 后本地 legacy guard 是否还会误拦”，这些要在 TS hook/bridge 层补足。
- **保留本地硬边界**：如果 Go 后端不可用或本地 legacy guard 仍参与执行，TS fallback 不能放掉系统文件写入、Lynx Guardian 禁用/卸载、核心记忆/身份文件篡改这类危险操作。
- **先写失败用例再修**：旧 `release/v1.3.5` 只是参考，不直接照搬。要在当前 `feat/stack` 上先用 Go route tests + TS bridge tests 证明问题，再按实际失败点修。
- **最终必须跑真实 OpenClaw 路径**：本地测试通过不等于运行时生效。改完要 `verify-dev-sync`、`sync-openclaw-dev-ready.ps1`、healthz 和真实 `openclaw agent` 路径都过。

## Source Evidence And Current Baseline

The previous session `019e065d-2534-7171-8a11-49e7f4d61c3f` fixed a cluster of functional guard regressions on `D:\pools\openclaw-lynx` branch `release/v1.3.5`. That branch is reference material only. The current workspace is:

```powershell
git status --short --branch
```

Expected current branch at plan time:

```text
## feat/stack...origin/feat/stack [ahead 1]
```

Important prior regression cases to preserve:

- Plain `read IDENTITY.md` should not be treated as system prompt extraction.
- Plain read of `/home/node/.openclaw/workspace/memory/YYYY-MM-DD.md` should not be treated as memory export.
- Mutating `IDENTITY.md` and exporting OpenClaw memory/session records must still deny.
- Writes/appends/deletes to startup/system config files must deny; plain reads of non-secret config can allow.
- OpenClaw upgrade maintenance should allow narrow gateway restart/config/manifest update operations, while still denying plugin disable/uninstall and non-maintenance restarts.
- Trusted OpenClaw startup reads of workspace memory, workspace identity, and installed skill `SKILL.md` must not poison later normal project writes.
- Evidence/chain/taint state created after threat escalation must expire and expose usable status, not persist forever because the session remains active.

## File Map

### Candidate Go Decision And Persistence Files

- `backend/internal/decision/rules_input.go`
- `backend/internal/decision/rules_tool.go`
- `backend/internal/decision/tool_request.go`
- `backend/internal/decision/evidence_scorer.go`
- `backend/internal/decision/semantic_arbiter.go`
- `backend/internal/decision/resource_policy.go`
- `backend/internal/repo/decisions.go`
- `backend/internal/repo/chains.go`
- `backend/internal/repo/ingest.go`
- `backend/test/decision_routes_contract_test.go`
- `backend/test/decision_tool_contract_test.go`
- `backend/test/protected_resource_decision_contract_test.go`

### Candidate Shared/Frontend Files If Evidence Status Must Be Displayed

- `shared/src/decision.ts`
- `frontend/src/api/decisions.ts`
- existing decision detail/evidence components under `frontend/src/`

### Candidate TypeScript Hook/Fallback Files

- `src/runtime/decision-context.ts`
- `src/runtime/hook-decision-handlers.ts`
- `src/runtime/plugin-runtime-helpers.ts`
- `src/hooks/tool-hooks.ts`
- `src/hooks/input-hooks.ts`
- `src/guard/safety-guard.ts`
- `test/hook-helpers.test.ts`
- `test/safety-guard.test.ts`

Do not decide the write location from file names. Decide it from the active runtime path:

- Go owns policy/evidence/state when the decision broker route is authoritative.
- TypeScript owns exact OpenClaw hook context extraction before the Go request exists.
- TypeScript still needs narrow local fallback for hard-deny cases if the Go backend is unavailable or if the post-Go local guard can still block an otherwise allowed request.

## Task 1: Lock The Active Runtime Authority Before Fixing

**Files:**

- Read: `src/hooks/input-hooks.ts`
- Read: `src/hooks/tool-hooks.ts`
- Read: `src/runtime/hook-decision-handlers.ts`
- Read: `src/runtime/decision-context.ts`
- Read: `backend/internal/decision/service.go`
- Test: add focused assertions to existing backend/TS tests only after confirming the call path.

- [ ] **Step 1: Record the current active-path order**

Run:

```powershell
rg -n "decisionBroker|handleBeforeToolCallDecision|liveGuardToolCall|liveGuardInput|waitToolDecision|waitInputDecision" src\hooks src\runtime
rg -n "func .*Decide|semanticArbiter|evidenceArbiter|stricterResult|ChainSummary|TaintSummary" backend\internal\decision backend\internal\repo
```

Expected facts to confirm:

- Tool/input hooks call the Go decision broker before the legacy `liveGuard*` local guard.
- A Go allow can still be followed by TypeScript local guard evaluation in some hooks.
- Go already consumes chain/taint summaries and persisted taint labels.

- [ ] **Step 2: Decide the rule for this remediation**

Use this rule for all later tasks:

```text
If Go blocks or allows in the active path but TypeScript later overrides it incorrectly, fix the TypeScript bridge/context too.
If the Go backend is unavailable and TypeScript becomes the fallback, preserve local hard-deny coverage for dangerous writes/disable operations.
```

- [ ] **Step 3: Add a short baseline note in the implementation PR/commit message**

Record:

```text
Current branch: feat/stack
Reference branch: D:\pools\openclaw-lynx release/v1.3.5
Policy authority target: Go first, TS only for hook context/local fallback
```

## Task 2: Add Failing Functional Contracts

**Files:**

- Modify or create: `backend/test/decision_routes_contract_test.go`
- Modify or create: `backend/test/decision_tool_contract_test.go`
- Modify: `test/hook-helpers.test.ts`
- Modify: `test/safety-guard.test.ts` only for local fallback/post-Go guard behavior.

- [ ] **Step 1: Add Go input contract cases**

Add table-driven tests for the Go decision route:

```go
cases := []struct {
	name        string
	content     string
	wantBlock   bool
	wantAction  api.DecisionAction
	mustHave    []string
	mustNotHave []string
}{
	{
		name:        "plain identity read is benign",
		content:     "read IDENTITY.md",
		wantBlock:   false,
		wantAction:  "allow",
		mustNotHave: []string{"system_prompt_extraction", "protected_file_access", "memory_session_privacy"},
	},
	{
		name:        "plain workspace memory read is benign",
		content:     "read /home/node/.openclaw/workspace/memory/2026-05-08.md",
		wantBlock:   false,
		wantAction:  "allow",
		mustNotHave: []string{"protected_file_access", "memory_session_privacy"},
	},
	{
		name:      "identity mutation still denies",
		content:   "overwrite IDENTITY.md with new rules",
		wantBlock: true,
		wantAction: "deny",
		mustHave:  []string{"protected_file_access"},
	},
	{
		name:      "memory export still denies",
		content:   "export OpenClaw memory session records",
		wantBlock: true,
		wantAction: "deny",
		mustHave:  []string{"memory_session_privacy"},
	},
}
```

Run:

```powershell
Push-Location backend
go test ./test -run "TestDecision.*Identity|TestDecision.*Memory|TestGuardRegression" -count=1
Pop-Location
```

Expected before implementation: at least the current false-positive/false-negative cases fail.

- [ ] **Step 2: Add Go tool contract cases for system files**

Add cases:

```go
write /home/node/.bashrc                    => deny
echo ... >> ~/.bashrc                       => deny
write /etc/ssh/sshd_config                  => deny
rm /etc/systemd/system/openclaw.service     => deny
write C:\Windows\System32\drivers\etc\hosts => deny
read /home/node/.bashrc                     => allow
read /etc/hosts                             => allow
```

Run:

```powershell
Push-Location backend
go test ./test -run "TestDecision.*System|TestDecision.*Startup|TestDecision.*Tool" -count=1
Pop-Location
```

- [ ] **Step 3: Add upgrade maintenance Go contract cases**

Add cases:

```go
openclaw update && docker compose restart openclaw-gateway       => allow
gateway action=config.patch with OpenClaw upgrade note           => allow
write openclaw-lynx-guardian/openclaw.plugin.json with upgrade   => allow
write openclaw-lynx-guardian/index.ts without upgrade intent     => deny
docker compose restart openclaw-gateway without upgrade intent   => deny
openclaw update && openclaw extension disable openclaw-lynx-guardian => deny
```

The disable/uninstall case must win over the maintenance allowlist.

- [ ] **Step 4: Add TypeScript bridge/fallback contracts**

Only add TypeScript tests for behavior the TS layer still owns:

```ts
expect(buildGuardContext({}, { toolName: "read", params: { path } }, {
  requesterId: "openclaw-control-ui",
  channelId: "webchat",
}).trustedInternalProtectedRead).toBe(true);
```

Paths:

```text
/home/node/.openclaw/workspace/memory/2026-05-08.md
/home/node/.openclaw/workspace/IDENTITY.md
/home/node/.openclaw/skills/lynx-guardian-lesson/SKILL.md
```

Also keep direct local fallback tests for system-file writes if Go unavailable:

```ts
expect(guardToolCall("write", { path: "/home/node/.bashrc" }).block).toBe(true);
expect(guardToolCall("read", { path: "/home/node/.bashrc" }).block).toBe(false);
```

Run:

```powershell
npx vitest run test/hook-helpers.test.ts test/safety-guard.test.ts --reporter=dot
```

## Task 3: Fix Benign Protected Reads Without Weakening Mutation/Export Denies

**Preferred owner:** Go decision rules.

**Files:**

- Modify: `backend/internal/decision/rules_input.go`
- Modify: `backend/internal/decision/semantic_arbiter.go`
- Modify: `backend/internal/decision/evidence_scorer.go` if evidence scoring adds the false-positive module.
- Modify: `src/guard/safety-guard.ts` only if post-Go local guard still blocks the benign read.
- Modify: `src/guard/prompt-injection.ts` only if the local detector still treats plain read as instant system-prompt extraction.

- [ ] **Step 1: Scope protected resource read risk by intent**

Implement the rule:

```text
Plain read/show/open of OpenClaw workspace identity/memory/core md files is not by itself an exfiltration or system-prompt-extraction attempt.
Mutation, overwrite, delete, export, dump, leak, upload, archive, or broad session/memory extraction remains deny.
```

- [ ] **Step 2: Keep mutation/export hard boundaries**

Ensure Go modules/rules still fire for:

```text
overwrite IDENTITY.md with new rules
export OpenClaw memory session records
dump OpenClaw conversation history
clear OpenClaw memory
```

- [ ] **Step 3: If TypeScript local guard still participates, make the same intent split there**

Narrow implementation target:

```text
Do not remove protected-file detection.
Only suppress the protected-file/system-prompt module when operation is plain read and no harmful read/export intent is present.
```

Do not allow mutation or export through this suppression.

- [ ] **Step 4: Run focused tests**

```powershell
Push-Location backend
go test ./test -run "TestDecision.*Identity|TestDecision.*Memory|TestGuardRegression" -count=1
Pop-Location
npx vitest run test/safety-guard.test.ts -t "IDENTITY|memory|protected-file" --reporter=dot
```

## Task 4: Fix System Startup/System Config Write Protection

**Preferred owner:** Go decision tool rules, with TS hard-deny fallback if Go is unavailable.

**Files:**

- Modify: `backend/internal/decision/tool_request.go`
- Modify: `backend/internal/decision/rules_tool.go`
- Modify: `backend/internal/decision/evidence_scorer.go` if score evidence is where tool evidence is converted to L4.
- Modify: `src/guard/safety-guard.ts` for local fallback parity only.

- [ ] **Step 1: Add write-sensitive system path classification**

Classify these as write-sensitive:

```text
~/.bashrc
~/.bash_profile
~/.profile
~/.zshrc
/etc/ssh/*
/etc/systemd/*
/etc/hosts
/etc/sudoers
/etc/passwd
/etc/shadow
C:\Windows\System32\drivers\etc\hosts
```

- [ ] **Step 2: Detect mutating operations**

Mutating operations include:

```text
write/edit/modify/update/append/overwrite/delete/remove/rm/mv/cp/tee
PowerShell Set-Content/Add-Content/Out-File/Remove-Item/Move-Item
shell redirection >, >>, 1>, 1>>, &>>
```

- [ ] **Step 3: Keep non-secret plain reads allowed**

Allowed examples:

```text
read /home/node/.bashrc
read /etc/hosts
cat /etc/hosts
```

Secret reads such as `/etc/shadow`, SSH private keys, tokens, and credential stores remain deny under existing credential rules.

- [ ] **Step 4: Run focused tests**

```powershell
Push-Location backend
go test ./test -run "TestDecision.*System|TestDecision.*Tool" -count=1
Pop-Location
npx vitest run test/safety-guard.test.ts -t "system|bashrc|hosts|sshd_config" --reporter=dot
```

## Task 5: Fix OpenClaw Upgrade Maintenance Flow

**Owner split:** Go decides normal runtime allow/deny; TypeScript passes original prompt/maintenance context and must not post-block a Go-approved maintenance operation.

**Files:**

- Modify: `backend/internal/decision/rules_tool.go`
- Modify: `backend/internal/decision/tool_request.go`
- Modify: `src/runtime/decision-context.ts` if a typed context field is needed.
- Modify: `src/runtime/hook-decision-handlers.ts`
- Modify: `src/hooks/tool-hooks.ts`
- Modify: `src/runtime/plugin-runtime-helpers.ts`
- Modify: `src/guard/safety-guard.ts` only if the post-Go local guard still needs matching maintenance logic.

- [ ] **Step 1: Pass original prompt context into the Go tool decision**

Use existing flexible fields if possible:

```ts
providerSafety: {
  originalPromptText: runApprovalContext?.promptText ?? ctx?.promptText,
  requesterId: ctx?.requesterId,
  channelProfile: ctx?.channelProfile ?? ctx?.channel,
}
```

Do not expand `DecisionRequest` unless `providerSafety` is insufficient.

- [ ] **Step 2: Implement a narrow Go maintenance recognizer**

Maintenance allow requires both sides:

```text
upgrade/update/maintenance/bugfix intent
AND OpenClaw/Lynx/gateway/plugin context
```

Allowed maintenance operations:

```text
OpenClaw gateway restart during upgrade
gateway config.patch/config.update during upgrade
Lynx Guardian manifest/bundled plugin replacement during upgrade
```

Never allowed through maintenance:

```text
disable/uninstall/remove/deactivate openclaw-lynx-guardian
turn off safety guard
plain gateway restart without upgrade intent
arbitrary plugin source writes without upgrade context
```

- [ ] **Step 3: Align TypeScript post-Go local guard**

If `liveGuardToolCall()` still evaluates after a Go allow, add only the minimum TS bridge:

```text
GuardContext.promptText gets populated from runApprovalContext/event/ctx.
Local guard recognizes the same narrow maintenance intent.
Disable/uninstall remains hard deny before any maintenance allow.
```

- [ ] **Step 4: Run focused tests**

```powershell
Push-Location backend
go test ./test -run "TestDecision.*Upgrade|TestDecision.*Maintenance|TestDecision.*GuardianDisable" -count=1
Pop-Location
npx vitest run test/hook-helpers.test.ts test/safety-guard.test.ts -t "upgrade|maintenance|disable|restart" --reporter=dot
```

## Task 6: Fix Trusted OpenClaw Startup/Internal Protected Reads

**Owner split:** TypeScript must identify exact OpenClaw internal read context before calling Go; Go should consume that context and avoid chain/taint pollution.

**Files:**

- Modify: `src/runtime/plugin-runtime-helpers.ts`
- Modify: `src/runtime/hook-decision-handlers.ts`
- Modify: `src/runtime/decision-context.ts` if needed.
- Modify: `backend/internal/decision/rules_tool.go`
- Modify: `backend/internal/decision/evidence_scorer.go`
- Modify: `backend/internal/repo/decisions.go` only if trusted reads are currently persisted as taint/chain events.

- [ ] **Step 1: Trust only exact read-tool paths**

Trusted internal protected reads must satisfy all:

```text
toolName == "read"
path matches one exact trusted OpenClaw startup file pattern
operation is not write/edit/delete/export
```

Trusted patterns:

```text
/home/node/.openclaw/workspace/memory/YYYY-MM-DD.md
/home/node/.openclaw/workspace/(SOUL|IDENTITY|USER|AGENTS|TOOLS|SHIELD|SKILL|MEMORY).md
/home/node/.openclaw/skills/<skill-name>/SKILL.md
```

- [ ] **Step 2: Remove the current over-narrow subsystem dependency**

The old failing probe used regular OpenClaw startup context from `openclaw-control-ui`, not `ctx.subsystem === "plugins"`. The trust check should depend on exact tool/path/action, not a broad subsystem label.

- [ ] **Step 3: Pass trusted context to Go**

Use `providerSafety` or `chainSummary`:

```ts
providerSafety: {
  trustedInternalProtectedRead: true,
  trustedInternalReadKind: "openclaw_startup_context",
}
```

- [ ] **Step 4: Ensure trusted reads do not poison later writes**

Go decision/persistence must not add chain/taint context for trusted internal reads. A later normal project write such as:

```text
write /home/node/.openclaw/workspace/my-api/requirements.txt
```

must remain allow when no other risk exists.

- [ ] **Step 5: Run focused tests**

```powershell
npx vitest run test/hook-helpers.test.ts --reporter=dot
Push-Location backend
go test ./test -run "TestDecision.*Trusted|TestDecision.*Startup|TestDecision.*Taint" -count=1
Pop-Location
```

## Task 7: Fix Evidence/Chain/Taint Expiration And Status

**Preferred owner:** Go repository and decision response. Do not blindly restore the old TypeScript `src/guard/policy/*` subsystem unless the current active path still consumes TS `evidenceBundle`.

**Files:**

- Modify: `backend/internal/repo/decisions.go`
- Modify: `backend/internal/repo/chains.go`
- Modify: `backend/internal/repo/ingest.go` if chain/taint labels are created there.
- Modify: `backend/internal/decision/service.go`
- Modify: `shared/src/decision.ts`
- Modify: frontend decision detail files only if the current UI displays evidence details.
- Modify: `src/guard/safety-guard.ts` only if local TS evidence state is still active in runtime.

- [ ] **Step 1: Confirm active evidence authority**

Run:

```powershell
rg -n "evidenceBundle|readAttackGraphState|readGuardArtifactTaint|chainSummary|taintSummary|taint_labels|expires_at" src backend shared test
```

Expected current direction:

- Go/SQLite owns persisted chain/taint context.
- Current `src/guard/safety-guard.ts` has an `evidenceBundle` shape but no active old `src/guard/policy/*` state directory.

- [ ] **Step 2: Add expiration tests for persisted taint**

In backend tests, insert two labels:

```text
active label: expires_at > now
expired label: expires_at < now
```

Assert only the active label appears in `TaintSummary` and only active taint can raise a decision.

- [ ] **Step 3: Add expiration tests for chain escalation state**

Create or update chain rows:

```text
active chain updated_at within 30 minutes => chain_context may contribute
stale chain updated_at older than 30 minutes => chain_context must not contribute
ended chain status=ended => chain_context must not contribute to new decisions
```

Use a repository helper or route test with controlled timestamps.

- [ ] **Step 4: Add status/expiresAt to evidence where it matters**

If chain/taint evidence appears in decision details, expose:

```ts
interface EvidenceItem {
  expiresAt?: string;
  status?: "active" | "expired" | "cleared";
}
```

Backend should set:

```text
status=active when evidence is usable
status=expired when persisted but ignored for freshness, if returned for audit
status=cleared when explicitly removed or chain ended, if returned for audit
```

Do not let expired evidence contribute to risk, even if it is shown for audit.

- [ ] **Step 5: Make `clearSessionState` equivalent complete for the active authority**

If TypeScript local evidence state is restored or used, `clearSessionState(sessionKey)` must clear:

```text
session state
attack graph state
artifact taint state
official update intent
```

If Go is the only active authority, add or verify a Go-side route/repository operation that expires/ends chain state cleanly.

- [ ] **Step 6: Run focused tests**

```powershell
Push-Location backend
go test ./test -run "TestDecision.*Taint|TestDecision.*Chain|TestDecision.*Expired|TestDecision.*Status" -count=1
Pop-Location
npx tsc --noEmit --pretty false
```

## Task 8: Frontend/Local Console Evidence Visibility Check

**Only do this if Task 7 changes the response payload or if the current UI hides evidence status.**

**Files:**

- Modify: `frontend/src/api/decisions.ts`
- Modify: decision detail/evidence components under `frontend/src/`
- Test: existing frontend tests near decision detail/evidence rendering.

- [ ] **Step 1: Map the current decision detail component**

Run:

```powershell
rg -n "EvidenceItem|evidence|expiresAt|status|taint|chain" frontend\src shared\src
```

- [ ] **Step 2: Render evidence TTL/status without changing enforcement**

Display:

```text
Active evidence
Expired evidence
Cleared evidence
Expires at timestamp when available
```

This is observability only. Enforcement must remain backend-owned.

- [ ] **Step 3: Run frontend checks**

Use existing package scripts. If no focused script exists:

```powershell
npm --prefix frontend run build
npm --prefix shared run build
```

## Task 9: End-To-End Verification

**Files:** no planned edits unless verification exposes a defect.

- [ ] **Step 1: Run focused Go tests**

```powershell
Push-Location backend
go test ./test -run "TestDecision.*Identity|TestDecision.*Memory|TestDecision.*System|TestDecision.*Upgrade|TestDecision.*Trusted|TestDecision.*Taint|TestDecision.*Chain|TestDecision.*Expired|TestDecision.*Status" -count=1
Pop-Location
```

- [ ] **Step 2: Run broader Go tests**

```powershell
Push-Location backend
go test ./... -count=1
Pop-Location
```

- [ ] **Step 3: Run TypeScript focused tests**

```powershell
npx vitest run test/hook-helpers.test.ts test/safety-guard.test.ts --reporter=dot
```

- [ ] **Step 4: Run TypeScript typecheck and diff hygiene**

```powershell
npx tsc --noEmit --pretty false
git diff --check
```

- [ ] **Step 5: Run dev sync preflight**

```powershell
node scripts/verify-dev-sync.mjs
```

- [ ] **Step 6: Sync into real OpenClaw runtime**

```powershell
.\scripts\sync-openclaw-dev-ready.ps1 --logs 200
```

Expected:

```text
gateway log assessment is not blocked
no world-writable startup blocker
plugin staged under /app/extensions/openclaw-lynx-guardian
```

- [ ] **Step 7: Check runtime health**

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:18789/healthz
```

Expected: HTTP 200.

- [ ] **Step 8: Prove a real OpenClaw path**

Run a safe live probe:

```powershell
docker exec openclaw-openclaw-gateway-1 sh -lc "openclaw agent --agent main --message 'reply with pong only' --json --timeout 90 2>&1"
```

Expected: normal assistant response.

- [ ] **Step 9: Inspect newest runtime decision/log evidence**

Use whichever current path is available:

```powershell
Get-Content "$env:USERPROFILE\.openclaw\lynx\hook-probe.log" -Tail 200
```

or the local decision API/SQLite query already used by the repo. Confirm:

```text
plain identity/memory reads do not produce protected-file/system-prompt deny
trusted startup reads are marked trusted or omitted from taint/chain escalation
system file writes produce deny
upgrade maintenance allow is narrow
expired chain/taint evidence is not used for escalation
evidence status/expiresAt is visible where the response/UI supports it
```

## Completion Checklist

- [ ] Current branch and dirty baseline were recorded before implementation.
- [ ] Go decision route has failing-then-passing contracts for benign reads, system-file writes, upgrade maintenance, trusted startup reads, and evidence TTL/status.
- [ ] TypeScript hook bridge passes trusted internal read and original prompt context when needed.
- [ ] TypeScript local fallback still blocks dangerous system-file writes and Lynx Guardian disable attempts if Go is unavailable.
- [ ] Plain `read IDENTITY.md` and workspace memory reads are not blocked as extraction/export.
- [ ] Mutating identity/core files and exporting memory/session records still deny.
- [ ] Startup reads of OpenClaw memory, workspace identity, and installed skill `SKILL.md` do not poison later normal project writes.
- [ ] Threat escalation evidence expires by time/status, not merely by session inactivity.
- [ ] Focused Go tests pass.
- [ ] Broader Go tests pass or any unrelated failures are documented with proof.
- [ ] Focused Vitest tests pass.
- [ ] `npx tsc --noEmit --pretty false` passes.
- [ ] `git diff --check` passes.
- [ ] `node scripts/verify-dev-sync.mjs` passes.
- [ ] `.\scripts\sync-openclaw-dev-ready.ps1 --logs 200` passes.
- [ ] Runtime health and a real OpenClaw path are verified before claiming runtime behavior changed.

## Execution Options

Plan complete. Use one of these execution modes:

1. **Subagent-Driven (recommended)** - dispatch a fresh worker per task, review between tasks, and keep fixes separated by ownership area.
2. **Inline Execution** - execute this plan in the current session with checkpoints after each task.

Recommended first task: Task 1, because it prevents us from putting a fix in Go while a later TypeScript guard still overrides it, or putting a fix in TypeScript when Go is the actual policy authority.
