import {
  cleanup,
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
});
