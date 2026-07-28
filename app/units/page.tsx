import Link from "next/link";
import {
  ArrowRight,
  BookMarked,
  CheckCircle2,
  Layers3,
  PlayCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { listCourseUnits } from "@/lib/server/course-content";

export const metadata = {
  title: "课程",
  description: "浏览教材 Unit、Section 与学习进度。",
};

export default async function UnitsPage() {
  const units = await listCourseUnits();
  const trackCount = units.reduce(
    (count, unit) =>
      count +
      unit.lessons.reduce(
        (unitCount, lesson) =>
          unitCount + (lesson.dialogueCount ?? lesson.dialogues.length),
        0,
      ),
    0,
  );

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">COURSE LIBRARY</p>
          <h1>课程 · コース</h1>
          <p className="muted">
            以 Unit 为单位循序练习。教材正文与音频由你在本地教材管理中导入。
          </p>
        </div>
        <div className="page-summary">
          <span>
            <Layers3 size={17} aria-hidden="true" />
            {units.length} Units
          </span>
          <span>
            <BookMarked size={17} aria-hidden="true" />
            {trackCount} Tracks
          </span>
        </div>
      </header>

      <section className="unit-card-grid" aria-label="Unit 列表">
        {units.map((unit) => (
          <article className="unit-card surface" key={unit.id}>
            <div className="unit-card-top">
              <span className="unit-seal">U{unit.number}</span>
              <Badge
                tone={
                  unit.progress === 100
                    ? "success"
                    : unit.progress > 0
                      ? "accent"
                      : "neutral"
                }
              >
                {unit.progress === 100
                  ? "已完成"
                  : unit.progress > 0
                    ? "学习中"
                    : "未开始"}
              </Badge>
            </div>
            <div className="unit-card-copy">
              <h2>{unit.title}</h2>
              <p className="unit-subtitle">{unit.subtitle}</p>
              <p className="muted">{unit.description}</p>
            </div>
            <div className="unit-card-progress">
              <span>
                <b>{unit.progress}%</b>
                完成度
              </span>
              <span>
                {unit.lessons.reduce(
                  (count, lesson) =>
                    count + (lesson.dialogueCount ?? lesson.dialogues.length),
                  0,
                )}{" "}
                个 Track
              </span>
              <Progress value={unit.progress} label={`${unit.title}完成度`} />
            </div>
            <div className="unit-card-footer">
              {unit.lessons.length > 0 ? (
                <Link
                  className="button button-primary"
                  href={`/units/${unit.id}`}
                >
                  {unit.progress > 0 ? (
                    <>
                      <PlayCircle size={17} />
                      继续学习
                    </>
                  ) : (
                    <>
                      查看课程
                      <ArrowRight size={17} />
                    </>
                  )}
                </Link>
              ) : (
                <span className="empty-inline">等待导入课程</span>
              )}
              {unit.progress === 100 ? (
                <CheckCircle2
                  className="unit-complete-icon"
                  size={21}
                  aria-label="Unit 已完成"
                />
              ) : null}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
