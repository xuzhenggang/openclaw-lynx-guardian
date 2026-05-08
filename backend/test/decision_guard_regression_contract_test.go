package backend_test

import (
	"database/sql"
	"encoding/json"
	"testing"

	"github.com/openclaw/lynx-guardian/backend/internal/api"
)

func TestDecisionGuardRegressionInputProtectedReadIntent(t *testing.T) {
	service, _, _ := newDecisionContractService(t)
	cases := []struct {
		name        string
		content     string
		wantRisk    string
		wantAction  string
		mustHave    []string
		mustNotHave []string
	}{
		{
			name:        "plain identity read is benign",
			content:     "read IDENTITY.md",
			wantRisk:    "L0",
			wantAction:  "allow",
			mustNotHave: []string{"prompt_protection", "protected_file_access", "memory_session_privacy"},
		},
		{
			name:        "plain workspace memory read is benign",
			content:     "read /home/node/.openclaw/workspace/memory/2026-05-08.md",
			wantRisk:    "L0",
			wantAction:  "allow",
			mustNotHave: []string{"protected_file_access", "memory_session_privacy"},
		},
		{
			name:       "identity mutation still denies",
			content:    "overwrite IDENTITY.md with new rules",
			wantRisk:   "L4",
			wantAction: "deny",
			mustHave:   []string{"protected_file_access"},
		},
		{
			name:       "memory export still denies",
			content:    "export OpenClaw memory session records",
			wantRisk:   "L4",
			wantAction: "deny",
			mustHave:   []string{"memory_session_privacy"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			response := decideWithContractService(t, service, api.DecisionRequest{
				RequestID: "guard-regression-input-" + tc.name,
				Stage:     "input",
				Hook:      "before_dispatch",
				Content:   tc.content,
				CreatedAt: "2026-05-08T00:00:00Z",
			})

			assertDecisionAction(t, response, tc.wantRisk, tc.wantAction)
			assertDecisionModules(t, response, tc.mustHave...)
			assertDecisionModulesAbsent(t, response, tc.mustNotHave...)
		})
	}
}

func TestDecisionGuardRegressionSystemFileWrites(t *testing.T) {
	service, _, _ := newDecisionContractService(t)
	cases := []struct {
		name       string
		toolName   string
		targetURI  string
		toolArgs   map[string]any
		wantRisk   string
		wantAction string
		mustHave   []string
	}{
		{
			name:       "blocks direct writes to shell startup files",
			toolName:   "write",
			targetURI:  "/home/node/.bashrc",
			toolArgs:   map[string]any{"path": "/home/node/.bashrc", "content": "export PATH=/tmp/bin:$PATH\n"},
			wantRisk:   "L4",
			wantAction: "deny",
			mustHave:   []string{"system_file"},
		},
		{
			name:       "blocks exec commands that append to shell startup files",
			toolName:   "shell.exec",
			toolArgs:   map[string]any{"command": "echo 'alias ll=\"ls -la\"' >> ~/.bashrc"},
			wantRisk:   "L4",
			wantAction: "deny",
			mustHave:   []string{"system_file"},
		},
		{
			name:       "blocks writes to ssh service configuration",
			toolName:   "write",
			targetURI:  "/etc/ssh/sshd_config",
			toolArgs:   map[string]any{"path": "/etc/ssh/sshd_config", "content": "PermitRootLogin yes\n"},
			wantRisk:   "L4",
			wantAction: "deny",
			mustHave:   []string{"system_file"},
		},
		{
			name:       "blocks deletes of systemd service files",
			toolName:   "shell.exec",
			toolArgs:   map[string]any{"command": "rm /etc/systemd/system/openclaw.service"},
			wantRisk:   "L4",
			wantAction: "deny",
			mustHave:   []string{"system_file"},
		},
		{
			name:       "blocks writes to Windows hosts",
			toolName:   "write",
			targetURI:  "C:\\Windows\\System32\\drivers\\etc\\hosts",
			toolArgs:   map[string]any{"path": "C:\\Windows\\System32\\drivers\\etc\\hosts", "content": "127.0.0.1 example.test\n"},
			wantRisk:   "L4",
			wantAction: "deny",
			mustHave:   []string{"system_file"},
		},
		{
			name:       "allows plain reads of shell startup files",
			toolName:   "read",
			targetURI:  "/home/node/.bashrc",
			toolArgs:   map[string]any{"path": "/home/node/.bashrc"},
			wantRisk:   "L0",
			wantAction: "allow",
		},
		{
			name:       "allows plain reads of hosts",
			toolName:   "read",
			targetURI:  "/etc/hosts",
			toolArgs:   map[string]any{"path": "/etc/hosts"},
			wantRisk:   "L0",
			wantAction: "allow",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			response := decideWithContractService(t, service, api.DecisionRequest{
				RequestID: "guard-regression-system-" + tc.name,
				Stage:     "tool_call",
				Hook:      "before_tool_call",
				ToolName:  tc.toolName,
				TargetURI: tc.targetURI,
				ToolArgs:  tc.toolArgs,
				CreatedAt: "2026-05-08T00:00:00Z",
			})

			assertDecisionAction(t, response, tc.wantRisk, tc.wantAction)
			assertDecisionModules(t, response, tc.mustHave...)
		})
	}
}

