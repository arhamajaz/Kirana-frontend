const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    let browser;
    try {
        console.log('🚀 Launching headless browser for Benchmark E2E Verification...');
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files']
        });

        const page = await browser.newPage();
        
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('Browser Error:', msg.text());
            }
        });

        const fileUrl = `file:///d:/Projects/kirana%20ledger/index.html`;
        
        console.log(`📡 Navigating to ${fileUrl}...`);
        await page.goto(fileUrl, { waitUntil: 'load' });

        // Skip auth if login view is active
        await page.evaluate(() => {
            const skipBtn = document.getElementById('btn-skip-login');
            if (skipBtn && !skipBtn.classList.contains('hidden')) {
                skipBtn.click();
            }
        });

        console.log('⚙️ Injecting "ABC Traders" 8-Step Benchmark Scenario into DOM & State...');
        const testSetupResult = await page.evaluate(() => {
            state.isTestMode = true;
            state.isAuthenticated = true;
            state.currentLedgerSummary = null; // Clear backend API summary override to force local ledger engine calculation

            const testCust = {
                id: 'cust-abc-traders',
                name: 'ABC Traders',
                phone: '9876543210',
                lendingRate: 2, // 2% monthly rate
                createdDate: '2026-01-01'
            };

            state.customers = [testCust];
            state.currentCustomerId = testCust.id;

            // 8 Sequential Transactions
            state.transactions = [
                { id: 'tx-1', customerId: testCust.id, type: 'debit', amount: 1000, date: '2026-01-01' },
                { id: 'tx-2', customerId: testCust.id, type: 'debit', amount: 1000, date: '2026-02-01' },
                { id: 'tx-3', customerId: testCust.id, type: 'debit', amount: 1000, date: '2026-03-01' },
                { id: 'tx-4', customerId: testCust.id, type: 'credit', amount: 4000, date: '2026-04-01' },
                { id: 'tx-5', customerId: testCust.id, type: 'debit', amount: 500, date: '2026-04-15' },
                { id: 'tx-6', customerId: testCust.id, type: 'debit', amount: 1000, date: '2026-04-20' },
                { id: 'tx-7', customerId: testCust.id, type: 'credit', amount: 1000, date: '2026-05-20' },
                { id: 'tx-8', customerId: testCust.id, type: 'debit', amount: 500, date: '2026-06-01' }
            ];

            // Render ledger view
            if (typeof switchView === 'function') {
                switchView('ledger-view');
            } else {
                document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
                document.getElementById('ledger-view').classList.remove('hidden');
                document.getElementById('app-wrapper').classList.remove('hidden');
            }

            // Set settle date to 2026-06-01
            const asOfInput = document.getElementById('ledger-as-of-date');
            if (asOfInput) {
                asOfInput.value = '2026-06-01';
                asOfInput.dispatchEvent(new Event('change'));
            }

            // Re-render ledger
            renderLedger();

            return {
                asOfDate: asOfInput ? asOfInput.value : null,
                custName: testCust.name,
                rate: testCust.lendingRate
            };
        });

        console.log(`✅ Test setup complete. Customer: ${testSetupResult.custName} (Rate: ${testSetupResult.rate}%), As-Of Date: ${testSetupResult.asOfDate}`);

        // --- SCRAPE AND ASSERT FINAL DOM VALUES ---
        console.log('\n--- Scraping DOM & Executing Strict Assertions as of 2026-06-01 ---');
        
        const summaryPrincipalText = await page.$eval('#summary-principal', el => el.innerText.trim());
        const summaryInterestText = await page.$eval('#summary-interest', el => el.innerText.trim());
        const summaryNetText = await page.$eval('#summary-net', el => el.innerText.trim());

        console.log(`[DOM Scrape] #summary-principal: "${summaryPrincipalText}"`);
        console.log(`[DOM Scrape] #summary-interest : "${summaryInterestText}"`);
        console.log(`[DOM Scrape] #summary-net      : "${summaryNetText}"`);

        const expectedPrincipal = '₹132.40';
        const expectedInterest = '₹0.00';
        const expectedNet = '₹132.40 (Dr)';

        let passed = true;

        if (summaryPrincipalText === expectedPrincipal) {
            console.log(`✅ PASSED: #summary-principal strictly equals "${expectedPrincipal}"`);
        } else {
            console.error(`❌ FAILED: #summary-principal is "${summaryPrincipalText}", expected "${expectedPrincipal}"`);
            passed = false;
        }

        if (summaryInterestText === expectedInterest) {
            console.log(`✅ PASSED: #summary-interest strictly equals "${expectedInterest}"`);
        } else {
            console.error(`❌ FAILED: #summary-interest is "${summaryInterestText}", expected "${expectedInterest}"`);
            passed = false;
        }

        if (summaryNetText === expectedNet) {
            console.log(`✅ PASSED: #summary-net strictly equals "${expectedNet}"`);
        } else {
            console.error(`❌ FAILED: #summary-net is "${summaryNetText}", expected "${expectedNet}"`);
            passed = false;
        }

        if (!passed) {
            process.exitCode = 1;
        }

        console.log('\n==================================================');
        if (passed) {
            console.log('🎉 QA SIGN-OFF: FRONTEND UI MATCHES BACKEND LEDGER LOGIC PERFECTLY!');
        } else {
            console.log('❌ QA SIGN-OFF FAILED: DISCREPANCY DETECTED BETWEEN UI AND EXPECTED VALUES.');
        }
        console.log('==================================================\n');

    } catch (err) {
        console.error('💥 Error running Benchmark E2E test:', err);
        process.exitCode = 1;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
})();
