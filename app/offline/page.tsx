import Link from "next/link";
import { CloudOff, Home, RotateCcw } from "lucide-react";

export const metadata = {
  title: "当前离线",
};

export default function OfflinePage() {
  return (
    <div className="offline-page surface">
      <span>
        <CloudOff size={31} />
      </span>
      <p className="eyebrow">OFFLINE</p>
      <h1>现在处于离线状态</h1>
      <p>
        应用外壳与最近访问的页面仍可使用。教材音频只有在你主动选择“离线保存此课程”后才会缓存。
      </p>
      <div>
        <a className="button button-primary" href="/offline">
          <RotateCcw size={16} />
          恢复连接后刷新
        </a>
        <Link className="button button-secondary" href="/">
          <Home size={16} />
          返回首页
        </Link>
      </div>
    </div>
  );
}
