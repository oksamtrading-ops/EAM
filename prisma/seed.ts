import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const BANKING_TEMPLATE = [
  // L1
  { code: "BANK-L1-001", level: "L1", name: "Customer Relationship Management", parentCode: null, sortOrder: 1, description: "Managing customer lifecycle, engagement, and satisfaction" },
  { code: "BANK-L1-002", level: "L1", name: "Product Management", parentCode: null, sortOrder: 2, description: "Design, pricing, and lifecycle management of financial products" },
  { code: "BANK-L1-003", level: "L1", name: "Risk & Compliance", parentCode: null, sortOrder: 3, description: "Identification, assessment, and mitigation of financial and regulatory risk" },
  { code: "BANK-L1-004", level: "L1", name: "Financial Management", parentCode: null, sortOrder: 4, description: "Treasury, accounting, and financial planning activities" },
  { code: "BANK-L1-005", level: "L1", name: "Digital Channels", parentCode: null, sortOrder: 5, description: "Online, mobile, and digital touchpoints for customer interaction" },
  { code: "BANK-L1-006", level: "L1", name: "Operations & Servicing", parentCode: null, sortOrder: 6, description: "Core banking operations, transaction processing, and service delivery" },
  { code: "BANK-L1-007", level: "L1", name: "Data & Analytics", parentCode: null, sortOrder: 7, description: "Data management, business intelligence, and advanced analytics" },
  { code: "BANK-L1-008", level: "L1", name: "Technology & Infrastructure", parentCode: null, sortOrder: 8, description: "IT infrastructure, platforms, and technology services" },
  // L2 — CRM
  { code: "BANK-L2-001", level: "L2", name: "Customer Acquisition", parentCode: "BANK-L1-001", sortOrder: 1, description: null },
  { code: "BANK-L2-002", level: "L2", name: "Customer Onboarding", parentCode: "BANK-L1-001", sortOrder: 2, description: null },
  { code: "BANK-L2-003", level: "L2", name: "Customer Retention", parentCode: "BANK-L1-001", sortOrder: 3, description: null },
  { code: "BANK-L2-004", level: "L2", name: "Customer Service", parentCode: "BANK-L1-001", sortOrder: 4, description: null },
  { code: "BANK-L2-005", level: "L2", name: "Customer Insights", parentCode: "BANK-L1-001", sortOrder: 5, description: null },
  // L2 — Product Management
  { code: "BANK-L2-006", level: "L2", name: "Product Design", parentCode: "BANK-L1-002", sortOrder: 1, description: null },
  { code: "BANK-L2-007", level: "L2", name: "Product Pricing", parentCode: "BANK-L1-002", sortOrder: 2, description: null },
  { code: "BANK-L2-008", level: "L2", name: "Product Lifecycle", parentCode: "BANK-L1-002", sortOrder: 3, description: null },
  // L2 — Risk & Compliance
  { code: "BANK-L2-009", level: "L2", name: "Credit Risk Management", parentCode: "BANK-L1-003", sortOrder: 1, description: null },
  { code: "BANK-L2-010", level: "L2", name: "Market Risk Management", parentCode: "BANK-L1-003", sortOrder: 2, description: null },
  { code: "BANK-L2-011", level: "L2", name: "Operational Risk", parentCode: "BANK-L1-003", sortOrder: 3, description: null },
  { code: "BANK-L2-012", level: "L2", name: "Regulatory Compliance", parentCode: "BANK-L1-003", sortOrder: 4, description: null },
  { code: "BANK-L2-013", level: "L2", name: "AML / KYC", parentCode: "BANK-L1-003", sortOrder: 5, description: null },
  // L2 — Financial Management
  { code: "BANK-L2-014", level: "L2", name: "Treasury Management", parentCode: "BANK-L1-004", sortOrder: 1, description: null },
  { code: "BANK-L2-015", level: "L2", name: "Financial Reporting", parentCode: "BANK-L1-004", sortOrder: 2, description: null },
  { code: "BANK-L2-016", level: "L2", name: "Budgeting & Forecasting", parentCode: "BANK-L1-004", sortOrder: 3, description: null },
  // L2 — Digital Channels
  { code: "BANK-L2-017", level: "L2", name: "Online Banking", parentCode: "BANK-L1-005", sortOrder: 1, description: null },
  { code: "BANK-L2-018", level: "L2", name: "Mobile Banking", parentCode: "BANK-L1-005", sortOrder: 2, description: null },
  { code: "BANK-L2-019", level: "L2", name: "ATM & Self-Service", parentCode: "BANK-L1-005", sortOrder: 3, description: null },
  { code: "BANK-L2-020", level: "L2", name: "API & Open Banking", parentCode: "BANK-L1-005", sortOrder: 4, description: null },
  // L2 — Operations
  { code: "BANK-L2-021", level: "L2", name: "Payment Processing", parentCode: "BANK-L1-006", sortOrder: 1, description: null },
  { code: "BANK-L2-022", level: "L2", name: "Loan Servicing", parentCode: "BANK-L1-006", sortOrder: 2, description: null },
  { code: "BANK-L2-023", level: "L2", name: "Account Management", parentCode: "BANK-L1-006", sortOrder: 3, description: null },
  { code: "BANK-L2-024", level: "L2", name: "Fraud Detection", parentCode: "BANK-L1-006", sortOrder: 4, description: null },
  // L2 — Data & Analytics
  { code: "BANK-L2-025", level: "L2", name: "Data Governance", parentCode: "BANK-L1-007", sortOrder: 1, description: null },
  { code: "BANK-L2-026", level: "L2", name: "Business Intelligence", parentCode: "BANK-L1-007", sortOrder: 2, description: null },
  { code: "BANK-L2-027", level: "L2", name: "Advanced Analytics & AI", parentCode: "BANK-L1-007", sortOrder: 3, description: null },
  // L2 — Technology
  { code: "BANK-L2-028", level: "L2", name: "Infrastructure Management", parentCode: "BANK-L1-008", sortOrder: 1, description: null },
  { code: "BANK-L2-029", level: "L2", name: "Application Development", parentCode: "BANK-L1-008", sortOrder: 2, description: null },
  { code: "BANK-L2-030", level: "L2", name: "Cybersecurity", parentCode: "BANK-L1-008", sortOrder: 3, description: null },
  { code: "BANK-L2-031", level: "L2", name: "Cloud Services", parentCode: "BANK-L1-008", sortOrder: 4, description: null },
];

