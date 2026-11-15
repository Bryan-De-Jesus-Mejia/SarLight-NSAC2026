import { Fragment, type ReactNode } from "react";

type Tags = Record<string, (chunk: string) => ReactNode>;

/**
 * Sentences with a little markup inside, so the bold part can move where the
 * language wants it:
 *
 *   rich(t("It flags <b>{area} km²</b> on land.", { area }), { b: (c) => <b>{c}</b> })
 *
 * Only flat tags (no nesting) are supported; that is all the copy needs.
 */
export function rich(text: string, tags: Tags): ReactNode {
  const parts: ReactNode[] = [];
  const pattern = /<(\w+)>([\s\S]*?)<\/\1>/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const render = tags[match[1]];
    parts.push(<Fragment key={key++}>{render ? render(match[2]) : match[2]}</Fragment>);
    last = pattern.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.map((part, i) => (typeof part === "string" ? <Fragment key={`t${i}`}>{part}</Fragment> : part));
}
