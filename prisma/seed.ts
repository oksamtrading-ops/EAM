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

const LOGISTICS_TEMPLATE = [
  // L1
  { code: "LOG-L1-001", level: "L1", name: "Transportation Management", parentCode: null, sortOrder: 1, description: "Planning, execution, and optimization of freight and fleet movement" },
  { code: "LOG-L1-002", level: "L1", name: "Warehouse & Distribution", parentCode: null, sortOrder: 2, description: "Storage, handling, picking, packing, and distribution center operations" },
  { code: "LOG-L1-003", level: "L1", name: "Supply Chain Planning", parentCode: null, sortOrder: 3, description: "Demand forecasting, inventory planning, and supply network design" },
  { code: "LOG-L1-004", level: "L1", name: "Procurement & Sourcing", parentCode: null, sortOrder: 4, description: "Supplier selection, contract management, and purchasing operations" },
  { code: "LOG-L1-005", level: "L1", name: "Order Management", parentCode: null, sortOrder: 5, description: "Order capture, fulfillment orchestration, and delivery tracking" },
  { code: "LOG-L1-006", level: "L1", name: "Customs & Trade Compliance", parentCode: null, sortOrder: 6, description: "Import/export regulations, tariff classification, and trade documentation" },
  { code: "LOG-L1-007", level: "L1", name: "Returns & Reverse Logistics", parentCode: null, sortOrder: 7, description: "Product returns, refurbishment, recycling, and disposal management" },
  { code: "LOG-L1-008", level: "L1", name: "Technology & Data", parentCode: null, sortOrder: 8, description: "IT infrastructure, IoT tracking, analytics, and digital platforms" },
  // L2
  { code: "LOG-L2-001", level: "L2", name: "Route Optimization", parentCode: "LOG-L1-001", sortOrder: 1, description: null },
  { code: "LOG-L2-002", level: "L2", name: "Fleet Management", parentCode: "LOG-L1-001", sortOrder: 2, description: null },
  { code: "LOG-L2-003", level: "L2", name: "Carrier Management", parentCode: "LOG-L1-001", sortOrder: 3, description: null },
  { code: "LOG-L2-004", level: "L2", name: "Last Mile Delivery", parentCode: "LOG-L1-001", sortOrder: 4, description: null },
  { code: "LOG-L2-005", level: "L2", name: "Inventory Management", parentCode: "LOG-L1-002", sortOrder: 1, description: null },
  { code: "LOG-L2-006", level: "L2", name: "Picking & Packing", parentCode: "LOG-L1-002", sortOrder: 2, description: null },
  { code: "LOG-L2-007", level: "L2", name: "Yard Management", parentCode: "LOG-L1-002", sortOrder: 3, description: null },
  { code: "LOG-L2-008", level: "L2", name: "Demand Forecasting", parentCode: "LOG-L1-003", sortOrder: 1, description: null },
  { code: "LOG-L2-009", level: "L2", name: "Inventory Optimization", parentCode: "LOG-L1-003", sortOrder: 2, description: null },
  { code: "LOG-L2-010", level: "L2", name: "Network Design", parentCode: "LOG-L1-003", sortOrder: 3, description: null },
  { code: "LOG-L2-011", level: "L2", name: "Supplier Management", parentCode: "LOG-L1-004", sortOrder: 1, description: null },
  { code: "LOG-L2-012", level: "L2", name: "Contract Management", parentCode: "LOG-L1-004", sortOrder: 2, description: null },
  { code: "LOG-L2-013", level: "L2", name: "Order Fulfillment", parentCode: "LOG-L1-005", sortOrder: 1, description: null },
  { code: "LOG-L2-014", level: "L2", name: "Shipment Tracking", parentCode: "LOG-L1-005", sortOrder: 2, description: null },
  { code: "LOG-L2-015", level: "L2", name: "Customs Brokerage", parentCode: "LOG-L1-006", sortOrder: 1, description: null },
  { code: "LOG-L2-016", level: "L2", name: "Trade Documentation", parentCode: "LOG-L1-006", sortOrder: 2, description: null },
  { code: "LOG-L2-017", level: "L2", name: "Returns Processing", parentCode: "LOG-L1-007", sortOrder: 1, description: null },
  { code: "LOG-L2-018", level: "L2", name: "IoT & Tracking", parentCode: "LOG-L1-008", sortOrder: 1, description: null },
  { code: "LOG-L2-019", level: "L2", name: "Supply Chain Analytics", parentCode: "LOG-L1-008", sortOrder: 2, description: null },
];

const MANUFACTURING_TEMPLATE = [
  // L1
  { code: "MFG-L1-001", level: "L1", name: "Product Engineering", parentCode: null, sortOrder: 1, description: "Product design, R&D, prototyping, and engineering change management" },
  { code: "MFG-L1-002", level: "L1", name: "Production Planning", parentCode: null, sortOrder: 2, description: "Master scheduling, capacity planning, and materials requirements" },
  { code: "MFG-L1-003", level: "L1", name: "Manufacturing Operations", parentCode: null, sortOrder: 3, description: "Shop floor execution, work order management, and production monitoring" },
  { code: "MFG-L1-004", level: "L1", name: "Quality Management", parentCode: null, sortOrder: 4, description: "Quality assurance, inspection, testing, and compliance certification" },
  { code: "MFG-L1-005", level: "L1", name: "Supply Chain & Procurement", parentCode: null, sortOrder: 5, description: "Raw materials sourcing, supplier management, and inbound logistics" },
  { code: "MFG-L1-006", level: "L1", name: "Maintenance & Asset Management", parentCode: null, sortOrder: 6, description: "Equipment maintenance, spare parts, and asset lifecycle tracking" },
  { code: "MFG-L1-007", level: "L1", name: "Health, Safety & Environment", parentCode: null, sortOrder: 7, description: "Workplace safety, environmental compliance, and incident management" },
  { code: "MFG-L1-008", level: "L1", name: "Enterprise Services", parentCode: null, sortOrder: 8, description: "Finance, HR, IT infrastructure, and corporate functions" },
  // L2
  { code: "MFG-L2-001", level: "L2", name: "Product Design & CAD", parentCode: "MFG-L1-001", sortOrder: 1, description: null },
  { code: "MFG-L2-002", level: "L2", name: "Bill of Materials", parentCode: "MFG-L1-001", sortOrder: 2, description: null },
  { code: "MFG-L2-003", level: "L2", name: "Engineering Change Management", parentCode: "MFG-L1-001", sortOrder: 3, description: null },
  { code: "MFG-L2-004", level: "L2", name: "Master Production Scheduling", parentCode: "MFG-L1-002", sortOrder: 1, description: null },
  { code: "MFG-L2-005", level: "L2", name: "Capacity Planning", parentCode: "MFG-L1-002", sortOrder: 2, description: null },
  { code: "MFG-L2-006", level: "L2", name: "MRP / Materials Planning", parentCode: "MFG-L1-002", sortOrder: 3, description: null },
  { code: "MFG-L2-007", level: "L2", name: "Shop Floor Execution", parentCode: "MFG-L1-003", sortOrder: 1, description: null },
  { code: "MFG-L2-008", level: "L2", name: "Work Order Management", parentCode: "MFG-L1-003", sortOrder: 2, description: null },
  { code: "MFG-L2-009", level: "L2", name: "Production Monitoring & OEE", parentCode: "MFG-L1-003", sortOrder: 3, description: null },
  { code: "MFG-L2-010", level: "L2", name: "Quality Inspection", parentCode: "MFG-L1-004", sortOrder: 1, description: null },
  { code: "MFG-L2-011", level: "L2", name: "Non-Conformance Management", parentCode: "MFG-L1-004", sortOrder: 2, description: null },
  { code: "MFG-L2-012", level: "L2", name: "Supplier Quality", parentCode: "MFG-L1-004", sortOrder: 3, description: null },
  { code: "MFG-L2-013", level: "L2", name: "Raw Material Sourcing", parentCode: "MFG-L1-005", sortOrder: 1, description: null },
  { code: "MFG-L2-014", level: "L2", name: "Vendor Management", parentCode: "MFG-L1-005", sortOrder: 2, description: null },
  { code: "MFG-L2-015", level: "L2", name: "Preventive Maintenance", parentCode: "MFG-L1-006", sortOrder: 1, description: null },
  { code: "MFG-L2-016", level: "L2", name: "Asset Tracking", parentCode: "MFG-L1-006", sortOrder: 2, description: null },
  { code: "MFG-L2-017", level: "L2", name: "Workplace Safety", parentCode: "MFG-L1-007", sortOrder: 1, description: null },
  { code: "MFG-L2-018", level: "L2", name: "Environmental Compliance", parentCode: "MFG-L1-007", sortOrder: 2, description: null },
];

const HEALTHCARE_TEMPLATE = [
  // L1
  { code: "HC-L1-001", level: "L1", name: "Patient Care Delivery", parentCode: null, sortOrder: 1, description: "Clinical care processes, treatment planning, and patient outcomes" },
  { code: "HC-L1-002", level: "L1", name: "Clinical Operations", parentCode: null, sortOrder: 2, description: "Scheduling, bed management, nursing workflows, and care coordination" },
  { code: "HC-L1-003", level: "L1", name: "Health Information Management", parentCode: null, sortOrder: 3, description: "EHR management, medical records, coding, and clinical documentation" },
  { code: "HC-L1-004", level: "L1", name: "Revenue Cycle Management", parentCode: null, sortOrder: 4, description: "Patient billing, claims processing, insurance verification, and collections" },
  { code: "HC-L1-005", level: "L1", name: "Pharmacy & Medication", parentCode: null, sortOrder: 5, description: "Drug formulary, prescription management, and medication safety" },
  { code: "HC-L1-006", level: "L1", name: "Diagnostic Services", parentCode: null, sortOrder: 6, description: "Laboratory, radiology, pathology, and imaging services" },
  { code: "HC-L1-007", level: "L1", name: "Population Health", parentCode: null, sortOrder: 7, description: "Preventive care, chronic disease management, and community health" },
  { code: "HC-L1-008", level: "L1", name: "Regulatory & Compliance", parentCode: null, sortOrder: 8, description: "HIPAA compliance, accreditation, reporting, and quality measures" },
  // L2
  { code: "HC-L2-001", level: "L2", name: "Diagnosis & Treatment", parentCode: "HC-L1-001", sortOrder: 1, description: null },
  { code: "HC-L2-002", level: "L2", name: "Surgical Services", parentCode: "HC-L1-001", sortOrder: 2, description: null },
  { code: "HC-L2-003", level: "L2", name: "Emergency Care", parentCode: "HC-L1-001", sortOrder: 3, description: null },
  { code: "HC-L2-004", level: "L2", name: "Telehealth", parentCode: "HC-L1-001", sortOrder: 4, description: null },
  { code: "HC-L2-005", level: "L2", name: "Appointment Scheduling", parentCode: "HC-L1-002", sortOrder: 1, description: null },
  { code: "HC-L2-006", level: "L2", name: "Bed & Resource Management", parentCode: "HC-L1-002", sortOrder: 2, description: null },
  { code: "HC-L2-007", level: "L2", name: "Care Coordination", parentCode: "HC-L1-002", sortOrder: 3, description: null },
  { code: "HC-L2-008", level: "L2", name: "Electronic Health Records", parentCode: "HC-L1-003", sortOrder: 1, description: null },
  { code: "HC-L2-009", level: "L2", name: "Medical Coding", parentCode: "HC-L1-003", sortOrder: 2, description: null },
  { code: "HC-L2-010", level: "L2", name: "Clinical Documentation", parentCode: "HC-L1-003", sortOrder: 3, description: null },
  { code: "HC-L2-011", level: "L2", name: "Patient Billing", parentCode: "HC-L1-004", sortOrder: 1, description: null },
  { code: "HC-L2-012", level: "L2", name: "Claims Processing", parentCode: "HC-L1-004", sortOrder: 2, description: null },
  { code: "HC-L2-013", level: "L2", name: "Insurance Verification", parentCode: "HC-L1-004", sortOrder: 3, description: null },
  { code: "HC-L2-014", level: "L2", name: "Prescription Management", parentCode: "HC-L1-005", sortOrder: 1, description: null },
  { code: "HC-L2-015", level: "L2", name: "Drug Interaction Checking", parentCode: "HC-L1-005", sortOrder: 2, description: null },
  { code: "HC-L2-016", level: "L2", name: "Laboratory Services", parentCode: "HC-L1-006", sortOrder: 1, description: null },
  { code: "HC-L2-017", level: "L2", name: "Medical Imaging", parentCode: "HC-L1-006", sortOrder: 2, description: null },
  { code: "HC-L2-018", level: "L2", name: "Chronic Disease Programs", parentCode: "HC-L1-007", sortOrder: 1, description: null },
  { code: "HC-L2-019", level: "L2", name: "Preventive Screening", parentCode: "HC-L1-007", sortOrder: 2, description: null },
  { code: "HC-L2-020", level: "L2", name: "HIPAA Compliance", parentCode: "HC-L1-008", sortOrder: 1, description: null },
  { code: "HC-L2-021", level: "L2", name: "Quality Reporting", parentCode: "HC-L1-008", sortOrder: 2, description: null },
];

const GENERIC_TEMPLATE = [
  // L1
  { code: "GEN-L1-001", level: "L1", name: "Strategy & Governance", parentCode: null, sortOrder: 1, description: "Corporate strategy, enterprise governance, and portfolio management" },
  { code: "GEN-L1-002", level: "L1", name: "Customer Management", parentCode: null, sortOrder: 2, description: "Customer acquisition, service, retention, and experience management" },
  { code: "GEN-L1-003", level: "L1", name: "Product & Service Management", parentCode: null, sortOrder: 3, description: "Product lifecycle, service design, pricing, and innovation" },
  { code: "GEN-L1-004", level: "L1", name: "Operations & Delivery", parentCode: null, sortOrder: 4, description: "Core business operations, service delivery, and process management" },
  { code: "GEN-L1-005", level: "L1", name: "Finance & Accounting", parentCode: null, sortOrder: 5, description: "Financial planning, accounting, treasury, and financial reporting" },
  { code: "GEN-L1-006", level: "L1", name: "Human Capital Management", parentCode: null, sortOrder: 6, description: "Talent acquisition, workforce management, learning, and compensation" },
  { code: "GEN-L1-007", level: "L1", name: "Risk & Compliance", parentCode: null, sortOrder: 7, description: "Enterprise risk management, regulatory compliance, and internal audit" },
  { code: "GEN-L1-008", level: "L1", name: "Technology & Information", parentCode: null, sortOrder: 8, description: "IT services, data management, cybersecurity, and digital platforms" },
  // L2
  { code: "GEN-L2-001", level: "L2", name: "Strategic Planning", parentCode: "GEN-L1-001", sortOrder: 1, description: null },
  { code: "GEN-L2-002", level: "L2", name: "Performance Management", parentCode: "GEN-L1-001", sortOrder: 2, description: null },
  { code: "GEN-L2-003", level: "L2", name: "Enterprise Architecture", parentCode: "GEN-L1-001", sortOrder: 3, description: null },
  { code: "GEN-L2-004", level: "L2", name: "Customer Acquisition", parentCode: "GEN-L1-002", sortOrder: 1, description: null },
  { code: "GEN-L2-005", level: "L2", name: "Customer Service", parentCode: "GEN-L1-002", sortOrder: 2, description: null },
  { code: "GEN-L2-006", level: "L2", name: "Customer Analytics", parentCode: "GEN-L1-002", sortOrder: 3, description: null },
  { code: "GEN-L2-007", level: "L2", name: "Product Development", parentCode: "GEN-L1-003", sortOrder: 1, description: null },
  { code: "GEN-L2-008", level: "L2", name: "Pricing & Revenue", parentCode: "GEN-L1-003", sortOrder: 2, description: null },
  { code: "GEN-L2-009", level: "L2", name: "Innovation Management", parentCode: "GEN-L1-003", sortOrder: 3, description: null },
  { code: "GEN-L2-010", level: "L2", name: "Process Management", parentCode: "GEN-L1-004", sortOrder: 1, description: null },
  { code: "GEN-L2-011", level: "L2", name: "Service Delivery", parentCode: "GEN-L1-004", sortOrder: 2, description: null },
  { code: "GEN-L2-012", level: "L2", name: "Vendor Management", parentCode: "GEN-L1-004", sortOrder: 3, description: null },
  { code: "GEN-L2-013", level: "L2", name: "Financial Planning", parentCode: "GEN-L1-005", sortOrder: 1, description: null },
  { code: "GEN-L2-014", level: "L2", name: "Accounting & Reporting", parentCode: "GEN-L1-005", sortOrder: 2, description: null },
  { code: "GEN-L2-015", level: "L2", name: "Treasury & Cash Management", parentCode: "GEN-L1-005", sortOrder: 3, description: null },
  { code: "GEN-L2-016", level: "L2", name: "Talent Acquisition", parentCode: "GEN-L1-006", sortOrder: 1, description: null },
  { code: "GEN-L2-017", level: "L2", name: "Learning & Development", parentCode: "GEN-L1-006", sortOrder: 2, description: null },
  { code: "GEN-L2-018", level: "L2", name: "Compensation & Benefits", parentCode: "GEN-L1-006", sortOrder: 3, description: null },
  { code: "GEN-L2-019", level: "L2", name: "Enterprise Risk", parentCode: "GEN-L1-007", sortOrder: 1, description: null },
  { code: "GEN-L2-020", level: "L2", name: "Regulatory Compliance", parentCode: "GEN-L1-007", sortOrder: 2, description: null },
  { code: "GEN-L2-021", level: "L2", name: "Internal Audit", parentCode: "GEN-L1-007", sortOrder: 3, description: null },
  { code: "GEN-L2-022", level: "L2", name: "IT Service Management", parentCode: "GEN-L1-008", sortOrder: 1, description: null },
  { code: "GEN-L2-023", level: "L2", name: "Data Management", parentCode: "GEN-L1-008", sortOrder: 2, description: null },
  { code: "GEN-L2-024", level: "L2", name: "Cybersecurity", parentCode: "GEN-L1-008", sortOrder: 3, description: null },
  { code: "GEN-L2-025", level: "L2", name: "Cloud & Infrastructure", parentCode: "GEN-L1-008", sortOrder: 4, description: null },
];

const INSURANCE_TEMPLATE = [
  // L1
  { code: "INS-L1-001", level: "L1", name: "Product Management", parentCode: null, sortOrder: 1, description: "Design, develop, price, and maintain insurance products across all lines of business" },
  { code: "INS-L1-002", level: "L1", name: "Underwriting", parentCode: null, sortOrder: 2, description: "Evaluate, select, and price risks to determine insurability and appropriate terms" },
  { code: "INS-L1-003", level: "L1", name: "Policy Administration", parentCode: null, sortOrder: 3, description: "Issue, maintain, and service insurance policies throughout their lifecycle" },
  { code: "INS-L1-004", level: "L1", name: "Claims Management", parentCode: null, sortOrder: 4, description: "Receive, investigate, adjudicate, and settle insurance claims" },
  { code: "INS-L1-005", level: "L1", name: "Distribution & Sales", parentCode: null, sortOrder: 5, description: "Manage channels, intermediaries, and sales processes to acquire and retain business" },
  { code: "INS-L1-006", level: "L1", name: "Customer Management", parentCode: null, sortOrder: 6, description: "Acquire, onboard, service, and retain policyholders and claimants" },
  { code: "INS-L1-007", level: "L1", name: "Reinsurance", parentCode: null, sortOrder: 7, description: "Cede, manage, and account for risk transferred to reinsurance partners" },
  { code: "INS-L1-008", level: "L1", name: "Actuarial & Risk Management", parentCode: null, sortOrder: 8, description: "Quantify risk exposures, set reserves, and ensure capital adequacy" },
  { code: "INS-L1-009", level: "L1", name: "Compliance & Regulatory", parentCode: null, sortOrder: 9, description: "Ensure adherence to insurance regulations, reporting, and market conduct standards" },
  { code: "INS-L1-010", level: "L1", name: "Investment & Asset Management", parentCode: null, sortOrder: 10, description: "Manage investment portfolio and general/separate account assets" },
  // L2 — Product Management
  { code: "INS-L2-001", level: "L2", name: "Product Design & Configuration", parentCode: "INS-L1-001", sortOrder: 1, description: null },
  { code: "INS-L2-002", level: "L2", name: "Rate Development & Filing", parentCode: "INS-L1-001", sortOrder: 2, description: null },
  { code: "INS-L2-003", level: "L2", name: "Product Lifecycle Management", parentCode: "INS-L1-001", sortOrder: 3, description: null },
  { code: "INS-L2-004", level: "L2", name: "Forms & Endorsement Management", parentCode: "INS-L1-001", sortOrder: 4, description: null },
  // L2 — Underwriting
  { code: "INS-L2-005", level: "L2", name: "Submission Intake & Triage", parentCode: "INS-L1-002", sortOrder: 1, description: null },
  { code: "INS-L2-006", level: "L2", name: "Risk Assessment & Selection", parentCode: "INS-L1-002", sortOrder: 2, description: null },
  { code: "INS-L2-007", level: "L2", name: "Pricing & Rating", parentCode: "INS-L1-002", sortOrder: 3, description: null },
  { code: "INS-L2-008", level: "L2", name: "Underwriting Authority & Referrals", parentCode: "INS-L1-002", sortOrder: 4, description: null },
  // L2 — Policy Administration
  { code: "INS-L2-009", level: "L2", name: "Policy Issuance & Binding", parentCode: "INS-L1-003", sortOrder: 1, description: null },
  { code: "INS-L2-010", level: "L2", name: "Endorsements & Amendments", parentCode: "INS-L1-003", sortOrder: 2, description: null },
  { code: "INS-L2-011", level: "L2", name: "Renewal Processing", parentCode: "INS-L1-003", sortOrder: 3, description: null },
  { code: "INS-L2-012", level: "L2", name: "Cancellation & Reinstatement", parentCode: "INS-L1-003", sortOrder: 4, description: null },
  { code: "INS-L2-013", level: "L2", name: "Billing & Premium Accounting", parentCode: "INS-L1-003", sortOrder: 5, description: null },
  // L2 — Claims Management
  { code: "INS-L2-014", level: "L2", name: "First Notice of Loss (FNOL)", parentCode: "INS-L1-004", sortOrder: 1, description: null },
  { code: "INS-L2-015", level: "L2", name: "Claims Investigation & Adjustment", parentCode: "INS-L1-004", sortOrder: 2, description: null },
  { code: "INS-L2-016", level: "L2", name: "Reserving & Valuation", parentCode: "INS-L1-004", sortOrder: 3, description: null },
  { code: "INS-L2-017", level: "L2", name: "Settlement & Payment", parentCode: "INS-L1-004", sortOrder: 4, description: null },
  { code: "INS-L2-018", level: "L2", name: "Subrogation & Recovery", parentCode: "INS-L1-004", sortOrder: 5, description: null },
  // L2 — Distribution & Sales
  { code: "INS-L2-019", level: "L2", name: "Agency & Broker Management", parentCode: "INS-L1-005", sortOrder: 1, description: null },
  { code: "INS-L2-020", level: "L2", name: "Channel Strategy & Compensation", parentCode: "INS-L1-005", sortOrder: 2, description: null },
  { code: "INS-L2-021", level: "L2", name: "Quote & Proposal Generation", parentCode: "INS-L1-005", sortOrder: 3, description: null },
  { code: "INS-L2-022", level: "L2", name: "Digital & Direct Distribution", parentCode: "INS-L1-005", sortOrder: 4, description: null },
  // L2 — Customer Management
  { code: "INS-L2-023", level: "L2", name: "Customer Onboarding & KYC", parentCode: "INS-L1-006", sortOrder: 1, description: null },
  { code: "INS-L2-024", level: "L2", name: "Customer Service & Inquiries", parentCode: "INS-L1-006", sortOrder: 2, description: null },
  { code: "INS-L2-025", level: "L2", name: "Customer 360 View", parentCode: "INS-L1-006", sortOrder: 3, description: null },
  { code: "INS-L2-026", level: "L2", name: "Retention & Loyalty Management", parentCode: "INS-L1-006", sortOrder: 4, description: null },
  // L2 — Reinsurance
  { code: "INS-L2-027", level: "L2", name: "Treaty & Facultative Placement", parentCode: "INS-L1-007", sortOrder: 1, description: null },
  { code: "INS-L2-028", level: "L2", name: "Cession Administration", parentCode: "INS-L1-007", sortOrder: 2, description: null },
  { code: "INS-L2-029", level: "L2", name: "Reinsurance Accounting & Settlements", parentCode: "INS-L1-007", sortOrder: 3, description: null },
  { code: "INS-L2-030", level: "L2", name: "Reinsurance Recoveries", parentCode: "INS-L1-007", sortOrder: 4, description: null },
  // L2 — Actuarial & Risk Management
  { code: "INS-L2-031", level: "L2", name: "Loss Reserving & Triangulation", parentCode: "INS-L1-008", sortOrder: 1, description: null },
  { code: "INS-L2-032", level: "L2", name: "Capital Modeling & Solvency", parentCode: "INS-L1-008", sortOrder: 2, description: null },
  { code: "INS-L2-033", level: "L2", name: "Catastrophe Modeling", parentCode: "INS-L1-008", sortOrder: 3, description: null },
  { code: "INS-L2-034", level: "L2", name: "Enterprise Risk Management", parentCode: "INS-L1-008", sortOrder: 4, description: null },
  // L2 — Compliance & Regulatory
  { code: "INS-L2-035", level: "L2", name: "Regulatory Filing & Reporting", parentCode: "INS-L1-009", sortOrder: 1, description: null },
  { code: "INS-L2-036", level: "L2", name: "Market Conduct & Fair Practices", parentCode: "INS-L1-009", sortOrder: 2, description: null },
  { code: "INS-L2-037", level: "L2", name: "AML & Fraud Detection", parentCode: "INS-L1-009", sortOrder: 3, description: null },
  { code: "INS-L2-038", level: "L2", name: "License & Appointment Management", parentCode: "INS-L1-009", sortOrder: 4, description: null },
  // L2 — Investment & Asset Management
  { code: "INS-L2-039", level: "L2", name: "Investment Strategy & Allocation", parentCode: "INS-L1-010", sortOrder: 1, description: null },
  { code: "INS-L2-040", level: "L2", name: "Portfolio Management & Trading", parentCode: "INS-L1-010", sortOrder: 2, description: null },
  { code: "INS-L2-041", level: "L2", name: "Investment Accounting", parentCode: "INS-L1-010", sortOrder: 3, description: null },
  { code: "INS-L2-042", level: "L2", name: "Asset-Liability Matching", parentCode: "INS-L1-010", sortOrder: 4, description: null },
];

