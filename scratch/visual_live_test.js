const puppeteer = require('puppeteer');
const path = require('path');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    let browser;
    try {
        console.log('========================================================================');
        console.log('🖥️  LAUNCHING HEADFUL (VISIBLE) BROWSER WALKTHROUGH TEST');
        console.log('========================================================================\n');

        browser = await puppeteer.launch({
            headless: false,
            slowMo: 40,
            defaultViewport: null,
            args: [
                '--start-maximized',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--allow-file-access-from-files'
            ]
        });

        const pages = await browser.pages();
        const page = pages.length > 0 ? pages[0] : await browser.newPage();

        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('Error') || text.includes('Critical')) {
                console.log(`[Browser Console]: ${text}`);
            }
        });

        const waitForLoadingToFinish = async () => {
            await page.waitForFunction(() => {
                const overlay = document.getElementById('global-loading-overlay');
                return !overlay || overlay.classList.contains('loading-overlay-hidden');
            }, { timeout: 10000 });
        };

        const fileUrl = `file:///d:/Projects/kirana%20ledger/index.html`;
        console.log(`📡 1. Navigating to ${fileUrl}...`);
        await page.goto(fileUrl, { waitUntil: 'load' });
        await sleep(1000);

        // 2. Click "Skip Login (Test Mode)"
        console.log('🔑 2. Clicking "Skip Login (Test Mode)"...');
        await page.waitForSelector('#btn-skip-login', { visible: true });
        await page.click('#btn-skip-login');
        await page.waitForSelector('#dashboard-view', { visible: true });
        console.log('✅ In Dashboard View.');
        await sleep(1200);

        // 3. Create a new Customer ("Final Demo Client")
        console.log('\n👤 3. Opening "New Customer" modal...');
        await waitForLoadingToFinish();
        await page.waitForSelector('#btn-new-customer', { visible: true });
        await page.click('#btn-new-customer');

        await page.waitForSelector('#customer-modal:not(.hidden)', { visible: true });
        await sleep(500);

        console.log('   Typing customer details ("Final Demo Client", 12% lending rate)...');
        await page.type('#cust-name', 'Final Demo Client');
        await sleep(300);
        await page.type('#cust-phone', '9876543210');
        await sleep(300);

        await page.evaluate(() => {
            document.getElementById('cust-lend-rate').value = '12';
            document.getElementById('cust-dep-rate').value = '6';
            const typeSelect = document.getElementById('cust-interest-type');
            if (typeSelect) typeSelect.value = 'simple';
        });
        await sleep(500);

        console.log('   Submitting Customer Creation Form...');
        await page.click('#customer-form button[type="submit"]');

        await page.waitForFunction(() => document.getElementById('customer-modal').classList.contains('hidden'), { timeout: 8000 });
        await waitForLoadingToFinish();
        console.log('✅ Customer created successfully.');
        await sleep(1000);

        // 4. Open customer ledger
        console.log('\n📂 4. Opening "Final Demo Client" ledger...');
        await page.waitForSelector('#customer-list-body tr', { visible: true });
        
        await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#customer-list-body tr'));
            const targetRow = rows.find(r => r.innerText.includes('Final Demo Client'));
            if (targetRow) {
                targetRow.click();
            } else {
                throw new Error('Created customer row not found in customer list!');
            }
        });

        await page.waitForSelector('#ledger-view:not(.hidden)', { visible: true });
        await waitForLoadingToFinish();
        console.log('✅ Ledger view active.');
        await sleep(1200);

        // 5. Add Debit (Give Money)
        console.log('\n💸 5. Adding DEBIT (You Gave) transaction: ₹10,000 on 2025-01-01...');
        await waitForLoadingToFinish();
        await page.waitForSelector('#btn-ledger-gave', { visible: true });
        await page.evaluate(() => document.getElementById('btn-ledger-gave').click());

        await page.waitForSelector('#transaction-modal:not(.hidden)', { visible: true });
        await sleep(500);

        await page.evaluate(() => {
            const dateInput = document.getElementById('txn-date');
            dateInput.value = '2025-01-01';
            dateInput.dispatchEvent(new Event('input', { bubbles: true }));
            dateInput.dispatchEvent(new Event('change', { bubbles: true }));
            const startInput = document.getElementById('txn-interest-start-date');
            if (startInput) startInput.value = '2025-01-01';
            document.getElementById('txn-amount').value = '10000';
            document.getElementById('txn-remarks').value = 'Loan disbursement debit';
        });
        await sleep(600);

        console.log('   Saving Debit Entry...');
        await page.click('#transaction-form button[type="submit"]');
        await page.waitForFunction(() => document.getElementById('transaction-modal').classList.contains('hidden'), { timeout: 8000 });
        await waitForLoadingToFinish();
        console.log('✅ Debit entry recorded.');
        await sleep(1200);

        // 6. Add Credit (Got Money) for a future date: 2025-02-01
        console.log('\n💰 6. Adding CREDIT (You Got) transaction: ₹2,100 on 2025-02-01...');
        await waitForLoadingToFinish();
        await page.waitForSelector('#btn-ledger-got', { visible: true });
        await page.evaluate(() => document.getElementById('btn-ledger-got').click());

        await page.waitForSelector('#transaction-modal:not(.hidden)', { visible: true });
        await sleep(500);

        await page.evaluate(() => {
            const dateInput = document.getElementById('txn-date');
            dateInput.value = '2025-02-01';
            dateInput.dispatchEvent(new Event('input', { bubbles: true }));
            dateInput.dispatchEvent(new Event('change', { bubbles: true }));
            const startInput = document.getElementById('txn-interest-start-date');
            if (startInput) startInput.value = '2025-02-01';
            document.getElementById('txn-amount').value = '2100';
            document.getElementById('txn-remarks').value = 'Partial repayment credit';
        });
        await sleep(600);

        console.log('   Saving Credit Entry...');
        await page.click('#transaction-form button[type="submit"]');
        await page.waitForFunction(() => document.getElementById('transaction-modal').classList.contains('hidden'), { timeout: 8000 });
        await waitForLoadingToFinish();
        console.log('✅ Credit entry recorded.');
        await sleep(1000);

        // Set As-Of Date to 2025-02-01
        console.log('\n📅 Setting Settle / As-Of Date to 2025-02-01...');
        await page.evaluate(() => {
            const asOfInput = document.getElementById('ledger-as-of-date');
            if (asOfInput) {
                asOfInput.value = '2025-02-01';
                asOfInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        await page.waitForFunction(() => {
            const el = document.getElementById('summary-principal');
            return el && el.innerText.includes('7,900.00');
        }, { timeout: 8000 });
        await waitForLoadingToFinish();
        await sleep(1000);

        // Scrape and display summary card values
        const principalText = await page.$eval('#summary-principal', el => el.innerText.trim());
        const interestText = await page.$eval('#summary-interest', el => el.innerText.trim());
        const netText = await page.$eval('#summary-net', el => el.innerText.trim());

        console.log('\n📊 DOM Summary Cards:');
        console.log(`   - Current Principal Card : "${principalText}" (Raw Principal: ₹10,000 - ₹2,100)`);
        console.log(`   - Accrued Interest Card  : "${interestText}" (Gross: ₹100.00, Status: Paid)`);
        console.log(`   - Total Net Balance Card : "${netText}" (Net Due: ₹8,000.00 Dr)`);

        // 7. Click "See Calculation" button
        console.log('\n🔍 7. Clicking "See Calculation" button to inspect breakdown modal...');
        await waitForLoadingToFinish();
        await page.waitForSelector('#btn-see-calculation', { visible: true });
        await page.click('#btn-see-calculation');

        await page.waitForSelector('#interest-breakdown-modal:not(.hidden)', { visible: true });
        await page.waitForFunction(() => {
            const body = document.getElementById('interest-breakdown-body');
            return body && !body.querySelector('.spinner');
        }, { timeout: 8000 });
        console.log('✅ Calculation Breakdown Modal opened and rendered.');

        // 8. Keep browser open for 10 seconds for visual inspection
        console.log('\n========================================================================');
        console.log('⏳ KEEPING BROWSER OPEN FOR 10 SECONDS FOR YOUR VISUAL INSPECTION...');
        console.log('========================================================================\n');
        await sleep(10000);

        console.log('🏁 Closing browser session...');
        await browser.close();
        console.log('🎉 Visual Live Browser Walkthrough Completed Successfully!');
        process.exit(0);

    } catch (err) {
        console.error('\n❌ Visual Walkthrough Failed:', err.message);
        if (browser) {
            try { await browser.close(); } catch (_) {}
        }
        process.exit(1);
    }
})();
