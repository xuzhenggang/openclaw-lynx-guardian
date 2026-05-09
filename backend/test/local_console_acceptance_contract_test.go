package backend_test

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
)

func TestAcceptanceToolCallPersistsCommandAndResultSummary(t *testing.T) {
	handler, closer := buildParityHandler(t)
	t.Cleanup(func() {
		if err := closer(); err != nil {
			t.Fatalf("closer: %v", err)
		}
	})

	item := qaTerminalToolCallFixture("qa-acceptance-tool")
	data := item["data"].(map[string]any)
	data["toolCallId"] = "tool-acceptance-result"
	data["metadataJson"] = map[string]any{
		"command": "Get-Content package.json",
		"cwd":     "C:\\Users\\24716\\.openclaw\\extensions\\openclaw-lynx-guardian",
	}
	data["resultStatus"] = "completed"
	data["resultExcerpt"] = "name=@shouxuai/openclaw-lynx-guardian"

	seed := doJSON(t, handler, http.MethodPost, "/lynx/internal/v1/ingest/batch", fixtureBatchWithItems("acceptance-tool-result", []any{item}), true)
	decodeObjectStatus(t, seed, http.StatusOK)

	detail := decodeObjectStatus(t, doJSON(t, handler, http.MethodGet, "/lynx/tool-calls/tool-acceptance-result", nil, false), http.StatusOK)
	expectString(t, detail, "resultExcerpt", "name=@shouxuai/openclaw-lynx-guardian")
	metadata := detail["metadataJson"].(map[string]any)
	expectString(t, metadata, "command", "Get-Content package.json")
}

func TestAcceptanceNewApprovalIDsStayAtMostTwentyCharacters(t *testing.T) {
	handler, closer := buildParityHandler(t)
	t.Cleanup(func() {
		if err := closer(); err != nil {
			t.Fatalf("closer: %v", err)
		}
	})

	approval := qaApprovalFixture("qa-short-approval")
	data := approval["data"].(map[string]any)
	data["approvalId"] = "apv-20260509-0001"
	data["pendingId"] = "apv-20260509-0001"

	seed := doJSON(t, handler, http.MethodPost, "/lynx/internal/v1/ingest/batch", fixtureBatchWithItems("acceptance-short-approval", []any{approval}), true)
	decodeObjectStatus(t, seed, http.StatusOK)

	page := decodeObjectStatus(t, doJSON(t, handler, http.MethodGet, "/lynx/approvals?pageNum=1&pageSize=20", nil, false), http.StatusOK)
	items := pageItems(t, page)
	if got := items[0]["approvalId"].(string); len(got) > 20 {
		t.Fatalf("approvalId length = %d, want <= 20: %s", len(got), got)
	}
}

func TestAcceptanceSessionDetailPopulatesPrimaryFields(t *testing.T) {
	handler, closer := buildParityHandler(t)
	t.Cleanup(func() {
		if err := closer(); err != nil {
			t.Fatalf("closer: %v", err)
		}
	})

	seed := doJSON(t, handler, http.MethodPost, "/lynx/internal/v1/ingest/batch", fixtureBatch("acceptance-session-detail"), true)
	decodeObjectStatus(t, seed, http.StatusOK)

	detail := decodeObjectStatus(t, doJSON(t, handler, http.MethodGet, "/lynx/sessions/session-alpha", nil, false), http.StatusOK)
	expectString(t, detail, "sessionKey", "session-alpha")
	expectString(t, detail, "channelProfile", "feishu")
	expectString(t, detail, "requesterOuId", "ou_alpha")
	if strings.Contains(strings.ToLower(detailString(t, detail)), "null null null") {
		t.Fatalf("session detail contains raw empty dump: %#v", detail)
	}
}

func detailString(t *testing.T, payload map[string]any) string {
	t.Helper()
	return fmt.Sprintf("%#v", payload)
}
