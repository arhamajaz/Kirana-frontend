const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    let browser;
    try {
        console.log('🚀 Launching Puppeteer for Pre-Calculated E2E Suite (60 Test Cases)...');
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

        console.log('✅ App loaded successfully. Executing Pre-Calculated E2E Rate Validation Suite...\n');

        // 60 Pre-Calculated Test Cases
        const testCases = [
            // CRITICAL TEST CASE #1
            { id: 1, name: 'CRITICAL: ₹10,000 @ 12% Yearly, 4 months -> Exactly ₹400.00', rate: 12, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 10000, date: '2025-01-01' }], asOfDate: '2025-05-01', expectedInterest: 400.00, expectedLabel: '12% yearly' },

            // User Reported Bug Scenario #2
            { id: 2, name: 'DISCREPANCY BUG FIX: ₹50,000 @ 6% Yearly, 4 months -> Exactly ₹1,000.00', rate: 6, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 50000, date: '2026-06-04' }], asOfDate: '2026-10-04', expectedInterest: 1000.00, expectedLabel: '6% yearly' },

            // 3-10: Standard Yearly & Monthly Rates
            { id: 3, name: '₹20,000 @ 18% Yearly, 6 months -> Exactly ₹1,800.00', rate: 18, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 20000, date: '2025-01-01' }], asOfDate: '2025-07-01', expectedInterest: 1800.00, expectedLabel: '18% yearly' },
            { id: 4, name: '₹15,000 @ 24% Yearly, 3 months -> Exactly ₹900.00', rate: 24, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 15000, date: '2025-01-01' }], asOfDate: '2025-04-01', expectedInterest: 900.00, expectedLabel: '24% yearly' },
            { id: 5, name: '₹10,000 @ 2% Monthly, 2 months -> Exactly ₹400.00', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 10000, date: '2025-01-01' }], asOfDate: '2025-03-01', expectedInterest: 400.00, expectedLabel: '2% monthly' },
            { id: 6, name: '₹10,000 @ 1% Monthly, 5 months -> Exactly ₹500.00', rate: 1, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 10000, date: '2025-01-01' }], asOfDate: '2025-06-01', expectedInterest: 500.00, expectedLabel: '1% monthly' },
            { id: 7, name: '₹30,000 @ 12% Yearly, 1 month -> Exactly ₹300.00', rate: 12, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 30000, date: '2025-01-01' }], asOfDate: '2025-02-01', expectedInterest: 300.00, expectedLabel: '12% yearly' },
            { id: 8, name: '₹40,000 @ 9% Yearly, 4 months -> Exactly ₹1,200.00', rate: 9, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 40000, date: '2025-01-01' }], asOfDate: '2025-05-01', expectedInterest: 1200.00, expectedLabel: '9% yearly' },
            { id: 9, name: '₹50,000 @ 15% Yearly, 2 months -> Exactly ₹1,250.00', rate: 15, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 50000, date: '2025-01-01' }], asOfDate: '2025-03-01', expectedInterest: 1250.00, expectedLabel: '15% yearly' },
            { id: 10, name: '₹10,000 @ 0% Yearly, 6 months -> Exactly ₹0.00', rate: 0, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 10000, date: '2025-01-01' }], asOfDate: '2025-07-01', expectedInterest: 0.00, expectedLabel: '0% yearly' },

            // 11-20: Advance & Overpayment Scenarios (Expected Interest: 0)
            { id: 11, name: 'Single Credit ₹10,000 -> Advance ₹10,000', rate: 12, rateUnit: 'yearly', txns: [{ type: 'CREDIT', amount: 10000, date: '2025-01-01' }], asOfDate: '2025-05-01', expectedInterest: 0.00 },
            { id: 12, name: 'Credit ₹10,000 then Debit ₹4,000 -> Advance ₹6,000', rate: 12, rateUnit: 'yearly', txns: [{ type: 'CREDIT', amount: 10000, date: '2025-01-01' }, { type: 'DEBIT', amount: 4000, date: '2025-01-31' }], asOfDate: '2025-05-01', expectedInterest: 0.00 },
            { id: 13, name: 'Credit ₹10,000 then Debit ₹10,000 -> All ₹0', rate: 12, rateUnit: 'yearly', txns: [{ type: 'CREDIT', amount: 10000, date: '2025-01-01' }, { type: 'DEBIT', amount: 10000, date: '2025-01-31' }], asOfDate: '2025-05-01', expectedInterest: 0.00 },
            { id: 14, name: 'Credit ₹5,000 then Debit ₹8,000 -> Principal ₹3,000 for 3m @ 12% yr -> ₹90', rate: 12, rateUnit: 'yearly', txns: [{ type: 'CREDIT', amount: 5000, date: '2025-01-01' }, { type: 'DEBIT', amount: 8000, date: '2025-01-31' }], asOfDate: '2025-04-30', expectedInterest: 90.00 },
            { id: 15, name: 'Credit ₹500, wait 30d, Debit ₹500 -> 0 Due, 0 Int', rate: 12, rateUnit: 'yearly', txns: [{ type: 'CREDIT', amount: 500, date: '2025-01-01' }, { type: 'DEBIT', amount: 500, date: '2025-01-31' }], asOfDate: '2025-01-31', expectedInterest: 0.00 },
            { id: 16, name: 'Credit ₹1000, wait 15d, Credit ₹500 -> Advance ₹1500', rate: 12, rateUnit: 'yearly', txns: [{ type: 'CREDIT', amount: 1000, date: '2025-01-01' }, { type: 'CREDIT', amount: 500, date: '2025-01-16' }], asOfDate: '2025-05-01', expectedInterest: 0.00 },
            { id: 17, name: 'Advance ₹100, Debit ₹50, Debit ₹50 -> Advance ₹0', rate: 12, rateUnit: 'yearly', txns: [{ type: 'CREDIT', amount: 100, date: '2025-01-01' }, { type: 'DEBIT', amount: 50, date: '2025-01-15' }, { type: 'DEBIT', amount: 50, date: '2025-01-31' }], asOfDate: '2025-01-31', expectedInterest: 0.00 },
            { id: 18, name: 'Advance ₹1000, Debit ₹2000 same day -> Due ₹1000 for 4m @ 12% yr -> ₹40', rate: 12, rateUnit: 'yearly', txns: [{ type: 'CREDIT', amount: 1000, date: '2025-01-01' }, { type: 'DEBIT', amount: 2000, date: '2025-01-01' }], asOfDate: '2025-05-01', expectedInterest: 40.00 },
            { id: 19, name: 'Advance ₹0.01, Debit ₹1000 -> Due ₹999.99 for 4m @ 12% yr -> ₹40.00', rate: 12, rateUnit: 'yearly', txns: [{ type: 'CREDIT', amount: 0.01, date: '2025-01-01' }, { type: 'DEBIT', amount: 1000, date: '2025-01-01' }], asOfDate: '2025-05-01', expectedInterest: 40.00 },
            { id: 20, name: 'Credit pays exact principal same day -> ₹0 Int', rate: 12, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 5000, date: '2025-01-01' }, { type: 'CREDIT', amount: 5000, date: '2025-01-01' }], asOfDate: '2025-05-01', expectedInterest: 0.00 },

            // 21-30: Settlement Waterfall & Partial Payments
            { id: 21, name: 'Debit 1000 @ 2% monthly for 30d (19.35 int), Credit 10 -> Int remaining 9.35', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'CREDIT', amount: 10, date: '2025-01-31' }], asOfDate: '2025-01-31', expectedInterest: 9.35 },
            { id: 22, name: 'Debit 1000 @ 2% monthly for 30d (19.35 int), Credit 20 -> Int 0, Due 999.35', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'CREDIT', amount: 20, date: '2025-01-31' }], asOfDate: '2025-01-31', expectedInterest: 0.00 },
            { id: 23, name: 'Debit 1000 @ 2% monthly for 30d (19.35 int), Credit 520 -> Int 0, Due 499.35', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'CREDIT', amount: 520, date: '2025-01-31' }], asOfDate: '2025-01-31', expectedInterest: 0.00 },
            { id: 24, name: 'Debit 1000 @ 2% monthly for 30d, Credit 1020 -> Advance 0.65', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'CREDIT', amount: 1020, date: '2025-01-31' }], asOfDate: '2025-01-31', expectedInterest: 0.00 },
            { id: 25, name: 'Debit 1000 @ 2% monthly for 30d, Credit 1100 -> Advance 80.65', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'CREDIT', amount: 1100, date: '2025-01-31' }], asOfDate: '2025-01-31', expectedInterest: 0.00 },
            { id: 26, name: 'Debit 1000 @ 12% yearly for 4m (400 int), Credit 100 -> Int remaining 300.00', rate: 12, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 10000, date: '2025-01-01' }, { type: 'CREDIT', amount: 100, date: '2025-05-01' }], asOfDate: '2025-05-01', expectedInterest: 300.00 },
            { id: 27, name: 'Debit 10000 @ 12% yearly for 4m (400 int), Credit 400 -> Int remaining 0.00', rate: 12, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 10000, date: '2025-01-01' }, { type: 'CREDIT', amount: 400, date: '2025-05-01' }], asOfDate: '2025-05-01', expectedInterest: 0.00 },
            { id: 28, name: 'Debit 10000 @ 12% yearly for 4m (400 int), Credit 5400 -> Int 0, Due 5000', rate: 12, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 10000, date: '2025-01-01' }, { type: 'CREDIT', amount: 5400, date: '2025-05-01' }], asOfDate: '2025-05-01', expectedInterest: 0.00 },
            { id: 29, name: 'Huge Credit pays off principal + interest -> 0 Int', rate: 12, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 10000, date: '2025-01-01' }, { type: 'CREDIT', amount: 15000, date: '2025-10-28' }], asOfDate: '2025-10-28', expectedInterest: 0.00 },
            { id: 30, name: 'Debit 20000 @ 6% yearly for 10m -> Exactly ₹1000.00', rate: 6, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 20000, date: '2025-01-01' }], asOfDate: '2025-11-01', expectedInterest: 1000.00, expectedLabel: '6% yearly' },

            // 31-40: Multi-Phase Rate Changes
            { id: 31, name: 'Multi-Phase: 10k @ 5% yearly (4m: 166.67) + 6% yearly (4m: 200.00) -> 366.67', rate: 5, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 10000, date: '2025-01-01', interestRate: 5, rateUnit: 'yearly' }, { type: 'DEBIT', amount: 0, date: '2025-05-01', interestRate: 6, rateUnit: 'yearly' }], asOfDate: '2025-09-01', expectedInterest: 366.67 },
            { id: 32, name: 'Multi-Phase: 10k @ 12% yearly (6m: 600) + 18% yearly (6m: 900) -> 1500.00', rate: 12, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 10000, date: '2025-01-01', interestRate: 12, rateUnit: 'yearly' }, { type: 'DEBIT', amount: 0, date: '2025-07-01', interestRate: 18, rateUnit: 'yearly' }], asOfDate: '2026-01-01', expectedInterest: 1500.00 },
            { id: 33, name: 'Multi-Phase: 5k @ 2% monthly (2m: 200) + 1.5% monthly (2m: 150) -> 350.00', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 5000, date: '2025-01-01', interestRate: 2, rateUnit: 'monthly' }, { type: 'DEBIT', amount: 0, date: '2025-03-01', interestRate: 1.5, rateUnit: 'monthly' }], asOfDate: '2025-05-01', expectedInterest: 350.00 },
            { id: 34, name: 'Multi-Phase: 10k @ 6% yearly (3m: 150) + 0% (3m: 0) -> 150.00', rate: 6, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 10000, date: '2025-01-01', interestRate: 6, rateUnit: 'yearly' }, { type: 'DEBIT', amount: 0, date: '2025-04-01', interestRate: 0, rateUnit: 'monthly' }], asOfDate: '2025-07-01', expectedInterest: 150.00 },
            { id: 35, name: 'Rate Unit variation: "year" -> 10k @ 6% year for 4m -> 200.00', rate: 6, rateUnit: 'year', txns: [{ type: 'DEBIT', amount: 10000, date: '2025-01-01', interestRate: 6, rateUnit: 'year' }], asOfDate: '2025-05-01', expectedInterest: 200.00 },
            { id: 36, name: 'Rate Unit variation: "annual" -> 10k @ 12% annual for 6m -> 600.00', rate: 12, rateUnit: 'annual', txns: [{ type: 'DEBIT', amount: 10000, date: '2025-01-01', interestRate: 12, rateUnit: 'annual' }], asOfDate: '2025-07-01', expectedInterest: 600.00 },
            { id: 37, name: 'Rate Unit variation: "p.a." -> 10k @ 10% p.a. for 6m -> 500.00', rate: 10, rateUnit: 'p.a.', txns: [{ type: 'DEBIT', amount: 10000, date: '2025-01-01', interestRate: 10, rateUnit: 'p.a.' }], asOfDate: '2025-07-01', expectedInterest: 500.00 },
            { id: 38, name: 'Multi-Phase 3 Phases: 5% yr (3m: 125) + 6% yr (3m: 150) + 7% yr (3m: 175) -> 450.00', rate: 5, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 10000, date: '2025-01-01', interestRate: 5, rateUnit: 'yearly' }, { type: 'DEBIT', amount: 0, date: '2025-04-01', interestRate: 6, rateUnit: 'yearly' }, { type: 'DEBIT', amount: 0, date: '2025-07-01', interestRate: 7, rateUnit: 'yearly' }], asOfDate: '2025-10-01', expectedInterest: 450.00 },
            { id: 39, name: 'Debit + Rate Change same date -> 5k @ 5% yr (4m: 83.33) + 10k @ 8% yr (4m: 266.67) -> 350.00', rate: 5, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 5000, date: '2025-01-01', interestRate: 5, rateUnit: 'yearly' }, { type: 'DEBIT', amount: 5000, date: '2025-05-01', interestRate: 8, rateUnit: 'yearly' }], asOfDate: '2025-09-01', expectedInterest: 350.00 },
            { id: 40, name: 'Debit 10k @ 2% monthly -> Credit 2000 -> Rate change 1% monthly -> 168.00', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 10000, date: '2025-01-01' }, { type: 'CREDIT', amount: 2000, date: '2025-03-01', interestRate: 1, rateUnit: 'monthly' }], asOfDate: '2025-05-01', expectedInterest: 168.00 },

            // 41-50: Benchmark 8-Step Scenario Checkpoints
            { id: 41, name: 'Benchmark Step 1: Jan 1 Debit 1000 -> 0 Int', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }], asOfDate: '2025-01-01', expectedInterest: 0.00 },
            { id: 42, name: 'Benchmark Step 2: Feb 1 Debit 1000 -> 19.35 Int', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'DEBIT', amount: 1000, date: '2025-01-31' }], asOfDate: '2025-01-31', expectedInterest: 19.35 },
            { id: 43, name: 'Benchmark Step 3: Mar 1 Debit 1000 -> 61.93 Int', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'DEBIT', amount: 1000, date: '2025-01-31' }, { type: 'DEBIT', amount: 1000, date: '2025-03-02' }], asOfDate: '2025-03-02', expectedInterest: 61.93 },
            { id: 44, name: 'Benchmark Step 4: Apr 1 Credit 4000 -> Advance 880.01, 0 Int', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'DEBIT', amount: 1000, date: '2025-01-31' }, { type: 'DEBIT', amount: 1000, date: '2025-03-02' }, { type: 'CREDIT', amount: 4000, date: '2025-04-01' }], asOfDate: '2025-04-01', expectedInterest: 0.00 },
            { id: 45, name: 'Benchmark Step 5: Apr 15 Debit 500 -> Advance 380.01, 0 Int', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'DEBIT', amount: 1000, date: '2025-01-31' }, { type: 'DEBIT', amount: 1000, date: '2025-03-02' }, { type: 'CREDIT', amount: 4000, date: '2025-04-01' }, { type: 'DEBIT', amount: 500, date: '2025-04-15' }], asOfDate: '2025-04-15', expectedInterest: 0.00 },
            { id: 46, name: 'Benchmark Step 6: Apr 20 Debit 1000 -> Due 619.99, 0 Int', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'DEBIT', amount: 1000, date: '2025-01-31' }, { type: 'DEBIT', amount: 1000, date: '2025-03-02' }, { type: 'CREDIT', amount: 4000, date: '2025-04-01' }, { type: 'DEBIT', amount: 500, date: '2025-04-15' }, { type: 'DEBIT', amount: 1000, date: '2025-04-20' }], asOfDate: '2025-04-20', expectedInterest: 0.00 },
            { id: 47, name: 'Benchmark Step 7: May 20 Credit 1000 -> Advance 367.61, 0 Int', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'DEBIT', amount: 1000, date: '2025-01-31' }, { type: 'DEBIT', amount: 1000, date: '2025-03-02' }, { type: 'CREDIT', amount: 4000, date: '2025-04-01' }, { type: 'DEBIT', amount: 500, date: '2025-04-15' }, { type: 'DEBIT', amount: 1000, date: '2025-04-20' }, { type: 'CREDIT', amount: 1000, date: '2025-05-20' }], asOfDate: '2025-05-20', expectedInterest: 0.00 },
            { id: 48, name: 'Benchmark Step 8: Jun 1 Debit 500 -> Due 132.39, 0 Int', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'DEBIT', amount: 1000, date: '2025-01-31' }, { type: 'DEBIT', amount: 1000, date: '2025-03-02' }, { type: 'CREDIT', amount: 4000, date: '2025-04-01' }, { type: 'DEBIT', amount: 500, date: '2025-04-15' }, { type: 'DEBIT', amount: 1000, date: '2025-04-20' }, { type: 'CREDIT', amount: 1000, date: '2025-05-20' }, { type: 'DEBIT', amount: 500, date: '2025-06-01' }], asOfDate: '2025-06-01', expectedInterest: 0.00 },
            { id: 49, name: 'Benchmark Workflow: as-of 2025-07-01 -> 2.65 Int', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'DEBIT', amount: 1000, date: '2025-01-31' }, { type: 'DEBIT', amount: 1000, date: '2025-03-02' }, { type: 'CREDIT', amount: 4000, date: '2025-04-01' }, { type: 'DEBIT', amount: 500, date: '2025-04-15' }, { type: 'DEBIT', amount: 1000, date: '2025-04-20' }, { type: 'CREDIT', amount: 1000, date: '2025-05-20' }, { type: 'DEBIT', amount: 500, date: '2025-06-01' }], asOfDate: '2025-07-01', expectedInterest: 2.65 },
            { id: 50, name: 'Benchmark Workflow: as-of 2025-08-01 -> 5.30 Int', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'DEBIT', amount: 1000, date: '2025-01-31' }, { type: 'DEBIT', amount: 1000, date: '2025-03-02' }, { type: 'CREDIT', amount: 4000, date: '2025-04-01' }, { type: 'DEBIT', amount: 500, date: '2025-04-15' }, { type: 'DEBIT', amount: 1000, date: '2025-04-20' }, { type: 'CREDIT', amount: 1000, date: '2025-05-20' }, { type: 'DEBIT', amount: 500, date: '2025-06-01' }], asOfDate: '2025-08-01', expectedInterest: 5.30 },

            // 51-60: Edge Cases (Leap Years, Micro/Macro, Voided, Backdated)
            { id: 51, name: 'Leap Year 2024: Feb 28 to Mar 1 (3000 @ 2% monthly) -> 4.14', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 3000, date: '2024-02-28' }], asOfDate: '2024-03-01', expectedInterest: 4.14 },
            { id: 52, name: 'Non-Leap Year 2025: Feb 28 to Mar 1 (3000 @ 2% monthly) -> 2.14', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 3000, date: '2025-02-28' }], asOfDate: '2025-03-01', expectedInterest: 2.14 },
            { id: 53, name: 'Micro Amount: Debit 0.01 @ 2% monthly -> 0.00', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 0.01, date: '2025-01-01' }], asOfDate: '2025-01-31', expectedInterest: 0.00 },
            { id: 54, name: 'Macro Amount: Debit 9,999,999.00 @ 2% monthly -> 193548.37', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 9999999, date: '2025-01-01' }], asOfDate: '2025-01-31', expectedInterest: 193548.37 },
            { id: 55, name: 'Voided Transaction: Skipped from calculations -> 9.68', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01', is_void: true }, { type: 'DEBIT', amount: 500, date: '2025-01-01', is_void: false }], asOfDate: '2025-01-31', expectedInterest: 9.68 },
            { id: 56, name: 'Backdated Entry: Sorted ASC before loop -> 19.35', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 500, date: '2025-01-31' }, { type: 'DEBIT', amount: 1000, date: '2025-01-01' }], asOfDate: '2025-01-31', expectedInterest: 19.35 },
            { id: 57, name: 'Zero Amount Debit: State unchanged -> 0.00', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 0, date: '2025-01-01' }], asOfDate: '2025-01-31', expectedInterest: 0.00 },
            { id: 58, name: 'Multi-Phase: 12% yearly (6m: 600) + 6% yearly (6m: 480) -> 1080.00', rate: 12, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 12000, date: '2025-01-01', interestRate: 12, rateUnit: 'yearly' }, { type: 'DEBIT', amount: 0, date: '2025-07-01', interestRate: 6, rateUnit: 'yearly' }], asOfDate: '2026-01-01', expectedInterest: 1080.00 },
            { id: 59, name: 'Settlement Waterfall: 2 Debits + 1 Credit partial interest -> 45.00', rate: 2, rateUnit: 'monthly', txns: [{ type: 'DEBIT', amount: 1000, date: '2025-01-01' }, { type: 'DEBIT', amount: 1000, date: '2025-02-01' }, { type: 'CREDIT', amount: 15, date: '2025-03-01' }], asOfDate: '2025-03-01', expectedInterest: 45.00 },
            { id: 60, name: 'Complex Lifecycle: Multi-debit, multi-credit, multi-phase -> 377.38', rate: 6, rateUnit: 'yearly', txns: [{ type: 'DEBIT', amount: 10000, date: '2025-01-01', interestRate: 6, rateUnit: 'yearly' }, { type: 'CREDIT', amount: 2000, date: '2025-04-01' }, { type: 'DEBIT', amount: 5000, date: '2025-06-01', interestRate: 9, rateUnit: 'yearly' }], asOfDate: '2025-09-01', expectedInterest: 377.38 }
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

            // Scrape Dashboard #summary-interest value
            const dashboardSummaryInterestText = await page.$eval('#summary-interest', el => el.innerText.trim());

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

            // Parse numeric values from scraped texts
            const parseVal = (str) => {
                if (!str) return 0;
                const clean = str.replace(/[₹,]/g, '').trim();
                return parseFloat(clean) || 0;
            };

            const dashboardInterestVal = parseVal(dashboardSummaryInterestText);
            const expectedVal = tc.expectedInterest;

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
                // Assert Dashboard #summary-interest === Expected
                if (Math.abs(dashboardInterestVal - expectedVal) > 0.01) {
                    casePassed = false;
                    errors.push(`Dashboard #summary-interest (₹${dashboardInterestVal}) != Expected (₹${expectedVal})`);
                }
                // Assert Modal Footer === Expected
                if (Math.abs(modalAudit.footerTotal - expectedVal) > 0.01) {
                    casePassed = false;
                    errors.push(`Modal Footer Total (₹${modalAudit.footerTotal}) != Expected (₹${expectedVal})`);
                }
                // Assert Modal Footer === Phase Cards Sum
                if (Math.abs(modalAudit.phaseSum - modalAudit.footerTotal) > 0.01) {
                    casePassed = false;
                    errors.push(`Modal Footer Total (₹${modalAudit.footerTotal}) != Phase Cards Sum (₹${modalAudit.phaseSum})`);
                }
                // Assert Rate Label if specified
                if (tc.expectedLabel) {
                    if (!modalAudit.innerTextSnippet.includes(tc.expectedLabel)) {
                        casePassed = false;
                        errors.push(`Expected rate label "${tc.expectedLabel}" not found in DOM`);
                    }
                }
            }

            if (casePassed) {
                totalPassed++;
                console.log(`  ✓ Case #${tc.id.toString().padStart(2, '0')}: [PASSED] "${tc.name}" -> Dashboard: ₹${dashboardInterestVal} | Modal Footer: ₹${modalAudit.footerTotal}`);
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
        console.log(`📊 PRE-CALCULATED E2E VALIDATION SUITE SUMMARY:`);
        console.log(`   Total Cases Executed : ${testCases.length}`);
        console.log(`   Passed               : ${totalPassed}`);
        console.log(`   Failed               : ${totalFailed}`);
        console.log('==================================================\n');

        if (totalFailed > 0) {
            process.exitCode = 1;
        } else {
            console.log('🎉 ALL 60 PRE-CALCULATED E2E DOM TEST CASES PASSED WITH 100% MATHEMATICAL ACCURACY!');
        }

    } catch (err) {
        console.error('💥 E2E Validation Suite Error:', err);
        process.exitCode = 1;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
})();
