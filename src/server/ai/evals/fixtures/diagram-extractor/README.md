# Diagram extractor judge fixtures

Three PNG fixtures pair with the JSON metadata files in this directory.
The JSON files (`prod-upload-001.json`, etc.) ship in git; the matching
`*.png` files must be added once each before running the judge tests.

## What to drop in

| File | Source |
|---|---|
| `prod-upload-001.png` | The architecture diagram a user uploaded that exposed the row-enumeration regression. Roughly 5 swimlane columns, ~30 nested rows. |
| `synthetic-minimal.png` | Hand-drawn or hand-built 3-app + 1-capability + 1-risk diagram. Controlled ground truth so the judge has an unambiguous reference. |
| `low-quality-edge.png` | Intentionally degraded — small file, blurry, hand-drawn-look. Tests confidence calibration. |

## Running

```bash
RUN_EVALS=1 npm run evals
```

Tests gracefully **skip** when a PNG is missing — log line will read
`fixture missing: <path>`. Once you drop in a PNG, the matching test
runs on the next invocation.

## Constraints

- PNG only (the agent route accepts JPEG/WebP too, but the judge
  attaches the raw bytes as an `image` content block; PNG keeps the
  fixture deterministic across re-encodes).
- Stay under 500KB each so the repo doesn't bloat. The diagram cap
  on the production extractor is 5MB; these fixtures should be much
  smaller because they're committed binary assets.
- No PII / no client logos. The "prod-upload-001" image should be
  redacted or synthetic if it contained anything sensitive.

## Editing rubric or fixtures

When the diagram-extractor system prompt at
`src/server/ai/prompts/diagramExtractor.v1.ts` changes, also re-check
the judge rubric at `src/server/ai/evals/rubrics/diagramExtractor.v1.ts`
— the rubric quotes the prompt's contract, so they stay in sync.

The judge intentionally measures the agent against the *agent's own
contract*, not an independent definition of "good." A drift between
the prompt and the rubric is a real bug, not a feature.
