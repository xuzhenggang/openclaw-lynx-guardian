import { useRef, useState, type FormEvent } from "react";
import { Button, Card, Input, Typography } from "antd";

import { listGrants, type Grant, type GrantListQuery } from "../api/grants";
import { fetchJson } from "../api/client";
import { ModalDialog } from "../components/feedback/ModalDialog";
import { StatusBadge } from "../components/feedback/StatusBadge";
import { PageHeader } from "../components/layout/PageHeader";
import { DataTable } from "../components/tables/DataTable";
import { TablePagination } from "../components/tables/TablePagination";
import { usePagedListResource } from "../hooks/usePagedListResource";
import { formatCompactId, formatInteger } from "../utils/format";

const SCOPE_LABELS: Record<string, string> = {
  approvedRiskLevel: "授权风险等级",
  decision: "决策结果",
  expiresAt: "有效期",
  grantWindowMs: "有效窗口",
  grantType: "授权范围",
  operationKind: "操作类型",
  path: "路径",
  riskLevel: "风险等级",
  scopeType: "授权范围",
  sessionKey: "会话",
  targetHash: "目标哈希",
  targetKind: "目标类型",
  targetSummary: "目标摘要",
  tool: "工具",
  toolName: "工具",
};

interface GrantExecutionChain {
  approvalId?: string;
  chainId?: string;
  conversationId?: string;
  explanation?: string;
  grantId?: string;
  sessionKey?: string;
}

interface RelatedToolCall {
  errorText?: string;
  metadataJson?: Record<string, unknown>;
  paramSummary?: string;
  resultExcerpt?: string;
  resultStatus?: string;
  toolCallId?: string;
  toolName?: string;
}

type GrantWithDetail = Grant & {
  executionChain?: GrantExecutionChain;
  relatedToolCalls?: RelatedToolCall[];
};

function formatIsoTime(value: string | undefined): string {
  if (!value) {
    return "暂无";
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }
  return new Date(timestamp).toLocaleString("zh-CN");
}

interface GrantFilters {
  q: string;
  requesterId: string;
}

const EMPTY_FILTERS: GrantFilters = {
  q: "",
  requesterId: "",
};

function buildGrantQuery(filters: GrantFilters): Omit<GrantListQuery, "pageNum" | "pageSize"> {
  return {
    q: filters.q.trim() || undefined,
    requesterId: filters.requesterId.trim() || undefined,
  };
}

function formatScopeValue(key: string, value: unknown): string {
  if (key === "grantWindowMs" && typeof value === "number") {
    const seconds = Math.round(value / 1000);
    if (seconds >= 60) {
      return `${Math.round(seconds / 60)} 分钟`;
    }
    return `${seconds} 秒`;
  }
  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
}

function formatScopeEntries(scope: Record<string, unknown>): Array<{ key: string; label: string; value: string }> {
  return Object.entries(scope).map(([key, value]) => ({
    key,
    label: SCOPE_LABELS[key] ?? "其他范围条件",
    value: formatScopeValue(key, value),
  }));
}

function buildExecutionLinks(grant: GrantWithDetail): string[] {
  const chain = grant.executionChain;
  return [
    chain?.explanation ? `关系说明：${chain.explanation}` : undefined,
    (chain?.chainId || grant.chainId) ? `链路：${chain?.chainId || grant.chainId}` : undefined,
    (chain?.sessionKey || grant.sessionKey) ? `会话：${chain?.sessionKey || grant.sessionKey}` : undefined,
    (chain?.approvalId || grant.approvalId) ? `审批：${chain?.approvalId || grant.approvalId}` : undefined,
    grant.toolName ? `工具：${grant.toolName}` : undefined,
    grant.targetKind || grant.targetHash ? `目标：${[grant.targetKind, grant.targetHash].filter(Boolean).join(" / ")}` : undefined,
  ].filter((item): item is string => Boolean(item));
}

