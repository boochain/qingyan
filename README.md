# 青砚

自托管刷题室。题库、顺序 / 随机 / 背题、错题本、限时试卷，以及同一套给 AI agent 用的编辑协议。

数据在浏览器里。服务器上的 `/api/qingyan` **不保存题目**，只对你提交的文档执行操作并返回新文档。

界面按三种宽度工作：手机底栏、平板图标栏、电脑完整侧栏。晴空 / 夜空可以切换。

## 给 Agent

先读 **[AGENT.md](AGENT.md)**。那是写题、改题、组卷的合同：表格、操作、框架、以及为什么 POST 不会自动出现在用户浏览器里。

`GET /api/qingyan` 返回同一份协议和一条示例。

```bash
curl -s -X POST https://你的域名/api/qingyan \
  -H 'content-type: application/json' \
  -d '{"library":{"version":1,"banks":[],"chapters":[],"questions":[],"attempts":[],"wrongs":[],"favorites":[],"notes":[],"papers":[],"exams":[],"resume":{},"dailyGoal":20,"flags":[]},"ops":[{"op":"bank.create","name":"操作系统","subject":"计算机"}]}'
```

应用里的「Agent」页可以让模型起草操作，确认后再写入。Excel、Word、Markdown、CSV、整库 JSON 都能导入。Excel 要有名为「题目」的工作表。

## 本地运行

浏览器开发：

```bash
npm install
npm run dev
```

### Windows、Linux 上的桌面版

发行页里的压缩包解开就能运行，不需要先装 Node。Windows 包没有签名，系统第一次打开可能会多问一次。程序只在本机起一个窗口，题库仍写在这台电脑里，不上传。

自己打包：

```bash
npm run build:desktop
cd desktop && npm install && npx electron-builder --win zip --linux tar.gz
```

### Android、iPad、手机

用系统浏览器打开青砚，选「安装应用」或「添加到主屏幕」。装上之后从图标进，题目留在这台设备上。这里没有单独的 APK：没有 Android 构建环境时不会假装做出安装包。

## 许可

代码采用 [MIT](LICENSE)。

音效、图标、底图不是 MIT，见 [public/cc/CREDITS.txt](public/cc/CREDITS.txt)：

- 音效：Kenney Interface Sounds，CC0
- 图标：game-icons.net，CC BY 3.0（Lorc、Delapouite、sbed、Carl Olsen）
- 地球底图：NASA Blue Marble，公有领域（题库不再把地图当题目，文件仍在）
