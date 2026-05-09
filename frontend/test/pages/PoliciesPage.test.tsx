import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PoliciesPage } from "../../src/pages/PoliciesPage";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function page<T>(items: T[], total = items.length) {
  return {
    items,
    total,
    pageNum: 1,
    pageSize: 20,
    totalPages: total === 0 ? 0 : Math.ceil(total / 20),
  };
}

const protectedResource = {
  resourceId: "resource-1",
  version: 9,
  path: "C:\\Users\\alice\\Secrets",
  preset: "read_only",
  enabled: true,
  createdBy: "alice",
  createdAtMs: 1710000000000,
  updatedAtMs: 1710000000000,
};

const blacklistRule = {
  ruleId: "rule-black",
  version: 8,
  kind: "blacklist",
  scope: "script",
  patternType: "literal",
  pattern: "Invoke-Expression",
  riskDelta: 70,
  enabled: true,
  createdBy: "alice",
  createdAtMs: 1710000000000,
  updatedAtMs: 1710000000000,
};

const allowlistRule = {
  ruleId: "rule-allow",
  version: 9,
  kind: "allowlist",
  scope: "tool",
  patternType: "literal",
  pattern: "npm test",
  riskDelta: -15,
  enabled: true,
  createdBy: "alice",
  createdAtMs: 1710000000000,
  updatedAtMs: 1710000000000,
};

function stubPolicyEndpoints(fetchMock?: ReturnType<typeof vi.fn>) {
  const mock = fetchMock ?? vi.fn();
  mock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>;
      if (String(url).includes("/protected-resources")) {
        return Response.json({
          ...protectedResource,
          resourceId: body.resourceId ?? "resource-created",
          version: 10,
          path: body.path,
          preset: body.preset,
          enabled: body.enabled,
          createdBy: body.actorId,
        });
      }

      return Response.json({
        ...(body.kind === "allowlist" ? allowlistRule : blacklistRule),
        ruleId: body.ruleId ?? `rule-${body.kind}`,
        version: 11,
        kind: body.kind,
        scope: body.scope,
        patternType: body.patternType,
        pattern: body.pattern,
        riskDelta: body.riskDelta,
        enabled: body.enabled,
        createdBy: body.actorId,
      });
    }

    const requestUrl = new URL(String(url), "http://localhost");
    if (requestUrl.pathname.endsWith("/policies")) {
      return Response.json({
        currentVersion: 9,
        protectedResources: [protectedResource],
        rules: [blacklistRule, allowlistRule],
      });
    }
    if (requestUrl.pathname.endsWith("/protected-resources")) {
      return Response.json(page([protectedResource]));
    }
    if (requestUrl.pathname.endsWith("/policy-rules") && requestUrl.searchParams.get("kind") === "blacklist") {
      return Response.json(page([blacklistRule]));
    }
    if (requestUrl.pathname.endsWith("/policy-rules") && requestUrl.searchParams.get("kind") === "allowlist") {
      return Response.json(page([allowlistRule]));
    }

    return Response.json(page([]));
  });

  vi.stubGlobal("fetch", mock as unknown as typeof fetch);
  return mock;
}

