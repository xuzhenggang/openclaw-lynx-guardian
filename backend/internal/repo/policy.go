package repo

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"time"

	"github.com/openclaw/lynx-guardian/backend/internal/api"
	"github.com/openclaw/lynx-guardian/backend/internal/service"
)

type ProtectedResourceListQuery struct {
	Q        *string
	Enabled  *bool
	PageNum  *int
	PageSize *int
	Limit    *int
}

type PolicyRuleListQuery struct {
	Q           *string
	Kind        *string
	Scope       *string
	PatternType *string
	Enabled     *bool
	PageNum     *int
	PageSize    *int
	Limit       *int
}

func (r *PolicyRepository) CreatePolicyVersion(ctx context.Context, actorID string, summary string) (api.PolicyVersion, error) {
	now := time.Now().UnixMilli()
	result, err := r.db.ExecContext(ctx,
		`INSERT INTO policy_versions (created_at_ms, created_by, change_summary) VALUES (?, ?, ?)`,
		now,
		actorID,
		summary,
	)
	if err != nil {
		return api.PolicyVersion{}, err
	}
	version, err := result.LastInsertId()
	if err != nil {
		return api.PolicyVersion{}, err
	}
	return api.PolicyVersion{
		Version:       version,
		CreatedAtMs:   now,
		CreatedBy:     actorID,
		ChangeSummary: summary,
	}, nil
}

func (r *PolicyRepository) CurrentVersion(ctx context.Context) (int64, error) {
	var version int64
	err := r.db.QueryRowContext(ctx, `SELECT COALESCE(MAX(version), 0) FROM policy_versions`).Scan(&version)
	return version, err
}

func (r *PolicyRepository) UpsertProtectedResource(ctx context.Context, request api.ProtectedResourceUpsertRequest) (api.ProtectedResource, error) {
	version, err := r.CreatePolicyVersion(ctx, request.ActorID, request.ChangeSummary)
	if err != nil {
		return api.ProtectedResource{}, err
	}
	now := time.Now().UnixMilli()
	id := strings.TrimSpace(request.ResourceID)
	if id == "" {
		id = stablePolicyID("protected-resource", request.Path, request.Preset)
	}
	_, err = r.db.ExecContext(ctx, `
		INSERT INTO protected_resources (resource_id, version, path, real_path, preset, enabled, created_by, created_at_ms, updated_at_ms)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(resource_id) DO UPDATE SET
			version=excluded.version,
			path=excluded.path,
			real_path=excluded.real_path,
			preset=excluded.preset,
			enabled=excluded.enabled,
			updated_at_ms=excluded.updated_at_ms
	`, id, version.Version, request.Path, request.RealPath, request.Preset, boolToInt(request.Enabled), request.ActorID, now, now)
	if err != nil {
		return api.ProtectedResource{}, err
	}
	return api.ProtectedResource{
		ResourceID:  id,
		Version:     version.Version,
		Path:        request.Path,
		RealPath:    request.RealPath,
		Preset:      request.Preset,
		Enabled:     request.Enabled,
		CreatedBy:   request.ActorID,
		CreatedAtMs: now,
		UpdatedAtMs: now,
	}, nil
}

func (r *PolicyRepository) UpsertPolicyRule(ctx context.Context, request api.PolicyRuleUpsertRequest) (api.PolicyRule, error) {
	version, err := r.CreatePolicyVersion(ctx, request.ActorID, request.ChangeSummary)
	if err != nil {
		return api.PolicyRule{}, err
	}
	now := time.Now().UnixMilli()
	id := strings.TrimSpace(request.RuleID)
	if id == "" {
		id = stablePolicyID("policy-rule", request.Kind, request.Scope, request.PatternType, request.Pattern)
	}
	_, err = r.db.ExecContext(ctx, `
		INSERT INTO policy_rules (rule_id, version, kind, scope, pattern_type, pattern, risk_delta, enabled, created_by, created_at_ms, updated_at_ms)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(rule_id) DO UPDATE SET
			version=excluded.version,
			kind=excluded.kind,
			scope=excluded.scope,
			pattern_type=excluded.pattern_type,
			pattern=excluded.pattern,
			risk_delta=excluded.risk_delta,
			enabled=excluded.enabled,
			updated_at_ms=excluded.updated_at_ms
	`, id, version.Version, request.Kind, request.Scope, request.PatternType, request.Pattern, request.RiskDelta, boolToInt(request.Enabled), request.ActorID, now, now)
	if err != nil {
		return api.PolicyRule{}, err
	}
	return api.PolicyRule{
		RuleID:      id,
		Version:     version.Version,
		Kind:        request.Kind,
		Scope:       request.Scope,
		PatternType: request.PatternType,
		Pattern:     request.Pattern,
		RiskDelta:   request.RiskDelta,
		Enabled:     request.Enabled,
		CreatedBy:   request.ActorID,
		CreatedAtMs: now,
		UpdatedAtMs: now,
	}, nil
}

