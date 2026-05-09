import { describe, expect, it } from "vitest";

import { resolveToolOperation } from "../../src/utils/tool-display";

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
});
