import type { db } from "@/server/db";

type DB = typeof db;

export type TechArchFindingKind =
  | "COMPONENT_PAST_EOL"
  | "COMPONENT_EOL_SOON"
  | "COMPONENT_VERSION_DEPRECATED"
  | "PROHIBITED_PRODUCT_IN_USE"
  | "DEPRECATED_PRODUCT_IN_USE"
  | "APP_MISSING_TECH_LINKS"
  | "VENDOR_NO_PRODUCTS"
  | "PRODUCT_NO_VERSIONS"
  | "STANDARD_NEEDS_REVIEW";

export type TechArchSeverity = "HIGH" | "MEDIUM" | "LOW";

export type TechArchFinding = {
  kind: TechArchFindingKind;
  severity: TechArchSeverity;
  entityType: string;
  entityId: string;
  entityName: string;
  description: string;
  relatedId?: string;
  relatedName?: string;
};

const dayMs = 86_400_000;

export async function computeTechArchitectureFindings(
  dbx: DB,
  workspaceId: string
): Promise<TechArchFinding[]> {
  const now = Date.now();
  const findings: TechArchFinding[] = [];

  const components = await dbx.technologyComponent.findMany({
    where: { workspaceId, isActive: true },
    include: {
      product: { select: { id: true, name: true } },
      version: {
        select: {
          id: true,
          version: true,
          lifecycleStatus: true,
          endOfLifeDate: true,
        },
      },
    },
  });

  for (const c of components) {
    const v = c.version;
    if (!v) continue;
    const label = `${c.product.name} ${v.version}`;
    if (v.lifecycleStatus === "END_OF_LIFE") {
      findings.push({
        kind: "COMPONENT_PAST_EOL",
        severity: "HIGH",
        entityType: "TechnologyComponent",
        entityId: c.id,
        entityName: c.name,
        description: `Component uses ${label} which is past end-of-life`,
        relatedId: v.id,
        relatedName: label,
      });
    } else if (
      v.endOfLifeDate &&
      v.endOfLifeDate.getTime() >= now &&
      v.endOfLifeDate.getTime() - now <= 90 * dayMs
    ) {
      findings.push({
        kind: "COMPONENT_EOL_SOON",
        severity: "MEDIUM",
        entityType: "TechnologyComponent",
        entityId: c.id,
        entityName: c.name,
        description: `Component uses ${label} reaching EOL within 90 days`,
        relatedId: v.id,
        relatedName: label,
      });
    } else if (v.lifecycleStatus === "DEPRECATED") {
      findings.push({
        kind: "COMPONENT_VERSION_DEPRECATED",
        severity: "MEDIUM",
        entityType: "TechnologyComponent",
        entityId: c.id,
        entityName: c.name,
        description: `Component uses a deprecated version: ${label}`,
        relatedId: v.id,
        relatedName: label,
      });
    }
  }

  const standards = await dbx.technologyStandard.findMany({
    where: { workspaceId, isActive: true, status: "ACTIVE" },
    select: { id: true, name: true, level: true, productId: true, versionId: true, reviewDate: true },
  });

  const prohibitedProducts = new Map(
    standards.filter((s) => s.level === "PROHIBITED" && s.productId).map((s) => [s.productId!, s])
  );
  const deprecatedProducts = new Map(
    standards.filter((s) => s.level === "DEPRECATED" && s.productId).map((s) => [s.productId!, s])
  );

  const appTechLinks = await dbx.applicationTechnology.findMany({
    where: { component: { workspaceId } },
    include: {
      application: { select: { id: true, name: true } },
      component: {
        select: { id: true, name: true, productId: true, versionId: true },
      },
    },
  });

  for (const link of appTechLinks) {
    const pid = link.component.productId;
    const prohibited = prohibitedProducts.get(pid);
    if (prohibited) {
      findings.push({
        kind: "PROHIBITED_PRODUCT_IN_USE",
        severity: "HIGH",
        entityType: "Application",
        entityId: link.application.id,
        entityName: link.application.name,
        description: `Application uses prohibited technology (standard: ${prohibited.name})`,
        relatedId: link.component.id,
        relatedName: link.component.name,
      });
      continue;
    }
    const deprecated = deprecatedProducts.get(pid);
    if (deprecated) {
      findings.push({
        kind: "DEPRECATED_PRODUCT_IN_USE",
        severity: "MEDIUM",
        entityType: "Application",
        entityId: link.application.id,
        entityName: link.application.name,
        description: `Application uses deprecated technology (standard: ${deprecated.name})`,
        relatedId: link.component.id,
        relatedName: link.component.name,
      });
    }
  }

  const apps = await dbx.application.findMany({
    where: { workspaceId, isActive: true },
    select: {
      id: true,
      name: true,
      _count: { select: { technologyComponents: true } },
    },
  });
  for (const a of apps) {
    if (a._count.technologyComponents === 0) {
      findings.push({
        kind: "APP_MISSING_TECH_LINKS",
        severity: "LOW",
        entityType: "Application",
        entityId: a.id,
        entityName: a.name,
        description: "Application has no technology components linked",
      });
    }
  }

  const vendors = await dbx.vendor.findMany({
    where: { workspaceId, isActive: true },
    select: { id: true, name: true, _count: { select: { products: true } } },
  });
  for (const v of vendors) {
    if (v._count.products === 0) {
      findings.push({
        kind: "VENDOR_NO_PRODUCTS",
        severity: "LOW",
        entityType: "Vendor",
        entityId: v.id,
        entityName: v.name,
        description: "Vendor has no technology products catalogued",
      });
    }
  }

  const products = await dbx.technologyProduct.findMany({
    where: { workspaceId, isActive: true },
    select: { id: true, name: true, _count: { select: { versions: true } } },
  });
  for (const p of products) {
    if (p._count.versions === 0) {
      findings.push({
        kind: "PRODUCT_NO_VERSIONS",
        severity: "LOW",
        entityType: "TechnologyProduct",
        entityId: p.id,
        entityName: p.name,
        description: "Product has no versions recorded",
      });
    }
  }

  for (const s of standards) {
    if (s.reviewDate && s.reviewDate.getTime() < now) {
      findings.push({
        kind: "STANDARD_NEEDS_REVIEW",
        severity: "LOW",
        entityType: "TechnologyStandard",
        entityId: s.id,
        entityName: s.name,
        description: `Standard review date has passed`,
      });
    }
  }

  return findings;
}
