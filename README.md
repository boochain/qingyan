# 青砚

自托管的刷题室。题库、顺序 / 随机 / 背题、错题本、限时试卷、导入导出，以及同一套给 AI agent 用的操作协议。

数据放在浏览器里（`localStorage`）。服务器上的 `/api/qingyan` **不保存题目**，只对你提交的题库文档执行操作并返回新文档，这样公网部署也不会把题库留在机器上。

## 本地运行

```bash
npm install
npm run dev
```

## Agent

`GET /api/qingyan` 返回协议。

```bash
curl -s -X POST https://你的域名/api/qingyan \
  -H 'content-type: application/json' \
  -d '{"library":{"version":1,"banks":[],"chapters":[],"questions":[],"attempts":[],"wrongs":[],"favorites":[],"notes":[],"papers":[],"exams":[],"resume":{},"dailyGoal":20},"ops":[{"op":"bank.create","name":"操作系统","subject":"计算机"}]}'
```

应用内「Agent」页可以把这句话交给模型起草，确认后再写入。整库 JSON、CSV、带「答案：」的文本都能导入。

协议全文在应用的 Agent 页，也可复制给外部 agent 当系统说明。
