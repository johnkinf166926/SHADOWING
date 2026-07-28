# 内容导入格式

管理端和 CLI 共用同一套 Zod 校验。推荐使用 UTF-8 JSON；CSV 更适合批量整理台词，但暂不承载表达卡片。

## JSON

顶层必须包含 `unit` 和至少一个 `lessons`。

```json
{
  "unit": {
    "number": 9,
    "title": "サンプル会話",
    "subtitle": "虚构示例课程",
    "description": "可选说明"
  },
  "lessons": [
    {
      "sectionNumber": 1,
      "level": "INTERMEDIATE",
      "title": "予定を確認する",
      "subtitle": "确认时间安排",
      "trackNumber": "SAMPLE-01",
      "pdfPage": 1,
      "dialogues": [
        {
          "number": 1,
          "lines": [
            {
              "order": 1,
              "speaker": "A",
              "text": "明日の予定を確認してもいいですか。",
              "reading": "あしたの よていを かくにんしても いいですか。",
              "translationZh": "可以确认一下明天的安排吗？",
              "translationEn": "May I confirm tomorrow's schedule?",
              "startMs": 0,
              "endMs": 3000,
              "note": "可选备注"
            }
          ]
        }
      ],
      "expressions": [
        {
          "expression": "〜てもいいですか",
          "reading": "〜ても いいですか",
          "explanationZh": "询问是否可以做某事。",
          "explanationJa": "許可を求めるときの表現。",
          "example": "ここに座ってもいいですか。",
          "tags": ["許可", "会話"]
        }
      ]
    }
  ]
}
```

### 字段约束

| 路径                      | 必需 | 规则                               |
| ------------------------- | ---- | ---------------------------------- |
| `unit.number`             | 是   | 大于 0 的整数，全库唯一            |
| `unit.title`              | 是   | 1–200 字符                         |
| `lessons[].sectionNumber` | 是   | 大于 0；同一 Section 可有多条音轨  |
| `lessons[].level`         | 是   | `INTERMEDIATE` 或 `ADVANCED`       |
| `lessons[].trackNumber`   | 是   | 非空，全库唯一                     |
| `dialogues[].number`      | 是   | 大于 0                             |
| `lines[].order`           | 是   | 大于 0，同一 Dialogue 内唯一       |
| `lines[].speaker`         | 是   | `A`、`B` 或 `NARRATOR`             |
| `lines[].text`            | 是   | 日文原文，最长 2000 字符           |
| `startMs` / `endMs`       | 否   | 必须成对出现，且 `endMs > startMs` |
| `expressions`             | 否   | 缺省为空数组                       |
| `tags`                    | 否   | 字符串数组，缺省为空数组           |

同一对话中的音频范围发生重叠会产生 warning，但不阻止导入；重复编号、非法范围和 schema 错误会阻止整个事务。

完整可机器读取的简版 JSON Schema 位于 `public/content-format.json`，可执行示例位于 `examples/sample-content.json`。

## CSV

必需列：

```text
unitNumber,unitTitle,sectionNumber,level,trackNumber,dialogueNumber,order,speaker,text
```

支持的可选列：

```text
unitSubtitle,lessonTitle,pdfPage,reading,translationZh,startMs,endMs
```

每行代表一句台词。相同 `trackNumber` 的行合并为一个 Lesson，相同 `dialogueNumber` 的行合并为一组对话。字段中含逗号、换行或双引号时使用标准双引号包裹，内部双引号写成 `""`。

```csv
unitNumber,unitTitle,sectionNumber,level,trackNumber,dialogueNumber,order,speaker,text,reading,startMs,endMs
9,サンプル会話,1,INTERMEDIATE,SAMPLE-01,1,1,A,明日の予定を確認してもいいですか。,あしたの よていを かくにんしても いいですか。,0,3000
9,サンプル会話,1,INTERMEDIATE,SAMPLE-01,1,2,B,はい、午前十時からです。,はい、ごぜん じゅうじからです。,3300,6200
```

CSV 当前不支持 `description`、英文翻译、台词备注和表达卡片；需要这些字段时请用 JSON。

## 命令

```powershell
npm run content:validate -- path/to/content.json
npm run content:import -- path/to/content.json
npm run content:export -- 9
```

`content:export` 将 JSON 写到 stdout，可由 shell 重定向到文件。导入前请先备份 `data/`，并确保 Unit 编号与音轨编号尚未存在。
