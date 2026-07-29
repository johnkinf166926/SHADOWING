# Shadowing Coach 日本語

一个面向个人学习的 Local First 日语跟读训练程序。它把教材内容、音频逐句定位、跟读录音、听写纠错、角色扮演与表达复习放在同一条学习路径里。

> 仓库已经包含可直接学习的最终课程数据、逐句时间坐标和 62 条成品音轨。原始教材 PDF、OCR 中间文件、个人学习记录、录音和本地数据库仍保存在 `private_content/`、`uploads/`、`data/`、`.wrangler/` 等 Git 忽略目录中。

## 功能

- Unit / Lesson 学习目录与今日目标仪表盘
- 音频播放、拖动、音量、0.5×–1.5× 变速、单句/对话循环、A/B 台词筛选
- 原文、读音、中文翻译独立显示开关与键盘快捷键
- MediaRecorder 录音、原音/录音回放、波形对比、1–5 分自评与学习记录
- 听写 NFKC 归一化、可选忽略标点、字符级差异与正确率
- A/B/随机角色扮演，倒计时、自动播放与自动录音
- 表达搜索、收藏、掌握度筛选和简单间隔复习
- 管理端内容录入、JSON/CSV 校验预览、事务导入、音频上传
- PWA 应用外壳离线可用；教材音频只在用户主动选择后缓存
- Prisma + SQLite 本地内容工具；D1 + R2 部署持久化边界

## 技术栈

- Next.js App Router、React、TypeScript strict、vinext
- Tailwind CSS 4 与语义化 CSS 组件样式
- Prisma 6 + SQLite（本地脚本、迁移、测试）
- Drizzle schema + Cloudflare D1/R2（应用运行时与 Sites）
- Zod、React Hook Form
- Web Audio API、MediaRecorder、Service Worker
- Vitest、Testing Library、Playwright

## 本地启动

要求 Node.js 22.13 或更高版本。

```powershell
Copy-Item .env.example .env
npm ci
npm run db:generate
npm run dev
```

打开 `http://localhost:3000`。全新 clone 第一次访问时，应用会自动把仓库内的 8 个 Unit、最终台词与逐句时间坐标写入空的本地 D1；62 条音轨直接从仓库静态资源播放，不需要再执行导入或上传命令。

应用运行时的个人进度与录音仍由 Miniflare 保存在 `.wrangler/`，Prisma CLI 使用 `data/shadowing-coach.db`；这些个人状态不会提交到 Git。第一次点击录音时允许麦克风权限即可使用跟读和角色练习。

## 内置课程

仓库中的可分发课程包包含：

- 8 个 Unit、62 条音轨课次
- 234 组对话/长文本、1,207 行日文
- 1,207 行最终毫秒级音频坐标、1,161 行中文译文

内置数据由当前本地 D1 的最终状态导出，因此包含后来在管理界面手工调整的台词与时间范围。空数据库才会自动安装内置课程；已有课程或个人进度不会被覆盖。

原始扫描版教材仍位于本机 `private_content/book.pdf`，不会进入 Git。如需从原 PDF 重新生成并导入到正在运行的本地应用：

```powershell
npm run book:render -- private_content/book.pdf private_content/ocr/high-all "2-9,12-20,23-31,33-38,40-49,52-58,60-64,66-73" 3
npm run book:crop -- private_content/ocr/high-all private_content/ocr/crops-japanese-all japanese
npm run book:crop -- private_content/ocr/high-all private_content/ocr/crops-chinese-all chinese
npm run book:ocr:windows -- -SourceDirectory private_content/ocr/crops-japanese-all -OutputDirectory private_content/ocr/windows-japanese-all -LanguageTag ja
npm run book:ocr:windows -- -SourceDirectory private_content/ocr/crops-chinese-all -OutputDirectory private_content/ocr/windows-chinese-all -LanguageTag zh-Hans-CN
npm run book:build-content
npm run book:validate-content
npm run book:import-local
```

