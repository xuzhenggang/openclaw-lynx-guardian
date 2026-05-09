import type { PageResponse } from "@lynx/local-console-shared";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button, Input } from "antd";

import {
  createPolicyRule,
  createProtectedResource,
  getPolicyOverview,
  listPolicyRules,
  listProtectedResources,
  type PolicyOverview,
  type PolicyRule,
  type PolicyRuleListQuery,
  type ProtectedResource,
  type ProtectedResourceListQuery,
} from "../api/policies";
import { ModalDialog } from "../components/feedback/ModalDialog";
import { PageHeader } from "../components/layout/PageHeader";
import { DataTable } from "../components/tables/DataTable";
import { TablePagination } from "../components/tables/TablePagination";
import { usePagedListResource } from "../hooks/usePagedListResource";
import { formatInteger } from "../utils/format";

const PRESET_LABELS = {
  deny_all: "不允许访问",
  read_only: "只允许读",
  no_modify: "不允许修改",
  no_delete: "不允许删除",
} as const satisfies Record<ProtectedResource["preset"], string>;

const SCOPE_LABELS = {
  input: "输入提示词",
  tool: "工具调用",
  script: "脚本命令",
  output: "输出内容",
} as const satisfies Record<PolicyRule["scope"], string>;

const PATTERN_TYPE_LABELS = {
  literal: "整段文本",
  regex: "正则整段匹配",
} as const satisfies Record<PolicyRule["patternType"], string>;

const EMPTY_OVERVIEW: PolicyOverview = {
  currentVersion: 0,
  protectedResources: [],
  rules: [],
};

type RuleKind = PolicyRule["kind"];
type PolicyListKind = "resource" | RuleKind;
type PolicyListItem = ProtectedResource | PolicyRule;
type PolicyListQuery = ProtectedResourceListQuery & PolicyRuleListQuery;
type PolicyDialog =
  | { family: "resource"; mode: "create" | "edit"; resource?: ProtectedResource }
  | { family: RuleKind; mode: "create" | "edit"; rule?: PolicyRule }
  | null;

const POLICY_LISTS: Record<PolicyListKind, {
  addLabel: string;
  description: string;
  emptyDescription: string;
  heading: string;
  paginationLabel: string;
  tabLabel: string;
}> = {
  resource: {
    addLabel: "添加目录防护",
    description: "受保护目录按疑似访问路径触发，列表独立分页，避免和黑白名单挤在同一个窄表格里。",
    emptyDescription: "暂无目录防护",
    heading: "目录防护列表",
    paginationLabel: "目录防护分页",
    tabLabel: "目录防护",
  },
  blacklist: {
    addLabel: "添加黑名单",
    description: "黑名单按完整提示词或命令文本匹配，用于提高风险评分；不和白名单混排。",
    emptyDescription: "暂无黑名单规则",
    heading: "黑名单列表",
    paginationLabel: "黑名单分页",
    tabLabel: "黑名单",
  },
  allowlist: {
    addLabel: "添加白名单",
    description: "白名单只用于低风险降噪，不能覆盖 L4 硬拒绝、目录防护或脚本外传证据。",
    emptyDescription: "暂无白名单规则",
    heading: "白名单列表",
    paginationLabel: "白名单分页",
    tabLabel: "白名单",
  },
};

function formatPreset(value: ProtectedResource["preset"]): string {
  return PRESET_LABELS[value] ?? value;
}

function formatScope(value: PolicyRule["scope"]): string {
  return SCOPE_LABELS[value] ?? value;
}

function formatPatternType(value: PolicyRule["patternType"]): string {
  return PATTERN_TYPE_LABELS[value] ?? value;
}

function ruleKindLabel(kind: PolicyRule["kind"]): string {
  return kind === "blacklist" ? "黑名单" : "白名单";
}

function dialogTitle(dialog: NonNullable<PolicyDialog>): string {
  const prefix = dialog.mode === "edit" ? "修改" : "添加";
  return dialog.family === "resource" ? `${prefix}目录防护` : `${prefix}${ruleKindLabel(dialog.family)}`;
}

function enabledLabel(enabled: boolean): string {
  return enabled ? "启用" : "停用";
}

function isProtectedResource(item: PolicyListItem): item is ProtectedResource {
  return "resourceId" in item;
}

function isPolicyRule(item: PolicyListItem): item is PolicyRule {
  return "ruleId" in item;
}

