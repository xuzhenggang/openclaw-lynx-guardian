import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { ConfigProvider, Select } from "antd";
import zhCN from "antd/locale/zh_CN";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

async function readThemeCss(): Promise<string> {
  return readFile(resolve("src/styles/theme.css"), "utf8");
}

async function readSkillsCss(): Promise<string> {
  return readFile(resolve("src/styles/skills.css"), "utf8");
}

async function readCss(path: string): Promise<string> {
  return readFile(resolve(path), "utf8");
}

function extractCssRule(css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\s*{([^}]*)}`));
  if (!match) {
    throw new Error(`Missing CSS rule for ${selector}`);
  }
  return match[1];
}

function extractCssRules(css: string, selector: string): string[] {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...css.matchAll(new RegExp(`(?:^|\\n)${escapedSelector}\\s*{([^}]*)}`, "g"))].map((match) => match[1]);
}

function installStyle(css: string): () => void {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  return () => {
    style.remove();
  };
}

describe("theme styles", () => {
  afterEach(() => {
    cleanup();
    document.head.querySelectorAll("style").forEach((style) => {
      style.remove();
    });
  });

  it("keeps page-private policy, report, and QA styles out of theme.css", async () => {
    const themeCss = await readThemeCss();
    const policyCss = await readCss("src/styles/pages-policies.css");
    const reportCss = await readCss("src/styles/pages-reports.css");
    const qaCss = await readCss("src/styles/pages-qa.css");

    expect(themeCss).not.toContain(".policy-list-panel");
    expect(themeCss).not.toContain(".report-side-panel");
    expect(themeCss).not.toContain(".qa-record-summary");
    expect(policyCss).toContain(".policy-list-panel");
    expect(reportCss).toContain(".report-side-panel");
    expect(qaCss).toContain(".qa-record-summary");
  });

  it("keeps the top bar title vertically centered inside the sticky header", async () => {
    const css = await readThemeCss();
    const titleRule = extractCssRule(css, ".topbar__title");
    const dividerRule = extractCssRule(css, ".topbar__divider");
    const eyebrowRule = extractCssRule(css, ".topbar__eyebrow");

    expect(titleRule).toMatch(/(?:^|\n)\s*height: 100%;/);
    expect(titleRule).toContain("margin: 0;");
    expect(titleRule).toContain("align-items: center;");
    expect(dividerRule).toContain("display: inline-flex;");
    expect(dividerRule).toContain("align-items: center;");
    expect(eyebrowRule).toContain("display: inline-flex;");
    expect(eyebrowRule).toContain("align-items: center;");
  });

  it("keeps filter inputs vertically centered inside their 40px border box", async () => {
    const css = await readThemeCss();

    expect(css).toMatch(/\.filter-field > input,\s*\.filter-field > select\s*{[\s\S]*height: 40px;[\s\S]*box-sizing: border-box;[\s\S]*line-height: 20px;/);
    expect(css).toMatch(/\.filter-field \.ant-input-affix-wrapper \.ant-input\s*{[\s\S]*height: auto;[\s\S]*min-height: 0;[\s\S]*line-height: 20px;/);
  });

  it("keeps Ant multi-select tags compact inside filter controls", async () => {
    const css = await readThemeCss();

    expect(css).toMatch(/\.filter-field \.ant-select-multiple \.ant-select-selection-item\s*{[\s\S]*min-height: 0(?: !important)?;[\s\S]*max-height: 24px(?: !important)?;[\s\S]*line-height: 20px(?: !important)?;/);
    expect(css).toMatch(/\.filter-field \.ant-select-selector\s*{[\s\S]*align-items: center;[\s\S]*min-height: 40px;/);
  });

  it("renders selected Ant multi-select labels as compact chips inside filter controls", async () => {
    const removeStyle = installStyle(await readThemeCss());

    try {
      render(
        createElement(
          ConfigProvider,
          { locale: zhCN },
          createElement(
            "label",
            { className: "filter-field" },
            createElement("span", null, "风险等级"),
            createElement(Select, {
              mode: "multiple",
              open: false,
              options: [
                { label: "高风险 L3", value: "L3" },
                { label: "严重风险 L4", value: "L4" },
              ],
              value: ["L3", "L4"],
            }),
          ),
        ),
      );

      const chips = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".filter-field .ant-select-multiple .ant-select-selection-item",
        ),
      );

      expect(chips).toHaveLength(2);
      for (const chip of chips) {
        const style = getComputedStyle(chip);
        expect(style.minHeight).toBe("0px");
        expect(style.maxHeight).toBe("24px");
        expect(style.lineHeight).toBe("20px");
      }
    } finally {
      removeStyle();
    }
  });

  it("keeps page-private selectors out of theme.css and gives real ownership to page CSS files", async () => {
    const themeCss = await readThemeCss();
    const auditCss = await readCss("src/styles/pages-audit.css");
    const executionCss = await readCss("src/styles/pages-execution.css");
    const reportCss = await readCss("src/styles/pages-reports.css");

    for (const selector of [
      ".audit-detail-dialog",
      ".decision-summary-grid",
      ".tool-call",
      ".chain",
      ".approval",
      ".grant",
      ".session",
      ".report-side-panel",
      ".audit-summary-grid",
      ".split-grid",
      ".split-grid--equal",
      ".modal-dialog .audit-filter-form",
      ".modal-dialog .filter-field--search",
    ]) {
      expect(themeCss).not.toContain(selector);
    }

    expect(auditCss.split("\n").length).toBeGreaterThanOrEqual(200);
    expect(executionCss.split("\n").length).toBeGreaterThanOrEqual(200);
    expect(reportCss).toContain(".report-body");
  });

  it("sizes filter fields by control type instead of first-column position", async () => {
    const css = await readThemeCss();
    const formRule = extractCssRule(css, ".audit-filter-form");
    const compactRule = extractCssRule(css, ".audit-filter-form--compact");
    const selectRule = extractCssRule(css, ".audit-filter-form > .filter-field:has(.ant-select)");

    expect(formRule).toContain("display: flex;");
    expect(formRule).toContain("flex-wrap: wrap;");
    expect(formRule).not.toContain("grid-template-columns");
    expect(compactRule).not.toContain("grid-template-columns");
    expect(extractCssRules(css, ".audit-filter-form").every((rule) => !rule.includes("grid-template-columns"))).toBe(true);
    expect(selectRule).toContain("flex: 1 1 160px;");
    expect(selectRule).toContain("min-width: 150px;");
    expect(selectRule).not.toContain("max-width");
    expect(css).toMatch(/\.audit-filter-form > \.filter-field:has\(\.ant-input-affix-wrapper\),\s*\.audit-filter-form > \.filter-field:has\(> input\)\s*{[\s\S]*flex: 1\.15 1 190px;[\s\S]*min-width: 180px;/);
    expect(css).toMatch(/\.audit-filter-form > \.filter-field--search\s*{[\s\S]*flex: 1\.25 1 220px;[\s\S]*min-width: 200px;/);
    expect(css).toMatch(/\.audit-filter-form > \.filter-field--date-range\s*{[\s\S]*flex: 1\.35 1 260px;[\s\S]*min-width: 240px;/);
  });

  it("keeps modal dialogs tall enough without a top accent rail", async () => {
    const css = await readThemeCss();
    const dialogRule = extractCssRule(css, ".modal-dialog");
    const headerRule = extractCssRule(css, ".modal-dialog__header");

    expect(dialogRule).toContain("min-height:");
    expect(headerRule).not.toContain("var(--success)");
    expect(css).not.toMatch(/\.modal-dialog__header::before\s*{/);
  });

  it("keeps audit-style detail dialogs visually structured", async () => {
    const css = await readCss("src/styles/pages-audit.css");
    const dialogRule = extractCssRule(css, ".audit-detail-dialog");
    const heroRule = extractCssRule(css, ".audit-detail-dialog__hero");
    const summaryRule = extractCssRule(css, ".audit-detail-dialog__summary-grid");

    expect(dialogRule).toContain("display: grid;");
    expect(heroRule).toContain("linear-gradient");
    expect(summaryRule).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(css).toContain(".audit-detail-dialog__evidence-grid");
  });

  it("keeps audit detail labels separated from their values", async () => {
    const css = await readCss("src/styles/pages-execution.css");
    const fieldRule = extractCssRule(css, ".detail-panel__field");
    const ddRule = extractCssRule(css, ".detail-panel dd");

    expect(fieldRule).toContain("display: grid;");
    expect(fieldRule).toContain("gap: 8px;");
    expect(fieldRule).toContain("align-content: start;");
    expect(ddRule).toContain("margin: 0;");
  });

  it("limits form layouts inside modal dialogs to at most two columns", async () => {
    const css = await readCss("src/styles/pages-execution.css");

    expect(css).toMatch(/\.modal-dialog \.audit-filter-form,\s*\.modal-dialog \.audit-filter-form--compact\s*{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
    expect(css).toMatch(/\.modal-dialog \.filter-field--search\s*{[\s\S]*grid-column: auto;/);
  });

  it("keeps split grids single-column on narrower execution pages", async () => {
    const css = await readCss("src/styles/pages-execution.css");
    const baseSplitIndex = css.indexOf(".split-grid {");
    const baseEqualIndex = css.indexOf(".split-grid--equal {");
    const responsiveIndex = css.indexOf("@media (max-width: 1280px)");

    expect(baseSplitIndex).toBeGreaterThanOrEqual(0);
    expect(baseEqualIndex).toBeGreaterThanOrEqual(0);
    expect(responsiveIndex).toBeGreaterThan(baseSplitIndex);
    expect(responsiveIndex).toBeGreaterThan(baseEqualIndex);
    expect(css.slice(responsiveIndex)).toMatch(/\.split-grid,\s*\.split-grid--equal\s*{[\s\S]*grid-template-columns: 1fr;/);
  });

  it("caps token trend bars so sparse charts do not become full-width columns", async () => {
    const css = await readThemeCss();
    const plotRule = extractCssRule(css, ".token-trend-plot");

    expect(plotRule).toContain("grid-template-columns:");
    expect(plotRule).toContain("repeat(");
    expect(plotRule).toContain("var(--token-trend-slot-count, 7)");
    expect(plotRule).toContain("minmax(0, 1fr)");
    expect(css).toMatch(/\.token-trend-body\s*{[\s\S]*grid-template-columns: 56px minmax\(0, 1fr\);/);
    expect(css).toMatch(/\.token-trend-y-axis\s*{[\s\S]*justify-content: space-between;/);
    expect(css).toMatch(/\.token-trend-bar\s*{[\s\S]*width: min\(40px, 100%\);[\s\S]*max-width: 40px;/);
    expect(css).toMatch(/\.token-trend-gridline\s*{[\s\S]*border-top: 1px solid rgba\(100, 116, 139, 0\.16\);/);
  });

  it("keeps decision summary cards compact for dense review pages", async () => {
    const css = await readCss("src/styles/pages-audit.css");
    const cardRule = extractCssRule(css, ".decision-summary-grid .summary-card");
    const valueRule = extractCssRule(css, ".decision-summary-grid .summary-card__value");

    expect(cardRule).toContain("min-height: 96px;");
    expect(cardRule).toContain("padding: 14px 18px;");
    expect(valueRule).toContain("margin-top: 8px;");
    expect(valueRule).toContain("font-size: 30px;");
  });

  it("keeps custom table cells from overflowing into adjacent columns", async () => {
    const css = await readThemeCss();
    const rowStackRule = extractCssRule(css, ".data-table .row-stack");
    const rowStackChildrenRule = extractCssRule(css, ".data-table .row-stack > *");

    expect(rowStackRule).toContain("min-width: 0;");
    expect(rowStackRule).toContain("max-width: 100%;");
    expect(rowStackChildrenRule).toContain("min-width: 0;");
    expect(rowStackChildrenRule).toContain("max-width: 100%;");
    expect(rowStackChildrenRule).toContain("overflow-wrap: anywhere;");
  });

  it("uses spaced Ant cards for table explanations", async () => {
    const css = await readThemeCss();
    const cardRule = extractCssRule(css, ".table-explanation-card.ant-card");
    const headRule = extractCssRule(css, ".table-explanation-card .ant-card-head");
    const titleRule = extractCssRule(css, ".table-explanation-card .ant-card-head-title");
    const bodyRule = extractCssRule(css, ".table-explanation-card .ant-card-body");
    const typographyRule = extractCssRule(css, ".table-explanation-card .ant-typography");

    expect(cardRule).toContain("border-radius: var(--radius-xl);");
    expect(headRule).toContain("min-height: 42px;");
    expect(titleRule).toContain("font-weight: 700;");
    expect(bodyRule).toContain("gap: 6px;");
    expect(bodyRule).toContain("padding: 14px 18px;");
    expect(typographyRule).toContain("margin-bottom: 0;");
    expect(typographyRule).toContain("line-height: 1.55;");
  });

  it("keeps table headers pinned to the top of the table scroll surface", async () => {
    const css = await readThemeCss();
    const wrapRule = extractCssRule(css, ".table-wrap");
    const statefulWrapRule = extractCssRule(css, ".table-wrap--stateful");
    const headerRule = extractCssRule(css, ".data-table th");
    const stateSurfaceRule = extractCssRule(css, ".data-table__state-surface");
    const loadingOverlayRule = extractCssRule(css, ".data-table__loading-overlay");
    const stickyCellRule = extractCssRule(css, ".data-table__sticky-cell");
    const stickyHeaderRule = extractCssRule(css, ".data-table th.data-table__sticky-cell");

    expect(wrapRule).toContain("isolation: isolate;");
    expect(wrapRule).toContain("max-height: clamp(220px, calc(100vh - 520px), 620px);");
    expect(wrapRule).toContain("overflow: auto;");
    expect(statefulWrapRule).toContain("min-height: clamp(220px, calc(100vh - 420px), 292px);");
    expect(headerRule).toContain("position: sticky;");
    expect(headerRule).toContain("top: 0;");
    expect(headerRule).toContain("z-index: 6;");
    expect(stateSurfaceRule).toContain("z-index: 2;");
    expect(loadingOverlayRule).toContain("z-index: 5;");
    expect(stickyCellRule).toContain("z-index: 4;");
    expect(stickyHeaderRule).toContain("z-index: 7;");
  });

  it("keeps the token trend line chart shallow in the default 24 hour view", async () => {
    const css = await readThemeCss();
    const panelRule = extractCssRule(css, ".token-page .trend-panel");
    const shellRule = extractCssRule(css, ".trend-line-shell.token-trend-chart");
    const lineChartRule = extractCssRule(css, ".token-trend-line-chart");

    expect(panelRule).toContain("padding: 16px 18px;");
    expect(panelRule).toContain("min-height: 0;");
    expect(shellRule).toContain("gap: 6px;");
    expect(shellRule).toContain("padding: 6px 10px 4px;");
    expect(lineChartRule).toContain("aspect-ratio: 720 / 132;");
  });

  it("styles skill source filters as compact chips instead of default buttons", async () => {
    const css = await readSkillsCss();
    const chipRowRule = extractCssRule(css, ".skills-source-panel__chips");
    const chipRule = extractCssRule(css, ".skills-source-chip");
    const activeRule = extractCssRule(css, ".skills-source-chip--active");

    expect(chipRowRule).toContain("display: flex;");
    expect(chipRule).toContain("appearance: none;");
    expect(chipRule).toContain("border-radius:");
    expect(chipRule).not.toContain("border: 2px outset");
    expect(activeRule).toContain("background:");
    expect(activeRule).toContain("color:");
  });
});
