const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    let browser;
    try {
        console.log('🚀 Launching Puppeteer for Compound Interest E2E Suite...');
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

        console.log('✅ App loaded successfully. Executing Compound Interest E2E Suite...\n');

        // 11 Pre-Calculated Compound Interest Test Cases
        const testCases = [
            // DIRECTIVE 2 CRITICAL BENCHMARK CASE
            {
                id: 1,
                name: 'BENCHMARK: ₹10,000 @ 12% Yearly Compound, 3 months -> Exactly ₹303.01',
                rate: 12,
                rateUnit: 'yearly',
                interestType: 'compound',
                txns: [{ type: 'DEBIT', amount: 10000, date: '2026-01-01', interestRate: 12, rateUnit: 'yearly', interestType: 'compound' }],
                asOfDate: '2026-04-01',
                expectedInterest: 303.01,
                expectedLabel: '12% yearly (Compound)'
            },
            {
                id: 2,
                name: '₹20,000 @ 2% Monthly Compound, 2 months -> Exactly ₹808.00',
                rate: 2,
                rateUnit: 'monthly',
                interestType: 'compound',
                txns: [{ type: 'DEBIT', amount: 20000, date: '2026-01-01', interestRate: 2, rateUnit: 'monthly', interestType: 'compound' }],
                asOfDate: '2026-03-01',
                expectedInterest: 808.00,
                expectedLabel: '2% monthly (Compound)'
            },
            {
                id: 3,
                name: '₹10,000 @ 12% Yearly Compound, 6 months -> Exactly ₹615.20',
                rate: 12,
                rateUnit: 'yearly',
                interestType: 'compound',
                txns: [{ type: 'DEBIT', amount: 10000, date: '2026-01-01', interestRate: 12, rateUnit: 'yearly', interestType: 'compound' }],
                asOfDate: '2026-07-01',
                expectedInterest: 615.20,
                expectedLabel: '12% yearly (Compound)'
            },
            {
                id: 4,
                name: '₹10,000 @ 12% Yearly Compound, 1 month -> Exactly ₹100.00',
                rate: 12,
                rateUnit: 'yearly',
                interestType: 'compound',
                txns: [{ type: 'DEBIT', amount: 10000, date: '2026-01-01', interestRate: 12, rateUnit: 'yearly', interestType: 'compound' }],
                asOfDate: '2026-02-01',
                expectedInterest: 100.00,
                expectedLabel: '12% yearly (Compound)'
            },
            {
                id: 5,
                name: '₹50,000 @ 6% Yearly Compound, 4 months -> Exactly ₹1,007.53',
                rate: 6,
                rateUnit: 'yearly',
                interestType: 'compound',
                txns: [{ type: 'DEBIT', amount: 50000, date: '2026-01-01', interestRate: 6, rateUnit: 'yearly', interestType: 'compound' }],
                asOfDate: '2026-05-01',
                expectedInterest: 1007.53,
                expectedLabel: '6% yearly (Compound)'
            },
            {
                id: 6,
                name: 'Advance ₹5,000 Credit, Debit ₹2,000 in Compound Mode -> Exactly ₹0.00 Int',
                rate: 12,
                rateUnit: 'yearly',
                interestType: 'compound',
                txns: [{ type: 'CREDIT', amount: 5000, date: '2026-01-01', interestType: 'compound' }, { type: 'DEBIT', amount: 2000, date: '2026-02-01', interestType: 'compound' }],
                asOfDate: '2026-04-01',
                expectedInterest: 0.00
            },
            {
                id: 7,
                name: 'Partial Credit Waterfall: Debit 10k @ 12% Yr Compound for 3m (303.01 int), Credit 103.01 -> Int remaining 200.00',
                rate: 12,
                rateUnit: 'yearly',
                interestType: 'compound',
                txns: [{ type: 'DEBIT', amount: 10000, date: '2026-01-01', interestRate: 12, rateUnit: 'yearly', interestType: 'compound' }, { type: 'CREDIT', amount: 103.01, date: '2026-04-01' }],
                asOfDate: '2026-04-01',
                expectedInterest: 200.00
            },
            {
                id: 8,
                name: 'Multi-Phase Compound: 10k @ 12% Yr Compound (3m: 303.01) + 6% Yr Compound (3m: 155.32) -> 458.33',
                rate: 12,
                rateUnit: 'yearly',
                interestType: 'compound',
                txns: [{ type: 'DEBIT', amount: 10000, date: '2026-01-01', interestRate: 12, rateUnit: 'yearly', interestType: 'compound' }, { type: 'DEBIT', amount: 0, date: '2026-04-01', interestRate: 6, rateUnit: 'yearly', interestType: 'compound' }],
                asOfDate: '2026-07-01',
                expectedInterest: 458.33
            },
            {
                id: 9,
                name: 'Fractional days: 10,000 @ 12% Yr Compound for 15 days in Jan (15/31m) -> Exactly ₹48.26',
                rate: 12,
                rateUnit: 'yearly',
                interestType: 'compound',
                txns: [{ type: 'DEBIT', amount: 10000, date: '2026-01-01', interestRate: 12, rateUnit: 'yearly', interestType: 'compound' }],
                asOfDate: '2026-01-16',
                expectedInterest: 48.26
            },
            {
                id: 10,
                name: 'Overpayment / Huge Credit in Compound Mode -> 0 Int Accrued',
                rate: 12,
                rateUnit: 'yearly',
                interestType: 'compound',
                txns: [{ type: 'DEBIT', amount: 10000, date: '2026-01-01', interestType: 'compound' }, { type: 'CREDIT', amount: 15000, date: '2026-04-01' }],
                asOfDate: '2026-04-01',
                expectedInterest: 0.00
            },
            {
                id: 11,
                name: 'Micro Amount: Debit 0.01 @ 2% Monthly Compound -> Exactly ₹0.00 Int',
                rate: 2,
                rateUnit: 'monthly',
                interestType: 'compound',
                txns: [{ type: 'DEBIT', amount: 0.01, date: '2026-01-01', interestRate: 2, rateUnit: 'monthly', interestType: 'compound' }],
                asOfDate: '2026-03-01',
                expectedInterest: 0.00
            },
            {
                id: 12,
                name: '2-Phase Capitalization Benchmark: 50k (4m @ 12% yr compound) + 100k debit (2m @ 12% yr compound) -> Exactly ₹5,086.01',
                rate: 12,
                rateUnit: 'yearly',
                interestType: 'compound',
                txns: [
                    { type: 'DEBIT', amount: 50000, date: '2026-01-01', interestRate: 12, rateUnit: 'yearly', interestType: 'compound' },
                    { type: 'DEBIT', amount: 100000, date: '2026-05-01', interestRate: 12, rateUnit: 'yearly', interestType: 'compound' }
                ],
                asOfDate: '2026-07-01',
                expectedInterest: 5086.01
            }
        ];

        let totalPassed = 0;
        let totalFailed = 0;

        for (const tc of testCases) {
            // Inject state into page
            await page.evaluate((test) => {
                state.isTestMode = true;
                state.isAuthenticated = true;
                state.currentLedgerSummary = null;

                const cust = {
                    id: `cust-compound-${test.id}`,
                    name: `Compound Customer ${test.id}`,
                    phone: '9876543210',
                    lendingRate: test.rate,
                    rateUnit: test.rateUnit,
                    interestType: test.interestType,
                    createdDate: '2026-01-01'
                };

                state.customers = [cust];
                state.currentCustomerId = cust.id;
                state.transactions = test.txns.map((t, idx) => ({
                    id: `tx-comp-${test.id}-${idx}`,
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

            // Scrape Dashboard #summary-interest
            const dashboardText = await page.$eval('#summary-interest', el => el.innerText.trim());

            // Invoke breakdown modal
            await page.evaluate(() => {
                showInterestBreakdown();
            });

            // Wait for spinner to clear
            await page.waitForFunction(() => {
                const body = document.getElementById('interest-breakdown-body');
                return body && !body.querySelector('.spinner');
            }, { timeout: 3000 });

            // Audit breakdown modal
            const modalAudit = await page.evaluate(() => {
                const container = document.getElementById('interest-breakdown-body');
                if (!container) return { error: 'Container element not found' };

                const innerText = container.innerText || '';
                const hasNaN = innerText.includes('NaN');
                const hasUndefined = innerText.includes('undefined');

                const cards = container.querySelectorAll('.calc-breakdown-card');
                let formulaMentionsCompound = false;

                cards.forEach(card => {
                    if (card.innerText.includes('Compound')) {
                        formulaMentionsCompound = true;
                    }
                });

                const totalMatch = innerText.match(/Total Accrued Interest:\s*₹?\s*([\d,]+\.?\d*)/i);
                let footerTotal = 0;
                if (totalMatch) {
                    footerTotal = parseFloat(totalMatch[1].replace(/,/g, '')) || 0;
                }

                return {
                    cardCount: cards.length,
                    formulaMentionsCompound,
                    footerTotal,
                    hasNaN,
                    hasUndefined,
                    innerTextSnippet: innerText.substring(0, 150)
                };
            });

            const parseVal = (str) => {
                if (!str) return 0;
                const clean = str.replace(/[₹,]/g, '').trim();
                return parseFloat(clean) || 0;
            };

            const dashboardVal = parseVal(dashboardText);
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
                if (Math.abs(dashboardVal - expectedVal) > 0.01) {
                    casePassed = false;
                    errors.push(`Dashboard #summary-interest (₹${dashboardVal}) != Expected (₹${expectedVal})`);
                }
                // Assert Modal Footer === Expected
                if (Math.abs(modalAudit.footerTotal - expectedVal) > 0.01) {
                    casePassed = false;
                    errors.push(`Modal Footer Total (₹${modalAudit.footerTotal}) != Expected (₹${expectedVal})`);
                }
                // For active interest cases, assert formula mentions "Compound"
                if (tc.expectedInterest > 0 && tc.interestType === 'compound' && !modalAudit.formulaMentionsCompound) {
                    casePassed = false;
                    errors.push('Phase card formula DOES NOT mention "Compound"');
                }
            }

            if (casePassed) {
                totalPassed++;
                console.log(`  ✓ Case #${String(tc.id).padStart(2, '0')}: [PASSED] "${tc.name}" -> Dashboard: ₹${dashboardVal} | Modal Footer: ₹${modalAudit.footerTotal}`);
            } else {
                totalFailed++;
                console.error(`  ✕ Case #${String(tc.id).padStart(2, '0')}: [FAILED] "${tc.name}" -> Errors: ${errors.join(' | ')}`);
            }
        }

        console.log('\n==================================================');
        console.log(`📊 COMPOUND INTEREST E2E VALIDATION SUITE SUMMARY:`);
        console.log(`   Total Cases Executed : ${testCases.length}`);
        console.log(`   Passed               : ${totalPassed}`);
        console.log(`   Failed               : ${totalFailed}`);
        console.log('==================================================\n');

        if (totalFailed > 0) {
            console.error(`❌ ${totalFailed} Compound Interest E2E Test Cases FAILED!`);
            process.exit(1);
        } else {
            console.log(`🎉 ALL ${testCases.length} COMPOUND INTEREST E2E DOM TEST CASES PASSED WITH 100% MATHEMATICAL ACCURACY!`);
            process.exit(0);
        }

    } catch (err) {
        console.error('Fatal Test Execution Error:', err);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
    }
})();
