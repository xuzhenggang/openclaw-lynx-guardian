package decision

import (
	"fmt"
	"strings"

	"github.com/openclaw/lynx-guardian/backend/internal/api"
)

var guardRegressionInputEvidenceRules = []evidenceRule{
	{
		ID:            "input.protected_core_file_mutation",
		Module:        "protected_file_access",
		Kind:          "protected_core_file_mutation",
		Source:        "input",
		Severity:      "critical",
		ScoreDelta:    95,
		Reason:        "input asks to mutate protected OpenClaw identity or memory files",
		HardRiskLevel: "L4",
		HardAction:    "deny",
		Matcher: func(req api.DecisionRequest, _ string) bool {
			return isProtectedCoreFileMutation(decisionRequestText(req))
		},
	},
	{
		ID:            "input.openclaw_memory_session_export",
		Module:        "memory_session_privacy",
		Kind:          "memory_or_session_export",
		Source:        "input",
		Severity:      "critical",
		ScoreDelta:    95,
		Reason:        "input asks to export, dump, clear, or expose OpenClaw memory/session records",
		HardRiskLevel: "L4",
		HardAction:    "deny",
		Matcher: func(req api.DecisionRequest, _ string) bool {
			return isOpenClawMemorySessionDanger(decisionRequestText(req))
		},
	},
}

var guardRegressionToolEvidenceRules = []evidenceRule{
	{
		ID:            "tool.system_file_mutation",
		Module:        "system_file",
		Kind:          "write_sensitive_system_file_mutation",
		Source:        "tool",
		Severity:      "critical",
		ScoreDelta:    95,
		Reason:        "tool call mutates a shell startup file or system configuration file",
		HardRiskLevel: "L4",
		HardAction:    "deny",
		Matcher: func(req api.DecisionRequest, _ string) bool {
			return toolRuleMatches(req, ChainSummary{}, func(view toolRequestView) bool {
				return isWriteSensitiveSystemPath(view) && isMutatingSystemOperation(view)
			})
		},
	},
	{
		ID:            "tool.openclaw_availability_control",
		Module:        "system_availability",
		Kind:          "openclaw_gateway_control",
		Source:        "tool",
		Severity:      "critical",
		ScoreDelta:    90,
		Reason:        "tool call controls OpenClaw gateway availability without upgrade maintenance context",
		HardRiskLevel: "L4",
		HardAction:    "deny",
		Matcher: func(req api.DecisionRequest, _ string) bool {
			return toolRuleMatches(req, ChainSummary{}, func(view toolRequestView) bool {
				return isOpenClawAvailabilityControl(view) && !isAllowedOpenClawUpgradeMaintenance(req, view)
			})
		},
	},
	{
		ID:            "tool.lynx_guardian_disable",
		Module:        "plugin_integrity",
		Kind:          "lynx_guardian_disable_or_removal",
		Source:        "tool",
		Severity:      "critical",
		ScoreDelta:    100,
		Reason:        "tool call attempts to disable, uninstall, remove, or deactivate Lynx Guardian",
		HardRiskLevel: "L4",
		HardAction:    "deny",
		Matcher: func(req api.DecisionRequest, _ string) bool {
			return toolRuleMatches(req, ChainSummary{}, func(view toolRequestView) bool {
				return isLynxGuardianDisableOrRemoval(view)
			})
		},
	},
}

func decisionRequestText(req api.DecisionRequest) string {
	parts := []string{
		req.Content,
		req.ToolName,
		req.TargetURI,
		toolArgsFlatText(req.ToolArgs),
		providerSafetyFlatText(req.ProviderSafety),
	}
	return normalizeDecisionText(strings.Join(parts, " "))
}

func providerSafetyFlatText(provider map[string]any) string {
	if len(provider) == 0 {
		return ""
	}
	parts := make([]string, 0, len(provider)*2)
	for key, value := range provider {
		parts = append(parts, key, fmt.Sprint(value))
	}
	return strings.Join(parts, " ")
}

func isProtectedCoreFileMutation(text string) bool {
	if !containsProtectedCoreFile(text) {
		return false
	}
	return containsAny(text,
		"overwrite", "modify", "delete", "remove", "edit", "update", "append", "rewrite",
		"rename", "move", "replace", "clear", "erase", "wipe", "purge",
		"写入", "覆盖", "修改", "删除", "移除", "编辑", "更新", "追加", "改写", "重命名", "清空",
	)
}

func containsProtectedCoreFile(text string) bool {
	return containsAny(text,
		"soul.md", "identity.md", "user.md", "agents.md", "tools.md", "shield.md", "skill.md", "memory.md",
		"/.openclaw/workspace/soul.md", "/.openclaw/workspace/identity.md", "/.openclaw/workspace/user.md",
		"/.openclaw/workspace/agents.md", "/.openclaw/workspace/tools.md", "/.openclaw/workspace/shield.md",
		"/.openclaw/workspace/skill.md", "/.openclaw/workspace/memory.md",
	)
}