const PHARMA_TEMPLATE = [
  // L1
  { code: "PHA-L1-001", level: "L1", name: "Drug Discovery & Research", parentCode: null, sortOrder: 1, description: "Identify and validate novel therapeutic targets and lead compounds" },
  { code: "PHA-L1-002", level: "L1", name: "Preclinical Development", parentCode: null, sortOrder: 2, description: "Evaluate safety, toxicology, and pharmacokinetics before human trials" },
  { code: "PHA-L1-003", level: "L1", name: "Clinical Development", parentCode: null, sortOrder: 3, description: "Design, execute, and analyze Phase I–IV human clinical trials" },
  { code: "PHA-L1-004", level: "L1", name: "Regulatory Affairs", parentCode: null, sortOrder: 4, description: "Secure and maintain marketing authorizations across global jurisdictions" },
  { code: "PHA-L1-005", level: "L1", name: "Manufacturing & Supply Chain", parentCode: null, sortOrder: 5, description: "Produce, package, and distribute drug products at commercial scale" },
  { code: "PHA-L1-006", level: "L1", name: "Quality Management", parentCode: null, sortOrder: 6, description: "Ensure product quality and regulatory compliance across the product lifecycle" },
  { code: "PHA-L1-007", level: "L1", name: "Commercial Operations", parentCode: null, sortOrder: 7, description: "Drive product launch, marketing, and sales execution" },
  { code: "PHA-L1-008", level: "L1", name: "Market Access & Pricing", parentCode: null, sortOrder: 8, description: "Optimize reimbursement, pricing, and formulary positioning" },
  { code: "PHA-L1-009", level: "L1", name: "Medical Affairs", parentCode: null, sortOrder: 9, description: "Provide scientific expertise and evidence generation post-approval" },
  { code: "PHA-L1-010", level: "L1", name: "Pharmacovigilance & Drug Safety", parentCode: null, sortOrder: 10, description: "Monitor, detect, and report adverse drug reactions throughout the product lifecycle" },
  // L2 — Drug Discovery & Research
  { code: "PHA-L2-001", level: "L2", name: "Target Identification & Validation", parentCode: "PHA-L1-001", sortOrder: 1, description: null },
  { code: "PHA-L2-002", level: "L2", name: "Hit-to-Lead & Lead Optimization", parentCode: "PHA-L1-001", sortOrder: 2, description: null },
  { code: "PHA-L2-003", level: "L2", name: "Translational Research", parentCode: "PHA-L1-001", sortOrder: 3, description: null },
  { code: "PHA-L2-004", level: "L2", name: "Biomarker Discovery", parentCode: "PHA-L1-001", sortOrder: 4, description: null },
  { code: "PHA-L2-005", level: "L2", name: "Intellectual Property Management", parentCode: "PHA-L1-001", sortOrder: 5, description: null },
  // L2 — Preclinical Development
  { code: "PHA-L2-006", level: "L2", name: "In-Vitro & In-Vivo Studies", parentCode: "PHA-L1-002", sortOrder: 1, description: null },
  { code: "PHA-L2-007", level: "L2", name: "ADME/PK Profiling", parentCode: "PHA-L1-002", sortOrder: 2, description: null },
  { code: "PHA-L2-008", level: "L2", name: "Toxicology & Safety Assessment", parentCode: "PHA-L1-002", sortOrder: 3, description: null },
  { code: "PHA-L2-009", level: "L2", name: "Formulation Development", parentCode: "PHA-L1-002", sortOrder: 4, description: null },
  // L2 — Clinical Development
  { code: "PHA-L2-010", level: "L2", name: "Trial Design & Protocol Management", parentCode: "PHA-L1-003", sortOrder: 1, description: null },
  { code: "PHA-L2-011", level: "L2", name: "Site Selection & Patient Recruitment", parentCode: "PHA-L1-003", sortOrder: 2, description: null },
  { code: "PHA-L2-012", level: "L2", name: "Clinical Data Management", parentCode: "PHA-L1-003", sortOrder: 3, description: null },
  { code: "PHA-L2-013", level: "L2", name: "Clinical Supply & Randomization", parentCode: "PHA-L1-003", sortOrder: 4, description: null },
  { code: "PHA-L2-014", level: "L2", name: "Safety Monitoring & DSMB Oversight", parentCode: "PHA-L1-003", sortOrder: 5, description: null },
  // L2 — Regulatory Affairs
  { code: "PHA-L2-015", level: "L2", name: "Regulatory Strategy & Intelligence", parentCode: "PHA-L1-004", sortOrder: 1, description: null },
  { code: "PHA-L2-016", level: "L2", name: "Submission & Dossier Management (eCTD)", parentCode: "PHA-L1-004", sortOrder: 2, description: null },
  { code: "PHA-L2-017", level: "L2", name: "Labeling & Promotional Review", parentCode: "PHA-L1-004", sortOrder: 3, description: null },
  { code: "PHA-L2-018", level: "L2", name: "Post-Approval Lifecycle Management", parentCode: "PHA-L1-004", sortOrder: 4, description: null },
  // L2 — Manufacturing & Supply Chain
  { code: "PHA-L2-019", level: "L2", name: "Process Development & Scale-Up", parentCode: "PHA-L1-005", sortOrder: 1, description: null },
  { code: "PHA-L2-020", level: "L2", name: "GMP Manufacturing", parentCode: "PHA-L1-005", sortOrder: 2, description: null },
  { code: "PHA-L2-021", level: "L2", name: "Packaging & Serialization", parentCode: "PHA-L1-005", sortOrder: 3, description: null },
  { code: "PHA-L2-022", level: "L2", name: "Supply Planning & Inventory", parentCode: "PHA-L1-005", sortOrder: 4, description: null },
  { code: "PHA-L2-023", level: "L2", name: "Cold Chain & Distribution", parentCode: "PHA-L1-005", sortOrder: 5, description: null },
  // L2 — Quality Management
  { code: "PHA-L2-024", level: "L2", name: "Quality Assurance & GxP Compliance", parentCode: "PHA-L1-006", sortOrder: 1, description: null },
  { code: "PHA-L2-025", level: "L2", name: "Quality Control & Lab Operations", parentCode: "PHA-L1-006", sortOrder: 2, description: null },
  { code: "PHA-L2-026", level: "L2", name: "Deviation, CAPA & Change Control", parentCode: "PHA-L1-006", sortOrder: 3, description: null },
  { code: "PHA-L2-027", level: "L2", name: "Supplier & CMO Quality", parentCode: "PHA-L1-006", sortOrder: 4, description: null },
  { code: "PHA-L2-028", level: "L2", name: "Validation & Qualification", parentCode: "PHA-L1-006", sortOrder: 5, description: null },
  // L2 — Commercial Operations
  { code: "PHA-L2-029", level: "L2", name: "Go-to-Market Strategy & Launch", parentCode: "PHA-L1-007", sortOrder: 1, description: null },
  { code: "PHA-L2-030", level: "L2", name: "Sales Force Effectiveness & CRM", parentCode: "PHA-L1-007", sortOrder: 2, description: null },
  { code: "PHA-L2-031", level: "L2", name: "Omnichannel Marketing & HCP Engagement", parentCode: "PHA-L1-007", sortOrder: 3, description: null },
  { code: "PHA-L2-032", level: "L2", name: "Commercial Analytics & Forecasting", parentCode: "PHA-L1-007", sortOrder: 4, description: null },
  // L2 — Market Access & Pricing
  { code: "PHA-L2-033", level: "L2", name: "Health Economics & Outcomes Research", parentCode: "PHA-L1-008", sortOrder: 1, description: null },
  { code: "PHA-L2-034", level: "L2", name: "Pricing & Contracting Strategy", parentCode: "PHA-L1-008", sortOrder: 2, description: null },
  { code: "PHA-L2-035", level: "L2", name: "Payer & HTA Engagement", parentCode: "PHA-L1-008", sortOrder: 3, description: null },
  { code: "PHA-L2-036", level: "L2", name: "Patient Access & Assistance Programs", parentCode: "PHA-L1-008", sortOrder: 4, description: null },
  // L2 — Medical Affairs
  { code: "PHA-L2-037", level: "L2", name: "Medical Information & Communication", parentCode: "PHA-L1-009", sortOrder: 1, description: null },
  { code: "PHA-L2-038", level: "L2", name: "MSL Operations", parentCode: "PHA-L1-009", sortOrder: 2, description: null },
  { code: "PHA-L2-039", level: "L2", name: "Investigator-Initiated Studies", parentCode: "PHA-L1-009", sortOrder: 3, description: null },
  { code: "PHA-L2-040", level: "L2", name: "Publication Planning", parentCode: "PHA-L1-009", sortOrder: 4, description: null },
  { code: "PHA-L2-041", level: "L2", name: "Advisory Boards & KOL Engagement", parentCode: "PHA-L1-009", sortOrder: 5, description: null },
  // L2 — Pharmacovigilance & Drug Safety
  { code: "PHA-L2-042", level: "L2", name: "Adverse Event Case Processing", parentCode: "PHA-L1-010", sortOrder: 1, description: null },
  { code: "PHA-L2-043", level: "L2", name: "Signal Detection & Risk Management", parentCode: "PHA-L1-010", sortOrder: 2, description: null },
  { code: "PHA-L2-044", level: "L2", name: "Periodic Safety Reporting (PSUR)", parentCode: "PHA-L1-010", sortOrder: 3, description: null },
  { code: "PHA-L2-045", level: "L2", name: "Risk Evaluation & Mitigation (REMS)", parentCode: "PHA-L1-010", sortOrder: 4, description: null },
];

const TELECOM_TEMPLATE = [
  // L1
  { code: "TEL-L1-001", level: "L1", name: "Strategy & Enterprise Management", parentCode: null, sortOrder: 1, description: "Corporate planning, portfolio governance, and enterprise performance oversight" },
  { code: "TEL-L1-002", level: "L1", name: "Product & Offer Management", parentCode: null, sortOrder: 2, description: "Lifecycle management of commercial products, bundles, and catalog entries" },
  { code: "TEL-L1-003", level: "L1", name: "Customer Management", parentCode: null, sortOrder: 3, description: "End-to-end customer engagement from acquisition through retention" },
  { code: "TEL-L1-004", level: "L1", name: "Service Management", parentCode: null, sortOrder: 4, description: "Design, orchestration, and assurance of customer-facing and resource-facing services" },
  { code: "TEL-L1-005", level: "L1", name: "Network & Resource Management", parentCode: null, sortOrder: 5, description: "Planning, provisioning, and real-time control of network infrastructure (OSS)" },
  { code: "TEL-L1-006", level: "L1", name: "Revenue & Financial Management", parentCode: null, sortOrder: 6, description: "Rating, charging, billing, and financial settlement across revenue streams" },
  { code: "TEL-L1-007", level: "L1", name: "Partner & Supplier Management", parentCode: null, sortOrder: 7, description: "Governance of wholesale, MVNO, roaming, and vendor relationships" },
  { code: "TEL-L1-008", level: "L1", name: "Infrastructure & IT Management", parentCode: null, sortOrder: 8, description: "Physical assets, data centers, IT platforms, and cloud infrastructure" },
  { code: "TEL-L1-009", level: "L1", name: "Digital Services & Innovation", parentCode: null, sortOrder: 9, description: "Digital channels, API ecosystems, and emerging-technology enablement" },
  { code: "TEL-L1-010", level: "L1", name: "Workforce & Field Operations", parentCode: null, sortOrder: 10, description: "Planning and dispatch of field technicians and workforce optimization" },
  // L2 — Strategy & Enterprise Management
  { code: "TEL-L2-001", level: "L2", name: "Strategic Planning", parentCode: "TEL-L1-001", sortOrder: 1, description: null },
  { code: "TEL-L2-002", level: "L2", name: "Enterprise Risk Management", parentCode: "TEL-L1-001", sortOrder: 2, description: null },
  { code: "TEL-L2-003", level: "L2", name: "Regulatory & Compliance Management", parentCode: "TEL-L1-001", sortOrder: 3, description: null },
  { code: "TEL-L2-004", level: "L2", name: "Enterprise Performance Management", parentCode: "TEL-L1-001", sortOrder: 4, description: null },
  // L2 — Product & Offer Management
  { code: "TEL-L2-005", level: "L2", name: "Product Portfolio Management", parentCode: "TEL-L1-002", sortOrder: 1, description: null },
  { code: "TEL-L2-006", level: "L2", name: "Product Design & Configuration", parentCode: "TEL-L1-002", sortOrder: 2, description: null },
  { code: "TEL-L2-007", level: "L2", name: "Offer Pricing & Discounting", parentCode: "TEL-L1-002", sortOrder: 3, description: null },
  { code: "TEL-L2-008", level: "L2", name: "Catalog Management", parentCode: "TEL-L1-002", sortOrder: 4, description: null },
  // L2 — Customer Management
  { code: "TEL-L2-009", level: "L2", name: "Customer Onboarding & Identity", parentCode: "TEL-L1-003", sortOrder: 1, description: null },
  { code: "TEL-L2-010", level: "L2", name: "Customer Order Management", parentCode: "TEL-L1-003", sortOrder: 2, description: null },
  { code: "TEL-L2-011", level: "L2", name: "Customer Experience Management", parentCode: "TEL-L1-003", sortOrder: 3, description: null },
  { code: "TEL-L2-012", level: "L2", name: "Loyalty & Retention Management", parentCode: "TEL-L1-003", sortOrder: 4, description: null },
  { code: "TEL-L2-013", level: "L2", name: "Customer Data & Analytics", parentCode: "TEL-L1-003", sortOrder: 5, description: null },
  // L2 — Service Management
  { code: "TEL-L2-014", level: "L2", name: "Service Design & Catalog", parentCode: "TEL-L1-004", sortOrder: 1, description: null },
  { code: "TEL-L2-015", level: "L2", name: "Service Order Orchestration", parentCode: "TEL-L1-004", sortOrder: 2, description: null },
  { code: "TEL-L2-016", level: "L2", name: "Service Quality Management", parentCode: "TEL-L1-004", sortOrder: 3, description: null },
  { code: "TEL-L2-017", level: "L2", name: "Service Problem Management", parentCode: "TEL-L1-004", sortOrder: 4, description: null },
  { code: "TEL-L2-018", level: "L2", name: "Service Inventory Management", parentCode: "TEL-L1-004", sortOrder: 5, description: null },
  // L2 — Network & Resource Management
  { code: "TEL-L2-019", level: "L2", name: "Network Planning & Engineering", parentCode: "TEL-L1-005", sortOrder: 1, description: null },
  { code: "TEL-L2-020", level: "L2", name: "Provisioning & Activation", parentCode: "TEL-L1-005", sortOrder: 2, description: null },
  { code: "TEL-L2-021", level: "L2", name: "Network Inventory & Topology", parentCode: "TEL-L1-005", sortOrder: 3, description: null },
  { code: "TEL-L2-022", level: "L2", name: "Fault Management", parentCode: "TEL-L1-005", sortOrder: 4, description: null },
  { code: "TEL-L2-023", level: "L2", name: "Performance Management", parentCode: "TEL-L1-005", sortOrder: 5, description: null },
  // L2 — Revenue & Financial Management
  { code: "TEL-L2-024", level: "L2", name: "Mediation & Rating", parentCode: "TEL-L1-006", sortOrder: 1, description: null },
  { code: "TEL-L2-025", level: "L2", name: "Billing & Invoicing", parentCode: "TEL-L1-006", sortOrder: 2, description: null },
  { code: "TEL-L2-026", level: "L2", name: "Revenue Assurance & Fraud Management", parentCode: "TEL-L1-006", sortOrder: 3, description: null },
  { code: "TEL-L2-027", level: "L2", name: "Collections & Debt Management", parentCode: "TEL-L1-006", sortOrder: 4, description: null },
  { code: "TEL-L2-028", level: "L2", name: "Inter-Carrier Settlement", parentCode: "TEL-L1-006", sortOrder: 5, description: null },
  // L2 — Partner & Supplier Management
  { code: "TEL-L2-029", level: "L2", name: "Partner Onboarding & Contracting", parentCode: "TEL-L1-007", sortOrder: 1, description: null },
  { code: "TEL-L2-030", level: "L2", name: "Interconnect & Roaming Management", parentCode: "TEL-L1-007", sortOrder: 2, description: null },
  { code: "TEL-L2-031", level: "L2", name: "Supplier Performance Management", parentCode: "TEL-L1-007", sortOrder: 3, description: null },
  { code: "TEL-L2-032", level: "L2", name: "Partner Revenue Sharing", parentCode: "TEL-L1-007", sortOrder: 4, description: null },
  // L2 — Infrastructure & IT Management
  { code: "TEL-L2-033", level: "L2", name: "Physical Site & Facilities Management", parentCode: "TEL-L1-008", sortOrder: 1, description: null },
  { code: "TEL-L2-034", level: "L2", name: "IT Platform & Cloud Operations", parentCode: "TEL-L1-008", sortOrder: 2, description: null },
  { code: "TEL-L2-035", level: "L2", name: "Asset Lifecycle Management", parentCode: "TEL-L1-008", sortOrder: 3, description: null },
  { code: "TEL-L2-036", level: "L2", name: "Capacity & Demand Planning", parentCode: "TEL-L1-008", sortOrder: 4, description: null },
  // L2 — Digital Services & Innovation
  { code: "TEL-L2-037", level: "L2", name: "Digital Channel Management", parentCode: "TEL-L1-009", sortOrder: 1, description: null },
  { code: "TEL-L2-038", level: "L2", name: "API Gateway & Ecosystem", parentCode: "TEL-L1-009", sortOrder: 2, description: null },
  { code: "TEL-L2-039", level: "L2", name: "IoT & 5G Service Enablement", parentCode: "TEL-L1-009", sortOrder: 3, description: null },
  { code: "TEL-L2-040", level: "L2", name: "AI/ML & Advanced Analytics", parentCode: "TEL-L1-009", sortOrder: 4, description: null },
  // L2 — Workforce & Field Operations
  { code: "TEL-L2-041", level: "L2", name: "Workforce Scheduling & Dispatch", parentCode: "TEL-L1-010", sortOrder: 1, description: null },
  { code: "TEL-L2-042", level: "L2", name: "Field Service Execution", parentCode: "TEL-L1-010", sortOrder: 2, description: null },
  { code: "TEL-L2-043", level: "L2", name: "Workforce Skills & Training", parentCode: "TEL-L1-010", sortOrder: 3, description: null },
  { code: "TEL-L2-044", level: "L2", name: "Mobile Workforce Analytics", parentCode: "TEL-L1-010", sortOrder: 4, description: null },
];

const ENERGY_UTILITIES_TEMPLATE = [
  // L1
  { code: "ENU-L1-001", level: "L1", name: "Generation & Production", parentCode: null, sortOrder: 1, description: "Convert primary energy sources into electricity, gas, or treated water" },
  { code: "ENU-L1-002", level: "L1", name: "Transmission & Distribution", parentCode: null, sortOrder: 2, description: "Transport energy or water from production facilities to delivery points" },
  { code: "ENU-L1-003", level: "L1", name: "Grid Operations & System Control", parentCode: null, sortOrder: 3, description: "Real-time balancing, dispatch, and reliability of the energy/water network" },
  { code: "ENU-L1-004", level: "L1", name: "Metering & Smart Grid", parentCode: null, sortOrder: 4, description: "Capture consumption data and enable two-way grid communication" },
  { code: "ENU-L1-005", level: "L1", name: "Customer Operations", parentCode: null, sortOrder: 5, description: "Manage the full customer lifecycle from enrollment through billing" },
  { code: "ENU-L1-006", level: "L1", name: "Energy Trading & Portfolio Management", parentCode: null, sortOrder: 6, description: "Optimize procurement, hedging, and market participation" },
  { code: "ENU-L1-007", level: "L1", name: "Asset Management", parentCode: null, sortOrder: 7, description: "Maintain and optimize physical infrastructure across its lifecycle" },
  { code: "ENU-L1-008", level: "L1", name: "Regulatory Compliance & Risk", parentCode: null, sortOrder: 8, description: "Ensure adherence to NERC/CIP, environmental, rate-case, and safety regulations" },
  { code: "ENU-L1-009", level: "L1", name: "Renewable Energy & Sustainability", parentCode: null, sortOrder: 9, description: "Integrate clean energy sources and meet decarbonization targets" },
  { code: "ENU-L1-010", level: "L1", name: "Corporate & Shared Services", parentCode: null, sortOrder: 10, description: "Provide enterprise-wide support functions" },
  // L2 — Generation & Production
  { code: "ENU-L2-001", level: "L2", name: "Thermal Generation Operations", parentCode: "ENU-L1-001", sortOrder: 1, description: null },
  { code: "ENU-L2-002", level: "L2", name: "Hydroelectric & Nuclear Operations", parentCode: "ENU-L1-001", sortOrder: 2, description: null },
  { code: "ENU-L2-003", level: "L2", name: "Gas Processing & Production", parentCode: "ENU-L1-001", sortOrder: 3, description: null },
  { code: "ENU-L2-004", level: "L2", name: "Water Treatment & Purification", parentCode: "ENU-L1-001", sortOrder: 4, description: null },
  { code: "ENU-L2-005", level: "L2", name: "Plant Performance Optimization", parentCode: "ENU-L1-001", sortOrder: 5, description: null },
  // L2 — Transmission & Distribution
  { code: "ENU-L2-006", level: "L2", name: "High-Voltage Transmission Operations", parentCode: "ENU-L1-002", sortOrder: 1, description: null },
  { code: "ENU-L2-007", level: "L2", name: "Gas Pipeline Management", parentCode: "ENU-L1-002", sortOrder: 2, description: null },
  { code: "ENU-L2-008", level: "L2", name: "Water Distribution Networks", parentCode: "ENU-L1-002", sortOrder: 3, description: null },
  { code: "ENU-L2-009", level: "L2", name: "Substation & Pumping Operations", parentCode: "ENU-L1-002", sortOrder: 4, description: null },
  { code: "ENU-L2-010", level: "L2", name: "Loss & Leakage Management", parentCode: "ENU-L1-002", sortOrder: 5, description: null },
  // L2 — Grid Operations & System Control
  { code: "ENU-L2-011", level: "L2", name: "SCADA & Energy Management Systems", parentCode: "ENU-L1-003", sortOrder: 1, description: null },
  { code: "ENU-L2-012", level: "L2", name: "Load Forecasting & Dispatch", parentCode: "ENU-L1-003", sortOrder: 2, description: null },
  { code: "ENU-L2-013", level: "L2", name: "Outage Management & Restoration", parentCode: "ENU-L1-003", sortOrder: 3, description: null },
  { code: "ENU-L2-014", level: "L2", name: "Frequency & Voltage Regulation", parentCode: "ENU-L1-003", sortOrder: 4, description: null },
  { code: "ENU-L2-015", level: "L2", name: "Distributed Energy Resource Management", parentCode: "ENU-L1-003", sortOrder: 5, description: null },
  // L2 — Metering & Smart Grid
  { code: "ENU-L2-016", level: "L2", name: "Advanced Metering Infrastructure (AMI)", parentCode: "ENU-L1-004", sortOrder: 1, description: null },
  { code: "ENU-L2-017", level: "L2", name: "Meter Data Management", parentCode: "ENU-L1-004", sortOrder: 2, description: null },
  { code: "ENU-L2-018", level: "L2", name: "Demand Response Management", parentCode: "ENU-L1-004", sortOrder: 3, description: null },
  { code: "ENU-L2-019", level: "L2", name: "Smart Grid Analytics", parentCode: "ENU-L1-004", sortOrder: 4, description: null },
  // L2 — Customer Operations
  { code: "ENU-L2-020", level: "L2", name: "Customer Enrollment & Accounts", parentCode: "ENU-L1-005", sortOrder: 1, description: null },
  { code: "ENU-L2-021", level: "L2", name: "Billing & Revenue Management", parentCode: "ENU-L1-005", sortOrder: 2, description: null },
  { code: "ENU-L2-022", level: "L2", name: "Field Service & Work Orders", parentCode: "ENU-L1-005", sortOrder: 3, description: null },
  { code: "ENU-L2-023", level: "L2", name: "Customer Self-Service & Digital", parentCode: "ENU-L1-005", sortOrder: 4, description: null },
  { code: "ENU-L2-024", level: "L2", name: "Customer Programs (EE, TOU, Net Metering)", parentCode: "ENU-L1-005", sortOrder: 5, description: null },
  // L2 — Energy Trading & Portfolio Management
  { code: "ENU-L2-025", level: "L2", name: "Wholesale Market Trading", parentCode: "ENU-L1-006", sortOrder: 1, description: null },
  { code: "ENU-L2-026", level: "L2", name: "Power Purchase Agreements", parentCode: "ENU-L1-006", sortOrder: 2, description: null },
  { code: "ENU-L2-027", level: "L2", name: "Risk & Position Management", parentCode: "ENU-L1-006", sortOrder: 3, description: null },
  { code: "ENU-L2-028", level: "L2", name: "Renewable Energy Credits & Carbon Trading", parentCode: "ENU-L1-006", sortOrder: 4, description: null },
  // L2 — Asset Management
  { code: "ENU-L2-029", level: "L2", name: "Asset Registry & Configuration", parentCode: "ENU-L1-007", sortOrder: 1, description: null },
  { code: "ENU-L2-030", level: "L2", name: "Preventive & Predictive Maintenance", parentCode: "ENU-L1-007", sortOrder: 2, description: null },
  { code: "ENU-L2-031", level: "L2", name: "Capital Project & Investment Planning", parentCode: "ENU-L1-007", sortOrder: 3, description: null },
  { code: "ENU-L2-032", level: "L2", name: "Inspection & Condition Assessment", parentCode: "ENU-L1-007", sortOrder: 4, description: null },
  // L2 — Regulatory Compliance & Risk
  { code: "ENU-L2-033", level: "L2", name: "NERC CIP & Reliability Compliance", parentCode: "ENU-L1-008", sortOrder: 1, description: null },
  { code: "ENU-L2-034", level: "L2", name: "Environmental Permitting & Reporting", parentCode: "ENU-L1-008", sortOrder: 2, description: null },
  { code: "ENU-L2-035", level: "L2", name: "Rate Case & Tariff Management", parentCode: "ENU-L1-008", sortOrder: 3, description: null },
  { code: "ENU-L2-036", level: "L2", name: "Safety & Occupational Health", parentCode: "ENU-L1-008", sortOrder: 4, description: null },
  // L2 — Renewable Energy & Sustainability
  { code: "ENU-L2-037", level: "L2", name: "Solar & Wind Asset Operations", parentCode: "ENU-L1-009", sortOrder: 1, description: null },
  { code: "ENU-L2-038", level: "L2", name: "Energy Storage Management", parentCode: "ENU-L1-009", sortOrder: 2, description: null },
  { code: "ENU-L2-039", level: "L2", name: "Microgrid & Islanding Operations", parentCode: "ENU-L1-009", sortOrder: 3, description: null },
  { code: "ENU-L2-040", level: "L2", name: "Carbon Accounting & ESG Reporting", parentCode: "ENU-L1-009", sortOrder: 4, description: null },
  // L2 — Corporate & Shared Services
  { code: "ENU-L2-041", level: "L2", name: "Financial Planning & Accounting", parentCode: "ENU-L1-010", sortOrder: 1, description: null },
  { code: "ENU-L2-042", level: "L2", name: "Human Capital Management", parentCode: "ENU-L1-010", sortOrder: 2, description: null },
  { code: "ENU-L2-043", level: "L2", name: "Supply Chain & Procurement", parentCode: "ENU-L1-010", sortOrder: 3, description: null },
  { code: "ENU-L2-044", level: "L2", name: "IT & OT Cybersecurity", parentCode: "ENU-L1-010", sortOrder: 4, description: null },
  { code: "ENU-L2-045", level: "L2", name: "Enterprise Data & Analytics", parentCode: "ENU-L1-010", sortOrder: 5, description: null },
];