func (r *PolicyRepository) Overview(ctx context.Context) (api.PolicyOverview, error) {
	version, err := r.CurrentVersion(ctx)
	if err != nil {
		return api.PolicyOverview{}, err
	}
	rules, err := r.ListPolicyRules(ctx)
	if err != nil {
		return api.PolicyOverview{}, err
	}
	resources, err := r.ListProtectedResources(ctx)
	if err != nil {
		return api.PolicyOverview{}, err
	}
	return api.PolicyOverview{
		CurrentVersion:     version,
		Rules:              rules,
		ProtectedResources: resources,
	}, nil
}

func (r *PolicyRepository) ListPolicyRules(ctx context.Context) ([]api.PolicyRule, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT rule_id, version, kind, scope, pattern_type, pattern, risk_delta, enabled, created_by, created_at_ms, updated_at_ms
		FROM policy_rules
		ORDER BY updated_at_ms DESC, rule_id ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]api.PolicyRule, 0)
	for rows.Next() {
		var item api.PolicyRule
		var enabled int64
		if err := rows.Scan(
			&item.RuleID,
			&item.Version,
			&item.Kind,
			&item.Scope,
			&item.PatternType,
			&item.Pattern,
			&item.RiskDelta,
			&enabled,
			&item.CreatedBy,
			&item.CreatedAtMs,
			&item.UpdatedAtMs,
		); err != nil {
			return nil, err
		}
		item.Enabled = fromBoolInt(enabled)
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *PolicyRepository) ListPolicyRulesPage(ctx context.Context, query PolicyRuleListQuery) (service.PageResponse[api.PolicyRule], error) {
	page := service.ResolvePageRequest(query.PageNum, query.PageSize, query.Limit)
	filter := policyRuleListFilter(query)

	total, err := countRowsContext(ctx, r.db, "policy_rules", filter)
	if err != nil {
		return service.PageResponse[api.PolicyRule]{}, err
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT rule_id, version, kind, scope, pattern_type, pattern, risk_delta, enabled, created_by, created_at_ms, updated_at_ms
		FROM policy_rules `+filter.Where()+`
		ORDER BY updated_at_ms DESC, rule_id ASC
		LIMIT ? OFFSET ?
	`, append(filter.Params(), page.PageSize, page.Offset)...)
	if err != nil {
		return service.PageResponse[api.PolicyRule]{}, err
	}
	defer rows.Close()

	out := make([]api.PolicyRule, 0, page.PageSize)
	for rows.Next() {
		item, err := scanPolicyRule(rows)
		if err != nil {
			return service.PageResponse[api.PolicyRule]{}, err
		}
		out = append(out, item)
	}
	if err := rows.Err(); err != nil {
		return service.PageResponse[api.PolicyRule]{}, err
	}
	return service.BuildPageResponse(out, total, page), nil
}

func (r *PolicyRepository) ListProtectedResources(ctx context.Context) ([]api.ProtectedResource, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT resource_id, version, path, COALESCE(real_path, ''), preset, enabled, created_by, created_at_ms, updated_at_ms
		FROM protected_resources
		ORDER BY updated_at_ms DESC, resource_id ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]api.ProtectedResource, 0)
	for rows.Next() {
		var item api.ProtectedResource
		var enabled int64
		if err := rows.Scan(
			&item.ResourceID,
			&item.Version,
			&item.Path,
			&item.RealPath,
			&item.Preset,
			&enabled,
			&item.CreatedBy,
			&item.CreatedAtMs,
			&item.UpdatedAtMs,
		); err != nil {
			return nil, err
		}
		item.Enabled = fromBoolInt(enabled)
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *PolicyRepository) ListProtectedResourcesPage(ctx context.Context, query ProtectedResourceListQuery) (service.PageResponse[api.ProtectedResource], error) {
	page := service.ResolvePageRequest(query.PageNum, query.PageSize, query.Limit)
	filter := protectedResourceListFilter(query)

	total, err := countRowsContext(ctx, r.db, "protected_resources", filter)
	if err != nil {
		return service.PageResponse[api.ProtectedResource]{}, err
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT resource_id, version, path, COALESCE(real_path, ''), preset, enabled, created_by, created_at_ms, updated_at_ms
		FROM protected_resources `+filter.Where()+`
		ORDER BY updated_at_ms DESC, resource_id ASC
		LIMIT ? OFFSET ?
	`, append(filter.Params(), page.PageSize, page.Offset)...)
	if err != nil {
		return service.PageResponse[api.ProtectedResource]{}, err
	}
	defer rows.Close()

	out := make([]api.ProtectedResource, 0, page.PageSize)
	for rows.Next() {
		item, err := scanProtectedResource(rows)
		if err != nil {
			return service.PageResponse[api.ProtectedResource]{}, err
		}
		out = append(out, item)
	}
	if err := rows.Err(); err != nil {
		return service.PageResponse[api.ProtectedResource]{}, err
	}
	return service.BuildPageResponse(out, total, page), nil
}

