import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionsPage } from "../../src/pages/SessionsPage";

function createJsonResponse(data: unknown): Response {
  return {
    ok: true,
    json: async () => data,
  } as Response;
}

function createSession(sessionKey: string, overrides: Record<string, unknown> = {}) {
  return {
    sessionKey,
    channelProfile: "webchat",
    channelId: `channel-${sessionKey}`,
    requesterId: `requester-id-${sessionKey}`,
    requesterOuId: `${sessionKey}-requester`,
    accountId: `account-${sessionKey}`,
    conversationId: `conversation-${sessionKey}`,
    isGroup: false,
    firstSeenAtMs: 1_776_945_000_000,
    lastSeenAtMs: 1_776_945_600_000,
    eventCount: 2,
    highRiskEventCount: 0,
    toolCallCount: 1,
    ...overrides,
  };
}

function createSessionDetail(sessionKey: string, totalTokens: number, overrides: Record<string, unknown> = {}) {
  return {
    ...createSession(sessionKey),
    recentEvents: [
      {
        eventId: `event-${sessionKey}`,
        sourceKind: "hook",
        hookName: "before_agent_start",
        eventType: "security",
        category: "input",
        enforcementAction: "allow",
        title: `Security event ${sessionKey}`,
        occurredAtMs: 1_776_945_610_000,
      },
    ],
    recentToolCalls: [
      {
        toolCallId: `tool-${sessionKey}`,
        toolName: `shell_${sessionKey}`,
        enforcementAction: "allow",
        startedAtMs: 1_776_945_620_000,
      },
    ],
    recentApprovals: [
      {
        approvalId: `approval-${sessionKey}`,
        module: "tool_guard",
        riskLevel: "L3",
        scopeType: "singleTool",
        requestedAtMs: 1_776_945_630_000,
        expiresAtMs: 1_776_949_230_000,
      },
    ],
    tokenSummary: {
      totalTokens,
      inputTokens: totalTokens - 10,
      outputTokens: 10,
    },
    ...overrides,
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

describe("SessionsPage", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("loads the first session detail and switches detail when a different session row is clicked", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/lynx/sessions/session-a") {
        return createJsonResponse(createSessionDetail("session-a", 111));
      }
      if (url === "/lynx/sessions/session-b") {
        return createJsonResponse(createSessionDetail("session-b", 999, {
          isGroup: true,
          eventCount: 8,
          highRiskEventCount: 2,
          channelProfile: "feishu",
          channelId: "channel-session-b",
          conversationId: "conversation-session-b",
        }));
      }
      return createJsonResponse(createPage([
        createSession("session-a"),
        createSession("session-b", { isGroup: true, channelProfile: "feishu" }),
      ]));
    });

    render(<SessionsPage />);

    expect(await screen.findByText("session-a")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/lynx/sessions?pageNum=1&pageSize=20");
    await waitFor(() => {
      expect(fetchMock.mock.calls.map((call) => call[0])).toContain("/lynx/sessions/session-a");
    });

    fireEvent.click(screen.getByText("session-b"));

    await waitFor(() => {
      expect(fetchMock.mock.calls.map((call) => call[0])).toContain("/lynx/sessions/session-b");
    });
    expect(await screen.findByText(/总量：999/)).toBeInTheDocument();
    expect(screen.getByText(/session-b-requester/)).toBeInTheDocument();
    expect(screen.getByText("会话元信息")).toBeInTheDocument();
    expect(screen.getByText("会话标识")).toBeInTheDocument();
    expect(screen.getByText("渠道 ID")).toBeInTheDocument();
    expect(screen.getByText("channel-session-b")).toBeInTheDocument();
    expect(screen.getByText("conversation-session-b")).toBeInTheDocument();
    expect(screen.getByText("群聊")).toBeInTheDocument();
    expect(screen.getByText("会话事件数")).toBeInTheDocument();
    expect(screen.getByText("最近工具")).toBeInTheDocument();
    expect(screen.getByText(/shell_session-b/)).toBeInTheDocument();
    expect(screen.getByText("最近审批")).toBeInTheDocument();
    expect(screen.getByText(/approval-session-b/)).toBeInTheDocument();
    expect(screen.getByText("最近安全事件")).toBeInTheDocument();
    expect(screen.getByText(/Security event session-b/)).toBeInTheDocument();
    expect(screen.getByText("Token 摘要")).toBeInTheDocument();
  });

  it("uses real filter controls for the session list", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/lynx/sessions/session-filtered") {
        return createJsonResponse(createSessionDetail("session-filtered", 321));
      }
      if (url === "/lynx/sessions/session-a") {
        return createJsonResponse(createSessionDetail("session-a", 111));
      }
      if (url.includes("q=filtered")) {
        return createJsonResponse(createPage([createSession("session-filtered")]));
      }
      return createJsonResponse(createPage([createSession("session-a")]));
    });

    render(<SessionsPage />);

    await screen.findByText("session-a");
    expect(screen.getByLabelText("关键词")).toBeInTheDocument();
    expect(screen.getByLabelText("渠道")).toBeInTheDocument();
    expect(screen.getByLabelText("请求人")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("关键词"), {
      target: { value: "filtered" },
    });
    fireEvent.change(screen.getByLabelText("请求人"), {
      target: { value: "ou-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "应用筛选" }));

    await screen.findByText("session-filtered");
    await waitFor(() => {
      expect(fetchMock.mock.calls.map((call) => call[0])).toContain("/lynx/sessions?q=filtered&requesterOuId=ou-1&pageNum=1&pageSize=20");
    });
  });
});
