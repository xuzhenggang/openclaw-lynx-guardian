import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GrantsPage } from "../../src/pages/GrantsPage";

function createJsonResponse(data: unknown): Response {
  return {
    ok: true,
    json: async () => data,
    headers: {
      get: () => "application/json",
    },
  } as unknown as Response;
}

function createErrorResponse(message = "detail failed"): Response {
  return {
    ok: false,
    status: 500,
    statusText: "Internal Server Error",
    json: async () => ({ message }),
    headers: {
      get: () => "application/json",
    },
  } as unknown as Response;
}

function createGrant(grantId = "grant-1") {
  return {
    grantId,
    approvalId: "APR-001",
    chainId: "chain-1",
    sessionKey: "session-1",
    channelProfile: "webchat",
    channelId: "channel-1",
    conversationId: "conversation-1",
    requesterId: "requester-1",
    requesterOuId: "ou-requester",
    approverId: "approver-1",
    approverOuId: "ou-approver",
    riskFamily: "protected_file_access",
    toolName: "exec",
    targetKind: "file",
    targetHash: "hash-1",
    resourceScope: {
      path: "C:/Users/example/.env",
    },
    createdAt: "2026-04-29T10:00:00Z",
    expiresAt: "2026-04-29T11:00:00Z",
    revokedReason: "manual revoke",
  };
}

