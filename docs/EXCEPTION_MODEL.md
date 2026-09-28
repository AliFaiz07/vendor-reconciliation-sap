# EXCEPTION MODEL & LIFECYCLE SPECIFICATION

**Project**: Vendor Reconciliation & Match Exception Engine
**Date**: 2026-09-28

---

## 1. EXCEPTION LIFECYCLE STATE MACHINE

```
             [ Matching Engine ]
                      │
                      ▼
                   ┌──────┐
       ┌───────────│ OPEN │───────────┐
       │           └──────┘           │
       ▼                              ▼
 ┌──────────┐                   ┌──────────┐
 │ ASSIGNED │                   │ DISPUTED │ (Vendor Action)
 └──────────┘                   └──────────┘
       │                              │
       ▼                              │
 ┌───────────┐                        │
 │ IN_REVIEW │                        │
 └───────────┘                        │
       │                              │
       ▼                              ▼
 ┌──────────┐                   ┌──────────┐
 │ RESOLVED │                   │ REOPENED │
 └──────────┘                   └──────────┘
       ▲                              │
       └──────────────────────────────┘
```

### State Definitions

| State | Definition | Triggering Action | Allowed Personas |
|---|---|---|---|
| `OPEN` | Exception created by matching engine, unassigned. | Auto-created by `runMatching` | System Engine |
| `ASSIGNED` | Assigned to a specific functional owner/role. | `assignException(id, user)` | AP Manager, Finance Executive |
| `IN_REVIEW` | Operational investigation in progress. | Internal workbench review | GR Specialist, MIRO Agent |
| `DISPUTED` | Supplier disputes the exception finding. | `raiseDispute(id, comment)` | Vendor AR, Vendor Billing |
| `RESOLVED` | Variance investigated, cleared, or accepted. | `resolveException(id, note)` | Assigned Persona, AP Manager |
| `REOPENED` | Previously resolved item found inaccurate. | `reopenException(id)` | AP Manager, Supervisor |

---

## 2. SEVERITY & SLA MATRIX

| Priority | Criteria | SLA Target | Auto-Escalation |
|---|---|---|---|
| **P1 (Critical)** | MSME vendor OR amount $> ₹1,00,000$ OR Qty mismatch | 24 Hours | AP Manager & Supervisor |
| **P2 (Medium)** | Amount between $₹10,000$ and $₹1,00,000$ OR Missing CN | 72 Hours | Finance Lead |
| **P3 (Low)** | Minor variance, timing issues $\le ₹10,000$ | 7 Days | Standard review |

### Statutory MSME Rule (India)
Under the Micro, Small and Medium Enterprises Development (MSMED) Act 2006, buyers must make payment within **45 days** of invoice acceptance. Any exception linked to an MSME vendor (`isMsme = true`) is automatically escalated to **P1 Priority** with a permanent amber/red warning flag.

---

## 3. EVIDENCE ARTIFACT STRUCTURE

Every generated exception includes a structured evidence payload:

```json
{
  "exceptionId": "EX-8FA2910B",
  "invoiceNumber": "INV-22440",
  "outcomeCode": "UNMATCHED/PRICE-HIGH",
  "variance": {
    "expectedValue": "₹3,75,000.00 (PO Rate: ₹1,500/unit)",
    "actualValue": "₹3,86,656.50 (Invoice Rate: ₹1,546.62/unit)",
    "amountDelta": 11656.50,
    "deltaPercentage": "3.1%"
  },
  "documents": {
    "vendorInvoice": "INV-22440",
    "purchaseOrder": "4500010042",
    "poItem": "00010",
    "materialDocument": "5000018921",
    "sapAccountingDoc": "N/A (Blocked in MIRO)"
  },
  "ownership": {
    "assignedRole": "FINANCE",
    "assignedTo": "Priya Mehta",
    "priority": "P1",
    "msmeAlert": true
  },
  "recommendedAction": "Price variance exceeds 2% contract tolerance. Request vendor credit note of ₹11,656.50 or procure PO price amendment."
}
```

---

## 4. SERVER-SIDE VALIDATION & AUDIT TRAIL

1. **State Transition Enforcement**: Transitions are strictly validated in `srv/handlers/matching-handler.js`. Users cannot resolve an item without recording an audit note.
2. **Immutable Audit History**: Every state change inserts an audit entry in `WorkflowHistory` (`ID`, `exceptionID`, `stepName`, `actor`, `action`, `comment`, `timestamp`).
3. **No Direct Modification**: Exception states can only be mutated through exposed CAP actions (`resolveException`, `reopenException`, `raiseDispute`, `assignException`).
