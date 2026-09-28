# TEST PLAN & QUALITY ASSURANCE SPECIFICATION

**Project**: Vendor Reconciliation & Match Exception Engine
**Testing Stack**: Node.js Mocha / Jest + Playwright End-to-End
**Date**: 2026-09-28

---

## 1. TESTING SCOPE & TAXONOMY

```
┌─────────────────────────────────────────────────────────────┐
│                    E2E PLAYWRIGHT TESTS                     │
│  Browser interactions, responsive layout, persona switching │
├─────────────────────────────────────────────────────────────┤
│                 API & INTEGRATION TESTS                     │
│  OData V4 CRUD, Custom Actions, Row-Level Isolation         │
├─────────────────────────────────────────────────────────────┤
│                    UNIT TESTS (LOGIC)                       │
│  Matching Engine, Best-Result Consolidation, Reverse Recon  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. UNIT & RECONCILIATION TEST CASES

| Test ID | Module | Scenario / Description | Expected Result | Pass Criteria |
|---|---|---|---|---|
| `UT-001` | Matching Engine | Exact invoice number, amount, and date | `MATCHED` | Outcome code matches, delta is 0 |
| `UT-002` | Matching Engine | PO Qty = 100, GR Qty = 100, Inv Qty = 100 | `MATCHED/3WAY` | TC001 rule triggered, role is AP |
| `UT-003` | Matching Engine | GR Qty = 80, Inv Qty = 100 | `UNMATCHED/QTY-LESS` | TC002 rule triggered, role is GR |
| `UT-004` | Matching Engine | Inv Unit Price = ₹1546.62 vs PO Rate = ₹1500 | `UNMATCHED/PRICE-HIGH` | P1 priority, routed to Finance |
| `UT-005` | Matching Engine | PO exists, no GR record found | `UNMATCHED/GR-PENDING` | P1 priority, routed to GR |
| `UT-006` | Matching Engine | Invoice missing in `Gstr2bInvoices` | `UNMATCHED/GST-2B-GAP` | ITC hold flagged, role is Billing |
| `UT-007` | Consolidation | Multiple candidate outcomes for one line | Exactly 1 MatchResult | Highest priority outcome wins |
| `UT-008` | Reverse Recon | SAP ledger item not present in statement | `MISSING_IN_STATEMENT` | Generated with line ID null |
| `UT-009` | Exception SLA | Vendor marked with `isMsme = true` | Priority = `P1` | `msmeAlert` flag set to true |

---

## 3. INTEGRATION & AUTHORIZATION TEST CASES

| Test ID | Endpoint | Test Action | Expected Result |
|---|---|---|---|
| `IT-001` | `/api/v1/demoLogin` | Post valid persona key `admin` | HTTP 200, returns Rahul Sharma profile |
| `IT-002` | `/api/v1/demoLogin` | Post invalid persona key `unknown` | HTTP 404, returns error message |
| `IT-003` | `/api/v1/VendorDocLines` | Request with `x-user-vendor: V-1001` | HTTP 200, returns ONLY lines for V-1001 |
| `IT-004` | `/api/v1/Exceptions` | Resolve open exception with note | HTTP 200, status changes to `RESOLVED` |
| `IT-005` | `/api/v1/Exceptions` | Vendor raises dispute | HTTP 200, status changes to `DISPUTED` |
| `IT-006` | `/api/v1/resetDemo` | Post demo reset action | HTTP 200, clears runtime tables |

---

## 4. END-TO-END PLAYWRIGHT AUTOMATION MATRIX

```typescript
// Example Playwright E2E Test Structure
import { test, expect } from '@playwright/test';

test.describe('Vendor Reconciliation E2E Flows', () => {
  test('Zero-friction login and persona switching', async ({ page }) => {
    await page.goto('http://localhost:4004/webapp/index.html');

    // Select AP Manager
    await page.click('#tile_admin');
    await expect(page.locator('text=Rahul Sharma')).toBeVisible();

    // Open Switch Profile
    await page.click('text=Switch Profile');
    await page.click('text=GR Specialist');
    await expect(page.locator('text=Suresh Kumar')).toBeVisible();
  });

  test('Verify mobile viewport (390x844)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:4004/webapp/index.html');

    // Verify no horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(390);
  });
});
```
