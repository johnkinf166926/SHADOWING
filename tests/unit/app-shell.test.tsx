// @vitest-environment jsdom

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));

describe("AppShell desktop sidebar", () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  it("closes with X and can be opened again", () => {
    const { container } = render(
      <AppShell>
        <p>课程内容</p>
      </AppShell>,
    );
    const frame = container.firstElementChild;

    fireEvent.click(screen.getByRole("button", { name: "关闭导航" }));

    expect(frame?.classList.contains("sidebar-is-collapsed")).toBe(true);
    expect(screen.getByRole("button", { name: "展开导航" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "展开导航" }));

    expect(frame?.classList.contains("sidebar-is-collapsed")).toBe(false);
    expect(screen.getByRole("button", { name: "关闭导航" })).toBeTruthy();
  });
});
