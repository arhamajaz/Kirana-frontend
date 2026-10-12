# Core Logic Architecture & Mathematical Engine Specification (`core_architecture_logic.md`)

## 1. Architectural Philosophy: Decoupled Computation vs. Merchant UX

Traditional accounting software forces raw ledger mechanics onto shopkeepers and merchants, leading to confusion when payments liquidate interest before principal or when compounding bases change mid-timeline.

**Malwa Ledger Pro** resolves this dilemma with a strict architectural decoupling:
1. **The Immutable Math Core (`ledgerEngine.ts`)**: An authoritative, mathematically rigorous, chronological state machine executing the Zero-Interest Advance and Settlement Waterfall protocol.
2. **The API Delivery Bus (`controllers`, `services`, `api.js`)**: A fault-tolerant transport pipeline delivering canonical calculations and structured audit trails without data drops.
3. **The "Dumb" Merchant Display Layer (`app.js`, `index.html`)**: A merchant-friendly presentation interface that presents intuitive metrics (**Raw Principal**, **Gross Interest**, and the **(Paid) Badge**) while maintaining 100% mathematical parity with the underlying financial engine.

```
+-------------------------------------------------------------------------+
|                  CORE MATHEMATICAL ENGINE (ledgerEngine.ts)             |
|  - Chronological Timeline Sorting (Date ASC; Same-Day Debit < Credit)   |
|  - Exact Calendar Month Anchoring & Daily Proration                      |
|  - Zero-Interest Advance Protocol (0% on Advance Balances)               |
|  - Settlement Waterfall (1: Accrued Interest -> 2: Principal -> 3: Adv) |
|  - Structured Phase Audit Log: BreakdownEntry[]                          |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                    API TRANSPORT LAYER (Express + api.js)               |
|  - Dual Envelope Packaging: data.breakdownLog & root breakdownLog       |
|  - Summary Sync: summary.accruedInterest & summary.breakdownLog          |
|  - Unfrozen Global API: window.LedgerAPI for flexible runtime & testing  |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                    FRONTEND PRESENTATION LAYER (app.js)                 |
|  - Current Principal Card: Raw Principal (Total Debits - Total Credits)  |
|  - Accrued Interest Card: Gross Interest (Sum of phase interestGen)     |
|  - (Paid) Badge: Flagged when Gross Interest > 0 & Net Accrued Int <= 0  |
|  - See Calculation Modal: Visual Phase Cards showing exact formulas     |
|  - Total Net Balance Card: Authoritative Net Total Due (Unaltered Engine)|
+-------------------------------------------------------------------------+
```

---

## 2. The Core Mathematical Engine & Waterfall Protocol

### 2.1 Chronological Sorting & Deterministic Ordering
Every transaction in the ledger is normalized into `{ id, type, amount, date, interestRate, rateUnit, interestType }`.
Transactions are sorted chronologically:
- Primary sort: `date ASC`.
- Secondary sort (Same-day tie-breaker): `DEBIT` precedes `CREDIT`. This ensures that borrowed amounts accrue interest before same-day payments take effect.

### 2.2 Phase Segmentation & Calendar Accrual
Whenever the timeline advances from transaction date $T_{i-1}$ to $T_i$, or finally to `asOfDate`:
- **Elapsed Time**:
  - `daysElapsed`: Exact physical calendar day difference ($T_{end} - T_{start}$).
  - `elapsedMonths`: Calendar month anniversary calculation with day-of-month anchoring (e.g. Jan 31 to Feb 28 represents 1 calendar month), plus prorated partial calendar days using the true days in the subsequent month span.
- **Interest Calculation**:
  - If `principalDue > 0` and `advanceBalance === 0`:
    - **Simple Interest**:
      $$\text{newInterest} = \text{principalDue} \times \left(\frac{\text{monthlyRate}}{100}\right) \times \text{elapsedMonths}$$
    - **Compound Interest**:
      $$\text{compoundingBase} = \text{principalDue} + \text{accruedInterest}$$
      $$\text{newInterest} = \text{compoundingBase} \times \left[\left(1 + \frac{\text{monthlyRate}}{100}\right)^{\text{elapsedMonths}} - 1\right]$$
    - A `BreakdownEntry` is generated recording `interestGenerated: newInterest`, `interestAccrued: newInterest`, and `rateApplied`.
  - If `advanceBalance > 0`:
    - **Zero-Interest Advance Rule**: Customer balances held in advance **never accrue interest**. A phase entry is logged with `interestGenerated: 0`, `isAdvance: true`, and `rateApplied: '0%'`.

