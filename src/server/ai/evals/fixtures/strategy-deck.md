# Acme Retail — Current State & Direction (Q2 Review)

## Systems of record

Our primary customer relationship management system is **Salesforce
Sales Cloud**, used by the Revenue Ops organization as the single
source of truth for all accounts, opportunities, and customer-facing
communication history. All other apps treat it as authoritative.

Financials consolidate in **NetSuite**. NetSuite is the system of
record for the General Ledger and all statutory reporting. Any app
that needs cost or revenue attribution pulls from NetSuite nightly.

## Decisions

After the 2025 architecture review the team **committed to a
multi-cloud strategy**, with AWS as the primary cloud for
customer-facing workloads and Azure for internal analytics. No single
platform is to hold more than 70% of production workloads.

The **legacy mainframe billing system will reach end of life in
2027**. Vendor support ends in Q4 2027 and the contract will not be
renewed under any circumstance. A replacement program is expected to
kick off in H2 2025.

## Patterns

Every customer-facing application follows the **single sign-on via
Okta** pattern. No exceptions are granted without CISO approval.

Quarterly, Finance produces a cost-allocation report that tags each
application to a business capability. Apps without a capability tag
are escalated to the Architecture Review Board within 30 days.
