import { useEffect, useState, type FormEvent } from "react";
import type {
  RiskLevel,
  SecurityEventDetailDto,
  SecurityEventKind,
  SecurityEventListItemDto,
  SecurityEventSummaryDto,
} from "@lynx/local-console-shared";
import { Button, DatePicker, Input, Select } from "antd";
import type { Dayjs } from "dayjs";
import { Link } from "react-router-dom";

import {
  getSecurityEventDetail,
  getSecurityEventSummary,
  listSecurityEvents,
  type SecurityEventListQuery,
} from "../api/security-events";
import { ROUTE_PATHS } from "../app/route-paths";
import { ModalDialog } from "../components/feedback/ModalDialog";
import { PageHeader } from "../components/layout/PageHeader";
import { DataTable } from "../components/tables/DataTable";
import { TablePagination } from "../components/tables/TablePagination";
import { usePagedListResource } from "../hooks/usePagedListResource";
import { formatInteger, formatTimestamp } from "../utils/format";
import { resolveUserVisiblePrompt } from "../utils/prompts";
import { formatQaRecordId } from "../utils/qa-records";
import { renderActionBadge, renderPolicyDecisionBadge, renderRiskBadge } from "../utils/status";

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const { RangePicker } = DatePicker;

type DateRangeValue = [Dayjs | null, Dayjs | null] | null;

interface EventFilters {
  q: string;
  riskLevel: RiskLevel[];
  eventKind: SecurityEventKind[];
  dateRange: DateRangeValue;
}

const EMPTY_FILTERS: EventFilters = {
  q: "",
  riskLevel: [],
  eventKind: [],
  dateRange: null,
};

const EMPTY_SECURITY_EVENT_SUMMARY: SecurityEventSummaryDto = {
  total: 0,
  riskCounts: {
    L0: 0,
    L1: 0,
    L2: 0,
    L3: 0,
    L4: 0,
  },
  eventKindCounts: {},
  enforcementActionCounts: {},
};

function normalizeSecurityEventSummary(
  summary: Partial<SecurityEventSummaryDto> | null | undefined,
): SecurityEventSummaryDto {
  return {
    total: typeof summary?.total === "number" ? summary.total : 0,
    riskCounts: {
      ...EMPTY_SECURITY_EVENT_SUMMARY.riskCounts,
      ...(summary?.riskCounts ?? {}),
    },
    eventKindCounts: summary?.eventKindCounts ?? {},
    enforcementActionCounts: summary?.enforcementActionCounts ?? {},
  };
}

const RISK_OPTIONS: Array<{ label: string; value: RiskLevel }> = [
  { label: "L0 基础", value: "L0" },
  { label: "L1 关注", value: "L1" },
  { label: "L2 中危", value: "L2" },
  { label: "L3 高危", value: "L3" },
  { label: "L4 严重", value: "L4" },
];

const RISK_SUMMARY_CARDS: Array<{
  riskLevel: RiskLevel;
  label: string;
  note: string;
  cssClass: string;
}> = [
  { riskLevel: "L0", label: "L0", note: "基础", cssClass: "overview-card--l0" },
  { riskLevel: "L1", label: "L1", note: "关注", cssClass: "overview-card--l1" },
  { riskLevel: "L2", label: "L2", note: "中危", cssClass: "overview-card--l2" },
  { riskLevel: "L3", label: "L3", note: "高危", cssClass: "overview-card--l3" },
  { riskLevel: "L4", label: "L4", note: "严重", cssClass: "overview-card--l4" },
];

const EVENT_KIND_OPTIONS: Array<{ label: string; value: SecurityEventKind }> = [
  { label: "输入", value: "input" },
  { label: "工具", value: "tool" },
  { label: "输出", value: "output" },
  { label: "安装", value: "install" },
  { label: "过程", value: "process" },
];

const EVENT_KIND_LABELS: Record<SecurityEventKind, string> = {
  input: "输入",
  tool: "工具",
  output: "输出",
  install: "安装",
  process: "过程",
};

const PROCESS_KIND_LABELS: Record<string, string> = {
  conversation: "会话",
  skill_install: "Skill 安装",
  plugin_install: "插件安装",
  lynx_check: "检测任务",
  approval: "审批",
  batch_operation: "批量操作",
  other: "其他",
};

export function buildDateRangeQuery(value: DateRangeValue): Pick<SecurityEventListQuery, "fromMs" | "toMs"> {
  const [fromDate, toDate] = value ?? [];

  return {
    fromMs: fromDate?.startOf("day").valueOf(),
    toMs: toDate?.endOf("day").valueOf(),
  };
}