### 2.3 The Settlement Waterfall Protocol
When a `CREDIT` payment event occurs, funds are allocated across 3 strict sequential phases:
1. **Phase 1: Liquidation of Accrued Interest**:
   $$\text{intPayment} = \min(\text{creditAmount}, \text{accruedInterest})$$
   $$\text{accruedInterest} \leftarrow \text{accruedInterest} - \text{intPayment}$$
   $$\text{creditAmount} \leftarrow \text{creditAmount} - \text{intPayment}$$
   *The interest deduction is recorded against existing `breakdownLog` phase entries in reverse order (LIFO), decrementing `interestAccrued` while preserving original `interestGenerated` for historical audit.*
2. **Phase 2: Liquidation of Principal Due**:
   $$\text{prinPayment} = \min(\text{creditAmount}, \text{principalDue})$$
   $$\text{principalDue} \leftarrow \text{principalDue} - \text{prinPayment}$$
   $$\text{creditAmount} \leftarrow \text{creditAmount} - \text{prinPayment}$$
3. **Phase 3: Surplus Advance Balance**:
   $$\text{advanceBalance} \leftarrow \text{advanceBalance} + \text{creditAmount}$$
   *Any surplus credit remains safely buffered at 0% interest until future debit transactions absorb it.*

When a `DEBIT` borrowing event occurs:
1. It draws down from `advanceBalance` first.
2. Any remainder increments `principalDue`.

---

## 3. API Transport & Envelope Standards

To prevent data serialization loss and ensure compatibility across multiple consumer patterns (direct fetch, Axios, proxy unwrappers, and test stubs), the backend controller (`ledger.controller.ts`) packages the payload symmetrically:

```json
{
  "status": "success",
  "data": {
    "customer": { ... },
    "summary": {
      "totalMoneyLent": 100000.00,
      "totalMoneyReceived": 15000.00,
      "outstandingPrincipal": 85000.00,
      "accruedInterest": 25221.80,
      "totalDue": 125221.80,
      "breakdownLog": [ ... ]
    },
    "entries": [ ... ],
    "transactions": [ ... ],
    "breakdownLog": [ ... ]
  },
  "summary": { ... },
  "breakdownLog": [ ... ]
}
```

The frontend client (`api.js` via `getCustomerLedger`) unpacks `breakdownLog` with multi-path fallback:
`res.breakdownLog || res.data.breakdownLog || res.summary.breakdownLog || res.data.summary.breakdownLog`.
It binds the array universally onto both root and nested summary fields, preventing downstream `undefined` evaluations.

---

## 4. The Frontend As a "Dumb" Merchant Display Layer

Merchants running a Kirana business expect immediate, recognizable numbers rather than complex partial-amortization ledger silos. The frontend masks this complexity into three clean presentation concepts:

### 4.1 Current Principal Card -> "Raw Principal"
- **Formula**: `Raw Principal = Total Debits - Total Credits`
- **Merchant Rationale**: A merchant thinks: *"I gave ₹10,000, and they gave me back ₹3,000, so they owe ₹7,000 on principal."* In the background, if interest was accrued, the backend waterfall paid interest first and left more principal active. But the frontend card displays the raw arithmetic principal to give merchants instant clarity.

### 4.2 Accrued Interest Card -> "Gross Interest"
- **Formula**: `Gross Interest = Sum of all (phase.interestGenerated) from breakdownLog`
- **Merchant Rationale**: When a customer makes a partial payment, the backend waterfall marks `accruedInterest = 0` (or reduced). If the card showed remaining interest, the merchant would see `₹0.00` and think no interest was earned on the loan. By displaying **Gross Interest**, merchants see the total interest yield their money generated.

### 4.3 The "(Paid)" Badge
- **Condition**: `grossInterest > 0 && remainingAccruedInterest <= 0`
- **UI Presentation**: `${formatCurrency(grossInterest)} (Paid)`
- **Merchant Rationale**: This signals to the merchant: *"Yes, ₹5,000 of interest was generated, and the customer has already covered/paid it in full!"*

### 4.4 The "See Calculation" Modal
- When the merchant clicks "See Calculation", the frontend renders each individual phase card from `breakdownLog`:
  - **Date Interval**: `StartDate` to `EndDate` (`daysElapsed` days).
  - **Active Principal**: The compounding base or principal active during that exact phase.
  - **Calculation Formula**: `Active Principal × Rate × Duration`.
  - **Phase Interest**: The non-zero yield generated during that phase.
  - **Zero Interest Badges**: Clearly flags phases where customer balance was in advance at 0% interest.

### 4.5 Total Net Balance Card -> Uncompromised Mathematical Truth
- The bottom-line **Total Net Balance** card is bound directly to `summary.totalDue` or `summary.unallocatedCredit` from the backend `ledgerEngine`.
- No UX masking is applied to this card. It represents the true, uncompromised net legal debt or store credit balance.