function createGrantWithExecutionDetails(grantId = "grant-detail") {
  return {
    ...createGrant(grantId),
    resourceScope: {
      approvedRiskLevel: "L3",
      grantWindowMs: 300000,
      scopeType: "current_chain",
      targetSummary: "C:/Users/example/project/package.json",
      targetHash: "sha256:" + "a".repeat(96),
    },
    executionChain: {
      grantId,
      approvalId: "APR-001",
      chainId: "chain-1",
      sessionKey: "session-1",
      explanation: "same approval and session",
    },
    relatedToolCalls: [
      {
        toolCallId: "tool-call-get-content",
        toolName: "exec",
        paramSummary: "Get-Content package.json",
        resultStatus: "completed",
        resultExcerpt: "name=@shouxuai/openclaw-lynx-guardian",
        metadataJson: {
          command: "Get-Content package.json",
        },
      },
      {
        toolCallId: "tool-call-npm-test",
        toolName: "exec",
        paramSummary: "npm test",
        resultStatus: "completed",
        resultExcerpt: "3 tests passed",
        metadataJson: {
          command: "npm test",
        },
      },
    ],
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

function deferredResponse<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function findGrantDetailButton(grantId = "grant-detail") {
  return screen.findByRole("button", { name: `查看 ${grantId} 放行详情` }, { timeout: 5000 });
}

describe("GrantsPage", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("uses filters, pagination and renders grant details with the audit dialog structure", async () => {
    fetchMock
      .mockResolvedValueOnce(createJsonResponse(createPage([createGrant()], 1, 20, 41)))
      .mockResolvedValueOnce(createJsonResponse(createGrant()))
      .mockResolvedValueOnce(createJsonResponse(createPage([createGrant("grant-page-2")], 2, 20, 41)))
      .mockResolvedValueOnce(
        createJsonResponse(createPage([createGrant("grant-filtered")], 1, 20, 1)),
      );

    const { container } = render(<GrantsPage />);

    expect(
      await screen.findByRole("heading", { name: "放行记录" }),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/lynx/grants?pageNum=1&pageSize=20");
    await screen.findByText("grant-1");
    expect(screen.getByTitle("2")).toBeInTheDocument();
    expect(screen.queryByText("链路授权")).not.toBeInTheDocument();
    expect(screen.queryByText("临时放行")).not.toBeInTheDocument();
    expect(screen.getByLabelText("关键词")).toBeInTheDocument();
    expect(screen.getByLabelText("申请人")).toBeInTheDocument();
    expect(screen.queryByText("Grant ID")).not.toBeInTheDocument();
    expect(screen.queryByText("放行范围")).not.toBeInTheDocument();
    expect(screen.queryByText("撤销原因")).not.toBeInTheDocument();
    expect(container.querySelector(".page-header__description")).toBeNull();
    expect(container.querySelector(".table-panel__header .panel__subtitle")).toBeNull();
    expect(screen.getByText("放行记录说明")).toBeInTheDocument();
    expect(screen.getByText(/审批通过后，后续同一链路里的 tool 调用如果命中已授权范围/)).toBeInTheDocument();
    expect(container.querySelector(".table-explanation-card.ant-card")).not.toBeNull();
    expect(container.querySelector(".table-panel .table-explanation-card")).toBeNull();
    expect(Number.parseInt(container.querySelector("table")?.style.minWidth ?? "0", 10)).toBeLessThanOrEqual(1136);

    fireEvent.click(
      screen.getByRole("button", { name: "查看 grant-1 放行详情" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "放行详情" }),
    ).toBeInTheDocument();
    expect(screen.getByText("放行概览")).toBeInTheDocument();
    expect(screen.getByText("授权上下文")).toBeInTheDocument();
    expect(screen.getByText("关联执行链路")).toBeInTheDocument();
    expect(screen.getByText("放行范围")).toBeInTheDocument();
    expect(screen.getByText("路径")).toBeInTheDocument();
    expect(screen.getByText("C:/Users/example/.env")).toBeInTheDocument();
    expect(screen.getByText("manual revoke")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "关闭详情" }));
    fireEvent.click(screen.getByTitle("2"));

    await screen.findByText("grant-page-2");
    expect(fetchMock.mock.calls[2]?.[0]).toBe("/lynx/grants?pageNum=2&pageSize=20");

    fireEvent.change(screen.getByLabelText("关键词"), {
      target: { value: "filtered" },
    });
    fireEvent.change(screen.getByLabelText("申请人"), {
      target: { value: "ou-requester" },
    });
    fireEvent.click(screen.getByRole("button", { name: "应用筛选" }));

    await screen.findByText("grant-filtered");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      "/lynx/grants?q=filtered&requesterId=ou-requester&pageNum=1&pageSize=20",
    );
  });

  it("compacts long grant and approval IDs in the table", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse(createPage([
      {
        ...createGrant("grant-1234567890abcdef"),
        approvalId: "approval-1234567890abcdef",
      },
    ])));

    render(<GrantsPage />);

    expect(await screen.findByText("grant-123...cdef")).toBeInTheDocument();
    expect(screen.getByText("approval-...cdef")).toBeInTheDocument();
    expect(screen.queryByText("grant-1234567890abcdef")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看 grant-1234567890abcdef 放行详情" })).toBeInTheDocument();
  });

  it("shows an uncluttered empty table state for grant records", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ items: [] }));

    const { container } = render(<GrantsPage />);

    expect(
      await screen.findByRole("heading", { name: "放行记录" }),
    ).toBeInTheDocument();
    expect(screen.getByText("审批后的工具放行流水")).toBeInTheDocument();
    expect(container.querySelector(".metric-grid--narrow")).toBeInTheDocument();
    expect((await screen.findAllByText("暂无放行记录")).length).toBeGreaterThan(0);
    expect(screen.getByText("放行记录说明")).toBeInTheDocument();
    expect(screen.getByText(/审批通过后，后续同一链路里的 tool 调用如果命中已授权范围/)).toBeInTheDocument();
    expect(screen.getByText(/换成 exec、换路径或链路结束就不会复用/)).toBeInTheDocument();
    expect(container.querySelector(".table-explanation-card.ant-card")).not.toBeNull();
    expect(container.querySelector(".table-panel .table-explanation-card")).toBeNull();
    expect(screen.getByRole("columnheader", { name: "放行" })).toBeInTheDocument();
    expect(container.querySelector(".page-header__description")).toBeNull();
    expect(container.querySelector(".empty-explanation")).toBeNull();
    expect(container.querySelector(".table-wrap")).not.toBeNull();
  });

  it("renders a related execution chain and one readable card per related tool call", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse(createPage([
      createGrantWithExecutionDetails(),
    ])));

    render(<GrantsPage />);

    fireEvent.click(await findGrantDetailButton());

    expect(await screen.findByRole("heading", { name: "关联执行链路" })).toBeInTheDocument();
    expect(screen.getByText("Get-Content package.json")).toBeInTheDocument();
    expect(screen.getByText("npm test")).toBeInTheDocument();
    expect(screen.getAllByTestId("grant-related-tool-card")).toHaveLength(2);
    expect(screen.getByText("name=@shouxuai/openclaw-lynx-guardian")).toBeInTheDocument();
    expect(screen.getByText("3 tests passed")).toBeInTheDocument();
  });

  it("loads grant detail data before rendering related execution cards when the list row is not enriched", async () => {
    fetchMock
      .mockResolvedValueOnce(createJsonResponse(createPage([createGrant("grant-detail")])))
      .mockResolvedValueOnce(createJsonResponse(createGrantWithExecutionDetails()));

    render(<GrantsPage />);

    fireEvent.click(await findGrantDetailButton());

    expect(await screen.findByText("Get-Content package.json")).toBeInTheDocument();
    expect(screen.getAllByTestId("grant-related-tool-card")).toHaveLength(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/lynx/grants/grant-detail");
  });

  it("translates grant scope internals into readable Chinese labels", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse(createPage([
      createGrantWithExecutionDetails(),
    ])));

    render(<GrantsPage />);

    fireEvent.click(await findGrantDetailButton());

    expect(await screen.findByText("授权风险等级")).toBeInTheDocument();
    expect(screen.getByText("有效窗口")).toBeInTheDocument();
    expect(screen.getByText("授权范围")).toBeInTheDocument();
    expect(screen.getByText("目标摘要")).toBeInTheDocument();
    expect(screen.queryByText("approvedRiskLevel")).not.toBeInTheDocument();
    expect(screen.queryByText("grantWindowMs")).not.toBeInTheDocument();
    expect(screen.queryByText("scopeType")).not.toBeInTheDocument();
    expect(screen.queryByText("targetSummary")).not.toBeInTheDocument();
  });

  it("uses readable labels for common and unknown grant scope keys", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse(createPage([
      {
        ...createGrantWithExecutionDetails(),
        resourceScope: {
          targetKind: "file",
          decision: "allow",
          rawInternalDecisionReasonKey: "policy override",
        },
      },
    ])));

    render(<GrantsPage />);

    fireEvent.click(await findGrantDetailButton());

    expect((await screen.findAllByText("目标类型")).length).toBeGreaterThan(0);
    expect(screen.getByText("决策结果")).toBeInTheDocument();
    expect(screen.getByText("其他范围条件")).toBeInTheDocument();
    expect(screen.queryByText("targetKind")).not.toBeInTheDocument();
    expect(screen.queryByText("decision")).not.toBeInTheDocument();
    expect(screen.queryByText("rawInternalDecisionReasonKey")).not.toBeInTheDocument();
  });

  it("contains long grant scope and tool values while exposing the full text", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse(createPage([
      createGrantWithExecutionDetails(),
    ])));

    const { container } = render(<GrantsPage />);

    fireEvent.click(await findGrantDetailButton());

    const longHash = "sha256:" + "a".repeat(96);
    expect(await screen.findByTitle(longHash)).toHaveClass("grant-scope-value");
    expect(screen.getByTitle("Get-Content package.json")).toBeInTheDocument();
    expect(container.querySelector(".grant-related-tool-card__command")).not.toBeNull();
  });

  it("shows a detail loading failure instead of a false empty related-tool state", async () => {
    fetchMock
      .mockResolvedValueOnce(createJsonResponse(createPage([createGrant("grant-detail")])))
      .mockResolvedValueOnce(createErrorResponse("grant detail unavailable"));

    render(<GrantsPage />);

    fireEvent.click(await findGrantDetailButton());

    expect(await screen.findByText(/详情加载失败/)).toBeInTheDocument();
    expect(screen.getByText(/grant detail unavailable/)).toBeInTheDocument();
    expect(screen.queryByText("暂无关联工具调用")).not.toBeInTheDocument();
  });

  it("ignores stale grant detail errors while a later selected grant is still loading", async () => {
    const grantAError = deferredResponse<Response>();
    const grantBDetail = deferredResponse<Response>();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/grants/grant-a")) {
        return grantAError.promise;
      }
      if (url.endsWith("/grants/grant-b")) {
        return grantBDetail.promise;
      }
      return createJsonResponse(createPage([
        createGrant("grant-a"),
        createGrant("grant-b"),
      ]));
    });

    render(<GrantsPage />);

    fireEvent.click(await findGrantDetailButton("grant-a"));
    expect(await screen.findByRole("status")).toHaveTextContent("正在加载详情");

    fireEvent.click(screen.getByRole("button", { name: "关闭详情" }));
    fireEvent.click(await findGrantDetailButton("grant-b"));
    expect(await screen.findByRole("dialog", { name: "放行详情" })).toHaveTextContent("grant-b");
    expect(screen.getByRole("status")).toHaveTextContent("正在加载详情");

    await act(async () => {
      grantAError.resolve(createErrorResponse("grant A detail failed after grant B opened"));
      await Promise.resolve();
    });

    expect(screen.queryByText(/grant A detail failed after grant B opened/)).not.toBeInTheDocument();
    expect(screen.queryByText(/详情加载失败/)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("正在加载详情");
  });
});