const PUBLIC_SECTOR_TEMPLATE = [
  // L1
  { code: "PUB-L1-001", level: "L1", name: "Citizen Services & Engagement", parentCode: null, sortOrder: 1, description: "Delivering public-facing services and managing citizen interactions across channels" },
  { code: "PUB-L1-002", level: "L1", name: "Policy & Regulatory Management", parentCode: null, sortOrder: 2, description: "Developing, enacting, and managing laws, regulations, and public policy" },
  { code: "PUB-L1-003", level: "L1", name: "Revenue & Taxation", parentCode: null, sortOrder: 3, description: "Collecting, managing, and accounting for public revenues and tax obligations" },
  { code: "PUB-L1-004", level: "L1", name: "Grants, Benefits & Transfers", parentCode: null, sortOrder: 4, description: "Administering financial assistance programs from eligibility through disbursement" },
  { code: "PUB-L1-005", level: "L1", name: "Public Safety & Justice", parentCode: null, sortOrder: 5, description: "Protecting citizens and administering the justice system" },
  { code: "PUB-L1-006", level: "L1", name: "Financial Management & Budget", parentCode: null, sortOrder: 6, description: "Planning, executing, and controlling public funds across the fiscal cycle" },
  { code: "PUB-L1-007", level: "L1", name: "Procurement & Acquisition", parentCode: null, sortOrder: 7, description: "Acquiring goods, services, and works in compliance with public procurement law" },
  { code: "PUB-L1-008", level: "L1", name: "Human Capital Management", parentCode: null, sortOrder: 8, description: "Recruiting, developing, and retaining the public-sector workforce" },
  { code: "PUB-L1-009", level: "L1", name: "Digital Government & IT", parentCode: null, sortOrder: 9, description: "Delivering technology services and enabling digital transformation" },
  { code: "PUB-L1-010", level: "L1", name: "Infrastructure, Assets & Facilities", parentCode: null, sortOrder: 10, description: "Managing public physical assets, real property, and capital infrastructure" },
  // L2 — Citizen Services & Engagement
  { code: "PUB-L2-001", level: "L2", name: "Citizen Request & Case Management", parentCode: "PUB-L1-001", sortOrder: 1, description: null },
  { code: "PUB-L2-002", level: "L2", name: "Benefits Eligibility & Enrollment", parentCode: "PUB-L1-001", sortOrder: 2, description: null },
  { code: "PUB-L2-003", level: "L2", name: "Licensing & Permitting", parentCode: "PUB-L1-001", sortOrder: 3, description: null },
  { code: "PUB-L2-004", level: "L2", name: "Omnichannel Service Delivery", parentCode: "PUB-L1-001", sortOrder: 4, description: null },
  { code: "PUB-L2-005", level: "L2", name: "Citizen Identity & Authentication", parentCode: "PUB-L1-001", sortOrder: 5, description: null },
  // L2 — Policy & Regulatory Management
  { code: "PUB-L2-006", level: "L2", name: "Legislative Drafting & Tracking", parentCode: "PUB-L1-002", sortOrder: 1, description: null },
  { code: "PUB-L2-007", level: "L2", name: "Regulatory Compliance Management", parentCode: "PUB-L1-002", sortOrder: 2, description: null },
  { code: "PUB-L2-008", level: "L2", name: "Policy Analysis & Impact Assessment", parentCode: "PUB-L1-002", sortOrder: 3, description: null },
  { code: "PUB-L2-009", level: "L2", name: "Public Comment & Consultation", parentCode: "PUB-L1-002", sortOrder: 4, description: null },
  // L2 — Revenue & Taxation
  { code: "PUB-L2-010", level: "L2", name: "Tax Assessment & Collection", parentCode: "PUB-L1-003", sortOrder: 1, description: null },
  { code: "PUB-L2-011", level: "L2", name: "Revenue Forecasting", parentCode: "PUB-L1-003", sortOrder: 2, description: null },
  { code: "PUB-L2-012", level: "L2", name: "Audit & Enforcement", parentCode: "PUB-L1-003", sortOrder: 3, description: null },
  { code: "PUB-L2-013", level: "L2", name: "Debt & Receivables Management", parentCode: "PUB-L1-003", sortOrder: 4, description: null },
  // L2 — Grants, Benefits & Transfers
  { code: "PUB-L2-014", level: "L2", name: "Grant Program Design & Solicitation", parentCode: "PUB-L1-004", sortOrder: 1, description: null },
  { code: "PUB-L2-015", level: "L2", name: "Application Intake & Eligibility", parentCode: "PUB-L1-004", sortOrder: 2, description: null },
  { code: "PUB-L2-016", level: "L2", name: "Award Management & Disbursement", parentCode: "PUB-L1-004", sortOrder: 3, description: null },
  { code: "PUB-L2-017", level: "L2", name: "Grantee Monitoring & Compliance", parentCode: "PUB-L1-004", sortOrder: 4, description: null },
  { code: "PUB-L2-018", level: "L2", name: "Benefit Fraud Detection", parentCode: "PUB-L1-004", sortOrder: 5, description: null },
  // L2 — Public Safety & Justice
  { code: "PUB-L2-019", level: "L2", name: "Law Enforcement Operations", parentCode: "PUB-L1-005", sortOrder: 1, description: null },
  { code: "PUB-L2-020", level: "L2", name: "Emergency Management & Response", parentCode: "PUB-L1-005", sortOrder: 2, description: null },
  { code: "PUB-L2-021", level: "L2", name: "Corrections & Rehabilitation", parentCode: "PUB-L1-005", sortOrder: 3, description: null },
  { code: "PUB-L2-022", level: "L2", name: "Courts & Adjudication", parentCode: "PUB-L1-005", sortOrder: 4, description: null },
  { code: "PUB-L2-023", level: "L2", name: "Intelligence & Threat Analysis", parentCode: "PUB-L1-005", sortOrder: 5, description: null },
  // L2 — Financial Management & Budget
  { code: "PUB-L2-024", level: "L2", name: "Budget Formulation & Execution", parentCode: "PUB-L1-006", sortOrder: 1, description: null },
  { code: "PUB-L2-025", level: "L2", name: "Accounting & Fund Control", parentCode: "PUB-L1-006", sortOrder: 2, description: null },
  { code: "PUB-L2-026", level: "L2", name: "Financial Reporting & Audit", parentCode: "PUB-L1-006", sortOrder: 3, description: null },
  { code: "PUB-L2-027", level: "L2", name: "Cost Management & Allocation", parentCode: "PUB-L1-006", sortOrder: 4, description: null },
  // L2 — Procurement & Acquisition
  { code: "PUB-L2-028", level: "L2", name: "Sourcing & Solicitation", parentCode: "PUB-L1-007", sortOrder: 1, description: null },
  { code: "PUB-L2-029", level: "L2", name: "Contract Management", parentCode: "PUB-L1-007", sortOrder: 2, description: null },
  { code: "PUB-L2-030", level: "L2", name: "Vendor Performance Management", parentCode: "PUB-L1-007", sortOrder: 3, description: null },
  { code: "PUB-L2-031", level: "L2", name: "Purchase-to-Pay Processing", parentCode: "PUB-L1-007", sortOrder: 4, description: null },
  // L2 — Human Capital Management
  { code: "PUB-L2-032", level: "L2", name: "Workforce Planning & Recruitment", parentCode: "PUB-L1-008", sortOrder: 1, description: null },
  { code: "PUB-L2-033", level: "L2", name: "Compensation & Benefits", parentCode: "PUB-L1-008", sortOrder: 2, description: null },
  { code: "PUB-L2-034", level: "L2", name: "Performance & Talent Management", parentCode: "PUB-L1-008", sortOrder: 3, description: null },
  { code: "PUB-L2-035", level: "L2", name: "Learning & Professional Development", parentCode: "PUB-L1-008", sortOrder: 4, description: null },
  // L2 — Digital Government & IT
  { code: "PUB-L2-036", level: "L2", name: "Enterprise Architecture & Standards", parentCode: "PUB-L1-009", sortOrder: 1, description: null },
  { code: "PUB-L2-037", level: "L2", name: "Cybersecurity & Privacy", parentCode: "PUB-L1-009", sortOrder: 2, description: null },
  { code: "PUB-L2-038", level: "L2", name: "Application Portfolio Management", parentCode: "PUB-L1-009", sortOrder: 3, description: null },
  { code: "PUB-L2-039", level: "L2", name: "Data Management & Analytics", parentCode: "PUB-L1-009", sortOrder: 4, description: null },
  { code: "PUB-L2-040", level: "L2", name: "Cloud & Infrastructure Services", parentCode: "PUB-L1-009", sortOrder: 5, description: null },
  // L2 — Infrastructure, Assets & Facilities
  { code: "PUB-L2-041", level: "L2", name: "Capital Planning & Project Delivery", parentCode: "PUB-L1-010", sortOrder: 1, description: null },
  { code: "PUB-L2-042", level: "L2", name: "Facility Operations & Maintenance", parentCode: "PUB-L1-010", sortOrder: 2, description: null },
  { code: "PUB-L2-043", level: "L2", name: "Real Property & Land Management", parentCode: "PUB-L1-010", sortOrder: 3, description: null },
  { code: "PUB-L2-044", level: "L2", name: "Fleet & Equipment Management", parentCode: "PUB-L1-010", sortOrder: 4, description: null },
];