`book:ocr:windows` 需要 Windows 10/11 的日语和简体中文 OCR 语言包。生成文件位于 `private_content/`，不会进入 Git。

## 内容与音频

先验证，再导入：

```powershell
npm run content:validate -- examples/sample-content.json
npm run content:import -- examples/sample-content.json
npm run content:export -- 9
```

管理端位于 `/admin`，支持 JSON/CSV 干运行预览。正式导入在一个事务内完成；结构错误、重复音轨或重复台词顺序会阻止写入。同一 Section 可以包含多条音轨课次。完整字段和 CSV 列说明见 [CONTENT_FORMAT.md](./CONTENT_FORMAT.md)。

内置课程音轨位于 `public/audio/track-*.m4a`。另外通过管理端上传的音频支持 MP3、WAV、M4A、AAC、OGG、WebM、FLAC，单文件上限 80 MB；上传后的二进制放在 R2/本地 R2 模拟器，数据库只保存元数据和引用。OCR 管线读取 `private_content/` 中的教材 PDF，但应用不会提供 PDF 下载地址或公开原文件。

## 常用命令

```text
npm run dev                 本地开发
npm run build               生产构建
npm run start               启动生产构建
npm run typecheck           TypeScript 严格检查
npm run lint                ESLint
npm test                    Vitest 单元与集成测试
npm run test:e2e            Playwright 桌面与移动端流程
npm run db:generate         生成 Prisma Client
npm run db:migrate          应用已提交的 SQLite 迁移
npm run db:migrate:dev      开发时创建新迁移
npm run db:seed             写入虚构示例
npm run db:d1:generate      从 Drizzle schema 生成 D1 迁移
npm run content:validate    校验 JSON/CSV
npm run content:import      导入到本地 SQLite
npm run content:export      按 Unit 编号导出 JSON 到 stdout
npm run book:build-content  把本机 OCR 整理为私有 Unit 导入文件
npm run book:validate-content 校验整本教材的私有导入文件
npm run book:import-local   导入到正在运行的本地 D1
npm run course:export-bundle 从正在运行的本地 D1 刷新可分发课程包
npm run smoke:local         检查 8 个核心页面与教材 API
npm run sample-audio        重新生成虚构 WAV
npm run icons               重新生成 PWA PNG 图标
```

## Docker

```powershell
docker compose up --build
```

服务默认暴露在 `http://localhost:3000`。Compose 会为 `.wrangler`、`data` 与 `uploads` 建立持久卷，并把宿主机 `private_content/` 只读挂载到容器。不要把带版权的教材打进镜像。

## PWA、权限与隐私

- PWA 安装和录音在生产环境需要 HTTPS；`localhost` 是浏览器允许的安全上下文例外。
- 第一次录音会请求麦克风权限；拒绝后仍可使用播放、听写和表达复习。
- Service Worker 默认只预缓存应用外壳，不预缓存教材音频。
- 录音与学习记录可单独删除；更完整的边界说明见 [PRIVACY.md](./PRIVACY.md)。

## 测试

```powershell
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

集成测试会在系统临时目录创建独立 SQLite 数据库，应用迁移并覆盖 Unit、Lesson、音频元数据、练习记录与听写记录，不会触碰个人数据库。

## 项目结构

```text
app/                 页面与 Route Handlers
components/          应用框架、管理端与练习组件
lib/                 校验、音频、文本差异、复习与运行时服务
prisma/              本地 SQLite schema、迁移与种子
db/                  D1/Drizzle schema
drizzle/             生成的 D1 迁移
scripts/             内容导入导出与资源生成
tests/               Vitest 单元/集成测试
e2e/                 Playwright 关键路径
private_content/     私人教材，仅本地，Git 忽略
```

设计取舍和数据流详见 [ARCHITECTURE.md](./ARCHITECTURE.md)。
