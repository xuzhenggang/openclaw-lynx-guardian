import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToolCallsPage } from "../../src/pages/ToolCallsPage";

function createJsonResponse(data: unknown): Response {
  return {
    ok: true,
    json: async () => data,
    headers: {
      get: () => "application/json",
    },
  } as unknown as Response;
}

function createToolCall() {
  return {
    toolCallId: "TOOL-001",
    qaRecordId: "qa-1",
    sessionKey: "session-1",
    runId: "run-1",
    approvalId: "APR-001",
    toolName: "exec",
    riskLevel: "L3",
    riskScore: 72,
    policyDecision: "confirm",
    enforcementAction: "requireApproval",
    startedAtMs: 1_776_945_600_000,
    finishedAtMs: 1_776_945_601_500,
    durationMs: 1500,
    metadataJson: {
      command: "powershell Get-Content secret.txt",
      cwd: "C:/repo",
    },
    paramSummary: "powershell Get-Content secret.txt",
    resultStatus: "blocked",
    resultExcerpt: "命令被拦截",
  };
}

function createToolCallDetail() {
  return {
    ...createToolCall(),
    paramSummary: "powershell Get-Content secret.txt",
    paramHash: "param-hash-001",
    triggeredModules: ["M2:protected_file_access"],
    errorText: "policy denied",
    metadataJson: {
      command: "powershell Get-Content secret.txt",
      cwd: "C:/repo",
      decisionId: "decision-001",
      grantId: "grant-001",
      taintSummary: "secret-read",
      scriptPreflight: {
        policyVersion: 9,
        evidence: [
          {
            evidenceId: "script-1",
            scriptPath: "bad.py",
            findings: [
              {
                ruleId: "script.credential_external_exfiltration",
                behavior: "exfiltrates credentials",
              },
            ],
          },
        ],
      },
    },
  };
}

function createPage(items: unknown[], pageNum = 1, pageSize = 20, total = items.length) {
  return {
    items,
    total,
    pageNum,
    pageSize,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

async function chooseSelectOptions(name: string, optionTexts: string[]) {
  for (const optionText of optionTexts) {
    fireEvent.mouseDown(screen.getByRole("combobox", { name }));
    const matches = await screen.findAllByText(optionText);
    fireEvent.click(matches.at(-1)!);
  }
}

describe("ToolCallsPage", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("opens tool call JSON details in a dialog instead of navigating to a missing route", async () => {
    fetchMock
      .mockResolvedValueOnce(createJsonResponse(createPage([
        createToolCall(),
        {
          ...createToolCall(),
          toolCallId: "TOOL-LEGACY",
          qaRecordId: undefined,
        },
      ])))
      .mockResolvedValueOnce(createJsonResponse(createToolCallDetail()));

    render(<ToolCallsPage />);

    expect(await screen.findByText("TOOL-001")).toBeInTheDocument();
    expect(screen.getAllByText("qa-1").length).toBeGreaterThan(0);
    expect(screen.getByText("未关联问答记录")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/lynx/tool-calls?pageNum=1&pageSize=20");
    expect(screen.queryByRole("link", { name: "查看 JSON" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "命令 / 操作" })).toBeInTheDocument();
    expect(screen.getAllByText("powershell Get-Content secret.txt").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "查看 TOOL-001 工具调用详情" }));

    expect(await screen.findByRole("dialog", { name: "工具调用详情" })).toBeInTheDocument();
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/lynx/tool-calls/TOOL-001");
    expect(screen.getByText("工具调用概览")).toBeInTheDocument();
    expect(screen.getByText("调用上下文")).toBeInTheDocument();
    expect(screen.getByText("参数与结果")).toBeInTheDocument();
    expect(screen.getByText("控制面证据")).toBeInTheDocument();
    expect(screen.getByText("关联问答记录")).toBeInTheDocument();
    expect(screen.getAllByText("qa-1").length).toBeGreaterThan(0);
    expect(screen.getByText("执行命令")).toBeInTheDocument();
    expect(screen.getAllByText("powershell Get-Content secret.txt").length).toBeGreaterThan(0);
    expect(screen.getByText("工作目录")).toBeInTheDocument();
    expect(screen.getByText("C:/repo")).toBeInTheDocument();
    expect(screen.getByText("M2:protected_file_access")).toBeInTheDocument();
    expect(screen.getByText("脚本预检证据")).toBeInTheDocument();
    expect(screen.getByText(/script\.credential_external_exfiltration/)).toBeInTheDocument();
    expect(screen.getByText(/"decisionId": "decision-001"/)).toBeInTheDocument();
  });

  it("uses real filters and keeps control-plane metadata out of the table columns", async () => {
    fetchMock
      .mockResolvedValueOnce(createJsonResponse(createPage([createToolCall()], 1, 20, 41)))
      .mockResolvedValueOnce(createJsonResponse(createPage([
        {
          ...createToolCall(),
          toolCallId: "TOOL-FILTERED",
          toolName: "read_file",
          resultStatus: "success",
        },
      ])));

    render(<ToolCallsPage />);

    await screen.findByText("TOOL-001");
    expect(screen.getByLabelText("关键词")).toBeInTheDocument();
    expect(screen.getByLabelText("工具名称")).toBeInTheDocument();
    expect(screen.getByLabelText("状态")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "命令 / 操作" })).toBeInTheDocument();
    expect(screen.queryByText("决策 / Grant")).not.toBeInTheDocument();
    expect(screen.queryByText("Taint / 外传")).not.toBeInTheDocument();
    expect(screen.queryByText("参数摘要")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("关键词"), {
      target: { value: "blocked" },
    });
    fireEvent.change(screen.getByLabelText("工具名称"), {
      target: { value: "read_file" },
    });
    await chooseSelectOptions("状态", ["成功", "已阻断"]);
    fireEvent.click(screen.getByRole("button", { name: "应用筛选" }));

    expect(await screen.findByText("TOOL-FILTERED")).toBeInTheDocument();
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/lynx/tool-calls?q=blocked&toolName=read_file&resultStatus=success&resultStatus=blocked&pageNum=1&pageSize=20");
  });
});
