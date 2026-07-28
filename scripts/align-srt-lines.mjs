import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const subtitlePath = resolve(
  root,
  optionValue("--srt") ?? "private_content/audio/book-full.srt",
);
const manifestPath = resolve(
  root,
  optionValue("--manifest") ?? "private_content/audio/tracks/manifest.json",
);
const outputPath = resolve(
  root,
  optionValue("--output") ?? "private_content/audio/srt-line-timings.json",
);
const fallbackSubtitlePath = optionValue("--fallback-srt")
  ? resolve(root, optionValue("--fallback-srt"))
  : undefined;
const baseUrl = (
  process.argv.find((argument) => argument.startsWith("http")) ??
  "http://localhost:3000"
).replace(/\/$/u, "");
const shouldApply = process.argv.includes("--apply");

const [subtitleSource, manifestSource, fallbackSubtitleSource] =
  await Promise.all([
    readFile(subtitlePath, "utf8"),
    readFile(manifestPath, "utf8"),
    fallbackSubtitlePath
      ? readFile(fallbackSubtitlePath, "utf8")
      : Promise.resolve(undefined),
  ]);
const cues = parseSrt(subtitleSource);
const fallbackCues = fallbackSubtitleSource
  ? parseSrt(fallbackSubtitleSource)
  : undefined;
const manifest = JSON.parse(manifestSource);
const tracks = new Map(
  manifest.tracks.map((track) => [track.trackNumber, track]),
);
const lessonPayload = await getJson(`${baseUrl}/api/lessons`);
const lessons = [];
for (const summary of lessonPayload.data) {
  const payload = await getJson(`${baseUrl}/api/lessons/${summary.id}`);
  lessons.push(payload.data);
}

const alignments = [];
for (const [index, lesson] of lessons.entries()) {
  const track = tracks.get(lesson.trackNumber);
  if (!track) {
    throw new Error(`分轨清单中找不到 Track ${lesson.trackNumber}。`);
  }
  const lines = lesson.dialogues.flatMap((dialogue) => dialogue.lines);
  const trackCues = selectTrackCues(cues, track);
  if (!trackCues.length) {
    throw new Error(`Track ${lesson.trackNumber} 没有对应的 SRT 字幕。`);
  }

  const primaryAlignment = alignTrack({
    durationSeconds: track.durationSeconds,
    lesson,
    lines,
    trackCues,
  });
  const alignment = fallbackCues
    ? mergeAlignments(
        primaryAlignment,
        alignTrack({
          durationSeconds: track.durationSeconds,
          lesson,
          lines,
          trackCues: selectTrackCues(fallbackCues, track),
        }),
      )
    : primaryAlignment;
  alignments.push(alignment);
  console.log(
    `[${index + 1}/${lessons.length}] ${lesson.trackNumber}: ` +
      `${lines.length} 句 · 匹配 ${(alignment.matchRate * 100).toFixed(1)}% · ` +
      `最低句 ${(alignment.minimumLineMatchRate * 100).toFixed(1)}% · ` +
      `${trackCues.length} 条字幕` +
      (alignment.fallbackUsedLines
        ? ` · ${alignment.fallbackUsedLines} 句沿用旧时间`
        : ""),
  );
}

