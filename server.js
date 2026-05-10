const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

loadEnv(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 5177);
const publicRoot = path.join(__dirname, "public");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

const providerDefaults = {
  "openai-responses": {
    label: "OpenAI Responses",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini"
  },
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat"
  },
  newapi: {
    label: "New API",
    baseUrl: "https://你的-new-api-域名/v1",
    model: "gpt-4o-mini"
  }
};

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["conversation_meta", "commitments", "confirmation_sheet", "unconfirmed_items", "risks", "follow_up_scripts"],
  properties: {
    conversation_meta: {
      type: "object",
      additionalProperties: false,
      required: ["candidate_name", "company_name", "position_name", "recruiter_name", "chat_date"],
      properties: {
        candidate_name: { type: ["string", "null"] },
        company_name: { type: ["string", "null"] },
        position_name: { type: ["string", "null"] },
        recruiter_name: { type: ["string", "null"] },
        chat_date: { type: ["string", "null"] }
      }
    },
    commitments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "title", "status", "value", "conditions", "evidence", "confidence"],
        properties: {
          category: {
            type: "string",
            enum: ["salary", "location", "probation", "social_insurance", "working_time", "job_responsibility", "interview", "subsidy", "reimbursement", "onboarding_condition", "other"]
          },
          title: { type: "string" },
          status: { type: "string", enum: ["confirmed", "uncertain", "conflicting", "missing"] },
          value: { type: ["string", "null"] },
          conditions: { type: "array", items: { type: "string" } },
          evidence: { type: "array", items: { type: "string" } },
          confidence: { type: "number" }
        }
      }
    },
    confirmation_sheet: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "items_to_confirm"],
      properties: {
        summary: { type: "string" },
        items_to_confirm: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["item", "suggested_confirmation_text"],
            properties: {
              item: { type: "string" },
              suggested_confirmation_text: { type: "string" }
            }
          }
        }
      }
    },
    unconfirmed_items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["item", "reason", "follow_up_question"],
        properties: {
          item: { type: "string" },
          reason: { type: "string" },
          follow_up_question: { type: "string" }
        }
      }
    },
    risks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["level", "risk_point", "reason", "suggested_action"],
        properties: {
          level: { type: "string", enum: ["low", "medium", "high"] },
          risk_point: { type: "string" },
          reason: { type: "string" },
          suggested_action: { type: "string" }
        }
      }
    },
    follow_up_scripts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["scenario", "message"],
        properties: {
          scenario: { type: "string" },
          message: { type: "string" }
        }
      }
    }
  }
};

const systemPrompt = `你是“职聊凭证 AI”的招聘沟通承诺抽取引擎。
你的任务是从招聘方与求职者的聊天记录中，识别招聘沟通中的明确承诺、模糊承诺、待确认事项、潜在风险，并生成可用于双方确认的结构化 JSON。

规则：
1. 只基于用户提供的聊天记录进行判断，不得编造聊天中没有出现的信息。
2. 如果某项信息没有出现，字段值使用 null 或空数组。
3. 如果某项信息表达模糊，status 使用 uncertain。
4. 如果某项信息已经明确表达，status 使用 confirmed。
5. 如果聊天中出现前后矛盾、附加条件、口头承诺、含糊词语、未写入合同风险，写入 risks。
6. 每条承诺都要尽量保留原文证据 evidence。
7. 风险提醒要中性、克制、可核验，不提供法律结论。
8. 追问话术要礼貌、简短，适合求职者直接发送给招聘方。
9. 输出必须是严格 JSON。`;

const userPrompt = (chatText) => `请从以下招聘聊天记录中抽取招聘沟通承诺。

抽取范围包括：
薪资、地点、试用期、社保、公积金、工作时间、岗位职责、面试安排、补贴、报销、入职条件、绩效奖金、提成、加班、调岗、培训、背调、合同签署、其他影响求职决策的信息。

请特别关注：
1. 是否存在口头承诺。
2. 是否存在“到时候再说”“一般都有”“差不多”“看情况”“领导定”等模糊表达。
3. 是否存在前后不一致。
4. 是否存在未确认的薪资结构、试用期折扣、社保缴纳时间、工作地点变化、加班规则、入职条件。

JSON Schema：
${JSON.stringify(responseSchema)}

聊天记录如下：
${chatText}`;

