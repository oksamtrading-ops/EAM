import { Fragment, type ReactNode } from "react";

/**
 * Minimal markdown renderer for streamed AI answers.
 *
 * Scope: paragraphs, bullet lists, **bold**, *italic*, `inline code`.
 * Tolerates partial / unclosed markdown mid-stream (no throws, just
 * renders what it has).
 *
 * Explicitly out of scope: headings, links, tables, code fences,
 * blockquotes, HTML passthrough. If an AI prompt starts needing those,
 * add react-markdown instead of expanding this.
 */
export function renderMarkdown(raw: string): ReactNode {
  if (!raw) return null;

  // Split into blocks on blank-line boundaries.
  const blocks = raw.split(/\n{2,}/);

  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    // Bullet list: any run of lines starting with "- " or "* " or "• "
    const lines = trimmed.split("\n");
    const isList = lines.every((l) => /^\s*[-*•]\s+/.test(l));
    if (isList) {
      return (
        <ul
          key={i}
          className="list-disc pl-5 space-y-0.5 my-1 marker:text-muted-foreground"
        >
          {lines.map((line, j) => (
            <li key={j}>{renderInline(line.replace(/^\s*[-*•]\s+/, ""))}</li>
          ))}
        </ul>
      );
    }

    // Paragraph — preserve single line breaks inside as <br/>
    return (
      <p key={i} className="my-1 first:mt-0 last:mb-0">
        {lines.map((line, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {renderInline(line)}
          </Fragment>
        ))}
      </p>
    );
  });
}

/** Inline: **bold**, *italic*, `code`. Order matters — code first so `*` inside code is literal. */
function renderInline(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let cursor = 0;
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      parts.push(text.slice(cursor, match.index));
    }
    if (match[1] != null) {
      parts.push(
        <code
          key={`c-${idx++}`}
          className="bg-muted/60 rounded px-1 text-[12px] font-mono"
        >
          {match[1]}
        </code>
      );
    } else if (match[2] != null) {
      parts.push(<strong key={`b-${idx++}`}>{match[2]}</strong>);
    } else if (match[3] != null) {
      parts.push(<em key={`i-${idx++}`}>{match[3]}</em>);
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts.length > 0 ? parts : text;
}