const ENTERPRISE_BCM_TEMPLATE = [
  // ── L1 Domains ──────────────────────────────────────────────
  { code: "LIX-L1-001", level: "L1", name: "Asset Management", parentCode: null, sortOrder: 1, description: "Lifecycle management, maintenance, and performance of physical and digital assets" },
  { code: "LIX-L1-002", level: "L1", name: "Human Resources", parentCode: null, sortOrder: 2, description: "Talent acquisition, workforce management, learning, compensation, and employee experience" },
  { code: "LIX-L1-003", level: "L1", name: "Omnichannel Commerce", parentCode: null, sortOrder: 3, description: "Marketing strategy, promotions, digital storefronts, and omnichannel customer engagement" },
  { code: "LIX-L1-004", level: "L1", name: "Sales", parentCode: null, sortOrder: 4, description: "Sales planning, execution, order management, and channel performance" },
  { code: "LIX-L1-005", level: "L1", name: "Enterprise Strategy", parentCode: null, sortOrder: 5, description: "Corporate strategy, business model management, and enterprise-wide planning" },
  { code: "LIX-L1-006", level: "L1", name: "Manufacturing", parentCode: null, sortOrder: 6, description: "Production planning, shop floor execution, and manufacturing operations management" },
  { code: "LIX-L1-007", level: "L1", name: "Product Management", parentCode: null, sortOrder: 7, description: "Product portfolio, lifecycle, compliance, and information management" },
  { code: "LIX-L1-008", level: "L1", name: "Sourcing and Procurement", parentCode: null, sortOrder: 8, description: "Supplier management, purchasing, contracts, and travel and expense" },
  { code: "LIX-L1-009", level: "L1", name: "Supply Chain Planning", parentCode: null, sortOrder: 9, description: "Demand, inventory, and supply network planning" },
  { code: "LIX-L1-010", level: "L1", name: "Customer Service", parentCode: null, sortOrder: 10, description: "Customer engagement, complaints, returns, and service level management" },
  { code: "LIX-L1-011", level: "L1", name: "International Trade and Global Tax", parentCode: null, sortOrder: 11, description: "Export/import controls, trade compliance, and global tax management" },
  { code: "LIX-L1-012", level: "L1", name: "Portfolio and Project Management", parentCode: null, sortOrder: 12, description: "Portfolio governance, program management, and project delivery" },
  { code: "LIX-L1-013", level: "L1", name: "Service Delivery", parentCode: null, sortOrder: 13, description: "Service fulfillment, scheduling, partner management, and service execution" },
  { code: "LIX-L1-014", level: "L1", name: "Supply Chain Execution", parentCode: null, sortOrder: 14, description: "Inventory, transportation, warehouse management, and quality control" },
  { code: "LIX-L1-015", level: "L1", name: "Governance, Risk and Compliance", parentCode: null, sortOrder: 15, description: "Business process management, enterprise risk, cybersecurity, and regulatory compliance" },
  { code: "LIX-L1-016", level: "L1", name: "Finance", parentCode: null, sortOrder: 16, description: "Accounting, financial close, planning, treasury, real estate, and receivables" },
  { code: "LIX-L1-017", level: "L1", name: "Marketing", parentCode: null, sortOrder: 17, description: "Marketing execution, campaign management, loyalty, and lead management" },
  { code: "LIX-L1-018", level: "L1", name: "R&D / Engineering", parentCode: null, sortOrder: 18, description: "Design, ideation, product lifecycle, and engineering change management" },
  { code: "LIX-L1-019", level: "L1", name: "Supply Chain Enablement", parentCode: null, sortOrder: 19, description: "Supply chain strategy, collaboration, network design, and monitoring" },
  { code: "LIX-L1-020", level: "L1", name: "Sustainability Management", parentCode: null, sortOrder: 20, description: "Environmental footprint, ESG reporting, circular economy, and sustainable operations" },

  // ── L2: Asset Management ────────────────────────────────────
  { code: "LIX-L2-001", level: "L2", name: "Asset Review and Risk Management", parentCode: "LIX-L1-001", sortOrder: 1, description: null },
  { code: "LIX-L2-002", level: "L2", name: "Digital Asset Operations", parentCode: "LIX-L1-001", sortOrder: 2, description: null },
  { code: "LIX-L2-003", level: "L2", name: "Asset Collaboration", parentCode: "LIX-L1-001", sortOrder: 3, description: null },
  { code: "LIX-L2-004", level: "L2", name: "Asset Information Management", parentCode: "LIX-L1-001", sortOrder: 4, description: null },
  { code: "LIX-L2-005", level: "L2", name: "Asset Lifecycle Delivery", parentCode: "LIX-L1-001", sortOrder: 5, description: null },
  { code: "LIX-L2-006", level: "L2", name: "Asset Demand Management", parentCode: "LIX-L1-001", sortOrder: 6, description: null },
  { code: "LIX-L2-007", level: "L2", name: "Asset Investment Management", parentCode: "LIX-L1-001", sortOrder: 7, description: null },
  { code: "LIX-L2-008", level: "L2", name: "Asset Objectives Management", parentCode: "LIX-L1-001", sortOrder: 8, description: null },
  { code: "LIX-L2-009", level: "L2", name: "Asset Policy Management", parentCode: "LIX-L1-001", sortOrder: 9, description: null },
  { code: "LIX-L2-010", level: "L2", name: "Asset Strategy Management", parentCode: "LIX-L1-001", sortOrder: 10, description: null },
  { code: "LIX-L2-011", level: "L2", name: "Strategic Asset Management Planning", parentCode: "LIX-L1-001", sortOrder: 11, description: null },
  { code: "LIX-L2-012", level: "L2", name: "Tactical Asset Management Planning", parentCode: "LIX-L1-001", sortOrder: 12, description: null },
  { code: "LIX-L2-013", level: "L2", name: "Asset Health Monitoring", parentCode: "LIX-L1-001", sortOrder: 13, description: null },
  { code: "LIX-L2-014", level: "L2", name: "Asset Management Resource Planning", parentCode: "LIX-L1-001", sortOrder: 14, description: null },
  { code: "LIX-L2-015", level: "L2", name: "Asset Refurbishment", parentCode: "LIX-L1-001", sortOrder: 15, description: null },
  { code: "LIX-L2-016", level: "L2", name: "Asset Reliability Engineering", parentCode: "LIX-L1-001", sortOrder: 16, description: null },
  { code: "LIX-L2-017", level: "L2", name: "Maintenance Execution", parentCode: "LIX-L1-001", sortOrder: 17, description: null },
  { code: "LIX-L2-018", level: "L2", name: "Shutdown and Outage Management", parentCode: "LIX-L1-001", sortOrder: 18, description: null },
  { code: "LIX-L2-019", level: "L2", name: "Asset Fault and Incident", parentCode: "LIX-L1-001", sortOrder: 19, description: null },
  { code: "LIX-L2-020", level: "L2", name: "Asset Contingency Planning and Resilience Analysis", parentCode: "LIX-L1-001", sortOrder: 20, description: null },
  { code: "LIX-L2-021", level: "L2", name: "Asset Costing and Valuation", parentCode: "LIX-L1-001", sortOrder: 21, description: null },
  { code: "LIX-L2-022", level: "L2", name: "Asset Performance Analysis", parentCode: "LIX-L1-001", sortOrder: 22, description: null },
  { code: "LIX-L2-023", level: "L2", name: "Asset Review and Audit", parentCode: "LIX-L1-001", sortOrder: 23, description: null },
  { code: "LIX-L2-024", level: "L2", name: "Asset Risk Assessment", parentCode: "LIX-L1-001", sortOrder: 24, description: null },
  { code: "LIX-L2-025", level: "L2", name: "Asset Stakeholder Management", parentCode: "LIX-L1-001", sortOrder: 25, description: null },
  { code: "LIX-L2-026", level: "L2", name: "Digital Asset Operations Controlling", parentCode: "LIX-L1-001", sortOrder: 26, description: null },
  { code: "LIX-L2-027", level: "L2", name: "Digital Asset Performance Analysis", parentCode: "LIX-L1-001", sortOrder: 27, description: null },
  { code: "LIX-L2-028", level: "L2", name: "Digital Asset SLA Monitoring", parentCode: "LIX-L1-001", sortOrder: 28, description: null },
  { code: "LIX-L2-029", level: "L2", name: "Digital Asset Usage Analysis", parentCode: "LIX-L1-001", sortOrder: 29, description: null },
  { code: "LIX-L2-030", level: "L2", name: "Issue Resolution", parentCode: "LIX-L1-001", sortOrder: 30, description: null },
  { code: "LIX-L2-031", level: "L2", name: "Operations Expenditure Planning", parentCode: "LIX-L1-001", sortOrder: 31, description: null },

  // ── L2: Human Resources ─────────────────────────────────────
  { code: "LIX-L2-032", level: "L2", name: "HR Administration", parentCode: "LIX-L1-002", sortOrder: 1, description: null },
  { code: "LIX-L2-033", level: "L2", name: "HR Strategy and Planning", parentCode: "LIX-L1-002", sortOrder: 2, description: null },
  { code: "LIX-L2-034", level: "L2", name: "Learning Management", parentCode: "LIX-L1-002", sortOrder: 3, description: null },
  { code: "LIX-L2-035", level: "L2", name: "Organizational Structure Management", parentCode: "LIX-L1-002", sortOrder: 4, description: null },
  { code: "LIX-L2-036", level: "L2", name: "Payroll and Reimbursement", parentCode: "LIX-L1-002", sortOrder: 5, description: null },
  { code: "LIX-L2-037", level: "L2", name: "Rewarding", parentCode: "LIX-L1-002", sortOrder: 6, description: null },
  { code: "LIX-L2-038", level: "L2", name: "Talent Acquisition", parentCode: "LIX-L1-002", sortOrder: 7, description: null },
  { code: "LIX-L2-039", level: "L2", name: "Talent Management", parentCode: "LIX-L1-002", sortOrder: 8, description: null },
  { code: "LIX-L2-040", level: "L2", name: "Time Management", parentCode: "LIX-L1-002", sortOrder: 9, description: null },
  { code: "LIX-L2-041", level: "L2", name: "Workforce Experience", parentCode: "LIX-L1-002", sortOrder: 10, description: null },
  { code: "LIX-L2-042", level: "L2", name: "Identity and Access Governance", parentCode: "LIX-L1-002", sortOrder: 11, description: null },
  { code: "LIX-L2-043", level: "L2", name: "HR Analytics", parentCode: "LIX-L1-002", sortOrder: 12, description: null },
  { code: "LIX-L2-044", level: "L2", name: "HR Compliance Management", parentCode: "LIX-L1-002", sortOrder: 13, description: null },
  { code: "LIX-L2-045", level: "L2", name: "Strategic Workforce Planning", parentCode: "LIX-L1-002", sortOrder: 14, description: null },
  { code: "LIX-L2-046", level: "L2", name: "Access Governance", parentCode: "LIX-L1-002", sortOrder: 15, description: null },
  { code: "LIX-L2-047", level: "L2", name: "Authentication Management", parentCode: "LIX-L1-002", sortOrder: 16, description: null },
  { code: "LIX-L2-048", level: "L2", name: "Identity Management", parentCode: "LIX-L1-002", sortOrder: 17, description: null },
  { code: "LIX-L2-049", level: "L2", name: "Concurrent Employment Management", parentCode: "LIX-L1-002", sortOrder: 18, description: null },
  { code: "LIX-L2-050", level: "L2", name: "Employee Administration", parentCode: "LIX-L1-002", sortOrder: 19, description: null },
  { code: "LIX-L2-051", level: "L2", name: "External Worker Information Management", parentCode: "LIX-L1-002", sortOrder: 20, description: null },
  { code: "LIX-L2-052", level: "L2", name: "Global Assignment Management", parentCode: "LIX-L1-002", sortOrder: 21, description: null },
  { code: "LIX-L2-053", level: "L2", name: "Offboarding Management", parentCode: "LIX-L1-002", sortOrder: 22, description: null },
  { code: "LIX-L2-054", level: "L2", name: "Payroll Management", parentCode: "LIX-L1-002", sortOrder: 23, description: null },
  { code: "LIX-L2-055", level: "L2", name: "Reimbursement Management", parentCode: "LIX-L1-002", sortOrder: 24, description: null },
  { code: "LIX-L2-056", level: "L2", name: "Benefits Management", parentCode: "LIX-L1-002", sortOrder: 25, description: null },
  { code: "LIX-L2-057", level: "L2", name: "Compensation Management", parentCode: "LIX-L1-002", sortOrder: 26, description: null },
  { code: "LIX-L2-058", level: "L2", name: "Equity Management", parentCode: "LIX-L1-002", sortOrder: 27, description: null },
  { code: "LIX-L2-059", level: "L2", name: "Job Evaluation", parentCode: "LIX-L1-002", sortOrder: 28, description: null },
  { code: "LIX-L2-060", level: "L2", name: "Recognition Management", parentCode: "LIX-L1-002", sortOrder: 29, description: null },
  { code: "LIX-L2-061", level: "L2", name: "Candidate Experience Management", parentCode: "LIX-L1-002", sortOrder: 30, description: null },
  { code: "LIX-L2-062", level: "L2", name: "Employer Brand Management", parentCode: "LIX-L1-002", sortOrder: 31, description: null },
  { code: "LIX-L2-063", level: "L2", name: "Recruiting", parentCode: "LIX-L1-002", sortOrder: 32, description: null },
  { code: "LIX-L2-064", level: "L2", name: "Talent Sourcing", parentCode: "LIX-L1-002", sortOrder: 33, description: null },
  { code: "LIX-L2-065", level: "L2", name: "Workforce Onboarding", parentCode: "LIX-L1-002", sortOrder: 34, description: null },
  { code: "LIX-L2-066", level: "L2", name: "Career Development", parentCode: "LIX-L1-002", sortOrder: 35, description: null },
  { code: "LIX-L2-067", level: "L2", name: "Employee Goal Management", parentCode: "LIX-L1-002", sortOrder: 36, description: null },
  { code: "LIX-L2-068", level: "L2", name: "Employee Performance Management", parentCode: "LIX-L1-002", sortOrder: 37, description: null },
  { code: "LIX-L2-069", level: "L2", name: "Skills and Competencies Management", parentCode: "LIX-L1-002", sortOrder: 38, description: null },
  { code: "LIX-L2-070", level: "L2", name: "Succession Management", parentCode: "LIX-L1-002", sortOrder: 39, description: null },
  { code: "LIX-L2-071", level: "L2", name: "Talent Marketplace Management", parentCode: "LIX-L1-002", sortOrder: 40, description: null },
  { code: "LIX-L2-072", level: "L2", name: "Absence Management", parentCode: "LIX-L1-002", sortOrder: 41, description: null },
  { code: "LIX-L2-073", level: "L2", name: "Attendance Management", parentCode: "LIX-L1-002", sortOrder: 42, description: null },
  { code: "LIX-L2-074", level: "L2", name: "Rostering and Shift Optimization", parentCode: "LIX-L1-002", sortOrder: 43, description: null },
  { code: "LIX-L2-075", level: "L2", name: "Time Calculation", parentCode: "LIX-L1-002", sortOrder: 44, description: null },
  { code: "LIX-L2-076", level: "L2", name: "Time Sheet Management", parentCode: "LIX-L1-002", sortOrder: 45, description: null },
  { code: "LIX-L2-077", level: "L2", name: "Work Schedule Management", parentCode: "LIX-L1-002", sortOrder: 46, description: null },
  { code: "LIX-L2-078", level: "L2", name: "Diversity and Inclusion Cultivation", parentCode: "LIX-L1-002", sortOrder: 47, description: null },
  { code: "LIX-L2-079", level: "L2", name: "Employee Well Being Management", parentCode: "LIX-L1-002", sortOrder: 48, description: null },
  { code: "LIX-L2-080", level: "L2", name: "Workforce Engagement", parentCode: "LIX-L1-002", sortOrder: 49, description: null },

  // ── L2: Omnichannel Commerce ─────────────────────────────────
  { code: "LIX-L2-081", level: "L2", name: "Omnichannel Marketing Strategy and Planning", parentCode: "LIX-L1-003", sortOrder: 1, description: null },
  { code: "LIX-L2-082", level: "L2", name: "Price and Promotion", parentCode: "LIX-L1-003", sortOrder: 2, description: null },
  { code: "LIX-L2-083", level: "L2", name: "B2B Commerce Management", parentCode: "LIX-L1-003", sortOrder: 3, description: null },
  { code: "LIX-L2-084", level: "L2", name: "Brand Management", parentCode: "LIX-L1-003", sortOrder: 4, description: null },
  { code: "LIX-L2-085", level: "L2", name: "Commerce Platform Operations", parentCode: "LIX-L1-003", sortOrder: 5, description: null },
  { code: "LIX-L2-086", level: "L2", name: "Commerce Search and Navigation", parentCode: "LIX-L1-003", sortOrder: 6, description: null },
  { code: "LIX-L2-087", level: "L2", name: "Commerce Storefront Management", parentCode: "LIX-L1-003", sortOrder: 7, description: null },
  { code: "LIX-L2-088", level: "L2", name: "Contextual Realtime Personalization", parentCode: "LIX-L1-003", sortOrder: 8, description: null },
  { code: "LIX-L2-089", level: "L2", name: "Customer Order Collaboration", parentCode: "LIX-L1-003", sortOrder: 9, description: null },
  { code: "LIX-L2-090", level: "L2", name: "Headless Commerce Management", parentCode: "LIX-L1-003", sortOrder: 10, description: null },
  { code: "LIX-L2-091", level: "L2", name: "Marketplace Seller Onboarding", parentCode: "LIX-L1-003", sortOrder: 11, description: null },
  { code: "LIX-L2-092", level: "L2", name: "Omnichannel Content Management", parentCode: "LIX-L1-003", sortOrder: 12, description: null },
  { code: "LIX-L2-093", level: "L2", name: "Omnichannel Data Provisioning", parentCode: "LIX-L1-003", sortOrder: 13, description: null },
  { code: "LIX-L2-094", level: "L2", name: "Retail Store Backoffice Management", parentCode: "LIX-L1-003", sortOrder: 14, description: null },
  { code: "LIX-L2-095", level: "L2", name: "Social Media Management", parentCode: "LIX-L1-003", sortOrder: 15, description: null },
  { code: "LIX-L2-096", level: "L2", name: "Marketing Analytics", parentCode: "LIX-L1-003", sortOrder: 16, description: null },
  { code: "LIX-L2-097", level: "L2", name: "Marketing Planning and Budgeting", parentCode: "LIX-L1-003", sortOrder: 17, description: null },
  { code: "LIX-L2-098", level: "L2", name: "Marketing Strategy Management", parentCode: "LIX-L1-003", sortOrder: 18, description: null },
  { code: "LIX-L2-099", level: "L2", name: "Recommerce Strategy Management", parentCode: "LIX-L1-003", sortOrder: 19, description: null },
  { code: "LIX-L2-100", level: "L2", name: "Promotion Execution", parentCode: "LIX-L1-003", sortOrder: 20, description: null },
  { code: "LIX-L2-101", level: "L2", name: "Promotion Optimization", parentCode: "LIX-L1-003", sortOrder: 21, description: null },
  { code: "LIX-L2-102", level: "L2", name: "Promotion Planning", parentCode: "LIX-L1-003", sortOrder: 22, description: null },
  { code: "LIX-L2-103", level: "L2", name: "Sales Price Calculation", parentCode: "LIX-L1-003", sortOrder: 23, description: null },
  { code: "LIX-L2-104", level: "L2", name: "Sales Price Optimization", parentCode: "LIX-L1-003", sortOrder: 24, description: null },
  { code: "LIX-L2-105", level: "L2", name: "Sales Price Planning and Definition", parentCode: "LIX-L1-003", sortOrder: 25, description: null },

  // ── L2: Sales ────────────────────────────────────────────────
  { code: "LIX-L2-106", level: "L2", name: "Sales Planning and Performance", parentCode: "LIX-L1-004", sortOrder: 1, description: null },
  { code: "LIX-L2-107", level: "L2", name: "Sales Execution", parentCode: "LIX-L1-004", sortOrder: 2, description: null },
  { code: "LIX-L2-108", level: "L2", name: "Sales Partner", parentCode: "LIX-L1-004", sortOrder: 3, description: null },
  { code: "LIX-L2-109", level: "L2", name: "Customer Order and Contract Management", parentCode: "LIX-L1-004", sortOrder: 4, description: null },
  { code: "LIX-L2-110", level: "L2", name: "Channel Performance Management", parentCode: "LIX-L1-004", sortOrder: 5, description: null },
  { code: "LIX-L2-111", level: "L2", name: "Location Clustering", parentCode: "LIX-L1-004", sortOrder: 6, description: null },
  { code: "LIX-L2-112", level: "L2", name: "Merchandise Planning", parentCode: "LIX-L1-004", sortOrder: 7, description: null },
  { code: "LIX-L2-113", level: "L2", name: "Omnichannel Demand Forecasting", parentCode: "LIX-L1-004", sortOrder: 8, description: null },
  { code: "LIX-L2-114", level: "L2", name: "Pipeline Management", parentCode: "LIX-L1-004", sortOrder: 9, description: null },
  { code: "LIX-L2-115", level: "L2", name: "Quota Planning", parentCode: "LIX-L1-004", sortOrder: 10, description: null },
  { code: "LIX-L2-116", level: "L2", name: "Retail Space Management", parentCode: "LIX-L1-004", sortOrder: 11, description: null },
  { code: "LIX-L2-117", level: "L2", name: "Sales Analytics", parentCode: "LIX-L1-004", sortOrder: 12, description: null },
  { code: "LIX-L2-118", level: "L2", name: "Sales Forecasting", parentCode: "LIX-L1-004", sortOrder: 13, description: null },
  { code: "LIX-L2-119", level: "L2", name: "Territory Management", parentCode: "LIX-L1-004", sortOrder: 14, description: null },
  { code: "LIX-L2-120", level: "L2", name: "Activity and Visit Management", parentCode: "LIX-L1-004", sortOrder: 15, description: null },
  { code: "LIX-L2-121", level: "L2", name: "Cart and Checkout Management", parentCode: "LIX-L1-004", sortOrder: 16, description: null },
  { code: "LIX-L2-122", level: "L2", name: "Customer Quotation Management", parentCode: "LIX-L1-004", sortOrder: 17, description: null },
  { code: "LIX-L2-123", level: "L2", name: "Key Account Management", parentCode: "LIX-L1-004", sortOrder: 18, description: null },
  { code: "LIX-L2-124", level: "L2", name: "Opportunity Management", parentCode: "LIX-L1-004", sortOrder: 19, description: null },
  { code: "LIX-L2-125", level: "L2", name: "Point of Sale Management", parentCode: "LIX-L1-004", sortOrder: 20, description: null },
  { code: "LIX-L2-126", level: "L2", name: "Retail Execution", parentCode: "LIX-L1-004", sortOrder: 21, description: null },
  { code: "LIX-L2-127", level: "L2", name: "Sales Campaign Management", parentCode: "LIX-L1-004", sortOrder: 22, description: null },
  { code: "LIX-L2-128", level: "L2", name: "Franchise Management", parentCode: "LIX-L1-004", sortOrder: 23, description: null },
  { code: "LIX-L2-129", level: "L2", name: "Sales Partner Management", parentCode: "LIX-L1-004", sortOrder: 24, description: null },
  { code: "LIX-L2-130", level: "L2", name: "Customer Invoice Processing", parentCode: "LIX-L1-004", sortOrder: 25, description: null },
  { code: "LIX-L2-131", level: "L2", name: "Service Demand Management", parentCode: "LIX-L1-004", sortOrder: 26, description: null },
  { code: "LIX-L2-132", level: "L2", name: "Incentive and Commission", parentCode: "LIX-L1-004", sortOrder: 27, description: null },
  { code: "LIX-L2-133", level: "L2", name: "Customer Contract Monitoring", parentCode: "LIX-L1-004", sortOrder: 28, description: null },
  { code: "LIX-L2-134", level: "L2", name: "Customer Entitlement Management", parentCode: "LIX-L1-004", sortOrder: 29, description: null },
  { code: "LIX-L2-135", level: "L2", name: "Customer Order Monitoring", parentCode: "LIX-L1-004", sortOrder: 30, description: null },
  { code: "LIX-L2-136", level: "L2", name: "Distributed Order Orchestration", parentCode: "LIX-L1-004", sortOrder: 31, description: null },
  { code: "LIX-L2-137", level: "L2", name: "Grants Management", parentCode: "LIX-L1-004", sortOrder: 32, description: null },
  { code: "LIX-L2-138", level: "L2", name: "Sales Contract Management", parentCode: "LIX-L1-004", sortOrder: 33, description: null },
  { code: "LIX-L2-139", level: "L2", name: "Sales Order Management", parentCode: "LIX-L1-004", sortOrder: 34, description: null },
  { code: "LIX-L2-140", level: "L2", name: "Sales Rebate Management", parentCode: "LIX-L1-004", sortOrder: 35, description: null },

  // ── L2: Enterprise Strategy ──────────────────────────────────
  { code: "LIX-L2-141", level: "L2", name: "Strategy and Planning", parentCode: "LIX-L1-005", sortOrder: 1, description: null },
  { code: "LIX-L2-142", level: "L2", name: "Corporate Operations", parentCode: "LIX-L1-005", sortOrder: 2, description: null },
  { code: "LIX-L2-143", level: "L2", name: "Business Information Strategy Definition", parentCode: "LIX-L1-005", sortOrder: 3, description: null },
  { code: "LIX-L2-144", level: "L2", name: "Business Model Management", parentCode: "LIX-L1-005", sortOrder: 4, description: null },
  { code: "LIX-L2-145", level: "L2", name: "Compensatory Planning", parentCode: "LIX-L1-005", sortOrder: 5, description: null },
  { code: "LIX-L2-146", level: "L2", name: "Connected Planning", parentCode: "LIX-L1-005", sortOrder: 6, description: null },
  { code: "LIX-L2-147", level: "L2", name: "Corporate Brand Strategy Management", parentCode: "LIX-L1-005", sortOrder: 7, description: null },
  { code: "LIX-L2-148", level: "L2", name: "Enterprise Architecture Management", parentCode: "LIX-L1-005", sortOrder: 8, description: null },
  { code: "LIX-L2-149", level: "L2", name: "Enterprise Goal Planning", parentCode: "LIX-L1-005", sortOrder: 9, description: null },
  { code: "LIX-L2-150", level: "L2", name: "IT Strategy Definition", parentCode: "LIX-L1-005", sortOrder: 10, description: null },
  { code: "LIX-L2-151", level: "L2", name: "Operating Model Definition", parentCode: "LIX-L1-005", sortOrder: 11, description: null },
  { code: "LIX-L2-152", level: "L2", name: "Organization Strategy and Design", parentCode: "LIX-L1-005", sortOrder: 12, description: null },
  { code: "LIX-L2-153", level: "L2", name: "Finance Central Operations", parentCode: "LIX-L1-005", sortOrder: 13, description: null },
  { code: "LIX-L2-154", level: "L2", name: "HR Central Operations", parentCode: "LIX-L1-005", sortOrder: 14, description: null },
  { code: "LIX-L2-155", level: "L2", name: "Manufacturing Central Operations", parentCode: "LIX-L1-005", sortOrder: 15, description: null },
  { code: "LIX-L2-156", level: "L2", name: "R&D Central Operations", parentCode: "LIX-L1-005", sortOrder: 16, description: null },
  { code: "LIX-L2-157", level: "L2", name: "Shared Services Enablement", parentCode: "LIX-L1-005", sortOrder: 17, description: null },
  { code: "LIX-L2-158", level: "L2", name: "Customer Order Central Operations", parentCode: "LIX-L1-005", sortOrder: 18, description: null },
  { code: "LIX-L2-159", level: "L2", name: "Supply Chain Central Operations", parentCode: "LIX-L1-005", sortOrder: 19, description: null },

  // ── L2: Manufacturing ────────────────────────────────────────
  { code: "LIX-L2-160", level: "L2", name: "Manufacturing Strategy", parentCode: "LIX-L1-006", sortOrder: 1, description: null },
  { code: "LIX-L2-161", level: "L2", name: "Production Planning and Scheduling", parentCode: "LIX-L1-006", sortOrder: 2, description: null },
  { code: "LIX-L2-162", level: "L2", name: "Production Operations of Intangible Products", parentCode: "LIX-L1-006", sortOrder: 3, description: null },
  { code: "LIX-L2-163", level: "L2", name: "Operations Management", parentCode: "LIX-L1-006", sortOrder: 4, description: null },
  { code: "LIX-L2-164", level: "L2", name: "Manufacturing Analytics", parentCode: "LIX-L1-006", sortOrder: 5, description: null },
  { code: "LIX-L2-165", level: "L2", name: "Plant Operations Monitoring", parentCode: "LIX-L1-006", sortOrder: 6, description: null },
  { code: "LIX-L2-166", level: "L2", name: "Plant Performance Management", parentCode: "LIX-L1-006", sortOrder: 7, description: null },
  { code: "LIX-L2-167", level: "L2", name: "Manufacturing Strategy Management", parentCode: "LIX-L1-006", sortOrder: 8, description: null },
  { code: "LIX-L2-168", level: "L2", name: "Manufacturing BOM Management", parentCode: "LIX-L1-006", sortOrder: 9, description: null },
  { code: "LIX-L2-169", level: "L2", name: "Manufacturing Definition", parentCode: "LIX-L1-006", sortOrder: 10, description: null },
  { code: "LIX-L2-170", level: "L2", name: "Manufacturing Equipment and Resource Management", parentCode: "LIX-L1-006", sortOrder: 11, description: null },
  { code: "LIX-L2-171", level: "L2", name: "Manufacturing Operations Scheduling and Dispatching", parentCode: "LIX-L1-006", sortOrder: 12, description: null },
  { code: "LIX-L2-172", level: "L2", name: "Cost Center-based Production", parentCode: "LIX-L1-006", sortOrder: 13, description: null },
  { code: "LIX-L2-173", level: "L2", name: "JIT/JIS Customer Supply Management", parentCode: "LIX-L1-006", sortOrder: 14, description: null },
  { code: "LIX-L2-174", level: "L2", name: "JIT/JIS Production Supply Management", parentCode: "LIX-L1-006", sortOrder: 15, description: null },
  { code: "LIX-L2-175", level: "L2", name: "Joint Production", parentCode: "LIX-L1-006", sortOrder: 16, description: null },
  { code: "LIX-L2-176", level: "L2", name: "Kanban Material Flow Control", parentCode: "LIX-L1-006", sortOrder: 17, description: null },
  { code: "LIX-L2-177", level: "L2", name: "Manufacturing Automation", parentCode: "LIX-L1-006", sortOrder: 18, description: null },
  { code: "LIX-L2-178", level: "L2", name: "Manufacturing Data Collection", parentCode: "LIX-L1-006", sortOrder: 19, description: null },
  { code: "LIX-L2-179", level: "L2", name: "Manufacturing Execution", parentCode: "LIX-L1-006", sortOrder: 20, description: null },
  { code: "LIX-L2-180", level: "L2", name: "Process Order Management", parentCode: "LIX-L1-006", sortOrder: 21, description: null },
  { code: "LIX-L2-181", level: "L2", name: "Production Component Backflushing", parentCode: "LIX-L1-006", sortOrder: 22, description: null },
  { code: "LIX-L2-182", level: "L2", name: "Production Component Consumption", parentCode: "LIX-L1-006", sortOrder: 23, description: null },
  { code: "LIX-L2-183", level: "L2", name: "Production Order Management", parentCode: "LIX-L1-006", sortOrder: 24, description: null },
  { code: "LIX-L2-184", level: "L2", name: "Production Plan Management", parentCode: "LIX-L1-006", sortOrder: 25, description: null },
  { code: "LIX-L2-185", level: "L2", name: "Manufacturing Process Management", parentCode: "LIX-L1-006", sortOrder: 26, description: null },

  // ── L2: Product Management ───────────────────────────────────
  { code: "LIX-L2-186", level: "L2", name: "Development", parentCode: "LIX-L1-007", sortOrder: 1, description: null },
  { code: "LIX-L2-187", level: "L2", name: "Portfolio Management", parentCode: "LIX-L1-007", sortOrder: 2, description: null },
  { code: "LIX-L2-188", level: "L2", name: "Production Management", parentCode: "LIX-L1-007", sortOrder: 3, description: null },
  { code: "LIX-L2-189", level: "L2", name: "Requirements", parentCode: "LIX-L1-007", sortOrder: 4, description: null },
  { code: "LIX-L2-190", level: "L2", name: "Product Compliance", parentCode: "LIX-L1-007", sortOrder: 5, description: null },
  { code: "LIX-L2-191", level: "L2", name: "Product Information", parentCode: "LIX-L1-007", sortOrder: 6, description: null },
  { code: "LIX-L2-192", level: "L2", name: "Product Catalog Management", parentCode: "LIX-L1-007", sortOrder: 7, description: null },
  { code: "LIX-L2-193", level: "L2", name: "Product Content Management", parentCode: "LIX-L1-007", sortOrder: 8, description: null },
  { code: "LIX-L2-194", level: "L2", name: "Product Data Onboarding", parentCode: "LIX-L1-007", sortOrder: 9, description: null },
  { code: "LIX-L2-195", level: "L2", name: "Product Data Syndication", parentCode: "LIX-L1-007", sortOrder: 10, description: null },
  { code: "LIX-L2-196", level: "L2", name: "Market Research Management", parentCode: "LIX-L1-007", sortOrder: 11, description: null },
  { code: "LIX-L2-197", level: "L2", name: "Product / Service Portfolio Analytics", parentCode: "LIX-L1-007", sortOrder: 12, description: null },
  { code: "LIX-L2-198", level: "L2", name: "Product / Service Portfolio Planning", parentCode: "LIX-L1-007", sortOrder: 13, description: null },
  { code: "LIX-L2-199", level: "L2", name: "Product / Service Strategy Management", parentCode: "LIX-L1-007", sortOrder: 14, description: null },
  { code: "LIX-L2-200", level: "L2", name: "Trend Scouting", parentCode: "LIX-L1-007", sortOrder: 15, description: null },
  { code: "LIX-L2-201", level: "L2", name: "Trials Management", parentCode: "LIX-L1-007", sortOrder: 16, description: null },
  { code: "LIX-L2-202", level: "L2", name: "Bill of Materials Management", parentCode: "LIX-L1-007", sortOrder: 17, description: null },
  { code: "LIX-L2-203", level: "L2", name: "Bill of Services Management", parentCode: "LIX-L1-007", sortOrder: 18, description: null },
  { code: "LIX-L2-204", level: "L2", name: "Computer Aided Design and Engineering", parentCode: "LIX-L1-007", sortOrder: 19, description: null },
  { code: "LIX-L2-205", level: "L2", name: "Computer Aided Manufacturing", parentCode: "LIX-L1-007", sortOrder: 20, description: null },
  { code: "LIX-L2-206", level: "L2", name: "Manufacturing Handover Management", parentCode: "LIX-L1-007", sortOrder: 21, description: null },
  { code: "LIX-L2-207", level: "L2", name: "Product Packaging Management", parentCode: "LIX-L1-007", sortOrder: 22, description: null },
  { code: "LIX-L2-208", level: "L2", name: "Compliance Document Management", parentCode: "LIX-L1-007", sortOrder: 23, description: null },
  { code: "LIX-L2-209", level: "L2", name: "Dangerous Goods Management", parentCode: "LIX-L1-007", sortOrder: 24, description: null },
  { code: "LIX-L2-210", level: "L2", name: "Requirements Management", parentCode: "LIX-L1-007", sortOrder: 25, description: null },
  { code: "LIX-L2-211", level: "L2", name: "Product Marketability and Component Compliance Management", parentCode: "LIX-L1-007", sortOrder: 26, description: null },
  { code: "LIX-L2-212", level: "L2", name: "Product / Service Data Management", parentCode: "LIX-L1-007", sortOrder: 27, description: null },
  { code: "LIX-L2-213", level: "L2", name: "Product / Service Lifecycle Analytics", parentCode: "LIX-L1-007", sortOrder: 28, description: null },
  { code: "LIX-L2-214", level: "L2", name: "Product Classification", parentCode: "LIX-L1-007", sortOrder: 29, description: null },
  { code: "LIX-L2-215", level: "L2", name: "Service Design Management", parentCode: "LIX-L1-007", sortOrder: 30, description: null },
  { code: "LIX-L2-216", level: "L2", name: "Specification Management", parentCode: "LIX-L1-007", sortOrder: 31, description: null },

  // ── L2: Sourcing and Procurement ─────────────────────────────
  { code: "LIX-L2-217", level: "L2", name: "Procurement", parentCode: "LIX-L1-008", sortOrder: 1, description: null },
  { code: "LIX-L2-218", level: "L2", name: "Procurement Contract", parentCode: "LIX-L1-008", sortOrder: 2, description: null },
  { code: "LIX-L2-219", level: "L2", name: "Sourcing", parentCode: "LIX-L1-008", sortOrder: 3, description: null },
  { code: "LIX-L2-220", level: "L2", name: "Supplier Claims and Returns Management", parentCode: "LIX-L1-008", sortOrder: 4, description: null },
  { code: "LIX-L2-221", level: "L2", name: "Supplier Invoice", parentCode: "LIX-L1-008", sortOrder: 5, description: null },
  { code: "LIX-L2-222", level: "L2", name: "Supplier Management", parentCode: "LIX-L1-008", sortOrder: 6, description: null },
  { code: "LIX-L2-223", level: "L2", name: "Travel and Expense", parentCode: "LIX-L1-008", sortOrder: 7, description: null },
  { code: "LIX-L2-224", level: "L2", name: "Procurement Planning and Analytics", parentCode: "LIX-L1-008", sortOrder: 8, description: null },
  { code: "LIX-L2-225", level: "L2", name: "Operational Procurement", parentCode: "LIX-L1-008", sortOrder: 9, description: null },
  { code: "LIX-L2-226", level: "L2", name: "Procurement Contract Collaboration", parentCode: "LIX-L1-008", sortOrder: 10, description: null },
  { code: "LIX-L2-227", level: "L2", name: "Purchase Order Collaboration", parentCode: "LIX-L1-008", sortOrder: 11, description: null },
  { code: "LIX-L2-228", level: "L2", name: "Sourcing Collaboration", parentCode: "LIX-L1-008", sortOrder: 12, description: null },
  { code: "LIX-L2-229", level: "L2", name: "Supplier Invoice Collaboration", parentCode: "LIX-L1-008", sortOrder: 13, description: null },
  { code: "LIX-L2-230", level: "L2", name: "Supplier Platform Operation", parentCode: "LIX-L1-008", sortOrder: 14, description: null },
  { code: "LIX-L2-231", level: "L2", name: "Purchase Price Management", parentCode: "LIX-L1-008", sortOrder: 15, description: null },
  { code: "LIX-L2-232", level: "L2", name: "Purchasing Rebate Management", parentCode: "LIX-L1-008", sortOrder: 16, description: null },
  { code: "LIX-L2-233", level: "L2", name: "Supplier Negotiation Management", parentCode: "LIX-L1-008", sortOrder: 17, description: null },
  { code: "LIX-L2-234", level: "L2", name: "Central Supplier RFX Preparation", parentCode: "LIX-L1-008", sortOrder: 18, description: null },
  { code: "LIX-L2-235", level: "L2", name: "Sources of Supply Management", parentCode: "LIX-L1-008", sortOrder: 19, description: null },
  { code: "LIX-L2-236", level: "L2", name: "Supplier Awarding", parentCode: "LIX-L1-008", sortOrder: 20, description: null },
  { code: "LIX-L2-237", level: "L2", name: "Supplier Proposal Evaluation", parentCode: "LIX-L1-008", sortOrder: 21, description: null },
  { code: "LIX-L2-238", level: "L2", name: "Supplier RFX Execution", parentCode: "LIX-L1-008", sortOrder: 22, description: null },
  { code: "LIX-L2-239", level: "L2", name: "Supplier RFX Preparation", parentCode: "LIX-L1-008", sortOrder: 23, description: null },
  { code: "LIX-L2-240", level: "L2", name: "Supplier Recovery Claims Management", parentCode: "LIX-L1-008", sortOrder: 24, description: null },
  { code: "LIX-L2-241", level: "L2", name: "Supplier Returns Management", parentCode: "LIX-L1-008", sortOrder: 25, description: null },
  { code: "LIX-L2-242", level: "L2", name: "Supplier Warranty Claims Management", parentCode: "LIX-L1-008", sortOrder: 26, description: null },
  { code: "LIX-L2-243", level: "L2", name: "Trade-in Returns Management", parentCode: "LIX-L1-008", sortOrder: 27, description: null },
  { code: "LIX-L2-244", level: "L2", name: "Evaluated Receipt Settlement", parentCode: "LIX-L1-008", sortOrder: 28, description: null },
  { code: "LIX-L2-245", level: "L2", name: "Supplier Catalog Management", parentCode: "LIX-L1-008", sortOrder: 29, description: null },
  { code: "LIX-L2-246", level: "L2", name: "Supplier Invoice Processing", parentCode: "LIX-L1-008", sortOrder: 30, description: null },
  { code: "LIX-L2-247", level: "L2", name: "Supplier Invoice Receipt Management", parentCode: "LIX-L1-008", sortOrder: 31, description: null },
  { code: "LIX-L2-248", level: "L2", name: "Supplier Data Management", parentCode: "LIX-L1-008", sortOrder: 32, description: null },
  { code: "LIX-L2-249", level: "L2", name: "Supplier Discovery Management", parentCode: "LIX-L1-008", sortOrder: 33, description: null },
  { code: "LIX-L2-250", level: "L2", name: "Supplier Onboarding", parentCode: "LIX-L1-008", sortOrder: 34, description: null },
  { code: "LIX-L2-251", level: "L2", name: "Supplier Performance Management", parentCode: "LIX-L1-008", sortOrder: 35, description: null },
  { code: "LIX-L2-252", level: "L2", name: "Supplier Risk Management", parentCode: "LIX-L1-008", sortOrder: 36, description: null },
  { code: "LIX-L2-253", level: "L2", name: "Advance Management", parentCode: "LIX-L1-008", sortOrder: 37, description: null },
  { code: "LIX-L2-254", level: "L2", name: "Corporate Card Management", parentCode: "LIX-L1-008", sortOrder: 38, description: null },
  { code: "LIX-L2-255", level: "L2", name: "Expense Reporting", parentCode: "LIX-L1-008", sortOrder: 39, description: null },
  { code: "LIX-L2-256", level: "L2", name: "Travel Booking Management", parentCode: "LIX-L1-008", sortOrder: 40, description: null },
  { code: "LIX-L2-257", level: "L2", name: "Travel Network Management", parentCode: "LIX-L1-008", sortOrder: 41, description: null },
  { code: "LIX-L2-258", level: "L2", name: "Travel Risk and Security Management", parentCode: "LIX-L1-008", sortOrder: 42, description: null },
  { code: "LIX-L2-259", level: "L2", name: "Central Procurement Analytics", parentCode: "LIX-L1-008", sortOrder: 43, description: null },
  { code: "LIX-L2-260", level: "L2", name: "Procurement Analytics", parentCode: "LIX-L1-008", sortOrder: 44, description: null },
  { code: "LIX-L2-261", level: "L2", name: "Procurement Strategy Management", parentCode: "LIX-L1-008", sortOrder: 45, description: null },
  { code: "LIX-L2-262", level: "L2", name: "Sourcing Planning and Scheduling", parentCode: "LIX-L1-008", sortOrder: 46, description: null },
  { code: "LIX-L2-263", level: "L2", name: "Spend Visibility", parentCode: "LIX-L1-008", sortOrder: 47, description: null },

  // ── L2: Supply Chain Planning ────────────────────────────────
  { code: "LIX-L2-264", level: "L2", name: "Demand Planning", parentCode: "LIX-L1-009", sortOrder: 1, description: null },
  { code: "LIX-L2-265", level: "L2", name: "Inventory Planning", parentCode: "LIX-L1-009", sortOrder: 2, description: null },
  { code: "LIX-L2-266", level: "L2", name: "Sales and Operations Planning", parentCode: "LIX-L1-009", sortOrder: 3, description: null },
  { code: "LIX-L2-267", level: "L2", name: "Supply Planning", parentCode: "LIX-L1-009", sortOrder: 4, description: null },
  { code: "LIX-L2-268", level: "L2", name: "Demand Driven MRP", parentCode: "LIX-L1-009", sortOrder: 5, description: null },
  { code: "LIX-L2-269", level: "L2", name: "Multi-factor Planning and Scheduling", parentCode: "LIX-L1-009", sortOrder: 6, description: null },
  { code: "LIX-L2-270", level: "L2", name: "Multi-Level Allocation Planning", parentCode: "LIX-L1-009", sortOrder: 7, description: null },
  { code: "LIX-L2-271", level: "L2", name: "Multi-Level Replenishment Planning", parentCode: "LIX-L1-009", sortOrder: 8, description: null },
  { code: "LIX-L2-272", level: "L2", name: "Resource Capacity Planning", parentCode: "LIX-L1-009", sortOrder: 9, description: null },
  { code: "LIX-L2-273", level: "L2", name: "Supply Network Planning", parentCode: "LIX-L1-009", sortOrder: 10, description: null },
  { code: "LIX-L2-274", level: "L2", name: "Vendor Managed Inventory Planning", parentCode: "LIX-L1-009", sortOrder: 11, description: null },
  { code: "LIX-L2-275", level: "L2", name: "Inventory Policy Management", parentCode: "LIX-L1-009", sortOrder: 12, description: null },
  { code: "LIX-L2-276", level: "L2", name: "Multi-Echelon Inventory Optimization", parentCode: "LIX-L1-009", sortOrder: 13, description: null },
  { code: "LIX-L2-277", level: "L2", name: "Characteristics-based Planning", parentCode: "LIX-L1-009", sortOrder: 14, description: null },
  { code: "LIX-L2-278", level: "L2", name: "Consensus Demand Management", parentCode: "LIX-L1-009", sortOrder: 15, description: null },
  { code: "LIX-L2-279", level: "L2", name: "Demand Forecasting", parentCode: "LIX-L1-009", sortOrder: 16, description: null },
  { code: "LIX-L2-280", level: "L2", name: "Multi-Level Demand Planning", parentCode: "LIX-L1-009", sortOrder: 17, description: null },
  { code: "LIX-L2-281", level: "L2", name: "S&OP Demand and Supply Balancing", parentCode: "LIX-L1-009", sortOrder: 18, description: null },
  { code: "LIX-L2-282", level: "L2", name: "S&OP Financial Alignment", parentCode: "LIX-L1-009", sortOrder: 19, description: null },
  { code: "LIX-L2-283", level: "L2", name: "S&OP Process Management", parentCode: "LIX-L1-009", sortOrder: 20, description: null },
  { code: "LIX-L2-284", level: "L2", name: "Distribution Planning", parentCode: "LIX-L1-009", sortOrder: 21, description: null },
  { code: "LIX-L2-285", level: "L2", name: "Supplier Qualification", parentCode: "LIX-L1-009", sortOrder: 22, description: null },

  // ── L2: Customer Service ─────────────────────────────────────
  { code: "LIX-L2-286", level: "L2", name: "Customer Service Analytics", parentCode: "LIX-L1-010", sortOrder: 1, description: null },
  { code: "LIX-L2-287", level: "L2", name: "Customer Service Strategy Management", parentCode: "LIX-L1-010", sortOrder: 2, description: null },
  { code: "LIX-L2-288", level: "L2", name: "Customer Service Planning and Forecasting", parentCode: "LIX-L1-010", sortOrder: 3, description: null },
  { code: "LIX-L2-289", level: "L2", name: "Complaints Management", parentCode: "LIX-L1-010", sortOrder: 4, description: null },
  { code: "LIX-L2-290", level: "L2", name: "Customer Claims Management", parentCode: "LIX-L1-010", sortOrder: 5, description: null },
  { code: "LIX-L2-291", level: "L2", name: "Customer Returns Management", parentCode: "LIX-L1-010", sortOrder: 6, description: null },
  { code: "LIX-L2-292", level: "L2", name: "Customer Warranty Claim Processing", parentCode: "LIX-L1-010", sortOrder: 7, description: null },
  { code: "LIX-L2-293", level: "L2", name: "Inquiry Management", parentCode: "LIX-L1-010", sortOrder: 8, description: null },
  { code: "LIX-L2-294", level: "L2", name: "Omnichannel Customer Engagement", parentCode: "LIX-L1-010", sortOrder: 9, description: null },
  { code: "LIX-L2-295", level: "L2", name: "Recall Management", parentCode: "LIX-L1-010", sortOrder: 10, description: null },
  { code: "LIX-L2-296", level: "L2", name: "Self-Service Engagement", parentCode: "LIX-L1-010", sortOrder: 11, description: null },
  { code: "LIX-L2-297", level: "L2", name: "Service Knowledge Base Management", parentCode: "LIX-L1-010", sortOrder: 12, description: null },
  { code: "LIX-L2-298", level: "L2", name: "Service Level Management", parentCode: "LIX-L1-010", sortOrder: 13, description: null },
  { code: "LIX-L2-299", level: "L2", name: "Service Request Management", parentCode: "LIX-L1-010", sortOrder: 14, description: null },
  { code: "LIX-L2-300", level: "L2", name: "Customer Access Management", parentCode: "LIX-L1-010", sortOrder: 15, description: null },
  { code: "LIX-L2-301", level: "L2", name: "Customer Consent Management", parentCode: "LIX-L1-010", sortOrder: 16, description: null },
  { code: "LIX-L2-302", level: "L2", name: "Customer Data Analytics", parentCode: "LIX-L1-010", sortOrder: 17, description: null },
  { code: "LIX-L2-303", level: "L2", name: "Customer Data Collection", parentCode: "LIX-L1-010", sortOrder: 18, description: null },
  { code: "LIX-L2-304", level: "L2", name: "Customer Experience Management", parentCode: "LIX-L1-010", sortOrder: 19, description: null },
  { code: "LIX-L2-305", level: "L2", name: "Customer Identity Management", parentCode: "LIX-L1-010", sortOrder: 20, description: null },
  { code: "LIX-L2-306", level: "L2", name: "Customer Journey Orchestration", parentCode: "LIX-L1-010", sortOrder: 21, description: null },
  { code: "LIX-L2-307", level: "L2", name: "Customer Master Data Management", parentCode: "LIX-L1-010", sortOrder: 22, description: null },
  { code: "LIX-L2-308", level: "L2", name: "Customer Preference Management", parentCode: "LIX-L1-010", sortOrder: 23, description: null },
  { code: "LIX-L2-309", level: "L2", name: "Customer Profile Management", parentCode: "LIX-L1-010", sortOrder: 24, description: null },

  // ── L2: International Trade and Global Tax ───────────────────
  { code: "LIX-L2-310", level: "L2", name: "Global Trade Management", parentCode: "LIX-L1-011", sortOrder: 1, description: null },
  { code: "LIX-L2-311", level: "L2", name: "Tax Management", parentCode: "LIX-L1-011", sortOrder: 2, description: null },
  { code: "LIX-L2-312", level: "L2", name: "Export Management and Control", parentCode: "LIX-L1-011", sortOrder: 3, description: null },
  { code: "LIX-L2-313", level: "L2", name: "Import Management and Control", parentCode: "LIX-L1-011", sortOrder: 4, description: null },
  { code: "LIX-L2-314", level: "L2", name: "Preference Management", parentCode: "LIX-L1-011", sortOrder: 5, description: null },
  { code: "LIX-L2-315", level: "L2", name: "Document and Reporting Compliance", parentCode: "LIX-L1-011", sortOrder: 6, description: null },
  { code: "LIX-L2-316", level: "L2", name: "Excise Tax Management", parentCode: "LIX-L1-011", sortOrder: 7, description: null },
  { code: "LIX-L2-317", level: "L2", name: "Tax Classification", parentCode: "LIX-L1-011", sortOrder: 8, description: null },
  { code: "LIX-L2-318", level: "L2", name: "Tax Control Management", parentCode: "LIX-L1-011", sortOrder: 9, description: null },
  { code: "LIX-L2-319", level: "L2", name: "Tax Determination and Calculation", parentCode: "LIX-L1-011", sortOrder: 10, description: null },
  { code: "LIX-L2-320", level: "L2", name: "Tax Operations", parentCode: "LIX-L1-011", sortOrder: 11, description: null },
  { code: "LIX-L2-321", level: "L2", name: "Tax Settlement", parentCode: "LIX-L1-011", sortOrder: 12, description: null },

  // ── L2: Portfolio and Project Management ─────────────────────
  { code: "LIX-L2-322", level: "L2", name: "Portfolio and Program Management", parentCode: "LIX-L1-012", sortOrder: 1, description: null },
  { code: "LIX-L2-323", level: "L2", name: "Project Management", parentCode: "LIX-L1-012", sortOrder: 2, description: null },
  { code: "LIX-L2-324", level: "L2", name: "Portfolio Analytics", parentCode: "LIX-L1-012", sortOrder: 3, description: null },
  { code: "LIX-L2-325", level: "L2", name: "Portfolio Definition", parentCode: "LIX-L1-012", sortOrder: 4, description: null },
  { code: "LIX-L2-326", level: "L2", name: "Portfolio Governance", parentCode: "LIX-L1-012", sortOrder: 5, description: null },
  { code: "LIX-L2-327", level: "L2", name: "Portfolio Planning", parentCode: "LIX-L1-012", sortOrder: 6, description: null },
  { code: "LIX-L2-328", level: "L2", name: "Portfolio Review and Balancing", parentCode: "LIX-L1-012", sortOrder: 7, description: null },
  { code: "LIX-L2-329", level: "L2", name: "Program Management", parentCode: "LIX-L1-012", sortOrder: 8, description: null },
  { code: "LIX-L2-330", level: "L2", name: "Project Proposal Management", parentCode: "LIX-L1-012", sortOrder: 9, description: null },
  { code: "LIX-L2-331", level: "L2", name: "Multi-Project Management", parentCode: "LIX-L1-012", sortOrder: 10, description: null },
  { code: "LIX-L2-332", level: "L2", name: "Project Analytics", parentCode: "LIX-L1-012", sortOrder: 11, description: null },
  { code: "LIX-L2-333", level: "L2", name: "Project Billing Preparation", parentCode: "LIX-L1-012", sortOrder: 12, description: null },
  { code: "LIX-L2-334", level: "L2", name: "Project Change Management", parentCode: "LIX-L1-012", sortOrder: 13, description: null },
  { code: "LIX-L2-335", level: "L2", name: "Project Collaboration", parentCode: "LIX-L1-012", sortOrder: 14, description: null },
  { code: "LIX-L2-336", level: "L2", name: "Project Cost Planning and Forecasting", parentCode: "LIX-L1-012", sortOrder: 15, description: null },
  { code: "LIX-L2-337", level: "L2", name: "Project Issue Management", parentCode: "LIX-L1-012", sortOrder: 16, description: null },
  { code: "LIX-L2-338", level: "L2", name: "Project Procurement", parentCode: "LIX-L1-012", sortOrder: 17, description: null },
  { code: "LIX-L2-339", level: "L2", name: "Project Resource Management", parentCode: "LIX-L1-012", sortOrder: 18, description: null },
  { code: "LIX-L2-340", level: "L2", name: "Project Risk Management", parentCode: "LIX-L1-012", sortOrder: 19, description: null },
  { code: "LIX-L2-341", level: "L2", name: "Project Schedule Management", parentCode: "LIX-L1-012", sortOrder: 20, description: null },
  { code: "LIX-L2-342", level: "L2", name: "Project Revenue Planning and Forecasting", parentCode: "LIX-L1-012", sortOrder: 21, description: null },
  { code: "LIX-L2-343", level: "L2", name: "Project Scope and Structure Management", parentCode: "LIX-L1-012", sortOrder: 22, description: null },
  { code: "LIX-L2-344", level: "L2", name: "Project Task and Deliverables Management", parentCode: "LIX-L1-012", sortOrder: 23, description: null },

  // ── L2: Service Delivery ─────────────────────────────────────
  { code: "LIX-L2-345", level: "L2", name: "Service Fulfillment", parentCode: "LIX-L1-013", sortOrder: 1, description: null },
  { code: "LIX-L2-346", level: "L2", name: "Service Partner", parentCode: "LIX-L1-013", sortOrder: 2, description: null },
  { code: "LIX-L2-347", level: "L2", name: "Service Planning and Scheduling", parentCode: "LIX-L1-013", sortOrder: 3, description: null },
  { code: "LIX-L2-348", level: "L2", name: "Service Fulfillment Master", parentCode: "LIX-L1-013", sortOrder: 4, description: null },
  { code: "LIX-L2-349", level: "L2", name: "Service Fulfillment Analytics", parentCode: "LIX-L1-013", sortOrder: 5, description: null },
  { code: "LIX-L2-350", level: "L2", name: "Service Fulfillment Monitoring", parentCode: "LIX-L1-013", sortOrder: 6, description: null },
  { code: "LIX-L2-351", level: "L2", name: "Service Scheduling and Dispatching", parentCode: "LIX-L1-013", sortOrder: 7, description: null },
  { code: "LIX-L2-352", level: "L2", name: "Service Task Planning", parentCode: "LIX-L1-013", sortOrder: 8, description: null },
  { code: "LIX-L2-353", level: "L2", name: "Proof of Service Management", parentCode: "LIX-L1-013", sortOrder: 9, description: null },
  { code: "LIX-L2-354", level: "L2", name: "Service Entry Sheet Processing", parentCode: "LIX-L1-013", sortOrder: 10, description: null },
  { code: "LIX-L2-355", level: "L2", name: "Service Partner Collaboration", parentCode: "LIX-L1-013", sortOrder: 11, description: null },
  { code: "LIX-L2-356", level: "L2", name: "Service Partner Onboarding", parentCode: "LIX-L1-013", sortOrder: 12, description: null },
  { code: "LIX-L2-357", level: "L2", name: "Billing Content Management", parentCode: "LIX-L1-013", sortOrder: 13, description: null },
  { code: "LIX-L2-358", level: "L2", name: "Service Business Planning", parentCode: "LIX-L1-013", sortOrder: 14, description: null },
  { code: "LIX-L2-359", level: "L2", name: "Service Billing Preparation", parentCode: "LIX-L1-013", sortOrder: 15, description: null },
  { code: "LIX-L2-360", level: "L2", name: "Service Closure", parentCode: "LIX-L1-013", sortOrder: 16, description: null },
  { code: "LIX-L2-361", level: "L2", name: "Service Confirmation", parentCode: "LIX-L1-013", sortOrder: 17, description: null },
  { code: "LIX-L2-362", level: "L2", name: "Service Consumption Measurement", parentCode: "LIX-L1-013", sortOrder: 18, description: null },
  { code: "LIX-L2-363", level: "L2", name: "Service Execution", parentCode: "LIX-L1-013", sortOrder: 19, description: null },
  { code: "LIX-L2-364", level: "L2", name: "Service Contract Management", parentCode: "LIX-L1-013", sortOrder: 20, description: null },
  { code: "LIX-L2-365", level: "L2", name: "Service Order Management", parentCode: "LIX-L1-013", sortOrder: 21, description: null },
  { code: "LIX-L2-366", level: "L2", name: "Service Infrastructure Strategy Management", parentCode: "LIX-L1-013", sortOrder: 22, description: null },
  { code: "LIX-L2-367", level: "L2", name: "Service Collaboration Platform Operations", parentCode: "LIX-L1-013", sortOrder: 23, description: null },
  { code: "LIX-L2-368", level: "L2", name: "Service Resource Enabling", parentCode: "LIX-L1-013", sortOrder: 24, description: null },
  { code: "LIX-L2-369", level: "L2", name: "Service Resource Strategy Management", parentCode: "LIX-L1-013", sortOrder: 25, description: null },
  { code: "LIX-L2-370", level: "L2", name: "Service Supply Planning", parentCode: "LIX-L1-013", sortOrder: 26, description: null },

  // ── L2: Supply Chain Execution ───────────────────────────────
  { code: "LIX-L2-371", level: "L2", name: "Logistics Material Identification", parentCode: "LIX-L1-014", sortOrder: 1, description: null },
  { code: "LIX-L2-372", level: "L2", name: "Inventory Management", parentCode: "LIX-L1-014", sortOrder: 2, description: null },
  { code: "LIX-L2-373", level: "L2", name: "Order Promising", parentCode: "LIX-L1-014", sortOrder: 3, description: null },
  { code: "LIX-L2-374", level: "L2", name: "Transportation", parentCode: "LIX-L1-014", sortOrder: 4, description: null },
  { code: "LIX-L2-375", level: "L2", name: "Warehouse Management", parentCode: "LIX-L1-014", sortOrder: 5, description: null },
  { code: "LIX-L2-376", level: "L2", name: "Dock and Yard Logistics", parentCode: "LIX-L1-014", sortOrder: 6, description: null },
  { code: "LIX-L2-377", level: "L2", name: "Hydrocarbon Logistics and Inventory", parentCode: "LIX-L1-014", sortOrder: 7, description: null },
  { code: "LIX-L2-378", level: "L2", name: "Quality Management", parentCode: "LIX-L1-014", sortOrder: 8, description: null },
  { code: "LIX-L2-379", level: "L2", name: "Track and Trace", parentCode: "LIX-L1-014", sortOrder: 9, description: null },
  { code: "LIX-L2-380", level: "L2", name: "Product Genealogy", parentCode: "LIX-L1-014", sortOrder: 10, description: null },
  { code: "LIX-L2-381", level: "L2", name: "Batch Number Management", parentCode: "LIX-L1-014", sortOrder: 11, description: null },
  { code: "LIX-L2-382", level: "L2", name: "Handling Unit Management", parentCode: "LIX-L1-014", sortOrder: 12, description: null },
  { code: "LIX-L2-383", level: "L2", name: "Serial Number Management", parentCode: "LIX-L1-014", sortOrder: 13, description: null },
  { code: "LIX-L2-384", level: "L2", name: "Dock Appointment Scheduling", parentCode: "LIX-L1-014", sortOrder: 14, description: null },
  { code: "LIX-L2-385", level: "L2", name: "Yard Management", parentCode: "LIX-L1-014", sortOrder: 15, description: null },
  { code: "LIX-L2-386", level: "L2", name: "Fulfillment Location Determination", parentCode: "LIX-L1-014", sortOrder: 16, description: null },
  { code: "LIX-L2-387", level: "L2", name: "Product Allocation Check", parentCode: "LIX-L1-014", sortOrder: 17, description: null },
  { code: "LIX-L2-388", level: "L2", name: "Product Availability Check", parentCode: "LIX-L1-014", sortOrder: 18, description: null },
  { code: "LIX-L2-389", level: "L2", name: "Product Substitution", parentCode: "LIX-L1-014", sortOrder: 19, description: null },
  { code: "LIX-L2-390", level: "L2", name: "Carrier Booking and Tendering", parentCode: "LIX-L1-014", sortOrder: 20, description: null },
  { code: "LIX-L2-391", level: "L2", name: "Freight Planning and Optimization", parentCode: "LIX-L1-014", sortOrder: 21, description: null },
  { code: "LIX-L2-392", level: "L2", name: "Strategic Freight Management", parentCode: "LIX-L1-014", sortOrder: 22, description: null },
  { code: "LIX-L2-393", level: "L2", name: "Transportation Execution", parentCode: "LIX-L1-014", sortOrder: 23, description: null },
  { code: "LIX-L2-394", level: "L2", name: "Transportation Resource Planning", parentCode: "LIX-L1-014", sortOrder: 24, description: null },
  { code: "LIX-L2-395", level: "L2", name: "Inbound Warehouse Management", parentCode: "LIX-L1-014", sortOrder: 25, description: null },
  { code: "LIX-L2-396", level: "L2", name: "Internal Warehouse Management", parentCode: "LIX-L1-014", sortOrder: 26, description: null },
  { code: "LIX-L2-397", level: "L2", name: "Outbound Warehouse Management", parentCode: "LIX-L1-014", sortOrder: 27, description: null },
  { code: "LIX-L2-398", level: "L2", name: "Production Warehouse Management", parentCode: "LIX-L1-014", sortOrder: 28, description: null },
  { code: "LIX-L2-399", level: "L2", name: "Warehouse Automation", parentCode: "LIX-L1-014", sortOrder: 29, description: null },
  { code: "LIX-L2-400", level: "L2", name: "Customer Consignment Management", parentCode: "LIX-L1-014", sortOrder: 30, description: null },
  { code: "LIX-L2-401", level: "L2", name: "Goods Issue Processing", parentCode: "LIX-L1-014", sortOrder: 31, description: null },
  { code: "LIX-L2-402", level: "L2", name: "Goods Receipt Processing", parentCode: "LIX-L1-014", sortOrder: 32, description: null },
  { code: "LIX-L2-403", level: "L2", name: "Internal Goods Movement Management", parentCode: "LIX-L1-014", sortOrder: 33, description: null },
  { code: "LIX-L2-404", level: "L2", name: "Mobile Inventory Management", parentCode: "LIX-L1-014", sortOrder: 34, description: null },
  { code: "LIX-L2-405", level: "L2", name: "Physical Inventory Management", parentCode: "LIX-L1-014", sortOrder: 35, description: null },
  { code: "LIX-L2-406", level: "L2", name: "Proof of Delivery Management", parentCode: "LIX-L1-014", sortOrder: 36, description: null },
  { code: "LIX-L2-407", level: "L2", name: "Quality Inspection", parentCode: "LIX-L1-014", sortOrder: 37, description: null },
  { code: "LIX-L2-408", level: "L2", name: "Quality Improvement", parentCode: "LIX-L1-014", sortOrder: 38, description: null },
  { code: "LIX-L2-409", level: "L2", name: "Quality Planning", parentCode: "LIX-L1-014", sortOrder: 39, description: null },
  { code: "LIX-L2-410", level: "L2", name: "Quality Testing", parentCode: "LIX-L1-014", sortOrder: 40, description: null },
  { code: "LIX-L2-411", level: "L2", name: "Conveyance Tracking", parentCode: "LIX-L1-014", sortOrder: 41, description: null },
  { code: "LIX-L2-412", level: "L2", name: "Item Serialization", parentCode: "LIX-L1-014", sortOrder: 42, description: null },
  { code: "LIX-L2-413", level: "L2", name: "Product Tracking and Tracing", parentCode: "LIX-L1-014", sortOrder: 43, description: null },
  { code: "LIX-L2-414", level: "L2", name: "Batch Traceability", parentCode: "LIX-L1-014", sortOrder: 44, description: null },
  { code: "LIX-L2-415", level: "L2", name: "Serialized Product Genealogy", parentCode: "LIX-L1-014", sortOrder: 45, description: null },

  // ── L2: Governance, Risk and Compliance ──────────────────────
  { code: "LIX-L2-416", level: "L2", name: "Business Process Management", parentCode: "LIX-L1-015", sortOrder: 1, description: null },
  { code: "LIX-L2-417", level: "L2", name: "Enterprise Risk and Compliance", parentCode: "LIX-L1-015", sortOrder: 2, description: null },
  { code: "LIX-L2-418", level: "L2", name: "Cybersecurity", parentCode: "LIX-L1-015", sortOrder: 3, description: null },
  { code: "LIX-L2-419", level: "L2", name: "Data Protection and Privacy", parentCode: "LIX-L1-015", sortOrder: 4, description: null },
  { code: "LIX-L2-420", level: "L2", name: "Audit Management", parentCode: "LIX-L1-015", sortOrder: 5, description: null },
  { code: "LIX-L2-421", level: "L2", name: "Business Integrity and Controls", parentCode: "LIX-L1-015", sortOrder: 6, description: null },
  { code: "LIX-L2-422", level: "L2", name: "Business Integrity Screening", parentCode: "LIX-L1-015", sortOrder: 7, description: null },
  { code: "LIX-L2-423", level: "L2", name: "Controls Management", parentCode: "LIX-L1-015", sortOrder: 8, description: null },
  { code: "LIX-L2-424", level: "L2", name: "Regulatory Compliance Management", parentCode: "LIX-L1-015", sortOrder: 9, description: null },
  { code: "LIX-L2-425", level: "L2", name: "Cybersecurity Management", parentCode: "LIX-L1-015", sortOrder: 10, description: null },
  { code: "LIX-L2-426", level: "L2", name: "Data Privacy Management", parentCode: "LIX-L1-015", sortOrder: 11, description: null },
  { code: "LIX-L2-427", level: "L2", name: "Data Protection", parentCode: "LIX-L1-015", sortOrder: 12, description: null },
  { code: "LIX-L2-428", level: "L2", name: "Business Process Analytics and Mining", parentCode: "LIX-L1-015", sortOrder: 13, description: null },
  { code: "LIX-L2-429", level: "L2", name: "Business Process Automation", parentCode: "LIX-L1-015", sortOrder: 14, description: null },
  { code: "LIX-L2-430", level: "L2", name: "Business Process Governance", parentCode: "LIX-L1-015", sortOrder: 15, description: null },
  { code: "LIX-L2-431", level: "L2", name: "Business Process Modeling", parentCode: "LIX-L1-015", sortOrder: 16, description: null },
  { code: "LIX-L2-432", level: "L2", name: "Business Process Monitoring", parentCode: "LIX-L1-015", sortOrder: 17, description: null },
  { code: "LIX-L2-433", level: "L2", name: "Business Process Optimization", parentCode: "LIX-L1-015", sortOrder: 18, description: null },
  { code: "LIX-L2-434", level: "L2", name: "Business Process Orchestration", parentCode: "LIX-L1-015", sortOrder: 19, description: null },

  // ── L2: Finance ──────────────────────────────────────────────
  { code: "LIX-L2-435", level: "L2", name: "Accounting and Financial Close", parentCode: "LIX-L1-016", sortOrder: 1, description: null },
  { code: "LIX-L2-436", level: "L2", name: "Financial Planning and Analysis", parentCode: "LIX-L1-016", sortOrder: 2, description: null },
  { code: "LIX-L2-437", level: "L2", name: "Payables and Receivables", parentCode: "LIX-L1-016", sortOrder: 3, description: null },
  { code: "LIX-L2-438", level: "L2", name: "Real Estate Management", parentCode: "LIX-L1-016", sortOrder: 4, description: null },
  { code: "LIX-L2-439", level: "L2", name: "Treasury Management", parentCode: "LIX-L1-016", sortOrder: 5, description: null },
  { code: "LIX-L2-440", level: "L2", name: "Budgetary Accounting", parentCode: "LIX-L1-016", sortOrder: 6, description: null },
  { code: "LIX-L2-441", level: "L2", name: "Financial Analytics", parentCode: "LIX-L1-016", sortOrder: 7, description: null },
  { code: "LIX-L2-442", level: "L2", name: "Financial Structure Management", parentCode: "LIX-L1-016", sortOrder: 8, description: null },
  { code: "LIX-L2-443", level: "L2", name: "Margin Analysis", parentCode: "LIX-L1-016", sortOrder: 9, description: null },
  { code: "LIX-L2-444", level: "L2", name: "Margin Optimization", parentCode: "LIX-L1-016", sortOrder: 10, description: null },
  { code: "LIX-L2-445", level: "L2", name: "Overhead Cost Accounting", parentCode: "LIX-L1-016", sortOrder: 11, description: null },
  { code: "LIX-L2-446", level: "L2", name: "Predictive Accounting", parentCode: "LIX-L1-016", sortOrder: 12, description: null },
  { code: "LIX-L2-447", level: "L2", name: "Production Cost Accounting", parentCode: "LIX-L1-016", sortOrder: 13, description: null },
  { code: "LIX-L2-448", level: "L2", name: "Project Accounting", parentCode: "LIX-L1-016", sortOrder: 14, description: null },
  { code: "LIX-L2-449", level: "L2", name: "Sales and Service Cost Accounting", parentCode: "LIX-L1-016", sortOrder: 15, description: null },
  { code: "LIX-L2-450", level: "L2", name: "Transfer Price Management", parentCode: "LIX-L1-016", sortOrder: 16, description: null },
  { code: "LIX-L2-451", level: "L2", name: "Asset Accounting", parentCode: "LIX-L1-016", sortOrder: 17, description: null },
  { code: "LIX-L2-452", level: "L2", name: "Financial Audit Preparation", parentCode: "LIX-L1-016", sortOrder: 18, description: null },
  { code: "LIX-L2-453", level: "L2", name: "Financial Master Data Management", parentCode: "LIX-L1-016", sortOrder: 19, description: null },
  { code: "LIX-L2-454", level: "L2", name: "Financial Multi-GAAP Posting", parentCode: "LIX-L1-016", sortOrder: 20, description: null },
  { code: "LIX-L2-455", level: "L2", name: "General Ledger Accounting", parentCode: "LIX-L1-016", sortOrder: 21, description: null },
  { code: "LIX-L2-456", level: "L2", name: "Group Financial Closing", parentCode: "LIX-L1-016", sortOrder: 22, description: null },
  { code: "LIX-L2-457", level: "L2", name: "Inventory Accounting", parentCode: "LIX-L1-016", sortOrder: 23, description: null },
  { code: "LIX-L2-458", level: "L2", name: "Joint Venture Accounting", parentCode: "LIX-L1-016", sortOrder: 24, description: null },
  { code: "LIX-L2-459", level: "L2", name: "Lease Accounting", parentCode: "LIX-L1-016", sortOrder: 25, description: null },
  { code: "LIX-L2-460", level: "L2", name: "Local Financial Closing", parentCode: "LIX-L1-016", sortOrder: 26, description: null },
  { code: "LIX-L2-461", level: "L2", name: "Non-Financial Data Recording", parentCode: "LIX-L1-016", sortOrder: 27, description: null },
  { code: "LIX-L2-462", level: "L2", name: "Revenue and Cost Recognition", parentCode: "LIX-L1-016", sortOrder: 28, description: null },
  { code: "LIX-L2-463", level: "L2", name: "Collections Management", parentCode: "LIX-L1-016", sortOrder: 29, description: null },
  { code: "LIX-L2-464", level: "L2", name: "Credit Management", parentCode: "LIX-L1-016", sortOrder: 30, description: null },
  { code: "LIX-L2-465", level: "L2", name: "Customer Payment Collaboration", parentCode: "LIX-L1-016", sortOrder: 31, description: null },
  { code: "LIX-L2-466", level: "L2", name: "Dispute Management", parentCode: "LIX-L1-016", sortOrder: 32, description: null },
  { code: "LIX-L2-467", level: "L2", name: "Open Item Management", parentCode: "LIX-L1-016", sortOrder: 33, description: null },
  { code: "LIX-L2-468", level: "L2", name: "Payment Processing", parentCode: "LIX-L1-016", sortOrder: 34, description: null },
  { code: "LIX-L2-469", level: "L2", name: "Receivables Financing", parentCode: "LIX-L1-016", sortOrder: 35, description: null },
  { code: "LIX-L2-470", level: "L2", name: "Settlement Management", parentCode: "LIX-L1-016", sortOrder: 36, description: null },
  { code: "LIX-L2-471", level: "L2", name: "Supplier Payment Collaboration", parentCode: "LIX-L1-016", sortOrder: 37, description: null },
  { code: "LIX-L2-472", level: "L2", name: "Financial Lease Management", parentCode: "LIX-L1-016", sortOrder: 38, description: null },
  { code: "LIX-L2-473", level: "L2", name: "Occupancy Management", parentCode: "LIX-L1-016", sortOrder: 39, description: null },
  { code: "LIX-L2-474", level: "L2", name: "Property Cost and Revenue Management", parentCode: "LIX-L1-016", sortOrder: 40, description: null },
  { code: "LIX-L2-475", level: "L2", name: "Property Management", parentCode: "LIX-L1-016", sortOrder: 41, description: null },
  { code: "LIX-L2-476", level: "L2", name: "Real Estate Analytics", parentCode: "LIX-L1-016", sortOrder: 42, description: null },
  { code: "LIX-L2-477", level: "L2", name: "Workspace Management", parentCode: "LIX-L1-016", sortOrder: 43, description: null },
  { code: "LIX-L2-478", level: "L2", name: "Cash and Liquidity Management", parentCode: "LIX-L1-016", sortOrder: 44, description: null },
  { code: "LIX-L2-479", level: "L2", name: "Commodity Risk Management", parentCode: "LIX-L1-016", sortOrder: 45, description: null },
  { code: "LIX-L2-480", level: "L2", name: "Debt and Investment Management", parentCode: "LIX-L1-016", sortOrder: 46, description: null },
  { code: "LIX-L2-481", level: "L2", name: "Financial Risk Management", parentCode: "LIX-L1-016", sortOrder: 47, description: null },
  { code: "LIX-L2-482", level: "L2", name: "Treasury Governance and Compliance Management", parentCode: "LIX-L1-016", sortOrder: 48, description: null },
  { code: "LIX-L2-483", level: "L2", name: "Financial Simulation", parentCode: "LIX-L1-016", sortOrder: 49, description: null },

  // ── L2: Marketing ────────────────────────────────────────────
  { code: "LIX-L2-484", level: "L2", name: "Marketing Execution", parentCode: "LIX-L1-017", sortOrder: 1, description: null },
  { code: "LIX-L2-485", level: "L2", name: "Marketing Strategy and Planning", parentCode: "LIX-L1-017", sortOrder: 2, description: null },
  { code: "LIX-L2-486", level: "L2", name: "Account-Based Marketing", parentCode: "LIX-L1-017", sortOrder: 3, description: null },
  { code: "LIX-L2-487", level: "L2", name: "Audience Segmentation", parentCode: "LIX-L1-017", sortOrder: 4, description: null },
  { code: "LIX-L2-488", level: "L2", name: "Collaborative Campaign Management", parentCode: "LIX-L1-017", sortOrder: 5, description: null },
  { code: "LIX-L2-489", level: "L2", name: "Digital Asset Management", parentCode: "LIX-L1-017", sortOrder: 6, description: null },
  { code: "LIX-L2-490", level: "L2", name: "Lead Management", parentCode: "LIX-L1-017", sortOrder: 7, description: null },
  { code: "LIX-L2-491", level: "L2", name: "Loyalty Management", parentCode: "LIX-L1-017", sortOrder: 8, description: null },
  { code: "LIX-L2-492", level: "L2", name: "Marketing Campaign Management", parentCode: "LIX-L1-017", sortOrder: 9, description: null },
  { code: "LIX-L2-493", level: "L2", name: "Marketing Collaboration", parentCode: "LIX-L1-017", sortOrder: 10, description: null },
  { code: "LIX-L2-494", level: "L2", name: "Recommendation Management", parentCode: "LIX-L1-017", sortOrder: 11, description: null },

  // ── L2: R&D / Engineering ────────────────────────────────────
  { code: "LIX-L2-495", level: "L2", name: "Design Management", parentCode: "LIX-L1-018", sortOrder: 1, description: null },
  { code: "LIX-L2-496", level: "L2", name: "Ideation Management", parentCode: "LIX-L1-018", sortOrder: 2, description: null },
  { code: "LIX-L2-497", level: "L2", name: "Product / Service Go-to-Market Preparation", parentCode: "LIX-L1-018", sortOrder: 3, description: null },
  { code: "LIX-L2-498", level: "L2", name: "Lifecycle Management", parentCode: "LIX-L1-018", sortOrder: 4, description: null },
  { code: "LIX-L2-499", level: "L2", name: "Idea Evaluation and Testing", parentCode: "LIX-L1-018", sortOrder: 5, description: null },
  { code: "LIX-L2-500", level: "L2", name: "Idea Feedback Management", parentCode: "LIX-L1-018", sortOrder: 6, description: null },
  { code: "LIX-L2-501", level: "L2", name: "Idea Generation and Research", parentCode: "LIX-L1-018", sortOrder: 7, description: null },
  { code: "LIX-L2-502", level: "L2", name: "Idea Identification", parentCode: "LIX-L1-018", sortOrder: 8, description: null },
  { code: "LIX-L2-503", level: "L2", name: "Idea Management Analytics", parentCode: "LIX-L1-018", sortOrder: 9, description: null },
  { code: "LIX-L2-504", level: "L2", name: "Idea Selection and Execution", parentCode: "LIX-L1-018", sortOrder: 10, description: null },
  { code: "LIX-L2-505", level: "L2", name: "Entitlement Modeling", parentCode: "LIX-L1-018", sortOrder: 11, description: null },
  { code: "LIX-L2-506", level: "L2", name: "Product Experience Management", parentCode: "LIX-L1-018", sortOrder: 12, description: null },
  { code: "LIX-L2-507", level: "L2", name: "Service Experience Management", parentCode: "LIX-L1-018", sortOrder: 13, description: null },
  { code: "LIX-L2-508", level: "L2", name: "Solution / Bundle Modeling", parentCode: "LIX-L1-018", sortOrder: 14, description: null },
  { code: "LIX-L2-509", level: "L2", name: "Configuration Change Management", parentCode: "LIX-L1-018", sortOrder: 15, description: null },
  { code: "LIX-L2-510", level: "L2", name: "Configuration Lifecycle Management", parentCode: "LIX-L1-018", sortOrder: 16, description: null },
  { code: "LIX-L2-511", level: "L2", name: "Engineering Change Management", parentCode: "LIX-L1-018", sortOrder: 17, description: null },
  { code: "LIX-L2-512", level: "L2", name: "Object Visualization", parentCode: "LIX-L1-018", sortOrder: 18, description: null },
  { code: "LIX-L2-513", level: "L2", name: "Product / Service Modeling", parentCode: "LIX-L1-018", sortOrder: 19, description: null },
  { code: "LIX-L2-514", level: "L2", name: "Product Cost Estimation", parentCode: "LIX-L1-018", sortOrder: 20, description: null },
  { code: "LIX-L2-515", level: "L2", name: "Computer Aided Design", parentCode: "LIX-L1-018", sortOrder: 21, description: null },
  { code: "LIX-L2-516", level: "L2", name: "System Interoperability", parentCode: "LIX-L1-018", sortOrder: 22, description: null },
  { code: "LIX-L2-517", level: "L2", name: "Roadmap Management", parentCode: "LIX-L1-018", sortOrder: 23, description: null },
  { code: "LIX-L2-518", level: "L2", name: "Product Formulation and Recipe Management", parentCode: "LIX-L1-018", sortOrder: 24, description: null },
  { code: "LIX-L2-519", level: "L2", name: "Cross-Portfolio Dependency Management", parentCode: "LIX-L1-018", sortOrder: 25, description: null },
  { code: "LIX-L2-520", level: "L2", name: "Circular Design Evaluation", parentCode: "LIX-L1-018", sortOrder: 26, description: null },
  { code: "LIX-L2-521", level: "L2", name: "Model Based Systems Engineering", parentCode: "LIX-L1-018", sortOrder: 27, description: null },

  // ── L2: Supply Chain Enablement ──────────────────────────────
  { code: "LIX-L2-522", level: "L2", name: "Supply Chain Strategy", parentCode: "LIX-L1-019", sortOrder: 1, description: null },
  { code: "LIX-L2-523", level: "L2", name: "Supply Chain Collaboration", parentCode: "LIX-L1-019", sortOrder: 2, description: null },
  { code: "LIX-L2-524", level: "L2", name: "Supply Chain Network Operations", parentCode: "LIX-L1-019", sortOrder: 3, description: null },
  { code: "LIX-L2-525", level: "L2", name: "Cross-Company Monitoring", parentCode: "LIX-L1-019", sortOrder: 4, description: null },
  { code: "LIX-L2-526", level: "L2", name: "Inventory Analytics and Control", parentCode: "LIX-L1-019", sortOrder: 5, description: null },
  { code: "LIX-L2-527", level: "L2", name: "Logistics Monitoring", parentCode: "LIX-L1-019", sortOrder: 6, description: null },
  { code: "LIX-L2-528", level: "L2", name: "Supply Chain Exception Management", parentCode: "LIX-L1-019", sortOrder: 7, description: null },
  { code: "LIX-L2-529", level: "L2", name: "Supply Chain Planning Analytics", parentCode: "LIX-L1-019", sortOrder: 8, description: null },
  { code: "LIX-L2-530", level: "L2", name: "Transportation Analytics", parentCode: "LIX-L1-019", sortOrder: 9, description: null },
  { code: "LIX-L2-531", level: "L2", name: "Warehouse Analytics", parentCode: "LIX-L1-019", sortOrder: 10, description: null },
  { code: "LIX-L2-532", level: "L2", name: "Appointment Collaboration", parentCode: "LIX-L1-019", sortOrder: 11, description: null },
  { code: "LIX-L2-533", level: "L2", name: "Customer Planning Collaboration", parentCode: "LIX-L1-019", sortOrder: 12, description: null },
  { code: "LIX-L2-534", level: "L2", name: "Customer Quality Collaboration", parentCode: "LIX-L1-019", sortOrder: 13, description: null },
  { code: "LIX-L2-535", level: "L2", name: "Delivery and Receipt Collaboration", parentCode: "LIX-L1-019", sortOrder: 14, description: null },
  { code: "LIX-L2-536", level: "L2", name: "Freight Order Collaboration", parentCode: "LIX-L1-019", sortOrder: 15, description: null },
  { code: "LIX-L2-537", level: "L2", name: "Manufacturing Collaboration", parentCode: "LIX-L1-019", sortOrder: 16, description: null },
  { code: "LIX-L2-538", level: "L2", name: "Supplier Planning Collaboration", parentCode: "LIX-L1-019", sortOrder: 17, description: null },
  { code: "LIX-L2-539", level: "L2", name: "Supplier Quality Collaboration", parentCode: "LIX-L1-019", sortOrder: 18, description: null },
  { code: "LIX-L2-540", level: "L2", name: "Order and Delivery Schedule Optimization", parentCode: "LIX-L1-019", sortOrder: 19, description: null },
  { code: "LIX-L2-541", level: "L2", name: "Supply Chain Network Design", parentCode: "LIX-L1-019", sortOrder: 20, description: null },
  { code: "LIX-L2-542", level: "L2", name: "Supply Chain Segmentation", parentCode: "LIX-L1-019", sortOrder: 21, description: null },
  { code: "LIX-L2-543", level: "L2", name: "Supply Chain Strategy Implementation", parentCode: "LIX-L1-019", sortOrder: 22, description: null },
  { code: "LIX-L2-544", level: "L2", name: "Extended Producer Responsibility", parentCode: "LIX-L1-019", sortOrder: 23, description: null },

  // ── L2: Sustainability Management ────────────────────────────
  { code: "LIX-L2-545", level: "L2", name: "Environmental Footprint", parentCode: "LIX-L1-020", sortOrder: 1, description: null },
  { code: "LIX-L2-546", level: "L2", name: "Sustainability Collaboration", parentCode: "LIX-L1-020", sortOrder: 2, description: null },
  { code: "LIX-L2-547", level: "L2", name: "Performance", parentCode: "LIX-L1-020", sortOrder: 3, description: null },
  { code: "LIX-L2-548", level: "L2", name: "Sustainable Operations", parentCode: "LIX-L1-020", sortOrder: 4, description: null },
  { code: "LIX-L2-549", level: "L2", name: "Circular Economy", parentCode: "LIX-L1-020", sortOrder: 5, description: null },
  { code: "LIX-L2-550", level: "L2", name: "Carbon Footprint Calculation", parentCode: "LIX-L1-020", sortOrder: 6, description: null },
  { code: "LIX-L2-551", level: "L2", name: "Emission Data Collection", parentCode: "LIX-L1-020", sortOrder: 7, description: null },
  { code: "LIX-L2-552", level: "L2", name: "GHG Emissions Calculation", parentCode: "LIX-L1-020", sortOrder: 8, description: null },
  { code: "LIX-L2-553", level: "L2", name: "Sustainability Steering and Reporting", parentCode: "LIX-L1-020", sortOrder: 9, description: null },
  { code: "LIX-L2-554", level: "L2", name: "Sustainability Information Collaboration", parentCode: "LIX-L1-020", sortOrder: 10, description: null },
  { code: "LIX-L2-555", level: "L2", name: "Sustainability Network Operation", parentCode: "LIX-L1-020", sortOrder: 11, description: null },
  { code: "LIX-L2-556", level: "L2", name: "Emission Result Validation", parentCode: "LIX-L1-020", sortOrder: 12, description: null },
  { code: "LIX-L2-557", level: "L2", name: "Emissions Factors Management", parentCode: "LIX-L1-020", sortOrder: 13, description: null },
  { code: "LIX-L2-558", level: "L2", name: "Formulas and Equations Management", parentCode: "LIX-L1-020", sortOrder: 14, description: null },
  { code: "LIX-L2-559", level: "L2", name: "Sustainability Audit Preparation", parentCode: "LIX-L1-020", sortOrder: 15, description: null },
  { code: "LIX-L2-560", level: "L2", name: "Asset Commissioning", parentCode: "LIX-L1-020", sortOrder: 16, description: null },
  { code: "LIX-L2-561", level: "L2", name: "Sustainability Disclosure Management", parentCode: "LIX-L1-020", sortOrder: 17, description: null },
  { code: "LIX-L2-562", level: "L2", name: "Sustainability Objective Management", parentCode: "LIX-L1-020", sortOrder: 18, description: null },
  { code: "LIX-L2-563", level: "L2", name: "Sustainability Strategy Definition", parentCode: "LIX-L1-020", sortOrder: 19, description: null },
  { code: "LIX-L2-564", level: "L2", name: "EHS Incident Management", parentCode: "LIX-L1-020", sortOrder: 20, description: null },
  { code: "LIX-L2-565", level: "L2", name: "ESG Fact Transparency Mass Balancing", parentCode: "LIX-L1-020", sortOrder: 21, description: null },
  { code: "LIX-L2-566", level: "L2", name: "Hazardous Substance Management", parentCode: "LIX-L1-020", sortOrder: 22, description: null },
  { code: "LIX-L2-567", level: "L2", name: "Management of Change", parentCode: "LIX-L1-020", sortOrder: 23, description: null },
  { code: "LIX-L2-568", level: "L2", name: "Occupational Health Management", parentCode: "LIX-L1-020", sortOrder: 24, description: null },
  { code: "LIX-L2-569", level: "L2", name: "Operational Risk Assessment", parentCode: "LIX-L1-020", sortOrder: 25, description: null },
  { code: "LIX-L2-570", level: "L2", name: "Waste Characterization Management", parentCode: "LIX-L1-020", sortOrder: 26, description: null },
  { code: "LIX-L2-571", level: "L2", name: "Waste Container Management", parentCode: "LIX-L1-020", sortOrder: 27, description: null },
  { code: "LIX-L2-572", level: "L2", name: "Waste Disposal Management", parentCode: "LIX-L1-020", sortOrder: 28, description: null },
  { code: "LIX-L2-573", level: "L2", name: "Waste Generation Monitoring", parentCode: "LIX-L1-020", sortOrder: 29, description: null },
  { code: "LIX-L2-574", level: "L2", name: "Waste Storage Management", parentCode: "LIX-L1-020", sortOrder: 30, description: null },
  { code: "LIX-L2-575", level: "L2", name: "Waste Transportation Management", parentCode: "LIX-L1-020", sortOrder: 31, description: null },
  { code: "LIX-L2-576", level: "L2", name: "Work Permit and Isolations Management", parentCode: "LIX-L1-020", sortOrder: 32, description: null },
];