async function handleRequest(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/status") {
      const config = normalizeConfig({});
      return sendJson(res, 200, {
        configured: Boolean(config.apiKey),
        provider: config.provider,
        baseUrl: config.baseUrl,
        model: config.model
      });
    }

    if (req.method === "POST" && url.pathname === "/api/test-connection") {
      const body = await readJson(req);
      const config = normalizeConfig(body.config || {});
      const text = await testConnection(config);
      return sendJson(res, 200, {
        ok: true,
        provider: providerDefaults[config.provider].label,
        model: config.model,
        text
      });
    }

    if (req.method === "POST" && url.pathname === "/api/models") {
      const body = await readJson(req);
      const config = normalizeConfig(body.config || {});
      const models = await listModels(config);
      return sendJson(res, 200, {
        provider: providerDefaults[config.provider].label,
        models
      });
    }

    if (req.method === "POST" && url.pathname === "/api/analyze") {
      const body = await readJson(req);
      if (!body.chatText || typeof body.chatText !== "string") {
        return sendJson(res, 400, { error: "缺少 chatText" });
      }
      const config = normalizeConfig(body.config || {});
      const analysis = await analyzeWithModel(body.chatText, config);
      return sendJson(res, 200, { analysis });
    }

    if (req.method === "POST" && url.pathname === "/api/rights") {
      const body = await readJson(req);
      if (!body.actualSituation || typeof body.actualSituation !== "string") {
        return sendJson(res, 400, { error: "缺少 actualSituation" });
      }
      if (!body.analysis || typeof body.analysis !== "object") {
        return sendJson(res, 400, { error: "缺少 analysis" });
      }
      const config = normalizeConfig(body.config || {});
      const material = await rightsMaterialWithModel({
        caseMeta: body.caseMeta || {},
        chatText: body.chatText || "",
        analysis: body.analysis,
        actualSituation: body.actualSituation
      }, config);
      return sendJson(res, 200, { material });
    }

    if (req.method === "POST" && url.pathname === "/api/ocr") {
      const body = await readJson(req);
      if (!body.imageDataUrl || typeof body.imageDataUrl !== "string") {
        return sendJson(res, 400, { error: "缺少 imageDataUrl" });
      }
      const config = normalizeConfig(body.config || {});
      const text = await ocrWithModel(body.imageDataUrl, config);
      return sendJson(res, 200, { text });
    }

    return serveStatic(url.pathname, res);
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { error: error.message || "服务异常" });
  }
}

const server = http.createServer(handleRequest);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`职聊凭证 AI running at http://localhost:${PORT}`);
  });
}

module.exports = handleRequest;

function normalizeConfig(input) {
  const hasClientConfig = input && Object.keys(input).length > 0;
  const provider = providerDefaults[input.provider] ? input.provider : "openai-responses";
  const defaults = providerDefaults[provider];
  const rawBaseUrl = input.baseUrl || (!hasClientConfig ? process.env.OPENAI_BASE_URL : "") || defaults.baseUrl;
  return {
    provider,
    apiKey: hasClientConfig ? input.apiKey || "" : process.env.OPENAI_API_KEY || "",
    baseUrl: normalizeBaseUrl(rawBaseUrl),
    model: input.model || (!hasClientConfig ? process.env.OPENAI_MODEL : "") || defaults.model
  };
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (/docs?\.newapi\.pro/i.test(trimmed)) {
    return trimmed;
  }
  return /\/v1$/i.test(trimmed) ? trimmed : `${trimmed}/v1`;
}

