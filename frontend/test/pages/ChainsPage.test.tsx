import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChainsPage } from "../../src/pages/ChainsPage";
import { MISSING_USER_PROMPT_TEXT } from "../../src/utils/prompts";

function createJsonResponse(data: unknown): Response {
  return {
    ok: true,
    json: async () => data,
    headers: {
      get: () => "application/json",
    },
  } as unknown as Response;
}

function createChain(chainId = "chain-1") {
  return {
    chainId,
    channelProfile: "webchat",
    conversationId: "conversation-1",
    sessionKey: "session-1",
    recentIdentity: ["requester:ou-1"],
    recentSensitive: ["protected_file"],
    recentDenials: ["deny-1"],
    recentApprovals: ["APR-001"],
    recentTools: ["exec"],
    recentTaintReads: ["secret-read"],
    recentEvasions: ["approval-bypass"],
    activeGrantId: "grant-1",
    pendingApproval: "APR-002",
    coveredPrompts: [
      {
        qaRecordId: "qa-1",
        userPromptExcerpt: "first prompt",
        riskLevel: "L2",
        startedAtMs: 1,
        status: "completed",
      },
      {
        qaRecordId: "qa-2",
        userPromptExcerpt: "second prompt",
        riskLevel: "L3",
        startedAtMs: 2,
        status: "completed",
      },
    ],
    promptCount: 2,
  };
}