func protectedResourceListFilter(query ProtectedResourceListQuery) *Filter {
	filter := &Filter{}
	filter.AppendTextSearch([]string{
		"resource_id",
		"path",
		"real_path",
		"preset",
		"created_by",
	}, query.Q)
	filter.AppendBool("enabled", query.Enabled)
	return filter
}

func policyRuleListFilter(query PolicyRuleListQuery) *Filter {
	filter := &Filter{}
	filter.AppendTextSearch([]string{
		"rule_id",
		"kind",
		"scope",
		"pattern_type",
		"pattern",
		"created_by",
	}, query.Q)
	filter.AppendEquals("kind", query.Kind)
	filter.AppendEquals("scope", query.Scope)
	filter.AppendEquals("pattern_type", query.PatternType)
	filter.AppendBool("enabled", query.Enabled)
	return filter
}

type policyRuleScanner interface {
	Scan(dest ...any) error
}

func scanPolicyRule(scanner policyRuleScanner) (api.PolicyRule, error) {
	var item api.PolicyRule
	var enabled int64
	err := scanner.Scan(
		&item.RuleID,
		&item.Version,
		&item.Kind,
		&item.Scope,
		&item.PatternType,
		&item.Pattern,
		&item.RiskDelta,
		&enabled,
		&item.CreatedBy,
		&item.CreatedAtMs,
		&item.UpdatedAtMs,
	)
	if err != nil {
		return api.PolicyRule{}, err
	}
	item.Enabled = fromBoolInt(enabled)
	return item, nil
}

type protectedResourceScanner interface {
	Scan(dest ...any) error
}

func scanProtectedResource(scanner protectedResourceScanner) (api.ProtectedResource, error) {
	var item api.ProtectedResource
	var enabled int64
	err := scanner.Scan(
		&item.ResourceID,
		&item.Version,
		&item.Path,
		&item.RealPath,
		&item.Preset,
		&enabled,
		&item.CreatedBy,
		&item.CreatedAtMs,
		&item.UpdatedAtMs,
	)
	if err != nil {
		return api.ProtectedResource{}, err
	}
	item.Enabled = fromBoolInt(enabled)
	return item, nil
}