const diagnostics = [];
for (const alignment of alignments) {
  if (alignment.matchRate >= 0.5) {
    continue;
  }
  const lessonIndex = lessons.findIndex(
    (lesson) => lesson.id === alignment.lessonId,
  );
  const lesson = lessons[lessonIndex];
  const disk = lesson.trackNumber.split("-")[0];
  const nearby = [];
  for (
    let candidateIndex = Math.max(0, lessonIndex - 3);
    candidateIndex <= Math.min(lessons.length - 1, lessonIndex + 3);
    candidateIndex += 1
  ) {
    const candidateLesson = lessons[candidateIndex];
    if (!candidateLesson.trackNumber.startsWith(`${disk}-`)) {
      continue;
    }
    const candidateTrack = tracks.get(candidateLesson.trackNumber);
    const candidateCues = cues
      .filter(
        (cue) =>
          cue.endSeconds > candidateTrack.startSeconds &&
          cue.startSeconds < candidateTrack.endSeconds,
      )
      .map((cue) => ({
        ...cue,
        startSeconds:
          Math.max(cue.startSeconds, candidateTrack.startSeconds) -
          candidateTrack.startSeconds,
        endSeconds:
          Math.min(cue.endSeconds, candidateTrack.endSeconds) -
          candidateTrack.startSeconds,
      }))
      .filter((cue) => cue.endSeconds > cue.startSeconds);
    nearby.push({
      intervalTrack: candidateLesson.trackNumber,
      matchRate: textMatchRate(
        lesson.dialogues.flatMap((dialogue) => dialogue.lines),
        candidateCues,
      ),
    });
  }
  nearby.sort((left, right) => right.matchRate - left.matchRate);
  diagnostics.push({
    lessonTrack: lesson.trackNumber,
    currentMatchRate: alignment.matchRate,
    nearby,
  });
  console.log(
    `  诊断 ${lesson.trackNumber}: ` +
      nearby
        .slice(0, 3)
        .map(
          (candidate) =>
            `${candidate.intervalTrack}=${(candidate.matchRate * 100).toFixed(1)}%`,
        )
        .join(" · "),
  );
}

const report = {
  sourceSrt: subtitlePath,
  fallbackSrt: fallbackSubtitlePath,
  sourceManifest: manifestPath,
  createdAt: new Date().toISOString(),
  cueCount: cues.length,
  strategy: {
    text: "NFKC、片假名转平假名、去除空白与标点",
    alignment: "教材全文与 SRT 字符流的加权全局顺序对齐",
    timing: "按字幕片段内部字符位置插值，并以相邻教材句中点分界",
    fallback: fallbackSubtitlePath
      ? "新字幕低置信度且旧字幕明显更可靠时，沿用旧时间边界"
      : undefined,
  },
  summary: {
    lessons: alignments.length,
    lines: alignments.reduce(
      (total, alignment) => total + alignment.lines.length,
      0,
    ),
    averageMatchRate:
      alignments.reduce((total, alignment) => total + alignment.matchRate, 0) /
      alignments.length,
    lessonsBelow50Percent: alignments
      .filter((alignment) => alignment.matchRate < 0.5)
      .map((alignment) => alignment.trackNumber),
    lowConfidenceLines: alignments.reduce(
      (total, alignment) =>
        total + alignment.lines.filter((line) => line.matchRate < 0.3).length,
      0,
    ),
    fallbackUsedLines: alignments.reduce(
      (total, alignment) => total + (alignment.fallbackUsedLines ?? 0),
      0,
    ),
  },
  diagnostics,
  lessons: alignments,
};
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (shouldApply) {
  for (const [index, alignment] of alignments.entries()) {
    const response = await fetch(
      `${baseUrl}/api/lessons/${alignment.lessonId}/timings`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lines: alignment.lines.map(({ id, startMs, endMs }) => ({
            id,
            startMs,
            endMs,
          })),
        }),
      },
    );
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(
        `Track ${alignment.trackNumber}: ${
          payload.error?.message ?? response.status
        }`,
      );
    }
    console.log(
      `[保存 ${index + 1}/${alignments.length}] ${alignment.trackNumber}: ` +
        `${payload.data.updatedLines} 句`,
    );
  }
}

console.log(
  shouldApply
    ? `SRT 时间轴已写入 ${alignments.length} 个 Section。`
    : `匹配报告已保存到 ${outputPath}；检查后使用 --apply 写入数据库。`,
);

function selectTrackCues(sourceCues, track) {
  return sourceCues
    .filter(
      (cue) =>
        cue.endSeconds > track.startSeconds &&
        cue.startSeconds < track.endSeconds,
    )
    .map((cue) => ({
      ...cue,
      startSeconds:
        Math.max(cue.startSeconds, track.startSeconds) - track.startSeconds,
      endSeconds:
        Math.min(cue.endSeconds, track.endSeconds) - track.startSeconds,
    }))
    .filter((cue) => cue.endSeconds > cue.startSeconds);
}

