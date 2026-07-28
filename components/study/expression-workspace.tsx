"use client";

import {
  Bookmark,
  Check,
  ChevronLeft,
  Eye,
  EyeOff,
  Filter,
  Heart,
  Search,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ApiResponse } from "@/lib/api-response";
import type { ExpressionCard } from "@/lib/types";
import type { ReviewRating } from "@/lib/review";
import { Badge } from "../ui/badge";

type MasteryFilter = "all" | "0" | "1" | "2" | "3";

export function ExpressionWorkspace() {
  const [expressions, setExpressions] = useState<ExpressionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [unit, setUnit] = useState("all");
  const [mastery, setMastery] = useState<MasteryFilter>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [notice, setNotice] = useState<string>();
  const [reviewCutoff] = useState(() => new Date().getTime() + 86_400_000);
  const unitNumbers = useMemo(
    () =>
      Array.from(
        new Set(expressions.map((expression) => expression.unitNumber)),
      ).sort((left, right) => left - right),
    [expressions],
  );

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/expressions")
      .then(async (response) => {
        const result = (await response.json()) as ApiResponse<
          Array<Record<string, unknown>>
        >;
        if (!result.ok) {
          throw new Error(result.error.message);
        }
        return result.data.map(normalizeExpression);
      })
      .then((cards) => {
        if (!cancelled) {
          setExpressions(cards);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setNotice(
            error instanceof Error ? error.message : "表达卡片读取失败。",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return expressions.filter((expression) => {
      const matchesQuery =
        !normalized ||
        [
          expression.expression,
          expression.reading,
          expression.explanationZh,
          expression.tags.join(" "),
        ].some((value) => value.toLocaleLowerCase().includes(normalized));
      const matchesUnit =
        unit === "all" || expression.unitNumber === Number(unit);
      const matchesMastery =
        mastery === "all" || expression.masteryLevel === Number(mastery);
      const matchesFavorite = !favoritesOnly || expression.favorite;
      return matchesQuery && matchesUnit && matchesMastery && matchesFavorite;
    });
  }, [expressions, favoritesOnly, mastery, query, unit]);

  const dueExpressions = useMemo(
    () =>
      filtered.filter(
        (expression) =>
          new Date(expression.nextReviewAt).getTime() <= reviewCutoff,
      ),
    [filtered, reviewCutoff],
  );
  const reviewCards = dueExpressions.length > 0 ? dueExpressions : filtered;
  const currentCard =
    reviewCards[Math.min(reviewIndex, Math.max(0, reviewCards.length - 1))];

  async function toggleFavorite(card: ExpressionCard) {
    const next = !card.favorite;
    setExpressions((current) =>
      current.map((item) =>
        item.id === card.id ? { ...item, favorite: next } : item,
      ),
    );
    try {
      const response = await fetch("/api/expressions", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expressionId: card.id, favorite: next }),
      });
      const result = (await response.json()) as ApiResponse<{ id: string }>;
      if (!result.ok) {
        throw new Error(result.error.message);
      }
    } catch {
      setNotice("收藏状态未能保存到数据库，页面内状态仍会保留。");
    }
  }

  async function rate(card: ExpressionCard, rating: ReviewRating) {
    try {
      const response = await fetch("/api/expressions/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expressionId: card.id, rating }),
      });
      const result = (await response.json()) as ApiResponse<{
        nextReviewAt: string;
        masteryLevel: number;
      }>;
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      setExpressions((current) =>
        current.map((item) =>
          item.id === card.id
            ? {
                ...item,
                nextReviewAt: result.data.nextReviewAt,
                masteryLevel: result.data.masteryLevel,
              }
            : item,
        ),
      );
      setShowAnswer(false);
      setReviewIndex((current) =>
        reviewCards.length > 1 ? (current + 1) % reviewCards.length : 0,
      );
      setNotice("复习结果已保存，下一次复习时间已更新。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "复习结果保存失败。");
    }
  }

  if (reviewMode) {
    return (
      <div className="expression-review">
        <div className="review-toolbar">
          <button
            className="button button-ghost"
            type="button"
            onClick={() => setReviewMode(false)}
          >
            <ChevronLeft size={16} />
            返回卡片
          </button>
          <span>
            {reviewCards.length
              ? `${Math.min(reviewIndex + 1, reviewCards.length)} / ${reviewCards.length}`
              : "0 / 0"}
          </span>
        </div>
        {currentCard ? (
          <article className="review-flashcard surface">
            <div className="flashcard-top">
              <Badge tone="accent">Unit {currentCard.unitNumber}</Badge>
              <button
                className="icon-button"
                type="button"
                aria-label="切换收藏"
                onClick={() => void toggleFavorite(currentCard)}
              >
                <Heart
                  size={18}
                  fill={currentCard.favorite ? "currentColor" : "none"}
                />
              </button>
            </div>
            <div className="flashcard-expression">
              <p>{currentCard.expression}</p>
              <span>{currentCard.reading}</span>
            </div>
            {showAnswer ? (
              <div className="flashcard-answer">
                <p>{currentCard.explanationZh}</p>
                <small>{currentCard.explanationJa}</small>
                <blockquote>{currentCard.example}</blockquote>
              </div>
            ) : (
              <button
                className="reveal-answer"
                type="button"
                onClick={() => setShowAnswer(true)}
              >
                <Eye size={17} />
                显示解释
              </button>
            )}
            <div className="review-rating-actions">
              <button
                className="rating-again"
                type="button"
                disabled={!showAnswer}
                onClick={() => void rate(currentCard, "AGAIN")}
              >
                不认识
                <small>明天再见</small>
              </button>
              <button
                className="rating-uncertain"
                type="button"
                disabled={!showAnswer}
                onClick={() => void rate(currentCard, "UNCERTAIN")}
              >
                模糊
                <small>缩短间隔</small>
              </button>
              <button
                className="rating-know"
                type="button"
                disabled={!showAnswer}
                onClick={() => void rate(currentCard, "KNOW")}
              >
                认识
                <small>延长间隔</small>
              </button>
            </div>
          </article>
        ) : (
          <div className="surface empty-review">
            <Check size={28} />
            <h2>今天没有待复习表达</h2>
            <p>调整筛选条件，或回到课程继续学习。</p>
          </div>
        )}
        {notice ? (
          <div className="notice notice-neutral" role="status">
            <p>{notice}</p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="expression-workspace">
      <section className="expression-toolbar surface">
        <label className="search-field">
          <Search size={17} />
          <input
            value={query}
            placeholder="搜索表达、读音、解释或标签…"
            aria-label="搜索重要表达"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          <span className="visually-hidden">Unit 筛选</span>
          <select
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
          >
            <option value="all">全部 Unit</option>
            {unitNumbers.map((unitNumber) => (
              <option value={unitNumber} key={unitNumber}>
                Unit {unitNumber}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="visually-hidden">掌握程度筛选</span>
          <select
            value={mastery}
            onChange={(event) =>
              setMastery(event.target.value as MasteryFilter)
            }
          >
            <option value="all">全部掌握度</option>
            <option value="0">不认识</option>
            <option value="1">初识</option>
            <option value="2">熟悉</option>
            <option value="3">已掌握</option>
          </select>
        </label>
        <button
          className={favoritesOnly ? "filter-button active" : "filter-button"}
          type="button"
          aria-pressed={favoritesOnly}
          onClick={() => setFavoritesOnly((current) => !current)}
        >
          <Heart size={15} fill={favoritesOnly ? "currentColor" : "none"} />
          仅收藏
        </button>
      </section>

      <div className="expression-summary">
        <span>
          <Filter size={15} /> {filtered.length} 个表达
        </span>
        <button
          className="button button-primary"
          type="button"
          onClick={() => {
            setReviewMode(true);
            setReviewIndex(0);
            setShowAnswer(false);
          }}
        >
          <Sparkles size={16} />
          开始复习 ({dueExpressions.length})
        </button>
      </div>

      <section className="expression-grid" aria-label="重要表达卡片">
        {filtered.map((card) => (
          <article className="expression-card surface" key={card.id}>
            <div className="expression-card-top">
              <Badge tone="neutral">Unit {card.unitNumber}</Badge>
              <button
                className="favorite-plain"
                type="button"
                aria-label={card.favorite ? "取消收藏" : "收藏表达"}
                onClick={() => void toggleFavorite(card)}
              >
                <Heart
                  size={18}
                  fill={card.favorite ? "currentColor" : "none"}
                />
              </button>
            </div>
            <div className="expression-main">
              <h2>{card.expression}</h2>
              <p>{card.reading}</p>
            </div>
            <div className="expression-explanation">
              <p>{card.explanationZh}</p>
              <small>{card.explanationJa}</small>
            </div>
            <blockquote>{card.example}</blockquote>
            <div className="expression-tags">
              {card.tags.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>
            <div className="expression-card-footer">
              <span>
                <Bookmark size={14} />
                {masteryLabel(card.masteryLevel)}
              </span>
              <small>{card.sourceLesson}</small>
            </div>
          </article>
        ))}
      </section>

      {!loading && filtered.length === 0 ? (
        <div className="surface empty-review">
          <EyeOff size={27} />
          <h2>没有符合条件的表达</h2>
          <p>尝试清空搜索或放宽筛选条件。</p>
        </div>
      ) : null}
    </div>
  );
}

function normalizeExpression(input: Record<string, unknown>): ExpressionCard {
  return {
    id: String(input.id ?? ""),
    expression: String(input.expression ?? ""),
    reading: String(input.reading ?? ""),
    explanationZh: String(input.explanationZh ?? ""),
    explanationJa: String(input.explanationJa ?? ""),
    example: String(input.example ?? ""),
    sourceLesson: String(input.sourceLesson ?? ""),
    unitNumber: Number(input.unitNumber ?? 0),
    tags: parseTags(input.tags),
    masteryLevel: Number(input.masteryLevel ?? 0),
    nextReviewAt: String(input.nextReviewAt ?? new Date().toISOString()),
    favorite: Boolean(input.favorite),
  };
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value !== "string") {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function masteryLabel(level: number) {
  if (level >= 3) {
    return "已掌握";
  }
  if (level === 2) {
    return "熟悉";
  }
  if (level === 1) {
    return "初识";
  }
  return "不认识";
}
