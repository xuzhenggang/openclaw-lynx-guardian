import { afterEach, describe, expect, it, vi } from "vitest";

import { getGlobalLoadingSnapshot } from "../../src/app/loading-store";
import { buildQueryString, fetchJson } from "../../src/api/client";
import { listLynxChecks } from "../../src/api/lynx-checks";

afterEach(() => {
  vi.unstubAllGlobals();
});

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
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json",
    },
    status: 200,
  });
}

describe("buildQueryString", () => {
  it("encodes arrays and skips empty values", () => {
    expect(buildQueryString({
      limit: 20,
      riskLevel: ["L3", "L4"],
      empty: undefined,
      nullable: null,
      enabled: true,
    })).toBe("?limit=20&riskLevel=L3&riskLevel=L4&enabled=true");
  });

  it("does not mistake /lynx-checks for an already-prefixed /lynx API path", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [] })));
    vi.stubGlobal("fetch", fetchMock);

    await listLynxChecks();

    expect(fetchMock).toHaveBeenCalledWith("/lynx/lynx-checks", undefined);
  });

  it("keeps the global indicator visible until all concurrent fetchJson calls settle", async () => {
    const first = createDeferred<Response>();
    const second = createDeferred<Response>();
    vi.stubGlobal("fetch", vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise));

    const pending = [fetchJson("/one"), fetchJson("/two")];
    expect(getGlobalLoadingSnapshot()).toBe(true);

    first.resolve(createJsonResponse({ ok: 1 }));
    await Promise.resolve();
    await Promise.resolve();
    expect(getGlobalLoadingSnapshot()).toBe(true);

    second.resolve(createJsonResponse({ ok: 2 }));
    await Promise.all(pending);
    expect(getGlobalLoadingSnapshot()).toBe(false);
  });

  it("clears the global indicator when fetchJson throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));

    await expect(fetchJson("/broken")).rejects.toThrow(/boom|500/);

    expect(getGlobalLoadingSnapshot()).toBe(false);
  });
});