function assertApiKey(config) {
  if (/docs?\.newapi\.pro/i.test(config.baseUrl)) {
    const error = new Error("Base URL 填成了 New API 文档地址。请填写你自己的 New API 服务地址，例如 https://你的域名/v1。");
    error.statusCode = 400;
    throw error;
  }
  if (!config.apiKey) {
    const error = new Error("未填写 API Key");
    error.statusCode = 400;
    throw error;
  }
}

async function testConnection(config) {
  assertApiKey(config);
  if (config.provider === "openai-responses") {
    const data = await callResponses(config, {
      model: config.model,
      input: "请只回复 OK"
    });
    return extractOutputText(data).trim();
  }

  const data = await callChatCompletions(config, {
    model: config.model,
    messages: [{ role: "user", content: "请只回复 OK" }],
    temperature: 0
  });
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function listModels(config) {
  assertApiKey(config);
  const data = await getJson(`${config.baseUrl}/models`, config);
  const models = Array.isArray(data.data)
    ? data.data.map((item) => ({
        id: item.id,
        created: item.created || null,
        owned_by: item.owned_by || item.owner || null
      }))
    : [];
  return models.sort((a, b) => a.id.localeCompare(b.id));
}

async function analyzeWithModel(chatText, config) {
  assertApiKey(config);
  if (config.provider === "openai-responses") {
    const data = await callResponses(config, {
      model: config.model,
      instructions: systemPrompt,
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: userPrompt(chatText) }]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "recruit_chat_evidence",
          strict: true,
          schema: responseSchema
        }
      }
    });
    return JSON.parse(extractOutputText(data));
  }

  const data = await callChatCompletions(config, {
    model: config.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt(chatText) }
    ],
    response_format: { type: "json_object" },
    temperature: 0
  });
  return parseJsonFromText(data.choices?.[0]?.message?.content || "");
}

async function rightsMaterialWithModel(caseBundle, config) {
  assertApiKey(config);
  const prompt = rightsPrompt(caseBundle);
  const instructions = [
    "你是招聘沟通证据整理和法律咨询准备助手。",
    "你只整理用户提供的信息，不编造事实，不作确定法律结论，不承诺维权结果。",
    "请用克制、正式、可复制的中文 Markdown 输出。",
    "需要明确区分招聘沟通承诺、入职后实际情况、可能不一致点、现有证据、待补充证据、咨询问题。",
    "最后加入提示：本材料仅用于证据整理和法律咨询准备，不构成法律意见。"
  ].join("\n");

  if (config.provider === "openai-responses") {
    const data = await callResponses(config, {
      model: config.model,
      instructions,
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: prompt }]
        }
      ],
      temperature: 0.2
    });
    return extractOutputText(data).trim();
  }

  const data = await callChatCompletions(config, {
    model: config.model,
    messages: [
      { role: "system", content: instructions },
      { role: "user", content: prompt }
    ],
    temperature: 0.2
  });
  return data.choices?.[0]?.message?.content?.trim() || "";
}

function rightsPrompt({ caseMeta, chatText, analysis, actualSituation }) {
  return `请根据以下材料，生成一份用于咨询劳动监察、法律援助或律师的中文维权准备材料。

输出要求：
1. 只基于提供的信息整理，不补充没有证据的事实。
2. 对争议点使用“可能”“建议咨询”“待核对”等表达。
3. 不要引用具体法条编号，除非用户材料中已经出现。
4. 结构要适合直接复制给法律援助窗口、劳动监察窗口或律师。
5. 输出 Markdown 文本。

案件基本信息：
${JSON.stringify(caseMeta || {}, null, 2)}

招聘聊天原文：
${chatText || "未提供"}

已提取的招聘沟通承诺与风险：
${JSON.stringify(analysis || {}, null, 2)}

入职后实际情况：
${actualSituation}`;
}

