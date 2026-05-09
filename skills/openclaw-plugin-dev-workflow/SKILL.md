---
name: openclaw-plugin-dev-workflow
description: Use when modifying, debugging, validating, or reviewing the openclaw-lynx-guardian plugin, especially when comparing behavior with D:\all-works\openclaw, syncing skills/hooks into OpenClaw, or deciding whether a claimed runtime change has been verified.
---

# OpenClaw Plugin Dev Workflow

Follow this workflow whenever work touches `C:\Users\24716\.openclaw\extensions\openclaw-lynx-guardian`.

## Hard Rules

- Treat `D:\all-works\openclaw` as read-only reference material for learning, tracing runtime behavior, and checking Docker-side integration details.
- Modify code only inside `C:\Users\24716\.openclaw\extensions\openclaw-lynx-guardian` unless the user explicitly changes scope.
- Do not claim plugin runtime behavior changed based only on local edits, local unit tests, or host-only inspection.
- Before claiming success for behavior that depends on OpenClaw runtime, run a real OpenClaw validation path.
- When a plan says to complete all tasks, run at least one global real OpenClaw test after all task-level checks. This must exercise the running gateway/agent path, not only the local console, Vite, unit tests, or static builds.
- When dispatching background agents/subagents for this repo, do not override or switch their model. Let them inherit the current session model unless the user explicitly asks for a different model later.
- If validating through `http://127.0.0.1:18789/v1/chat/completions`, do not assume anonymous access. Use the current local bearer token and verify the request actually succeeds.

## Chinese Text And Encoding Safety

- Treat Chinese text edits as encoding-sensitive work. Keep changed files in UTF-8 and prefer small, reviewable edits over bulk rewrites.
- For manual edits that touch Chinese or mixed-language content, use `apply_patch`-style line edits instead of PowerShell redirection, `Set-Content`, `Out-File`, or ad-hoc Node/Python one-liners that embed Chinese literals.
- Do not use shell-based bulk replacement to "repair" mojibake. In this repo that has already caused `UTF-8 -> GBK/cp936 misdecode -> saved back` corruption.
- If a file already contains mojibake, first read the exact corrupted lines, then repair it in small chunks. Do not guess-rewrite the whole file unless you have a verified clean source.
- After Chinese text changes, inspect `git diff` for the touched files and run the focused regression checks before concluding the edit is safe.
- If mojibake is found in code, comments, regexes, tests, prompts, or logs, repair it in the same task. Do not leave half-fixed fragments behind.
- Keep surrounding test names, comments, and reviewer-facing text readable. If a regression test must reference a bad fragment, isolate that fragment as negative fixture data instead of spreading mojibake through the test file.

## Entry File Structure

- Keep `index.ts` as the plugin entry and orchestration file. It should mainly contain `setup(api)`, top-level wiring, and event-hook flow.
- Move reusable helpers, parsing logic, approval routing, delivery utilities, and other function declarations into `src/runtime/` or another focused `src/` module once they are non-trivial.
- When refactoring `index.ts`, prefer extracted helper modules plus focused tests over adding more nested declarations in the entry file.

## Test File Placement

- Put tests under the owning project root's `test/` directory.
- Backend tests belong under `backend/test/`; frontend tests belong under `frontend/test/`.
- Plugin/root-level tests that exercise the extension itself can stay under the repo-root `test/` directory.
- Do not scatter new project tests under feature source folders such as `src/`, `frontend/src/`, or `backend/internal/`.
- Do not introduce a sibling `tests/` directory for new coverage; if an existing test already lives there, leave it unless the task is explicitly about test organization.
- If a language or framework appears to require colocated tests, first prefer an integration-style test under the owning project's `test/`; only make a colocated exception when there is a concrete tooling blocker, and call out that exception in the final response.

## Required Validation Path

Use this order:

1. Read local plugin code and tests as needed.
2. If files changed in this plugin repo, sync them into the real runtime. The ready wrapper builds and packages the latest shared/backend/frontend local-console outputs before staging the plugin:
   - `node scripts/verify-dev-sync.mjs`
   - `.\scripts\sync-openclaw-dev-ready.ps1 --logs 200`
3. Validate through at least one OpenClaw execution path:
   - `openclaw agent --agent main ...`
   - or an authenticated request to `http://127.0.0.1:18789/v1/chat/completions`
