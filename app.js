const samples = [
  `HR：我们这边岗位是内容运营，主要做小红书和公众号内容。
候选人：工作地点在哪里？
HR：杭州滨江，地铁口附近。
候选人：薪资大概是多少？
HR：底薪 6K，加绩效，绩效看运营数据。
候选人：试用期多久？
HR：试用期两个月，试用期工资按 80%。
候选人：双休吗？
HR：是双休，正常不加班。
候选人：社保什么时候交？
HR：这个入职后再看，公司都有安排。
候选人：面试路费能报销吗？
HR：外地过来的话可以报销高铁二等座。`,
  `招聘方：我们招电商运营助理，办公地点在苏州工业园区。
求职者：入职前需要试岗吗？
招聘方：要试岗 3 天，合适再发 offer。
求职者：试岗有工资吗？
招聘方：试岗主要是双方看看匹配度，这个先不谈。
求职者：正式薪资是多少？
招聘方：转正综合 8K 到 10K，底薪 5K，其他看提成。
求职者：社保公积金有吗？
招聘方：社保有，公积金要看岗位级别。
求职者：工作时间呢？
招聘方：大小周，晚上忙的时候会晚一点。`
];

const promptTemplate = `你是“职聊凭证 AI”的招聘沟通承诺抽取引擎。

请从招聘方与求职者的聊天记录中识别明确承诺、模糊承诺、待确认事项、潜在风险，并输出严格 JSON。

抽取范围包括：
薪资、地点、试用期、社保、公积金、工作时间、岗位职责、面试安排、补贴、报销、入职条件、绩效奖金、提成、加班、调岗、培训、背调、合同签署、其他影响求职决策的信息。

要求：
1. 只基于聊天记录判断。
2. 不编造聊天中没有出现的信息。
3. 每条承诺保留原文证据。
4. 风险提醒中性、克制、可核验。
5. 追问话术礼貌、简短，适合直接发给招聘方。`;

const providerDefaults = {
  "openai-responses": {
    label: "OpenAI Responses",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    help: "适合文本分析和截图 OCR，使用 /responses 接口。"
  },
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    help: "适合文本分析，使用 OpenAI 兼容的 /chat/completions 接口。截图 OCR 建议切换到支持视觉的接口。"
  },
  newapi: {
    label: "New API",
    baseUrl: "https://你的-new-api服务地址/v1",
    model: "gpt-4o-mini",
    help: "适合 New API 或其他 OpenAI 兼容网关。Base URL 要填你的 New API 服务地址，以 /v1 结尾，不能填 docs.newapi.pro 文档地址。"
  }
};

const dom = {
  chatInput: document.querySelector("#chat-input"),
  caseCandidate: document.querySelector("#case-candidate"),
  caseCompany: document.querySelector("#case-company"),
  casePosition: document.querySelector("#case-position"),
  caseRecruiter: document.querySelector("#case-recruiter"),
  analyzeButton: document.querySelector("#analyze-button"),
  saveRecordButton: document.querySelector("#save-record-button"),
  sampleOne: document.querySelector("#sample-one"),
  sampleTwo: document.querySelector("#sample-two"),
  confirmedList: document.querySelector("#confirmed-list"),
  missingList: document.querySelector("#missing-list"),
  riskList: document.querySelector("#risk-list"),
  questionList: document.querySelector("#question-list"),
  riskRadar: document.querySelector("#risk-radar"),
  evidenceTimeline: document.querySelector("#evidence-timeline"),
  hrScriptOutput: document.querySelector("#hr-script-output"),
  copyHrScript: document.querySelector("#copy-hr-script"),
  reportOutput: document.querySelector("#report-output"),
  promptOutput: document.querySelector("#prompt-output"),
  confirmedCount: document.querySelector("#confirmed-count"),
  missingCount: document.querySelector("#missing-count"),
  riskCount: document.querySelector("#risk-count"),
  completenessCount: document.querySelector("#completeness-count"),
  generatedTime: document.querySelector("#generated-time"),
  statusDot: document.querySelector("#status-dot"),
  statusText: document.querySelector("#status-text"),
  copyReport: document.querySelector("#copy-report"),
  exportJson: document.querySelector("#export-json"),
  exportMd: document.querySelector("#export-md"),
  printReport: document.querySelector("#print-report"),
  copyPrompt: document.querySelector("#copy-prompt"),
  useOcrDemo: document.querySelector("#use-ocr-demo"),
  imageInput: document.querySelector("#image-input"),
  imagePreview: document.querySelector("#image-preview"),
  aiMode: document.querySelector("#ai-mode"),
  apiStatus: document.querySelector("#api-status"),
  actualSituation: document.querySelector("#actual-situation"),
  generateRightsButton: document.querySelector("#generate-rights-button"),
  copyRightsButton: document.querySelector("#copy-rights-button"),
  exportRightsButton: document.querySelector("#export-rights-button"),
  exportCasePackageButton: document.querySelector("#export-case-package-button"),
  rightsOutput: document.querySelector("#rights-output"),
  rightsGeneratedTime: document.querySelector("#rights-generated-time"),
  rightsDisputeList: document.querySelector("#rights-dispute-list"),
  rightsEvidenceList: document.querySelector("#rights-evidence-list"),
  rightsQuestionList: document.querySelector("#rights-question-list"),
  rightsActionList: document.querySelector("#rights-action-list"),
  providerSelect: document.querySelector("#provider-select"),
  apiKeyInput: document.querySelector("#api-key-input"),
  baseUrlInput: document.querySelector("#base-url-input"),
  modelInput: document.querySelector("#model-input"),
  testApiButton: document.querySelector("#test-api-button"),
  listModelsButton: document.querySelector("#list-models-button"),
  saveApiButton: document.querySelector("#save-api-button"),
  useServerConfigButton: document.querySelector("#use-server-config-button"),
  apiHelp: document.querySelector("#api-help"),
  modelFilter: document.querySelector("#model-filter"),
  modelList: document.querySelector("#model-list"),
  historyList: document.querySelector("#history-list"),
  clearHistoryButton: document.querySelector("#clear-history-button")
};