function mergeAlignments(primary, fallback) {
  const fallbackLines = primary.lines.map((line, index) => {
    const fallbackLine = fallback.lines[index];
    return (
      line.matchRate < 0.45 && fallbackLine.matchRate > line.matchRate + 0.1
    );
  });
  const firstStart = fallbackLines[0]
    ? fallback.lines[0].startMs
    : primary.lines[0].startMs;
  const lastIndex = primary.lines.length - 1;
  const lastEnd = fallbackLines[lastIndex]
    ? fallback.lines[lastIndex].endMs
    : primary.lines[lastIndex].endMs;
  const boundaries = primary.lines.slice(0, -1).map((line, index) => {
    const current = fallbackLines[index] ? fallback.lines[index] : line;
    const next = fallbackLines[index + 1]
      ? fallback.lines[index + 1]
      : primary.lines[index + 1];
    return fallbackLines[index] === fallbackLines[index + 1]
      ? current.endMs
      : Math.round((current.endMs + next.startMs) / 2);
  });
  enforceIncreasingMillisecondBoundaries(boundaries, firstStart, lastEnd);

  return {
    ...primary,
    fallbackUsedLines: fallbackLines.filter(Boolean).length,
    lines: primary.lines.map((line, index) => ({
      ...line,
      startMs: index === 0 ? firstStart : boundaries[index - 1],
      endMs: index === lastIndex ? lastEnd : boundaries[index],
      fallbackMatchRate: fallback.lines[index].matchRate,
      timingSource: fallbackLines[index] ? "fallback" : "primary",
    })),
  };
}

function enforceIncreasingMillisecondBoundaries(boundaries, start, end) {
  const minimumGap = Math.min(
    250,
    (end - start) / Math.max(1, boundaries.length + 1),
  );
  for (let index = 0; index < boundaries.length; index += 1) {
    const minimum =
      index === 0 ? start + minimumGap : boundaries[index - 1] + minimumGap;
    boundaries[index] = Math.max(minimum, boundaries[index]);
  }
  for (let index = boundaries.length - 1; index >= 0; index -= 1) {
    const maximum =
      index === boundaries.length - 1
        ? end - minimumGap
        : boundaries[index + 1] - minimumGap;
    boundaries[index] = Math.min(maximum, boundaries[index]);
  }
}

function alignTrack({ durationSeconds, lesson, lines, trackCues }) {
  const subtitleCharacters = buildSubtitleCharacters(trackCues);
  const { characters: bookCharacters, lineRanges } = buildBookCharacters(lines);
  if (!subtitleCharacters.length || !bookCharacters.length) {
    throw new Error(`Track ${lesson.trackNumber} 缺少可对齐字符。`);
  }

  const alignment = alignCharacters(
    bookCharacters.map((item) => item.character),
    subtitleCharacters.map((item) => item.character),
  );
  const rawRanges = lineRanges.map((range) => {
    const mapped = alignment.mapping
      .slice(range.start, range.end)
      .filter((index) => index >= 0);
    const first = mapped[0];
    const last = mapped.at(-1);
    const exactMatches = alignment.exactMatches
      .slice(range.start, range.end)
      .filter(Boolean).length;
    return {
      start:
        first === undefined
          ? undefined
          : subtitleCharacters[first].startSeconds,
      end: last === undefined ? undefined : subtitleCharacters[last].endSeconds,
      matchRate:
        range.end === range.start
          ? 0
          : exactMatches / (range.end - range.start),
    };
  });
  fillMissingRanges(rawRanges, durationSeconds);

  const firstStart = Math.max(0, rawRanges[0].start - 0.08);
  const lastEnd = Math.min(durationSeconds, rawRanges.at(-1).end + 0.12);
  const boundaries = rawRanges.slice(0, -1).map((range, index) => {
    const next = rawRanges[index + 1];
    return clamp((range.end + next.start) / 2, firstStart, lastEnd);
  });
  enforceIncreasingBoundaries(boundaries, firstStart, lastEnd);

  const timings = lines.map((line, index) => {
    const start = index === 0 ? firstStart : boundaries[index - 1];
    const end = index === lines.length - 1 ? lastEnd : boundaries[index];
    return {
      id: line.id,
      order: index + 1,
      startMs: Math.round(start * 1_000),
      endMs: Math.round(Math.max(start + 0.05, end) * 1_000),
      matchRate: rawRanges[index].matchRate,
    };
  });

  return {
    lessonId: lesson.id,
    trackNumber: lesson.trackNumber,
    durationMs: Math.round(durationSeconds * 1_000),
    subtitleCueCount: trackCues.length,
    bookCharacterCount: bookCharacters.length,
    subtitleCharacterCount: subtitleCharacters.length,
    matchRate:
      alignment.exactMatches.filter(Boolean).length / bookCharacters.length,
    minimumLineMatchRate: Math.min(
      ...rawRanges.map((range) => range.matchRate),
    ),
    lines: timings,
  };
}