function buildEventQuery(filters: EventFilters): SecurityEventListQuery {
  return {
    q: filters.q.trim() || undefined,
    riskLevel: filters.riskLevel.length > 0 ? filters.riskLevel : undefined,
    eventKind: filters.eventKind.length > 0 ? filters.eventKind : undefined,
    ...buildDateRangeQuery(filters.dateRange),
  };
}

function formatEventKind(kind: SecurityEventKind): string {
  return EVENT_KIND_LABELS[kind] ?? kind;
}

function formatProcessKind(kind: string): string {
  return PROCESS_KIND_LABELS[kind] ?? kind;
}

function formatProcessCell(event: SecurityEventListItemDto): string {
  const processLabel = formatProcessKind(event.processKind);
  if (event.eventKind === "tool") {
    return processLabel;
  }
  return `${processLabel} · ${formatEventKind(event.eventKind)}`;
}

function resolveObjectText(event: SecurityEventListItemDto): string {
  if (event.eventKind === "input") {
    return resolveUserVisiblePrompt({
      userPromptExcerpt: event.detailJson?.userPromptExcerpt
        ?? event.detailJson?.userPrompt
        ?? event.objectLabel
        ?? event.contentExcerpt,
    });
  }
  return event.objectLabel ?? event.contentExcerpt ?? event.summary ?? event.title;
}

function resolveContentSummary(event: SecurityEventListItemDto): string {
  if (event.eventKind === "input") {
    return resolveObjectText(event);
  }
  if (event.eventKind === "tool") {
    return valueAsDisplayText(event.detailJson?.command)
      ?? event.contentExcerpt
      ?? event.summary
      ?? event.title;
  }
  return event.contentExcerpt ?? event.summary ?? event.title;
}

function resolveModuleRuleTarget(event: SecurityEventListItemDto): string {
  const modules = stringListFromDetail(event.detailJson?.matchedModules);
  const rules = stringListFromDetail(event.detailJson?.matchedRules);
  const target = event.toolCallId ?? event.qaRecordId ?? event.processId;
  return [
    modules.length > 0 ? `模块 ${modules.join("、")}` : undefined,
    rules.length > 0 ? `规则 ${rules.join("、")}` : undefined,
    target ? `目标 ${target}` : undefined,
  ].filter(Boolean).join("；") || "暂无";
}

function formatRawEvidence(event: SecurityEventListItemDto): string {
  return `${formatInteger(event.rawAuditCount)} 条`;
}

function formatDetailJson(value: Record<string, unknown> | undefined): string {
  return value ? JSON.stringify(value, null, 2) : "暂无";
}

function valueAsDisplayText(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    return value.trim() || undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function stringListFromDetail(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map(valueAsDisplayText)
      .filter((item): item is string => Boolean(item));
  }
  const text = valueAsDisplayText(value);
  return text ? [text] : [];
}

function formatDetailList(value: unknown): string {
  const items = stringListFromDetail(value);
  return items.length > 0 ? items.join("；") : "暂无";
}

function formatConcreteEvidence(value: unknown): string {
  const items = stringListFromDetail(value);
  return items.length > 0 ? items.join("；") : "暂无具体证据";
}

function formatScoreBreakdown(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) {
    return "暂无";
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return valueAsDisplayText(item);
      }
      const record = item as Record<string, unknown>;
      const ruleId = valueAsDisplayText(record.ruleId) ?? valueAsDisplayText(record.label) ?? "评分项";
      const delta = typeof record.delta === "number"
        ? record.delta >= 0 ? `+${record.delta}` : String(record.delta)
        : valueAsDisplayText(record.delta);
      const reason = valueAsDisplayText(record.reason);
      return [ruleId, delta, reason ? `：${reason}` : undefined].filter(Boolean).join(" ");
    })
    .filter((item): item is string => Boolean(item))
    .join("；") || "暂无";
}