let selectedImageDataUrl = "";
let lastAnalysisData = null;
let currentModels = [];

function getCaseMeta() {
  return {
    candidate: dom.caseCandidate.value.trim(),
    company: dom.caseCompany.value.trim(),
    position: dom.casePosition.value.trim(),
    recruiter: dom.caseRecruiter.value.trim()
  };
}

function setCaseMeta(meta = {}) {
  dom.caseCandidate.value = meta.candidate || "";
  dom.caseCompany.value = meta.company || "";
  dom.casePosition.value = meta.position || "";
  dom.caseRecruiter.value = meta.recruiter || "";
}

function getStoredConfig() {
  const saved = JSON.parse(localStorage.getItem("recruit-chat-ai-config") || "{}");
  const provider = saved.provider || "openai-responses";
  const defaults = providerDefaults[provider];
  return {
    provider,
    apiKey: saved.apiKey || "",
    baseUrl: saved.baseUrl || defaults.baseUrl,
    model: saved.model || defaults.model
  };
}

function readConfigFromForm() {
  return {
    provider: dom.providerSelect.value,
    apiKey: dom.apiKeyInput.value.trim(),
    baseUrl: dom.baseUrlInput.value.trim(),
    model: dom.modelInput.value.trim()
  };
}

function saveConfig() {
  const config = readConfigFromForm();
  localStorage.setItem("recruit-chat-ai-config", JSON.stringify(config));
  dom.aiMode.checked = Boolean(config.apiKey);
  setStatus("API 配置已保存", true);
  refreshApiStatusLabel();
}

function applyConfigToForm(config) {
  dom.providerSelect.value = config.provider;
  dom.apiKeyInput.value = config.apiKey;
  dom.baseUrlInput.value = config.baseUrl;
  dom.modelInput.value = config.model;
  dom.apiHelp.textContent = providerDefaults[config.provider].help;
}

function applyProviderDefaults() {
  const provider = dom.providerSelect.value;
  const defaults = providerDefaults[provider];
  dom.baseUrlInput.value = defaults.baseUrl;
  dom.modelInput.value = defaults.model;
  dom.apiHelp.textContent = defaults.help;
}

function refreshApiStatusLabel() {
  const config = readConfigFromForm();
  dom.apiStatus.textContent = config.apiKey
    ? `${providerDefaults[config.provider].label} 已填写：${config.model}`
    : "未填写 API Key，可使用规则演示";
}

function splitLines(text) {
  return text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

function analyzeChatLocally(text) {
  const lines = splitLines(text);
  const confirmed = [];
  const risks = [];
  const missing = [];

  const rules = [
    ["薪资", ["薪资", "底薪", "工资", "K", "绩效", "提成", "综合"]],
    ["工作地点", ["地点", "办公", "杭州", "苏州", "园区", "滨江"]],
    ["试用期", ["试用期", "转正"]],
    ["社保公积金", ["社保", "公积金", "五险一金"]],
    ["工作时间", ["双休", "大小周", "加班", "工作时间", "晚一点"]],
    ["岗位职责", ["岗位", "负责", "主要做", "招"]],
    ["补贴报销", ["报销", "补贴", "路费", "高铁"]],
    ["试岗", ["试岗"]]
  ];

  for (const [type, keywords] of rules) {
    const line = lines.find((item) => keywords.some((keyword) => item.includes(keyword)) && !/吗|呢|多少|哪里|多久/.test(item));
    if (line) {
      confirmed.push({
        type,
        content: cleanSpeaker(line),
        evidence: line,
        risk_level: /再看|看情况|先不谈|绩效|提成|加班|试岗/.test(line) ? "中" : "低",
        note: /再看|看情况|先不谈/.test(line) ? "表述较模糊，建议再次确认。" : "表达较明确，可纳入确认单。"
      });
    } else {
      missing.push({
        type,
        reason: `${type}尚未在聊天中明确。`,
        suggested_question: `请问${type}的具体安排是什么？`
      });
    }
  }

  const riskPatterns = [
    ["绩效标准", "绩效或提成规则需要确认。", ["绩效", "提成"]],
    ["社保缴纳", "社保或公积金缴纳时间需要确认。", ["入职后再看", "看岗位级别"]],
    ["工作时间", "加班频率、调休和补贴规则需要确认。", ["正常不加班", "晚一点", "忙的时候"]],
    ["试岗薪资", "试岗期间工资和考核标准需要确认。", ["试岗", "先不谈"]]
  ];

  for (const [type, message, keywords] of riskPatterns) {
    const evidence = lines.find((line) => keywords.some((keyword) => line.includes(keyword)));
    if (evidence) {
      risks.push({ type, level: "中", message, evidence });
    }
  }

  return {
    confirmed_items: confirmed,
    unconfirmed_items: missing,
    risk_alerts: risks,
    confirmation_note: buildReport(confirmed, missing, risks)
  };
}

function cleanSpeaker(line) {
  return line.replace(/^(HR|候选人|招聘方|求职者|面试官|我)\s*[:：]\s*/, "");
}

function normalizeAnalysis(data) {
  if (data.confirmed_items) return data;

  const confirmed = (data.commitments || [])
    .filter((item) => item.status !== "missing")
    .map((item) => ({
      type: categoryLabel(item.category),
      content: item.value || item.title || "未提取到具体值",
      evidence: Array.isArray(item.evidence) ? item.evidence.join("；") : item.evidence || "",
      risk_level: item.status === "confirmed" ? "低" : "中",
      note: item.conditions?.length ? `附加条件：${item.conditions.join("；")}` : "由大模型结构化提取。"
    }));

  const missing = (data.unconfirmed_items || []).map((item) => ({
    type: item.item || "待确认事项",
    reason: item.reason || "该事项仍需进一步确认。",
    suggested_question: item.follow_up_question || "请问该事项能否进一步明确？"
  }));

  const risks = (data.risks || []).map((item) => ({
    type: item.risk_point || "沟通风险",
    level: riskLevelLabel(item.level),
    message: item.reason || item.suggested_action || "建议进一步确认。",
    evidence: item.suggested_action || ""
  }));

  return {
    confirmed_items: confirmed,
    unconfirmed_items: missing,
    risk_alerts: risks,
    confirmation_note: buildReport(confirmed, missing, risks, data.confirmation_sheet?.summary)
  };
}

function categoryLabel(category) {
  const map = {
    salary: "薪资",
    location: "工作地点",
    probation: "试用期",
    social_insurance: "社保公积金",
    working_time: "工作时间",
    job_responsibility: "岗位职责",
    interview: "面试安排",
    subsidy: "补贴",
    reimbursement: "报销",
    onboarding_condition: "入职条件",
    other: "其他"
  };
  return map[category] || category || "其他";
}

function riskLevelLabel(level) {
  return { low: "低", medium: "中", high: "高" }[level] || level || "中";
}

function buildReport(confirmed, missing, risks, summary = "") {
  const date = new Date().toLocaleString("zh-CN", { hour12: false });
  const confirmedText = confirmed.length
    ? confirmed.map((item, index) => `${index + 1}. ${item.type}：${item.content}\n   来源：${item.evidence || "由聊天上下文提取"}\n   备注：${item.note || "建议双方确认。"}`).join("\n")
    : "暂无明确承诺，请补充聊天记录。";
  const missingText = missing.length
    ? missing.map((item, index) => `${index + 1}. ${item.type}：${item.reason}`).join("\n")
    : "暂无待确认事项。";
  const questionText = missing.length
    ? missing.map((item, index) => `${index + 1}. ${item.suggested_question}`).join("\n")
    : "当前信息较完整，可请 HR 对确认单内容进行回复确认。";
  const riskText = risks.length
    ? risks.map((item, index) => `${index + 1}. ${item.type}：${item.message}\n   来源：${item.evidence || "聊天上下文"}`).join("\n")
    : "暂无明显沟通风险。";

  return `招聘沟通确认单

项目：职聊凭证 AI
生成时间：${date}

${summary ? `摘要：${summary}\n\n` : ""}一、本次沟通已确认事项

${confirmedText}

二、尚未确认事项

${missingText}

三、沟通风险提示

${riskText}

四、建议向 HR 确认的问题

${questionText}

五、确认话术

您好，为避免双方理解不一致，我整理了一份本次沟通确认事项，麻烦您帮忙确认以上内容是否准确。如有遗漏或需要修正的地方，也请您直接补充。`;
}

async function requestJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `请求失败：${response.status}`);
  return payload;
}