export function PoliciesPage() {
  const [overview, setOverview] = useState<PolicyOverview>(EMPTY_OVERVIEW);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [activeList, setActiveList] = useState<PolicyListKind>("resource");
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const [dialog, setDialog] = useState<PolicyDialog>(null);
  const [resourcePath, setResourcePath] = useState("");
  const [resourcePreset, setResourcePreset] = useState<ProtectedResource["preset"]>("read_only");
  const [ruleScope, setRuleScope] = useState<PolicyRule["scope"]>("input");
  const [patternType, setPatternType] = useState<PolicyRule["patternType"]>("literal");
  const [pattern, setPattern] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadOverview(): Promise<void> {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      setOverview(await getPolicyOverview());
    } catch (loadError) {
      setOverviewError(loadError instanceof Error ? loadError.message : "策略配置加载失败");
    } finally {
      setOverviewLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, []);

  const activeQuery = useMemo<Omit<PolicyListQuery, "pageNum" | "pageSize">>(() => (
    activeList === "resource" ? {} : { kind: activeList }
  ), [activeList]);

  const policyList = usePagedListResource<PolicyListItem, PolicyListQuery>({
    loadPage: async (query) => {
      if (activeList === "resource") {
        const page = await listProtectedResources(query);
        return page as PageResponse<PolicyListItem>;
      }
      const page = await listPolicyRules({ ...query, kind: activeList });
      return page as PageResponse<PolicyListItem>;
    },
    query: activeQuery,
    refreshKey: `${activeList}:${listRefreshKey}`,
  });

  const enabledResources = useMemo(
    () => overview.protectedResources.filter((resource) => resource.enabled),
    [overview.protectedResources],
  );
  const blacklistRules = useMemo(
    () => overview.rules.filter((rule) => rule.enabled && rule.kind === "blacklist"),
    [overview.rules],
  );
  const allowlistRules = useMemo(
    () => overview.rules.filter((rule) => rule.enabled && rule.kind === "allowlist"),
    [overview.rules],
  );
  const activeConfig = POLICY_LISTS[activeList];

  function refreshActiveList(): void {
    setListRefreshKey((current) => current + 1);
  }

  function closeDialog(): void {
    if (!submitting) {
      setDialog(null);
    }
  }

  function openResourceDialog(resource?: ProtectedResource): void {
    setResourcePath(resource?.path ?? "");
    setResourcePreset(resource?.preset ?? "read_only");
    setDialog({
      family: "resource",
      mode: resource ? "edit" : "create",
      resource,
    });
  }

  function openRuleDialog(kind: RuleKind, rule?: PolicyRule): void {
    setRuleScope(rule?.scope ?? "input");
    setPatternType(rule?.patternType ?? "literal");
    setPattern(rule?.pattern ?? "");
    setDialog({
      family: kind,
      mode: rule ? "edit" : "create",
      rule,
    });
  }

  function switchList(kind: PolicyListKind): void {
    if (kind === activeList) {
      return;
    }
    policyList.resetPaging();
    setActiveList(kind);
  }

  async function handleCreateResource(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const path = resourcePath.trim();
    if (!path) {
      return;
    }
    const existingResource = dialog?.family === "resource" ? dialog.resource : undefined;
    setSubmitting(true);
    setOverviewError(null);
    try {
      const created = await createProtectedResource({
        resourceId: existingResource?.resourceId,
        path,
        preset: resourcePreset,
        enabled: existingResource?.enabled ?? true,
        actorId: "local-user",
        changeSummary: existingResource ? `update protected resource ${path}` : `add protected resource ${path}`,
      });
      setOverview((current) => ({
        ...current,
        currentVersion: Math.max(current.currentVersion, created.version),
        protectedResources: [created, ...current.protectedResources.filter((item) => item.resourceId !== created.resourceId)],
      }));
      setResourcePath("");
      setDialog(null);
      refreshActiveList();
    } catch (createError) {
      setOverviewError(createError instanceof Error ? createError.message : "目录防护保存失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateRule(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!dialog || dialog.family === "resource") {
      return;
    }
    const kind = dialog.family;
    const existingRule = dialog.rule;
    const rulePattern = pattern.trim();
    if (!rulePattern) {
      return;
    }
    setSubmitting(true);
    setOverviewError(null);
    try {
      const created = await createPolicyRule({
        ruleId: existingRule?.ruleId,
        kind,
        scope: ruleScope,
        patternType,
        pattern: rulePattern,
        riskDelta: kind === "blacklist" ? 70 : -15,
        enabled: existingRule?.enabled ?? true,
        actorId: "local-user",
        changeSummary: existingRule ? `update ${kind} full-text rule ${rulePattern}` : `add ${kind} full-text rule ${rulePattern}`,
      });
      setOverview((current) => ({
        ...current,
        currentVersion: Math.max(current.currentVersion, created.version),
        rules: [created, ...current.rules.filter((item) => item.ruleId !== created.ruleId)],
      }));
      setPattern("");
      setDialog(null);
      refreshActiveList();
    } catch (createError) {
      setOverviewError(createError instanceof Error ? createError.message : `${ruleKindLabel(kind)}保存失败`);
    } finally {
      setSubmitting(false);
    }
  }

  const statusText = overviewError
    ? `策略配置加载失败：${overviewError}`
    : overviewLoading
      ? "正在加载策略配置概览"
      : "目录防护、黑名单和白名单分开查看；三类列表都走后端分页，白名单不能覆盖 L4 硬拒绝。";

  const rows = activeList === "resource"
    ? policyList.items.filter(isProtectedResource).map((resource) => ({
      id: resource.resourceId,
      path: resource.path,
      preset: formatPreset(resource.preset),
      version: `策略版本 ${formatInteger(resource.version)}`,
      enabled: enabledLabel(resource.enabled),
      action: (
        <Button
          aria-label={`修改目录防护 ${resource.path}`}
          type="link"
          onClick={() => openResourceDialog(resource)}
        >
          修改
        </Button>
      ),
    }))
    : policyList.items.filter((item): item is PolicyRule => isPolicyRule(item) && item.kind === activeList).map((rule) => ({
      id: rule.ruleId,
      scope: formatScope(rule.scope),
      patternType: formatPatternType(rule.patternType),
      pattern: rule.pattern,
      riskDelta: rule.riskDelta >= 0 ? `+${formatInteger(rule.riskDelta)}` : formatInteger(rule.riskDelta),
      enabled: enabledLabel(rule.enabled),
      version: `策略版本 ${formatInteger(rule.version)}`,
      action: (
        <Button
          aria-label={`修改${ruleKindLabel(rule.kind)} ${rule.pattern}`}
          type="link"
          onClick={() => openRuleDialog(rule.kind, rule)}
        >
          修改
        </Button>
      ),
    }));

  const columns = activeList === "resource"
    ? [
      { key: "path", label: "目录路径", maxWidth: 520, minWidth: 300, width: 420 },
      { key: "preset", label: "权限预设", maxWidth: 160, minWidth: 112, width: 128 },
      { key: "version", label: "策略版本", maxWidth: 160, minWidth: 112, width: 128 },
      { key: "enabled", label: "状态", maxWidth: 128, minWidth: 96, width: 104 },
      { key: "action", label: "操作" },
    ]
    : [
      { key: "scope", label: "作用域", maxWidth: 160, minWidth: 112, width: 128 },
      { key: "patternType", label: "匹配方式", maxWidth: 180, minWidth: 128, width: 144 },
      { key: "pattern", label: "完整匹配内容", maxWidth: 520, minWidth: 300, width: 420 },
      { key: "riskDelta", label: "风险调整", maxWidth: 128, minWidth: 96, width: 104 },
      { key: "enabled", label: "状态", maxWidth: 128, minWidth: 96, width: 104 },
      { key: "version", label: "策略版本", maxWidth: 160, minWidth: 112, width: 128 },
      { key: "action", label: "操作" },
    ];

  return (
    <div className="page-stack">
      <PageHeader
        title="策略配置"
        description={statusText}
        eyebrow="POLICY CONTROL PLANE"
      />

      <section className="metric-grid metric-grid--compact policy-metrics">
        <article className="metric-card">
          <p className="metric-card__label">目录防护</p>
          <strong className="metric-card__value">{formatInteger(enabledResources.length)}</strong>
          <p className="metric-card__note">疑似路径访问触发</p>
        </article>
        <article className="metric-card">
          <p className="metric-card__label">黑名单</p>
          <strong className="metric-card__value">{formatInteger(blacklistRules.length)}</strong>
          <p className="metric-card__note">完整文本命中</p>
        </article>
        <article className="metric-card">
          <p className="metric-card__label">白名单</p>
          <strong className="metric-card__value">{formatInteger(allowlistRules.length)}</strong>
          <p className="metric-card__note">低风险降噪</p>
        </article>
        <article className="metric-card">
          <p className="metric-card__label">总数</p>
          <strong className="metric-card__value">{formatInteger(enabledResources.length + blacklistRules.length + allowlistRules.length)}</strong>
          <p className="metric-card__note">策略版本 {formatInteger(overview.currentVersion)}</p>
        </article>
      </section>

      {dialog?.family === "resource" ? (
        <ModalDialog
          closeLabel={`关闭${dialogTitle(dialog)}`}
          open
          title={dialogTitle(dialog)}
          subtitle="目录防护按疑似访问路径触发，不包含执行禁用项。"
          onClose={closeDialog}
        >
          <form className="audit-filter-form audit-filter-form--compact" onSubmit={(event) => void handleCreateResource(event)}>
            <label className="filter-field filter-field--search">
              <span>目录路径</span>
              <Input
                allowClear
                aria-label="目录路径"
                placeholder="C:\\Users\\alice\\Secrets"
                value={resourcePath}
                onChange={(event) => setResourcePath(event.target.value)}
              />
            </label>
            <label className="filter-field">
              <span>权限预设</span>
              <select
                aria-label="权限预设"
                value={resourcePreset}
                onChange={(event) => setResourcePreset(event.target.value as ProtectedResource["preset"])}
              >
                {Object.entries(PRESET_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <div className="audit-filter-form__actions policy-form-actions">
              <Button onClick={closeDialog}>取消</Button>
              <Button htmlType="submit" loading={submitting} type="primary">保存目录防护</Button>
            </div>
          </form>
        </ModalDialog>
      ) : null}

      {dialog?.family === "blacklist" || dialog?.family === "allowlist" ? (
        <ModalDialog
          closeLabel={`关闭${dialogTitle(dialog)}`}
          open
          title={dialogTitle(dialog)}
          subtitle={`${ruleKindLabel(dialog.family)}按完整提示词或命令文本匹配，白名单不能覆盖 L4 硬拒绝。`}
          onClose={closeDialog}
        >
          <form className="audit-filter-form audit-filter-form--compact" onSubmit={(event) => void handleCreateRule(event)}>
            <label className="filter-field">
              <span>作用域</span>
              <select
                aria-label={`${ruleKindLabel(dialog.family)}作用域`}
                value={ruleScope}
                onChange={(event) => setRuleScope(event.target.value as PolicyRule["scope"])}
              >
                {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="filter-field">
              <span>匹配方式</span>
              <select
                aria-label={`${ruleKindLabel(dialog.family)}匹配方式`}
                value={patternType}
                onChange={(event) => setPatternType(event.target.value as PolicyRule["patternType"])}
              >
                {Object.entries(PATTERN_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="filter-field filter-field--search">
              <span>匹配内容</span>
              <Input
                allowClear
                aria-label={`${ruleKindLabel(dialog.family)}匹配内容`}
                placeholder={dialog.family === "blacklist" ? "完整高风险提示词或命令" : "完整低风险提示词或命令"}
                value={pattern}
                onChange={(event) => setPattern(event.target.value)}
              />
            </label>
            <div className="audit-filter-form__actions policy-form-actions">
              <Button onClick={closeDialog}>取消</Button>
              <Button htmlType="submit" loading={submitting} type="primary">{`保存${ruleKindLabel(dialog.family)}`}</Button>
            </div>
          </form>
        </ModalDialog>
      ) : null}

      <section className="policy-list-panel table-panel">
        <div className="policy-list-tabs" role="tablist" aria-label="策略配置列表类型">
          {(Object.keys(POLICY_LISTS) as PolicyListKind[]).map((kind) => (
            <button
              aria-selected={activeList === kind}
              className={activeList === kind ? "policy-list-tab policy-list-tab--active" : "policy-list-tab"}
              key={kind}
              role="tab"
              type="button"
              onClick={() => switchList(kind)}
            >
              {POLICY_LISTS[kind].tabLabel}
            </button>
          ))}
        </div>

        <div className="table-panel__header">
          <div>
            <h2 className="panel__title">{activeConfig.heading}</h2>
            <p className="panel__subtitle">{activeConfig.description}</p>
          </div>
          <Button
            type="primary"
            onClick={() => {
              if (activeList === "resource") {
                openResourceDialog();
                return;
              }
              openRuleDialog(activeList);
            }}
          >
            {activeConfig.addLabel}
          </Button>
        </div>

        <DataTable
          columns={columns}
          emptyDescription={activeConfig.emptyDescription}
          error={policyList.error}
          loading={policyList.loading}
          loadingLabel={`正在加载${activeConfig.heading}`}
          onRetry={policyList.retry}
          rows={rows}
        />
        <TablePagination {...policyList.paginationProps} ariaLabel={activeConfig.paginationLabel} />
      </section>
    </div>
  );
}
