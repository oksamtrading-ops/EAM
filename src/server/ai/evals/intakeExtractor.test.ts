/**
 * Intake extractor eval.
 *
 * Given a known-good markdown fixture describing an Acme retail
 * current-state, the extractor must return drafts that include the
 * expected capability / application / risk names. Fuzzy match allows
 * minor phrasing variance but catches regressions where the extractor
 * drops entities entirely.
 *
 * Gated behind RUN_EVALS=1 because it calls the live Anthropic API
 * and consumes tokens.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { extractFromDocument } from "@/server/ai/services/intakeExtraction";
import { db } from "@/server/db";

const RUN = process.env.RUN_EVALS === "1";
const describeMaybe = RUN ? describe : describe.skip;

const EXPECTED_CAPABILITIES = [
  "Customer Management",
  "Lead Management",
  "Opportunity Management",
  "Marketing",
  "Campaign Execution",
  "Finance & Accounting",
  "General Ledger",
  "Accounts Payable",
];

const EXPECTED_APPLICATIONS = [
  "Salesforce",
  "NetSuite",
  "Mainframe Billing",
];

const EXPECTED_RISK_KEYWORDS = ["mainframe", "eol", "2027"];

describeMaybe("intake extractor — capability current-state fixture", () => {
  it("extracts the expected capabilities, applications, and risks", async () => {
    const filename = "capability-current-state.md";
    const fixturePath = path.resolve(
      process.cwd(),
      "src/server/ai/evals/fixtures",
      filename
    );
    const bytes = readFileSync(fixturePath);

    // Seed an ephemeral workspace + document row so the service has
    // valid FKs to write chunks/drafts against.
    const suffix = Date.now().toString(36);
    const user = await db.user.create({
      data: {
        clerkId: `eval_extractor_${suffix}`,
        email: `eval_extractor_${suffix}@evals.test`,
        name: "Eval Extractor",
      },
    });
    const workspace = await db.workspace.create({
      data: {
        userId: user.id,
        slug: `eval-extractor-${suffix}`,
        name: `Eval Extractor ${suffix}`,
        industry: "GENERIC",
        isDefault: false,
      },
    });
    const document = await db.intakeDocument.create({
      data: {
        workspaceId: workspace.id,
        filename,
        mimeType: "text/markdown",
        sizeBytes: bytes.length,
        storageKey: `inline:${filename}`,
        status: "PENDING",
        uploadedBy: user.id,
      },
    });

    try {
      await extractFromDocument({
        documentId: document.id,
        workspaceId: workspace.id,
        filename,
        mimeType: "text/markdown",
        bytes,
      });

      const drafts = await db.intakeDraft.findMany({
        where: { workspaceId: workspace.id },
      });

      const capNames = drafts
        .filter((d) => d.entityType === "CAPABILITY")
        .map((d) =>
          String((d.payload as Record<string, unknown>).name ?? "").toLowerCase()
        );
      const appNames = drafts
        .filter((d) => d.entityType === "APPLICATION")
        .map((d) =>
          String((d.payload as Record<string, unknown>).name ?? "").toLowerCase()
        );
      const riskTexts = drafts
        .filter((d) => d.entityType === "RISK")
        .map((d) => {
          const p = d.payload as Record<string, unknown>;
          return `${String(p.title ?? p.name ?? "")} ${String(p.description ?? "")}`.toLowerCase();
        });

      // Capabilities: require at least 6 of the 8 expected to appear.
      const capHits = EXPECTED_CAPABILITIES.filter((cap) =>
        capNames.some((n) => n.includes(cap.toLowerCase()))
      );
      expect(
        capHits.length,
        `Expected ≥6 of 8 capabilities, got ${capHits.length}: ${capHits.join(", ")}`
      ).toBeGreaterThanOrEqual(6);

      // Applications: require all 3 expected.
      for (const expected of EXPECTED_APPLICATIONS) {
        expect(
          appNames.some((n) => n.includes(expected.toLowerCase())),
          `Expected application "${expected}" in [${appNames.join(", ")}]`
        ).toBe(true);
      }

      // At least one risk should describe the mainframe EOL situation.
      const hasMainframeRisk = riskTexts.some((t) =>
        EXPECTED_RISK_KEYWORDS.every((k) => t.includes(k))
      );
      expect(
        hasMainframeRisk,
        `Expected a risk mentioning mainframe/EOL/2027; got: ${riskTexts.join(" | ")}`
      ).toBe(true);

      // Every draft must cite at least one evidence chunk.
      for (const d of drafts) {
        const evidence = d.evidence as Array<unknown>;
        expect(
          Array.isArray(evidence) && evidence.length > 0,
          `Draft ${d.id} (${d.entityType}) has no evidence`
        ).toBe(true);
      }
    } finally {
      await db.intakeDraft
        .deleteMany({ where: { workspaceId: workspace.id } })
        .catch(() => {});
      await db.intakeChunk
        .deleteMany({ where: { documentId: document.id } })
        .catch(() => {});
      await db.intakeDocument
        .delete({ where: { id: document.id } })
        .catch(() => {});
      await db.workspace
        .delete({ where: { id: workspace.id } })
        .catch(() => {});
      await db.user.delete({ where: { id: user.id } }).catch(() => {});
    }
  });
});
