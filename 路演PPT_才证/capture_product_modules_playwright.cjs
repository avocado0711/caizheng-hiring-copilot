"use strict";

const path = require("node:path");
const { chromium } = require("./.ppt-tools/node_modules/playwright-core");

const ROOT = __dirname;
const OUTPUT = path.join(ROOT, "screenshots");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function main() {
  const browser = await chromium.launch({
    executablePath: EDGE,
    headless: true,
    args: ["--disable-gpu", "--disable-gpu-sandbox", "--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1600 },
    deviceScaleFactor: 2,
  });
  try {
    await page.goto("http://127.0.0.1:3030/?intro=0&tour=0#job", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(1800);
    await page.evaluate(() => {
      document.querySelector("#intro-sequence")?.remove();
      document.querySelector("#tour-layer")?.remove();
      document.querySelector("#toast")?.remove();
      document.querySelector("#drawer-backdrop")?.setAttribute("hidden", "");
      document.querySelector("#resume-preview-backdrop")?.setAttribute("hidden", "");
      const topbar = document.querySelector(".topbar");
      if (topbar) topbar.style.visibility = "hidden";
      document.querySelectorAll("[inert]").forEach((element) => element.removeAttribute("inert"));
      document.body.classList.remove("has-open-modal", "has-open-drawer");
    });

    await page.locator('[data-view="job"]').click();
    await page.waitForSelector("#criteria-list .criterion-row, #criteria-list .criterion-item");
    await page.locator("#view-job .criteria-card").screenshot({
      path: path.join(OUTPUT, "01-job-scorecard-clean.png"),
      animations: "disabled",
    });

    await page.locator('[data-view="review"]').click();
    await page.waitForSelector("#ranking-body tr[data-candidate-id]");
    await page.locator("#ranking-body tr[data-candidate-id]").first().click();
    await page.waitForSelector("#candidate-drawer.is-open");
    const evidenceSection = page.locator("#drawer-content .drawer-section").filter({
      has: page.locator("h3", { hasText: "评价项证据" }),
    }).first();
    await evidenceSection.waitFor({ state: "visible" });
    await page.evaluate(() => {
      document.querySelector("#candidate-drawer .drawer-header")?.style.setProperty("display", "none");
      document.querySelector("#candidate-drawer .drawer-footer")?.style.setProperty("display", "none");
    });
    await evidenceSection.screenshot({
      path: path.join(OUTPUT, "02-candidate-evidence-section-clean.png"),
      animations: "disabled",
    });
    await evidenceSection.locator(".evidence-item").first().screenshot({
      path: path.join(OUTPUT, "02-candidate-evidence-item-clean.png"),
      animations: "disabled",
    });

    await page.evaluate(() => {
      document.querySelector("#drawer-close-button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await page.waitForTimeout(350);
    await page.evaluate(() => {
      document.querySelector("#drawer-backdrop")?.setAttribute("hidden", "");
      document.querySelector("#candidate-drawer")?.classList.remove("is-open");
      document.querySelectorAll("[inert]").forEach((element) => element.removeAttribute("inert"));
      document.body.classList.remove("has-open-modal", "has-open-drawer");
    });
    await page.locator('[data-view="knowledge"]').click();
    await page.waitForSelector("#view-knowledge.is-active");
    await page.locator("#knowledge-search-input").fill("星桥智能科技的 RAG 团队负责什么？");
    await page.locator("#knowledge-search-button").click();
    await page.waitForFunction(() => {
      const results = document.querySelector("#knowledge-search-results");
      return results && !results.querySelector(".evidence-empty") && results.innerText.trim().length > 20;
    }, null, { timeout: 20000 });
    await page.locator("#knowledge-search-results .knowledge-result").first().screenshot({
      path: path.join(OUTPUT, "03-knowledge-result-clean.png"),
      animations: "disabled",
    });

    console.log("captured");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