const RETAIL_TEMPLATE = [
  { code: "RET-L1-001", level: "L1", name: "Merchandising", parentCode: null, sortOrder: 1, description: "Product assortment, planning, and allocation" },
  { code: "RET-L1-002", level: "L1", name: "Supply Chain Management", parentCode: null, sortOrder: 2, description: "Sourcing, procurement, logistics, and distribution" },
  { code: "RET-L1-003", level: "L1", name: "Store Operations", parentCode: null, sortOrder: 3, description: "Physical store management and in-store experience" },
  { code: "RET-L1-004", level: "L1", name: "E-Commerce", parentCode: null, sortOrder: 4, description: "Digital storefront, online ordering, and fulfillment" },
  { code: "RET-L1-005", level: "L1", name: "Customer Experience", parentCode: null, sortOrder: 5, description: "Omnichannel customer engagement and loyalty" },
  { code: "RET-L1-006", level: "L1", name: "Marketing", parentCode: null, sortOrder: 6, description: "Brand, campaigns, promotions, and customer acquisition" },
  { code: "RET-L1-007", level: "L1", name: "Finance & Administration", parentCode: null, sortOrder: 7, description: "Financial planning, accounting, and corporate services" },
  { code: "RET-L1-008", level: "L1", name: "Technology", parentCode: null, sortOrder: 8, description: "IT infrastructure, POS systems, and digital platforms" },
  // L2
  { code: "RET-L2-001", level: "L2", name: "Assortment Planning", parentCode: "RET-L1-001", sortOrder: 1, description: null },
  { code: "RET-L2-002", level: "L2", name: "Pricing & Promotions", parentCode: "RET-L1-001", sortOrder: 2, description: null },
  { code: "RET-L2-003", level: "L2", name: "Inventory Management", parentCode: "RET-L1-002", sortOrder: 1, description: null },
  { code: "RET-L2-004", level: "L2", name: "Supplier Management", parentCode: "RET-L1-002", sortOrder: 2, description: null },
  { code: "RET-L2-005", level: "L2", name: "Warehousing & Distribution", parentCode: "RET-L1-002", sortOrder: 3, description: null },
  { code: "RET-L2-006", level: "L2", name: "In-Store Experience", parentCode: "RET-L1-003", sortOrder: 1, description: null },
  { code: "RET-L2-007", level: "L2", name: "Workforce Management", parentCode: "RET-L1-003", sortOrder: 2, description: null },
  { code: "RET-L2-008", level: "L2", name: "Online Storefront", parentCode: "RET-L1-004", sortOrder: 1, description: null },
  { code: "RET-L2-009", level: "L2", name: "Order Management", parentCode: "RET-L1-004", sortOrder: 2, description: null },
  { code: "RET-L2-010", level: "L2", name: "Loyalty Programs", parentCode: "RET-L1-005", sortOrder: 1, description: null },
  { code: "RET-L2-011", level: "L2", name: "Customer Support", parentCode: "RET-L1-005", sortOrder: 2, description: null },
];

async function main() {
  console.log("Seeding industry templates...");

  const allTemplates = [
    ...BANKING_TEMPLATE.map((t) => ({ ...t, industry: "BANKING" as const })),
    ...RETAIL_TEMPLATE.map((t) => ({ ...t, industry: "RETAIL" as const })),
  ];

  for (const tpl of allTemplates) {
    await db.capabilityTemplate.upsert({
      where: { code: tpl.code },
      update: {},
      create: {
        code: tpl.code,
        industry: tpl.industry,
        level: tpl.level as any,
        name: tpl.name,
        description: tpl.description,
        parentCode: tpl.parentCode,
        sortOrder: tpl.sortOrder,
      },
    });
  }

  console.log(`Seeded ${allTemplates.length} templates`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