function activeConfig(forceClientConfig = false) {
  const config = readConfigFromForm();
  if (!forceClientConfig && !config.apiKey) return null;
  return {
    provider: config.provider,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    model: config.model
  };
}

function explainConnectionError(error) {
  const message = error.message || String(error);
  if (/401|unauthorized|invalid|Authentication/i.test(message)) {
    return `${message}。请检查 API Key 是否有效，是否复制完整，是否属于当前供应商。`;
  }
  if (/404|Not found/i.test(message)) {
    return `${message}。请检查 Base URL 是否是你的 API 服务地址，并以 /v1 结尾。New API 不能填 https://docs.newapi.pro/zh 这种文档地址。`;
  }
  if (/model|does not exist|not found/i.test(message)) {
    return `${message}。请先检测模型并选择列表中的模型。`;
  }
  if (/fetch failed|timeout|Connect/i.test(message)) {
    return `${message}。网络连接失败，请检查代理、网络或 Base URL。`;
  }
  return message;
}

async function analyzeChat(text) {
  if (dom.aiMode.checked) {
    const payload = await requestJson("/api/analyze", { chatText: text, config: activeConfig() });
    return normalizeAnalysis(payload.analysis);
  }
  return analyzeChatLocally(text);
}

async function runAnalysis() {
  const text = dom.chatInput.value.trim();
  if (!text) {
    setStatus("请先输入聊天记录", false);
    return;
  }

  dom.analyzeButton.disabled = true;
  setStatus(dom.aiMode.checked ? "正在调用真实大模型分析" : "正在生成规则演示结果", false);
  try {
    renderAnalysis(await analyzeChat(text));
  } catch (error) {
    setStatus(`AI 调用失败，已使用本地演示：${error.message}`, false);
    dom.aiMode.checked = false;
    renderAnalysis(analyzeChatLocally(text));
  } finally {
    dom.analyzeButton.disabled = false;
  }
}

async function runImageOcr() {
  if (!selectedImageDataUrl) {
    setStatus("请先选择聊天截图", false);
    return;
  }
  setStatus("正在进行截图 OCR", false);
  try {
    const payload = await requestJson("/api/ocr", {
      imageDataUrl: selectedImageDataUrl,
      config: activeConfig()
    });
    dom.chatInput.value = payload.text || "";
    switchTab("text");
    await runAnalysis();
  } catch (error) {
    setStatus(`OCR 调用失败：${error.message}`, false);
  }
}

async function testApiConnection() {
  const config = activeConfig(true);
  if (!config.apiKey) {
    setStatus("请先填写 API Key", false);
    return;
  }
  dom.testApiButton.disabled = true;
  setStatus("正在检测 API 接入", false);
  try {
    const result = await requestJson("/api/test-connection", { config });
    saveConfig();
    setStatus(`接入成功：${result.provider} / ${result.model}`, true);
  } catch (error) {
    setStatus(`接入失败：${explainConnectionError(error)}`, false);
  } finally {
    dom.testApiButton.disabled = false;
  }
}

async function listModels() {
  const config = activeConfig(true);
  if (!config.apiKey) {
    setStatus("请先填写 API Key", false);
    return;
  }
  dom.listModelsButton.disabled = true;
  dom.modelList.innerHTML = "";
  setStatus("正在检测可用模型", false);
  try {
    const result = await requestJson("/api/models", { config });
    currentModels = result.models || [];
    renderModelList(currentModels);
    setStatus(`检测到 ${result.models.length} 个模型`, true);
  } catch (error) {
    setStatus(`模型检测失败：${explainConnectionError(error)}`, false);
  } finally {
    dom.listModelsButton.disabled = false;
  }
}