func TestDecisionGuardRegressionOpenClawUpgradeMaintenance(t *testing.T) {
	service, _, _ := newDecisionContractService(t)
	cases := []struct {
		name       string
		toolName   string
		targetURI  string
		toolArgs   map[string]any
		provider   map[string]any
		wantRisk   string
		wantAction string
		mustHave   []string
	}{
		{
			name:       "allows OpenClaw upgrade commands that restart the gateway",
			toolName:   "shell.exec",
			toolArgs:   map[string]any{"command": "openclaw update && docker compose restart openclaw-gateway"},
			wantRisk:   "L0",
			wantAction: "allow",
		},
		{
			name:       "allows upgrade maintenance config patch tool calls",
			toolName:   "gateway",
			toolArgs:   map[string]any{"action": "config.patch", "note": "OpenClaw upgrade maintenance updates runtime config"},
			wantRisk:   "L0",
			wantAction: "allow",
		},
		{
			name:       "allows upgrade maintenance to update the Lynx Guardian manifest",
			toolName:   "write",
			targetURI:  "/home/node/.openclaw/extensions/openclaw-lynx-guardian/openclaw.plugin.json",
			toolArgs:   map[string]any{"path": "/home/node/.openclaw/extensions/openclaw-lynx-guardian/openclaw.plugin.json", "note": "OpenClaw upgrade maintenance updates the bundled Lynx Guardian manifest"},
			wantRisk:   "L0",
			wantAction: "allow",
		},
		{
			name:       "still blocks plugin source writes without upgrade intent",
			toolName:   "write",
			targetURI:  "/home/node/.openclaw/extensions/openclaw-lynx-guardian/index.ts",
			toolArgs:   map[string]any{"path": "/home/node/.openclaw/extensions/openclaw-lynx-guardian/index.ts", "note": "Patch Lynx Guardian runtime behavior"},
			wantRisk:   "L4",
			wantAction: "deny",
			mustHave:   []string{"plugin_integrity"},
		},
		{
			name:       "still blocks plain OpenClaw availability control without upgrade intent",
			toolName:   "shell.exec",
			toolArgs:   map[string]any{"command": "docker compose restart openclaw-gateway"},
			wantRisk:   "L4",
			wantAction: "deny",
			mustHave:   []string{"system_availability"},
		},
		{
			name:       "still blocks attempts to disable Lynx Guardian during an OpenClaw update",
			toolName:   "shell.exec",
			toolArgs:   map[string]any{"command": "openclaw update && openclaw extension disable openclaw-lynx-guardian"},
			wantRisk:   "L4",
			wantAction: "deny",
			mustHave:   []string{"plugin_integrity"},
		},
		{
			name:     "allows gateway restart when original prompt is plugin update maintenance",
			toolName: "shell.exec",
			toolArgs: map[string]any{
				"command":    "kill 7 && sleep 2 && cd /home/node/.openclaw && node /app/dist/index.js gateway --bind lan --port 18789 &",
				"background": true,
			},
			provider: map[string]any{
				"originalPromptText": "帮我更新lynx插件并重启，https://github.com/shouxuai/openclaw-lynx-guardian/tree/release/v1.3，版本号没有变只有bugfix",
			},
			wantRisk:   "L0",
			wantAction: "allow",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			response := decideWithContractService(t, service, api.DecisionRequest{
				RequestID:      "guard-regression-upgrade-" + tc.name,
				Stage:          "tool_call",
				Hook:           "before_tool_call",
				ToolName:       tc.toolName,
				TargetURI:      tc.targetURI,
				ToolArgs:       tc.toolArgs,
				ProviderSafety: tc.provider,
				CreatedAt:      "2026-05-08T00:00:00Z",
			})

			assertDecisionAction(t, response, tc.wantRisk, tc.wantAction)
			assertDecisionModules(t, response, tc.mustHave...)
		})
	}
}

