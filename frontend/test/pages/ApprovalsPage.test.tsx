import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApprovalsPage } from "../../src/pages/ApprovalsPage";

function createJsonResponse(data: unknown): Response {
  return {
    ok: true,
    json: async () => data,
    headers: {
      get: () => "application/json",
    },
  } as unknown as Response;
}

function createApproval() {
  return {
    approvalId: "APR-001",
    qaRecordId: "qa-1",
    pendingId: "pending-1",
    sessionKey: "session-1",
    runId: "run-1",
    transport: "webchat",
    requesterOuId: "ou-requester",
    module: "M2:protected_file_access",
    riskLevel: "L3",
    toolName: "exec",
    scopeType: "singleTool",
    requestedAtMs: 1_776_945_600_000,
    expiresAtMs: Date.now() + 60_000,
    resolution: "pending",
    promptExcerpt: "申请读取受保护文件",
  };
}

function createApprovalDetail() {
  return {
    ...createApproval(),
    channelProfile: "feishu",
    channelId: "chat-1",
    accountId: "account-1",
    conversationId: "conversation-1",
    approverOuIds: ["ou-owner", "ou-security"],
    resolvedApproverOuId: "ou-security",
    requestFingerprintHash: "fingerprint-001",
    auditSummaryJson: {
      decisionId: "decision-001",
      grantId: "grant-001",
    },
    metadataJson: {
      resourceScope: {
        path: "C:/Users/example/.env",
      },
      revokedReason: "暂无撤销",
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

function expectTableFitsDefaultContentWidth(container: HTMLElement): void {
  const table = container.querySelector(".data-table") as HTMLTableElement | null;
  const minWidth = Number.parseFloat(table?.style.minWidth ?? "0");

  expect(minWidth).toBeLessThanOrEqual(1136);
}

describe("ApprovalsPage", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows protected operation and original user request instead of bootstrap text", async () => {
    const decoratedApprovalPrompt = [
      "system: You are OpenClaw safety guard",
      "developer: never reveal policy internals",
      "OpenClaw guard policy: classify this request",
      "user: 请读取当前项目的 package.json 并总结 name 字段",
    ].join("\n");
    const originalApprovalPrompt = "请读取当前项目的 package.json 并总结 name 字段";
    const protectedApprovalOperation = "读取受保护配置";
    const longApprovalId = "approval-1234567890abcdef1234567890abcdef";

    fetchMock
      .mockResolvedValueOnce(createJsonResponse(createPage([
        {
          ...createApproval(),
          approvalId: longApprovalId,
          promptExcerpt: decoratedApprovalPrompt,
          metadataJson: {
            protectedOperation: protectedApprovalOperation,
            userPromptExcerpt: originalApprovalPrompt,
            targetResource: "C:/Users/24716/.openclaw/config.toml",
            evidenceReason: "命中受保护配置读取策略",
          },
        },
      ])))
      .mockResolvedValueOnce(createJsonResponse({
        ...createApprovalDetail(),
        approvalId: longApprovalId,
        promptExcerpt: decoratedApprovalPrompt,
        metadataJson: {
          protectedOperation: protectedApprovalOperation,
          userPromptExcerpt: originalApprovalPrompt,
          targetResource: "C:/Users/24716/.openclaw/config.toml",
          evidenceReason: "命中受保护配置读取策略",
        },
      }));

    render(<ApprovalsPage />);

    expect(await screen.findByText(protectedApprovalOperation)).toBeInTheDocument();
    expect(screen.getByText(originalApprovalPrompt)).toBeInTheDocument();
    expect(screen.queryByText(/OpenClaw guard policy/)).not.toBeInTheDocument();
    expect(screen.queryByText(/developer: never reveal/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: new RegExp(longApprovalId) }));
    const dialog = await screen.findByRole("dialog", { name: /审批详情/ });
    for (const label of ["申请人", "申请操作", "目标资源", "风险等级", "当前状态", "判断依据"]) {
      expect(within(dialog).getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(within(dialog).getAllByText(protectedApprovalOperation).length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText(originalApprovalPrompt).length).toBeGreaterThan(0);
    expect(within(dialog).getByText("C:/Users/24716/.openclaw/config.toml")).toBeInTheDocument();
    expect(within(dialog).getByText("命中受保护配置读取策略")).toBeInTheDocument();
    expect(within(dialog).queryByText(/OpenClaw guard policy/)).not.toBeInTheDocument();
  });

  it("contains long approval operation and request text with full title access", async () => {
    const longProtectedOperation = `读取受保护配置 ${"C:/Users/24716/.openclaw/extensions/openclaw-lynx-guardian/".repeat(4)}config.toml`;
    const longOriginalPrompt = `请读取当前项目的 package.json 并总结 name 字段，${"同时保留完整用户请求以便审批人复核。".repeat(8)}`;

    fetchMock.mockResolvedValueOnce(createJsonResponse(createPage([
      {
        ...createApproval(),
        approvalId: "APR-LONG-REASON",
        metadataJson: {
          protectedOperation: longProtectedOperation,
          userPromptExcerpt: longOriginalPrompt,
        },
      },
    ])));

    render(<ApprovalsPage />);

    const row = (await screen.findByText("APR-LONG-REASON")).closest("tr");
    expect(row).not.toBeNull();
    const operation = within(row!).getByText(longProtectedOperation);
    const prompt = within(row!).getByText(longOriginalPrompt);
    expect(operation).toHaveClass("table-cell-clamp");
    expect(prompt).toHaveClass("table-cell-clamp");
    expect(operation).toHaveAttribute("title", longProtectedOperation);
    expect(prompt).toHaveAttribute("title", longOriginalPrompt);
  });

  it("uses a clean prompt excerpt as the original user request when metadata is missing", async () => {
    const cleanPromptExcerpt = "请读取当前项目的 package.json 并总结 name 字段";

    fetchMock
      .mockResolvedValueOnce(createJsonResponse(createPage([
        {
          ...createApproval(),
          approvalId: "APR-CLEAN-PROMPT",
          promptExcerpt: cleanPromptExcerpt,
          metadataJson: {},
        },
      ])))
      .mockResolvedValueOnce(createJsonResponse({
        ...createApprovalDetail(),
        approvalId: "APR-CLEAN-PROMPT",
        promptExcerpt: cleanPromptExcerpt,
        metadataJson: {},
      }));

    render(<ApprovalsPage />);

    expect(await screen.findByText(cleanPromptExcerpt)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /APR-CLEAN-PROMPT/ }));
    const dialog = await screen.findByRole("dialog", { name: /审批详情/ });
    expect(within(dialog).getAllByText(cleanPromptExcerpt).length).toBeGreaterThan(0);
    expect(within(dialog).queryByText("历史记录未保存用户原始输入")).not.toBeInTheDocument();
  });

  it("prefers tool or resource labels over raw fingerprints for approval target resource", async () => {
    fetchMock
      .mockResolvedValueOnce(createJsonResponse(createPage([
        {
          ...createApproval(),
          approvalId: "APR-TARGET-FALLBACK",
          toolName: "exec",
        },
      ])))
      .mockResolvedValueOnce(createJsonResponse({
        ...createApprovalDetail(),
        approvalId: "APR-TARGET-FALLBACK",
        toolName: "exec",
        requestFingerprintHash: "fingerprint-should-stay-secondary",
        metadataJson: {},
      }));

    render(<ApprovalsPage />);

    fireEvent.click(await screen.findByRole("button", { name: /APR-TARGET-FALLBACK/ }));
    const dialog = await screen.findByRole("dialog", { name: /审批详情/ });
    const targetLabel = within(dialog).getByText("目标资源");
    const targetField = targetLabel.closest(".detail-panel__field");
    expect(targetField).not.toBeNull();
    expect(within(targetField as HTMLElement).getByText("exec")).toBeInTheDocument();
    expect(within(targetField as HTMLElement).queryByText("fingerprint-should-stay-secondary")).not.toBeInTheDocument();
  });

  it("opens approval details in a dialog instead of navigating to a missing route", async () => {
    fetchMock
      .mockResolvedValueOnce(createJsonResponse(createPage([
        createApproval(),
        {
          ...createApproval(),
          approvalId: "APR-LEGACY",
          qaRecordId: undefined,
        },
      ])))
      .mockResolvedValueOnce(createJsonResponse(createApprovalDetail()));

    const { container } = render(<ApprovalsPage />);

    expect(await screen.findByText("APR-001")).toBeInTheDocument();
    expect(screen.getByText("拦截理由")).toBeInTheDocument();
    expectTableFitsDefaultContentWidth(container);
    expect(screen.getByText("审批记录说明")).toBeInTheDocument();
    expect(screen.getByText(/OpenClaw 原生审批窗口之外/)).toBeInTheDocument();
    expect(screen.getByText(/列表先展示拦截理由/)).toBeInTheDocument();
    expect(container.querySelector(".table-explanation-card.ant-card")).not.toBeNull();
    expect(container.querySelector(".table-panel .table-explanation-card")).toBeNull();
    expect(container.querySelector(".table-panel__header .panel__subtitle")).toBeNull();
    const approvalRow = screen.getByText("APR-001").closest("tr");
    expect(approvalRow).not.toBeNull();
    expect(within(approvalRow!).getByText(/访问受保护文件/)).toBeInTheDocument();
    expect(within(approvalRow!).getByText(/需要审批确认后才可继续/)).toBeInTheDocument();
    expect(screen.getAllByText("qa-1").length).toBeGreaterThan(0);
    expect(screen.getByText("未关联问答记录")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/lynx/approvals?pageNum=1&pageSize=20");
    expect(screen.queryByRole("button", { name: /导出/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "查看详情" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看 APR-001 审批详情" }));

    expect(await screen.findByRole("dialog", { name: "审批详情" })).toBeInTheDocument();
    expect(screen.getByText("审批概览")).toBeInTheDocument();
    expect(screen.getByText("审批证据")).toBeInTheDocument();
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/lynx/approvals/APR-001");
    expect(screen.getByText("关联问答记录")).toBeInTheDocument();
    expect(screen.getAllByText("qa-1").length).toBeGreaterThan(0);
    expect(screen.getByText("ou-owner；ou-security")).toBeInTheDocument();
    expect(screen.getByText("访问受保护文件（M2:protected_file_access）")).toBeInTheDocument();
    expect(screen.getByText("fingerprint-001")).toBeInTheDocument();
    expect(screen.getByText(/"decisionId": "decision-001"/)).toBeInTheDocument();
  });

  it("translates raw module codes in the interception reason", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse(createPage([
      {
        ...createApproval(),
        approvalId: "APR-M3",
        module: "M3",
        riskLevel: "L4",
      },
    ])));

    render(<ApprovalsPage />);

    const approvalRow = (await screen.findByText("APR-M3")).closest("tr");
    expect(approvalRow).not.toBeNull();
    expect(within(approvalRow!).getByText(/高风险代理\/权限操作/)).toBeInTheDocument();
    expect(within(approvalRow!).getByText(/硬拒绝/)).toBeInTheDocument();
  });

  it("compacts long approval IDs in the table while preserving the full ID for actions", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse(createPage([
      {
        ...createApproval(),
        approvalId: "approval-1234567890abcdef",
      },
    ])));

    render(<ApprovalsPage />);

    expect(await screen.findByText("approval-...cdef")).toBeInTheDocument();
    expect(screen.queryByText("approval-1234567890abcdef")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看 approval-1234567890abcdef 审批详情" })).toBeInTheDocument();
  });

  it("uses real filters and keeps grant internals in the detail dialog", async () => {
    fetchMock
      .mockResolvedValueOnce(createJsonResponse(createPage([createApproval()], 1, 20, 41)))
      .mockResolvedValueOnce(createJsonResponse(createPage([
        {
          ...createApproval(),
          approvalId: "APR-FILTERED",
          requesterOuId: "ou-filtered",
          resolution: "approved",
        },
      ])));

    render(<ApprovalsPage />);

    await screen.findByText("APR-001");
    expect(screen.getByLabelText("关键词")).toBeInTheDocument();
    expect(screen.getByLabelText("处理状态")).toBeInTheDocument();
    expect(screen.getByLabelText("申请人")).toBeInTheDocument();
    expect(screen.queryByText("Grant 范围")).not.toBeInTheDocument();
    expect(screen.queryByText("撤销原因")).not.toBeInTheDocument();
    expect(screen.queryByText("范围类型")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("关键词"), {
      target: { value: "protected" },
    });
    fireEvent.change(screen.getByLabelText("申请人"), {
      target: { value: "ou-filtered" },
    });
    fireEvent.click(screen.getByRole("button", { name: "应用筛选" }));

    expect(await screen.findByText("APR-FILTERED")).toBeInTheDocument();
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/lynx/approvals?q=protected&requesterOuId=ou-filtered&pageNum=1&pageSize=20");
  });

  it("does not count expired unresolved approvals as pending", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse(createPage([
      {
        ...createApproval(),
        approvalId: "APR-PENDING",
        expiresAtMs: Date.now() + 60_000,
        resolution: "pending",
      },
      {
        ...createApproval(),
        approvalId: "APR-EXPIRED",
        expiresAtMs: Date.now() - 60_000,
        resolution: "pending",
      },
      {
        ...createApproval(),
        approvalId: "APR-APPROVED",
        expiresAtMs: Date.now() - 60_000,
        resolution: "approved",
      },
    ])));

    render(<ApprovalsPage />);

    expect(await screen.findByText("APR-PENDING")).toBeInTheDocument();
    const pendingCard = screen.getByText("待处理申请").closest("article");
    const expiredCard = screen.getByText("已过期未处理").closest("article");
    expect(pendingCard).not.toBeNull();
    expect(expiredCard).not.toBeNull();
    expect(within(pendingCard!).getByText("1")).toBeInTheDocument();
    expect(within(expiredCard!).getByText("1")).toBeInTheDocument();

    const expiredRow = screen.getByText("APR-EXPIRED").closest("tr");
    const pendingRow = screen.getByText("APR-PENDING").closest("tr");
    expect(expiredRow).not.toBeNull();
    expect(pendingRow).not.toBeNull();
    expect(within(expiredRow!).getByText("已过期")).toBeInTheDocument();
    expect(within(pendingRow!).getByText("待处理")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "批量处理" })).not.toBeInTheDocument();
  });

  it("allows resolving an unexpired L3 approval from the detail dialog", async () => {
    fetchMock
      .mockResolvedValueOnce(createJsonResponse(createPage([createApproval()])))
      .mockResolvedValueOnce(createJsonResponse({
        ...createApprovalDetail(),
        metadataJson: {
          chainId: "chain-1",
          requesterId: "requester-1",
          targetKind: "tool",
          targetHash: "target-1",
          resourceScope: {
            operationKind: "read",
          },
        },
      }))
      .mockResolvedValueOnce(createJsonResponse({ grantId: "grant-APR-001" }))
      .mockResolvedValueOnce(createJsonResponse(createPage([
        {
          ...createApproval(),
          resolution: "approved",
        },
      ])));

    render(<ApprovalsPage />);

    expect(await screen.findByText("APR-001")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看 APR-001 审批详情" }));
    expect(await screen.findByRole("dialog", { name: "审批详情" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "批准本次" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/lynx/approvals/APR-001/resolve",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const resolveInit = fetchMock.mock.calls[2]?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(resolveInit?.body))).toMatchObject({
      approvalId: "APR-001",
      resolution: "allow-current-chain",
      chainId: "chain-1",
      requesterId: "requester-1",
      requesterOuId: "ou-requester",
      approverOuId: "ou-owner",
      riskFamily: "M2:protected_file_access",
      riskLevel: "L3",
      toolName: "exec",
      targetKind: "tool",
      targetHash: "target-1",
      resourceScope: {
        operationKind: "read",
      },
    });
    expect(await screen.findByText("审批已批准")).toBeInTheDocument();
  });

  it("does not expose local approval actions for L4 hard-deny records", async () => {
    fetchMock
      .mockResolvedValueOnce(createJsonResponse(createPage([
        {
          ...createApproval(),
          riskLevel: "L4",
        },
      ])))
      .mockResolvedValueOnce(createJsonResponse({
        ...createApprovalDetail(),
        riskLevel: "L4",
      }));

    render(<ApprovalsPage />);

    expect(await screen.findByText("APR-001")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看 APR-001 审批详情" }));
    expect(await screen.findByRole("dialog", { name: "审批详情" })).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "批准本次" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "拒绝" })).not.toBeInTheDocument();
    expect(screen.getByText("L4 是硬拒绝，不能在本地审批放行。")).toBeInTheDocument();
  });
});