async function ocrWithModel(imageDataUrl, config) {
  assertApiKey(config);
  if (config.provider === "deepseek") {
    const error = new Error("DeepSeek 当前文本模型不支持截图 OCR，请切换到 OpenAI Responses 或支持视觉的 New API 模型。");
    error.statusCode = 400;
    throw error;
  }

  if (config.provider === "openai-responses") {
    const data = await callResponses(config, {
      model: config.model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "请对这张招聘聊天截图进行 OCR，只输出聊天文字。保留说话人、顺序、金额、日期、地点、标点。不要总结，不要添加解释。"
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
              detail: "high"
            }
          ]
        }
      ]
    });
    return extractOutputText(data).trim();
  }

  const data = await callChatCompletions(config, {
    model: config.model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "请对这张招聘聊天截图进行 OCR，只输出聊天文字。保留说话人、顺序、金额、日期、地点、标点。不要总结，不要添加解释。" },
          { type: "image_url", image_url: { url: imageDataUrl } }
        ]
      }
    ],
    temperature: 0
  });
  return data.choices?.[0]?.message?.content?.trim() || "";
}

function callResponses(config, payload) {
  return postJson(`${config.baseUrl}/responses`, payload, config);
}

function callChatCompletions(config, payload) {
  return postJson(`${config.baseUrl}/chat/completions`, payload, config);
}

async function postJson(url, payload, config) {
  try {
    return await postJsonWithFetch(url, payload, config);
  } catch (error) {
    if (process.platform === "win32" && /fetch failed|Connect Timeout/i.test(error.message)) {
      return postJsonWithPowerShell(url, payload, config);
    }
    throw error;
  }
}

async function getJson(url, config) {
  try {
    return await getJsonWithFetch(url, config);
  } catch (error) {
    if (process.platform === "win32" && /fetch failed|Connect Timeout/i.test(error.message)) {
      return getJsonWithPowerShell(url, config);
    }
    throw error;
  }
}

async function getJsonWithFetch(url, config) {
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${config.apiKey}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message || `API 请求失败：${response.status}`);
    error.statusCode = response.status;
    throw error;
  }
  return data;
}

async function getJsonWithPowerShell(url, config) {
  const stdout = await runPowerShell([
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path.join(__dirname, "api-get.ps1"),
    "-Url",
    url
  ], config);
  return JSON.parse(stdout);
}

async function postJsonWithFetch(url, payload, config) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message || `API 请求失败：${response.status}`);
    error.statusCode = response.status;
    throw error;
  }
  return data;
}

async function postJsonWithPowerShell(url, payload, config) {
  const payloadPath = path.join(os.tmpdir(), `recruit-chat-ai-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  fs.writeFileSync(payloadPath, JSON.stringify(payload), "utf8");
  try {
    const stdout = await runPowerShell([
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.join(__dirname, "openai-request.ps1"),
      "-Url",
      url,
      "-PayloadPath",
      payloadPath
    ], config);
    return JSON.parse(stdout);
  } finally {
    fs.rmSync(payloadPath, { force: true });
  }
}

function runPowerShell(args, config) {
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", args, {
      env: { ...process.env, OPENAI_API_KEY: config.apiKey },
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(new Error(stderr.trim() || `PowerShell API 请求失败：${code}`));
    });
  });
}

function extractOutputText(response) {
  if (response.output_text) return response.output_text;
  const chunks = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) chunks.push(content.text);
      if (content.type === "text" && content.text) chunks.push(content.text);
    }
  }
  return chunks.join("\n");
}

function parseJsonFromText(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("模型没有返回 JSON");
    return JSON.parse(match[0]);
  }
}

function serveStatic(pathname, res) {
  const safePath = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const filePath = path.normalize(path.join(publicRoot, safePath));
  if (!filePath.startsWith(publicRoot)) return sendText(res, 403, "Forbidden");
  fs.readFile(filePath, (error, content) => {
    if (error) return sendText(res, 404, "Not found");
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(content);
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 60 * 1024 * 1024) {
        reject(Object.assign(new Error("请求体过大"), { statusCode: 413 }));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(Object.assign(new Error("JSON 格式错误"), { statusCode: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}