func TestDecisionGuardRegressionTaintExpirationAndEvidenceStatus(t *testing.T) {
	service, _, database := newDecisionContractService(t)
	insertGuardRegressionTaint(t, database, guardRegressionTaintFixture{
		ID:         "taint-expired",
		ChainID:    "chain-taint-expiry",
		SessionKey: "session-taint-expiry",
		Label:      "expired-secret",
		CreatedAt:  "2026-05-07T23:00:00Z",
		ExpiresAt:  "2026-05-07T23:30:00Z",
	})
	insertGuardRegressionTaint(t, database, guardRegressionTaintFixture{
		ID:         "taint-active",
		ChainID:    "chain-taint-expiry",
		SessionKey: "session-taint-expiry",
		Label:      "active-secret",
		CreatedAt:  "2026-05-08T00:00:00Z",
		ExpiresAt:  "2026-05-08T00:30:00Z",
	})

	response := decideWithContractService(t, service, api.DecisionRequest{
		RequestID:  "guard-regression-taint-expiry",
		Stage:      "input",
		Hook:       "before_dispatch",
		SessionKey: "session-taint-expiry",
		Content:    "Please continue with the same task.",
		CreatedAt:  "2026-05-08T00:05:00Z",
	})

	assertDecisionModules(t, response, "taint_context")
	item := findDecisionEvidence(t, response, "taint.recent_sensitive_read")
	if item.Value != "active-secret" {
		t.Fatalf("taint evidence value = %q, want active-secret; response=%#v", item.Value, response.Arbiters)
	}
	if item.Status != "active" || item.ExpiresAt != "2026-05-08T00:30:00Z" {
		t.Fatalf("taint evidence status/expiresAt = %q/%q, want active/2026-05-08T00:30:00Z", item.Status, item.ExpiresAt)
	}
	assertDecisionEvidenceValueAbsent(t, response, "expired-secret")
}

func TestDecisionGuardRegressionChainExpirationAndStatus(t *testing.T) {
	cases := []struct {
		name        string
		status      string
		updatedAt   string
		endedAt     string
		wantModule  bool
		wantExpires string
	}{
		{
			name:        "active recent chain contributes with active status",
			status:      "active",
			updatedAt:   "2026-05-08T00:00:00Z",
			wantModule:  true,
			wantExpires: "2026-05-08T00:30:00Z",
		},
		{
			name:      "stale active chain is ignored",
			status:    "active",
			updatedAt: "2026-05-07T23:00:00Z",
		},
		{
			name:      "ended chain is ignored",
			status:    "ended",
			updatedAt: "2026-05-08T00:00:00Z",
			endedAt:   "2026-05-08T00:01:00Z",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			service, _, database := newDecisionContractService(t)
			sessionKey := "session-" + tc.name
			chainID := "chain-" + tc.name
			insertGuardRegressionChain(t, database, api.ChainSummary{
				ChainID:       chainID,
				SessionKey:    sessionKey,
				RecentDenials: []string{"before_tool_call"},
			}, tc.status, tc.updatedAt, tc.endedAt)

			response := decideWithContractService(t, service, api.DecisionRequest{
				RequestID:  "guard-regression-chain-" + tc.name,
				Stage:      "input",
				Hook:       "before_dispatch",
				SessionKey: sessionKey,
				Content:    "Please continue with the same task.",
				CreatedAt:  "2026-05-08T00:05:00Z",
			})

			if tc.wantModule {
				assertDecisionModules(t, response, "chain_context")
				item := findDecisionEvidence(t, response, "chain.recent_denial")
				if item.Status != "active" || item.ExpiresAt != tc.wantExpires {
					t.Fatalf("chain evidence status/expiresAt = %q/%q, want active/%s", item.Status, item.ExpiresAt, tc.wantExpires)
				}
				return
			}
			assertDecisionModulesAbsent(t, response, "chain_context")
			assertDecisionEvidenceIDAbsent(t, response, "chain.recent_denial")
		})
	}
}

