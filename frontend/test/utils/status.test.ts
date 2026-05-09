import { describe, expect, it } from "vitest";
import { isValidElement } from "react";

import {
  getDecisionTone,
  renderActionBadge,
  renderPolicyDecisionBadge,
} from "../../src/utils/status";

function getBadgeTone(element: unknown): string | undefined {
  if (!isValidElement(element)) {
    return undefined;
  }

  return (element.props as { tone?: string }).tone;
}

describe("getDecisionTone", () => {
  it("treats block false warn decisions as warning instead of safe", () => {
    expect(getDecisionTone({
      block: false,
      riskLevel: "L2",
      action: "warn",
      eventSeverity: "warn",
    })).toBe("warning");
  });

  it("treats L4 deny decisions as error", () => {
    expect(getDecisionTone({
      block: true,
      riskLevel: "L4",
      action: "deny",
      eventSeverity: "critical",
    })).toBe("error");
  });

  it("treats low risk allow decisions as default", () => {
    expect(getDecisionTone({
      block: false,
      riskLevel: "L0",
      action: "allow",
      eventSeverity: "info",
    })).toBe("default");
  });

  it("treats explicit block true as error even when other fields look low risk", () => {
    expect(getDecisionTone({
      block: true,
      riskLevel: "L0",
      action: "allow",
      eventSeverity: "info",
    })).toBe("error");
  });

  it("does not treat approval or degraded block false decisions as neutral", () => {
    expect(getDecisionTone({
      block: false,
      riskLevel: "L0",
      action: "requireApproval",
      eventSeverity: "info",
      requiresApproval: true,
    })).toBe("warning");

    expect(getDecisionTone({
      block: false,
      riskLevel: "L0",
      action: "allow",
      eventSeverity: "info",
      degraded: true,
    })).toBe("warning");
  });

  it("uses enforcement action when block and action look neutral", () => {
    expect(getDecisionTone({
      block: false,
      riskLevel: "L0",
      action: "allow",
      eventSeverity: "info",
      enforcementAction: "requireApproval",
    })).toBe("warning");

    expect(getDecisionTone({
      block: false,
      riskLevel: "L0",
      action: "allow",
      eventSeverity: "info",
      enforcementAction: "block",
    })).toBe("error");
  });
});

describe("status badge tones", () => {
  it("renders allow and log-only actions as success", () => {
    expect(getBadgeTone(renderActionBadge("allow"))).toBe("success");
    expect(getBadgeTone(renderActionBadge("log_only"))).toBe("success");
    expect(getBadgeTone(renderActionBadge("logOnly"))).toBe("success");
  });

  it("renders deny and block actions as danger", () => {
    expect(getBadgeTone(renderActionBadge("deny"))).toBe("danger");
    expect(getBadgeTone(renderActionBadge("block"))).toBe("danger");
  });

  it("renders allow policy decisions with logging as success", () => {
    expect(getBadgeTone(renderPolicyDecisionBadge("allow", "allow"))).toBe(
      "success",
    );
    expect(
      getBadgeTone(renderPolicyDecisionBadge("allow_with_logging", "logOnly")),
    ).toBe("success");
  });
});