function buildSubtitleCharacters(cuesForTrack) {
  const characters = [];
  for (const cue of cuesForTrack) {
    const normalized = normalizedCharacters(cue.text);
    if (!normalized.length) {
      continue;
    }
    const duration = cue.endSeconds - cue.startSeconds;
    normalized.forEach((character, index) => {
      characters.push({
        character,
        startSeconds: cue.startSeconds + (duration * index) / normalized.length,
        endSeconds:
          cue.startSeconds + (duration * (index + 1)) / normalized.length,
      });
    });
  }
  return characters;
}

function buildBookCharacters(lines) {
  const characters = [];
  const lineRanges = [];
  for (const line of lines) {
    const start = characters.length;
    for (const character of normalizedCharacters(line.text)) {
      characters.push({ character, lineId: line.id });
    }
    lineRanges.push({ start, end: characters.length });
  }
  return { characters, lineRanges };
}

function textMatchRate(lines, cuesForTrack) {
  const subtitleCharacters = buildSubtitleCharacters(cuesForTrack);
  const { characters: bookCharacters } = buildBookCharacters(lines);
  if (!subtitleCharacters.length || !bookCharacters.length) {
    return 0;
  }
  const alignment = alignCharacters(
    bookCharacters.map((item) => item.character),
    subtitleCharacters.map((item) => item.character),
  );
  return alignment.exactMatches.filter(Boolean).length / bookCharacters.length;
}

function normalizedCharacters(text) {
  const characters = [];
  for (const sourceCharacter of Array.from(text.normalize("NFKC"))) {
    if (
      /[\s。、，．,.！？!?…‥・:：;；「」『』【】〔〕（）()[\]{}〈〉《》“”"'`~〜—–‐♪]/u.test(
        sourceCharacter,
      )
    ) {
      continue;
    }
    characters.push(toHiragana(sourceCharacter.toLowerCase()));
  }
  return characters;
}

function toHiragana(character) {
  const code = character.codePointAt(0);
  if (code >= 0x30a1 && code <= 0x30f6) {
    return String.fromCodePoint(code - 0x60);
  }
  return character;
}

