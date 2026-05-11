import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../../src/app/App";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return {
    promise,
    reject,
    resolve,
  };
}

function createJsonResponse(data: unknown): Response {
  return {
    ok: true,
    json: async () => data,
    headers: {
      get: () => "application/json",
    },
  } as unknown as Response;
}

function createPage(items: unknown[]) {
  return {
    items,
    pageNum: 1,
    pageSize: 10,
    total: items.length,
    totalPages: items.length === 0 ? 0 : 1,
  };
}

const dashboardOverview = {
  enforcementDistribution: [],
  eventTrend: [],
  recentApprovals: [],
  recentQaRecords: [],
  recentSecurityEvents: [],
  recentToolCalls: [],
  riskDistribution: [],
  tokenTrend: [],
  totals: {
    approvalCount: 0,
    eventCount: 0,
    lynxCheckCount: 0,
    toolCallCount: 0,
    totalTokens: 0,
  },
};

const securityEventSummary = {
  enforcementActionCounts: {},
  eventKindCounts: {},
  riskCounts: {
    L0: 0,
    L1: 0,
    L2: 0,
    L3: 0,
    L4: 0,
  },
  total: 0,
};

describe("global loading", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/webview/");
  });

  it("shows a global loading indicator while app API requests are pending", async () => {
    window.history.replaceState({}, "", "/webview/");
    const pendingResponse = createDeferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => pendingResponse.promise));

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole("status", { name: "全局加载中" }),
      ).toBeInTheDocument();
    });

    pendingResponse.resolve(createJsonResponse({
      enforcementDistribution: [],
      eventTrend: [],
      recentApprovals: [],
      recentQaRecords: [],
      recentSecurityEvents: [],
      recentToolCalls: [],
      riskDistribution: [],
      tokenTrend: [],
      totals: {
        approvalCount: 0,
        eventCount: 0,
        lynxCheckCount: 0,
        toolCallCount: 0,
        totalTokens: 0,
      },
    }));

    await waitForElementToBeRemoved(() =>
      screen.queryByRole("status", { name: "全局加载中" }),
    );
  });

  it("covers the content area with a transition overlay during route changes", async () => {
    window.history.replaceState({}, "", "/webview/");
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const requestUrl = String(input);
      if (requestUrl.startsWith("/lynx/security-events/summary")) {
        return createJsonResponse(securityEventSummary);
      }
      if (requestUrl.startsWith("/lynx/security-events")) {
        return createJsonResponse(createPage([]));
      }
      return createJsonResponse(dashboardOverview);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<App />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/lynx/dashboard/overview", undefined);
    });

    const eventsLink = container.querySelector<HTMLAnchorElement>('a[href="/webview/events"]');
    expect(eventsLink).not.toBeNull();
    fireEvent.click(eventsLink!);

    expect(
      screen.getByRole("status", { name: "页面切换中" }),
    ).toHaveAttribute("data-state", "visible");
  });
});
