const baseUrl = (process.argv[2] ?? "http://localhost:3000").replace(
  /\/$/u,
  "",
);
const unitPayload = await getJson(`${baseUrl}/api/units`);
const lessonPayload = await getJson(`${baseUrl}/api/lessons`);
const unit = unitPayload.data.find((candidate) => candidate.number === 1);
const lesson = lessonPayload.data.find(
  (candidate) => candidate.trackNumber === "1-02",
);
if (!unit || !lesson) {
  throw new Error("本地数据库中缺少 Unit 1 或 Track 1-02。");
}

const paths = [
  "/",
  "/units",
  `/units/${unit.id}`,
  `/lessons/${lesson.id}`,
  `/practice/${lesson.id}`,
  `/shadowing/${lesson.id}`,
  `/dictation/${lesson.id}`,
  `/roleplay/${lesson.id}`,
];
const results = [];
for (const path of paths) {
  const response = await fetch(`${baseUrl}${path}`);
  const html = await response.text();
  results.push({
    path,
    status: response.status,
    bytes: html.length,
    hasUnitContent: html.includes("家族・夫婦・恋人との会話"),
    hasLessonContent: html.includes("Section 1 · Track 1-02"),
  });
}
const lessonDetail = await getJson(`${baseUrl}/api/lessons/${lesson.id}`);
const firstDialogueId = lessonDetail.data.dialogues[0]?.id;
const secondDialogueId = lessonDetail.data.dialogues[1]?.id;
const calibrationLine = lessonDetail.data.dialogues[0]?.lines[0];
if (
  !firstDialogueId ||
  !secondDialogueId ||
  !calibrationLine ||
  !Number.isInteger(calibrationLine.startMs) ||
  !Number.isInteger(calibrationLine.endMs)
) {
  throw new Error("Track 1-02 中缺少前两组对话。");
}
const calibrationResponse = await fetch(
  `${baseUrl}/api/lines/${calibrationLine.id}`,
  {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      startMs: calibrationLine.startMs,
      endMs: calibrationLine.endMs,
    }),
  },
);
const calibrationPayload = await calibrationResponse.json();
const timingCalibration = {
  status: calibrationResponse.status,
  updatedLines: calibrationPayload.data?.updatedLines?.length ?? 0,
};
const translationResponse = await fetch(
  `${baseUrl}/api/lines/${calibrationLine.id}`,
  {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      text: calibrationLine.text,
      translationZh: calibrationLine.translationZh ?? "",
    }),
  },
);
const translationPayload = await translationResponse.json();
const translationEditing = {
  status: translationResponse.status,
  textMatches: translationPayload.data?.text === calibrationLine.text,
  translationMatches:
    translationPayload.data?.translationZh ===
    (calibrationLine.translationZh ?? ""),
};
const firstTrackResponse = await fetch(`${baseUrl}/tracks/${firstDialogueId}`);
const firstTrackHtml = await firstTrackResponse.text();
const trackNavigation = {
  firstTrackHasDisabledPrevious: firstTrackHtml.includes("已到开头"),
  hasTranslationEditor: firstTrackHtml.includes("修改这句日文原文和中文翻译"),
  hasTrackDropdown:
    firstTrackHtml.includes('aria-label="Section 1 切换 Track"') &&
    firstTrackHtml.includes(`<option value="${secondDialogueId}"`),
  firstTrackLinksToSecond: firstTrackHtml.includes(
    `/tracks/${secondDialogueId}`,
  ),
};
const firstPracticeResponse = await fetch(
  `${baseUrl}/practice/${lesson.id}?dialogue=${firstDialogueId}`,
);
const firstPracticeHtml = await firstPracticeResponse.text();
const practiceTrackNavigation = {
  removedOfflineCard:
    !firstPracticeHtml.includes("离线学习") &&
    !firstPracticeHtml.includes("音频不会自动缓存"),
  hasCalibrationPanel: firstPracticeHtml.includes("校准当前句"),
  hasTrackDropdown:
    firstPracticeHtml.includes('aria-label="Section 1 切换 Track"') &&
    firstPracticeHtml.includes(`<option value="${secondDialogueId}"`),
  linksToSecond: firstPracticeHtml.includes(
    `/practice/${lesson.id}?dialogue=${secondDialogueId}`,
  ),
};
const shadowingResponse = await fetch(
  `${baseUrl}/shadowing/${lesson.id}?dialogue=${firstDialogueId}`,
);
const shadowingHtml = await shadowingResponse.text();
const shadowingModes = {
  status: shadowingResponse.status,
  hasTrackDropdown:
    shadowingHtml.includes('aria-label="Section 1 切换 Track"') &&
    shadowingHtml.includes(`<option value="${secondDialogueId}"`),
  hasThreeWorkingModes:
    shadowingHtml.includes("逐句跟读") &&
    shadowingHtml.includes("只练 A") &&
    shadowingHtml.includes("只练 B"),
  removedMisleadingModes:
    !shadowingHtml.includes("延迟跟读") &&
    !shadowingHtml.includes("整段练习") &&
    !shadowingHtml.includes("全部跟读"),
};
for (const path of [
  `/tracks/${firstDialogueId}`,
  `/practice/${lesson.id}?dialogue=${firstDialogueId}`,
  `/shadowing/${lesson.id}?dialogue=${firstDialogueId}`,
  `/dictation/${lesson.id}?dialogue=${firstDialogueId}`,
  `/roleplay/${lesson.id}?dialogue=${firstDialogueId}`,
]) {
  const response = await fetch(`${baseUrl}${path}`);
  const html = await response.text();
  results.push({
    path,
    status: response.status,
    bytes: html.length,
    hasUnitContent: html.includes("家族・夫婦・恋人との会話"),
    hasLessonContent:
      html.includes("Track 1") &&
      html.includes("早くかたづけなさい。") &&
      !html.includes("雨降ってきそうだよ。傘持ってったら？"),
  });
}
const lessonDetails = [];
for (const candidate of lessonPayload.data) {
  const payload = await getJson(`${baseUrl}/api/lessons/${candidate.id}`);
  lessonDetails.push(payload.data);
}
const unitNumberById = new Map(
  unitPayload.data.map((candidate) => [candidate.id, candidate.number]),
);
const orderedCourseTracks = [...lessonDetails]
  .sort((left, right) => {
    const unitDifference =
      (unitNumberById.get(left.unitId) ?? 0) -
      (unitNumberById.get(right.unitId) ?? 0);
    if (unitDifference !== 0) {
      return unitDifference;
    }
    if (left.sectionNumber !== right.sectionNumber) {
      return left.sectionNumber - right.sectionNumber;
    }
    const pageDifference =
      (left.pdfPage ?? Number.MAX_SAFE_INTEGER) -
      (right.pdfPage ?? Number.MAX_SAFE_INTEGER);
    return pageDifference !== 0
      ? pageDifference
      : left.trackNumber.localeCompare(right.trackNumber, undefined, {
          numeric: true,
        });
  })
  .flatMap((candidate) =>
    candidate.dialogues.map((dialogue) => ({
      id: dialogue.id,
      lessonId: candidate.id,
      unitId: candidate.unitId,
      sectionNumber: candidate.sectionNumber,
      lines: dialogue.lines,
    })),
  );