// ── Enterprise BCM enhancements ──────────────────────────────────────────────
// Value-chain band assignments for L1 domains (Grow / Run / Protect)
const BCM_BANDS: Record<string, string> = {
  "LIX-L1-001": "Run",     // Asset Management
  "LIX-L1-002": "Run",     // Human Resources
  "LIX-L1-003": "Grow",    // Omnichannel Commerce
  "LIX-L1-004": "Grow",    // Sales
  "LIX-L1-005": "Protect", // Enterprise Strategy
  "LIX-L1-006": "Run",     // Manufacturing
  "LIX-L1-007": "Grow",    // Product Management
  "LIX-L1-008": "Run",     // Sourcing and Procurement
  "LIX-L1-009": "Run",     // Supply Chain Management (merged)
  "LIX-L1-010": "Grow",    // Customer Service
  "LIX-L1-011": "Protect", // International Trade and Global Tax
  "LIX-L1-012": "Protect", // Portfolio and Project Management
  "LIX-L1-013": "Run",     // Service Delivery
  "LIX-L1-015": "Protect", // Governance, Risk and Compliance
  "LIX-L1-016": "Protect", // Finance
  "LIX-L1-017": "Grow",    // Marketing
  "LIX-L1-018": "Grow",    // R&D / Engineering
  "LIX-L1-020": "Protect", // Sustainability Management
};

