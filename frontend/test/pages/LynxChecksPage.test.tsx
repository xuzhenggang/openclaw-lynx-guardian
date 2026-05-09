import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LynxChecksPage } from "../../src/pages/LynxChecksPage";

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

function createCheck(overrides: Record<string, unknown>) {
  return {
    requestId: "CHECK-001",
    source: "manual",
    trigger: "lynx_command",
    preferredTargetKind: "recent",
    status: "completed",
    sendAttempted: true,
    sendSucceeded: true,
    transport: "webchat",
    createdAtMs: 1_776_945_600_000,
    completedAtMs: 1_776_945_603_000,
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

async function chooseSelectOption(name: string, optionText: string) {
  fireEvent.mouseDown(screen.getByRole("combobox", { name }));
  const matches = await screen.findAllByText(optionText);
  fireEvent.click(matches.at(-1)!);
}

async function chooseSelectOptions(name: string, optionTexts: string[]) {
  for (const optionText of optionTexts) {
    await chooseSelectOption(name, optionText);
  }
}

describe("LynxChecksPage", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("prioritizes markdown body, avoids duplicate ID hero, and keeps path text horizontal", async () => {
    const longReportPath = ".openclaw/lynx/check-runs/2026-05-09T120000.very-long-local-console-acceptance-report.report.md";
    const fullMarkdownReport = [
      "# Lynx 检测报告",
      "",
      "## 真实报告正文",
      "这里是运行时生成的检测报告正文，不是路径列表。",
      ...Array.from({ length: 12 }, (_, index) => `- 证据 ${index + 1}: 页面需要优先展示正文。`),
    ].join("\n");

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/lynx/lynx-checks/CHECK-BODY") {
        return createJsonResponse({
          ...createCheck({ requestId: "CHECK-BODY", reportPath: longReportPath }),
          reportMarkdown: fullMarkdownReport,
        });
      }
      return createJsonResponse(createPage([
        createCheck({ requestId: "CHECK-BODY", reportPath: longReportPath }),
      ]));
    });

    const { container } = render(<LynxChecksPage />);
    fireEvent.click(await screen.findByRole("button", { name: "查看 CHECK-BODY 检测报告" }));

    const markdown = await screen.findByTestId("lynx-check-report-markdown");
    expect(markdown).toHaveTextContent("## 真实报告正文");
    expect(container.querySelector(".report-path-index")).not.toHaveAttribute("open");
    expect(container.querySelector(".report-path")).toHaveStyle({ writingMode: "horizontal-tb" });
    expect(container.querySelector(".report-side-panel .panel__subtitle")).not.toHaveTextContent("CHECK-BODY");
    expect(screen.queryAllByText("CHECK-BODY").length).toBeLessThanOrEqual(2);
  });

  it("does not show stale report markdown while a newly selected report detail is pending", async () => {
    const pendingDetailB = deferredResponse({
      ...createCheck({ requestId: "CHECK-B" }),
      reportMarkdown: "B_ONLY_MARKDOWN",
    });
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/lynx/lynx-checks/CHECK-A") {
        return createJsonResponse({
          ...createCheck({ requestId: "CHECK-A" }),
          reportMarkdown: "A_ONLY_MARKDOWN",
        });
      }
      if (url === "/lynx/lynx-checks/CHECK-B") {
        return pendingDetailB.promise;
      }
      return createJsonResponse(createPage([
        createCheck({ requestId: "CHECK-A" }),
        createCheck({ requestId: "CHECK-B" }),
      ]));
    });

    render(<LynxChecksPage />);

    expect(await screen.findByText("A_ONLY_MARKDOWN")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看 CHECK-B 检测报告" }));

    expect(screen.getByText("请求：CHECK-B")).toBeInTheDocument();
    expect(screen.queryByText("A_ONLY_MARKDOWN")).not.toBeInTheDocument();

    pendingDetailB.resolve();
    expect(await screen.findByText("B_ONLY_MARKDOWN")).toBeInTheDocument();
  });

  it("separates report metadata, delivery status, markdown body, and path index", async () => {
    const fullReport = [
      "# Lynx Detection",
      "",
      "## Full Section",
      "这里是完整检测报告正文。",
      "END-OF-FULL-REPORT",
    ].join("\n");
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/lynx/lynx-checks/CHECK-FACTS") {
        return createJsonResponse({
          ...createCheck({
            requestId: "CHECK-FACTS",
            qaRecordId: "qa-1",
            reportPath: ".openclaw/lynx/check-runs/facts.report.md",
          }),
          reportMarkdown: fullReport,
        });
      }
      if (url === "/lynx/lynx-checks/CHECK-EVIDENCE") {
        return createJsonResponse({
          ...createCheck({
            requestId: "CHECK-EVIDENCE",
            status: "failed",
            sendSucceeded: false,
            errorMessage: "delivery failed",
            completedAtMs: 1_776_945_601_000,
            evidenceBundle: {
              reportPath: ".openclaw/lynx/check-runs/evidence.report.md",
            },
          }),
          reportMarkdown: "# 第二份检测报告\n\n失败投递的完整报告正文。",
        });
      }
      return createJsonResponse(createPage([
        createCheck({
          requestId: "CHECK-FACTS",
          qaRecordId: "qa-1",
          facts: {
            reportPath: ".openclaw/lynx/check-runs/facts.report.md",
          },
        }),
        createCheck({
          requestId: "CHECK-EVIDENCE",
          status: "failed",
          sendSucceeded: false,
          errorMessage: "delivery failed",
          completedAtMs: 1_776_945_601_000,
          evidenceBundle: {
            reportPath: ".openclaw/lynx/check-runs/evidence.report.md",
          },
        }),
      ]));
    });

    render(<LynxChecksPage />);

    expect(screen.getByText("检测报告")).toBeInTheDocument();
    expect(await screen.findByText(/检测报告用于留存每次/)).toBeInTheDocument();
    expect(screen.queryByText(/左侧筛选检测任务/)).not.toBeInTheDocument();
    expect(await screen.findByText("CHECK-FACTS")).toBeInTheDocument();
    expect(await screen.findByText("当前选中报告")).toBeInTheDocument();
    expect(screen.queryByText("最近检测报告")).not.toBeInTheDocument();
    expect(screen.getByTestId("lynx-checks-workspace")).toBeInTheDocument();
    expect(screen.getByText("报告元信息")).toBeInTheDocument();
    expect(screen.getByText("投递状态")).toBeInTheDocument();
    expect(screen.getByText("报告正文")).toBeInTheDocument();
    expect(screen.getByText("文件和路径索引")).toBeInTheDocument();
    expect(screen.queryByText("Task State")).not.toBeInTheDocument();
    expect(screen.queryByText("证据")).not.toBeInTheDocument();
    expect(screen.getByLabelText("关键词")).toBeInTheDocument();
    expect(screen.getByLabelText("处理状态")).toBeInTheDocument();
    expect(screen.getByText("qa-1")).toBeInTheDocument();
    expect(screen.getByText("未关联问答记录")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/lynx/lynx-checks?pageNum=1&pageSize=20");
    await waitFor(() => {
      expect(fetchMock.mock.calls.map((call) => call[0])).toContain("/lynx/lynx-checks/CHECK-FACTS");
    });
    fireEvent.click(screen.getByRole("button", { name: "查看 CHECK-FACTS 检测报告" }));
    const reportMarkdown = await screen.findByTestId("lynx-check-report-markdown");
    expect(reportMarkdown).toHaveTextContent("## Full Section");
    expect(reportMarkdown).toHaveTextContent("END-OF-FULL-REPORT");
    fireEvent.click(screen.getByRole("button", { name: "查看 CHECK-EVIDENCE 检测报告" }));
    await waitFor(() => {
      expect(screen.getByTestId("lynx-check-report-markdown")).toHaveTextContent("失败投递的完整报告正文。");
    });
    expect(screen.getByText("请求：CHECK-EVIDENCE")).toBeInTheDocument();
    expect(screen.getByText("错误信息")).toBeInTheDocument();
    expect(screen.getByText("delivery failed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /导出/ })).not.toBeInTheDocument();
    expect(screen.getByText(".openclaw/lynx/check-runs/facts.report.md")).toBeInTheDocument();
    expect(screen.getByText(".openclaw/lynx/check-runs/evidence.report.md")).toBeInTheDocument();
    expect(screen.queryByText("Live Streaming")).not.toBeInTheDocument();
    expect(screen.queryByText(/2023-10-24/)).not.toBeInTheDocument();
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
    expect(screen.queryByText("5s / 次")).not.toBeInTheDocument();
    expect(screen.queryByText("P95: 1.2s")).not.toBeInTheDocument();
  });

  it("sends keyword, status, and trigger filters to the list API", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/CHECK-")) {
        return createJsonResponse(createCheck({ requestId: url.split("/").at(-1) ?? "CHECK-DETAIL" }));
      }
      if (url.includes("q=qa-42")) {
        return createJsonResponse(createPage([
          createCheck({ requestId: "CHECK-FILTERED" }),
        ], 1, 20, 1));
      }
      return createJsonResponse(createPage([
        createCheck({ requestId: "CHECK-001" }),
      ]));
    });

    render(<LynxChecksPage />);

    await screen.findByText("CHECK-001");
    fireEvent.change(screen.getByLabelText("关键词"), {
      target: { value: "qa-42" },
    });
    await chooseSelectOptions("处理状态", ["已完成", "失败"]);
    await chooseSelectOptions("触发方式", ["命令触发", "定时任务"]);
    fireEvent.click(screen.getByRole("button", { name: "应用筛选" }));

    await screen.findByText("CHECK-FILTERED");
    expect(fetchMock.mock.calls.map((call) => call[0])).toContain(
      "/lynx/lynx-checks?q=qa-42&status=completed&status=failed&trigger=lynx_command&trigger=scheduled&pageNum=1&pageSize=20",
    );

    fireEvent.click(screen.getByRole("button", { name: "重置条件" }));

    await waitFor(() => {
      const listRequests = fetchMock.mock.calls.map((call) => call[0]);
      expect(listRequests.filter((url) => url === "/lynx/lynx-checks?pageNum=1&pageSize=20")).toHaveLength(2);
    });
  });
});
