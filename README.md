# 职聊凭证 AI

招聘沟通承诺提取与确认系统原型。

## 运行

```powershell
D:\code\recruit-chat-evidence-ai\start.cmd
```

打开：

```text
http://localhost:5177
```

## 前端 API 接入

进入页面左侧的 `API` 标签页，可以选择：

1. OpenAI Responses  
   默认 Base URL：`https://api.openai.com/v1`  
   默认模型：`gpt-4.1-mini`

2. DeepSeek  
   默认 Base URL：`https://api.deepseek.com/v1`  
   默认模型：`deepseek-chat`

3. New API  
   用于 OpenAI 兼容网关。填写你的 Base URL、API Key 和模型名。

填写后点击 `检测接入`，成功后配置会保存到浏览器本地。之后打开 `使用真实大模型`，文本分析会使用当前配置。

点击 `检测模型` 可以读取当前 API Key 可访问的模型列表，列表里的模型可以一键填入模型输入框。

## OCR

截图 OCR 支持：

1. OpenAI Responses
2. 支持视觉模型的 New API

DeepSeek 文本模型不处理截图 OCR，页面会提示切换到支持视觉的接口。

## 导出

分析完成后可以：

1. 复制确认单
2. 导出 JSON
3. 导出 Markdown
4. 打印确认单

## 新增凭证管理能力

1. 可填写候选人、公司、岗位、沟通对象
2. 结果区显示信息完整度
3. 可将分析结果保存到本地历史
4. 历史记录支持回填和删除
5. 导出的确认单会带上案件信息

## 新增分析视图

1. 风险雷达：按薪资、社保、工时、试岗、报销归类风险
2. 证据时间线：按提取顺序展示关键证据原文
3. HR 确认话术：自动生成可直接发送给招聘方的确认消息

## 入职后维权求助

`维权` 标签页用于入职后发现实际情况与 HR 招聘沟通不一致的场景。

1. 填写入职后实际情况
2. 基于前面提取的招聘承诺生成不一致点
3. 生成证据清单
4. 生成可用于咨询劳动监察、法律援助或律师的材料
5. 支持复制和导出 Markdown
6. 开启真实大模型后，维权材料会通过 `/api/rights` 结合聊天原文、承诺提取结果和入职后情况生成；未开启时使用本地模板兜底
7. 右侧提供差异焦点、证据补齐、咨询问题、行动路线四个辅助模块
8. 支持导出完整证据包，包含聊天原文、确认单、维权材料和辅助模块结果

## 比赛演示

演示话术见：

```text
DEMO_SCRIPT.md
```

## 后端接口

```text
GET  /api/status
POST /api/test-connection
POST /api/models
POST /api/analyze
POST /api/rights
POST /api/ocr
```

如果前端没有传 API 配置，后端会使用 `.env` 中的服务端配置。