// Strategic importance defaults for L1 domains
const BCM_IMPORTANCE: Record<string, string> = {
  "LIX-L1-001": "HIGH",
  "LIX-L1-002": "CRITICAL",
  "LIX-L1-003": "HIGH",
  "LIX-L1-004": "CRITICAL",
  "LIX-L1-005": "CRITICAL",
  "LIX-L1-006": "HIGH",
  "LIX-L1-007": "HIGH",
  "LIX-L1-008": "HIGH",
  "LIX-L1-009": "CRITICAL",
  "LIX-L1-010": "HIGH",
  "LIX-L1-011": "MEDIUM",
  "LIX-L1-012": "MEDIUM",
  "LIX-L1-013": "HIGH",
  "LIX-L1-015": "CRITICAL",
  "LIX-L1-016": "CRITICAL",
  "LIX-L1-017": "HIGH",
  "LIX-L1-018": "HIGH",
  "LIX-L1-020": "MEDIUM",
};

// Supply Chain consolidation: 3 L1s → 1 L1 + 3 L2 sub-groups
// SC Planning L2s (was LIX-L1-009): codes 264–285
const SC_PLANNING_CODES = new Set(
  Array.from({ length: 22 }, (_, i) => `LIX-L2-${String(264 + i).padStart(3, "0")}`)
);
// SC Execution L2s (was LIX-L1-014): codes 371–415
const SC_EXECUTION_CODES = new Set(
  Array.from({ length: 45 }, (_, i) => `LIX-L2-${String(371 + i).padStart(3, "0")}`)
);
// SC Enablement L2s (was LIX-L1-019): codes 522–544
const SC_ENABLEMENT_CODES = new Set(
  Array.from({ length: 23 }, (_, i) => `LIX-L2-${String(522 + i).padStart(3, "0")}`)
);

// New L2 wrapper entries for the merged Supply Chain Management domain
const ENTERPRISE_BCM_SC_WRAPPERS = [
  { code: "LIX-L2-SCM-001", level: "L2", name: "Supply Chain Planning",   parentCode: "LIX-L1-009", sortOrder: 1, description: "Demand, inventory, S&OP, and supply network planning", band: null, strategicImportance: "HIGH",   isActive: true },
  { code: "LIX-L2-SCM-002", level: "L2", name: "Supply Chain Execution",  parentCode: "LIX-L1-009", sortOrder: 2, description: "Physical logistics — warehousing, transport, inventory, quality", band: null, strategicImportance: "HIGH",   isActive: true },
  { code: "LIX-L2-SCM-003", level: "L2", name: "Supply Chain Enablement", parentCode: "LIX-L1-009", sortOrder: 3, description: "Strategy, collaboration, analytics, and network design", band: null, strategicImportance: "MEDIUM", isActive: true },
];

