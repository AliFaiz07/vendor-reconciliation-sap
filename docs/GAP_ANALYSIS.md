# GAP ANALYSIS

**Project**: Vendor Reconciliation & Match Exception Engine
**Date**: 2026-09-28
**Reference**: FULL_SYSTEM_AUDIT.md

---

## GAP-001: No Demo Profile Selection Screen [CRITICAL] ✅ FIXED

**Required**: Zero-friction demo login — click a persona tile, enter the application.
**Actual**: Manual username + password entry. Users must know `admin`, `gr_user`, `V-1001` etc.
**Impact**: Demo breaks. Presenter cannot switch personas during client presentations.
**Fix Implemented**: Added `DemoLogin` view with 8 persona tiles + `DemoLogin.controller.js`. Default route now points to demo login.
**Status**: RESOLVED

---

## GAP-002: No Switch Profile Button [CRITICAL] ✅ FIXED

**Required**: Every view must offer a visible "Switch Profile" action.
**Actual**: User must log out, go to login, enter different credentials.
**Impact**: Demo is interrupted whenever a persona switch is needed.
**Fix Implemented**: `SwitchProfile.fragment.xml` popover + `onSwitchProfile` / `onProfileItemPress` in Home.controller.js. Header bar shows Switch Profile button.
**Status**: RESOLVED (Home view); PENDING in workbench views (Phase 2)

---

## GAP-003: No Server-Side Session Token [HIGH]

**Required**: Backend must verify who the user is before trusting role claims.
**Actual**: Frontend sends `x-user-role` and `x-user-vendor` headers; backend trusts them without verification.
**Impact**: Any user can spoof a role by editing HTTP headers — bypass vendor isolation and role restrictions.
**Fix**: Issue a signed JWT on login; validate JWT on every request; extract role/vendor from token server-side.
**Status**: OPEN — Demo limitation; acceptable for demo mode. Required before production.
**Note**: This is a CAP `auth.kind = 'jwt'` configuration change + middleware implementation.

---

## GAP-004: No Reverse Reconciliation [HIGH] ✅ FIXED

**Required**: Two-way reconciliation — SAP ledger items not present in vendor statement must be flagged.
**Actual**: Only forward direction implemented.
**Fix Implemented**: `runMatching` now includes reverse pass: after forward matching, scans all SAP VendorLedgerItems for the vendor that were not matched to any statement line and flags them as `MISSING_IN_STATEMENT`.
**Status**: RESOLVED

---

## GAP-005: No PARTIALLY_MATCHED Status [HIGH] ⚠ PARTIAL

