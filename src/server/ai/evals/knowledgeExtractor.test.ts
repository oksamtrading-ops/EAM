/**
 * Knowledge fact-extractor eval.
 *
 * Feeds a markdown strategy deck through extractKnowledgeFromNewUpload
 * and asserts the resulting KnowledgeDraft rows match the agreed output
 * contract and cover the expected durable facts. RUN_EVALS=1 gated.
 */
import { afterAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { db } from "@/server/db";
import { extractKnowledgeFromNewUpload } from "@/server/ai/services/knowledgeExtraction";

const RUN = process.env.RUN_EVALS === "1";
const describeMaybe = RUN ? describe : describe.skip;

const EXPECTED_FACT_KEYWORDS: Array<{
  label: string;
  subject: string[];
  statement: string[];
}> = [
  {
    label: "Salesforce CRM",
    subject: ["salesforce"],
    statement: ["crm", "customer relationship"],
  },
  {
    label: "NetSuite GL",
    subject: ["netsuite"],
    statement: ["general ledger", "gl", "financials"],
  },
  {
    label: "Mainframe EOL 2027",
    subject: ["mainframe", "billing"],
    statement: ["2027", "end of life", "eol"],
  },
  {
    label: "Multi-cloud decision",
    subject: ["multi-cloud", "cloud"],
    statement: ["aws", "azure"],
  },
];

describeMaybe("knowledge extractor — strategy deck fixture", () => {
  let cleanup: () => Promise<void> = async () => {};

  afterAll(async () => {
    await cleanup();
    await db.$disconnect();
  });

  it("extracts durable facts with valid shape and expected coverage", async () => {
    const filename = "strategy-deck.md";
    const fixturePath = path.resolve(
      process.cwd(),
      "src/server/ai/evals/fixtures",
      filename
    );
    const bytes = readFileSync(fixturePath);

    // Seed workspace
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const user = await db.user.create({
      data: {
        clerkId: `eval_knowext_${suffix}`,
        email: `eval_knowext_${suffix}@evals.test`,
        name: "Eval Knowledge Extractor",
      },
    });
    const workspace = await db.workspace.create({
      data: {
        userId: user.id,
        slug: `eval-knowext-${suffix}`,
        name: `Eval Knowledge Extractor ${suffix}`,
        industry: "GENERIC",
        isDefault: false,
      },
    });

    cleanup = async () => {
      await db.knowledgeDraft
        .deleteMany({ where: { workspaceId: workspace.id } })
        .catch(() => {});
      await db.intakeChunk
        .deleteMany({
          where: { document: { workspaceId: workspace.id } },
        })
        .catch(() => {});
      await db.intakeDocument
        .deleteMany({ where: { workspaceId: workspace.id } })
        .catch(() => {});
      await db.workspace
        .delete({ where: { id: workspace.id } })
        .catch(() => {});
      await db.user.delete({ where: { id: user.id } }).catch(() => {});
    };

    const result = await extractKnowledgeFromNewUpload({
      workspaceId: workspace.id,
      userId: user.id,
      bytes,
      filename,
      mimeType: "text/markdown",
    });

    expect(result.extracted).toBe(true);
    expect(result.draftsCreated).toBeGreaterThanOrEqual(3);

    const drafts = await db.knowledgeDraft.findMany({
      where: { workspaceId: workspace.id },
    });

    // Contract: every draft must have subject, statement, kind,
    // confidence in [0,1], evidence with ≥1 entry.
    for (const d of drafts) {
      expect(d.subject.trim().length).toBeGreaterThan(0);
      expect(d.statement.trim().length).toBeGreaterThan(0);
      expect(["FACT", "DECISION", "PATTERN"]).toContain(d.kind);
      expect(d.confidence).toBeGreaterThanOrEqual(0);
      expect(d.confidence).toBeLessThanOrEqual(1);
      const ev = d.evidence as Array<unknown>;
      expect(Array.isArray(ev) && ev.length > 0).toBe(true);
    }

    // Coverage: at least 3 of the 4 expected durable facts land.
    const draftLower = drafts.map((d) => ({
      subject: d.subject.toLowerCase(),
      statement: d.statement.toLowerCase(),
    }));
    const hits = EXPECTED_FACT_KEYWORDS.filter((expected) =>
      draftLower.some(
        (d) =>
          expected.subject.some((s) => d.subject.includes(s)) &&
          expected.statement.some((s) => d.statement.includes(s))
      )
    );
    expect(
      hits.length,
      `Expected ≥3 of ${EXPECTED_FACT_KEYWORDS.length} canonical facts; got ${hits.length}: ${hits.map((h) => h.label).join(", ")}`
    ).toBeGreaterThanOrEqual(3);

    // Kind distribution: deck contains both FACT and DECISION material.
    const kinds = new Set(drafts.map((d) => d.kind));
    expect(
      kinds.has("FACT") || kinds.has("DECISION"),
      `Expected at least one FACT or DECISION; got kinds: ${[...kinds].join(", ")}`
    ).toBe(true);

    // Rule #3 from the prompt: subject + statement must not be identical
    // (reject tautologies like "NetSuite: NetSuite").
    for (const d of drafts) {
      expect(
        d.subject.trim().toLowerCase() !== d.statement.trim().toLowerCase(),
        `Draft ${d.id} violates rule #3: subject equals statement`
      ).toBe(true);
    }
  });
});