async function useServerConfig() {
  try {
    const response = await fetch("/api/status");
    const status = await response.json();
    dom.providerSelect.value = status.provider || "openai-responses";
    dom.baseUrlInput.value = status.baseUrl || providerDefaults[dom.providerSelect.value].baseUrl;
    dom.modelInput.value = status.model || providerDefaults[dom.providerSelect.value].model;
    dom.apiKeyInput.value = "";
    localStorage.removeItem("recruit-chat-ai-config");
    dom.aiMode.checked = Boolean(status.configured);
    dom.apiHelp.textContent = status.configured
      ? "已切换为服务端 .env 配置。前端不会显示服务端 API Key，可直接检测接入或分析。"
      : "服务端 .env 未配置 API Key。";
    refreshApiStatusLabel();
    setStatus(status.configured ? "已使用服务端配置" : "服务端未配置 API Key", Boolean(status.configured));
  } catch (error) {
    setStatus(`读取服务端配置失败：${error.message}`, false);
  }
}

function renderModelList(models) {
  dom.modelList.innerHTML = "";
  const keyword = dom.modelFilter.value.trim().toLowerCase();
  const visibleModels = keyword
    ? models.filter((model) => model.id.toLowerCase().includes(keyword))
    : models;
  if (!visibleModels.length) {
    const empty = document.createElement("div");
    empty.className = "api-help";
    empty.textContent = models.length ? "没有匹配的模型。" : "没有检测到模型。";
    dom.modelList.appendChild(empty);
    return;
  }
  for (const model of visibleModels) {
    const row = document.createElement("div");
    row.className = "model-option";
    row.innerHTML = `<span>${escapeHtml(model.id)}</span><button type="button">选择</button>`;
    row.querySelector("button").addEventListener("click", () => {
      dom.modelInput.value = model.id;
      saveConfig();
      setStatus(`已选择模型：${model.id}`, true);
    });
    dom.modelList.appendChild(row);
  }
}

function renderAnalysis(data) {
  lastAnalysisData = data;
  renderList(dom.confirmedList, data.confirmed_items, "confirmed");
  renderList(dom.missingList, data.unconfirmed_items, "missing");
  renderList(dom.riskList, data.risk_alerts, "risk");
  renderQuestions(data.unconfirmed_items);
  renderRiskRadar(data);
  renderTimeline(data);
  dom.hrScriptOutput.textContent = buildHrScript(data);
  dom.reportOutput.textContent = withCaseMeta(data.confirmation_note);
  dom.confirmedCount.textContent = data.confirmed_items.length;
  dom.missingCount.textContent = data.unconfirmed_items.length;
  dom.riskCount.textContent = data.risk_alerts.length;
  dom.completenessCount.textContent = `${computeCompleteness(data)}%`;
  dom.generatedTime.textContent = new Date().toLocaleString("zh-CN", { hour12: false });
  renderRightsToolkit(data, dom.actualSituation.value.trim());
  setStatus(dom.aiMode.checked ? "AI 分析完成" : "已生成规则演示确认单", true);
}

function renderRiskRadar(data) {
  const buckets = [
    ["薪资", ["薪资", "绩效", "提成", "工资"]],
    ["社保", ["社保", "公积金", "五险"]],
    ["工时", ["加班", "工作时间", "双休", "大小周"]],
    ["试岗", ["试岗", "试用期"]],
    ["报销", ["报销", "补贴", "路费"]]
  ];
  const riskText = [
    ...data.risk_alerts.map((item) => `${item.type} ${item.message} ${item.evidence}`),
    ...data.unconfirmed_items.map((item) => `${item.type} ${item.reason}`)
  ].join(" ");
  dom.riskRadar.innerHTML = "";
  for (const [label, keywords] of buckets) {
    const score = keywords.reduce((sum, keyword) => sum + (riskText.includes(keyword) ? 1 : 0), 0);
    const percent = Math.min(100, score * 35);
    const node = document.createElement("div");
    node.className = "radar-item";
    node.innerHTML = `
      <span>${label}</span>
      <div class="radar-track"><div class="radar-fill" style="width:${percent}%"></div></div>
      <span>${percent}%</span>
    `;
    dom.riskRadar.appendChild(node);
  }
}

function renderTimeline(data) {
  const items = data.confirmed_items.slice(0, 8);
  dom.evidenceTimeline.innerHTML = "";
  if (!items.length) {
    dom.evidenceTimeline.appendChild(emptyItem("暂无证据时间线", ""));
    return;
  }
  items.forEach((item, index) => {
    const node = document.createElement("div");
    node.className = "timeline-item";
    node.innerHTML = `
      <span class="timeline-type">${index + 1}. ${escapeHtml(item.type)}</span>
      ${escapeHtml(item.evidence || item.content)}
    `;
    dom.evidenceTimeline.appendChild(node);
  });
}

function buildHrScript(data) {
  const meta = getCaseMeta();
  const prefix = meta.recruiter ? `${meta.recruiter}您好，` : "您好，";
  const questions = data.unconfirmed_items
    .slice(0, 5)
    .map((item, index) => `${index + 1}. ${item.suggested_question}`)
    .join("\n");
  return `${prefix}为避免双方理解不一致，我整理了一份本次招聘沟通确认事项，麻烦您帮忙确认以下内容是否准确。

${data.confirmed_items.slice(0, 6).map((item, index) => `${index + 1}. ${item.type}：${item.content}`).join("\n")}

另外还有几个事项想请您补充确认：
${questions || "暂无需要补充的问题。"}

谢谢。`;
}