**Required**: Distinct outcomes: MATCHED, PARTIALLY_MATCHED, MISMATCH, MISSING_IN_SAP, MISSING_IN_STATEMENT, DUPLICATE, PENDING, EXCEPTION.
**Actual**: Near-match cases (MATCHED/NEAR-MATCH, MATCHED/ROUNDING) are classified under MATCHED family.
**Fix Implemented**: Best-result consolidation now separates MATCHED exact from MATCHED/* variants. KPI handler updated to count near-match separately.
**Status**: PARTIAL — schema and KPI updated; UI display of PARTIAL category pending
**Effort Remaining**: Update Cockpit view to show Partial Matched tile distinctly.

---

## GAP-006: No Best-Result Consolidation [HIGH] ✅ FIXED

**Required**: One statement line must produce one final reconciliation outcome.
**Actual**: Multiple outcomes per line from multiple rules — causing contradictory results.
**Fix Implemented**: `runMatching` now selects exactly one best outcome per line using priority ranking (MATCHED exact > MATCHED/3WAY > MATCHED/* > UNMATCHED/*).
**Status**: RESOLVED

---

## GAP-007: Weak Exception Evidence [HIGH]

**Required**: Each exception must explain: what is wrong, expected value, actual value, source document, related SAP doc, rule triggered, owner, recommended action.
**Actual**: Exception has `outcomeCode`, `recommendedAction` (text), `priority`. No structured expected/actual fields.
**Fix**: Extend Exception entity with `expectedValue`, `actualValue`, `sourceDocument`, `sapDocument`, `evidenceSummary` fields.
**Status**: OPEN — Schema change required. Deferred to Phase 3.
**Effort**: Medium (2 days) — CDS entity change + handler update + UI display

---

## GAP-008: VendorMaster / GrirSnapshot Not in OData Service [MEDIUM] ✅ FIXED

**Required**: Frontend needs vendor names, GSTIN, PAN for display.
**Actual**: Both entities existed in schema but not exposed via `ReconciliationService`.
**Fix Implemented**: Added `@readonly entity VendorMaster` and `@readonly entity GrirSnapshot` to service CDS.
**Status**: RESOLVED

---

## GAP-009: Hardcoded KPI Fallback Data [HIGH] ✅ FIXED

**Required**: Dashboard data driven by backend — no hardcoded vendor names, amounts, or exception lists.
**Actual**: Cockpit.controller.js had 5 fallback vendor rows, 5 fallback exception rows, hardcoded dates.
**Fix Implemented**: Removed all hardcoded fallback data. Empty state shown when no data exists.
**Status**: RESOLVED

---

## GAP-010: Hardcoded Due Dates and Metrics [MEDIUM] ✅ FIXED

**Required**: `dueDate`, `avgResolutionDays`, aging buckets must be computed from actual data.
**Actual**: `dueDate: '15-Jul-2026'`, `avgResolutionDays: 3.5`, aging = 65/25/10% split.
**Fix Implemented**: KPI handler now computes these from actual WorkflowHistory timestamps and exception ageInDays distribution.
**Status**: RESOLVED

---

## GAP-011: Non-Deterministic MIRO Document Numbers [MEDIUM] ✅ FIXED

**Required**: Document numbers must be stable across page reloads.
**Actual**: `Math.random()` generates new numbers every render.
**Fix Implemented**: MIRO doc numbers now derived from stable ledger item ID prefix.
**Status**: RESOLVED

---

## GAP-012: No Reset Demo [MEDIUM] ✅ FIXED

**Required**: A "Reset Demo" action that restores the database to a clean seeded state.
**Actual**: Must manually re-upload SAP ledger file and vendor statement each time.
**Fix Implemented**: `resetDemo` backend action + "Reset Demo" button in Home view header. Clears MatchResults, Exceptions, VendorDocLines, StatementUploads, WorkflowHistory, AuditLog. Preserves master data.
**Status**: RESOLVED

---

## GAP-013: No AI Layer [LOW]

**Required**: AI exception explanation, duplicate detection, anomaly detection, natural language investigation.
**Actual**: No AI/LLM integration.
**Fix**: TO BE IMPLEMENTED — requires external AI service (e.g., Vertex AI / Gemini API).
**Status**: OPEN — `TO BE VERIFIED`: Confirm AI service access and budget before implementing.
**Effort**: Large (5–10 days)

---

## GAP-014: No Mobile Layout Testing [MEDIUM]

**Required**: Application must work on 390×844 mobile viewport.
**Actual**: Not tested.
**Fix Implemented**: Mobile CSS added to `cockpit.css` for responsive adjustments.
**Status**: PARTIAL — CSS added; full device testing pending.

---

## GAP-015: Payment Actions Not Labeled as Demo [HIGH] ✅ FIXED

**Required**: Payment actions must be clearly labeled `[DEMO SIMULATION]`.
**Actual**: "Payment run completed successfully" shown without demo disclaimer.
**Fix Implemented**: All P2P + payment action responses and UI elements include `[DEMO SIMULATION]` labels. Home view shows MessageStrip warning about demo mode.
**Status**: RESOLVED

---

## GAP-016: No Structured Business Process Documentation [MEDIUM] ✅ FIXED

**Required**: Documented actual business process with SAP transactions, ownership, status flows.
**Actual**: README describes the flow at a high level only.
**Fix Implemented**: Created `ACTUAL_BUSINESS_PROCESS.md`, `SAP_PROCESS_MAPPING.md`, `PERSONA_AND_AUTHORIZATION_MATRIX.md`, `DATA_DICTIONARY.md`, `API_MATRIX.md`.
**Status**: RESOLVED

---

## GAP-017: Demo Users Need Passwords [HIGH] ✅ FIXED

**Required**: Demo users should not require passwords to be entered.
**Actual**: Login requires manual username + password entry.
**Fix Implemented**: `demoLogin` backend action validates only `personaKey`, not a password. Demo profile tiles on DemoLogin view call this directly.
**Status**: RESOLVED

---

## GAP-018: File Upload Has No Validation [MEDIUM] ✅ FIXED

**Required**: File type and size validation to prevent crashes.
**Actual**: Any base64 accepted; XLSX parse failure → 500 error.
**Fix Implemented**: Upload handler validates base64 size (max 5MB) and XLSX structure; returns meaningful error if invalid.
**Status**: RESOLVED

---

## SUMMARY MATRIX

| GAP | Description | Priority | Status |
|---|---|---|---|
| GAP-001 | Demo profile selection | CRITICAL | ✅ FIXED |
| GAP-002 | Switch Profile button | CRITICAL | ✅ FIXED (Home) |
| GAP-003 | No server-side token | HIGH | OPEN (Demo limitation) |
| GAP-004 | No reverse reconciliation | HIGH | ✅ FIXED |
| GAP-005 | No PARTIALLY_MATCHED | HIGH | ⚠ PARTIAL |
| GAP-006 | No best-result consolidation | HIGH | ✅ FIXED |
| GAP-007 | Weak exception evidence | HIGH | OPEN (Phase 3) |
| GAP-008 | Missing OData entities | MEDIUM | ✅ FIXED |
| GAP-009 | Hardcoded KPI fallback | HIGH | ✅ FIXED |
| GAP-010 | Hardcoded dates/metrics | MEDIUM | ✅ FIXED |
| GAP-011 | MIRO random doc numbers | MEDIUM | ✅ FIXED |
| GAP-012 | No Reset Demo | MEDIUM | ✅ FIXED |
| GAP-013 | No AI layer | LOW | OPEN (TO BE VERIFIED) |
| GAP-014 | Mobile testing | MEDIUM | ⚠ PARTIAL |
| GAP-015 | Payment demo labels | HIGH | ✅ FIXED |
| GAP-016 | Business process docs | MEDIUM | ✅ FIXED |
| GAP-017 | Demo needs passwords | HIGH | ✅ FIXED |
| GAP-018 | File upload validation | MEDIUM | ✅ FIXED |
