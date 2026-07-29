import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  CalendarCheck,
  Check,
  Clock3,
  Flame,
  Headphones,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  getHomeDashboardStats,
  getHomeCourseTarget,
  listCourseOverviews,
} from "@/lib/server/course-content";
import { studyTimeZone } from "@/lib/study-date";

export default async function Home() {
  const [units, nextCourse, dashboard] = await Promise.all([
    listCourseOverviews(),
    getHomeCourseTarget(),
    getHomeDashboardStats(),
  ]);
  const nextLesson = nextCourse?.lesson;
  const nextUnit = nextCourse?.unit;
  const nextTrack = nextCourse?.track;
  const nextPracticeHref =
    nextLesson && nextTrack
      ? `/practice/${nextLesson.id}?dialogue=${nextTrack.id}`
      : nextLesson
        ? `/practice/${nextLesson.id}`
        : "/admin";
  const today = new Intl.DateTimeFormat("zh-CN", {
    timeZone: studyTimeZone,
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());

  return (
    <div className="page-stack">
      <header className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">{today}</p>
          <h1>今日も、声に出そう。</h1>
          <p className="muted">
            今天从熟悉的节奏开始：先听，再跟读，最后留下一段自己的声音。
          </p>
        </div>
        <Badge tone="success">
          <Flame size={14} aria-hidden="true" />
          连续 {dashboard.streakDays} 天
        </Badge>
      </header>

      <section className="today-hero" aria-labelledby="today-plan-title">
        <div className="today-hero-copy">
          <div className="section-kicker">
            <Sparkles size={16} aria-hidden="true" />
            今日学习计划
          </div>
          <h2 id="today-plan-title">
            {nextTrack
              ? `Track ${nextTrack.number}`
              : (nextLesson?.title ?? "先导入一节教材课程")}
          </h2>
          <p className="japanese-title">
            {nextLesson
              ? `${nextUnit?.title ?? ""} · ${
                  nextLesson.level === "ADVANCED" ? "上級" : "中級"
                } Section ${nextLesson.sectionNumber}`
              : "教材管理 · 内容导入"}
          </p>
          <div className="today-progress-label">
            <span>目标 {dashboard.goalMinutes} 分钟</span>
            <span>
              {dashboard.todayMinutes} / {dashboard.goalMinutes} 分钟
            </span>
          </div>
          <Progress value={dashboard.goalProgress} label="今日学习目标完成度" />
          <div className="hero-actions">
            <Link className="button button-primary" href={nextPracticeHref}>
              <Headphones size={18} aria-hidden="true" />
              {nextLesson ? "开始今日学习" : "打开教材管理"}
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link
              className="button button-secondary"
              href={nextTrack ? `/tracks/${nextTrack.id}` : "/units"}
            >
              查看课程
            </Link>
          </div>
        </div>
        <div className="practice-stamp" aria-hidden="true">
          <span>声</span>
          <small>こえ</small>
        </div>
      </section>

      <section className="metric-grid" aria-label="学习统计">
        <article className="metric-card">
          <span className="metric-icon peach">
            <Clock3 size={19} />
          </span>
          <div>
            <strong>{dashboard.todayMinutes}</strong>
            <span>今日分钟</span>
          </div>
          <small>
            {dashboard.todaySessionCount > 0
              ? `已保存 ${dashboard.todaySessionCount} 次练习`
              : "完成练习后自动累计"}
          </small>
        </article>
        <article className="metric-card">
          <span className="metric-icon mint">
            <CalendarCheck size={19} />
          </span>
          <div>
            <strong>{dashboard.pendingReviewCount}</strong>
            <span>待复习</span>
          </div>
          <small>表达卡片与错题</small>
        </article>
        <article className="metric-card">
          <span className="metric-icon blue">
            <Target size={19} />
          </span>
          <div>
            <strong>
              {dashboard.dictationAccuracy === undefined
                ? "—"
                : `${dashboard.dictationAccuracy}%`}
            </strong>
            <span>听写正确率</span>
          </div>
          <small>最近 12 次练习</small>
        </article>
        <article className="metric-card">
          <span className="metric-icon gold">
            <TrendingUp size={19} />
          </span>
          <div>
            <strong>
              {dashboard.averageSelfRating === undefined
                ? "—"
                : `${dashboard.averageSelfRating.toFixed(1)} / 5`}
            </strong>
            <span>平均自评</span>
          </div>
          <small>发音 · 节奏 · 流畅度</small>
        </article>
      </section>

      <div className="dashboard-columns">
        <section className="surface" aria-labelledby="recent-title">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">CONTINUE</p>
              <h2 id="recent-title">继续上次学习</h2>
            </div>
            <Link className="text-link" href="/units">
              全部课程 <ArrowRight size={15} />
            </Link>
          </div>
          <Link
            className="recent-lesson"
            href={nextLesson ? nextPracticeHref : "/units"}
          >
            <span className="lesson-number">
              {String(nextTrack?.number ?? 0).padStart(2, "0")}
            </span>
            <span className="recent-copy">
              <strong>
                {nextTrack ? `Track ${nextTrack.number}` : "暂无课程"}
              </strong>
              <small>
                {nextLesson
                  ? `Unit ${nextUnit?.number ?? "—"} · Section ${
                      nextLesson.sectionNumber
                    } · Disk ${nextLesson.trackNumber}`
                  : "请先在教材管理中导入内容"}
              </small>
            </span>
            <span className="recent-meta">
              <b>{nextLesson?.progress ?? 0}%</b>
              <small>
                上次：{nextLesson?.lastPracticedAt ? "已练习" : "尚未练习"}
              </small>
            </span>
            <ArrowRight className="recent-arrow" size={18} />
          </Link>
        </section>

        <section className="surface" aria-labelledby="units-progress-title">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">PROGRESS</p>
              <h2 id="units-progress-title">Unit 进度</h2>
            </div>
            <BookOpenText
              size={20}
              className="heading-icon"
              aria-hidden="true"
            />
          </div>
          <div className="unit-progress-list">
            {units.map((unit) => (
              <div className="unit-progress-row" key={unit.id}>
                <span className="unit-kanji" aria-hidden="true">
                  {unit.number}
                </span>
                <div>
                  <div className="unit-progress-copy">
                    <strong>{unit.title}</strong>
                    <span>{unit.progress}%</span>
                  </div>
                  <Progress
                    value={unit.progress}
                    label={`${unit.title}完成度`}
                  />
                </div>
                {unit.progress === 100 ? (
                  <Check
                    size={17}
                    className="complete-check"
                    aria-label="已完成"
                  />
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