describe("PoliciesPage", () => {
  it("loads paged policy lists and shows one full-width list at a time", async () => {
    const fetchMock = stubPolicyEndpoints();

    render(<PoliciesPage />);

    expect(await screen.findByRole("heading", { name: "策略配置" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "目录防护" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "黑名单" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "白名单" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "目录防护列表" })).toBeInTheDocument();
    expect(await screen.findByText("C:\\Users\\alice\\Secrets")).toBeInTheDocument();
    expect(screen.queryByText("Invoke-Expression")).not.toBeInTheDocument();
    expect(screen.queryByText("npm test")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("目录防护分页").length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/policies"), undefined);
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/protected-resources?pageNum=1&pageSize=20"), undefined);
    });
  });

  it("switches the active list through tabs and requests the matching paged endpoint", async () => {
    const fetchMock = stubPolicyEndpoints();

    render(<PoliciesPage />);
    await screen.findByText("C:\\Users\\alice\\Secrets");

    fireEvent.click(screen.getByRole("tab", { name: "黑名单" }));
    expect(await screen.findByRole("heading", { name: "黑名单列表" })).toBeInTheDocument();
    expect(await screen.findByText("Invoke-Expression")).toBeInTheDocument();
    expect(screen.queryByText("C:\\Users\\alice\\Secrets")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("黑名单分页").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("tab", { name: "白名单" }));
    expect(await screen.findByRole("heading", { name: "白名单列表" })).toBeInTheDocument();
    expect(await screen.findByText("npm test")).toBeInTheDocument();
    expect(screen.queryByText("Invoke-Expression")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("白名单分页").length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/policy-rules?kind=blacklist&pageNum=1&pageSize=20"), undefined);
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/policy-rules?kind=allowlist&pageNum=1&pageSize=20"), undefined);
    });
  });

  it("opens add dialogs from the active list and sends the matching policy payloads", async () => {
    const fetchMock = stubPolicyEndpoints();

    render(<PoliciesPage />);

    fireEvent.click(await screen.findByRole("button", { name: "添加目录防护" }));
    const resourceDialog = await screen.findByRole("dialog", { name: "添加目录防护" });
    expect(within(resourceDialog).getByText("目录路径")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("目录路径"), {
      target: { value: "D:\\Project\\Protected" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存目录防护" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/protected-resources"), expect.objectContaining({ method: "POST" }));
    });

    fireEvent.click(screen.getByRole("tab", { name: "黑名单" }));
    fireEvent.click(await screen.findByRole("button", { name: "添加黑名单" }));
    expect(await screen.findByRole("dialog", { name: "添加黑名单" })).toHaveClass("modal-dialog");
    fireEvent.change(screen.getByLabelText("黑名单匹配内容"), {
      target: { value: "curl http://evil.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存黑名单" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/policy-rules"),
        expect.objectContaining({
          body: expect.stringContaining('"kind":"blacklist"'),
          method: "POST",
        }),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/policy-rules"),
        expect.objectContaining({
          body: expect.stringContaining('"riskDelta":70'),
          method: "POST",
        }),
      );
    });

    fireEvent.click(screen.getByRole("tab", { name: "白名单" }));
    fireEvent.click(await screen.findByRole("button", { name: "添加白名单" }));
    expect(await screen.findByRole("dialog", { name: "添加白名单" })).toHaveClass("modal-dialog");
    fireEvent.change(screen.getByLabelText("白名单匹配内容"), {
      target: { value: "npm test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存白名单" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/policy-rules"),
        expect.objectContaining({
          body: expect.stringContaining('"kind":"allowlist"'),
          method: "POST",
        }),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/policy-rules"),
        expect.objectContaining({
          body: expect.stringContaining('"riskDelta":-15'),
          method: "POST",
        }),
      );
    });
  });

  it("opens edit dialogs with existing values and preserves policy ids in the upsert payload", async () => {
    const fetchMock = stubPolicyEndpoints();

    render(<PoliciesPage />);

    fireEvent.click(await screen.findByRole("button", { name: "修改目录防护 C:\\Users\\alice\\Secrets" }));
    expect(await screen.findByRole("dialog", { name: "修改目录防护" })).toHaveClass("modal-dialog");
    fireEvent.change(screen.getByLabelText("目录路径"), {
      target: { value: "C:\\Users\\alice\\Secrets2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存目录防护" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/protected-resources"),
        expect.objectContaining({
          body: expect.stringContaining('"resourceId":"resource-1"'),
          method: "POST",
        }),
      );
    });

    fireEvent.click(screen.getByRole("tab", { name: "黑名单" }));
    fireEvent.click(await screen.findByRole("button", { name: "修改黑名单 Invoke-Expression" }));
    expect(await screen.findByRole("dialog", { name: "修改黑名单" })).toHaveClass("modal-dialog");
    fireEvent.change(screen.getByLabelText("黑名单匹配内容"), {
      target: { value: "Invoke-Expression downloaded payload" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存黑名单" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/policy-rules"),
        expect.objectContaining({
          body: expect.stringContaining('"ruleId":"rule-black"'),
          method: "POST",
        }),
      );
    });
  });
});
