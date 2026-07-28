"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenText,
  ChevronRight,
  Home,
  LibraryBig,
  Menu,
  Moon,
  Settings2,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

const navigation = [
  { href: "/", label: "今日", mobileLabel: "今日", icon: Home },
  { href: "/units", label: "课程", mobileLabel: "课程", icon: BookOpenText },
  {
    href: "/expressions",
    label: "重要表达",
    mobileLabel: "表达",
    icon: Sparkles,
  },
  { href: "/admin", label: "教材管理", mobileLabel: "管理", icon: Settings2 },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("shadowing-theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const isDark = saved ? saved === "dark" : prefersDark;
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    const frame = window.requestAnimationFrame(() => setDark(isDark));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    window.localStorage.setItem("shadowing-theme", next ? "dark" : "light");
  }

  function closeNavigation() {
    setMenuOpen(false);
    setSidebarCollapsed(true);
  }

  function openMobileNavigation() {
    setSidebarCollapsed(false);
    setMenuOpen(true);
  }

  return (
    <div
      className={`app-frame ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}`}
    >
      <aside
        aria-hidden={sidebarCollapsed || undefined}
        className={`sidebar ${menuOpen ? "sidebar-open" : ""} ${
          sidebarCollapsed ? "sidebar-collapsed" : ""
        }`}
        inert={sidebarCollapsed || undefined}
      >
        <div className="brand-row">
          <Link className="brand" href="/" onClick={() => setMenuOpen(false)}>
            <span className="brand-mark">影</span>
            <span>
              <strong>Shadowing Coach</strong>
              <small>日本語</small>
            </span>
          </Link>
          <button
            className="icon-button sidebar-close-button"
            type="button"
            aria-label="关闭导航"
            onClick={closeNavigation}
            title="关闭导航"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="主导航">
          {navigation.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                className={`nav-link ${active ? "nav-link-active" : ""}`}
                href={item.href}
                key={item.href}
                onClick={() => setMenuOpen(false)}
              >
                <Icon size={19} aria-hidden="true" />
                <span>{item.label}</span>
                {active ? <ChevronRight size={15} aria-hidden="true" /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-card">
          <LibraryBig size={20} aria-hidden="true" />
          <div>
            <strong>本地教材管理</strong>
            <p>PDF、音频与录音只保存在你的私有存储中。</p>
          </div>
        </div>

        <button
          className="theme-toggle"
          type="button"
          onClick={toggleTheme}
          aria-label={dark ? "切换浅色模式" : "切换深色模式"}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
          {dark ? "浅色模式" : "深色模式"}
        </button>
      </aside>

      {sidebarCollapsed ? (
        <button
          className="icon-button sidebar-reopen-button"
          type="button"
          aria-label="展开导航"
          onClick={() => setSidebarCollapsed(false)}
          title="展开导航"
        >
          <Menu size={21} />
        </button>
      ) : null}

      {menuOpen ? (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="关闭导航"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <header className="mobile-header">
        <button
          className="icon-button"
          type="button"
          aria-label="打开导航"
          onClick={openMobileNavigation}
        >
          <Menu size={21} />
        </button>
        <Link className="mobile-brand" href="/">
          <span className="brand-mark small">影</span>
          <strong>Shadowing Coach</strong>
        </Link>
        <button
          className="icon-button"
          type="button"
          aria-label={dark ? "切换浅色模式" : "切换深色模式"}
          onClick={toggleTheme}
        >
          {dark ? <Sun size={19} /> : <Moon size={19} />}
        </button>
      </header>

      <main className="app-main">{children}</main>

      <nav className="bottom-nav" aria-label="移动端主导航">
        {navigation.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              className={
                active ? "bottom-link bottom-link-active" : "bottom-link"
              }
              href={item.href}
              key={item.href}
            >
              <Icon size={20} aria-hidden="true" />
              <span>{item.mobileLabel}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