async function generateRightsMaterial() {
  if (!lastAnalysisData) {
    setStatus("请先完成招聘聊天分析，再生成维权材料", false);
    return;
  }
  const actual = dom.actualSituation.value.trim();
  if (!actual) {
    setStatus("请先填写入职后实际情况", false);
    return;
  }
  const meta = getCaseMeta();
  renderRightsToolkit(lastAnalysisData, actual);
  if (dom.aiMode.checked) {
    dom.generateRightsButton.disabled = true;
    setStatus("正在调用 AI 生成维权咨询准备材料", false);
    try {
      const payload = await requestJson("/api/rights", {
        caseMeta: meta,
        chatText: dom.chatInput.value,
        analysis: lastAnalysisData,
        actualSituation: actual,
        config: activeConfig()
      });
      dom.rightsOutput.textContent = payload.material || "";
      dom.rightsGeneratedTime.textContent = new Date().toLocaleString("zh-CN", { hour12: false });
      setStatus("AI 维权咨询准备材料已生成", true);
      return;
    } catch (error) {
      setStatus(`AI 维权材料生成失败，已使用本地模板：${explainConnectionError(error)}`, false);
    } finally {
      dom.generateRightsButton.disabled = false;
    }
  }
  const confirmed = lastAnalysisData.confirmed_items
    .map((item, index) => `${index + 1}. ${item.type}：${item.content}\n   证据原文：${item.evidence || "聊天上下文"}`)
    .join("\n");
  const material = `维权求助材料

一、基本信息

候选人：${meta.candidate || "未填写"}
公司：${meta.company || "未填写"}
岗位：${meta.position || "未填写"}
沟通对象：${meta.recruiter || "未填写"}
生成时间：${new Date().toLocaleString("zh-CN", { hour12: false })}

二、招聘沟通中已形成的承诺

${confirmed || "暂无已提取承诺。"}

三、入职后实际情况

${actual}

四、可能存在的不一致点

${buildDisputePoints(lastAnalysisData, actual)}

五、现有证据清单

1. 招聘聊天记录原文
2. 职聊凭证 AI 生成的沟通确认单
3. 与薪资、社保、工作地点、工时、试岗相关的聊天截图或导出记录
4. Offer、劳动合同、工资流水、考勤记录、社保缴纳记录

六、咨询时可这样说明

您好，我想咨询一起招聘沟通承诺与实际入职情况不一致的问题。招聘沟通中对方曾确认了岗位、薪资、地点、工作时间、试用期或社保等事项，但我入职后发现实际情况存在差异。我已经整理了聊天记录原文、承诺清单和实际情况说明，想请您帮我判断可采取哪些合法维权方式，以及还需要补充哪些证据。

七、下一步建议

1. 保留聊天原文和截图，避免只保留转述内容
2. 整理 offer、合同、工资流水、考勤和社保记录
3. 向 HR 发送书面确认消息，要求对差异作出解释
4. 咨询当地劳动监察、法律援助或专业律师
5. 涉及工资、试岗、社保等事项时，优先收集可核验材料

提示：本材料仅用于证据整理和法律咨询准备，不构成法律意见。`;
  dom.rightsOutput.textContent = material;
  dom.rightsGeneratedTime.textContent = new Date().toLocaleString("zh-CN", { hour12: false });
  setStatus("维权求助材料已生成", true);
}

function exportRightsMaterial() {
  const content = dom.rightsOutput.textContent.trim();
  if (!content || content.includes("填写入职后实际情况后")) {
    setStatus("请先生成维权材料", false);
    return;
  }
  downloadText("职聊凭证AI-维权求助材料.md", content, "text/markdown");
  setStatus("维权材料已导出", true);
}

function exportCasePackage() {
  if (!lastAnalysisData) {
    setStatus("请先完成招聘聊天分析，再导出证据包", false);
    return;
  }
  const meta = getCaseMeta();
  const actual = dom.actualSituation.value.trim();
  const rightsContent = dom.rightsOutput.textContent.trim();
  const rightsMaterial = rightsContent.includes("填写入职后实际情况后") ? "尚未生成维权材料。" : rightsContent;
  const markdown = `# 职聊凭证 AI 完整证据包

导出时间：${new Date().toLocaleString("zh-CN", { hour12: false })}

## 基本信息

- 候选人：${meta.candidate || "未填写"}
- 公司：${meta.company || "未填写"}
- 岗位：${meta.position || "未填写"}
- 沟通对象：${meta.recruiter || "未填写"}

## 招聘聊天原文

\`\`\`text
${dom.chatInput.value || "未填写"}
\`\`\`

## 招聘沟通确认单

${dom.reportOutput.textContent || "尚未生成确认单。"}

## 入职后实际情况

${actual || "未填写"}

## 维权求助材料

${rightsMaterial}

${cardsToMarkdown("差异焦点", buildRightsDisputeCards(lastAnalysisData, actual))}

${cardsToMarkdown("证据补齐", buildRightsEvidenceCards(actual))}

${cardsToMarkdown("咨询问题", buildRightsQuestionCards(lastAnalysisData, actual))}

${cardsToMarkdown("行动路线", buildRightsActionCards())}
`;
  downloadText("职聊凭证AI-完整证据包.md", markdown, "text/markdown");
  setStatus("完整证据包已导出", true);
}

function cardsToMarkdown(title, cards) {
  return `## ${title}

${cards.map((item, index) => `${index + 1}. ${item.title}${item.tag ? `（${item.tag}）` : ""}\n   ${item.body || ""}`).join("\n")}`;
}

function buildDisputePoints(data, actual) {
  const disputeItems = getRightsDisputeItems(data, actual);
  const points = disputeItems.map((item, index) => `${index + 1}. ${item.title}：${item.body}`);
  return points.length ? points.join("\n") : "暂未自动匹配到明显不一致点，请结合聊天原文、合同和实际记录人工核对。";
}

