import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TokensPage } from "../../src/pages/TokensPage";

function createJsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), { status: 200 });
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

function createTokenSummary() {
  return {
    totalTokens: 2_170_856,
    inputTokens: 2_149_606,
    outputTokens: 21_250,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    actualTokens: 2_170_856,
    estimatedTokens: 0,
    measurableTokens: 2_170_856,
    measurableInputTokens: 2_149_606,
    measurableOutputTokens: 21_250,
    measurableCacheReadTokens: 0,
    measurableCacheWriteTokens: 0,
    estimatedCount: 1,
    unavailableCount: 0,
    originTotals: [{ sourceOrigin: "hook", totalTokens: 2_170_856, count: 40 }],
    topModels: [
      { model: "openclaw/main", totalTokens: 2_149_606 },
      { model: "gpt-5.4", totalTokens: 21_250 },
    ],
  };
}

function createTokenTrend() {
  return {
    bucket: "hour",
    points: [
      {
        bucketStartMs: 1_777_350_000_000,
        inputTokens: 12_000,
        outputTokens: 1_200,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 13_200,
      },
      {
        bucketStartMs: 1_777_360_800_000,
        inputTokens: 96_000,
        outputTokens: 3_800,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 99_800,
      },
      {
        bucketStartMs: 1_777_371_600_000,
        inputTokens: 32_000,
        outputTokens: 900,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 32_900,
      },
      {
        bucketStartMs: 1_777_382_400_000,
        inputTokens: 420_000,
        outputTokens: 8_400,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 428_400,
      },
      {
        bucketStartMs: 1_777_418_400_000,
        inputTokens: 2_149_606,
        outputTokens: 21_250,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 2_170_856,
      },
    ],
  };
}

function createTokenHeatmap() {
  return {
    timeZone: "local",
    totalTokens: 2_170_856,
    hourTotals: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      totalTokens: hour === 21 ? 64_306 : hour === 10 ? 2_106_550 : 0,
    })),
    weekdayTotals: [
      { weekday: 0, label: "周日", totalTokens: 0 },
      { weekday: 1, label: "周一", totalTokens: 2_106_550 },
      { weekday: 2, label: "周二", totalTokens: 0 },
      { weekday: 3, label: "周三", totalTokens: 0 },
      { weekday: 4, label: "周四", totalTokens: 64_306 },
      { weekday: 5, label: "周五", totalTokens: 0 },
      { weekday: 6, label: "周六", totalTokens: 0 },
    ],
  };
}

function createUsagePage(pageNum = 1) {
  if (pageNum === 2) {
    return createPage([
      {
        usageEventId: "usage-older",
        sessionKey: "sess-token-transcript",
        runId: "run-token-transcript",
        agentId: "main",
        provider: "openclaw",
        model: "openclaw/main",
        sourceType: "actual",
        sourceOrigin: "transcript",
        inputTokens: 2_149_606,
        outputTokens: 21_250,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 2_170_856,
        assistantTextCount: 1,
        isEstimated: false,
        occurredAtMs: 1_777_349_500_000,
      },
    ], 2, 20, 2);
  }

  return createPage([
    {
      usageEventId: "usage-latest",
      sessionKey: "sess-token-hook",
      runId: "run-token-hook",
      agentId: "main",
      provider: "openclaw",
      model: "openclaw/main",
      sourceType: "actual",
      sourceOrigin: "hook",
      inputTokens: 64_306,
      outputTokens: 72,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 64_378,
      assistantTextCount: 1,
      isEstimated: false,
      occurredAtMs: 1_777_418_400_000,
    },
    {
      usageEventId: "usage-older",
      sessionKey: "sess-token-transcript",
      runId: "run-token-transcript",
      agentId: "main",
      provider: "openclaw",
      model: "openclaw/main",
      sourceType: "actual",
      sourceOrigin: "transcript",
      inputTokens: 2_149_606,
      outputTokens: 21_250,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalTokens: 2_170_856,
      assistantTextCount: 1,
      isEstimated: false,
      occurredAtMs: 1_777_349_500_000,
    },
  ], 1, 20, 2);
}

