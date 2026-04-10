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

async function main() {
  console.log("Seeding industry templates...");

  const allTemplates = [
    ...BANKING_TEMPLATE.map((t) => ({ ...t, industry: "BANKING" as const })),
    ...RETAIL_TEMPLATE.map((t) => ({ ...t, industry: "RETAIL" as const })),
    ...LOGISTICS_TEMPLATE.map((t) => ({ ...t, industry: "LOGISTICS" as const })),
    ...MANUFACTURING_TEMPLATE.map((t) => ({ ...t, industry: "MANUFACTURING" as const })),
    ...HEALTHCARE_TEMPLATE.map((t) => ({ ...t, industry: "HEALTHCARE" as const })),
    ...GENERIC_TEMPLATE.map((t) => ({ ...t, industry: "GENERIC" as const })),
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
