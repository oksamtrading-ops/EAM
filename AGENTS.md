<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# UI conventions

Codified during Plan F. Reach for the primitives below before
hand-rolling Tailwind triplets — the previous version of this app
ended up with 45+ palette drift sites because no rules existed.

## Spacing scale

- `gap-2` — inline metadata (icon + label + badge in one row)
- `gap-3` — toolbar controls and tight form fields
- `gap-4` — page-level card grids and KPI rows
- `space-y-4` — top-level page section rhythm
- `space-y-2` — inside cards

## Icon scale

- `h-3 w-3` — inline badge chips, small status dots
- `h-3.5 w-3.5` — dialog/toolbar buttons, button icons (default)
- `h-4 w-4` — table rows, list items, lucide default
- `h-5 w-5` — sidebar nav, section headers, prominent actions
- `h-6 w-6` — hero icons inside the jumbo `h-12 w-12` empty-state
  container

Mark icons that should never shrink under flex pressure with
`shrink-0`. Mark icons inside truncating containers with `min-w-0`
on the container, never on the icon.

## Status colors → use a primitive, not raw classes

Tone palette is locked. **Never** hardcode `bg-X-50/text-X-700/
border-X-200` triplets in new code; they'll drift again. Reach for:

- `<Badge tone="warn">…</Badge>` — see `src/components/ui/badge.tsx`
- `<Callout tone="warn" icon={Clock}>…</Callout>` — see
  `src/components/ui/callout.tsx`

Tones (six): `success | warn | danger | info | auth | ai`. Maps:

- `success` → emerald (committed, accepted, resolved)
- `warn` → amber (stale, action required, soft attention)
- `danger` → red (failure, critical risk)
- `info` → blue (neutral metadata, default callout)
- `auth` → violet (sign-in / passcode / identity surfaces)
- `ai` → `var(--ai)` purple (agent affordances, AI-generated content)

## Glass surfaces

Defined in `src/app/globals.css` — never set `backdrop-filter`
manually:

- `.glass` — floating panels (default; rounded-2xl preferred)
- `.glass-strong` — hero cards and elevated surfaces
- `.glass-toolbar` — sticky bars at top of pages

## Numerical display

- Tabular numerals (`tabular-nums`) on every number that updates
  in place or aligns in a column. Required for KPIs, counts, costs,
  dates, percentages.
- Hero metrics use `font-bold tracking-tight` at `text-3xl`
  through `text-7xl` per the `StatTile` primitive — don't roll
  bespoke hero numbers.

## Recharts color sources

Recharts can't read CSS variables directly. Use the `useToken` hook
from `src/lib/hooks/useToken.ts`:

```tsx
const aiColor = useToken("--ai", "#7c3aed");
<Line stroke={aiColor} ... />
```

This makes charts respect dark mode and Plan C #17 brand-color
overrides automatically. **Never** hardcode `#7c3aed`.

## Empty states + KPIs

Reach for the primitives instead of hand-rolling:

- `<EmptyState icon={Icon} title body action />` — replaces the
  jumbo-icon empty pattern
- `<StatTile layout="hero" | "card" />` — composes label + primary
  number + delta + verdict + sparkline + components
- `<Sparkline data={[…]} variant="trail" | "line" | "bars" />` —
  pure-SVG mini chart, no recharts dep
