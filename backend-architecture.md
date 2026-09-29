# 🏛️ Backend Architecture Specification & Technical Reference
**System:** Mohit Store Ledger (`kirana-backend`)  
**Author:** Principal Technical Writer & Full-Stack Systems Architect  
**Repository:** [`https://github.com/arhamajaz/kirana-backend`](https://github.com/arhamajaz/kirana-backend)  
**Deployment Platform:** Render Node.js Service  

---

## 1. Overview & Architectural Goals

The backend architecture of the Mohit Store Ledger is designed around three core operational pillars:
1. **Flawless Interest Engine & Single Source of Truth:** Authoritative execution of ledger calculations via [`ledgerEngine.ts`](file:///d:/Projects/kirana%20ledger/backend/src/utils/ledgerEngine.ts), strictly adhering to the Rule 6 Settlement Order (Interest-First, Principal-Second) and the Zero-Interest Advance Protocol.
2. **Robust API Security & Type-Safe Routing:** Layered Express architecture leveraging JWT Bearer token authentication ([`auth.middleware.ts`](file:///d:/Projects/kirana%20ledger/backend/src/middleware/auth.middleware.ts)), Zod schema validation ([`validation.middleware.ts`](file:///d:/Projects/kirana%20ledger/backend/src/middleware/validation.middleware.ts)), and centralized error handling ([`errorHandler.ts`](file:///d:/Projects/kirana%20ledger/backend/src/middleware/errorHandler.ts)).
3. **Persistent Data Integrity:** High-performance Prisma ORM integration with PostgreSQL, maintaining relational constraints, soft-deletes (`isVoided`), and precise financial precision.

---

## 2. Core Component Architecture

```
[ HTTP Request (Vercel Client / REST API) ]
                   │
                   ▼
     [ Express Router & Rate Limiter ]
                   │
                   ▼
     [ authMiddleware (JWT Verification) ]
                   │
                   ▼
    [ validateQuery / validateBody (Zod) ]
                   │
                   ▼
   [ LedgerController.getCustomerLedger ]
                   │
                   ▼
      [ LedgerService.generateLedger ]
                   │
                   ▼
   [ calculateLedger() in ledgerEngine.ts ] ◄── SINGLE SOURCE OF TRUTH
                   │
                   ├───────────────────────────────────┐
                   ▼                                   ▼
        summary.accruedInterest                  breakdownLog[]
       (Single Source of Truth)              (Phase Breakdown Array)
                   │                                   │
                   └─────────────────┬─────────────────┘
                                     ▼
                            [ JSON Response ]
```

---

## 3. The Math Engine ([`ledgerEngine.ts`](file:///d:/Projects/kirana%20ledger/backend/src/utils/ledgerEngine.ts))

The calculation engine is contained in [`ledgerEngine.ts`](file:///d:/Projects/kirana%20ledger/backend/src/utils/ledgerEngine.ts). It operates as a deterministic, side-effect-free state machine that processes transactions chronologically.

### 3.1 Financial Calculation Formulas

* **Daily Rate Calculation:**
  Interest rate is converted to a monthly rate. If a yearly rate is supplied (`isAnnual === true`), it is normalized:
  $$\text{effectiveMonthlyRate} = \frac{\text{yearlyRate}}{12}$$
  Daily interest is accrued over exact elapsed calendar days using a strict **30-day monthly divisor**:
  $$\text{elapsedMonths} = \frac{\text{exactDays}}{30}$$
  $$\text{newInterest} = \text{roundMoney}\left(\text{principalDue} \times \frac{\text{effectiveMonthlyRate}}{100} \times \frac{\text{exactDays}}{30}\right)$$

* **Rounding Rule ([`ledgerEngine.ts:L46-L48`](file:///d:/Projects/kirana%20ledger/backend/src/utils/ledgerEngine.ts#L46-L48)):**
  To prevent floating-point cumulative drift, currency values are rounded to 2 decimal places using `Number.EPSILON`:
  ```typescript
  export function roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
  ```

### 3.2 Chronological Sorting & Void Filtering ([`ledgerEngine.ts:L90-L109`](file:///d:/Projects/kirana%20ledger/backend/src/utils/ledgerEngine.ts#L90-L109))
1. **Void Filtering:** Any transaction flagged with `is_void`, `isVoid`, or `isVoided` is excluded prior to calculation.
2. **Chronological Sorting:** Transactions are sorted by `date` ascending.
3. **Same-Day Priority:** For transactions occurring on the exact same date, `DEBIT` transactions are processed before `CREDIT` transactions:
   ```typescript
   const sortedTxns = [...validTxns].sort((a, b) => {
     const dateA = new Date(a.date).getTime();
     const dateB = new Date(b.date).getTime();
     if (dateA !== dateB) return dateA - dateB;
     const typeA = String(a.type).toUpperCase();
     const typeB = String(b.type).toUpperCase();
     if (typeA !== typeB) return typeA === 'DEBIT' ? -1 : 1;
     return 0;
   });
   ```

### 3.3 Rule 6: Settlement Order Waterfall ([`ledgerEngine.ts:L189-L202`](file:///d:/Projects/kirana%20ledger/backend/src/utils/ledgerEngine.ts#L189-L202))
When a `CREDIT` (payment) transaction is processed:
* **Phase 1 (Interest First):** Payment is applied to clear `accruedInterest` first:
  $$\text{intPayment} = \min(\text{amount}, \text{accruedInterest})$$
  $$\text{accruedInterest} = \text{accruedInterest} - \text{intPayment}$$
  $$\text{amount} = \text{amount} - \text{intPayment}$$
* **Phase 2 (Principal Second):** Remaining payment is applied to clear `principalDue` second:
  $$\text{prinPayment} = \min(\text{amount}, \text{principalDue})$$
  $$\text{principalDue} = \text{principalDue} - \text{prinPayment}$$
  $$\text{amount} = \text{amount} - \text{prinPayment}$$
* **Phase 3 (Advance Buffer):** Any excess payment remains as `advanceBalance`.

### 3.4 Zero-Interest Advance Protocol ([`ledgerEngine.ts:L128-L163`](file:///d:/Projects/kirana%20ledger/backend/src/utils/ledgerEngine.ts#L128-L163))
When a customer has an advance credit balance (`advanceBalance > 0`):
* `principalDue` is 0.
* **0% Interest Rule:** No interest accrues while `advanceBalance > 0`. A phase entry is recorded in `breakdownLog` with `isAdvance: true` and `rateApplied: '0%'`.
* When a subsequent `DEBIT` occurs, it draws from `advanceBalance` first before increasing `principalDue`.

---

## 4. API & Middleware Security Layer

### 4.1 Route Protection & Authentication ([`auth.middleware.ts`](file:///d:/Projects/kirana%20ledger/backend/src/middleware/auth.middleware.ts))
All endpoints under `/api/v1/customers`, `/api/v1/transactions`, `/api/v1/bills`, and `/api/v1/reports` require a valid JWT passed in the HTTP Authorization header:
```
Authorization: Bearer <token>
```
The `authMiddleware` extracts the token, verifies it against `process.env.JWT_SECRET`, and attaches the authenticated user object (`req.user`) to the Express Request context.

### 4.2 Query & Body Validation ([`validation.middleware.ts`](file:///d:/Projects/kirana%20ledger/backend/src/middleware/validation.middleware.ts))
Zod schemas sanitize and validate all input params before reaching controllers:
* **Ledger Query Schema ([`validation.middleware.ts:L185-L198`](file:///d:/Projects/kirana%20ledger/backend/src/middleware/validation.middleware.ts#L185-L198)):** Validates optional `calculationDate` or `asOfDate` strings.
* **Customer Creation Schema:** Enforces strict 10-digit phone regex (`/^\d{10}$/`), lending/deposit rate range (`0–100%`), and valid compounding frequency enums.

### 4.3 Endpoint Mapping & Response Payload Structure
The primary endpoint for retrieving customer ledger data is:
`GET /api/v1/customers/:customerId/ledger?calculationDate=YYYY-MM-DD`

#### Controller Handler ([`ledger.controller.ts:L11-L41`](file:///d:/Projects/kirana%20ledger/backend/src/controllers/ledger.controller.ts#L11-L41))
Parses `customerId` from path params and `calculationDate` from query params, then delegates to `LedgerService.generateLedger()`.

#### Canonical JSON Response Structure:
```json
{
  "status": "success",
  "data": {
    "customer": {
      "id": "cust-uuid",
      "name": "Mohit Merchant",
      "phoneNumber": "9876543210",
      "lendingRate": 2.0
    },
    "summary": {
      "totalMoneyLent": 10000.00,
      "totalMoneyReceived": 5000.00,
      "outstandingPrincipal": 5200.00,
      "accruedInterest": 52.00,
      "totalDue": 5252.00,
      "unallocatedCredit": 0.00
    },
    "transactions": [ ... ],
    "breakdownLog": [
      {
        "startDate": "2026-01-01T00:00:00.000Z",
        "endDate": "2026-01-31T00:00:00.000Z",
        "daysElapsed": 30,
        "activePrincipal": 10000.00,
        "interestGenerated": 200.00,
        "interestAccrued": 200.00,
        "rateApplied": "2% monthly",
        "isAdvance": false
      },
      {
        "startDate": "2026-01-31T00:00:00.000Z",
        "endDate": "2026-02-15T00:00:00.000Z",
        "daysElapsed": 15,
        "activePrincipal": 5200.00,
        "interestGenerated": 52.00,
        "interestAccrued": 52.00,
        "rateApplied": "2% monthly",
        "isAdvance": false
      }
    ]
  }
}
```

---

## 5. Database & Prisma ORM Layer

### 5.1 Data Models
* **User:** Shopkeepers/Merchants managing ledgers.
* **Customer:** Borrowers/Lenders associated with a specific `userId`.
* **Transaction:** Ledger entries categorized as `DEBIT` or `CREDIT`. Soft-deleted via `isVoided: Boolean`.

### 5.2 Single Source of Truth Service Wiring ([`ledger.service.ts:L458-L497`](file:///d:/Projects/kirana%20ledger/backend/src/services/ledger.service.ts#L458-L497))
`LedgerService.generateLedger()` queries non-voided transactions for the target customer via Prisma, maps them to `LedgerTransaction[]`, and passes them to `calculateLedger()`. The `summary` object returned by `generateLedger()` is directly constructed from `calculateLedger()` outputs, ensuring that `summary.accruedInterest` and `breakdownLog` remain mathematically identical.
