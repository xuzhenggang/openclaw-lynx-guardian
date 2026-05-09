import type { ToolCallDetailDto, ToolCallListItemDto } from "@lynx/local-console-shared";

export const MISSING_OPERATION_LABEL = "历史记录未保存具体命令";
export const MISSING_RESULT_SUMMARY = "历史记录未保存结果摘要";

type ToolCallWithOperationFields = Partial<
  ToolCallListItemDto & Pick<ToolCallDetailDto, "metadataJson" | "paramSummary">
>;

type ToolCallWithResultFields = Partial<Pick<ToolCallListItemDto, "resultExcerpt">>;

export interface ToolOperationDisplay {
  operationLabel: string;
  command?: string;
  cwd?: string;
  args?: string[];
  hasStoredCommandDetail: boolean;
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const strings = value
    .map((item) => readNonEmptyString(item))
    .filter((item): item is string => Boolean(item));

  return strings.length > 0 ? strings : undefined;
}

export function resolveToolOperation(call: ToolCallWithOperationFields): ToolOperationDisplay {
  const metadata = call.metadataJson ?? {};
  const command = readNonEmptyString(metadata.command);
  const cwd = readNonEmptyString(metadata.cwd);
  const args = readStringArray(metadata.args);
  const hasStoredCommandDetail = Boolean(command || cwd || args);

  if (command) {
    return {
      args,
      command,
      cwd,
      hasStoredCommandDetail,
      operationLabel: command,
    };
  }

  const paramSummary = readNonEmptyString(call.paramSummary);
  if (paramSummary) {
    return {
      args,
      command,
      cwd,
      hasStoredCommandDetail,
      operationLabel: paramSummary,
    };
  }

  if (args) {
    return {
      args,
      command,
      cwd,
      hasStoredCommandDetail,
      operationLabel: args.join(" "),
    };
  }

  return {
    args,
    command,
    cwd,
    hasStoredCommandDetail,
    operationLabel: MISSING_OPERATION_LABEL,
  };
}

export function resolveToolResultSummary(call: ToolCallWithResultFields): string {
  return readNonEmptyString(call.resultExcerpt) ?? MISSING_RESULT_SUMMARY;
}

export function resolveToolHeroSummary(call: ToolCallWithOperationFields): string {
  const operation = resolveToolOperation(call).operationLabel;
  const toolName = readNonEmptyString(call.toolName) ?? "tool";
  return `${toolName}: ${operation}`;
}
