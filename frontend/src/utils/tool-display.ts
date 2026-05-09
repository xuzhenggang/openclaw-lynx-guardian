import type { ToolCallDetailDto, ToolCallListItemDto } from "@lynx/local-console-shared";

const MISSING_OPERATION_LABEL = "历史记录未保存具体命令";

type ToolCallWithOperationFields = Partial<ToolCallListItemDto & Pick<ToolCallDetailDto, "metadataJson" | "paramSummary">>;

export interface ToolOperationDisplay {
  operationLabel: string;
  command?: string;
  cwd?: string;
  args?: string[];
  hasStoredCommandDetail: boolean;
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
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