function queryParam(url: string, key: string): string | null {
  return new URL(url, "http://localhost").searchParams.get(key);
}

function getRangeCallUrls(calls: Array<[RequestInfo | URL, RequestInit | undefined]>) {
  return calls.map((call) => String(call[0]));
}

function mockElementOverflow(isOverflowing: boolean): () => void {
  const scrollWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollWidth");
  const clientWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
  const clientHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");

  Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
    configurable: true,
    get: () => isOverflowing ? 240 : 80,
  });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 100,
  });
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get: () => isOverflowing ? 48 : 20,
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => 24,
  });

  return () => {
    for (const [key, descriptor] of [
      ["scrollWidth", scrollWidthDescriptor],
      ["clientWidth", clientWidthDescriptor],
      ["scrollHeight", scrollHeightDescriptor],
      ["clientHeight", clientHeightDescriptor],
    ] as const) {
      if (descriptor) {
        Object.defineProperty(HTMLElement.prototype, key, descriptor);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, key);
      }
    }
  };
}

function expectTooltipContent(text: string): void {
  const tooltipTexts = Array.from(document.querySelectorAll(".table-cell-tooltip")).map(
    (tooltip) => tooltip.textContent,
  );

  expect(tooltipTexts).toContain(text);
}

describe("TokensPage", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Date, "now").mockReturnValue(1_777_420_800_000);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders native-like token analytics with compact values and heatmap", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/lynx/tokens/summary")) {
        return createJsonResponse(createTokenSummary());
      }
      if (url.startsWith("/lynx/tokens/trend")) {
        return createJsonResponse(createTokenTrend());
      }
      if (url.startsWith("/lynx/tokens/heatmap")) {
        return createJsonResponse(createTokenHeatmap());
      }
      if (url.startsWith("/lynx/tokens/usage")) {
        return createJsonResponse(createUsagePage(Number(queryParam(url, "pageNum") ?? "1")));
      }
      return createJsonResponse(createPage([]));
    });

    const { container } = render(<TokensPage />);

    expect(screen.getByText("Token 分析")).toBeInTheDocument();
    expect(container.querySelector(".page-header")).not.toBeNull();
    expect(container.querySelector(".token-hero")).toBeNull();
    expect(container.querySelector(".token-metric-strip.metric-grid.metric-grid--compact")).not.toBeNull();
    expect(container.querySelector(".token-metric-grid")).toBeNull();
    expect(container.querySelectorAll(".metric-grid.metric-grid--compact > .metric-card")).toHaveLength(4);
    expect(container.querySelector(".metric-grid.metric-grid--compact .summary-card")).toBeNull();
    expect(screen.getByRole("button", { name: "总量" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "按类型" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Token 类型拆分")).toBeInTheDocument();
    expect(screen.getByText("使用热力分布")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "最近 24 小时消耗趋势" })).toBeInTheDocument();
    for (const label of ["最近 1 小时", "最近 24 小时", "最近 7 天", "最近 30 天", "全部时间"]) {
      expect(screen.getByRole("option", { name: label })).toBeInTheDocument();
    }

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    const urls = getRangeCallUrls(fetchMock.mock.calls);
    expect(urls).toContain("/lynx/tokens/summary?fromMs=1777334400000&toMs=1777420800000");
    expect(urls).toContain("/lynx/tokens/trend?bucket=hour&fromMs=1777334400000&toMs=1777420800000");
    expect(urls).toContain("/lynx/tokens/usage?fromMs=1777334400000&toMs=1777420800000&pageNum=1&pageSize=20");
    expect(urls).toContain("/lynx/tokens/heatmap?fromMs=1777334400000&toMs=1777420800000");

    const summaryTotalLabel = screen.getAllByText("总量", { selector: ".metric-card__label" })[0];
    const summaryTotalCard = summaryTotalLabel.closest(".metric-card");
    expect(summaryTotalCard).not.toBeNull();
    await waitFor(() => {
      expect(within(summaryTotalCard as HTMLElement).getByText("2.2M")).toBeInTheDocument();
      expect(within(summaryTotalCard as HTMLElement).getByTitle("2,170,856 tokens")).toBeInTheDocument();
    });
    expect(screen.getByText("64.3K -> 72")).toBeInTheDocument();
    expect(screen.getByTitle("21:00 · 64.3K tokens")).toBeInTheDocument();
    expect(screen.getByTitle("周一 · 2.1M tokens")).toBeInTheDocument();
    expect(screen.getByTestId("token-weekday-cell-1")).toHaveClass("token-weekday-cell--level-4");
    expect(screen.getByTestId("token-hour-cell-10")).toHaveClass("token-hour-cell--level-4");

    const breakdownPanel = screen.getByRole("heading", { name: "Token 类型拆分" }).closest(".token-breakdown-panel");
    expect(breakdownPanel).not.toBeNull();
    expect(within(breakdownPanel as HTMLElement).getByText("上下文输入")).toBeInTheDocument();
    expect(within(breakdownPanel as HTMLElement).getByText("模型输出")).toBeInTheDocument();
    expect(within(breakdownPanel as HTMLElement).getByText("缓存读取")).toBeInTheDocument();
    expect(within(breakdownPanel as HTMLElement).getByText("缓存写入")).toBeInTheDocument();

    const trendChart = await screen.findByTestId("token-trend-chart");
    expect(trendChart).toBeInTheDocument();
    expect(within(trendChart).getAllByText("2,170,856").length).toBeGreaterThan(0);
    expect(within(trendChart).getAllByText("12,000").length).toBeGreaterThan(0);
    const lineChart = within(trendChart).getByTestId("token-trend-line-chart");
    expect(lineChart.tagName.toLowerCase()).toBe("svg");
    expect(lineChart).toHaveAttribute("viewBox", "0 0 720 132");
    expect(within(lineChart).getByTestId("token-trend-area")).toBeInTheDocument();
    const trendLine = within(lineChart).getByTestId("token-trend-line");
    const pointCoordinates = trendLine.getAttribute("points") ?? "";
    const yCoordinates = pointCoordinates
      .trim()
      .split(/\s+/)
      .map((coordinate) => coordinate.split(",")[1])
      .filter(Boolean);
    expect(yCoordinates.length).toBeGreaterThanOrEqual(5);
    expect(new Set(yCoordinates).size).toBeGreaterThan(2);
    expect(within(lineChart).getAllByTestId(/^token-trend-point-/)).toHaveLength(5);
    expect(within(trendChart).queryByTestId("token-trend-bar-0")).not.toBeInTheDocument();

    expect(await screen.findByText("实时 hook")).toBeInTheDocument();
    expect(screen.getByText("Transcript 回填")).toBeInTheDocument();
    expect(screen.getByText(/共 2 条记录/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "按类型" }));
    expect(screen.getByRole("button", { name: "总量" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "按类型" })).toHaveAttribute("aria-pressed", "true");
    expect(within(lineChart).getByTestId("token-trend-line-output")).toBeInTheDocument();
    expect(within(lineChart).getByTestId("token-trend-line-input")).toBeInTheDocument();
    expect(within(lineChart).getByTestId("token-trend-line-cache-read")).toBeInTheDocument();
    expect(within(lineChart).getByTestId("token-trend-line-cache-write")).toBeInTheDocument();

    expect(container.querySelector(".token-breakdown-bar")).not.toBeNull();
    expect(screen.getByTestId("token-breakdown-segment-cache-read")).toHaveStyle({ display: "none" });
    expect(screen.getByTestId("token-breakdown-segment-cache-write")).toHaveStyle({ display: "none" });
    expect(container.querySelector(".token-mosaic-panel")).not.toBeNull();
    expect(container.querySelector(".token-heatmap-grid")).not.toBeNull();
    expect(container.querySelectorAll(".token-heatmap-cell__swatch")).toHaveLength(31);
    expect(screen.getByTestId("token-weekday-cell-1").querySelector(".token-heatmap-cell__swatch")).not.toBeNull();
    expect(screen.getByTestId("token-hour-cell-10").querySelector(".token-heatmap-cell__swatch")).not.toBeNull();
    expect(screen.getAllByText("实际", { selector: ".token-badge--actual" }).length).toBeGreaterThan(0);
  });

  it("keeps the trend panel in an empty state when trend points are unavailable", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/lynx/tokens/summary")) {
        return createJsonResponse({
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          estimatedCount: 0,
          actualTokens: 0,
          estimatedTokens: 0,
          unavailableCount: 0,
          topModels: [],
        });
      }
      if (url.startsWith("/lynx/tokens/trend")) {
        return createJsonResponse({ bucket: "hour", points: [] });
      }
      if (url.startsWith("/lynx/tokens/heatmap")) {
        return createJsonResponse({
          timeZone: "local",
          totalTokens: 0,
          hourTotals: Array.from({ length: 24 }, (_, hour) => ({ hour, totalTokens: 0 })),
          weekdayTotals: Array.from({ length: 7 }, (_, weekday) => ({
            weekday,
            label: `周${weekday}`,
            totalTokens: 0,
          })),
        });
      }
      return createJsonResponse(createPage([]));
    });

    render(<TokensPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    expect(screen.getByText("暂无 Token 趋势")).toBeInTheDocument();
    expect(screen.queryByTestId("token-trend-chart")).not.toBeInTheDocument();
    expect(screen.queryByText("64.3K -> 72")).not.toBeInTheDocument();
  });

  it("shows estimated-only token usage as measurable data instead of an empty dashboard", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/lynx/tokens/summary")) {
        return createJsonResponse({
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          actualTokens: 0,
          estimatedTokens: 1_322,
          measurableTokens: 1_322,
          measurableInputTokens: 1_300,
          measurableOutputTokens: 22,
          measurableCacheReadTokens: 0,
          measurableCacheWriteTokens: 0,
          estimatedCount: 1,
          unavailableCount: 0,
          originTotals: [{ sourceOrigin: "hook", totalTokens: 1_322, count: 1 }],
          topModels: [{ model: "glm-5", totalTokens: 1_322 }],
        });
      }
      if (url.startsWith("/lynx/tokens/trend")) {
        return createJsonResponse({ bucket: "hour", points: [] });
      }
      if (url.startsWith("/lynx/tokens/heatmap")) {
        return createJsonResponse({
          timeZone: "local",
          totalTokens: 1_322,
          hourTotals: Array.from({ length: 24 }, (_, hour) => ({
            hour,
            totalTokens: hour === 9 ? 1_322 : 0,
          })),
          weekdayTotals: Array.from({ length: 7 }, (_, weekday) => ({
            weekday,
            label: `周${weekday}`,
            totalTokens: weekday === 1 ? 1_322 : 0,
          })),
        });
      }
      return createJsonResponse(createPage([
        {
          usageEventId: "token-usage:estimated-only",
          sessionKey: "#LX-ESTIMATED",
          provider: "bailian",
          model: "glm-5",
          sourceType: "estimated",
          sourceOrigin: "transcript",
          inputTokens: 1_300,
          outputTokens: 22,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          totalTokens: 1_322,
          assistantTextCount: 1,
          isEstimated: true,
          occurredAtMs: 1_776_942_111_288,
        },
      ]));
    });

    render(<TokensPage />);

    expect((await screen.findAllByTitle("1,322 tokens")).length).toBeGreaterThan(0);
    expect(screen.getByText("Transcript 回填")).toBeInTheDocument();
    expect(screen.getByText("1.3K -> 22")).toBeInTheDocument();
  });

  it("audits loading, long session IDs, source wording, and token chart/table readability", async () => {
    const restoreOverflow = mockElementOverflow(true);
    const longSessionKey = "session-token-audit-" + "full-value-access-".repeat(8);

    try {
      fetchMock.mockImplementation(async (input) => {
        const url = String(input);
        if (url.startsWith("/lynx/tokens/summary")) {
          return createJsonResponse({
            totalTokens: 5_103,
            inputTokens: 4_900,
            outputTokens: 203,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            actualTokens: 4_980,
            estimatedTokens: 123,
            measurableTokens: 5_103,
            measurableInputTokens: 4_900,
            measurableOutputTokens: 203,
            measurableCacheReadTokens: 0,
            measurableCacheWriteTokens: 0,
            estimatedCount: 1,
            unavailableCount: 0,
            originTotals: [
              { sourceOrigin: "hook", totalTokens: 4_980, count: 1 },
              { sourceOrigin: "transcript", totalTokens: 123, count: 1 },
            ],
            topModels: [
              { model: "openclaw/main", totalTokens: 4_980 },
              { model: "glm-5", totalTokens: 123 },
            ],
          });
        }
        if (url.startsWith("/lynx/tokens/trend")) {
          return createJsonResponse({
            bucket: "hour",
            points: [
              {
                bucketStartMs: 1_777_350_000_000,
                inputTokens: 120,
                outputTokens: 30,
                cacheReadTokens: 0,
                cacheWriteTokens: 0,
                totalTokens: 150,
              },
              {
                bucketStartMs: 1_777_353_600_000,
                inputTokens: 4_780,
                outputTokens: 173,
                cacheReadTokens: 0,
                cacheWriteTokens: 0,
                totalTokens: 4_953,
              },
            ],
          });
        }
        if (url.startsWith("/lynx/tokens/heatmap")) {
          return createJsonResponse({
            timeZone: "local",
            totalTokens: 5_103,
            hourTotals: Array.from({ length: 24 }, (_, hour) => ({
              hour,
              totalTokens: hour === 10 ? 4_953 : hour === 11 ? 150 : 0,
            })),
            weekdayTotals: [
              { weekday: 0, label: "周日", totalTokens: 0 },
              { weekday: 1, label: "周一", totalTokens: 5_103 },
              { weekday: 2, label: "周二", totalTokens: 0 },
              { weekday: 3, label: "周三", totalTokens: 0 },
              { weekday: 4, label: "周四", totalTokens: 0 },
              { weekday: 5, label: "周五", totalTokens: 0 },
              { weekday: 6, label: "周六", totalTokens: 0 },
            ],
          });
        }
        if (url.startsWith("/lynx/tokens/usage")) {
          return createJsonResponse(createPage([
            {
              usageEventId: "usage-long-session",
              sessionKey: longSessionKey,
              runId: "run-token-audit-hook",
              agentId: "main",
              provider: "openclaw",
              model: "openclaw/main",
              sourceType: "actual",
              sourceOrigin: "hook",
              inputTokens: 4_900,
              outputTokens: 80,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              totalTokens: 4_980,
              assistantTextCount: 1,
              isEstimated: false,
              occurredAtMs: 1_777_353_600_000,
            },
            {
              usageEventId: "usage-estimated-transcript",
              sessionKey: "session-token-estimated-transcript",
              runId: "run-token-audit-transcript",
              agentId: "main",
              provider: "bailian",
              model: "glm-5",
              sourceType: "estimated",
              sourceOrigin: "transcript",
              inputTokens: 0,
              outputTokens: 123,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              totalTokens: 123,
              assistantTextCount: 1,
              isEstimated: true,
              occurredAtMs: 1_777_350_000_000,
            },
          ]));
        }
        return createJsonResponse(createPage([]));
      });

      render(<TokensPage />);

      expect(screen.getByText("正在刷新实时 token 数据")).toBeInTheDocument();
      expect(screen.getAllByText("正在加载 Token 使用记录").length).toBeGreaterThanOrEqual(1);

      const longSessionText = await screen.findByText(longSessionKey);
      expect(longSessionText).toHaveClass("table-cell-ellipsis");
      fireEvent.mouseEnter(longSessionText);
      await waitFor(() => {
        expectTooltipContent(longSessionKey);
      });

      const longSessionRow = longSessionText.closest("tr");
      expect(longSessionRow).not.toBeNull();
      expect(within(longSessionRow as HTMLElement).getByText("实时 hook")).toBeInTheDocument();
      expect(within(longSessionRow as HTMLElement).getByText("实际")).toHaveClass("token-badge--actual");
      expect(screen.getByText("Transcript 回填")).toBeInTheDocument();
      expect(screen.getByText("估算", { selector: ".token-badge--estimated" })).toBeInTheDocument();

      const summaryTotalLabel = screen.getAllByText("总量", { selector: ".metric-card__label" })[0];
      const summaryTotalCard = summaryTotalLabel.closest(".metric-card");
      expect(summaryTotalCard).not.toBeNull();
      expect(within(summaryTotalCard as HTMLElement).getByText(/实际 .*估算/)).toBeInTheDocument();
      expect(within(summaryTotalCard as HTMLElement).getByTitle("5,103 tokens")).toBeInTheDocument();

      expect(await screen.findByTestId("token-trend-chart")).toBeInTheDocument();
      expect(screen.getByTestId("token-trend-line-chart")).toHaveAttribute("viewBox", "0 0 720 132");
      expect(screen.getByTitle("周一 · 5.1K tokens")).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "会话 ID" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "输入 / 输出" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "类型" })).toBeInTheDocument();
    } finally {
      restoreOverflow();
    }
  });

  it("audits empty token data with explicit actual and estimated wording", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("/lynx/tokens/summary")) {
        return createJsonResponse({
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          actualTokens: 0,
          estimatedTokens: 0,
          measurableTokens: 0,
          measurableInputTokens: 0,
          measurableOutputTokens: 0,
          measurableCacheReadTokens: 0,
          measurableCacheWriteTokens: 0,
          estimatedCount: 0,
          unavailableCount: 0,
          originTotals: [],
          topModels: [],
        });
      }
      if (url.startsWith("/lynx/tokens/trend")) {
        return createJsonResponse({ bucket: "hour", points: [] });
      }
      if (url.startsWith("/lynx/tokens/heatmap")) {
        return createJsonResponse({
          timeZone: "local",
          totalTokens: 0,
          hourTotals: Array.from({ length: 24 }, (_, hour) => ({ hour, totalTokens: 0 })),
          weekdayTotals: Array.from({ length: 7 }, (_, weekday) => ({
            weekday,
            label: `周${weekday}`,
            totalTokens: 0,
          })),
        });
      }
      if (url.startsWith("/lynx/tokens/usage")) {
        return createJsonResponse(createPage([]));
      }
      return createJsonResponse(createPage([]));
    });

    render(<TokensPage />);

    expect(screen.getByText("Token 分析")).toBeInTheDocument();
    expect(screen.getAllByText("正在加载 Token 使用记录").length).toBeGreaterThanOrEqual(1);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    expect(screen.getByText(/实际 0/)).toBeInTheDocument();
    expect(screen.getByText(/估算 0/)).toBeInTheDocument();
    expect(screen.getByText("暂无 Token 趋势")).toBeInTheDocument();
    expect((await screen.findAllByText("暂无 Token 使用记录")).length).toBeGreaterThan(0);
  });
});