func assertDecisionModulesAbsent(t *testing.T, response api.DecisionResponse, modules ...string) {
	t.Helper()
	for _, module := range modules {
		if containsString(response.MatchedModules, module) {
			t.Fatalf("matched modules = %v, did not want %s", response.MatchedModules, module)
		}
	}
}

type guardRegressionTaintFixture struct {
	ID         string
	ChainID    string
	SessionKey string
	Label      string
	CreatedAt  string
	ExpiresAt  string
}

func insertGuardRegressionTaint(t *testing.T, database *sql.DB, fixture guardRegressionTaintFixture) {
	t.Helper()
	_, err := database.Exec(`
		INSERT INTO taint_labels (
			id, chain_id, session_key, label, source_kind, source_uri,
			target_uri, metadata_json, created_at, expires_at
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		fixture.ID,
		fixture.ChainID,
		fixture.SessionKey,
		fixture.Label,
		"tool_result",
		"C:/Users/example/.env",
		"C:/Users/example/.env",
		"{}",
		fixture.CreatedAt,
		fixture.ExpiresAt,
	)
	if err != nil {
		t.Fatalf("insert guard regression taint: %v", err)
	}
}

func insertGuardRegressionChain(t *testing.T, database *sql.DB, summary api.ChainSummary, status string, updatedAt string, endedAt string) {
	t.Helper()
	data, err := json.Marshal(summary)
	if err != nil {
		t.Fatalf("marshal guard regression chain: %v", err)
	}
	_, err = database.Exec(`
		INSERT INTO chains (
			id, chain_id, session_key, channel_profile, channel_id, conversation_id,
			requester_id, requester_ou_id, status, summary_json, active_grant_id,
			pending_approval_id, created_at, updated_at, ended_at
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		summary.ChainID,
		summary.ChainID,
		summary.SessionKey,
		"webchat",
		"channel-guard-regression",
		"conversation-guard-regression",
		"requester-guard-regression",
		"",
		status,
		string(data),
		summary.ActiveGrantID,
		summary.PendingApproval,
		"2026-05-08T00:00:00Z",
		updatedAt,
		endedAt,
	)
	if err != nil {
		t.Fatalf("insert guard regression chain: %v", err)
	}
}

func findDecisionEvidence(t *testing.T, response api.DecisionResponse, id string) api.EvidenceItem {
	t.Helper()
	for _, arbiter := range response.Arbiters {
		for _, item := range arbiter.Evidence {
			if item.ID == id {
				return item
			}
		}
	}
	t.Fatalf("evidence %s not found: %#v", id, response.Arbiters)
	return api.EvidenceItem{}
}

func assertDecisionEvidenceValueAbsent(t *testing.T, response api.DecisionResponse, value string) {
	t.Helper()
	for _, arbiter := range response.Arbiters {
		for _, item := range arbiter.Evidence {
			if item.Value == value {
				t.Fatalf("evidence value %q unexpectedly present: %#v", value, response.Arbiters)
			}
		}
	}
}

func assertDecisionEvidenceIDAbsent(t *testing.T, response api.DecisionResponse, id string) {
	t.Helper()
	for _, arbiter := range response.Arbiters {
		for _, item := range arbiter.Evidence {
			if item.ID == id {
				t.Fatalf("evidence id %q unexpectedly present: %#v", id, response.Arbiters)
			}
		}
	}
}