function getRightsDisputeItems(data, actual) {
  if (!data || !actual) return [];
  const points = [];
  const checks = [
    {
      label: "薪资",
      typeKeywords: ["薪资"],
      promiseKeywords: ["薪资", "工资", "绩效", "提成", "底薪", "K"],
      actualKeywords: ["薪资", "工资", "绩效", "提成", "底薪", "降薪", "少发", "5K", "6K", "8K", "10K"]
    },
    {
      label: "社保公积金",
      typeKeywords: ["社保", "公积金"],
      promiseKeywords: ["社保", "公积金", "五险"],
      actualKeywords: ["社保", "公积金", "五险", "转正后才缴", "未缴", "不缴", "补缴"]
    },
    {
      label: "工作地点",
      typeKeywords: ["地点"],
      promiseKeywords: ["地点", "办公", "杭州", "苏州", "滨江", "园区"],
      actualKeywords: ["工作地点", "办公地点", "地点", "外地", "调动", "调到", "安排到", "通勤", "萧山", "滨江", "园区"]
    },
    {
      label: "工作时间",
      typeKeywords: ["工作时间", "工时"],
      promiseKeywords: ["加班", "双休", "大小周", "工作时间", "晚一点"],
      actualKeywords: ["加班", "双休", "单休", "大小周", "工时", "晚上", "晚到", "调休", "排班", "9 点", "九点"]
    },
    {
      label: "试岗试用",
      typeKeywords: ["试岗", "试用期"],
      promiseKeywords: ["试岗", "试用期", "转正", "80%"],
      actualKeywords: ["试岗", "试用期", "试用期工资", "80%", "无工资", "不给工资"]
    },
    {
      label: "岗位职责",
      typeKeywords: ["岗位", "职责"],
      promiseKeywords: ["岗位", "职责", "运营", "内容", "助理"],
      actualKeywords: ["岗位", "职责", "客服", "直播", "销售", "电商", "辅助", "内容变成", "实际做"]
    },
    {
      label: "补贴报销",
      typeKeywords: ["补贴", "报销"],
      promiseKeywords: ["报销", "补贴", "路费", "高铁"],
      actualKeywords: ["报销", "补贴", "路费", "高铁", "未处理", "不认", "不给报"]
    }
  ];
  for (const check of checks) {
    const actualSnippet = findActualSnippet(actual, check.actualKeywords);
    if (actualSnippet) {
      const related = findRelatedCommitment(data.confirmed_items, check);
      if (!related) continue;
      points.push({
        title: check.label,
        tag: "待核对",
        body: `招聘阶段信息：${formatSentence(related.content || related.evidence || "已提取到相关信息")}实际描述：${formatSentence(actualSnippet)}建议核对聊天原文、合同条款和入职后记录。`
      });
    }
  }
  return points;
}

function findRelatedCommitment(items, check) {
  const byType = items.find((item) => check.typeKeywords.some((keyword) => item.type.includes(keyword)));
  if (byType) return byType;
  return items.find((item) => (
    check.promiseKeywords.some((keyword) => `${item.type} ${item.content} ${item.evidence}`.includes(keyword))
  ));
}