func (r *PolicyRepository) InsertScriptFindings(ctx context.Context, decisionID string, req api.DecisionRequest) error {
	if decisionID == "" || len(req.ScriptEvidence) == 0 {
		return nil
	}
	now := time.Now().UnixMilli()
	for _, evidence := range req.ScriptEvidence {
		for _, finding := range evidence.Findings {
			var line any
			if finding.Line != nil {
				line = *finding.Line
			}
			id := stablePolicyID("script-finding", decisionID, evidence.EvidenceID, finding.RuleID, finding.Behavior)
			_, err := r.db.ExecContext(ctx, `
				INSERT OR REPLACE INTO script_findings (
					finding_id, decision_id, session_key, script_path, real_path, sha256,
					rule_id, module, severity, behavior, line, snippet, confidence, created_at_ms
				)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
				id,
				decisionID,
				req.SessionKey,
				evidence.ScriptPath,
				evidence.RealPath,
				evidence.SHA256,
				finding.RuleID,
				finding.Module,
				finding.Severity,
				finding.Behavior,
				line,
				finding.Snippet,
				finding.Confidence,
				now,
			)
			if err != nil {
				return err
			}
		}
	}
	return r.InsertScriptTaints(ctx, decisionID, req)
}

func (r *PolicyRepository) InsertScriptTaints(ctx context.Context, sourceToolCallID string, req api.DecisionRequest) error {
	if len(req.ScriptEvidence) == 0 {
		return nil
	}
	now := time.Now().UnixMilli()
	expiresAt := now + (7 * 24 * time.Hour).Milliseconds()
	for _, evidence := range req.ScriptEvidence {
		if evidence.EntrypointKind != "script_write" || !riskLevelPersistsScriptTaint(evidence.RiskLevel) {
			continue
		}
		path := nonEmptyString(evidence.RealPath, evidence.ScriptPath)
		if path == "" && evidence.SHA256 == "" {
			continue
		}
		var version any
		if req.PolicyVersion > 0 {
			version = req.PolicyVersion
		}
		ruleIDs := scriptFindingRuleIDs(evidence.Findings)
		id := stablePolicyID("script-taint", req.SessionKey, path, evidence.SHA256)
		_, err := r.db.ExecContext(ctx, `
			INSERT OR REPLACE INTO script_taints (
				taint_id, version, session_key, real_path, sha256, risk_level,
				rule_ids_json, source_tool_call_id, created_at_ms, expires_at_ms
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			id,
			version,
			req.SessionKey,
			path,
			evidence.SHA256,
			evidence.RiskLevel,
			toJSONText(ruleIDs, "[]"),
			sourceToolCallID,
			now,
			expiresAt,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *PolicyRepository) MatchingScriptTaintEvidence(ctx context.Context, req api.DecisionRequest) ([]api.ScriptPreflightEvidence, error) {
	if len(req.ScriptEvidence) == 0 {
		return nil, nil
	}
	out := make([]api.ScriptPreflightEvidence, 0)
	seen := map[string]bool{}
	for _, evidence := range req.ScriptEvidence {
		if evidence.EntrypointKind != "direct_file" || evidence.Source == "taint" {
			continue
		}
		path := nonEmptyString(evidence.RealPath, evidence.ScriptPath)
		rows, err := r.db.QueryContext(ctx, `
			SELECT taint_id, COALESCE(real_path, ''), COALESCE(sha256, ''), risk_level
			FROM script_taints
			WHERE (? = '' OR session_key = ?)
			  AND (expires_at_ms IS NULL OR expires_at_ms > ?)
			  AND ((? != '' AND sha256 = ?) OR (? != '' AND real_path = ?))
			ORDER BY created_at_ms DESC, taint_id DESC
			LIMIT 4
		`,
			req.SessionKey,
			req.SessionKey,
			time.Now().UnixMilli(),
			evidence.SHA256,
			evidence.SHA256,
			path,
			path,
		)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var taintID, realPath, sha256, riskLevel string
			if err := rows.Scan(&taintID, &realPath, &sha256, &riskLevel); err != nil {
				_ = rows.Close()
				return nil, err
			}
			if seen[taintID] {
				continue
			}
			seen[taintID] = true
			out = append(out, api.ScriptPreflightEvidence{
				EvidenceID:        "taint-" + taintID,
				EntrypointKind:    "direct_file",
				Source:            "taint",
				ScriptPath:        evidence.ScriptPath,
				RealPath:          realPath,
				SHA256:            sha256,
				Language:          evidence.Language,
				ReadStatus:        "skipped",
				ReadReason:        "risk inherited from prior script write",
				RiskLevel:         api.RiskLevel(riskLevel),
				RecommendedAction: "deny",
				Findings: []api.ScriptFinding{
					{
						RuleID:     "script.taint_inherited",
						Module:     "concealed_execution",
						Severity:   "critical",
						Behavior:   "script was previously written with high-risk findings and is now being executed",
						Confidence: "high",
					},
				},
			})
		}
		if err := rows.Close(); err != nil {
			return nil, err
		}
		if err := rows.Err(); err != nil {
			return nil, err
		}
	}
	return out, nil
}

func stablePolicyID(parts ...string) string {
	sum := sha256.Sum256([]byte(strings.Join(parts, "\x00")))
	return hex.EncodeToString(sum[:16])
}

func riskLevelPersistsScriptTaint(riskLevel api.RiskLevel) bool {
	return riskLevel == "L3" || riskLevel == "L4"
}

func scriptFindingRuleIDs(findings []api.ScriptFinding) []string {
	out := make([]string, 0, len(findings))
	for _, finding := range findings {
		if finding.RuleID != "" {
			out = append(out, finding.RuleID)
		}
	}
	return out
}
