import { Sparkles } from "lucide-react";
import { ExpressionWorkspace } from "@/components/study/expression-workspace";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "重要表达",
  description: "搜索、收藏并通过间隔重复复习日语会话表达。",
};

export default function ExpressionsPage() {
  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">EXPRESSIONS · 表現</p>
          <h1>重要表达</h1>
          <p className="muted">
            把课程中的关键句型变成卡片，用“认识 / 模糊 / 不认识”安排下一次复习。
          </p>
        </div>
        <Badge tone="accent">
          <Sparkles size={14} /> 6 个待复习
        </Badge>
      </header>
      <ExpressionWorkspace />
    </div>
  );
}
