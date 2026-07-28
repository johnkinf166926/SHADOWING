# 架构说明

## 目标

Shadowing Coach 日本語优先解决一个人的日常跟读闭环：选择课程、准确定位音频、听与说、保存证据、复盘表达。产品默认不依赖自动语音评分，也不把教材或录音发给第三方。

## 运行边界

```text
Browser
  ├─ App Router pages / client workspaces
  ├─ HTMLAudioElement + Web Audio + MediaRecorder
  └─ Service Worker (shell cache + opt-in audio cache)
          │
          ▼
Route Handlers
  ├─ Zod validation + structured API envelope
  ├─ D1: content, progress, attempts, metadata
  └─ R2: uploaded audio and recordings

Local content tools
  └─ Prisma → data/shadowing-coach.db
```

应用部署在 Cloudflare/Sites 时使用 D1 与 R2；`npm run dev` 由 Miniflare 提供相同绑定。Prisma/SQLite 是可离线执行、易备份、易测试的内容维护通道。两套 schema 字段对应，`prisma/migrations/` 和 `db/schema.ts` 都是受版本控制的定义。

## 模块

- `app/`：服务端页面、客户端入口与 HTTP API。
- `components/study/`：播放、录音、听写、角色扮演、表达复习状态机。
- `lib/audio.ts`：播放范围、当前台词和时间格式等纯函数。
- `lib/text.ts`：日文文本归一化与动态规划字符差异。
- `lib/media-recorder.ts`：录音 MIME 选择、解码与波形采样。
- `lib/content-*`：共享导入 schema、CSV 解析与跨记录校验。
- `lib/server/database.ts`：D1 首次启动建表、虚构种子与结构化日志。
- `prisma/`：SQLite 数据模型、迁移和本地 seed。

## 核心数据关系

- Unit 1—N Lesson
- Lesson 1—N Dialogue 1—N DialogueLine
- Lesson N—N Expression（经 LessonExpression）
- AudioAsset 可关联 Lesson；二进制只存在对象存储
- PracticeSession 可关联 Dialogue/Line，并拥有 Recording
- DictationAttempt 指向 Lesson/Line
- ReviewItem 指向 Expression
- DailyStudyLog 按日期聚合学习时长与完成数

外键删除策略在 schema 中显式声明：教材层级删除使用级联；被学习记录引用的实体使用限制或置空，避免误删学习历史。

## API 约定

成功：

```json
{ "ok": true, "data": {}, "message": "可选消息" }
```

失败：

```json
{
  "ok": false,
  "error": {
    "code": "MACHINE_CODE",
    "message": "中文可操作说明",
    "details": {}
  }
}
```

所有写入入口先做 Zod 校验。嵌套内容导入在 D1 batch 或 Prisma transaction 中完成，校验失败不做部分写入。服务器日志只记录事件名、错误类型和消息，不记录音频内容或密钥。

## 音频与录音

播放使用 `HTMLAudioElement`，因此原生支持暂停、seek、速率与音量。逐句播放用毫秒时间码限制播放窗口。录音使用浏览器 `MediaRecorder`，运行时按浏览器能力选择 WebM/Ogg/MP4 MIME；Web Audio 仅用于解码和绘制波形，不改变原始录音。

MVP 的“评分”是明确标注的自评与节奏提示。`SpeechEvaluationProvider` 是未来接入外部服务的服务端接口；当前实现不会伪造自动发音准确率。

## 离线策略

Service Worker 预缓存页面外壳和图标，对导航失败回退到 `/offline`。音频采用 cache-on-request：只有用户点击“离线保存此课程”才加入 `shadowing-audio-v1`。这既控制磁盘占用，也降低带版权教材被无意复制的风险。

## 安全与限制

- 私人文件、数据库、对象存储状态和 `.env` 均在 `.gitignore` 中。
- 上传同时检查扩展名、MIME 与 80 MB 大小限制；文件名会净化。
- 文件读取支持 Range 请求，满足长音频 seek。
- PWA 与麦克风要求 HTTPS（localhost 例外）。
- 本项目是单用户个人工具，没有多租户授权模型；若暴露到公网，应先配置 Sites 私有访问控制。
