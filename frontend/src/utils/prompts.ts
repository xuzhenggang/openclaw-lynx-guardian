export const MISSING_USER_PROMPT_TEXT = "历史记录未保存用户原始输入";

const INJECTED_PROMPT_PATTERNS = [
  /^\s*(system|developer)\s*:/i,
  /OpenClaw\s+(guard|guardian|policy|safety|security)/i,
  /Lynx\s+Guardian\s+plugin/i,
  /\b(Self-safety-guard|policy internals)\b/i,
  /<INSTRUCTIONS>|<\/INSTRUCTIONS>|#\s*AGENTS\.md/i,
];

export interface UserPromptSource {
  contentExcerpt?: unknown;
  detailJson?: Record<string, unknown>;
  payloadJson?: Record<string, unknown>;
  prompt?: unknown;
  userPrompt?: unknown;
  userPromptExcerpt?: unknown;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function isInjectedPromptText(value: unknown): boolean {
  const text = stringValue(value);
  return Boolean(text && INJECTED_PROMPT_PATTERNS.some((pattern) => pattern.test(text)));
}

function cleanPromptCandidate(value: unknown): string | undefined {
  const text = stringValue(value);
  if (!text || isInjectedPromptText(text)) {
    return undefined;
  }
  return text;
}

function extractUserLineFromTranscript(value: unknown): string | undefined {
  const text = stringValue(value);
  if (!text) {
    return undefined;
  }

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*user\s*:\s*(.+?)\s*$/i);
    const userText = match?.[1]?.trim();
    if (userText && !isInjectedPromptText(userText)) {
      return userText;
    }
  }

  return undefined;
}

export function resolveUserVisiblePrompt(source: UserPromptSource): string {
  const candidates = [
    source.userPromptExcerpt,
    source.userPrompt,
    source.detailJson?.userPromptExcerpt,
    source.detailJson?.userPrompt,
    source.payloadJson?.userPromptExcerpt,
    source.payloadJson?.userPrompt,
  ];

  for (const candidate of candidates) {
    const text = cleanPromptCandidate(candidate);
    if (text) {
      return text;
    }
  }

  const transcriptCandidates = [
    source.prompt,
    source.contentExcerpt,
    source.detailJson?.prompt,
    source.detailJson?.promptExcerpt,
    source.payloadJson?.prompt,
    source.payloadJson?.promptExcerpt,
  ];

  for (const candidate of transcriptCandidates) {
    const text = extractUserLineFromTranscript(candidate);
    if (text) {
      return text;
    }
  }

  return MISSING_USER_PROMPT_TEXT;
}
