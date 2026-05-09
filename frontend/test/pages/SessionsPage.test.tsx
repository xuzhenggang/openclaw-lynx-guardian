import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionsPage } from "../../src/pages/SessionsPage";

function createJsonResponse(data: unknown): Response {
  return {
    ok: true,
    json: async () => data,
  } as Response;
}

function deferredResponse(data: unknown) {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((nextResolve) => {
    resolve = nextResolve;
  });

  return {
    promise,
    resolve: () => resolve(createJsonResponse(data)),
  };
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

  it("summarizes high-activity session detail instead of rendering a raw right-panel dump", async () => {
    const detail = createSessionDetail("session-heavy", 9999, {
      eventCount: 6,
      toolCallCount: 4,
      recentEvents: Array.from({ length: 6 }, (_, index) => ({
        eventId: `event-heavy-${index}`,
        sourceKind: "hook",
        hookName: "before_tool_call",
        eventType: "security",
        category: "tool",
        enforcementAction: "allow",
        title: `安全事件 ${index + 1}`,
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
      return createJsonResponse(createPage([createSession("session-heavy", { eventCount: 6, toolCallCount: 4 })]));
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
    expect(screen.getByTitle(/tool-session-a/)).toBeInTheDocument();
  });

  it("exposes full long recent tool commands and raw IDs through title while keeping a human summary visible", async () => {
    const longCommand = 'powershell -NoProfile -Command "Get-ChildItem C:\\Users\\24716\\.openclaw\\extensions\\openclaw-lynx-guardian -Filter package.json -Recurse | Select-Object -First 1 FullName"';
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/lynx/sessions/session-long-command") {
        return createJsonResponse(createSessionDetail("session-long-command", 111, {
          recentToolCalls: [
            {
              toolCallId: "tool-long-command-raw-id",
              toolName: "exec",
              metadataJson: { command: longCommand },
              enforcementAction: "allow",
              startedAtMs: 1_776_945_620_000,
            },
          ],
        }));
      }
      return createJsonResponse(createPage([createSession("session-long-command")]));
    });

    render(<SessionsPage />);

    await screen.findByText("session-long-command");
    const commandMatches = await screen.findAllByText(new RegExp(longCommand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    expect(commandMatches.length).toBeGreaterThanOrEqual(2);
    const toolSummary = screen.getByTitle(/tool-long-command-raw-id/);
    expect(toolSummary).toHaveTextContent(longCommand);
    expect(toolSummary).toHaveAttribute("title", expect.stringContaining(longCommand));
    expect(toolSummary).toHaveAttribute("title", expect.stringContaining("tool-long-command-raw-id"));
    const disclosure = screen.getByText("完整工具详情").closest("details");
    expect(disclosure).not.toBeNull();
    expect(within(disclosure!).getByText(new RegExp(longCommand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).toBeInTheDocument();
  });

  it("does not show stale session activity while a newly selected session detail is pending", async () => {
    const pendingSessionB = deferredResponse(createSessionDetail("session-b", 222, {
      recentToolCalls: [
        {
          toolCallId: "tool-session-b",
          toolName: "shell_session_b",
          metadataJson: { command: "B_ONLY_COMMAND" },
          enforcementAction: "allow",
          startedAtMs: 1_776_945_620_000,
        },
      ],
    }));
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/lynx/sessions/session-a") {
        return createJsonResponse(createSessionDetail("session-a", 111, {
          recentToolCalls: [
            {
              toolCallId: "tool-session-a",
              toolName: "shell_session_a",
              metadataJson: { command: "A_ONLY_COMMAND" },
              enforcementAction: "allow",
              startedAtMs: 1_776_945_620_000,
            },
          ],
        }));
      }
      if (url === "/lynx/sessions/session-b") {
        return pendingSessionB.promise;
      }
      return createJsonResponse(createPage([
        createSession("session-a"),
        createSession("session-b"),
      ]));
    });

    render(<SessionsPage />);

    expect((await screen.findAllByText(/A_ONLY_COMMAND/)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("session-b"));

    expect(screen.getAllByTitle("session-b").length).toBeGreaterThan(0);
    expect(screen.queryByText(/A_ONLY_COMMAND/)).not.toBeInTheDocument();

    pendingSessionB.resolve();
    expect((await screen.findAllByText(/B_ONLY_COMMAND/)).length).toBeGreaterThan(0);
  });

  it("uses shared tool operation resolution for recent tool args and exposes full details accessibly", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/lynx/sessions/session-args") {
        return createJsonResponse(createSessionDetail("session-args", 111, {
          recentToolCalls: [
            {
              toolCallId: "tool-args-raw-id",
              toolName: "exec",
              metadataJson: { args: ["Get-Content", "package.json"] },
              enforcementAction: "allow",
              startedAtMs: 1_776_945_620_000,
            },
          ],
        }));
      }
      return createJsonResponse(createPage([createSession("session-args")]));
    });

    render(<SessionsPage />);

    await screen.findByText("session-args");
    expect(await screen.findByText(/exec：Get-Content package\.json/)).toBeInTheDocument();
    expect(screen.getByText("完整工具详情")).toBeInTheDocument();
    expect(screen.getByText(/工具调用 ID：tool-args-raw-id/)).toBeInTheDocument();
    expect(screen.getByText(/命令：Get-Content package\.json/)).toBeInTheDocument();
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
    expect(screen.getByTitle(/approval-session-b/)).toBeInTheDocument();
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