const correctedTrack = orderedCourseTracks.filter(
  (candidate) => candidate.unitId === unit.id && candidate.sectionNumber === 2,
)[9];
const correctedCurrentLine = correctedTrack?.lines.at(-2);
const correctedNextLine = correctedTrack?.lines.at(-1);
const splitSpeakerCorrection = {
  lineCount: correctedTrack?.lines.length ?? 0,
  currentSpeaker: correctedCurrentLine?.speaker,
  nextSpeaker: correctedNextLine?.speaker,
  currentTextPresent: Boolean(correctedCurrentLine?.text.trim()),
  nextTextPresent: Boolean(correctedNextLine?.text.trim()),
  timingIsContinuous:
    correctedCurrentLine?.endMs === correctedNextLine?.startMs,
};
const unitOneSectionTwoTracks = orderedCourseTracks.filter(
  (candidate) => candidate.unitId === unit.id && candidate.sectionNumber === 2,
);
const correctedTrack19 = unitOneSectionTwoTracks[18];
const correctedTrack20 = unitOneSectionTwoTracks[19];
const correctedTrack21 = unitOneSectionTwoTracks[20];
const correctedTrack22 = unitOneSectionTwoTracks[21];
const correctedTrack23 = unitOneSectionTwoTracks[22];
const correctedTrack24 = unitOneSectionTwoTracks[23];
const trackBoundaryCorrection = {
  track19LineCount: correctedTrack19?.lines.length ?? 0,
  track19LastText: correctedTrack19?.lines.at(-1)?.text,
  track20LineCount: correctedTrack20?.lines.length ?? 0,
  track20FirstText: correctedTrack20?.lines[0]?.text,
  track20LastText: correctedTrack20?.lines.at(-1)?.text,
  track21LineCount: correctedTrack21?.lines.length ?? 0,
  track21FirstText: correctedTrack21?.lines[0]?.text,
  track21LastText: correctedTrack21?.lines.at(-1)?.text,
  track22LineCount: correctedTrack22?.lines.length ?? 0,
  track22FirstText: correctedTrack22?.lines[0]?.text,
  track22LastText: correctedTrack22?.lines.at(-1)?.text,
  track23LineCount: correctedTrack23?.lines.length ?? 0,
  track23FirstText: correctedTrack23?.lines[0]?.text,
  track23LastText: correctedTrack23?.lines.at(-1)?.text,
  track23StartMs: correctedTrack23?.lines[0]?.startMs,
  track23EndMs: correctedTrack23?.lines.at(-1)?.endMs,
  track24FirstText: correctedTrack24?.lines[0]?.text,
  timingIsContinuous:
    correctedTrack19?.lines.at(-1)?.endMs ===
      correctedTrack20?.lines[0]?.startMs &&
    correctedTrack20?.lines.at(-1)?.endMs ===
      correctedTrack21?.lines[0]?.startMs &&
    correctedTrack21?.lines.at(-1)?.endMs ===
      correctedTrack22?.lines[0]?.startMs &&
    correctedTrack23?.lines.at(-1)?.endMs ===
      correctedTrack24?.lines[0]?.startMs,
};
const correctedTrack19Response = await fetch(
  `${baseUrl}/tracks/${correctedTrack19.id}`,
);
const correctedTrack19Html = await correctedTrack19Response.text();
const correctedTrack20Response = await fetch(
  `${baseUrl}/tracks/${correctedTrack20.id}`,
);
const correctedTrack20Html = await correctedTrack20Response.text();
const correctedTrack21Response = await fetch(
  `${baseUrl}/tracks/${correctedTrack21.id}`,
);
const correctedTrack21Html = await correctedTrack21Response.text();
const correctedTrack22Response = await fetch(
  `${baseUrl}/tracks/${correctedTrack22.id}`,
);
const correctedTrack22Html = await correctedTrack22Response.text();
const correctedTrack23Response = await fetch(
  `${baseUrl}/tracks/${correctedTrack23.id}`,
);
const correctedTrack23Html = await correctedTrack23Response.text();
trackBoundaryCorrection.track19PageStatus = correctedTrack19Response.status;
trackBoundaryCorrection.track20PageStatus = correctedTrack20Response.status;
trackBoundaryCorrection.track21PageStatus = correctedTrack21Response.status;
trackBoundaryCorrection.track22PageStatus = correctedTrack22Response.status;
trackBoundaryCorrection.track23PageStatus = correctedTrack23Response.status;
trackBoundaryCorrection.track19LinksToTrack20 = correctedTrack19Html.includes(
  `/tracks/${correctedTrack20.id}`,
);
trackBoundaryCorrection.track20PageMatches =
  correctedTrack20Html.includes("Track 20") &&
  correctedTrack20Html.includes("おやっ何にする？") &&
  correctedTrack20Html.includes("夕飯少なめにしてもらわなきやね。");
