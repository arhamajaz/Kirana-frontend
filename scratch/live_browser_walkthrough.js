const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
    let browser;
    try {
        console.log('========================================================================');
        console.log('🚀 DIRECTIVE 5: LIVE BROWSER E2E WALKTHROUGH & VERIFICATION');
        console.log('========================================================================\n');

        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--allow-file-access-from-files'
            ]
        });

        const page = await browser.newPage();
        page.on('console', msg => console.log(`[Browser Console ${msg.type()}]: ${msg.text()}`));
        page.on('pageerror', err => console.log(`[Page Error]: ${err.message}`));

        const waitForLoadingToFinish = async () => {
            await page.waitForFunction(() => {
                const overlay = document.getElementById('global-loading-overlay');
                return !overlay || overlay.classList.contains('loading-overlay-hidden');
            }, { timeout: 10000 });
        };

        const fileUrl = `file:///d:/Projects/kirana%20ledger/index.html`;
        console.log(`📡 1. Navigating to ${fileUrl}...`);
        await page.goto(fileUrl, { waitUntil: 'load' });

        // 2. Bypass login via Skip Login (Test Mode) button
        console.log('🔑 2. Bypassing authentication via "Skip Login (Test Mode)"...');
        await page.waitForSelector('#btn-skip-login', { visible: true });
        await page.click('#btn-skip-login');

        await page.waitForSelector('#dashboard-view', { visible: true });
        console.log('✅ Navigated to Dashboard View successfully.');

        // 3. Create a new Customer via physical DOM interactions
        console.log('\n👤 3. Creating new Customer via Customer Modal...');
        await waitForLoadingToFinish();
        await page.waitForSelector('#btn-new-customer', { visible: true });
        await page.click('#btn-new-customer');

        await page.waitForSelector('#customer-modal:not(.hidden)', { visible: true });
        await page.type('#cust-name', 'Live Walkthrough Customer');
        await page.type('#cust-phone', '9876543210');
        
        // Select interest rate & type
        await page.evaluate(() => {
            document.getElementById('cust-lend-rate').value = '12';
            document.getElementById('cust-dep-rate').value = '6';
            const typeSelect = document.getElementById('cust-interest-type');
            if (typeSelect) typeSelect.value = 'simple';
        });

        // Submit customer form
        console.log('   Submitting Customer Creation Form...');
        await page.click('#customer-form button[type="submit"]');

        // Wait for modal to close and loading overlay to finish
        await page.waitForFunction(() => document.getElementById('customer-modal').classList.contains('hidden'), { timeout: 8000 });
        await waitForLoadingToFinish();
        console.log('✅ Customer created successfully.');

        // 4. Locate and click newly created customer in Customer Table
        console.log('\n📂 4. Opening newly created customer ledger...');
        await page.waitForSelector('#customer-list-body tr', { visible: true });
        
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#customer-list-body tr'));
            const targetRow = rows.find(r => r.innerText.includes('Live Walkthrough Customer'));
            if (targetRow) {
                targetRow.click();
            } else {
                throw new Error('Created customer row not found in customer list!');
            }
        });

        await page.waitForSelector('#ledger-view:not(.hidden)', { visible: true });
        await waitForLoadingToFinish();
        const displayedCustName = await page.$eval('#ledger-customer-name', el => el.innerText.trim());
        console.log(`✅ Ledger opened for customer: "${displayedCustName}"`);

        // 5. Add DEBIT Transaction: ₹10,000 on 2025-01-01 @ 12% yearly
        console.log('\n💸 5. Adding DEBIT Transaction: Giving ₹10,000 on 2025-01-01...');
        await waitForLoadingToFinish();
        await page.waitForSelector('#btn-ledger-gave', { visible: true });
        await page.evaluate(() => document.getElementById('btn-ledger-gave').click());

        await page.waitForSelector('#transaction-modal:not(.hidden)', { visible: true });
        await page.evaluate(() => {
            const dateInput = document.getElementById('txn-date');
            dateInput.value = '2025-01-01';
            dateInput.dispatchEvent(new Event('input', { bubbles: true }));
            dateInput.dispatchEvent(new Event('change', { bubbles: true }));
            const startInput = document.getElementById('txn-interest-start-date');
            if (startInput) startInput.value = '2025-01-01';
            document.getElementById('txn-amount').value = '10000';
            document.getElementById('txn-remarks').value = 'Initial loan debit';
        });

        await page.click('#transaction-form button[type="submit"]');
        await page.waitForFunction(() => document.getElementById('transaction-modal').classList.contains('hidden'), { timeout: 8000 });
        await waitForLoadingToFinish();
        console.log('✅ Debit transaction of ₹10,000 recorded.');

        // 6. Add CREDIT Transaction: ₹2,100 on 2025-02-01 (Pays ₹100 interest + ₹2,000 principal)
        console.log('\n💰 6. Adding CREDIT Transaction: Receiving ₹2,100 on 2025-02-01...');
        await waitForLoadingToFinish();
        await page.waitForSelector('#btn-ledger-got', { visible: true });
        await page.evaluate(() => document.getElementById('btn-ledger-got').click());

        await page.waitForSelector('#transaction-modal:not(.hidden)', { visible: true });
        await page.evaluate(() => {
            const dateInput = document.getElementById('txn-date');
            dateInput.value = '2025-02-01';
            dateInput.dispatchEvent(new Event('input', { bubbles: true }));
            dateInput.dispatchEvent(new Event('change', { bubbles: true }));
            const startInput = document.getElementById('txn-interest-start-date');
            if (startInput) startInput.value = '2025-02-01';
            document.getElementById('txn-amount').value = '2100';
            document.getElementById('txn-remarks').value = 'Partial payment credit';
        });

        await page.click('#transaction-form button[type="submit"]');
        await page.waitForFunction(() => document.getElementById('transaction-modal').classList.contains('hidden'), { timeout: 8000 });
        await waitForLoadingToFinish();
        console.log('✅ Credit transaction of ₹2,100 recorded.');

        // Set Settle / As-Of Date to 2025-02-01
        console.log('\n📅 Setting Settle / As-Of Date to 2025-02-01...');
        await page.evaluate(() => {
            const asOfInput = document.getElementById('ledger-as-of-date');
            if (asOfInput) {
                asOfInput.value = '2025-02-01';
                asOfInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        // Wait for UI to update to the expected Raw Principal
        await page.waitForFunction(() => {
            const el = document.getElementById('summary-principal');
            return el && el.innerText.includes('7,900.00');
        }, { timeout: 8000 });
        await waitForLoadingToFinish();

        // 7. Scrape and Assert Dashboard Summary Cards
        console.log('\n📊 7. Auditing Dashboard Summary Cards from physical DOM:');
        const principalText = await page.$eval('#summary-principal', el => el.innerText.trim());
        const interestHtml = await page.$eval('#summary-interest', el => el.innerHTML.trim());
        const interestText = await page.$eval('#summary-interest', el => el.innerText.trim());
        const netText = await page.$eval('#summary-net', el => el.innerText.trim());

        console.log(`   - Current Principal Card : "${principalText}"`);
        console.log(`   - Accrued Interest Card  : "${interestText}"`);
        console.log(`   - Total Net Balance Card : "${netText}"`);

        // Assertions:
        // Raw Principal: 10,000 - 2,100 = 7,900.00
        const hasPrincipal7900 = principalText.includes('7,900.00');
        if (!hasPrincipal7900) {
            throw new Error(`Assertion Failed: Principal Card "${principalText}" does not display expected Raw Principal ₹7,900.00!`);
        }
        console.log('   ✓ [PASS] Current Principal displays correct Raw Principal (₹7,900.00)');

        // Gross Interest: 100.00
        const hasInterest100 = interestText.includes('100.00');
        if (!hasInterest100) {
            throw new Error(`Assertion Failed: Interest Card "${interestText}" does not display expected Gross Interest ₹100.00!`);
        }
        console.log('   ✓ [PASS] Accrued Interest displays correct Gross Interest (₹100.00)');

        // (Paid) Badge
        const hasPaidBadge = interestHtml.includes('(Paid)') && interestHtml.includes('status-badge');
        if (!hasPaidBadge) {
            throw new Error(`Assertion Failed: Interest Card "${interestHtml}" does not contain the (Paid) badge!`);
        }
        console.log('   ✓ [PASS] (Paid) Badge correctly appended since Gross Interest > 0 and Net Accrued Interest <= 0');

        // Total Net Balance: ₹8,000.00 (Dr) (₹10,000 Principal + ₹100 Interest - ₹2,100 Payment = ₹8,000 Net Due)
        const hasNet8000 = netText.includes('8,000.00') && netText.includes('(Dr)');
        if (!hasNet8000) {
            throw new Error(`Assertion Failed: Net Balance Card "${netText}" does not display expected Net Balance ₹8,000.00 (Dr)!`);
        }
        console.log('   ✓ [PASS] Total Net Balance displays uncompromised net due of ₹8,000.00 (Dr)');

        // 8. Open Breakdown Modal via "See Calculation" button
        console.log('\n🔍 8. Triggering Breakdown Modal via "#btn-see-calculation"...');
        await waitForLoadingToFinish();
        await page.click('#btn-see-calculation');

        await page.waitForSelector('#interest-breakdown-modal:not(.hidden)', { visible: true });
        await page.waitForFunction(() => {
            const body = document.getElementById('interest-breakdown-body');
            return body && !body.querySelector('.spinner');
        }, { timeout: 8000 });

        // 9. Audit Modal DOM
        const modalAudit = await page.evaluate(() => {
            const container = document.getElementById('interest-breakdown-body');
            if (!container) return { error: 'Modal container not found' };

            const innerText = container.innerText || '';
            const cards = Array.from(container.querySelectorAll('.calc-breakdown-card'));

            return {
                cardCount: cards.length,
                innerText,
                hasMissingDataError: innerText.includes('Backend breakdown data is missing or unavailable'),
                hasNaN: innerText.includes('NaN'),
                hasUndefined: innerText.includes('undefined')
            };
        });

        console.log(`   - Phase Cards Count      : ${modalAudit.cardCount}`);
        console.log(`   - Missing Data Error Found: ${modalAudit.hasMissingDataError}`);

        if (modalAudit.hasMissingDataError) {
            throw new Error('Assertion Failed: "Backend breakdown data is missing or unavailable" error detected in modal DOM!');
        }
        console.log('   ✓ [PASS] Zero "Backend breakdown data is missing" error detected.');

        if (modalAudit.hasNaN || modalAudit.hasUndefined) {
            throw new Error('Assertion Failed: DOM contains NaN or undefined values!');
        }
        console.log('   ✓ [PASS] Zero NaN or undefined values detected in modal.');

        if (modalAudit.cardCount < 1) {
            throw new Error('Assertion Failed: Modal does not render any phase cards!');
        }
        console.log(`   ✓ [PASS] Modal successfully renders ${modalAudit.cardCount} calculation phase card(s).`);

        const footerHas100 = modalAudit.innerText.includes('100.00');
        if (!footerHas100) {
            throw new Error('Assertion Failed: Modal footer does not show ₹100.00 total interest!');
        }
        console.log('   ✓ [PASS] Modal footer confirms Total Accrued Interest: ₹100.00.');

        console.log('\n========================================================================');
        console.log('🎉 DIRECTIVE 5: ALL LIVE BROWSER WALKTHROUGH ASSERTIONS PASSED (100%)!');
        console.log('========================================================================\n');

        await browser.close();
        process.exit(0);

    } catch (err) {
        console.error('\n❌ Live Walkthrough Assertion Failed:', err.message);
        if (browser) await browser.close();
        process.exit(1);
    }
})();
