import type { HTMLAttributes, ReactNode } from "react";

type BadgeTone = "neutral" | "success" | "accent" | "speakerA" | "speakerB";

export function Badge({
  tone = "neutral",
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span className={`badge badge-${tone} ${className}`} {...props}>
      {children}
    </span>
  );
}
