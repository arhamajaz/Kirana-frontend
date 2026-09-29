# 🎨 Frontend Architecture Specification & Technical Reference
**System:** Mohit Store Ledger (`Kirana-frontend`)  
**Author:** Principal Technical Writer & Full-Stack Systems Architect  
**Repository:** [`https://github.com/arhamajaz/Kirana-frontend`](https://github.com/arhamajaz/Kirana-frontend)  
**Deployment Platform:** Vercel Static Web App  

---

## 1. Overview & Architectural Goals

The frontend architecture of the Mohit Store Ledger is designed to deliver a modern, high-performance user experience centered on three primary objectives:
1. **100% Responsive & Minimalist UI (Goal 2):** Fluid layout scaling built with Vanilla CSS, dynamic CSS custom properties, CSS Flexbox/Grid, and `rem`-based responsive typography. Fully compliant with mobile-first standards (320px to 4K displays) with zero horizontal overflow.
2. **Single Source of Truth & Zero Math Overrides (Goal 1):** Direct binding of backend ledger API responses to DOM elements. Eliminates duplicate client-side summation over modal breakdown logs and enforces strict state invalidation when changing calculation dates.
3. **Secure API Interception & Native Exports (Goal 3):** Encapsulated HTTP fetch gateway ([`api.js`](file:///d:/Projects/kirana%20ledger/api.js)) supporting Bearer JWT auth, network retries, and automatic 401 logouts, alongside client-side PDF statement generation (jsPDF) and multi-sheet Excel backup exports (SheetJS).

---

## 2. Responsive CSS Architecture ([`style.css`](file:///d:/Projects/kirana%20ledger/style.css))

The styling framework relies exclusively on Vanilla CSS to maximize render speed and maintain absolute layout control.

### 2.1 CSS Custom Properties (Design Tokens)
Design tokens are defined at the `:root` level for seamless dark/light theme switching:
```css
:root {
    --primary-color: #2563eb;
    --primary-hover: #1d4ed8;
    --bg-color: #f8fafc;
    --surface-color: #ffffff;
    --text-primary: #0f172a;
    --text-secondary: #64748b;
    --border-color: #e2e8f0;
    --danger-color: #ef4444;
    --success-color: #10b981;
    --radius-md: 10px;
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.05);
}
```

### 2.2 Fluid Grid & Flexbox Layout Engine
All card containers, summary grids, and modal dialogs use flexbox and grid layouts with `minmax()` and `fit-content` scaling to prevent element truncation or horizontal scrolling:
* **Stat Grid:** `.stats-grid` uses `grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))` to adjust column counts dynamically from single-column on mobile to three-column on desktop screens.
* **Overflow Prevention:** Global reset rules enforce `box-sizing: border-box` and `max-width: 100%` on container bodies, tables, and modal cards.

### 2.3 Responsive Breakpoints & Mobile Optimization
Media queries use `rem` units to guarantee accessibility when users adjust browser font scaling:
* **Desktop Large (`min-width: 48.0625rem` / `769px+`):** Multi-column layout with fixed side navigation.
* **Tablet (`max-width: 64rem` / `1024px`):** Collapsible sidebar, adaptive cards.
* **Mobile Standard (`max-width: 48rem` / `768px`):** Sticky top bar (`#compact-app-bar`), full-width action buttons (`.full-width`).
* **Mobile Small (`max-width: 30rem` / `480px`):** Stacked action pills, compact transaction list padding.

---

## 3. Core Utilities & Export Engine

### 3.1 PDF Statement Generator (`jsPDF` Integration in [`app.js:L2180-L2440`](file:///d:/Projects/kirana%20ledger/app.js#L2180-L2440))
The PDF export feature allows shopkeepers to download customer account statements formatted for A4 printing:
* **Library:** `jspdf` & `jspdf-autotable`.
* **Columns:** Date, Category, Remarks, You Gave (Debit), You Got (Credit), Running Balance.
* **Header Summary:** Embeds Merchant Business Name, Customer Details, Statement Date Range, Outstanding Principal, Accrued Interest, and Net Total Due.

### 3.2 Multi-Sheet Excel Backup Engine (`SheetJS` Integration in [`app.js:L2520-L2660`](file:///d:/Projects/kirana%20ledger/app.js#L2520-L2660))
The backup module creates offline Excel workbooks (`.xlsx`) containing complete store data:
* **Library:** `XLSX` (SheetJS).
* **Sheet 1 ("Customers"):** Customer profiles, phone numbers, lending rates, deposit rates, and compounding settings.
* **Sheet 2 ("Transactions"):** Full transaction ledger history, categories, amounts, and dates.
* **Sheet 3 ("Summary Data"):** Consolidated financial metrics, total money lent, total money received, and net outstanding balances.

---

## 4. State Management & API Interceptor Gateway

### 4.1 Global Application State ([`app.js:L170-L190`](file:///d:/Projects/kirana%20ledger/app.js#L170-L190))
The frontend maintains a central reactive state object:
```javascript
const state = {
    isAuthenticated: false,
    currentUser: null,
    customers: [],
    transactions: [],
    currentCustomerId: null,
    currentLedgerSummary: null, // Reset on date change
    isTestMode: false
};
```

### 4.2 Centralized API Gateway ([`api.js`](file:///d:/Projects/kirana%20ledger/api.js))
All network communications pass through `LedgerAPI` defined in [`api.js`](file:///d:/Projects/kirana%20ledger/api.js):
* **Dynamic Base URL:** `window.ENV?.API_BASE_URL || "https://kirana-backend-9t5z.onrender.com/api/v1"`.
* **JWT Bearer Header:** `buildHeaders()` injects `Authorization: Bearer <token>` from `localStorage` (`ml_pro_auth_token`).
* **Retry & Abort Controller:** `request()` includes a 20-second timeout via `AbortController` and automatically retries network errors up to 2 times.
* **401 Unauthorized Interceptor:** Triggers `onUnauthorizedCallback()` to log out users cleanly when session tokens expire.
* **Response Unwrapping:** Standardizes backend responses by unwrapping `responseData.data`.

### 4.3 UI Synchronization & Single Source of Truth Binding

```
[ User Changes #ledger-as-of-date ]
                │
                ▼
  [ state.currentLedgerSummary = null ] ◄── Cache Invalidation
                │
                ▼
  [ LedgerAPI.getCustomerLedger(id, { calculationDate }) ]
                │
                ▼
  [ Backend Returns payload { summary, breakdownLog } ]
                │
        ┌───────┴───────┐
        ▼               ▼
 [ Main Screen Card ] [ Breakdown Modal ]
 (#summary-interest) (#interest-breakdown-body)
        │               │
        └───────┬───────┘
                ▼
    [ Identical Values Displayed ] (e.g. ₹52.00)
```

1. **Main Screen Binding ([`app.js:L1122-L1135`](file:///d:/Projects/kirana%20ledger/app.js#L1122-L1135)):**
   Renders `formatCurrency(state.currentLedgerSummary.accruedInterest)` directly on `#summary-interest`.
2. **Breakdown Modal Binding ([`app.js:L4084-L4215`](file:///d:/Projects/kirana%20ledger/app.js#L4084-L4215)):**
   - Retrieves `backendLedger.breakdownLog` and iterates over phase items to render Phase Cards.
   - Extract `totalInterestSum = backendLedger.summary?.accruedInterest`.
   - Injects `formatCurrency(totalInterestSum)` directly into the final modal total summary element without frontend summation.
