"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const ROOT = __dirname;
const OUTPUT = path.join(ROOT, "screenshots");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9237;
const PROFILE = path.join(ROOT, ".capture-edge-profile");
const APP_URL = "http://127.0.0.1:3030/?intro=0&tour=0#job";

fs.mkdirSync(OUTPUT, { recursive: true });

const edge = spawn(EDGE, [
  "--headless",
  "--disable-gpu",
  "--disable-gpu-sandbox",
  "--no-sandbox",
  "--hide-scrollbars",
  "--no-first-run",
  "--remote-allow-origins=*",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  "--window-size=1920,1800",
  APP_URL,
], {
  windowsHide: true,
  stdio: "ignore",
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

async function waitForDebugTarget() {
  for (let index = 0; index < 80; index += 1) {
    try {
      const targets = await getJson(`http://127.0.0.1:${PORT}/json`);
      const target = targets.find((item) => item.type === "page");
      if (target?.webSocketDebuggerUrl) return target;
    } catch {
      // Edge is still starting.
    }
    await delay(250);
  }
  throw new Error("无法连接 Edge DevTools");
}

async function connect(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id) return;
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  });

  return {
    send(method, params = {}) {
      const id = nextId;
      nextId += 1;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    close() {
      socket.close();
    },
  };
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "页面脚本执行失败");
  }
  return result.result?.value;
}

async function waitFor(client, expression, timeoutMs = 12000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await evaluate(client, expression)) return;
    await delay(200);
  }
  throw new Error(`等待超时：${expression}`);
}

async function captureElement(client, expression, fileName) {
  const rect = await evaluate(client, `(() => {
    const element = ${expression};
    if (!element) return null;
    element.scrollIntoView({ block: "center", inline: "nearest" });
    const box = element.getBoundingClientRect();
    return {
      x: box.left + window.scrollX,
      y: box.top + window.scrollY,
      width: box.width,
      height: box.height,
      text: element.innerText.slice(0, 160)
    };
  })()`);

  if (!rect || rect.width < 100 || rect.height < 80) {
    throw new Error(`模块尺寸异常：${fileName} ${JSON.stringify(rect)}`);
  }

  await delay(650);
  const refreshed = await evaluate(client, `(() => {
    const element = ${expression};
    const box = element.getBoundingClientRect();
    return {
      x: box.left + window.scrollX,
      y: box.top + window.scrollY,
      width: box.width,
      height: box.height
    };
  })()`);

  const screenshot = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    fromSurface: true,
    clip: {
      x: Math.max(0, Math.floor(refreshed.x)),
      y: Math.max(0, Math.floor(refreshed.y)),
      width: Math.ceil(refreshed.width),
      height: Math.ceil(refreshed.height),
      scale: 2,
    },
  });

  const destination = path.join(OUTPUT, fileName);
  fs.writeFileSync(destination, Buffer.from(screenshot.data, "base64"));
  console.log(`${fileName}|${Math.ceil(refreshed.width)}x${Math.ceil(refreshed.height)}|${rect.text.replace(/\s+/g, " ").slice(0, 80)}`);
}

async function main() {
  const target = await waitForDebugTarget();
  const client = await connect(target.webSocketDebuggerUrl);
  try {
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Page.navigate", { url: APP_URL });
    await delay(2600);
    await evaluate(client, `(() => {
      document.querySelector("#intro-sequence")?.remove();
      document.querySelector("#tour-layer")?.remove();
      document.querySelector("#toast")?.remove();
      document.body.classList.remove("has-open-modal", "has-open-drawer");
    })()`);

    await evaluate(client, `document.querySelector('[data-view="job"]')?.click()`);
    await waitFor(client, `document.querySelectorAll("#criteria-list .criterion-row, #criteria-list .criterion-item").length > 0`);
    await captureElement(
      client,
      `document.querySelector('#view-job .criteria-card')`,
      "01-job-scorecard.png",
    );

    await evaluate(client, `document.querySelector('[data-view="review"]')?.click()`);
    await waitFor(client, `document.querySelectorAll('#ranking-body tr[data-candidate-id]').length > 0`);
    await evaluate(client, `document.querySelector('#ranking-body tr[data-candidate-id]')?.click()`);
    await waitFor(client, `document.querySelector('#candidate-drawer')?.classList.contains('is-open')`);
    await waitFor(client, `Array.from(document.querySelectorAll('#drawer-content .drawer-section h3')).some((node) => node.textContent.includes('评价项证据'))`);
    await captureElement(
      client,
      `Array.from(document.querySelectorAll('#drawer-content .drawer-section')).find((section) => section.querySelector('h3')?.textContent.includes('评价项证据'))`,
      "02-candidate-evidence.png",
    );

    await evaluate(client, `document.querySelector('#drawer-close-button')?.click()`);
    await delay(400);
    await evaluate(client, `document.querySelector('[data-view="knowledge"]')?.click()`);
    await waitFor(client, `document.querySelector('#view-knowledge')?.classList.contains('is-active')`);
    await evaluate(client, `(() => {
      const input = document.querySelector('#knowledge-search-input');
      input.value = '星桥智能科技的 RAG 团队负责什么？';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#knowledge-search-button')?.click();
    })()`);
    await waitFor(client, `(() => {
      const results = document.querySelector('#knowledge-search-results');
      return results && !results.querySelector('.evidence-empty') && results.innerText.trim().length > 20;
    })()`, 20000);
    await captureElement(
      client,
      `document.querySelector('#view-knowledge .knowledge-search-card')`,
      "03-knowledge-search.png",
    );
  } finally {
    client.close();
    edge.kill();
  }
}

main().catch((error) => {
  console.error(error);
  edge.kill();
  process.exitCode = 1;
});