function metadataString(call: RelatedToolCall, key: string): string | undefined {
  const value = call.metadataJson?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function toolCallCommand(call: RelatedToolCall): string {
  return metadataString(call, "command")
    ?? metadataString(call, "operation")
    ?? call.paramSummary
    ?? call.toolName
    ?? call.toolCallId
    ?? "未知工具调用";
}

function toolCallResult(call: RelatedToolCall): string {
  return call.resultExcerpt
    ?? call.errorText
    ?? call.resultStatus
    ?? "历史记录未保存结果摘要";
}

export function GrantsPage() {
  const [draftFilters, setDraftFilters] = useState<GrantFilters>(EMPTY_FILTERS);
  const [appliedQuery, setAppliedQuery] = useState<Omit<GrantListQuery, "pageNum" | "pageSize">>({});
  const [selectedGrant, setSelectedGrant] = useState<GrantWithDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailRequestSeq = useRef(0);

  function clearGrantDetail(): void {
    detailRequestSeq.current += 1;
    setSelectedGrant(null);
    setDetailError(null);
    setDetailLoading(false);
  }

  const { items, loading, error, paginationProps, resetPaging, retry } = usePagedListResource<
    Grant,
    GrantListQuery
  >({
    loadPage: listGrants,
    onPageBoundaryChange: clearGrantDetail,
    query: appliedQuery,
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    clearGrantDetail();
    resetPaging();
    setAppliedQuery(buildGrantQuery(draftFilters));
  }

  function handleReset(): void {
    setDraftFilters(EMPTY_FILTERS);
    clearGrantDetail();
    resetPaging();
    setAppliedQuery({});
  }

  async function openGrantDetail(grant: GrantWithDetail): Promise<void> {
    const requestSeq = detailRequestSeq.current + 1;
    detailRequestSeq.current = requestSeq;
    setSelectedGrant(grant);
    setDetailError(null);
    if (grant.executionChain || grant.relatedToolCalls) {
      setDetailLoading(false);
      return;
    }
    setDetailLoading(true);
    try {
      const detail = await fetchJson<GrantWithDetail>(`/grants/${encodeURIComponent(grant.grantId)}`);
      if (detailRequestSeq.current === requestSeq) {
        setSelectedGrant((current) => current?.grantId === grant.grantId ? detail : current);
        setDetailError(null);
      }
    } catch (loadError) {
      if (detailRequestSeq.current === requestSeq) {
        const message = loadError instanceof Error ? loadError.message : "无法读取关联执行链路和工具调用";
        setDetailError(`详情加载失败：${message}`);
        setSelectedGrant((current) => current?.grantId === grant.grantId ? grant : current);
      }
    } finally {
      if (detailRequestSeq.current === requestSeq) {
        setDetailLoading(false);
      }
    }
  }

  const activeCount = items.filter((item) => !item.revokedAt).length;
  const revokedCount = items.length - activeCount;
  const selectedScopeEntries = selectedGrant ? formatScopeEntries(selectedGrant.resourceScope) : [];
  const statusDescription = error
    ? `放行记录加载失败：${error}`
    : loading
      ? "正在加载放行记录"
      : undefined;

  return (
    <div className="page-stack">
      <PageHeader
        title="放行记录"
        description={statusDescription}
        eyebrow="审批后的工具放行流水"
      />

      <section className="metric-grid metric-grid--compact metric-grid--narrow">
        <article className="metric-card">
          <p className="metric-card__label">已放行调用</p>
          <strong className="metric-card__value">
            {formatInteger(activeCount)}
          </strong>
          <p className="metric-card__note">命中授权范围</p>
        </article>
        <article className="metric-card">
          <p className="metric-card__label">已撤销/失效</p>
          <strong className="metric-card__value">
            {formatInteger(revokedCount)}
          </strong>
          <p className="metric-card__note">过期、升级或上下文变化</p>
        </article>
      </section>

      <section className="filter-panel">
        <form
          className="audit-filter-form audit-filter-form--compact"
          onSubmit={handleSubmit}
        >
          <label className="filter-field filter-field--search">
            <span>关键词</span>
            <Input
              allowClear
              aria-label="关键词"
              placeholder="搜索放行、审批、链路或工具"
              value={draftFilters.q}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  q: event.target.value,
                }))
              }
            />
          </label>
          <label className="filter-field">
            <span>申请人</span>
            <Input
              allowClear
              aria-label="申请人"
              placeholder="输入用户或 OU ID"
              value={draftFilters.requesterId}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  requesterId: event.target.value,
                }))
              }
            />
          </label>
          <div className="audit-filter-form__actions">
            <Button htmlType="submit" type="primary">
              应用筛选
            </Button>
            <Button htmlType="button" onClick={handleReset}>
              重置条件
            </Button>
          </div>
        </form>
      </section>

      <Card className="table-explanation-card" size="small" title="放行记录说明">
        <Typography.Paragraph>
          审批通过后，后续同一链路里的 tool 调用如果命中已授权范围，会作为放行记录出现在这里；换成 exec、换路径或链路结束就不会复用。
        </Typography.Paragraph>
      </Card>

      <section className="table-panel">
        <div className="table-panel__header">
          <h2 className="panel__title">放行记录列表</h2>
        </div>
        <DataTable
          emptyDescription="暂无放行记录"
          columns={[
            {
              key: "grant",
              label: "放行",
              maxWidth: 280,
              minWidth: 200,
              width: 240,
            },
            {
              key: "requester",
              label: "申请人",
              maxWidth: 190,
              minWidth: 140,
              width: 160,
            },
            {
              key: "approver",
              label: "审批人",
              maxWidth: 190,
              minWidth: 140,
              width: 160,
            },
            {
              key: "tool",
              label: "工具",
              maxWidth: 170,
              minWidth: 120,
              width: 140,
            },
            {
              key: "status",
              label: "状态",
              maxWidth: 128,
              minWidth: 100,
              width: 112,
            },
            {
              key: "expires",
              label: "过期时间",
              maxWidth: 180,
              minWidth: 140,
              width: 160,
            },
            {
              key: "detail",
              label: "操作",
              maxWidth: 128,
              minWidth: 96,
              width: 108,
            },
          ]}
          error={error}
          loading={loading}
          onRetry={retry}
          rows={items.map((item) => ({
            id: item.grantId,
            grant: (
              <div className="row-stack">
                <strong title={item.grantId}>{formatCompactId(item.grantId)}</strong>
                <span title={item.approvalId}>{formatCompactId(item.approvalId)}</span>
              </div>
            ),
            requester: item.requesterOuId || item.requesterId || "未知",
            approver: item.approverOuId || item.approverId || "未知",
            tool: item.toolName || "暂无",
            status: (
              <StatusBadge
                label={item.revokedAt ? "已撤销" : "有效"}
                tone={item.revokedAt ? "danger" : "success"}
              />
            ),
            expires: formatIsoTime(item.expiresAt),
            detail: (
              <button
                aria-label={`查看 ${item.grantId} 放行详情`}
                className="btn btn--compact"
                type="button"
                onClick={() => {
                  void openGrantDetail(item);
                }}
              >
                详情
              </button>
            ),
          }))}
        />
        <TablePagination {...paginationProps} ariaLabel="放行记录分页" />
      </section>

      <ModalDialog
        closeLabel="关闭详情"
        open={Boolean(selectedGrant)}
        size="wide"
        title="放行详情"
        subtitle={
          selectedGrant?.grantId ?? "查看放行记录的适用范围和撤销上下文。"
        }
        onClose={clearGrantDetail}
      >
        {selectedGrant ? (
          <div className="audit-detail-dialog">
            <section className="audit-detail-dialog__hero">
              <div className="audit-detail-dialog__heroText">
                <p className="audit-detail-dialog__eyebrow">放行概览</p>
                <p className="audit-detail-dialog__heroSubtitle">
                  {selectedGrant.grantId} 覆盖 {selectedGrant.toolName || "未知工具"} 的后续授权命中。
                </p>
              </div>
              <div className="audit-detail-dialog__chips" aria-label="放行概览标签">
                <span className="audit-detail-dialog__chip">
                  <span className="audit-detail-dialog__chipLabel">状态</span>
                  <span className="audit-detail-dialog__chipValue">
                    <StatusBadge
                      label={selectedGrant.revokedAt ? "已撤销" : "有效"}
                      tone={selectedGrant.revokedAt ? "danger" : "success"}
                    />
                  </span>
                </span>
                <span className="audit-detail-dialog__chip">
                  <span className="audit-detail-dialog__chipLabel">申请人</span>
                  <span className="audit-detail-dialog__chipValue">
                    {selectedGrant.requesterOuId || selectedGrant.requesterId || "暂无"}
                  </span>
                </span>
                <span className="audit-detail-dialog__chip">
                  <span className="audit-detail-dialog__chipLabel">审批人</span>
                  <span className="audit-detail-dialog__chipValue">
                    {selectedGrant.approverOuId || selectedGrant.approverId || "暂无"}
                  </span>
                </span>
                <span className="audit-detail-dialog__chip">
                  <span className="audit-detail-dialog__chipLabel">工具</span>
                  <span className="audit-detail-dialog__chipValue">{selectedGrant.toolName || "暂无"}</span>
                </span>
                <span className="audit-detail-dialog__chip">
                  <span className="audit-detail-dialog__chipLabel">过期时间</span>
                  <span className="audit-detail-dialog__chipValue">{formatIsoTime(selectedGrant.expiresAt)}</span>
                </span>
              </div>
            </section>

            <section className="audit-detail-dialog__section">
              <div className="panel__header audit-detail-dialog__sectionHeader">
                <div>
                  <h3 className="panel__title">授权上下文</h3>
                  <p className="panel__subtitle">放行记录与审批、链路、请求人和目标之间的绑定关系。</p>
                </div>
              </div>
              <dl className="detail-panel__grid audit-detail-dialog__summary-grid">
                {[
                  { label: "放行 ID", value: selectedGrant.grantId },
                  { label: "审批 ID", value: selectedGrant.approvalId || "暂无" },
                  { label: "链路", value: selectedGrant.chainId || "暂无" },
                  { label: "会话", value: selectedGrant.sessionKey || "暂无" },
                  { label: "渠道", value: selectedGrant.channelProfile || "暂无" },
                  { label: "会话 ID", value: selectedGrant.conversationId || "暂无" },
                  { label: "风险族", value: selectedGrant.riskFamily || "暂无" },
                  { label: "目标类型", value: selectedGrant.targetKind || "暂无" },
                  { label: "目标哈希", value: selectedGrant.targetHash || "暂无" },
                  { label: "创建时间", value: formatIsoTime(selectedGrant.createdAt) },
                  { label: "过期时间", value: formatIsoTime(selectedGrant.expiresAt) },
                  { label: "撤销时间", value: formatIsoTime(selectedGrant.revokedAt) },
                ].map((field) => (
                  <div key={field.label} className="detail-panel__field">
                    <dt>{field.label}</dt>
                    <dd>{field.value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="audit-detail-dialog__section">
              <div className="panel__header audit-detail-dialog__sectionHeader">
                <div>
                  <h3 className="panel__title">关联执行链路</h3>
                  <p className="panel__subtitle">这条放行记录绑定的链路、审批、工具和目标。</p>
                </div>
              </div>
              <ol className="prompt-coverage-list">
                {buildExecutionLinks(selectedGrant).map((item) => (
                  <li className="prompt-coverage-list__item" key={item}>
                    <p className="prompt-coverage-list__text">{item}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section className="audit-detail-dialog__section">
              <div className="panel__header audit-detail-dialog__sectionHeader">
                <div>
                  <h3 className="panel__title">放行范围</h3>
                  <p className="panel__subtitle">后续调用命中这些条件时才会复用这条授权。</p>
                </div>
              </div>
              <dl className="detail-panel__grid audit-detail-dialog__summary-grid">
                {selectedScopeEntries.length > 0 ? (
                  selectedScopeEntries.map((field) => (
                    <div className="detail-panel__field" key={field.key}>
                      <dt>{field.label}</dt>
                      <dd className="grant-scope-value" title={field.value}>{field.value}</dd>
                    </div>
                  ))
                ) : (
                  <div className="detail-panel__field">
                    <dt>范围内容</dt>
                    <dd>未声明范围</dd>
                  </div>
                )}
                <div className="detail-panel__field">
                  <dt>撤销原因</dt>
                  <dd title={selectedGrant.revokedReason || "暂无"}>{selectedGrant.revokedReason || "暂无"}</dd>
                </div>
              </dl>
            </section>

            <section className="audit-detail-dialog__section">
              <div className="panel__header audit-detail-dialog__sectionHeader">
                <div>
                  <h3 className="panel__title">关联工具调用</h3>
                  <p className="panel__subtitle">每张卡片对应一次与该放行记录相关的工具执行。</p>
                </div>
              </div>
              <div className="grant-related-tool-grid">
                {detailError ? (
                  <p className="grant-related-tool-card__error" role="alert">
                    {detailError}
                  </p>
                ) : detailLoading ? (
                  <p className="grant-related-tool-card__empty" role="status">正在加载详情</p>
                ) : (selectedGrant.relatedToolCalls ?? []).length > 0 ? (
                  (selectedGrant.relatedToolCalls ?? []).map((call, index) => {
                    const command = toolCallCommand(call);
                    const result = toolCallResult(call);
                    const key = call.toolCallId ?? `${command}-${index}`;
                    return (
                      <article
                        className="grant-related-tool-card"
                        data-testid="grant-related-tool-card"
                        key={key}
                      >
                        <div className="grant-related-tool-card__header">
                          <span className="grant-related-tool-card__tool" title={call.toolName ?? "未知工具"}>
                            {call.toolName ?? "未知工具"}
                          </span>
                          <span className="grant-related-tool-card__status" title={call.resultStatus ?? "未记录状态"}>
                            {call.resultStatus ?? "未记录状态"}
                          </span>
                        </div>
                        <p className="grant-related-tool-card__command" title={command}>
                          {command}
                        </p>
                        <p className="grant-related-tool-card__result" title={result}>
                          {result}
                        </p>
                        {call.toolCallId ? (
                          <p className="grant-related-tool-card__id" title={call.toolCallId}>
                            {formatCompactId(call.toolCallId)}
                          </p>
                        ) : null}
                      </article>
                    );
                  })
                ) : (
                  <p className="grant-related-tool-card__empty">暂无关联工具调用</p>
                )}
              </div>
            </section>
          </div>
        ) : null}
      </ModalDialog>
    </div>
  );
}
