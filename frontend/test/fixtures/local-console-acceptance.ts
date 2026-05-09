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