export function EventsPage() {
  const [draftFilters, setDraftFilters] = useState<EventFilters>(EMPTY_FILTERS);
  const [appliedQuery, setAppliedQuery] = useState<SecurityEventListQuery>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedDetail, setSelectedDetail] = useState<SecurityEventDetailDto | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SecurityEventSummaryDto>(EMPTY_SECURITY_EVENT_SUMMARY);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  function clearDetailState(): void {
    setSelectedDetail(null);
    setDetailError(null);
    setDetailLoadingId(null);
  }

  const { items, loading, error, paginationProps, resetPaging, retry } = usePagedListResource<
    SecurityEventListItemDto,
    SecurityEventListQuery
  >({
    initialPageSize: DEFAULT_PAGE_SIZE,
    loadPage: listSecurityEvents,
    onPageBoundaryChange: clearDetailState,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    query: appliedQuery,
    refreshKey,
  });

  useEffect(() => {
    let active = true;

    async function loadSummary(): Promise<void> {
      setSummaryLoading(true);
      try {
        const nextSummary = await getSecurityEventSummary(appliedQuery);
        if (!active) {
          return;
        }
        setSummary(normalizeSecurityEventSummary(nextSummary));
        setSummaryError(null);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setSummary(EMPTY_SECURITY_EVENT_SUMMARY);
        setSummaryError(loadError instanceof Error ? loadError.message : "概览加载失败");
      } finally {
        if (active) {
          setSummaryLoading(false);
        }
      }
    }

    void loadSummary();
    return () => {
      active = false;
    };
  }, [appliedQuery, refreshKey]);

  const combinedError = error ?? summaryError;
  const isLoading = loading || summaryLoading;
  const statusText = combinedError
    ? `安全事件加载失败：${combinedError}`
    : isLoading
      ? "正在加载安全事件"
      : "按用户能感知的输入检查、工具调用检查、输出检查、安装和任务过程展示安全事件。";

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    resetPaging();
    setAppliedQuery(buildEventQuery(draftFilters));
  }

  function handleReset(): void {
    setDraftFilters(EMPTY_FILTERS);
    resetPaging();
    setAppliedQuery({});
  }

  function handleCloseDetail(): void {
    setSelectedDetail(null);
    setDetailError(null);
    setDetailLoadingId(null);
  }

  async function handleOpenDetail(eventId: string): Promise<void> {
    setDetailLoadingId(eventId);
    setDetailError(null);
    try {
      const detail = await getSecurityEventDetail(eventId);
      setSelectedDetail(detail);
    } catch (loadError) {
      setSelectedDetail(null);
      setDetailError(loadError instanceof Error ? loadError.message : "详情加载失败");
    } finally {
      setDetailLoadingId(null);
    }
  }

  const isDetailDialogOpen = Boolean(selectedDetail || detailError);

  return (
    <div className="page-stack">
      <PageHeader
        title="审计日志"
        description={statusText}
        eyebrow="SECURITY EVENTS"
        actions={(
          <>
            <Link className="btn console-action-link" to={ROUTE_PATHS.rawEvents}>
              原始审计流水
            </Link>
            <Button
              className="console-action-button"
              htmlType="button"
              type="primary"
              onClick={() => setRefreshKey((value) => value + 1)}
            >
              立即刷新
            </Button>
          </>
        )}
      />

      <section className="audit-summary-grid" aria-label="当前筛选安全事件概览">
        {RISK_SUMMARY_CARDS.map((card) => (
          <article key={card.riskLevel} className={`overview-card ${card.cssClass}`}>
            <div>
              <p className="overview-card__label">{card.label}</p>
              <strong className="overview-card__value">
                {formatInteger(summary.riskCounts[card.riskLevel] ?? 0)}
              </strong>
            </div>
            <p className="overview-card__note">{card.note}</p>
          </article>
        ))}
        <article className="overview-card overview-card--total">
          <div>
            <p className="overview-card__label">安全事件总数</p>
            <strong className="overview-card__value">{formatInteger(summary.total)}</strong>
          </div>
          <p className="overview-card__note">当前筛选</p>
        </article>
      </section>

      <section className="filter-panel">
        <form className="audit-filter-form" onSubmit={handleSubmit}>
          <label className="filter-field">
            <span>风险等级</span>
            <Select
              allowClear
              maxTagCount="responsive"
              mode="multiple"
              aria-label="风险等级"
              options={RISK_OPTIONS}
              placeholder="全部级别"
              value={draftFilters.riskLevel}
              onChange={(value) => setDraftFilters((current) => ({ ...current, riskLevel: value ?? [] }))}
            />
          </label>

          <label className="filter-field">
            <span>事件类型</span>
            <Select
              allowClear
              maxTagCount="responsive"
              mode="multiple"
              aria-label="事件类型"
              options={EVENT_KIND_OPTIONS}
              placeholder="全部类型"
              value={draftFilters.eventKind}
              onChange={(value) => setDraftFilters((current) => ({ ...current, eventKind: value ?? [] }))}
            />
          </label>

          <label className="filter-field filter-field--search">
            <span>关键词</span>
            <Input
              allowClear
              aria-label="关键词"
              placeholder="搜索事件 ID、标题、摘要、对象"
              value={draftFilters.q}
              onChange={(event) => setDraftFilters((current) => ({ ...current, q: event.target.value }))}
            />
          </label>

          <label className="filter-field filter-field--date-range">
            <span>发生时间</span>
            <RangePicker
              allowClear
              aria-label="发生时间"
              className="audit-date-range-picker"
              placeholder={["开始日期", "结束日期"]}
              value={draftFilters.dateRange}
              onChange={(dateRange) => setDraftFilters((current) => ({ ...current, dateRange }))}
            />
          </label>

          <div className="audit-filter-form__actions">
            <Button htmlType="submit" type="primary">应用筛选</Button>
            <Button htmlType="button" onClick={handleReset}>重置条件</Button>
          </div>
        </form>
      </section>

      <section className="table-panel audit-events-table-panel" data-testid="audit-events-table-panel">
        <DataTable
          columns={[
            { key: "time", label: "时间" },
            { key: "type", label: "事件类型" },
            { key: "process", label: "过程" },
            { key: "object", label: "对象", maxWidth: 260, minWidth: 180, width: 220 },
            { key: "content", label: "内容摘要", maxWidth: 380, minWidth: 240, width: 300 },
            { key: "ruleTarget", label: "模块/规则/目标", maxWidth: 360, minWidth: 240, width: 300 },
            { key: "risk", label: "风险等级" },
            { key: "action", label: "处置动作" },
            { key: "qaRecord", label: "关联问答", maxWidth: 220, minWidth: 150, width: 180 },
            { key: "raw", label: "原始证据" },
            { key: "detail", label: "操作" },
          ]}
          emptyDescription="暂无安全事件"
          error={error}
          loading={loading}
          loadingLabel="正在加载安全事件"
          onRetry={retry}
          rows={items.map((event) => ({
            id: event.eventId,
            time: formatTimestamp(event.occurredAtMs),
            type: formatEventKind(event.eventKind),
            process: formatProcessCell(event),
            object: (
              <div className="row-stack audit-event-title-cell">
                <strong title={resolveObjectText(event)}>{resolveObjectText(event)}</strong>
                <span title={event.title}>{event.title}</span>
                <code title={event.eventId}>{event.eventId}</code>
              </div>
            ),
            content: (
              <span className="audit-event-content-cell" title={resolveContentSummary(event)}>
                {resolveContentSummary(event)}
              </span>
            ),
            ruleTarget: (
              <span className="audit-event-rule-cell" title={resolveModuleRuleTarget(event)}>
                {resolveModuleRuleTarget(event)}
              </span>
            ),
            risk: renderRiskBadge(event.riskLevel),
            action: renderActionBadge(event.enforcementAction),
            qaRecord: formatQaRecordId(event.qaRecordId),
            raw: formatRawEvidence(event),
            detail: (
              <button
                aria-label={`查看 ${event.eventId} 详情`}
                className="btn btn--compact"
                disabled={detailLoadingId === event.eventId}
                type="button"
                onClick={() => void handleOpenDetail(event.eventId)}
              >
                {detailLoadingId === event.eventId ? "加载中" : "详情"}
              </button>
            ),
          }))}
        />
        <TablePagination
          {...paginationProps}
          ariaLabel="审计日志分页"
        />
      </section>

      <ModalDialog
        closeLabel="关闭详情"
        open={isDetailDialogOpen}
        size="wide"
        title={selectedDetail?.title ?? "事件详情"}
        subtitle={detailError ? `详情加载失败：${detailError}` : selectedDetail?.eventId ?? "查看事件聚合与原始证据"}
        onClose={handleCloseDetail}
      >
        {selectedDetail ? (
          <div className="audit-detail-dialog">
            <section className="audit-detail-dialog__hero">
              <div className="audit-detail-dialog__heroText">
                <p className="audit-detail-dialog__eyebrow">事件概览</p>
                <p className="audit-detail-dialog__heroSubtitle">
                  {resolveObjectText(selectedDetail)}
                </p>
              </div>
              <div className="audit-detail-dialog__chips" aria-label="事件概览标签">
                <span className="audit-detail-dialog__chip">
                  <span className="audit-detail-dialog__chipLabel">事件类型</span>
                  <span className="audit-detail-dialog__chipValue">{formatEventKind(selectedDetail.eventKind)}</span>
                </span>
                <span className="audit-detail-dialog__chip">
                  <span className="audit-detail-dialog__chipLabel">过程</span>
                  <span className="audit-detail-dialog__chipValue">{formatProcessKind(selectedDetail.processKind)}</span>
                </span>
                <span className="audit-detail-dialog__chip">
                  <span className="audit-detail-dialog__chipLabel">风险等级</span>
                  <span className="audit-detail-dialog__chipValue">{renderRiskBadge(selectedDetail.riskLevel)}</span>
                </span>
                <span className="audit-detail-dialog__chip">
                  <span className="audit-detail-dialog__chipLabel">策略判定</span>
                  <span className="audit-detail-dialog__chipValue">
                    {renderPolicyDecisionBadge(selectedDetail.policyDecision, selectedDetail.enforcementAction)}
                  </span>
                </span>
                <span className="audit-detail-dialog__chip">
                  <span className="audit-detail-dialog__chipLabel">处置动作</span>
                  <span className="audit-detail-dialog__chipValue">{renderActionBadge(selectedDetail.enforcementAction)}</span>
                </span>
                <span className="audit-detail-dialog__chip">
                  <span className="audit-detail-dialog__chipLabel">关联问答</span>
                  <span className="audit-detail-dialog__chipValue">{formatQaRecordId(selectedDetail.qaRecordId)}</span>
                </span>
              </div>
            </section>

            <section className="audit-detail-dialog__section">
              <div className="panel__header audit-detail-dialog__sectionHeader">
                <div>
                  <h2 className="panel__title">基础信息</h2>
                  <p className="panel__subtitle">事件类型、过程、对象、时间和决策上下文。</p>
                </div>
              </div>
              <dl className="detail-panel__grid audit-detail-dialog__summary-grid">
                {[
                  { label: "事件类型", value: formatEventKind(selectedDetail.eventKind) },
                  { label: "过程", value: formatProcessKind(selectedDetail.processKind) },
                  { label: "风险等级", value: renderRiskBadge(selectedDetail.riskLevel) },
                  {
                    label: "策略判定",
                    value: renderPolicyDecisionBadge(selectedDetail.policyDecision, selectedDetail.enforcementAction),
                  },
                  { label: "处置动作", value: renderActionBadge(selectedDetail.enforcementAction) },
                  { label: "关联问答", value: formatQaRecordId(selectedDetail.qaRecordId) },
                  { label: "对象/内容", value: resolveObjectText(selectedDetail) },
                  { label: "发生时间", value: formatTimestamp(selectedDetail.occurredAtMs) },
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
                  <h2 className="panel__title">判断依据</h2>
                  <p className="panel__subtitle">规则、模块、评分和关键证据优先用可读字段展示。</p>
                </div>
              </div>
              <dl className="detail-panel__grid audit-detail-dialog__summary-grid">
                {[
                  { label: "触发模块", value: formatDetailList(selectedDetail.detailJson?.matchedModules) },
                  { label: "触发规则", value: formatDetailList(selectedDetail.detailJson?.matchedRules) },
                  { label: "风险等级", value: renderRiskBadge(selectedDetail.riskLevel) },
                  {
                    label: "决策/动作",
                    value: (
                      <span className="audit-detail-dialog__inline-badges">
                        {renderPolicyDecisionBadge(selectedDetail.policyDecision, selectedDetail.enforcementAction)}
                        {renderActionBadge(selectedDetail.enforcementAction)}
                      </span>
                    ),
                  },
                  { label: "风险评分", value: selectedDetail.riskScore !== undefined ? String(selectedDetail.riskScore) : "暂无" },
                  { label: "评分明细", value: formatScoreBreakdown(selectedDetail.detailJson?.scoreBreakdown) },
                  { label: "具体证据", value: formatConcreteEvidence(selectedDetail.detailJson?.evidence) },
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
                  <h2 className="panel__title">原始结构化详情</h2>
                  <p className="panel__subtitle">原始结构化详情。</p>
                </div>
              </div>
              <pre className="code-panel audit-detail-dialog__json">{formatDetailJson(selectedDetail.detailJson)}</pre>
            </section>

            <section className="detail-panel audit-detail-dialog__section">
              <div className="panel__header audit-detail-dialog__sectionHeader">
                <div>
                  <h2 className="panel__title">原始证据</h2>
                  <p className="panel__subtitle">支撑该安全事件的 hook 级审计流水。</p>
                </div>
              </div>
              <DataTable
                columns={[
                  { key: "time", label: "时间" },
                  { key: "event", label: "事件" },
                  { key: "hook", label: "Hook" },
                  { key: "category", label: "分类" },
                  { key: "risk", label: "风险" },
                ]}
                emptyDescription="暂无原始证据"
                rows={selectedDetail.rawAuditEvents.map((event) => ({
                  id: event.eventId,
                  time: formatTimestamp(event.occurredAtMs),
                  event: event.eventId,
                  hook: event.hookName,
                  category: event.category,
                  risk: renderRiskBadge(event.riskLevel),
                }))}
              />
            </section>
          </div>
        ) : null}
      </ModalDialog>
    </div>
  );
}