trackBoundaryCorrection.track21LinksToTrack22 = correctedTrack21Html.includes(
  `/tracks/${correctedTrack22.id}`,
);
trackBoundaryCorrection.track22PageMatches =
  correctedTrack22Html.includes("Track 22") &&
  correctedTrack22Html.includes("ねー、これ食べてみて。") &&
  correctedTrack22Html.includes(
    "うそじゃないよ。それとも、僕が君の味にすっかり慣らされちゃったのかな。",
  );
trackBoundaryCorrection.track22LinksToTrack23 = correctedTrack22Html.includes(
  `/tracks/${correctedTrack23.id}`,
);
trackBoundaryCorrection.track23PageMatches =
  correctedTrack23Html.includes("Track 23") &&
  correctedTrack23Html.includes(
    "太郎が学校休んだんだって？どこか具合でも悪いのか？",
  ) &&
  correctedTrack23Html.includes(
    "あなたがカットしてあげたヘアスタイルよ。坊主頭はもう古いって…。太郎、怒ってるわよ～。",
  ) &&
  correctedTrack23Html.includes(
    "还不是你给他剪的头型嘛。人家说光头已经过时了。太郎还在生气呢。",
  );
trackBoundaryCorrection.track23LinksToTrack24 = correctedTrack23Html.includes(
  `/tracks/${correctedTrack24.id}`,
);
const protectedTrackSplitResponse = await fetch(
  `${baseUrl}/api/dialogues/${correctedTrack19.id}/split`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lineId: correctedTrack19.lines[0]?.id }),
  },
);
trackBoundaryCorrection.firstLineProtected =
  protectedTrackSplitResponse.status === 422;
