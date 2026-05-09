import type { PageResponse } from "@lynx/local-console-shared";

import { buildQueryString, fetchJson } from "./client";

export interface PolicyRule {
  ruleId: string;
  version: number;
  kind: "blacklist" | "allowlist";
  scope: "input" | "tool" | "script" | "output";
  patternType: "literal" | "regex";
  pattern: string;
  riskDelta: number;
  enabled: boolean;
  createdBy: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface ProtectedResource {
  resourceId: string;
  version: number;
  path: string;
  realPath?: string;
  preset: "deny_all" | "read_only" | "no_modify" | "no_delete";
  enabled: boolean;
  createdBy: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface PolicyOverview {
  currentVersion: number;
  rules: PolicyRule[];
  protectedResources: ProtectedResource[];
}

export interface ProtectedResourceListQuery {
  q?: string;
  enabled?: boolean;
  pageNum?: number;
  pageSize?: number;
  limit?: number;
}

export interface PolicyRuleListQuery {
  q?: string;
  kind?: PolicyRule["kind"];
  scope?: PolicyRule["scope"];
  patternType?: PolicyRule["patternType"];
  enabled?: boolean;
  pageNum?: number;
  pageSize?: number;
  limit?: number;
}

export function getPolicyOverview(): Promise<PolicyOverview> {
  return fetchJson<PolicyOverview>("/policies");
}

export function listProtectedResources(query: ProtectedResourceListQuery = {}): Promise<PageResponse<ProtectedResource>> {
  return fetchJson<PageResponse<ProtectedResource>>(`/protected-resources${buildQueryString(query)}`);
}

export function listPolicyRules(query: PolicyRuleListQuery = {}): Promise<PageResponse<PolicyRule>> {
  return fetchJson<PageResponse<PolicyRule>>(`/policy-rules${buildQueryString(query)}`);
}

export function createProtectedResource(input: {
  resourceId?: string;
  path: string;
  realPath?: string;
  preset: ProtectedResource["preset"];
  enabled: boolean;
  actorId: string;
  changeSummary: string;
}): Promise<ProtectedResource> {
  return fetchJson<ProtectedResource>("/protected-resources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function createPolicyRule(input: {
  ruleId?: string;
  kind: PolicyRule["kind"];
  scope: PolicyRule["scope"];
  patternType: PolicyRule["patternType"];
  pattern: string;
  riskDelta: number;
  enabled: boolean;
  actorId: string;
  changeSummary: string;
}): Promise<PolicyRule> {
  return fetchJson<PolicyRule>("/policy-rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
