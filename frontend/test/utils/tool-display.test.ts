import { describe, expect, it } from "vitest";

import {
  resolveToolOperation,
  resolveToolResultSummary,
} from "../../src/utils/tool-display";

function createToolCallWithResult() {
  return {
    toolCallId: "tool-real-command",
    toolName: "exec",
    metadataJson: {
      command: "Get-Content package.json",
      cwd: "C:/repo",
      args: ["Get-Content", "package.json"],
    },
    paramSummary: "Get-Content package.json",
    resultExcerpt: "name=@shouxuai/openclaw-lynx-guardian",
  };
}

function createLegacyToolCallMissingResult() {
  return {
    toolCallId: "tool-legacy-no-result",
    toolName: "exec",
    metadataJson: {},
  };
}

describe("resolveToolOperation", () => {
  it("uses stored command metadata when available", () => {
    expect(resolveToolOperation({
      toolName: "exec",
      metadataJson: {
        command: "npm test",
        cwd: "C:/repo",
        args: ["--", "watch"],
      },
      paramSummary: "command=npm test",
    })).toEqual({
      args: ["--", "watch"],
      command: "npm test",
      cwd: "C:/repo",
      hasStoredCommandDetail: true,
      operationLabel: "npm test",
    });
  });

  it("falls back to a parameter summary without fabricating a command", () => {
    expect(resolveToolOperation({
      toolName: "read_file",
      paramSummary: "path=src/index.ts",
    })).toMatchObject({
      command: undefined,
      hasStoredCommandDetail: false,
      operationLabel: "path=src/index.ts",
    });
  });

  it("uses a clear missing-data label when historical records have no operation detail", () => {
    expect(resolveToolOperation({ toolName: "exec" })).toMatchObject({
      command: undefined,
      hasStoredCommandDetail: false,
      operationLabel: "历史记录未保存具体命令",
    });
  });

  it("builds a human hero summary from tool name and command", () => {
    expect(resolveToolOperation(createToolCallWithResult()).operationLabel)
      .toBe("Get-Content package.json");
  });
});

describe("resolveToolResultSummary", () => {
  it("uses a stored result summary when available", () => {
    expect(resolveToolResultSummary(createToolCallWithResult()))
      .toBe("name=@shouxuai/openclaw-lynx-guardian");
  });

  it("uses a durable legacy message when result summary was never stored", () => {
    expect(resolveToolResultSummary(createLegacyToolCallMissingResult()))
      .toBe("历史记录未保存结果摘要");
  });
});