const sectionBoundaryIndex = orderedCourseTracks.findIndex(
  (candidate, index) => {
    const following = orderedCourseTracks[index + 1];
    return (
      following &&
      (candidate.unitId !== following.unitId ||
        candidate.sectionNumber !== following.sectionNumber)
    );
  },
);
if (sectionBoundaryIndex < 0) {
  throw new Error("找不到可用于检查连续播放的 Section 边界。");
}
const boundaryTrack = orderedCourseTracks[sectionBoundaryIndex];
const followingTrack = orderedCourseTracks[sectionBoundaryIndex + 1];
const boundaryPracticeResponse = await fetch(
  `${baseUrl}/practice/${boundaryTrack.lessonId}?dialogue=${boundaryTrack.id}`,
);
const boundaryPracticeHtml = await boundaryPracticeResponse.text();
const continuousTrackNavigation = {
  status: boundaryPracticeResponse.status,
  crossesSection: boundaryPracticeHtml.includes(
    `/practice/${followingTrack.lessonId}?dialogue=${followingTrack.id}`,
  ),
};
const audioLessons = lessonDetails.filter(
  (candidate) => typeof candidate.audioUrl === "string",
);
const timedLines = lessonDetails.flatMap((candidate) =>
  candidate.dialogues.flatMap((dialogue) =>
    dialogue.lines.filter(
      (line) =>
        Number.isInteger(line.startMs) &&
        Number.isInteger(line.endMs) &&
        line.startMs >= 0 &&
        line.endMs > line.startMs,
    ),
  ),
);
const allLines = lessonDetails.flatMap((candidate) =>
  candidate.dialogues.flatMap((dialogue) => dialogue.lines),
);
const audioTracks = ["1-02", "1-18", "2-02", "2-31"];
const audioChecks = [];
for (const trackNumber of audioTracks) {
  const candidate = lessonDetails.find(
    (item) => item.trackNumber === trackNumber,
  );
  if (!candidate?.audioUrl) {
    throw new Error(`Track ${trackNumber} 没有关联音频。`);
  }
  const response = await fetch(`${baseUrl}${candidate.audioUrl}`, {
    headers: { Range: "bytes=0-1023" },
  });
  audioChecks.push({
    trackNumber,
    status: response.status,
    contentType: response.headers.get("content-type"),
    contentLength: response.headers.get("content-length"),
    contentRange: response.headers.get("content-range"),
  });
  await response.arrayBuffer();
}
const summary = {
  units: unitPayload.data.length,
  lessons: lessonPayload.data.length,
  lessonsWithAudio: audioLessons.length,
  timedLines: timedLines.length,
  timingCalibration,
  translationEditing,
  splitSpeakerCorrection,
  trackBoundaryCorrection,
  continuousTrackNavigation,
  trackNavigation,
  practiceTrackNavigation,
  shadowingModes,
  dialogues: lessonDetail.data.dialogues.length,
  lines: lessonDetail.data.dialogues.reduce(
    (total, dialogue) => total + dialogue.lines.length,
    0,
  ),
  audioChecks,
  routes: results,
};
console.log(JSON.stringify(summary, null, 2));
if (
  results.some((result) => result.status !== 200) ||
  results
    .filter(
      (result) =>
        result.path.startsWith("/tracks/") ||
        result.path.includes("?dialogue="),
    )
    .some((result) => !result.hasLessonContent) ||
  audioLessons.length !== lessonPayload.data.length ||
  timedLines.length !== allLines.length ||
  !trackNavigation.firstTrackHasDisabledPrevious ||
  !trackNavigation.hasTranslationEditor ||
  !trackNavigation.hasTrackDropdown ||
  !trackNavigation.firstTrackLinksToSecond ||
  !practiceTrackNavigation.removedOfflineCard ||
  !practiceTrackNavigation.hasCalibrationPanel ||
  !practiceTrackNavigation.hasTrackDropdown ||
  !practiceTrackNavigation.linksToSecond ||
  shadowingModes.status !== 200 ||
  !shadowingModes.hasTrackDropdown ||
  !shadowingModes.hasThreeWorkingModes ||
  !shadowingModes.removedMisleadingModes ||
  timingCalibration.status !== 200 ||
  timingCalibration.updatedLines !== 1 ||
  translationEditing.status !== 200 ||
  !translationEditing.textMatches ||
  !translationEditing.translationMatches ||
  splitSpeakerCorrection.lineCount !== 4 ||
  splitSpeakerCorrection.currentSpeaker !== "A" ||
  splitSpeakerCorrection.nextSpeaker !== "B" ||
  !splitSpeakerCorrection.currentTextPresent ||
  !splitSpeakerCorrection.nextTextPresent ||
  !splitSpeakerCorrection.timingIsContinuous ||
  trackBoundaryCorrection.track19LineCount !== 4 ||
  trackBoundaryCorrection.track19LastText !==
    "よその子ながら、将来が楽しみだね。" ||
  trackBoundaryCorrection.track20LineCount !== 6 ||
  trackBoundaryCorrection.track20FirstText !== "おやっ何にする？" ||
  trackBoundaryCorrection.track20LastText !==
    "夕飯少なめにしてもらわなきやね。" ||
  trackBoundaryCorrection.track21FirstText !==
    "あなた、一緒にランチ行かない？" ||
  trackBoundaryCorrection.track21LineCount !== 6 ||
  trackBoundaryCorrection.track21LastText !==
    "だけど、本当においしかったんだよ、あの完熟マンゴー" ||
  trackBoundaryCorrection.track22LineCount !== 6 ||
  trackBoundaryCorrection.track22FirstText !== "ねー、これ食べてみて。" ||
  trackBoundaryCorrection.track22LastText !==
    "うそじゃないよ。それとも、僕が君の味にすっかり慣らされちゃったのかな。" ||
  trackBoundaryCorrection.track23LineCount !== 6 ||
  trackBoundaryCorrection.track23FirstText !==
    "太郎が学校休んだんだって？どこか具合でも悪いのか？" ||
  trackBoundaryCorrection.track23LastText !==
    "あなたがカットしてあげたヘアスタイルよ。坊主頭はもう古いって…。太郎、怒ってるわよ～。" ||
  trackBoundaryCorrection.track23StartMs !== 0 ||
  trackBoundaryCorrection.track23EndMs !== 30553 ||
  trackBoundaryCorrection.track24FirstText !==
    "翼、いつまでゲームしてんの！もうそのくらいで止めにして、さっさと寝な" ||
  !trackBoundaryCorrection.timingIsContinuous ||
  !trackBoundaryCorrection.firstLineProtected ||
  trackBoundaryCorrection.track19PageStatus !== 200 ||
  trackBoundaryCorrection.track20PageStatus !== 200 ||
  trackBoundaryCorrection.track21PageStatus !== 200 ||
  trackBoundaryCorrection.track22PageStatus !== 200 ||
  trackBoundaryCorrection.track23PageStatus !== 200 ||
  !trackBoundaryCorrection.track19LinksToTrack20 ||
  !trackBoundaryCorrection.track20PageMatches ||
  !trackBoundaryCorrection.track21LinksToTrack22 ||
  !trackBoundaryCorrection.track22PageMatches ||
  !trackBoundaryCorrection.track22LinksToTrack23 ||
  !trackBoundaryCorrection.track23PageMatches ||
  !trackBoundaryCorrection.track23LinksToTrack24 ||
  continuousTrackNavigation.status !== 200 ||
  !continuousTrackNavigation.crossesSection ||
  audioChecks.some(
    (check) =>
      check.status !== 206 ||
      check.contentType !== "audio/mp4" ||
      check.contentLength !== "1024" ||
      !/^bytes 0-1023\/\d+$/u.test(check.contentRange ?? ""),
  )
) {
  process.exitCode = 1;
}

async function getJson(url) {
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(`${url}: ${payload.error?.message ?? response.status}`);
  }
  return payload;
}