// L3 capabilities for the most critical L2 domains
const ENTERPRISE_BCM_L3S = [
  // ── Finance: Accounting and Financial Close (LIX-L2-435) ──
  { code: "LIX-L3-001", level: "L3", name: "Journal Entry Processing",       parentCode: "LIX-L2-435", sortOrder: 1, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-002", level: "L3", name: "Period-End Close Management",    parentCode: "LIX-L2-435", sortOrder: 2, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-003", level: "L3", name: "Account Reconciliation",         parentCode: "LIX-L2-435", sortOrder: 3, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-004", level: "L3", name: "Intercompany Accounting",        parentCode: "LIX-L2-435", sortOrder: 4, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  // ── Finance: General Ledger Accounting (LIX-L2-455) ──
  { code: "LIX-L3-005", level: "L3", name: "Chart of Accounts Management",   parentCode: "LIX-L2-455", sortOrder: 1, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-006", level: "L3", name: "Allocations Management",         parentCode: "LIX-L2-455", sortOrder: 2, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-007", level: "L3", name: "Cost Center Accounting",         parentCode: "LIX-L2-455", sortOrder: 3, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-008", level: "L3", name: "Profit Center Accounting",       parentCode: "LIX-L2-455", sortOrder: 4, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  // ── Finance: Financial Planning and Analysis (LIX-L2-436) ──
  { code: "LIX-L3-009", level: "L3", name: "Budgeting",                      parentCode: "LIX-L2-436", sortOrder: 1, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-010", level: "L3", name: "Rolling Forecasting",            parentCode: "LIX-L2-436", sortOrder: 2, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-011", level: "L3", name: "Scenario Planning",              parentCode: "LIX-L2-436", sortOrder: 3, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-012", level: "L3", name: "Variance Analysis",              parentCode: "LIX-L2-436", sortOrder: 4, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  // ── Finance: Payables and Receivables (LIX-L2-437) ──
  { code: "LIX-L3-013", level: "L3", name: "Supplier Invoice Matching",      parentCode: "LIX-L2-437", sortOrder: 1, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-014", level: "L3", name: "Payment Run Execution",          parentCode: "LIX-L2-437", sortOrder: 2, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-015", level: "L3", name: "Dunning and Collections",        parentCode: "LIX-L2-437", sortOrder: 3, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-016", level: "L3", name: "Credit Exposure Monitoring",     parentCode: "LIX-L2-437", sortOrder: 4, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  // ── HR: Talent Acquisition (LIX-L2-038) ──
  { code: "LIX-L3-017", level: "L3", name: "Job Requisition Management",           parentCode: "LIX-L2-038", sortOrder: 1, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-018", level: "L3", name: "Candidate Sourcing and Attraction",    parentCode: "LIX-L2-038", sortOrder: 2, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-019", level: "L3", name: "Interview and Selection",              parentCode: "LIX-L2-038", sortOrder: 3, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-020", level: "L3", name: "Offer Management",                     parentCode: "LIX-L2-038", sortOrder: 4, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-021", level: "L3", name: "Pre-employment Screening",             parentCode: "LIX-L2-038", sortOrder: 5, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  // ── HR: Employee Performance Management (LIX-L2-068) ──
  { code: "LIX-L3-022", level: "L3", name: "Goal Setting and Alignment",           parentCode: "LIX-L2-068", sortOrder: 1, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-023", level: "L3", name: "Continuous Performance Feedback",      parentCode: "LIX-L2-068", sortOrder: 2, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-024", level: "L3", name: "Performance Review and Rating",        parentCode: "LIX-L2-068", sortOrder: 3, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-025", level: "L3", name: "Calibration and Normalization",        parentCode: "LIX-L2-068", sortOrder: 4, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  // ── HR: Payroll Management (LIX-L2-054) ──
  { code: "LIX-L3-026", level: "L3", name: "Gross-to-Net Calculation",       parentCode: "LIX-L2-054", sortOrder: 1, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-027", level: "L3", name: "Tax Withholding and Filing",     parentCode: "LIX-L2-054", sortOrder: 2, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-028", level: "L3", name: "Payslip Distribution",           parentCode: "LIX-L2-054", sortOrder: 3, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-029", level: "L3", name: "Off-Cycle Payroll Processing",   parentCode: "LIX-L2-054", sortOrder: 4, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  // ── Procurement: Operational Procurement (LIX-L2-225) ──
  { code: "LIX-L3-030", level: "L3", name: "Purchase Requisition Management",parentCode: "LIX-L2-225", sortOrder: 1, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-031", level: "L3", name: "Purchase Order Management",      parentCode: "LIX-L2-225", sortOrder: 2, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-032", level: "L3", name: "Goods and Services Receipt",     parentCode: "LIX-L2-225", sortOrder: 3, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-033", level: "L3", name: "Invoice and PO Matching",        parentCode: "LIX-L2-225", sortOrder: 4, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  // ── Procurement: Sourcing (LIX-L2-219) ──
  { code: "LIX-L3-034", level: "L3", name: "Sourcing Event Management",      parentCode: "LIX-L2-219", sortOrder: 1, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-035", level: "L3", name: "Bid Evaluation and Comparison",  parentCode: "LIX-L2-219", sortOrder: 2, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-036", level: "L3", name: "Supplier Award and Approval",    parentCode: "LIX-L2-219", sortOrder: 3, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-037", level: "L3", name: "Contract Handoff to Procurement",parentCode: "LIX-L2-219", sortOrder: 4, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  // ── Manufacturing: Manufacturing Execution (LIX-L2-179) ──
  { code: "LIX-L3-038", level: "L3", name: "Work Order Dispatch",            parentCode: "LIX-L2-179", sortOrder: 1, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-039", level: "L3", name: "Production Reporting",           parentCode: "LIX-L2-179", sortOrder: 2, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-040", level: "L3", name: "Quality at Point of Production", parentCode: "LIX-L2-179", sortOrder: 3, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-041", level: "L3", name: "Scrap and Rework Management",    parentCode: "LIX-L2-179", sortOrder: 4, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  // ── Manufacturing: Production Planning and Scheduling (LIX-L2-161) ──
  { code: "LIX-L3-042", level: "L3", name: "Master Production Schedule",     parentCode: "LIX-L2-161", sortOrder: 1, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-043", level: "L3", name: "Capacity Requirements Planning", parentCode: "LIX-L2-161", sortOrder: 2, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-044", level: "L3", name: "Material Requirements Planning", parentCode: "LIX-L2-161", sortOrder: 3, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-045", level: "L3", name: "Production Schedule Release",    parentCode: "LIX-L2-161", sortOrder: 4, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  // ── GRC: Enterprise Risk and Compliance (LIX-L2-417) ──
  { code: "LIX-L3-046", level: "L3", name: "Risk Identification and Cataloging",  parentCode: "LIX-L2-417", sortOrder: 1, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-047", level: "L3", name: "Risk Assessment and Scoring",         parentCode: "LIX-L2-417", sortOrder: 2, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-048", level: "L3", name: "Risk Response Planning",              parentCode: "LIX-L2-417", sortOrder: 3, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-049", level: "L3", name: "Risk Monitoring and Reporting",       parentCode: "LIX-L2-417", sortOrder: 4, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  // ── GRC: Cybersecurity Management (LIX-L2-425) ──
  { code: "LIX-L3-050", level: "L3", name: "Threat Detection and Response",       parentCode: "LIX-L2-425", sortOrder: 1, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-051", level: "L3", name: "Vulnerability Management",            parentCode: "LIX-L2-425", sortOrder: 2, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-052", level: "L3", name: "Security Incident Management",        parentCode: "LIX-L2-425", sortOrder: 3, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-053", level: "L3", name: "Identity and Access Control Governance", parentCode: "LIX-L2-425", sortOrder: 4, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  // ── GRC: Audit Management (LIX-L2-420) ──
  { code: "LIX-L3-054", level: "L3", name: "Audit Planning and Scheduling",             parentCode: "LIX-L2-420", sortOrder: 1, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-055", level: "L3", name: "Audit Fieldwork and Evidence Collection",   parentCode: "LIX-L2-420", sortOrder: 2, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-056", level: "L3", name: "Finding and Recommendation Management",     parentCode: "LIX-L2-420", sortOrder: 3, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-057", level: "L3", name: "Audit Report and Follow-up",                parentCode: "LIX-L2-420", sortOrder: 4, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  // ── Customer Service: Omnichannel Customer Engagement (LIX-L2-294) ──
  { code: "LIX-L3-058", level: "L3", name: "Live Chat and Messaging",         parentCode: "LIX-L2-294", sortOrder: 1, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-059", level: "L3", name: "Voice and IVR Management",        parentCode: "LIX-L2-294", sortOrder: 2, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-060", level: "L3", name: "Email and Case Management",       parentCode: "LIX-L2-294", sortOrder: 3, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-061", level: "L3", name: "Social Media Customer Care",      parentCode: "LIX-L2-294", sortOrder: 4, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  // ── Customer Service: Complaints Management (LIX-L2-289) ──
  { code: "LIX-L3-062", level: "L3", name: "Complaint Registration and Triage",      parentCode: "LIX-L2-289", sortOrder: 1, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-063", level: "L3", name: "Root Cause Investigation",                parentCode: "LIX-L2-289", sortOrder: 2, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-064", level: "L3", name: "Resolution and Escalation Management",   parentCode: "LIX-L2-289", sortOrder: 3, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
  { code: "LIX-L3-065", level: "L3", name: "Complaint Analytics and Reporting",      parentCode: "LIX-L2-289", sortOrder: 4, description: null, band: null, strategicImportance: "NOT_ASSESSED", isActive: true },
];

// Apply all enhancements to the base ENTERPRISE_BCM_TEMPLATE
const ENTERPRISE_BCM_FULL = [
  ...ENTERPRISE_BCM_TEMPLATE.map((e) => {
    const mods: Record<string, unknown> = {};
    if (e.code === "LIX-L1-009") mods.name = "Supply Chain Management";
    if (e.code === "LIX-L1-014" || e.code === "LIX-L1-019") mods.isActive = false;
    if (BCM_BANDS[e.code])      mods.band = BCM_BANDS[e.code];
    if (BCM_IMPORTANCE[e.code]) mods.strategicImportance = BCM_IMPORTANCE[e.code];
    if (SC_PLANNING_CODES.has(e.code))  { mods.level = "L3"; mods.parentCode = "LIX-L2-SCM-001"; }
    if (SC_EXECUTION_CODES.has(e.code)) { mods.level = "L3"; mods.parentCode = "LIX-L2-SCM-002"; }
    if (SC_ENABLEMENT_CODES.has(e.code)){ mods.level = "L3"; mods.parentCode = "LIX-L2-SCM-003"; }
    return { ...e, ...mods };
  }),
  ...ENTERPRISE_BCM_SC_WRAPPERS,
  ...ENTERPRISE_BCM_L3S,
];

async function main() {
  console.log("Seeding industry templates...");

  const allTemplates = [
    ...BANKING_TEMPLATE.map((t) => ({ ...t, industry: "BANKING" as const })),
    ...RETAIL_TEMPLATE.map((t) => ({ ...t, industry: "RETAIL" as const })),
    ...LOGISTICS_TEMPLATE.map((t) => ({ ...t, industry: "LOGISTICS" as const })),
    ...MANUFACTURING_TEMPLATE.map((t) => ({ ...t, industry: "MANUFACTURING" as const })),
    ...HEALTHCARE_TEMPLATE.map((t) => ({ ...t, industry: "HEALTHCARE" as const })),
    ...GENERIC_TEMPLATE.map((t) => ({ ...t, industry: "GENERIC" as const })),
    ...INSURANCE_TEMPLATE.map((t) => ({ ...t, industry: "INSURANCE" as const })),
    ...PHARMA_TEMPLATE.map((t) => ({ ...t, industry: "PHARMA_LIFESCIENCES" as const })),
    ...TELECOM_TEMPLATE.map((t) => ({ ...t, industry: "TELECOM" as const })),
    ...ENERGY_UTILITIES_TEMPLATE.map((t) => ({ ...t, industry: "ENERGY_UTILITIES" as const })),
    ...PUBLIC_SECTOR_TEMPLATE.map((t) => ({ ...t, industry: "PUBLIC_SECTOR" as const })),
    ...ENTERPRISE_BCM_FULL.map((t) => ({ ...t, industry: "ENTERPRISE_BCM" as const })),
  ];

  for (const tpl of allTemplates) {
    await db.capabilityTemplate.upsert({
      where: { code: tpl.code },
      update: {
        name: tpl.name,
        description: (tpl as any).description ?? null,
        parentCode: (tpl as any).parentCode ?? null,
        sortOrder: tpl.sortOrder,
        level: tpl.level as any,
        isActive: (tpl as any).isActive !== false,
        strategicImportance: ((tpl as any).strategicImportance ?? "NOT_ASSESSED") as any,
        band: (tpl as any).band ?? null,
      },
      create: {
        code: tpl.code,
        industry: tpl.industry,
        level: tpl.level as any,
        name: tpl.name,
        description: (tpl as any).description ?? null,
        parentCode: (tpl as any).parentCode ?? null,
        sortOrder: tpl.sortOrder,
        isActive: (tpl as any).isActive !== false,
        strategicImportance: ((tpl as any).strategicImportance ?? "NOT_ASSESSED") as any,
        band: (tpl as any).band ?? null,
      },
    });
  }

  console.log(`Seeded ${allTemplates.length} templates`);

  // Optional: seed demo applications into a specific workspace
  const demoWsId = process.env.DEMO_WORKSPACE_ID;
  if (demoWsId) {
    await seedDemoApplications(demoWsId);
    await seedTechArchitecture(demoWsId);
  }
}

// ─── Demo Application Seed Data ──────────────────────────
// Run with: DEMO_WORKSPACE_ID=<id> npx tsx prisma/seed.ts

const DEMO_APPS = [
  {
    name: "SAP S/4HANA",
    vendor: "SAP",
    applicationType: "COTS" as const,
    deploymentModel: "HYBRID" as const,
    lifecycle: "ACTIVE" as const,
    businessValue: "CRITICAL" as const,
    technicalHealth: "GOOD" as const,
    functionalFit: "EXCELLENT" as const,
    dataClassification: "CONFIDENTIAL" as const,
    rationalizationStatus: "INVEST" as const,
    annualCostUsd: 480000,
    costModel: "LICENSE_FLAT" as const,
    licensedUsers: 2000,
    actualUsers: 1850,
    description: "Core ERP for finance, procurement, and supply chain",
  },
  {
    name: "Salesforce CRM",
    vendor: "Salesforce",
    applicationType: "SAAS" as const,
    deploymentModel: "SAAS_HOSTED" as const,
    lifecycle: "ACTIVE" as const,
    businessValue: "HIGH" as const,
    technicalHealth: "EXCELLENT" as const,
    functionalFit: "GOOD" as const,
    dataClassification: "CONFIDENTIAL" as const,
    rationalizationStatus: "TOLERATE" as const,
    annualCostUsd: 180000,
    costModel: "LICENSE_PER_USER" as const,
    licensedUsers: 500,
    actualUsers: 420,
    description: "Customer relationship management and sales pipeline",
  },
  {
    name: "ServiceNow ITSM",
    vendor: "ServiceNow",
    applicationType: "SAAS" as const,
    deploymentModel: "SAAS_HOSTED" as const,
    lifecycle: "ACTIVE" as const,
    businessValue: "HIGH" as const,
    technicalHealth: "GOOD" as const,
    functionalFit: "GOOD" as const,
    dataClassification: "INTERNAL" as const,
    rationalizationStatus: "TOLERATE" as const,
    annualCostUsd: 120000,
    costModel: "SUBSCRIPTION" as const,
    licensedUsers: 800,
    actualUsers: 650,
    description: "IT service management, incident and change tracking",
  },
  {
    name: "Legacy HR System",
    vendor: "In-House",
    applicationType: "LEGACY" as const,
    deploymentModel: "ON_PREMISE" as const,
    lifecycle: "PHASING_OUT" as const,
    businessValue: "MEDIUM" as const,
    technicalHealth: "POOR" as const,
    functionalFit: "POOR" as const,
    dataClassification: "RESTRICTED" as const,
    rationalizationStatus: "MIGRATE" as const,
    annualCostUsd: 95000,
    costModel: "INTERNAL" as const,
    licensedUsers: 3000,
    actualUsers: 2800,
    description: "Legacy payroll and HR management — being replaced by Workday",
  },
  {
    name: "Workday HCM",
    vendor: "Workday",
    applicationType: "SAAS" as const,
    deploymentModel: "SAAS_HOSTED" as const,
    lifecycle: "PLANNED" as const,
    businessValue: "HIGH" as const,
    technicalHealth: "EXCELLENT" as const,
    functionalFit: "EXCELLENT" as const,
    dataClassification: "RESTRICTED" as const,
    rationalizationStatus: "INVEST" as const,
    annualCostUsd: 220000,
    costModel: "LICENSE_PER_USER" as const,
    licensedUsers: 3000,
    actualUsers: null,
    description: "Next-gen HCM platform — replacing Legacy HR System",
  },
  {
    name: "Confluence Wiki",
    vendor: "Atlassian",
    applicationType: "SAAS" as const,
    deploymentModel: "SAAS_HOSTED" as const,
    lifecycle: "ACTIVE" as const,
    businessValue: "LOW" as const,
    technicalHealth: "FAIR" as const,
    functionalFit: "ADEQUATE" as const,
    dataClassification: "INTERNAL" as const,
    rationalizationStatus: "RAT_NOT_ASSESSED" as const,
    annualCostUsd: 18000,
    costModel: "SUBSCRIPTION" as const,
    licensedUsers: 1500,
    actualUsers: 310,
    description: "Internal knowledge base and documentation platform",
  },
  {
    name: "Custom Reporting Tool",
    vendor: null,
    applicationType: "CUSTOM" as const,
    deploymentModel: "ON_PREMISE" as const,
    lifecycle: "SUNSET" as const,
    businessValue: "LOW" as const,
    technicalHealth: "TH_CRITICAL" as const,
    functionalFit: "UNFIT" as const,
    dataClassification: "CONFIDENTIAL" as const,
    rationalizationStatus: "ELIMINATE" as const,
    annualCostUsd: 35000,
    costModel: "INTERNAL" as const,
    licensedUsers: 200,
    actualUsers: 12,
    description: "Outdated VB.NET reporting tool — replaced by Power BI",
  },
  {
    name: "Microsoft Power BI",
    vendor: "Microsoft",
    applicationType: "SAAS" as const,
    deploymentModel: "CLOUD_PUBLIC" as const,
    lifecycle: "ACTIVE" as const,
    businessValue: "HIGH" as const,
    technicalHealth: "EXCELLENT" as const,
    functionalFit: "GOOD" as const,
    dataClassification: "CONFIDENTIAL" as const,
    rationalizationStatus: "INVEST" as const,
    annualCostUsd: 45000,
    costModel: "LICENSE_PER_USER" as const,
    licensedUsers: 400,
    actualUsers: 350,
    description: "Business intelligence and analytics dashboards",
  },
  {
    name: "MuleSoft Anypoint",
    vendor: "Salesforce",
    applicationType: "PAAS" as const,
    deploymentModel: "CLOUD_PUBLIC" as const,
    lifecycle: "ACTIVE" as const,
    businessValue: "HIGH" as const,
    technicalHealth: "GOOD" as const,
    functionalFit: "GOOD" as const,
    dataClassification: "INTERNAL" as const,
    rationalizationStatus: "TOLERATE" as const,
    annualCostUsd: 160000,
    costModel: "SUBSCRIPTION" as const,
    licensedUsers: null,
    actualUsers: null,
    description: "Integration platform — API gateway and ESB",
  },
  {
    name: "SharePoint Intranet",
    vendor: "Microsoft",
    applicationType: "SAAS" as const,
    deploymentModel: "SAAS_HOSTED" as const,
    lifecycle: "ACTIVE" as const,
    businessValue: "MEDIUM" as const,
    technicalHealth: "FAIR" as const,
    functionalFit: "ADEQUATE" as const,
    dataClassification: "INTERNAL" as const,
    rationalizationStatus: "TOLERATE" as const,
    annualCostUsd: 25000,
    costModel: "SUBSCRIPTION" as const,
    licensedUsers: 3000,
    actualUsers: 1200,
    description: "Company intranet portal and document management",
  },
];

// Interface definitions — reference apps by name, resolved at insert time
const DEMO_INTERFACES = [
  {
    sourceName: "SAP S/4HANA",
    targetName: "Salesforce CRM",
    name: "Customer Master Data Sync",
    protocol: "REST_API" as const,
    direction: "BIDIRECTIONAL" as const,
    criticality: "INT_CRITICAL" as const,
    status: "INT_ACTIVE" as const,
    dataClassification: "CONFIDENTIAL" as const,
    frequency: "Real-time",
    dataFlowDescription: "Customer master records synced bidirectionally between ERP and CRM",
  },
  {
    sourceName: "SAP S/4HANA",
    targetName: "Microsoft Power BI",
    name: "Financial Data Feed",
    protocol: "REST_API" as const,
    direction: "OUTBOUND" as const,
    criticality: "INT_HIGH" as const,
    status: "INT_ACTIVE" as const,
    dataClassification: "CONFIDENTIAL" as const,
    frequency: "Hourly",
    dataFlowDescription: "GL actuals and budget data pushed to BI dashboards",
  },
  {
    sourceName: "SAP S/4HANA",
    targetName: "Legacy HR System",
    name: "Employee Cost Center Feed",
    protocol: "FILE_TRANSFER" as const,
    direction: "OUTBOUND" as const,
    criticality: "INT_HIGH" as const,
    status: "INT_ACTIVE" as const,
    dataClassification: "RESTRICTED" as const,
    frequency: "Daily batch",
    dataFlowDescription: "Cost center allocations sent to HR for payroll processing",
  },
  {
    sourceName: "Salesforce CRM",
    targetName: "MuleSoft Anypoint",
    name: "Order API Gateway",
    protocol: "REST_API" as const,
    direction: "OUTBOUND" as const,
    criticality: "INT_CRITICAL" as const,
    status: "INT_ACTIVE" as const,
    dataClassification: "CONFIDENTIAL" as const,
    frequency: "Real-time",
    dataFlowDescription: "Sales orders routed through integration platform to ERP",
  },
  {
    sourceName: "MuleSoft Anypoint",
    targetName: "SAP S/4HANA",
    name: "Order Fulfillment API",
    protocol: "REST_API" as const,
    direction: "OUTBOUND" as const,
    criticality: "INT_CRITICAL" as const,
    status: "INT_ACTIVE" as const,
    dataClassification: "CONFIDENTIAL" as const,
    frequency: "Real-time",
    dataFlowDescription: "Validated orders posted to SAP for fulfillment",
  },
  {
    sourceName: "ServiceNow ITSM",
    targetName: "SAP S/4HANA",
    name: "Asset CMDB Sync",
    protocol: "REST_API" as const,
    direction: "BIDIRECTIONAL" as const,
    criticality: "INT_MEDIUM" as const,
    status: "INT_ACTIVE" as const,
    dataClassification: "INTERNAL" as const,
    frequency: "Every 15 minutes",
    dataFlowDescription: "IT asset records synced with ERP fixed asset module",
  },
  {
    sourceName: "Legacy HR System",
    targetName: "SAP S/4HANA",
    name: "Payroll Journal Posting",
    protocol: "FILE_TRANSFER" as const,
    direction: "OUTBOUND" as const,
    criticality: "INT_HIGH" as const,
    status: "INT_ACTIVE" as const,
    dataClassification: "RESTRICTED" as const,
    frequency: "Bi-weekly",
    dataFlowDescription: "Payroll journal entries posted to GL after each pay cycle",
  },
  {
    sourceName: "Custom Reporting Tool",
    targetName: "SAP S/4HANA",
    name: "Legacy Report Extract",
    protocol: "DATABASE_LINK" as const,
    direction: "INBOUND" as const,
    criticality: "INT_LOW" as const,
    status: "INT_DEPRECATED" as const,
    dataClassification: "CONFIDENTIAL" as const,
    frequency: "Nightly batch",
    dataFlowDescription: "Direct DB read from SAP — deprecated, migrating to Power BI",
  },
];

async function seedDemoApplications(workspaceId: string) {
  console.log(`Seeding demo applications into workspace ${workspaceId}...`);

  // Verify workspace exists
  const ws = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!ws) {
    console.error(`Workspace ${workspaceId} not found — skipping demo apps`);
    return;
  }

  // Upsert applications (keyed by name within workspace)
  const appIdMap: Record<string, string> = {};

  // Find Workday to set as replacement for Legacy HR
  for (const appData of DEMO_APPS) {
    const existing = await db.application.findFirst({
      where: { workspaceId, name: appData.name },
    });

    if (existing) {
      appIdMap[appData.name] = existing.id;
      console.log(`  ✓ ${appData.name} (exists)`);
      continue;
    }

    const created = await db.application.create({
      data: {
        workspaceId,
        name: appData.name,
        description: appData.description,
        vendor: appData.vendor,
        applicationType: appData.applicationType,
        deploymentModel: appData.deploymentModel,
        lifecycle: appData.lifecycle,
        businessValue: appData.businessValue,
        technicalHealth: appData.technicalHealth,
        functionalFit: appData.functionalFit,
        dataClassification: appData.dataClassification,
        rationalizationStatus: appData.rationalizationStatus,
        annualCostUsd: appData.annualCostUsd,
        costModel: appData.costModel,
        licensedUsers: appData.licensedUsers,
        actualUsers: appData.actualUsers,
      },
    });
    appIdMap[appData.name] = created.id;
    console.log(`  + ${appData.name}`);
  }

  // Set replacement: Legacy HR → Workday
  if (appIdMap["Legacy HR System"] && appIdMap["Workday HCM"]) {
    await db.application.update({
      where: { id: appIdMap["Legacy HR System"] },
      data: { replacementAppId: appIdMap["Workday HCM"] },
    });
  }

  // Seed interfaces
  for (const iface of DEMO_INTERFACES) {
    const sourceId = appIdMap[iface.sourceName];
    const targetId = appIdMap[iface.targetName];
    if (!sourceId || !targetId) {
      console.log(`  ⚠ Skipping interface ${iface.name} — app not found`);
      continue;
    }

    await db.applicationInterface.upsert({
      where: {
        workspaceId_sourceAppId_targetAppId_name: {
          workspaceId,
          sourceAppId: sourceId,
          targetAppId: targetId,
          name: iface.name,
        },
      },
      update: {
        protocol: iface.protocol,
        direction: iface.direction,
        criticality: iface.criticality,
        status: iface.status,
        dataClassification: iface.dataClassification,
        frequency: iface.frequency,
        dataFlowDescription: iface.dataFlowDescription,
      },
      create: {
        workspaceId,
        sourceAppId: sourceId,
        targetAppId: targetId,
        name: iface.name,
        protocol: iface.protocol,
        direction: iface.direction,
        criticality: iface.criticality,
        status: iface.status,
        dataClassification: iface.dataClassification,
        frequency: iface.frequency,
        dataFlowDescription: iface.dataFlowDescription,
      },
    });
    console.log(`  + Interface: ${iface.sourceName} → ${iface.targetName} (${iface.name})`);
  }

  console.log(`Seeded ${DEMO_APPS.length} apps and ${DEMO_INTERFACES.length} interfaces`);
}

// ─── Module 7: Technology Architecture Seed ──────────────────────────

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

const DEMO_VENDORS = [
  { name: "Amazon Web Services", category: "HYPERSCALER" as const, website: "https://aws.amazon.com", headquartersCountry: "USA", annualSpend: 1250000, status: "STRATEGIC" as const, description: "Primary public-cloud hyperscaler" },
  { name: "Microsoft", category: "SOFTWARE" as const, website: "https://microsoft.com", headquartersCountry: "USA", annualSpend: 680000, status: "STRATEGIC" as const, description: "Productivity, identity, and Azure services" },
  { name: "Google", category: "SOFTWARE" as const, website: "https://google.com", headquartersCountry: "USA", annualSpend: 120000, status: "ACTIVE" as const, description: "Workspace and data platform" },
  { name: "Oracle", category: "SOFTWARE" as const, website: "https://oracle.com", headquartersCountry: "USA", annualSpend: 960000, status: "UNDER_REVIEW" as const, description: "Database and middleware — consolidation candidate" },
  { name: "PostgreSQL Global Development Group", category: "OPEN_SOURCE_FOUNDATION" as const, website: "https://postgresql.org", headquartersCountry: "USA", annualSpend: 0, status: "ACTIVE" as const, description: "Community-maintained relational database" },
  { name: "Red Hat", category: "SOFTWARE" as const, website: "https://redhat.com", headquartersCountry: "USA", annualSpend: 145000, status: "ACTIVE" as const, description: "Linux and container platform" },
  { name: "Meta Open Source", category: "OPEN_SOURCE_FOUNDATION" as const, website: "https://opensource.fb.com", headquartersCountry: "USA", annualSpend: 0, status: "ACTIVE" as const, description: "React and related OSS" },
  { name: "HashiCorp", category: "SOFTWARE" as const, website: "https://hashicorp.com", headquartersCountry: "USA", annualSpend: 85000, status: "ACTIVE" as const, description: "Infrastructure automation" },
  { name: "Elastic", category: "SOFTWARE" as const, website: "https://elastic.co", headquartersCountry: "USA", annualSpend: 210000, status: "ACTIVE" as const, description: "Search and observability" },
  { name: "Internal Platform Team", category: "INTERNAL" as const, headquartersCountry: "Global", status: "ACTIVE" as const, description: "Internal shared services org" },
];

const DEMO_PRODUCTS = [
  // AWS
  { slug: "aws-ec2", vendor: "Amazon Web Services", name: "Amazon EC2", type: "CLOUD_SERVICE" as const, category: "IaaS Compute", licenseType: "COMMERCIAL" as const, openSource: false },
  { slug: "aws-rds", vendor: "Amazon Web Services", name: "Amazon RDS", type: "DATABASE" as const, category: "Managed DB", licenseType: "COMMERCIAL" as const, openSource: false },
  { slug: "aws-s3", vendor: "Amazon Web Services", name: "Amazon S3", type: "CLOUD_SERVICE" as const, category: "Object Storage", licenseType: "COMMERCIAL" as const, openSource: false },
  { slug: "aws-lambda", vendor: "Amazon Web Services", name: "AWS Lambda", type: "PLATFORM" as const, category: "Serverless", licenseType: "COMMERCIAL" as const, openSource: false },
  // Microsoft
  { slug: "azure-aks", vendor: "Microsoft", name: "Azure Kubernetes Service", type: "PLATFORM" as const, category: "Container Orchestration", licenseType: "COMMERCIAL" as const, openSource: false },
  { slug: "dotnet", vendor: "Microsoft", name: ".NET", type: "FRAMEWORK" as const, category: "Application Runtime", licenseType: "OSS_PERMISSIVE" as const, openSource: true },
  { slug: "sqlserver", vendor: "Microsoft", name: "SQL Server", type: "DATABASE" as const, category: "Relational DB", licenseType: "COMMERCIAL" as const, openSource: false },
  // Google
  { slug: "bigquery", vendor: "Google", name: "BigQuery", type: "DATABASE" as const, category: "Analytical DB", licenseType: "COMMERCIAL" as const, openSource: false },
  // Oracle
  { slug: "oracle-db", vendor: "Oracle", name: "Oracle Database", type: "DATABASE" as const, category: "Relational DB", licenseType: "COMMERCIAL" as const, openSource: false },
  { slug: "oracle-weblogic", vendor: "Oracle", name: "Oracle WebLogic", type: "MIDDLEWARE" as const, category: "Application Server", licenseType: "COMMERCIAL" as const, openSource: false },
  { slug: "java", vendor: "Oracle", name: "Java", type: "LANGUAGE" as const, category: "JVM Language", licenseType: "OSS_PERMISSIVE" as const, openSource: true },
  // PostgreSQL
  { slug: "postgres", vendor: "PostgreSQL Global Development Group", name: "PostgreSQL", type: "DATABASE" as const, category: "Relational DB", licenseType: "OSS_PERMISSIVE" as const, openSource: true },
  // Red Hat
  { slug: "rhel", vendor: "Red Hat", name: "Red Hat Enterprise Linux", type: "OPERATING_SYSTEM" as const, category: "Linux", licenseType: "COMMERCIAL" as const, openSource: false },
  { slug: "openshift", vendor: "Red Hat", name: "OpenShift", type: "PLATFORM" as const, category: "Container Platform", licenseType: "COMMERCIAL" as const, openSource: false },
  // Meta
  { slug: "react", vendor: "Meta Open Source", name: "React", type: "LIBRARY" as const, category: "UI Library", licenseType: "OSS_PERMISSIVE" as const, openSource: true },
  // HashiCorp
  { slug: "terraform", vendor: "HashiCorp", name: "Terraform", type: "PLATFORM" as const, category: "IaC", licenseType: "OSS_COPYLEFT" as const, openSource: true },
  { slug: "vault", vendor: "HashiCorp", name: "HashiCorp Vault", type: "PLATFORM" as const, category: "Secrets Management", licenseType: "OSS_COPYLEFT" as const, openSource: true },
  // Elastic
  { slug: "elasticsearch", vendor: "Elastic", name: "Elasticsearch", type: "DATABASE" as const, category: "Search Engine", licenseType: "OSS_COPYLEFT" as const, openSource: true },
  { slug: "kibana", vendor: "Elastic", name: "Kibana", type: "SOFTWARE" as const, category: "Observability", licenseType: "OSS_COPYLEFT" as const, openSource: true },
  // Internal
  { slug: "internal-api-gateway", vendor: "Internal Platform Team", name: "Internal API Gateway", type: "MIDDLEWARE" as const, category: "API Management", licenseType: "PROPRIETARY_INTERNAL" as const, openSource: false },
  { slug: "internal-kafka", vendor: "Internal Platform Team", name: "Internal Kafka Cluster", type: "MIDDLEWARE" as const, category: "Event Streaming", licenseType: "PROPRIETARY_INTERNAL" as const, openSource: false },
  // Container runtime (assign to Internal)
  { slug: "docker", vendor: "Internal Platform Team", name: "Docker Engine", type: "CONTAINER" as const, category: "Runtime", licenseType: "OSS_PERMISSIVE" as const, openSource: true },
];

type DemoVersionSeed = {
  productSlug: string;
  version: string;
  releaseDate?: Date | null;
  endOfSupportDate?: Date | null;
  endOfLifeDate?: Date | null;
  lifecycleStatus: "PREVIEW" | "CURRENT" | "MAINSTREAM" | "EXTENDED_SUPPORT" | "DEPRECATED" | "END_OF_LIFE";
  notes?: string | null;
};

const DEMO_VERSIONS: DemoVersionSeed[] = [
  // past-EOL (3 required)
  { productSlug: "oracle-db", version: "11g", releaseDate: new Date("2007-07-11"), endOfSupportDate: new Date("2015-01-31"), endOfLifeDate: new Date("2022-12-31"), lifecycleStatus: "END_OF_LIFE", notes: "Past EOL — consolidation target" },
  { productSlug: "java", version: "8", releaseDate: new Date("2014-03-18"), endOfSupportDate: new Date("2022-03-31"), endOfLifeDate: new Date("2025-03-31"), lifecycleStatus: "END_OF_LIFE", notes: "Past EOL — migrate to Java 17/21" },
  { productSlug: "dotnet", version: "Framework 4.8", releaseDate: new Date("2019-04-18"), endOfSupportDate: new Date("2025-01-09"), endOfLifeDate: new Date("2025-10-14"), lifecycleStatus: "END_OF_LIFE", notes: "Past EOL — migrate to .NET 8 LTS" },

  // EOL in next 90 days (3 required)
  { productSlug: "postgres", version: "13", releaseDate: new Date("2020-09-24"), endOfSupportDate: daysFromNow(30), endOfLifeDate: daysFromNow(45), lifecycleStatus: "DEPRECATED", notes: "Imminent EOL — upgrade to 15/16" },
  { productSlug: "rhel", version: "7", releaseDate: new Date("2014-06-09"), endOfSupportDate: daysFromNow(60), endOfLifeDate: daysFromNow(80), lifecycleStatus: "DEPRECATED", notes: "Extended maintenance ends soon" },
  { productSlug: "elasticsearch", version: "7.17", releaseDate: new Date("2022-02-08"), endOfSupportDate: daysFromNow(20), endOfLifeDate: daysFromNow(70), lifecycleStatus: "DEPRECATED", notes: "Upgrade to 8.x" },

  // current / mainstream
  { productSlug: "postgres", version: "15", releaseDate: new Date("2022-10-13"), endOfSupportDate: new Date("2027-11-11"), endOfLifeDate: new Date("2027-11-11"), lifecycleStatus: "CURRENT" },
  { productSlug: "postgres", version: "16", releaseDate: new Date("2023-09-14"), endOfSupportDate: new Date("2028-11-09"), endOfLifeDate: new Date("2028-11-09"), lifecycleStatus: "CURRENT" },
  { productSlug: "java", version: "17", releaseDate: new Date("2021-09-14"), endOfSupportDate: new Date("2029-09-30"), endOfLifeDate: new Date("2029-09-30"), lifecycleStatus: "CURRENT", notes: "LTS" },
  { productSlug: "java", version: "21", releaseDate: new Date("2023-09-19"), endOfSupportDate: new Date("2031-09-30"), endOfLifeDate: new Date("2031-09-30"), lifecycleStatus: "CURRENT", notes: "LTS" },
  { productSlug: "dotnet", version: "8", releaseDate: new Date("2023-11-14"), endOfSupportDate: new Date("2026-11-10"), endOfLifeDate: new Date("2026-11-10"), lifecycleStatus: "CURRENT", notes: "LTS" },
  { productSlug: "sqlserver", version: "2022", releaseDate: new Date("2022-11-16"), endOfSupportDate: new Date("2033-01-11"), endOfLifeDate: new Date("2033-01-11"), lifecycleStatus: "CURRENT" },
  { productSlug: "oracle-db", version: "19c", releaseDate: new Date("2019-02-13"), endOfSupportDate: new Date("2027-04-30"), endOfLifeDate: new Date("2027-04-30"), lifecycleStatus: "MAINSTREAM" },
  { productSlug: "oracle-db", version: "23c", releaseDate: new Date("2023-09-01"), endOfSupportDate: new Date("2033-04-30"), endOfLifeDate: new Date("2033-04-30"), lifecycleStatus: "CURRENT" },
  { productSlug: "oracle-weblogic", version: "14.1.1", releaseDate: new Date("2020-03-01"), endOfSupportDate: new Date("2030-12-31"), endOfLifeDate: new Date("2030-12-31"), lifecycleStatus: "MAINSTREAM" },
  { productSlug: "rhel", version: "9", releaseDate: new Date("2022-05-18"), endOfSupportDate: new Date("2032-05-31"), endOfLifeDate: new Date("2032-05-31"), lifecycleStatus: "CURRENT" },
  { productSlug: "openshift", version: "4.14", releaseDate: new Date("2023-10-31"), endOfSupportDate: new Date("2025-10-31"), endOfLifeDate: new Date("2025-10-31"), lifecycleStatus: "MAINSTREAM" },
  { productSlug: "react", version: "18", releaseDate: new Date("2022-03-29"), lifecycleStatus: "MAINSTREAM" },
  { productSlug: "react", version: "19", releaseDate: new Date("2024-12-05"), lifecycleStatus: "CURRENT" },
  { productSlug: "terraform", version: "1.8", releaseDate: new Date("2024-04-10"), lifecycleStatus: "CURRENT" },
  { productSlug: "vault", version: "1.15", releaseDate: new Date("2023-09-27"), lifecycleStatus: "CURRENT" },
  { productSlug: "elasticsearch", version: "8.13", releaseDate: new Date("2024-03-26"), lifecycleStatus: "CURRENT" },
  { productSlug: "kibana", version: "8.13", releaseDate: new Date("2024-03-26"), lifecycleStatus: "CURRENT" },
  { productSlug: "aws-ec2", version: "current", lifecycleStatus: "CURRENT" },
  { productSlug: "aws-rds", version: "current", lifecycleStatus: "CURRENT" },
  { productSlug: "aws-s3", version: "current", lifecycleStatus: "CURRENT" },
  { productSlug: "aws-lambda", version: "current", lifecycleStatus: "CURRENT" },
  { productSlug: "azure-aks", version: "1.29", lifecycleStatus: "CURRENT" },
  { productSlug: "bigquery", version: "current", lifecycleStatus: "CURRENT" },
  { productSlug: "docker", version: "25.0", releaseDate: new Date("2024-01-19"), lifecycleStatus: "CURRENT" },
  { productSlug: "internal-api-gateway", version: "2.4", lifecycleStatus: "CURRENT" },
  { productSlug: "internal-kafka", version: "3.7", lifecycleStatus: "CURRENT" },
];

type DemoComponentSeed = {
  productSlug: string;
  versionKey?: string | null;
  name: string;
  environment: "PRODUCTION" | "STAGING" | "TEST" | "DEVELOPMENT" | "DR" | "SHARED";
  hostingModel: "ON_PREMISES" | "PRIVATE_CLOUD" | "PUBLIC_IAAS" | "PUBLIC_PAAS" | "SAAS" | "HYBRID";
  region?: string | null;
  notes?: string | null;
  apps?: { appName: string; layer: "PRESENTATION" | "APPLICATION" | "DATA" | "INTEGRATION" | "INFRASTRUCTURE" | "SECURITY"; role: "PRIMARY" | "SECONDARY" | "FALLBACK" | "DEPRECATED"; criticality: "CRITICAL" | "IMPORTANT" | "STANDARD" | "OPTIONAL" }[];
};

const DEMO_COMPONENTS: DemoComponentSeed[] = [
  { productSlug: "postgres", versionKey: "15", name: "Prod Postgres — us-east-1", environment: "PRODUCTION", hostingModel: "PUBLIC_PAAS", region: "us-east-1",
    apps: [{ appName: "Salesforce CRM", layer: "DATA", role: "PRIMARY", criticality: "CRITICAL" }] },
  { productSlug: "postgres", versionKey: "13", name: "Legacy Postgres — us-east-1", environment: "PRODUCTION", hostingModel: "PUBLIC_PAAS", region: "us-east-1", notes: "On deprecated version — imminent EOL",
    apps: [{ appName: "Custom Reporting Tool", layer: "DATA", role: "PRIMARY", criticality: "IMPORTANT" }] },
  { productSlug: "oracle-db", versionKey: "11g", name: "Oracle GL DB", environment: "PRODUCTION", hostingModel: "ON_PREMISES", region: "dc-1", notes: "Past-EOL Oracle 11g",
    apps: [{ appName: "SAP S/4HANA", layer: "DATA", role: "PRIMARY", criticality: "CRITICAL" }] },
  { productSlug: "oracle-db", versionKey: "19c", name: "Oracle Data Warehouse", environment: "PRODUCTION", hostingModel: "ON_PREMISES", region: "dc-1" },
  { productSlug: "sqlserver", versionKey: "2022", name: "SQL Server Prod", environment: "PRODUCTION", hostingModel: "PRIVATE_CLOUD", region: "dc-2",
    apps: [{ appName: "ServiceNow ITSM", layer: "DATA", role: "PRIMARY", criticality: "IMPORTANT" }] },
  { productSlug: "aws-ec2", versionKey: "current", name: "App Fleet — us-east-1", environment: "PRODUCTION", hostingModel: "PUBLIC_IAAS", region: "us-east-1",
    apps: [{ appName: "MuleSoft Anypoint", layer: "INFRASTRUCTURE", role: "PRIMARY", criticality: "CRITICAL" }] },
  { productSlug: "aws-s3", versionKey: "current", name: "Data Lake Bucket", environment: "PRODUCTION", hostingModel: "PUBLIC_PAAS", region: "us-east-1",
    apps: [{ appName: "Microsoft Power BI", layer: "DATA", role: "SECONDARY", criticality: "STANDARD" }] },
  { productSlug: "aws-lambda", versionKey: "current", name: "Integration Functions", environment: "PRODUCTION", hostingModel: "PUBLIC_PAAS", region: "us-east-1",
    apps: [{ appName: "MuleSoft Anypoint", layer: "INTEGRATION", role: "SECONDARY", criticality: "IMPORTANT" }] },
  { productSlug: "aws-rds", versionKey: "current", name: "Prod RDS Postgres", environment: "PRODUCTION", hostingModel: "PUBLIC_PAAS", region: "us-east-1" },
  { productSlug: "azure-aks", versionKey: "1.29", name: "AKS Shared Cluster", environment: "PRODUCTION", hostingModel: "PUBLIC_PAAS", region: "east-us" },
  { productSlug: "bigquery", versionKey: "current", name: "Analytics Warehouse", environment: "PRODUCTION", hostingModel: "PUBLIC_PAAS", region: "us-central1",
    apps: [{ appName: "Microsoft Power BI", layer: "DATA", role: "PRIMARY", criticality: "IMPORTANT" }] },
  { productSlug: "dotnet", versionKey: "Framework 4.8", name: ".NET Framework Runtime", environment: "PRODUCTION", hostingModel: "ON_PREMISES", region: "dc-1", notes: "Past-EOL runtime",
    apps: [{ appName: "Legacy HR System", layer: "APPLICATION", role: "PRIMARY", criticality: "IMPORTANT" }] },
  { productSlug: "dotnet", versionKey: "8", name: ".NET 8 Runtime", environment: "PRODUCTION", hostingModel: "PUBLIC_PAAS", region: "us-east-1",
    apps: [{ appName: "Workday HCM", layer: "APPLICATION", role: "PRIMARY", criticality: "STANDARD" }] },
  { productSlug: "java", versionKey: "8", name: "Legacy Java 8 Runtime", environment: "PRODUCTION", hostingModel: "ON_PREMISES", region: "dc-1", notes: "Past-EOL Java 8",
    apps: [{ appName: "Custom Reporting Tool", layer: "APPLICATION", role: "PRIMARY", criticality: "IMPORTANT" }] },
  { productSlug: "java", versionKey: "17", name: "Java 17 LTS Runtime", environment: "PRODUCTION", hostingModel: "PUBLIC_IAAS", region: "us-east-1",
    apps: [{ appName: "MuleSoft Anypoint", layer: "APPLICATION", role: "PRIMARY", criticality: "CRITICAL" }] },
  { productSlug: "oracle-weblogic", versionKey: "14.1.1", name: "WebLogic Cluster", environment: "PRODUCTION", hostingModel: "ON_PREMISES", region: "dc-1" },
  { productSlug: "rhel", versionKey: "7", name: "Legacy RHEL 7 Hosts", environment: "PRODUCTION", hostingModel: "ON_PREMISES", region: "dc-1", notes: "RHEL 7 — imminent EOL" },
  { productSlug: "rhel", versionKey: "9", name: "RHEL 9 Hosts", environment: "PRODUCTION", hostingModel: "ON_PREMISES", region: "dc-1" },
  { productSlug: "openshift", versionKey: "4.14", name: "OpenShift Shared Cluster", environment: "SHARED", hostingModel: "ON_PREMISES", region: "dc-1" },
  { productSlug: "react", versionKey: "19", name: "React 19 (Frontend)", environment: "PRODUCTION", hostingModel: "PUBLIC_PAAS", region: "us-east-1",
    apps: [{ appName: "Salesforce CRM", layer: "PRESENTATION", role: "PRIMARY", criticality: "STANDARD" }] },
  { productSlug: "terraform", versionKey: "1.8", name: "IaC Control Plane", environment: "SHARED", hostingModel: "PRIVATE_CLOUD", region: "us-east-1" },
  { productSlug: "vault", versionKey: "1.15", name: "Vault Cluster", environment: "PRODUCTION", hostingModel: "PRIVATE_CLOUD", region: "us-east-1",
    apps: [{ appName: "ServiceNow ITSM", layer: "SECURITY", role: "PRIMARY", criticality: "CRITICAL" }] },
  { productSlug: "elasticsearch", versionKey: "7.17", name: "Legacy ES 7 Cluster", environment: "PRODUCTION", hostingModel: "PRIVATE_CLOUD", region: "us-east-1", notes: "On EOL track" },
  { productSlug: "elasticsearch", versionKey: "8.13", name: "ES 8 Cluster", environment: "PRODUCTION", hostingModel: "PRIVATE_CLOUD", region: "us-east-1" },
  { productSlug: "kibana", versionKey: "8.13", name: "Kibana 8", environment: "PRODUCTION", hostingModel: "PRIVATE_CLOUD", region: "us-east-1" },
  { productSlug: "internal-api-gateway", versionKey: "2.4", name: "Internal API Gateway — Prod", environment: "PRODUCTION", hostingModel: "PRIVATE_CLOUD", region: "us-east-1",
    apps: [{ appName: "MuleSoft Anypoint", layer: "INTEGRATION", role: "PRIMARY", criticality: "CRITICAL" }] },
  { productSlug: "internal-kafka", versionKey: "3.7", name: "Kafka Shared Cluster", environment: "SHARED", hostingModel: "PRIVATE_CLOUD", region: "us-east-1" },
  { productSlug: "docker", versionKey: "25.0", name: "Docker Hosts — Shared", environment: "SHARED", hostingModel: "PRIVATE_CLOUD", region: "us-east-1" },
  { productSlug: "postgres", versionKey: "15", name: "Staging Postgres", environment: "STAGING", hostingModel: "PUBLIC_PAAS", region: "us-east-1" },
  { productSlug: "aws-ec2", versionKey: "current", name: "DR Fleet — us-west-2", environment: "DR", hostingModel: "PUBLIC_IAAS", region: "us-west-2" },
];

async function seedTechArchitecture(workspaceId: string) {
  console.log(`Seeding Module 7 (Tech Architecture) into workspace ${workspaceId}...`);

  const ws = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!ws) {
    console.error(`Workspace ${workspaceId} not found — skipping tech architecture`);
    return;
  }

  // ── Vendors (idempotent upsert by workspace+name unique) ──
  const vendorIdByName: Record<string, string> = {};
  for (const v of DEMO_VENDORS) {
    const vendor = await db.vendor.upsert({
      where: { workspaceId_name: { workspaceId, name: v.name } },
      update: {
        category: v.category,
        website: v.website ?? null,
        headquartersCountry: v.headquartersCountry ?? null,
        annualSpend: v.annualSpend ?? null,
        status: v.status,
        description: v.description ?? null,
      },
      create: {
        workspaceId,
        name: v.name,
        category: v.category,
        website: v.website ?? null,
        headquartersCountry: v.headquartersCountry ?? null,
        annualSpend: v.annualSpend ?? null,
        status: v.status,
        description: v.description ?? null,
      },
    });
    vendorIdByName[v.name] = vendor.id;
  }
  console.log(`  ✓ ${DEMO_VENDORS.length} vendors`);

  // ── Products (idempotent upsert by workspace+slug) ──
  const productIdBySlug: Record<string, string> = {};
  for (const p of DEMO_PRODUCTS) {
    const vendorId = vendorIdByName[p.vendor];
    if (!vendorId) {
      console.log(`  ⚠ Skipping product ${p.name} — vendor ${p.vendor} not found`);
      continue;
    }
    const product = await db.technologyProduct.upsert({
      where: { workspaceId_slug: { workspaceId, slug: p.slug } },
      update: {
        name: p.name,
        type: p.type,
        category: p.category ?? null,
        licenseType: p.licenseType,
        openSource: p.openSource,
        vendorId,
      },
      create: {
        workspaceId,
        vendorId,
        slug: p.slug,
        name: p.name,
        type: p.type,
        category: p.category ?? null,
        licenseType: p.licenseType,
        openSource: p.openSource,
      },
    });
    productIdBySlug[p.slug] = product.id;
  }
  console.log(`  ✓ ${DEMO_PRODUCTS.length} products`);

  // ── Versions (idempotent upsert by productId+version) ──
  const versionIdByKey: Record<string, string> = {};
  for (const v of DEMO_VERSIONS) {
    const productId = productIdBySlug[v.productSlug];
    if (!productId) {
      console.log(`  ⚠ Skipping version ${v.version} — product ${v.productSlug} not found`);
      continue;
    }
    const version = await db.technologyVersion.upsert({
      where: { productId_version: { productId, version: v.version } },
      update: {
        releaseDate: v.releaseDate ?? null,
        endOfSupportDate: v.endOfSupportDate ?? null,
        endOfLifeDate: v.endOfLifeDate ?? null,
        lifecycleStatus: v.lifecycleStatus,
        notes: v.notes ?? null,
      },
      create: {
        workspaceId,
        productId,
        version: v.version,
        releaseDate: v.releaseDate ?? null,
        endOfSupportDate: v.endOfSupportDate ?? null,
        endOfLifeDate: v.endOfLifeDate ?? null,
        lifecycleStatus: v.lifecycleStatus,
        notes: v.notes ?? null,
      },
    });
    versionIdByKey[`${v.productSlug}::${v.version}`] = version.id;
  }
  console.log(`  ✓ ${DEMO_VERSIONS.length} versions`);

  // ── Components (idempotent via findFirst by workspace+name+product) ──
  let componentCount = 0;
  for (const c of DEMO_COMPONENTS) {
    const productId = productIdBySlug[c.productSlug];
    if (!productId) continue;
    const versionId = c.versionKey ? versionIdByKey[`${c.productSlug}::${c.versionKey}`] ?? null : null;

    const existing = await db.technologyComponent.findFirst({
      where: { workspaceId, productId, name: c.name },
    });

    let component;
    if (existing) {
      component = await db.technologyComponent.update({
        where: { id: existing.id },
        data: {
          versionId,
          environment: c.environment,
          hostingModel: c.hostingModel,
          region: c.region ?? null,
          notes: c.notes ?? null,
        },
      });
    } else {
      component = await db.technologyComponent.create({
        data: {
          workspaceId,
          productId,
          versionId,
          name: c.name,
          environment: c.environment,
          hostingModel: c.hostingModel,
          region: c.region ?? null,
          notes: c.notes ?? null,
        },
      });
    }
    componentCount += 1;

    // Link to apps
    if (c.apps) {
      for (const link of c.apps) {
        const app = await db.application.findFirst({
          where: { workspaceId, name: link.appName },
        });
        if (!app) continue;
        await db.applicationTechnology.upsert({
          where: {
            applicationId_componentId: { applicationId: app.id, componentId: component.id },
          },
          update: {
            layer: link.layer,
            role: link.role,
            criticality: link.criticality,
          },
          create: {
            applicationId: app.id,
            componentId: component.id,
            layer: link.layer,
            role: link.role,
            criticality: link.criticality,
          },
        });
      }
    }
  }
  console.log(`  ✓ ${componentCount} components (with app links)`);

  // ── Dependencies (idempotent: unique on [source, target, type]) ──
  const deps: { source: string; target: string; type: "REQUIRES" | "RUNS_ON" | "COMPATIBLE_WITH" | "CONFLICTS_WITH" | "REPLACES"; constraint?: string }[] = [
    { source: "react", target: "dotnet", type: "RUNS_ON" },
    { source: "java", target: "rhel", type: "RUNS_ON" },
    { source: "openshift", target: "rhel", type: "REQUIRES", constraint: ">= 8" },
    { source: "kibana", target: "elasticsearch", type: "REQUIRES", constraint: ">= 7" },
    { source: "docker", target: "rhel", type: "RUNS_ON" },
    { source: "postgres", target: "rhel", type: "RUNS_ON" },
  ];
  let depCount = 0;
  for (const d of deps) {
    const src = productIdBySlug[d.source];
    const tgt = productIdBySlug[d.target];
    if (!src || !tgt) continue;
    const existing = await db.technologyDependency.findFirst({
      where: { sourceProductId: src, targetProductId: tgt, dependencyType: d.type },
    });
    if (existing) {
      await db.technologyDependency.update({
        where: { id: existing.id },
        data: { versionConstraint: d.constraint ?? null },
      });
    } else {
      await db.technologyDependency.create({
        data: {
          workspaceId,
          sourceProductId: src,
          targetProductId: tgt,
          dependencyType: d.type,
          versionConstraint: d.constraint ?? null,
        },
      });
    }
    depCount += 1;
  }
  console.log(`  ✓ ${depCount} dependencies`);

  // ── Standards (idempotent via findFirst on workspace+name) ──
  const standards: {
    name: string;
    description: string;
    category:
      | "PRODUCT_CHOICE"
      | "VERSION_CHOICE"
      | "PROTOCOL"
      | "SECURITY"
      | "ARCHITECTURE_PATTERN"
      | "HOSTING"
      | "INTEGRATION"
      | "DATA"
      | "OTHER";
    level: "MANDATORY" | "RECOMMENDED" | "DEPRECATED" | "PROHIBITED";
    status: "DRAFT" | "ACTIVE" | "RETIRED";
    productSlug?: string;
    versionKey?: string;
    rationale?: string;
    reviewInDays?: number;
  }[] = [
    {
      name: "PostgreSQL as primary RDBMS",
      description: "Use PostgreSQL for all new OLTP workloads.",
      category: "PRODUCT_CHOICE",
      level: "MANDATORY",
      status: "ACTIVE",
      productSlug: "postgres",
      rationale: "Strategic open-source standard; replaces Oracle 11g legacy footprint.",
      reviewInDays: 365,
    },
    {
      name: "Oracle 11g prohibited",
      description: "Oracle 11g is past EOL; no new usage permitted.",
      category: "VERSION_CHOICE",
      level: "PROHIBITED",
      status: "ACTIVE",
      productSlug: "oracle-db",
      versionKey: "11g",
      rationale: "Past end-of-support; security patches unavailable.",
    },
    {
      name: "React for web UIs",
      description: "New customer-facing web apps should use React.",
      category: "PRODUCT_CHOICE",
      level: "RECOMMENDED",
      status: "ACTIVE",
      productSlug: "react",
    },
    {
      name: ".NET Framework 4.8 deprecated",
      description: "Migrate .NET Framework 4.8 workloads to .NET 8+",
      category: "VERSION_CHOICE",
      level: "DEPRECATED",
      status: "ACTIVE",
      productSlug: "dotnet",
      versionKey: "Framework 4.8",
      rationale: "End of innovation; .NET Core line is the forward path.",
    },
    {
      name: "RHEL 7 prohibited",
      description: "RHEL 7 reaches EOL; all new deployments must use RHEL 9+.",
      category: "VERSION_CHOICE",
      level: "PROHIBITED",
      status: "ACTIVE",
      productSlug: "rhel",
      versionKey: "7",
    },
    {
      name: "Containerize on OpenShift",
      description: "New services should deploy on OpenShift where possible.",
      category: "HOSTING",
      level: "RECOMMENDED",
      status: "ACTIVE",
      productSlug: "openshift",
    },
    {
      name: "TLS 1.3 for external traffic",
      description: "All public-facing interfaces must enforce TLS 1.3.",
      category: "SECURITY",
      level: "MANDATORY",
      status: "ACTIVE",
      rationale: "Security & compliance baseline.",
      reviewInDays: 180,
    },
  ];

  let standardCount = 0;
  for (const s of standards) {
    const productId = s.productSlug ? productIdBySlug[s.productSlug] ?? null : null;
    const versionId =
      s.productSlug && s.versionKey
        ? versionIdByKey[`${s.productSlug}::${s.versionKey}`] ?? null
        : null;
    const reviewDate = s.reviewInDays
      ? new Date(Date.now() + s.reviewInDays * 86_400_000)
      : null;

    const existing = await db.technologyStandard.findFirst({
      where: { workspaceId, name: s.name },
    });
    if (existing) {
      await db.technologyStandard.update({
        where: { id: existing.id },
        data: {
          description: s.description,
          category: s.category,
          level: s.level,
          status: s.status,
          productId,
          versionId,
          rationale: s.rationale ?? null,
          reviewDate,
        },
      });
    } else {
      await db.technologyStandard.create({
        data: {
          workspaceId,
          name: s.name,
          description: s.description,
          category: s.category,
          level: s.level,
          status: s.status,
          productId,
          versionId,
          rationale: s.rationale ?? null,
          reviewDate,
        },
      });
    }
    standardCount += 1;
  }
  console.log(`  ✓ ${standardCount} standards`);

  // ── Reference Architectures (idempotent via unique [workspaceId, slug]) ──
  const refArchs: {
    name: string;
    slug: string;
    description: string;
    category: string;
    status: "DRAFT" | "ACTIVE" | "DEPRECATED";
    components: {
      productSlug: string;
      layer:
        | "PRESENTATION"
        | "APPLICATION"
        | "DATA"
        | "INTEGRATION"
        | "INFRASTRUCTURE"
        | "SECURITY";
      role: "PRIMARY" | "SECONDARY" | "FALLBACK" | "DEPRECATED";
      notes?: string;
    }[];
  }[] = [
    {
      name: "Modern Web Application",
      slug: "modern-web-app",
      description:
        "Reference pattern for a customer-facing web application: React SPA, Java backend, Postgres, on OpenShift.",
      category: "Web Application",
      status: "ACTIVE",
      components: [
        { productSlug: "react", layer: "PRESENTATION", role: "PRIMARY" },
        { productSlug: "java", layer: "APPLICATION", role: "PRIMARY" },
        { productSlug: "postgres", layer: "DATA", role: "PRIMARY" },
        { productSlug: "openshift", layer: "INFRASTRUCTURE", role: "PRIMARY" },
        { productSlug: "elasticsearch", layer: "DATA", role: "SECONDARY", notes: "Search index" },
      ],
    },
    {
      name: "Data Pipeline (Streaming)",
      slug: "data-pipeline-streaming",
      description:
        "Reference pattern for streaming ingestion pipelines: Kafka → Java processors → Postgres warehouse, with Elasticsearch for operational dashboards.",
      category: "Data Pipeline",
      status: "ACTIVE",
      components: [
        { productSlug: "internal-kafka", layer: "INTEGRATION", role: "PRIMARY" },
        { productSlug: "java", layer: "APPLICATION", role: "PRIMARY" },
        { productSlug: "postgres", layer: "DATA", role: "PRIMARY" },
        { productSlug: "elasticsearch", layer: "DATA", role: "SECONDARY" },
        { productSlug: "rhel", layer: "INFRASTRUCTURE", role: "PRIMARY" },
      ],
    },
  ];

  let archCount = 0;
  for (const arch of refArchs) {
    const existing = await db.referenceArchitecture.findFirst({
      where: { workspaceId, slug: arch.slug },
    });
    const archRecord = existing
      ? await db.referenceArchitecture.update({
          where: { id: existing.id },
          data: {
            name: arch.name,
            description: arch.description,
            category: arch.category,
            status: arch.status,
          },
        })
      : await db.referenceArchitecture.create({
          data: {
            workspaceId,
            name: arch.name,
            slug: arch.slug,
            description: arch.description,
            category: arch.category,
            status: arch.status,
          },
        });

    for (const c of arch.components) {
      const productId = productIdBySlug[c.productSlug];
      if (!productId) continue;
      await db.referenceArchitectureComponent.upsert({
        where: {
          architectureId_productId: {
            architectureId: archRecord.id,
            productId,
          },
        },
        create: {
          architectureId: archRecord.id,
          productId,
          layer: c.layer,
          role: c.role,
          notes: c.notes ?? null,
        },
        update: {
          layer: c.layer,
          role: c.role,
          notes: c.notes ?? null,
        },
      });
    }
    archCount += 1;
  }
  console.log(`  ✓ ${archCount} reference architectures`);

  console.log(`Seeded Module 7 tech architecture data`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
