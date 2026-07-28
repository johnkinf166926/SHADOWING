import { LockKeyhole } from "lucide-react";
import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "本地教材管理",
  description: "导入、校验并维护本地日语教材结构与音频。",
};

export default function AdminPage() {
  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">LOCAL CONTENT STUDIO</p>
          <h1>本地教材管理</h1>
          <p className="muted">
            管理 Unit、Section、对话、台词、表达和音频。教材 PDF
            与录音不会进入公开版本。
          </p>
        </div>
        <Badge tone="success">
          <LockKeyhole size={14} />
          仅限本地
        </Badge>
      </header>
      <AdminWorkspace />
    </div>
  );
}