function findActualSnippet(actual, keywords) {
  const parts = actual
    .split(/[\n。；;！!？?]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const matched = parts.find((part) => keywords.some((keyword) => part.includes(keyword)));
  if (matched) return matched;
  return keywords.some((keyword) => actual.includes(keyword)) ? actual.slice(0, 120) : "";
}

function formatSentence(text) {
  const clean = String(text || "").trim().replace(/[。；;？！!?]+$/, "");
  return clean ? `${clean}。` : "";
}

function renderRightsToolkit(data, actual) {
  renderRightsCards(dom.rightsDisputeList, buildRightsDisputeCards(data, actual), "risk", "填写入职后实际情况后显示差异焦点");
  renderRightsCards(dom.rightsEvidenceList, buildRightsEvidenceCards(actual), "missing", "暂无证据补齐建议");
  renderRightsCards(dom.rightsQuestionList, buildRightsQuestionCards(data, actual), "", "暂无咨询问题");
  renderRightsCards(dom.rightsActionList, buildRightsActionCards(), "", "暂无行动路线");
}

function buildRightsDisputeCards(data, actual) {
  const disputes = getRightsDisputeItems(data, actual);
  if (disputes.length) return disputes;
  if (!actual) {
    return [{
      title: "等待填写实际情况",
      tag: "待输入",
      body: "在左侧维权页填写入职后的薪资、社保、工时、地点或岗位差异后，这里会生成比对焦点。"
    }];
  }
  return [{
    title: "需要人工核对",
    tag: "待判断",
    body: "当前文本未命中明显差异关键词，建议结合聊天原文、合同、工资和考勤记录逐项核对。"
  }];
}

function buildRightsEvidenceCards(actual) {
  const hasChat = Boolean(dom.chatInput.value.trim());
  const hasReport = Boolean(lastAnalysisData);
  const hasActual = Boolean(actual);
  return [
    {
      title: "招聘聊天原文和截图",
      tag: hasChat ? "已具备" : "待补充",
      body: hasChat ? "文本区已有聊天原文，建议同时保存原始截图和导出文件。" : "补充招聘沟通原文、截图或平台导出记录。"
    },
    {
      title: "沟通确认单",
      tag: hasReport ? "已生成" : "待生成",
      body: hasReport ? "右侧已生成确认单，可作为承诺提取索引使用。" : "先完成招聘聊天分析，生成承诺清单和确认单。"
    },
    {
      title: "入职后实际情况说明",
      tag: hasActual ? "已填写" : "待填写",
      body: hasActual ? "已填写实际情况，建议补充发生日期、对接人和对应记录。" : "填写入职后的真实岗位、薪资、地点、工时、社保或报销情况。"
    },
    {
      title: "Offer、合同、工资和考勤",
      tag: "建议补充",
      body: "准备 offer、劳动合同、工资流水、考勤记录、排班截图、社保缴纳记录和 HR 后续回复。"
    }
  ];
}

function buildRightsQuestionCards(data, actual) {
  const disputes = getRightsDisputeItems(data, actual);
  const questions = disputes.map((item) => ({
    title: `关于${item.title}`,
    tag: "咨询",
    body: `招聘沟通承诺与入职后情况存在差异时，我可以要求公司补充书面说明或提供哪些材料？`
  }));
  const missingQuestions = (data?.unconfirmed_items || []).slice(0, 3).map((item) => ({
    title: item.type,
    tag: "补证",
    body: `招聘阶段${item.type}未明确，后续咨询时需要补充哪些证据来说明沟通过程？`
  }));
  const base = [
    {
      title: "证据效力",
      tag: "咨询",
      body: "聊天截图、确认单、工资流水、考勤记录之间如何形成完整证据链？"
    },
    {
      title: "沟通策略",
      tag: "咨询",
      body: "在继续沟通前，是否建议先向 HR 发送书面核对消息并保存回复？"
    }
  ];
  return [...questions, ...missingQuestions, ...base].slice(0, 6);
}

function buildRightsActionCards() {
  return [
    {
      title: "1. 固定原始证据",
      tag: "当天",
      body: "保存聊天截图、平台记录、offer、合同、工资和考勤材料，尽量保留时间、账号和上下文。"
    },
    {
      title: "2. 发送书面核对",
      tag: "沟通",
      body: "用确认话术向 HR 核对差异点，让对方以文字方式回复，避免仅口头沟通。"
    },
    {
      title: "3. 整理咨询材料",
      tag: "准备",
      body: "导出本页证据包，按承诺、实际情况、差异点、证据清单和咨询问题组织。"
    },
    {
      title: "4. 寻求专业帮助",
      tag: "咨询",
      body: "携带材料咨询劳动监察、法律援助窗口或专业律师，确认后续处理方式。"
    }
  ];
}

function renderRightsCards(target, items, mode, emptyText) {
  target.innerHTML = "";
  if (!items.length) {
    target.appendChild(emptyItem(emptyText, mode));
    return;
  }
  for (const item of items) {
    const node = document.createElement("article");
    node.className = `evidence-item ${mode}`;
    node.innerHTML = `
      <div class="item-topline">
        <span>${escapeHtml(item.title)}</span>
        <span class="item-tag">${escapeHtml(item.tag || "")}</span>
      </div>
      <div class="item-source">${escapeHtml(item.body || "")}</div>
    `;
    target.appendChild(node);
  }
}

function withCaseMeta(report) {
  const meta = getCaseMeta();
  const lines = [
    meta.candidate && `候选人：${meta.candidate}`,
    meta.company && `公司：${meta.company}`,
    meta.position && `岗位：${meta.position}`,
    meta.recruiter && `沟通对象：${meta.recruiter}`
  ].filter(Boolean);
  if (!lines.length) return report;
  return report.replace("一、本次沟通已确认事项", `${lines.join("\n")}\n\n一、本次沟通已确认事项`);
}

function computeCompleteness(data) {
  const required = ["薪资", "工作地点", "试用期", "社保公积金", "工作时间", "岗位职责", "补贴报销", "试岗"];
  const confirmedText = data.confirmed_items.map((item) => `${item.type} ${item.content}`).join(" ");
  const hit = required.filter((key) => confirmedText.includes(key) || data.confirmed_items.some((item) => item.type === key)).length;
  return Math.round((hit / required.length) * 100);
}

function exportAnalysisJson() {
  if (!lastAnalysisData) {
    setStatus("暂无可导出的分析结果", false);
    return;
  }
  const payload = {
    exported_at: new Date().toISOString(),
    chat_text: dom.chatInput.value,
    report: dom.reportOutput.textContent,
    analysis: lastAnalysisData
  };
  downloadText("职聊凭证AI-分析结果.json", JSON.stringify(payload, null, 2), "application/json");
  setStatus("JSON 已导出", true);
}

function exportAnalysisMarkdown() {
  if (!lastAnalysisData) {
    setStatus("暂无可导出的分析结果", false);
    return;
  }
  const markdown = `# 职聊凭证 AI 分析结果

导出时间：${new Date().toLocaleString("zh-CN", { hour12: false })}

## 原始聊天记录

\`\`\`text
${dom.chatInput.value}
\`\`\`

## 沟通确认单

${dom.reportOutput.textContent}
`;
  downloadText("职聊凭证AI-沟通确认单.md", markdown, "text/markdown");
  setStatus("Markdown 已导出", true);
}

function downloadText(filename, content, mimeType) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getHistory() {
  return JSON.parse(localStorage.getItem("recruit-chat-history") || "[]");
}

function setHistory(records) {
  localStorage.setItem("recruit-chat-history", JSON.stringify(records.slice(0, 20)));
}

function saveCurrentRecord() {
  if (!lastAnalysisData) {
    setStatus("请先完成一次分析再保存", false);
    return;
  }
  const meta = getCaseMeta();
  const title = meta.company || meta.position || "未命名招聘沟通";
  const record = {
    id: `${Date.now()}`,
    title,
    meta,
    chatText: dom.chatInput.value,
    analysis: lastAnalysisData,
    report: dom.reportOutput.textContent,
    savedAt: new Date().toISOString()
  };
  setHistory([record, ...getHistory().filter((item) => item.id !== record.id)]);
  renderHistory();
  setStatus("记录已保存到本地历史", true);
}

function renderHistory() {
  const records = getHistory();
  dom.historyList.innerHTML = "";
  if (!records.length) {
    const empty = document.createElement("div");
    empty.className = "api-help";
    empty.textContent = "暂无历史记录。完成分析后点击保存记录。";
    dom.historyList.appendChild(empty);
    return;
  }
  for (const record of records) {
    const item = document.createElement("article");
    item.className = "history-item";
    const date = new Date(record.savedAt).toLocaleString("zh-CN", { hour12: false });
    item.innerHTML = `
      <div class="history-title">
        <span>${escapeHtml(record.title)}</span>
        <span>${escapeHtml(date)}</span>
      </div>
      <div class="history-meta">${escapeHtml(record.meta.position || "岗位未填")} · ${escapeHtml(record.meta.candidate || "候选人未填")}</div>
      <div class="history-actions">
        <button type="button" data-action="load">回填</button>
        <button type="button" data-action="delete">删除</button>
      </div>
    `;
    item.querySelector('[data-action="load"]').addEventListener("click", () => loadRecord(record.id));
    item.querySelector('[data-action="delete"]').addEventListener("click", () => deleteRecord(record.id));
    dom.historyList.appendChild(item);
  }
}

function loadRecord(id) {
  const record = getHistory().find((item) => item.id === id);
  if (!record) return;
  setCaseMeta(record.meta);
  dom.chatInput.value = record.chatText;
  renderAnalysis(record.analysis);
  switchTab("text");
  setStatus("历史记录已回填", true);
}

function deleteRecord(id) {
  setHistory(getHistory().filter((item) => item.id !== id));
  renderHistory();
  setStatus("历史记录已删除", true);
}

function clearHistory() {
  setHistory([]);
  renderHistory();
  setStatus("历史记录已清空", true);
}

function renderList(target, items, mode) {
  target.innerHTML = "";
  if (!items.length) {
    target.appendChild(emptyItem("暂无内容", mode));
    return;
  }
  for (const item of items) {
    const node = document.createElement("article");
    node.className = `evidence-item ${mode === "confirmed" ? "" : mode}`;
    const title = mode === "confirmed" ? item.content : item.reason || item.message;
    const tag = mode === "confirmed" ? `${item.type} · ${item.risk_level}` : item.type;
    const source = mode === "confirmed" ? item.evidence : item.evidence || item.suggested_question;
    node.innerHTML = `
      <div class="item-topline">
        <span>${escapeHtml(title)}</span>
        <span class="item-tag">${escapeHtml(tag)}</span>
      </div>
      <div class="item-source">${escapeHtml(source || "")}</div>
    `;
    target.appendChild(node);
  }
}

function renderQuestions(items) {
  dom.questionList.innerHTML = "";
  if (!items.length) {
    dom.questionList.appendChild(emptyItem("暂无追问建议", ""));
    return;
  }
  items.forEach((item, index) => {
    const node = document.createElement("article");
    node.className = "evidence-item";
    node.innerHTML = `
      <div class="item-topline">
        <span>${index + 1}. ${escapeHtml(item.suggested_question)}</span>
        <span class="item-tag">${escapeHtml(item.type)}</span>
      </div>
    `;
    dom.questionList.appendChild(node);
  });
}

function emptyItem(text, mode) {
  const node = document.createElement("article");
  node.className = `evidence-item ${mode}`;
  node.textContent = text;
  return node;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function switchTab(tab) {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });
  document.querySelectorAll(".tab-view").forEach((view) => {
    view.classList.toggle("active", view.id === `${tab}-view`);
  });
}

