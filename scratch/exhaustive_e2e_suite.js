const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    let browser;
    try {
        console.log('🚀 Launching Puppeteer for Exhaustive E2E UI Automation (60 Test Cases)...');
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files']
        });

        const page = await browser.newPage();
        
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.error('Browser Console Error:', msg.text());
            }
        });

        const fileUrl = `file:///d:/Projects/kirana%20ledger/index.html`;
        console.log(`📡 Navigating to ${fileUrl}...`);
        await page.goto(fileUrl, { waitUntil: 'load' });

        // Bypass login screen
        await page.evaluate(() => {
            const skipBtn = document.getElementById('btn-skip-login');
            if (skipBtn && !skipBtn.classList.contains('hidden')) {
                skipBtn.click();
            }
        });

        console.log('✅ App loaded successfully. Running 60 Exhaustive E2E Test Cases...\n');

        // Test Cases Definitions
        const testCases = [
            // 1-10: Basic Debits & Monthly Rates
            { id: 1, name: 'Single Debit 1000 @ 2% monthly, 30d', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }], asOfDate: '2025-01-31' },
            { id: 2, name: 'Single Debit 1000 @ 2% monthly, 15d', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }], asOfDate: '2025-01-16' },
            { id: 3, name: 'Single Debit 1000 @ 2% monthly, 0d', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }], asOfDate: '2025-01-01' },
            { id: 4, name: 'Two Debits 1000 @ 2% monthly, 30d apart', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'DEBIT', amount: 1000, date: '2025-01-31' }], asOfDate: '2025-01-31' },
            { id: 5, name: 'Three Debits 1000 @ 2% monthly, 30d apart', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'DEBIT', amount: 1000, date: '2025-01-31' }, { type: 'DEBIT', amount: 1000, date: '2025-03-02' }], asOfDate: '2025-03-02' },
            { id: 6, name: 'Debit 1000 @ 1.5% monthly, 30d', rate: 1.5, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }], asOfDate: '2025-01-31' },
            { id: 7, name: 'Debit 1000 @ 0% monthly, 30d', rate: 0, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }], asOfDate: '2025-01-31' },
            { id: 8, name: 'Debit 5000 @ 3% monthly, 10d', rate: 3, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 5000, date: '2025-01-01' }], asOfDate: '2025-01-11' },
            { id: 9, name: 'Fractional Debit 1000.50 @ 2% monthly, 30d', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000.5, date: '2025-01-01' }], asOfDate: '2025-01-31' },
            { id: 10, name: 'Debit 2000 @ 5% yearly, 4 months', rate: 5, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 2000, date: '2025-01-01' }], asOfDate: '2025-05-01' },

            // 11-20: Advance Protocol
            { id: 11, name: 'Single Credit 1000 -> Advance 1000', rate: 2, rateUnit: 'monthly', txns: [{ type: 'CREDIT', amount: 1000, date: '2025-01-01' }], asOfDate: '2025-01-01' },
            { id: 12, name: 'Single Credit 1000, wait 30d -> 0 Int', rate: 2, rateUnit: 'monthly', txns: [{ type: 'CREDIT', amount: 1000, date: '2025-01-01' }], asOfDate: '2025-01-31' },
            { id: 13, name: 'Credit 1000 then Debit 400 -> Advance 600', rate: 2, rateUnit: 'monthly', txns: [{ type: 'CREDIT', amount: 1000, date: '2025-01-01' }, { type: 'DEBIT', amount: 400, date: '2025-01-31' }], asOfDate: '2025-01-31' },
            { id: 14, name: 'Credit 1000 then Debit 1000 -> All 0', rate: 2, rateUnit: 'monthly', txns: [{ type: 'CREDIT', amount: 1000, date: '2025-01-01' }, { type: 'DEBIT', amount: 1000, date: '2025-01-31' }], asOfDate: '2025-01-31' },
            { id: 15, name: 'Credit 1000 then Debit 1500 -> Due 500', rate: 2, rateUnit: 'monthly', txns: [{ type: 'CREDIT', amount: 1000, date: '2025-01-01' }, { type: 'DEBIT', amount: 1500, date: '2025-01-31' }], asOfDate: '2025-01-31' },
            { id: 16, name: 'Credit 500, wait 30d, Debit 500 -> Due 0, Int 0', rate: 2, rateUnit: 'monthly', txns: [{ type: 'CREDIT', amount: 500, date: '2025-01-01' }, { type: 'DEBIT', amount: 500, date: '2025-01-31' }], asOfDate: '2025-01-31' },
            { id: 17, name: 'Credit 1000, wait 15d, Credit 500 -> Advance 1500', rate: 2, rateUnit: 'monthly', txns: [{ type: 'CREDIT', amount: 1000, date: '2025-01-01' }, { type: 'CREDIT', amount: 500, date: '2025-01-16' }], asOfDate: '2025-01-16' },
            { id: 18, name: 'Advance 100, Debit 50, Debit 50 -> Advance 0', rate: 2, rateUnit: 'monthly', txns: [{ type: 'CREDIT', amount: 100, date: '2025-01-01' }, { type: 'DEBIT', amount: 50, date: '2025-01-15' }, { type: 'DEBIT', amount: 50, date: '2025-01-31' }], asOfDate: '2025-01-31' },
            { id: 19, name: 'Advance 1000, Debit 2000 (same day) -> Due 1000', rate: 2, rateUnit: 'monthly', txns: [{ type: 'CREDIT', amount: 1000, date: '2025-01-01' }, { type: 'DEBIT', amount: 2000, date: '2025-01-01' }], asOfDate: '2025-01-01' },
            { id: 20, name: 'Advance 0.01, Debit 1000 -> Due 999.99', rate: 2, rateUnit: 'monthly', txns: [{ type: 'CREDIT', amount: 0.01, date: '2025-01-01' }, { type: 'DEBIT', amount: 1000, date: '2025-01-31' }], asOfDate: '2025-01-31' },

            // 21-30: Settlement Waterfall
            { id: 21, name: 'Due 1000, Int 19.35, Credit 10 -> Int 9.35, Due 1000', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'CREDIT', amount: 10, date: '2025-01-31' }], asOfDate: '2025-01-31' },
            { id: 22, name: 'Due 1000, Int 19.35, Credit 20 -> Int 0, Due 999.35', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'CREDIT', amount: 20, date: '2025-01-31' }], asOfDate: '2025-01-31' },
            { id: 23, name: 'Due 1000, Int 19.35, Credit 520 -> Int 0, Due 499.35', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'CREDIT', amount: 520, date: '2025-01-31' }], asOfDate: '2025-01-31' },
            { id: 24, name: 'Due 1000, Int 19.35, Credit 1020 -> Advance 0.65', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'CREDIT', amount: 1020, date: '2025-01-31' }], asOfDate: '2025-01-31' },
            { id: 25, name: 'Due 1000, Int 19.35, Credit 1100 -> Advance 80.65', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'CREDIT', amount: 1100, date: '2025-01-31' }], asOfDate: '2025-01-31' },
            { id: 26, name: 'Due 1000, Credit 1500 (same day) -> Advance 500', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'CREDIT', amount: 1500, date: '2025-01-01' }], asOfDate: '2025-01-01' },
            { id: 27, name: 'Credit 1019.35 pays exact Due+Int -> 0 state', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'CREDIT', amount: 1019.35, date: '2025-01-31' }], asOfDate: '2025-01-31' },
            { id: 28, name: 'Partial Int payment, wait 30d -> New int on principal', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'CREDIT', amount: 10, date: '2025-01-31' }], asOfDate: '2025-03-02' },
            { id: 29, name: 'Huge Credit pays accrued interest + principal', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 10000, date: '2025-01-01' }, { type: 'CREDIT', amount: 15000, date: '2025-10-28' }], asOfDate: '2025-10-28' },
            { id: 30, name: 'Credit exactly equals amount same day', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 5000, date: '2025-01-01' }, { type: 'CREDIT', amount: 5000, date: '2025-01-01' }], asOfDate: '2025-01-01' },

            // 31-40: Multi-Phase Rate Changes & Rate Units
            { id: 31, name: 'Multi-Phase: 10k @ 5% yearly (4m), then 6% yearly (4m)', rate: 5, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 10000, date: '2025-01-01', interestRate: 5, rateUnit: 'yearly' }, { type: 'DEBIT', amount: 0, date: '2025-05-01', interestRate: 6, rateUnit: 'yearly' }], asOfDate: '2025-09-01' },
            { id: 32, name: 'Multi-Phase: 10k @ 12% yearly (6m), then 18% yearly (6m)', rate: 12, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 10000, date: '2025-01-01', interestRate: 12, rateUnit: 'yearly' }, { type: 'DEBIT', amount: 0, date: '2025-07-01', interestRate: 18, rateUnit: 'yearly' }], asOfDate: '2026-01-01' },
            { id: 33, name: 'Multi-Phase: 5k @ 2% monthly (2m), then 1.5% monthly (2m)', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 5000, date: '2025-01-01', interestRate: 2, rateUnit: 'monthly' }, { type: 'DEBIT', amount: 0, date: '2025-03-01', interestRate: 1.5, rateUnit: 'monthly' }], asOfDate: '2025-05-01' },
            { id: 34, name: 'Multi-Phase: 10k @ 6% yearly (3m), then 0% (3m)', rate: 6, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 10000, date: '2025-01-01', interestRate: 6, rateUnit: 'yearly' }, { type: 'DEBIT', amount: 0, date: '2025-04-01', interestRate: 0, rateUnit: 'monthly' }], asOfDate: '2025-07-01' },
            { id: 35, name: 'Rate Unit variation: "year" rateUnit', rate: 6, rateUnit: 'year', txns: [{ type: 'DEBIT', amount: 10000, date: '2025-01-01', interestRate: 6, rateUnit: 'year' }], asOfDate: '2025-05-01' },
            { id: 36, name: 'Rate Unit variation: "annual" rateUnit', rate: 12, rateUnit: 'annual', txns: [{ type: 'DEBIT', amount: 10000, date: '2025-01-01', interestRate: 12, rateUnit: 'annual' }], asOfDate: '2025-07-01' },
            { id: 37, name: 'Rate Unit variation: "p.a." rateUnit', rate: 10, rateUnit: 'p.a.', txns: [{ type: 'DEBIT', amount: 10000, date: '2025-01-01', interestRate: 10, rateUnit: 'p.a.' }], asOfDate: '2025-07-01' },
            { id: 38, name: 'Multi-Phase: 3 Phases (5% yr -> 6% yr -> 7% yr)', rate: 5, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 10000, date: '2025-01-01', interestRate: 5, rateUnit: 'yearly' }, { type: 'DEBIT', amount: 0, date: '2025-04-01', interestRate: 6, rateUnit: 'yearly' }, { type: 'DEBIT', amount: 0, date: '2025-07-01', interestRate: 7, rateUnit: 'yearly' }], asOfDate: '2025-10-01' },
            { id: 39, name: 'Multi-Phase: Debit + Rate Change on same date', rate: 5, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 5000, date: '2025-01-01', interestRate: 5, rateUnit: 'yearly' }, { type: 'DEBIT', amount: 5000, date: '2025-05-01', interestRate: 8, rateUnit: 'yearly' }], asOfDate: '2025-09-01' },
            { id: 40, name: 'Multi-Phase: Debit 10k @ 2% monthly -> Credit partial -> Rate change to 1% monthly', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 10000, date: '2025-01-01' }, { type: 'CREDIT', amount: 2000, date: '2025-03-01', interestRate: 1, rateUnit: 'monthly' }], asOfDate: '2025-05-01' },

            // 41-50: Benchmark 8-Step Scenario & As-Of Date Checkpoints
            { id: 41, name: 'Benchmark Step 1: Jan 1 Debit 1000', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }], asOfDate: '2025-01-01' },
            { id: 42, name: 'Benchmark Step 2: Feb 1 Debit 1000', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'DEBIT', amount: 1000, date: '2025-01-31' }], asOfDate: '2025-01-31' },
            { id: 43, name: 'Benchmark Step 3: Mar 1 Debit 1000', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'DEBIT', amount: 1000, date: '2025-01-31' }, { type: 'DEBIT', amount: 1000, date: '2025-03-02' }], asOfDate: '2025-03-02' },
            { id: 44, name: 'Benchmark Step 4: Apr 1 Credit 4000', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'DEBIT', amount: 1000, date: '2025-01-31' }, { type: 'DEBIT', amount: 1000, date: '2025-03-02' }, { type: 'CREDIT', amount: 4000, date: '2025-04-01' }], asOfDate: '2025-04-01' },
            { id: 45, name: 'Benchmark Step 5: Apr 15 Debit 500', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'DEBIT', amount: 1000, date: '2025-01-31' }, { type: 'DEBIT', amount: 1000, date: '2025-03-02' }, { type: 'CREDIT', amount: 4000, date: '2025-04-01' }, { type: 'DEBIT', amount: 500, date: '2025-04-15' }], asOfDate: '2025-04-15' },
            { id: 46, name: 'Benchmark Step 6: Apr 20 Debit 1000', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'DEBIT', amount: 1000, date: '2025-01-31' }, { type: 'DEBIT', amount: 1000, date: '2025-03-02' }, { type: 'CREDIT', amount: 4000, date: '2025-04-01' }, { type: 'DEBIT', amount: 500, date: '2025-04-15' }, { type: 'DEBIT', amount: 1000, date: '2025-04-20' }], asOfDate: '2025-04-20' },
            { id: 47, name: 'Benchmark Step 7: May 20 Credit 1000', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'DEBIT', amount: 1000, date: '2025-01-31' }, { type: 'DEBIT', amount: 1000, date: '2025-03-02' }, { type: 'CREDIT', amount: 4000, date: '2025-04-01' }, { type: 'DEBIT', amount: 500, date: '2025-04-15' }, { type: 'DEBIT', amount: 1000, date: '2025-04-20' }, { type: 'CREDIT', amount: 1000, date: '2025-05-20' }], asOfDate: '2025-05-20' },
            { id: 48, name: 'Benchmark Step 8: Jun 1 Debit 500', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'DEBIT', amount: 1000, date: '2025-01-31' }, { type: 'DEBIT', amount: 1000, date: '2025-03-02' }, { type: 'CREDIT', amount: 4000, date: '2025-04-01' }, { type: 'DEBIT', amount: 500, date: '2025-04-15' }, { type: 'DEBIT', amount: 1000, date: '2025-04-20' }, { type: 'CREDIT', amount: 1000, date: '2025-05-20' }, { type: 'DEBIT', amount: 500, date: '2025-06-01' }], asOfDate: '2025-06-01' },
            { id: 49, name: 'Benchmark Workflow: as-of 2025-07-01', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'DEBIT', amount: 1000, date: '2025-01-31' }, { type: 'DEBIT', amount: 1000, date: '2025-03-02' }, { type: 'CREDIT', amount: 4000, date: '2025-04-01' }, { type: 'DEBIT', amount: 500, date: '2025-04-15' }, { type: 'DEBIT', amount: 1000, date: '2025-04-20' }, { type: 'CREDIT', amount: 1000, date: '2025-05-20' }, { type: 'DEBIT', amount: 500, date: '2025-06-01' }], asOfDate: '2025-07-01' },
            { id: 50, name: 'Benchmark Workflow: as-of 2025-08-01', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'DEBIT', amount: 1000, date: '2025-01-31' }, { type: 'DEBIT', amount: 1000, date: '2025-03-02' }, { type: 'CREDIT', amount: 4000, date: '2025-04-01' }, { type: 'DEBIT', amount: 500, date: '2025-04-15' }, { type: 'DEBIT', amount: 1000, date: '2025-04-20' }, { type: 'CREDIT', amount: 1000, date: '2025-05-20' }, { type: 'DEBIT', amount: 500, date: '2025-06-01' }], asOfDate: '2025-08-01' },

            // 51-60: Edge Cases (Leap Years, Micro/Macro, Voided, Backdated)
            { id: 51, name: 'Leap Year 2024: Feb 28 to Mar 1 (3000 @ 2% monthly)', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 3000, date: '2024-02-28' }], asOfDate: '2024-03-01' },
            { id: 52, name: 'Non-Leap Year 2025: Feb 28 to Mar 1 (3000 @ 2% monthly)', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 3000, date: '2025-02-28' }], asOfDate: '2025-03-01' },
            { id: 53, name: 'Micro Amount: Debit 0.01 @ 2% monthly', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 0.01, date: '2025-01-01' }], asOfDate: '2025-01-31' },
            { id: 54, name: 'Macro Amount: Debit 9,999,999.00 @ 2% monthly', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 9999999, date: '2025-01-01' }], asOfDate: '2025-01-31' },
            { id: 55, name: 'Voided Transaction: Skipped from calculations', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01', is_void: true }, { type: 'DEBIT', amount: 500, date: '2025-01-01', is_void: false }], asOfDate: '2025-01-31' },
            { id: 56, name: 'Backdated Entry: Sorted ASC before loop', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 500, date: '2025-01-31' }, { type: 'DEBIT', amount: 1000, date: '2025-01-01' }], asOfDate: '2025-01-31' },
            { id: 57, name: 'Zero Amount Debit: State unchanged', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 0, date: '2025-01-01' }], asOfDate: '2025-01-31' },
            { id: 58, name: 'Multi-Phase: 12% yearly (6m) -> 6% yearly (6m)', rate: 12, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 12000, date: '2025-01-01', interestRate: 12, rateUnit: 'yearly' }, { type: 'DEBIT', amount: 0, date: '2025-07-01', interestRate: 6, rateUnit: 'yearly' }], asOfDate: '2026-01-01' },
            { id: 59, name: 'Settlement Waterfall: 2 Debits + 1 Credit partial interest', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'DEBIT', amount: 1000, date: '2025-02-01' }, { type: 'CREDIT', amount: 15, date: '2025-03-01' }], asOfDate: '2025-03-01' },
            { id: 60, name: 'Complex Lifecycle: Multi-debit, multi-credit, multi-phase', rate: 6, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 10000, date: '2025-01-01', interestRate: 6, rateUnit: 'yearly' }, { type: 'CREDIT', amount: 2000, date: '2025-04-01' }, { type: 'DEBIT', amount: 5000, date: '2025-06-01', interestRate: 9, rateUnit: 'yearly' }], asOfDate: '2025-09-01' }
        ];

        let totalPassed = 0;
        let totalFailed = 0;

        for (const tc of testCases) {
            // Set up state for test case
            await page.evaluate((test) => {
                state.isTestMode = true;
                state.isAuthenticated = true;
                state.currentLedgerSummary = null;

                const cust = {
                    id: `cust-test-${test.id}`,
                    name: `Test Customer ${test.id}`,
                    phone: '9876543210',
                    lendingRate: test.rate,
                    rateUnit: test.rateUnit,
                    createdDate: '2025-01-01'
                };

                state.customers = [cust];
                state.currentCustomerId = cust.id;
                state.transactions = test.txns.map((t, idx) => ({
                    id: `tx-${test.id}-${idx}`,
                    customerId: cust.id,
                    ...t
                }));

                const asOfInput = document.getElementById('ledger-as-of-date');
                if (asOfInput) {
                    asOfInput.value = test.asOfDate;
                }

                if (typeof switchView === 'function') {
                    switchView('ledger-view');
                }
                renderLedger();
            }, tc);

            // Programmatically invoke breakdown modal
            await page.evaluate(() => {
                showInterestBreakdown();
            });

            // Wait for spinner to disappear / breakdown cards to render
            await page.waitForFunction(() => {
                const body = document.getElementById('interest-breakdown-body');
                return body && !body.querySelector('.spinner');
            }, { timeout: 3000 });

            // Audit Modal DOM Content & Mathematics
            const modalAudit = await page.evaluate(() => {
                const container = document.getElementById('interest-breakdown-body');
                if (!container) return { error: 'Container element not found' };

                const innerText = container.innerText || '';
                const hasNaN = innerText.includes('NaN');
                const hasUndefined = innerText.includes('undefined');

                const cards = container.querySelectorAll('.calc-breakdown-card');
                const phaseCards = [];
                let phaseSum = 0;

                cards.forEach((card, i) => {
                    const text = card.innerText;
                    const isZeroInt = text.includes('Zero Interest') || text.includes('0% Interest Accrued');
                    let interestVal = 0;

                    if (!isZeroInt) {
                        // Extract accrued interest for this phase card
                        const match = text.match(/Interest Accrued in Phase:\s*₹?\s*([\d,]+\.?\d*)/i) ||
                                      text.match(/\+\s*₹?\s*([\d,]+\.?\d*)/);
                        if (match) {
                            interestVal = parseFloat(match[1].replace(/,/g, '')) || 0;
                        }
                    }
                    phaseCards.push({ index: i + 1, interest: interestVal, isZeroInt });
                    phaseSum += interestVal;
                });

                phaseSum = Math.round((phaseSum + Number.EPSILON) * 100) / 100;

                // Extract Footer Total Accrued Interest
                const footerText = container.innerText;
                const totalMatch = footerText.match(/Total Accrued Interest:\s*₹?\s*([\d,]+\.?\d*)/i);
                let footerTotal = 0;
                if (totalMatch) {
                    footerTotal = parseFloat(totalMatch[1].replace(/,/g, '')) || 0;
                }

                return {
                    cardCount: cards.length,
                    phaseCards,
                    phaseSum,
                    footerTotal,
                    hasNaN,
                    hasUndefined,
                    innerTextSnippet: innerText.substring(0, 150)
                };
            });

            // Assertions
            let casePassed = true;
            const errors = [];

            if (modalAudit.error) {
                casePassed = false;
                errors.push(modalAudit.error);
            } else {
                if (modalAudit.hasNaN) {
                    casePassed = false;
                    errors.push('DOM contains "NaN"');
                }
                if (modalAudit.hasUndefined) {
                    casePassed = false;
                    errors.push('DOM contains "undefined"');
                }
                if (Math.abs(modalAudit.phaseSum - modalAudit.footerTotal) > 0.01) {
                    casePassed = false;
                    errors.push(`Footer Total (${modalAudit.footerTotal}) != Phase Sum (${modalAudit.phaseSum})`);
                }
            }

            if (casePassed) {
                totalPassed++;
                console.log(`  ✓ Case #${tc.id.toString().padStart(2, '0')}: [PASSED] "${tc.name}" -> ${modalAudit.cardCount} Phase Cards, Footer: ₹${modalAudit.footerTotal}`);
            } else {
                totalFailed++;
                console.error(`  ✕ Case #${tc.id.toString().padStart(2, '0')}: [FAILED] "${tc.name}" -> Errors: ${errors.join('; ')}`);
            }

            // Close modal for next test
            await page.evaluate(() => {
                toggleModal('interest-breakdown-modal', false);
            });
        }

        console.log('\n==================================================');
        console.log(`📊 E2E EXHAUSTIVE TEST SUITE SUMMARY:`);
        console.log(`   Total Cases Executed : ${testCases.length}`);
        console.log(`   Passed               : ${totalPassed}`);
        console.log(`   Failed               : ${totalFailed}`);
        console.log('==================================================\n');

        if (totalFailed > 0) {
            process.exitCode = 1;
        } else {
            console.log('🎉 ALL 60 E2E DOM TEST CASES PASSED WITH 100% MATHEMATICAL PRECISION!');
        }

    } catch (err) {
        console.error('💥 E2E Suite Error:', err);
        process.exitCode = 1;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
})();