function alignCharacters(book, subtitle) {
  const rows = book.length + 1;
  const columns = subtitle.length + 1;
  const directions = new Uint8Array(rows * columns);
  let previous = new Float32Array(columns);
  let current = new Float32Array(columns);
  for (let column = 1; column < columns; column += 1) {
    previous[column] = previous[column - 1] + 0.7;
    directions[column] = 3;
  }

  for (let row = 1; row < rows; row += 1) {
    current[0] = previous[0] + 1;
    directions[row * columns] = 2;
    for (let column = 1; column < columns; column += 1) {
      const exact = book[row - 1] === subtitle[column - 1];
      const diagonal = previous[column - 1] + (exact ? 0 : 1.05);
      const deletion = previous[column] + 1;
      const insertion = current[column - 1] + 0.7;
      let cost = diagonal;
      let direction = 1;
      if (insertion < cost - 0.0001) {
        cost = insertion;
        direction = 3;
      }
      if (deletion < cost - 0.0001) {
        cost = deletion;
        direction = 2;
      }
      current[column] = cost;
      directions[row * columns + column] = direction;
    }
    [previous, current] = [current, previous];
  }

  const mapping = Array(book.length).fill(-1);
  const exactMatches = Array(book.length).fill(false);
  let row = book.length;
  let column = subtitle.length;
  while (row > 0 || column > 0) {
    const direction = directions[row * columns + column];
    if (direction === 1 && row > 0 && column > 0) {
      mapping[row - 1] = column - 1;
      exactMatches[row - 1] = book[row - 1] === subtitle[column - 1];
      row -= 1;
      column -= 1;
    } else if (direction === 2 && row > 0) {
      row -= 1;
    } else if (column > 0) {
      column -= 1;
    } else {
      row -= 1;
    }
  }
  return { mapping, exactMatches };
}

function fillMissingRanges(ranges, durationSeconds) {
  for (let index = 0; index < ranges.length; index += 1) {
    if (ranges[index].start !== undefined && ranges[index].end !== undefined) {
      continue;
    }
    const previous = ranges
      .slice(0, index)
      .reverse()
      .find((range) => range.end !== undefined);
    const next = ranges
      .slice(index + 1)
      .find((range) => range.start !== undefined);
    const start = previous?.end ?? 0;
    const end = next?.start ?? durationSeconds;
    const missingAhead = ranges
      .slice(index)
      .findIndex(
        (range) => range.start !== undefined && range.end !== undefined,
      );
    const divisor = missingAhead < 0 ? ranges.length - index : missingAhead + 1;
    const share = (end - start) / Math.max(1, divisor);
    ranges[index].start = start;
    ranges[index].end = start + share;
  }
  for (const range of ranges) {
    range.start = clamp(range.start ?? 0, 0, durationSeconds);
    range.end = clamp(
      Math.max(range.start, range.end ?? range.start),
      0,
      durationSeconds,
    );
  }
}

function enforceIncreasingBoundaries(boundaries, start, end) {
  const minimumGap = Math.min(
    0.25,
    (end - start) / Math.max(1, boundaries.length + 1),
  );
  for (let index = 0; index < boundaries.length; index += 1) {
    const minimum =
      index === 0 ? start + minimumGap : boundaries[index - 1] + minimumGap;
    boundaries[index] = Math.max(minimum, boundaries[index]);
  }
  for (let index = boundaries.length - 1; index >= 0; index -= 1) {
    const maximum =
      index === boundaries.length - 1
        ? end - minimumGap
        : boundaries[index + 1] - minimumGap;
    boundaries[index] = Math.min(maximum, boundaries[index]);
  }
}

function parseSrt(source) {
  const blocks = source
    .replace(/\r/gu, "")
    .trim()
    .split(/\n{2,}/u);
  const parsed = [];
  for (const block of blocks) {
    const lines = block.split("\n");
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex < 0) {
      continue;
    }
    const match = lines[timingIndex].match(
      /^(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/u,
    );
    if (!match) {
      continue;
    }
    parsed.push({
      startSeconds: timestampToSeconds(match[1]),
      endSeconds: timestampToSeconds(match[2]),
      text: lines
        .slice(timingIndex + 1)
        .join("")
        .replace(/<[^>]+>/gu, ""),
    });
  }
  return parsed;
}

function timestampToSeconds(timestamp) {
  const [hours, minutes, seconds] = timestamp.replace(",", ".").split(":");
  return Number(hours) * 3_600 + Number(minutes) * 60 + Number(seconds);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(value, maximum));
}

async function getJson(url) {
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(`${url}: ${payload.error?.message ?? response.status}`);
  }
  return payload;
}

function optionValue(option) {
  const index = process.argv.indexOf(option);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