4. Check supporting runtime evidence such as gateway logs, synced skill files, or `/lynx-check` artifacts before concluding.
5. For full-plan execution, finish with one global real OpenClaw test after all tasks are implemented and synced.

## Local OpenAI-Compatible API

Probe with the current local auth token; keep the real token in your environment or local config, never in this repo:

```powershell
$token = $env:OPENCLAW_LOCAL_API_TOKEN
if (-not $token) {
  throw "Set OPENCLAW_LOCAL_API_TOKEN from your current local gateway config before probing."
}

$headers = @{
  Authorization = "Bearer $token"
  "Content-Type" = "application/json"
}

$body = @{
  model = "openclaw/main"
  messages = @(
    @{
      role = "user"
      content = "reply with pong only"
    }
  )
} | ConvertTo-Json -Depth 6

Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:18789/v1/chat/completions `
  -Headers $headers `
  -Body $body
```

Observed good-state facts on 2026-04-16:

- `http://127.0.0.1:18789/healthz` returned HTTP 200 with `{"ok":true,"status":"live"}`.
- `GET /v1/models` with the bearer token returned `openclaw`, `openclaw/default`, and `openclaw/main`.
- `POST /v1/chat/completions` with `model = "openclaw/main"` replied `pong` to the probe above.
- If the endpoint returns `401 Unauthorized`, treat that first as an auth-header problem, not as proof the gateway is down.

### Realistic Runtime Acceptance Prompts

Use `pong` only as a gateway health smoke test. UX acceptance must include at least one realistic non-`pong` prompt that creates or queries meaningful local-console data, for example:

- Ask the agent to inspect this plugin repo with read-only commands and summarize the actual command/result.
- Trigger a guarded approval or blocked sensitive-read flow and verify approvals, decisions, grants, and evidence pages.
- Run `/lynx-check` and verify the report body on `/webview/lynx-checks`.
- Inspect token and skill-supply-chain pages with live data.

## `/lynx-check` Special Rule

When validating `/lynx-check`, trust the newest artifact set first:

- `%USERPROFILE%\.openclaw\lynx\check-runs\*.result.json`
- matching `*.report.md`
- `%USERPROFILE%\.openclaw\lynx\hook-probe.log`
- `%USERPROFILE%\.openclaw\docker-state\agents\main\sessions\*.jsonl`

Do not treat an immediate CLI timeout as proof of failure if the newest artifact says the run completed.

## Runtime State Reset For Dirty Historical Data

If old local-console SQLite/session data is dirty enough to obscure the current fix, it is acceptable to archive the old state before runtime acceptance. Use the repo script, and treat it as test-environment cleanup rather than a product fix:

```powershell
.\scripts\reset-openclaw-state-soft.ps1 -DryRun
.\scripts\reset-openclaw-state-soft.ps1
```

Important rules:

- The script performs a soft reset by archiving `lynx.db*` and non-kept session files under `%USERPROFILE%\.openclaw\archives\soft-reset-*`; it should not be described as a destructive delete.
- Run `-DryRun` first when the current state may matter.
- Use `-SkipDatabaseReset`, `-DropCronSessions`, or `-KeepExtraSessions <n>` only when the task explicitly needs that narrower behavior.
- After any reset, regenerate data with realistic non-`pong` OpenClaw scenarios before claiming UX/data correctness.
- Do not use old dirty data as an excuse to skip fixing the current ingestion/query/display path; prove new records are clean after reset.

## Claiming Completion

You may say the plugin workflow change is complete only after:

- the repo-local skill and repo instructions are updated
- the plugin sync completes successfully
- the OpenClaw runtime is reachable
- the synced skill or behavior is visible in the runtime location you validated
- full-plan work has one final global real OpenClaw test that ran after all task-level implementation and verification

If any of those are missing, report exactly what was changed and what still lacks real OpenClaw verification.

## Encoding Completion Check

When the task touches Chinese text, add these checks before closing:

1. Confirm the changed file diff shows readable Chinese instead of mojibake.
2. Run the repo's focused regression test for mojibake coverage.
3. If code files changed, run `npx tsc --noEmit`.
4. State clearly whether runtime sync and real OpenClaw validation were or were not performed.