function createSparseChain(chainId = "chain-sparse") {
  return {
    chainId,
    sessionKey: "session-sparse",
    recentIdentity: null,
    recentSensitive: null,
    recentDenials: null,
    recentApprovals: null,
    recentTools: null,
    recentTaintReads: null,
    recentEvasions: null,
    activeGrantId: "",
    pendingApproval: "",
    coveredPrompts: null,
    promptCount: 0,
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

async function chooseSelectOption(name: string, optionText: string) {
  fireEvent.mouseDown(screen.getByRole("combobox", { name }));
  const matches = await screen.findAllByText(optionText);
  fireEvent.click(matches.at(-1)!);
}

describe("ChainsPage", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("uses filters, pagination and keeps chain internals in audit-style details", async () => {
    fetchMock
      .mockResolvedValueOnce(createJsonResponse(createPage([createChain()], 1, 20, 41)))
      .mockResolvedValueOnce(createJsonResponse(createPage([createChain("chain-page-2")], 2, 20, 41)))
      .mockResolvedValueOnce(
        createJsonResponse(createPage([createChain("chain-filtered")], 1, 20, 1)),
      );

    const { container } = render(<ChainsPage />);

    await screen.findByText("chain-1");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/lynx/chains?pageNum=1&pageSize=20");
    expect(screen.getByTitle("2")).toBeInTheDocument();
    expect(screen.getByText("多轮链路说明")).toBeInTheDocument();
    expect(screen.getByText(/多轮链路统计一段任务区间/)).toBeInTheDocument();
    expect(screen.getByText(/示例：用户先要求读取配置/)).toBeInTheDocument();
    expect(container.querySelector(".table-explanation-card.ant-card")).not.toBeNull();
    expect(container.querySelector(".table-panel .table-explanation-card")).toBeNull();
    expect(container.querySelector(".table-panel__header .panel__subtitle")).toBeNull();
    expect(Number.parseInt(container.querySelector("table")?.style.minWidth ?? "0", 10)).toBeLessThanOrEqual(1136);
    expect(
      screen.getByText("覆盖的输入词：first prompt；second prompt"),
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "链路" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "会话" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "关联问答" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "风险线索" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "人工动作" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "详情" })).toBeInTheDocument();
    expect(screen.getByLabelText("关键词")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "渠道" })).toBeInTheDocument();
    expect(screen.queryByText("Taint")).not.toBeInTheDocument();
    expect(screen.queryByText("Active Grant")).not.toBeInTheDocument();
    expect(screen.queryByText("Pending Approval")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "查看 chain-1 链路详情" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "链路详情" }),
    ).toBeInTheDocument();
    expect(screen.getByText("链路概览")).toBeInTheDocument();
    expect(screen.getByText("关联关系")).toBeInTheDocument();
    expect(screen.getByText("链路信号")).toBeInTheDocument();
    expect(screen.getByText("覆盖输入词")).toBeInTheDocument();
    expect(screen.getByText("同一会话：session-1")).toBeInTheDocument();
    expect(screen.getByText("覆盖问答：2 条")).toBeInTheDocument();
    expect(screen.getByText("secret-read")).toBeInTheDocument();
    expect(screen.getByText("grant-1")).toBeInTheDocument();
    expect(screen.getByText("first prompt")).toBeInTheDocument();
    expect(screen.getByText("second prompt")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "关闭详情" }));
    fireEvent.click(screen.getByTitle("2"));

    await screen.findByText("chain-page-2");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/lynx/chains?pageNum=2&pageSize=20");

    fireEvent.change(screen.getByLabelText("关键词"), {
      target: { value: "filtered" },
    });
    await chooseSelectOption("渠道", "webchat");
    fireEvent.click(screen.getByRole("button", { name: "应用筛选" }));

    await screen.findByText("chain-filtered");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "/lynx/chains?q=filtered&channelProfile=webchat&pageNum=1&pageSize=20",
    );
  });

  it("renders chain summaries when backend returns null signal arrays", async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse({ items: [createSparseChain()] }),
    );

    render(<ChainsPage />);

    await screen.findByText("chain-sparse");
    expect(screen.getByText("session-sparse")).toBeInTheDocument();
    expect(screen.getAllByText("暂无").length).toBeGreaterThan(0);
  });

  it("does not show injected guard text as covered user prompts", async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse(createPage([
        {
          ...createChain("chain-injected"),
          coveredPrompts: [
            {
              qaRecordId: "qa-injected",
              userPromptExcerpt: "OpenClaw guard policy: classify this request",
              riskLevel: "L1",
              startedAtMs: 3,
              status: "completed",
            },
            {
              qaRecordId: "qa-user",
              userPromptExcerpt: "请检查当前工程",
              riskLevel: "L2",
              startedAtMs: 4,
              status: "completed",
            },
          ],
          promptCount: 2,
        },
      ])),
    );

    render(<ChainsPage />);

    await screen.findByText("chain-injected");
    expect(screen.queryByText(/OpenClaw guard policy/)).not.toBeInTheDocument();
    expect(screen.getByText(`覆盖的输入词：${MISSING_USER_PROMPT_TEXT}；请检查当前工程`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "查看 chain-injected 链路详情" }));

    expect(await screen.findByRole("dialog", { name: "链路详情" })).toBeInTheDocument();
    expect(screen.queryByText(/OpenClaw guard policy/)).not.toBeInTheDocument();
    expect(screen.getByText(MISSING_USER_PROMPT_TEXT)).toBeInTheDocument();
    expect(screen.getByText("请检查当前工程")).toBeInTheDocument();
  });

  it("uses an Ant explanation card and keeps the empty chain state inside the table", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse({ items: [] }));

    const { container } = render(<ChainsPage />);

    expect(await screen.findByText("多轮链路说明")).toBeInTheDocument();
    expect(screen.getByText(/一段任务区间里多次有关联的输入/)).toBeInTheDocument();
    expect(screen.getByText(/示例：用户先要求读取配置/)).toBeInTheDocument();
    expect(container.querySelector(".metric-grid--narrow")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "链路" })).toBeInTheDocument();
    expect(container.querySelector(".table-explanation-card.ant-card")).not.toBeNull();
    expect(container.querySelector(".table-panel .table-explanation-card")).toBeNull();
    expect(container.querySelector(".table-panel__header .panel__subtitle")).toBeNull();
    expect(container.querySelector(".empty-explanation")).toBeNull();
    expect(container.querySelector(".table-wrap")).not.toBeNull();
  });
});
