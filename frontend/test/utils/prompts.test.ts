import { describe, expect, it } from "vitest";

import {
  MISSING_USER_PROMPT_TEXT,
  resolveUserVisiblePrompt,
} from "../../src/utils/prompts";
import {
  decoratedPromptFixture,
  originalUserPrompt,
} from "../fixtures/local-console-acceptance";

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
        userPrompt: "帮我查看检测报告",
      },
    })).toBe("帮我查看检测报告");
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

  it("extracts the original user line from decorated OpenClaw transcripts", () => {
    expect(resolveUserVisiblePrompt({
      prompt: decoratedPromptFixture,
      contentExcerpt: "OpenClaw guard policy: classify this request",
    })).toBe(originalUserPrompt);
  });

  it("extracts the original user line from decorated content excerpts", () => {
    expect(resolveUserVisiblePrompt({
      contentExcerpt: decoratedPromptFixture,
    })).toBe(originalUserPrompt);
  });

  it("rejects bootstrap, developer, plugin, and AGENTS text in approval reason candidates", () => {
    expect(resolveUserVisiblePrompt({
      userPromptExcerpt: "<INSTRUCTIONS>\n# AGENTS.md instructions for C:\\repo",
      payloadJson: { promptExcerpt: "developer: hidden approval policy" },
    })).toBe(MISSING_USER_PROMPT_TEXT);
  });

  it("does not guess user input from whole prompt transcripts without a user line", () => {
    expect(resolveUserVisiblePrompt({
      prompt: "system: hidden context\ndeveloper: hidden rule",
      contentExcerpt: "OpenClaw guard checked hidden context",
    })).toBe(MISSING_USER_PROMPT_TEXT);
  });
});