func isOpenClawMemorySessionDanger(text string) bool {
	if !containsAny(text, "openclaw", ".openclaw") {
		return false
	}
	if !containsAny(text, "memory", "session", "conversation history", "chat history", "sessions", "记忆", "会话", "历史记录") {
		return false
	}
	if containsAny(text, "/workspace/memory/") && containsAny(text, "read ", "open ", "cat ", "view ") &&
		!containsAny(text, "export", "dump", "exfiltrate", "leak", "upload", "send", "archive", "clear", "erase", "wipe", "purge", "reset", "delete", "remove", "show") {
		return false
	}
	return containsAny(text,
		"export", "dump", "exfiltrate", "leak", "upload", "send", "archive", "clear", "erase", "wipe", "purge", "reset",
		"delete", "remove", "show", "print", "list all", "download",
		"导出", "转储", "泄露", "上传", "发送", "打包", "清除", "清空", "删除", "展示", "打印", "列出全部",
	)
}

func isWriteSensitiveSystemPath(view toolRequestView) bool {
	text := view.Text
	return containsAny(text,
		"~/.bashrc", "/.bashrc", "/home/node/.bashrc",
		"~/.bash_profile", "/.bash_profile",
		"~/.profile", "/.profile",
		"~/.zshrc", "/.zshrc",
		"/etc/ssh/", "/etc/systemd/", "/etc/hosts", "/etc/sudoers", "/etc/passwd", "/etc/shadow",
		"c:\\windows\\system32\\drivers\\etc\\hosts", "c:/windows/system32/drivers/etc/hosts",
	)
}

func isMutatingSystemOperation(view toolRequestView) bool {
	return hasAnyString(view.OperationFamilies, "write", "delete", "move", "chmod") ||
		hasExecutable(view.Text, "cp", "tee") ||
		containsAny(view.Text,
			">", ">>", "1>", "1>>", "&>>",
			"set-content", "add-content", "out-file", "remove-item", "move-item",
		)
}

func isOpenClawAvailabilityControl(view toolRequestView) bool {
	text := view.Text
	hasGatewayContext := containsAny(text, "openclaw-gateway", "openclaw gateway", "/app/dist/index.js gateway", "gateway --bind")
	if !hasGatewayContext {
		return false
	}
	return containsAny(text,
		"restart", "stop", "shutdown", "kill ", "docker compose down", "gateway stop", "gateway restart",
		"重启", "停止", "关闭", "杀掉",
	)
}

func isAllowedOpenClawUpgradeMaintenance(req api.DecisionRequest, view toolRequestView) bool {
	if !hasOpenClawUpgradeMaintenanceIntent(req, view) {
		return false
	}
	if isLynxGuardianDisableOrRemoval(view) {
		return false
	}
	text := view.Text
	if isOpenClawAvailabilityControl(view) {
		return true
	}
	if containsAny(text, "config.patch", "config.update", "gateway config", "gateway-config") {
		return true
	}
	if containsAny(text, "openclaw.plugin.json") && containsAny(text, "openclaw-lynx-guardian", "lynx guardian") &&
		hasAnyString(view.OperationFamilies, "write") {
		return true
	}
	return false
}

func hasOpenClawUpgradeMaintenanceIntent(req api.DecisionRequest, view toolRequestView) bool {
	text := normalizeDecisionText(strings.Join([]string{
		view.Text,
		req.Content,
		providerSafetyFlatText(req.ProviderSafety),
	}, " "))
	hasMaintenanceIntent := containsAny(text,
		"upgrade", "update", "maintenance", "bugfix", "bug fix", "release/", "release v", "hotfix",
		"升级", "更新", "维护", "修复", "补丁", "版本",
	)
	hasOpenClawContext := containsAny(text,
		"openclaw", "lynx", "guardian", "gateway", "plugin", "openclaw-lynx-guardian",
		"插件", "网关",
	)
	return hasMaintenanceIntent && hasOpenClawContext
}

func isLynxGuardianDisableOrRemoval(view toolRequestView) bool {
	text := view.Text
	hasGuardianContext := containsAny(text, "openclaw-lynx-guardian", "lynx guardian", "lynx插件", "lynx 插件", "guardian")
	if !hasGuardianContext {
		return false
	}
	return containsAny(text,
		"extension disable", "disable", "uninstall", "remove", "deactivate", "turn off", "shutdown", "stop safety", "disable safety",
		"禁用", "停用", "卸载", "移除", "关闭", "关停", "下线", "失效",
	)
}
