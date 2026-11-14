"use strict";

class LlmClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey || "";
    this.baseUrl = String(options.baseUrl || "").replace(/\/+$/, "");
    this.model = options.model || "";
    this.timeoutMs = Number(options.timeoutMs || 75_000);
    this.maxAttempts = Number(options.maxAttempts || 3);
  }

  get configured() {
    return Boolean(this.apiKey && this.baseUrl && this.model);
  }

  getInfo() {
    return {
      configured: this.configured,
      model: this.model,
    };
  }

  async completeJson({ system, user, maxTokens = 2_000, temperature = 0.1 }) {
    if (!this.configured) throw new Error("LLM 未配置");
    const payload = {
      model: this.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature,
      max_tokens: maxTokens,
      stream: false,
    };

    let lastError;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const bodyText = await response.text();
        if (!response.ok) {
          throw new Error(`LLM API ${response.status}: ${bodyText.slice(0, 300)}`);
        }
        let body;
        try {
          body = JSON.parse(bodyText);
        } catch {
          throw new Error("LLM 返回了无效的 API JSON");
        }
        const content = body?.choices?.[0]?.message?.content;
        if (!content || !String(content).trim()) throw new Error("LLM 返回内容为空");
        let data;
        try {
          data = JSON.parse(content);
        } catch {
          throw new Error("LLM 未返回可解析的 JSON 内容");
        }
        return {
          data,
          usage: body.usage || null,
          model: body.model || this.model,
        };
      } catch (error) {
        lastError = error;
        if (attempt >= this.maxAttempts) break;
        await new Promise((resolve) => setTimeout(resolve, 600 * (2 ** (attempt - 1))));
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError || new Error("LLM 请求失败");
  }
}

function createLlmClientFromEnv() {
  if (process.env.HIREPROOF_AI_ENABLED === "false") return null;
  const apiKey = process.env.LLM_API_KEY || "";
  if (!apiKey) return null;
  return new LlmClient({
    apiKey,
    baseUrl: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
    model: process.env.LLM_MODEL || "gpt-5-mini",
  });
}

module.exports = {
  LlmClient,
  createLlmClientFromEnv,
};