function setStatus(text, ready) {
  dom.statusText.textContent = text;
  dom.statusDot.classList.toggle("ready", ready);
}

async function copyText(text, doneText) {
  await navigator.clipboard.writeText(text);
  setStatus(doneText, true);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function checkApiStatus() {
  try {
    const response = await fetch("/api/status");
    const status = await response.json();
    if (!getStoredConfig().apiKey && status.configured) {
      dom.apiStatus.textContent = `服务端已配置：${status.provider} / ${status.model}`;
      dom.aiMode.checked = true;
      return;
    }
  } catch {
    // 静态打开时忽略
  }
  refreshApiStatusLabel();
}

document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

dom.providerSelect.addEventListener("change", () => {
  applyProviderDefaults();
  refreshApiStatusLabel();
});
dom.apiKeyInput.addEventListener("input", refreshApiStatusLabel);
dom.baseUrlInput.addEventListener("input", refreshApiStatusLabel);
dom.modelInput.addEventListener("input", refreshApiStatusLabel);
dom.saveApiButton.addEventListener("click", saveConfig);
dom.testApiButton.addEventListener("click", testApiConnection);
dom.listModelsButton.addEventListener("click", listModels);
dom.useServerConfigButton.addEventListener("click", useServerConfig);

dom.sampleOne.addEventListener("click", () => {
  dom.chatInput.value = samples[0];
  runAnalysis();
});
dom.sampleTwo.addEventListener("click", () => {
  dom.chatInput.value = samples[1];
  runAnalysis();
});
dom.analyzeButton.addEventListener("click", runAnalysis);
dom.saveRecordButton.addEventListener("click", saveCurrentRecord);
dom.generateRightsButton.addEventListener("click", generateRightsMaterial);
dom.copyRightsButton.addEventListener("click", () => copyText(dom.rightsOutput.textContent, "维权材料已复制"));
dom.exportRightsButton.addEventListener("click", exportRightsMaterial);
dom.exportCasePackageButton.addEventListener("click", exportCasePackage);
dom.chatInput.addEventListener("input", () => setStatus("聊天记录已修改，可重新分析", false));
dom.actualSituation.addEventListener("input", () => {
  renderRightsToolkit(lastAnalysisData, dom.actualSituation.value.trim());
  setStatus("入职后实际情况已更新，差异焦点已重新比对", false);
});
dom.copyReport.addEventListener("click", () => copyText(dom.reportOutput.textContent, "确认单已复制"));
dom.copyHrScript.addEventListener("click", () => copyText(dom.hrScriptOutput.textContent, "HR 确认话术已复制"));
dom.exportJson.addEventListener("click", exportAnalysisJson);
dom.exportMd.addEventListener("click", exportAnalysisMarkdown);
dom.copyPrompt.addEventListener("click", () => copyText(dom.promptOutput.value, "提示词已复制"));
dom.printReport.addEventListener("click", () => window.print());
dom.useOcrDemo.addEventListener("click", runImageOcr);
dom.modelFilter.addEventListener("input", () => renderModelList(currentModels));
dom.clearHistoryButton.addEventListener("click", clearHistory);

dom.imageInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  selectedImageDataUrl = await fileToDataUrl(file);
  dom.imagePreview.innerHTML = `<img src="${selectedImageDataUrl}" alt="聊天截图预览" />`;
  setStatus("截图已选择，可开始 OCR 识别", false);
});

applyConfigToForm(getStoredConfig());
dom.promptOutput.value = promptTemplate;
dom.chatInput.value = samples[0];
dom.aiMode.checked = Boolean(getStoredConfig().apiKey);
renderAnalysis(analyzeChatLocally(samples[0]));
renderHistory();
checkApiStatus();
