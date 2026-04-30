import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type HighlightedTextProps = {
  text: string;
  query: string;
  className?: string;
  matchClassName?: string;
};

export function HighlightedText({
  text,
  query,
  className,
  matchClassName,
}: HighlightedTextProps) {
  const needle = query.trim();

  if (!needle) return <span className={className}>{text}</span>;

  const lowerText = text.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let matchIndex = lowerText.indexOf(lowerNeedle);

  if (matchIndex === -1) return <span className={className}>{text}</span>;

  while (matchIndex !== -1) {
    if (matchIndex > cursor) {
      parts.push(text.slice(cursor, matchIndex));
    }

    const end = matchIndex + needle.length;
    parts.push(
      <mark
        key={`${matchIndex}-${end}`}
        className={cn(
          "rounded-sm bg-primary/15 px-0.5 text-primary",
          matchClassName,
        )}
      >
        {text.slice(matchIndex, end)}
      </mark>,
    );

    cursor = end;
    matchIndex = lowerText.indexOf(lowerNeedle, cursor);
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return <span className={className}>{parts}</span>;
}
