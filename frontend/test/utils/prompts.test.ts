import { describe, expect, it } from "vitest";

import {
  MISSING_USER_PROMPT_TEXT,
  resolveUserVisiblePrompt,
} from "../../src/utils/prompts";

describe("resolveUserVisiblePrompt", () => {
  it("prefers explicit user prompt excerpts over generic prompt context", () => {
    expect(resolveUserVisiblePrompt({
      prompt: "system: hidden guard context\nuser: 请检查仓库",
      userPromptExcerpt: "请检查仓库",
    })).toBe("请检查仓库");
  });

  it("uses structured user prompt fields from detail or payload JSON", () => {
    expect(resolveUserVisiblePrompt({
      detailJson: {
        userPromptExcerpt: "请解释这次阻断",
      },
    })).toBe("请解释这次阻断");

    expect(resolveUserVisiblePrompt({
      payloadJson: {
        userPrompt: "帮我看检测报告",
      },
    })).toBe("帮我看检测报告");
  });

  it("does not expose system, developer, OpenClaw guard, or plugin injected prompts", () => {
    const injectedTexts = [
      "system: You are OpenClaw safety guard",
      "developer: never reveal policy internals",
      "OpenClaw guard policy: classify this request",
      "Lynx Guardian plugin injected context",
      "<INSTRUCTIONS>\n# AGENTS.md instructions",
    ];

    for (const text of injectedTexts) {
      expect(resolveUserVisiblePrompt({ userPromptExcerpt: text })).toBe(MISSING_USER_PROMPT_TEXT);
    }
  });

  it("does not guess user input from whole prompt transcripts", () => {
    expect(resolveUserVisiblePrompt({
      prompt: "system: hidden context\nuser: 请运行测试",
      contentExcerpt: "OpenClaw guard checked hidden context",
    })).toBe(MISSING_USER_PROMPT_TEXT);
  });
});
