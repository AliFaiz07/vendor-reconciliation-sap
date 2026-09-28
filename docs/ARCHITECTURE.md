# APPLICATION ARCHITECTURE & DESIGN SPECIFICATION

**Project**: Vendor Reconciliation & Match Exception Engine
**Platform**: SAP Cloud Application Programming Model (CAP) Node.js + SAPUI5 Fiori Elements / Freestyle
**Date**: 2026-09-28

---

## 1. LAYERED SYSTEM ARCHITECTURE

```
┌────────────────────────────────────────────────────────────────────────┐
│                      SAPUI5 / FIORI FRONTEND                           │
│  (Horizon Theme, XML Views, JavaScript Controllers, Fragment Modals)   │
│                                                                        │
│   ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────┐  │
│   │   DemoLogin   │ │  Cockpit/Main │ │  Workbenches  │ │  Switch   │  │
│   │   (0-Friction)│ │ (Dynamic KPIs)│ │(MIRO/GR/AP/PO)│ │  Profile  │  │
│   └───────────────┘ └───────────────┘ └───────────────┘ └───────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ OData V4 / REST JSON
┌───────────────────────────────────▼────────────────────────────────────┐
│                    SAP CAP SERVICE LAYER (Node.js)                     │
│  reconciliation-service.cds + reconciliation-service.js                │
│                                                                        │
│   • Request Isolation Middleware (`before READ` Header / Token Check)  │
│   • Action & Function Dispatcher                                       │
├────────────────────────────────────────────────────────────────────────┤
│                    MODULAR BUSINESS HANDLERS                           │
│                                                                        │
│   ┌────────────────────┐  ┌────────────────────┐  ┌─────────────────┐  │
│   │  auth-handler.js   │  │ matching-handler.js│  │ kpi-handler.js  │  │
│   │  (Demo + Profiles) │  │ (2-Way + Consolid.)│  │ (Dynamic Calc)  │  │
│   └────────────────────┘  └────────────────────┘  └─────────────────┘  │
│   ┌────────────────────┐  ┌────────────────────┐  ┌─────────────────┐  │
│   │ upload-handler.js  │  │   p2p-handler.js   │  │ seed-handler.js │  │
│   │ (XLSX Validation)  │  │  (Demo Simulation) │  │ (Excel Parser)  │  │
│   └────────────────────┘  └────────────────────┘  └─────────────────┘  │
├────────────────────────────────────────────────────────────────────────┤
│                    RECONCILIATION ENGINE CORE                          │
│                                                                        │
│   • Rule Evaluators (Invoice, Amount, Date, PO/GR, GST/TDS, Timing)    │
│   • Scenario Evaluators (TC001 - TC010 Specific Business Scenarios)    │
│   • Best-Result Priority Consolidator                                  │
│   • Reverse Reconciliation Engine (SAP -> Statement)                   │
├────────────────────────────────────────────────────────────────────────┤
│                    DATA PERSISTENCE LAYER                              │
│                                                                        │
│   Development: SQLite (db.sqlite) via @cap-js/sqlite                   │
│   Production:  SAP HANA Cloud via @cap-js/hana                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. KEY ARCHITECTURAL DECISIONS

### ADR-01: Zero-Friction Demo Mode vs. Production Authentication
* **Context**: Client demonstrations require instant, seamless persona switching without passwords or registration overhead.
* **Decision**: Implement `demoLogin(personaKey)` returning pre-configured persona profiles. State is retained in client session storage and validated on every backend invocation.
* **Production Boundary**: In production, CAP `auth.kind = 'jwt'` replaces `demoLogin`, interfacing with SAP Cloud Identity Services (IAS) / BTP XSUAA.

### ADR-02: Two-Way Deterministic Reconciliation with Best-Result Consolidation
* **Context**: Reconciliation cannot rely on probabilistic AI or produce multiple conflicting outcome codes for a single invoice.
* **Decision**: Forward reconciliation processes vendor statement lines against internal candidate ledgers, selects the highest-ranking outcome, and flags exceptions. Reverse reconciliation scans remaining un-reconciled SAP ledger items and flags `MISSING_IN_STATEMENT`.

### ADR-03: Single Application Shell with Dynamic Persona Awareness
* **Context**: Avoiding 8 disconnected siloed applications.
* **Decision**: A unified application shell provides universal access to Home, Cockpit, Workbenches, and Audit logs, with header-level persona switching and role-based feature gating.

### ADR-04: Transparent SAP Boundary Labeling
* **Context**: Users and clients must never mistake local demo simulations for live SAP financial postings.
* **Decision**: Every action not connected to an actual SAP RFC/OData endpoint is visibly badged as `[DEMO SIMULATION]` in the UI, button texts, message strips, and API payload responses.
