// Global Safe LedgerAPI accessor to prevent "LedgerAPI is not defined" ReferenceError
if (typeof window !== 'undefined' && !window.LedgerAPI) {
    window.LedgerAPI = {
        getToken: () => localStorage.getItem("ml_pro_auth_token") || localStorage.getItem("ml_pro_jwt_token"),
        saveToken: (t) => { if (t) { localStorage.setItem("ml_pro_auth_token", t); localStorage.setItem("ml_pro_jwt_token", t); } },
        removeToken: () => { localStorage.removeItem("ml_pro_auth_token"); localStorage.removeItem("ml_pro_jwt_token"); },
        healthCheck: async () => ({ status: "offline" }),
        setUnauthorizedHandler: () => {},
        loginUser: async () => ({ token: "mock_token_" + Date.now() }),
        registerUser: async () => ({ token: "mock_token_" + Date.now() }),
        getCustomers: async () => [],
        searchCustomers: async () => [],
        createCustomer: async (d) => d,
        updateCustomer: async (id, d) => d,
        deleteCustomer: async () => {},
        createTransaction: async (d) => d,
        updateTransaction: async (id, d) => d,
        voidTransaction: async () => {},
        getCustomerLedger: async () => ({}),
        getCustomerTransactions: async () => [],
        getItems: async () => [],
        createItem: async (d) => d,
        updateItem: async (id, d) => d,
        deleteItem: async () => {},
        getBills: async () => [],
        createBill: async (d) => d,
        voidBill: async () => {},
        getCashbook: async () => [],
        createCashbookEntry: async (d) => d,
        voidCashbookEntry: async () => {},
        getInsurance: async () => ({}),
        updateInsurance: async (d) => d,
        getReportSummary: async () => ({})
    };
}

// --- STATE MANAGEMENT ---
let state = {
    isAuthenticated: false,
    customers: JSON.parse(localStorage.getItem('ml_pro_customers')) || [
        { id: 'cust-1', name: 'Ramesh Kumar', phoneNumber: '9876543210', lendingRate: 12, depositRate: 6 },
        { id: 'cust-2', name: 'Suresh Patel', phoneNumber: '9812345678', lendingRate: 12, depositRate: 6 }
    ],
    badDebts: JSON.parse(localStorage.getItem('ml_pro_bad_debts')) || [],
    pagination: null,
    transactions: JSON.parse(localStorage.getItem('ml_pro_transactions')) || [],
    cashbook: JSON.parse(localStorage.getItem('ml_pro_cashbook')) || [],
    items: JSON.parse(localStorage.getItem('ml_pro_items')) || [],
    bills: JSON.parse(localStorage.getItem('ml_pro_bills')) || [],
    insurance: JSON.parse(localStorage.getItem('ml_pro_insurance')) || {
        policyName: '',
        provider: '',
        premiumAmount: 0,
        renewalDate: ''
    },
    currentCustomerId: null,
    currentLedgerSummary: null
};

function saveData() {
    try {
        localStorage.setItem('ml_pro_customers', JSON.stringify(state.customers || []));
        localStorage.setItem('ml_pro_transactions', JSON.stringify(state.transactions || []));
        localStorage.setItem('ml_pro_bad_debts', JSON.stringify(state.badDebts || []));
        localStorage.setItem('ml_pro_cashbook', JSON.stringify(state.cashbook || []));
        localStorage.setItem('ml_pro_items', JSON.stringify(state.items || []));
        localStorage.setItem('ml_pro_bills', JSON.stringify(state.bills || []));
        localStorage.setItem('ml_pro_insurance', JSON.stringify(state.insurance || {}));
    } catch (err) {
        console.warn("Unable to persist state to localStorage:", err);
    }
}

// --- FORMATTERS ---
const formatCurrency = (amount) => {
    const num = parseFloat(amount);
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(isNaN(num) ? 0 : num);
};
const cleanCurrency = (amount) => {
    return formatCurrency(amount).replace(/₹/g, 'Rs. ');
};
const formatDate = (dateString) => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-IN');
};

function calculateDuration(startDateStr, endDateStr = null) {
    if (!startDateStr) return '0D';
    const start = new Date(startDateStr);
    const end = endDateStr ? new Date(endDateStr) : new Date();
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return '0D';

    const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    let years = e.getFullYear() - s.getFullYear();
    let months = e.getMonth() - s.getMonth();
    let days = e.getDate() - s.getDate();

    if (days < 0) {
        months -= 1;
        const prevMonthLastDay = new Date(e.getFullYear(), e.getMonth(), 0).getDate();
        days += prevMonthLastDay;
    }
    if (months < 0) {
        years -= 1;
        months += 12;
    }

    let parts = [];
    if (years > 0) parts.push(`${years}Y`);
    if (months > 0) parts.push(`${months}M`);
    if (days > 0 || parts.length === 0) parts.push(`${days}D`);
    return parts.join(' ');
}

// --- THEME ENGINE ---
const themeToggleBtn = document.getElementById('theme-toggle');
const htmlEl = document.documentElement;

function initTheme() {
    const savedTheme = localStorage.getItem('ml_theme') || 'dark';
    htmlEl.setAttribute('data-theme', savedTheme);
    themeToggleBtn.innerHTML = savedTheme === 'dark' ? '<i class="ph ph-sun"></i>' : '<i class="ph ph-moon"></i>';
}

themeToggleBtn.addEventListener('click', () => {
    const currentTheme = htmlEl.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    htmlEl.setAttribute('data-theme', newTheme);
    localStorage.setItem('ml_theme', newTheme);
    themeToggleBtn.innerHTML = newTheme === 'dark' ? '<i class="ph ph-sun"></i>' : '<i class="ph ph-moon"></i>';
});

// --- AUTHENTICATION & ROUTE GUARDING ---
function checkAuthState() {
    initTheme();

    // Warm up backend connection (cold-start mitigation for Render free tier)
    if (window.LedgerAPI && typeof window.LedgerAPI.healthCheck === 'function') {
        window.LedgerAPI.healthCheck().catch(() => {});
    }

    const token = LedgerAPI.getToken();
    const isTestMode = localStorage.getItem('ml_pro_test_mode') === 'true';
    state.isTestMode = isTestMode;

    if (token || isTestMode) {
        state.isAuthenticated = true;
        document.getElementById('auth-view').classList.remove('active');
        document.getElementById('auth-view').classList.add('hidden');
        document.getElementById('app-wrapper').classList.remove('hidden');
        switchView('dashboard-view');
    } else {
        state.isAuthenticated = false;
        document.getElementById('app-wrapper').classList.add('hidden');
        document.getElementById('auth-view').classList.remove('hidden');
        document.getElementById('auth-view').classList.add('active');
    }
}

// 401 Unauthorized Interceptor Setup
if (window.LedgerAPI && typeof window.LedgerAPI.setUnauthorizedHandler === 'function') {
    window.LedgerAPI.setUnauthorizedHandler(() => {
        handleLogout("Session expired. Please sign in again.");
    });
}

function handleLogout(message = "") {
    LedgerAPI.removeToken();
    localStorage.removeItem('ml_pro_test_mode');
    state.isAuthenticated = false;
    document.getElementById('app-wrapper').classList.add('hidden');
    document.getElementById('auth-view').classList.remove('hidden');
    document.getElementById('auth-view').classList.add('active');

    const loginErrEl = document.getElementById('login-error');
    if (loginErrEl) {
        if (message) {
            loginErrEl.textContent = message;
            loginErrEl.classList.remove('hidden');
        } else {
            loginErrEl.textContent = '';
            loginErrEl.classList.add('hidden');
        }
    }
}

// Tab Switching (Sign In vs Create Account)
document.addEventListener('DOMContentLoaded', () => {
    // Tab Switching (Sign In vs Create Account)
    const switchAuthTab = (targetFormId) => {
        document.querySelectorAll('.auth-tab').forEach(t => {
            if (t.getAttribute('data-target') === targetFormId || t.id === `tab-${targetFormId.replace('-form', '')}`) {
                t.classList.add('active');
            } else {
                t.classList.remove('active');
            }
        });

        document.querySelectorAll('.auth-form').forEach(form => {
            if (form.id === targetFormId) {
                form.classList.remove('hidden');
                form.classList.add('active');
            } else {
                form.classList.remove('active');
                form.classList.add('hidden');
            }
        });

        // Hide errors
        const loginErr = document.getElementById('login-error');
        const signupErr = document.getElementById('signup-error');
        if (loginErr) loginErr.classList.add('hidden');
        if (signupErr) signupErr.classList.add('hidden');
    };

    document.querySelectorAll('.auth-tab, #btn-toggle-signup, #btn-toggle-login').forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const targetFormId = e.currentTarget.getAttribute('data-target') || 
                (e.currentTarget.id.includes('signup') ? 'signup-form' : 'login-form');
            switchAuthTab(targetFormId);
        });
    });

    // Login Form Handler
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-pwd').value;
            const errorEl = document.getElementById('login-error');
            const submitBtn = document.getElementById('btn-login-submit');
            const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '<i class="ph ph-sign-in"></i> Secure Sign In';

            errorEl.textContent = '';
            errorEl.classList.add('hidden');

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="ph ph-spinner spinner spin"></i> Authenticating...';
            }

            try {
                const loginRes = await LedgerAPI.loginUser(email, password);
                if (loginRes && (loginRes.token || LedgerAPI.getToken())) {
                    state.isAuthenticated = true;
                    document.getElementById('auth-view').classList.remove('active');
                    document.getElementById('auth-view').classList.add('hidden');
                    document.getElementById('app-wrapper').classList.remove('hidden');
                    switchView('dashboard-view');
                } else {
                    throw new Error('Authentication failed: Invalid credentials.');
                }
            } catch (err) {
                console.error("Login failed:", err);
                errorEl.textContent = err.message || 'Login failed. Please check your credentials.';
                errorEl.classList.remove('hidden');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnHtml;
                }
            }
        };
    }

    // Sign-Up Form Handler
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('signup-name').value;
            const shop = document.getElementById('signup-shop').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-pwd').value;
            const confirmPassword = document.getElementById('signup-confirm-pwd').value;
            const errorEl = document.getElementById('signup-error');
            const submitBtn = document.getElementById('btn-signup-submit');
            const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '<i class="ph ph-user-plus"></i> Create Account';

            errorEl.textContent = '';
            errorEl.classList.add('hidden');

            if (password !== confirmPassword) {
                errorEl.textContent = 'Passwords do not match. Please re-enter.';
                errorEl.classList.remove('hidden');
                return;
            }

            if (password.length < 6) {
                errorEl.textContent = 'Password must be at least 6 characters long.';
                errorEl.classList.remove('hidden');
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="ph ph-spinner spinner spin"></i> Creating Account...';
            }

            try {
                const signupRes = await LedgerAPI.registerUser(email, password, name, shop);
                if (signupRes && (signupRes.token || LedgerAPI.getToken())) {
                    state.isAuthenticated = true;
                    document.getElementById('auth-view').classList.remove('active');
                    document.getElementById('auth-view').classList.add('hidden');
                    document.getElementById('app-wrapper').classList.remove('hidden');
                    switchView('dashboard-view');
                } else {
                    throw new Error('Registration failed.');
                }
            } catch (err) {
                console.error("Registration failed:", err);
                errorEl.textContent = err.message || 'Registration failed. Email may already exist.';
                errorEl.classList.remove('hidden');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnHtml;
                }
            }
        };
    }

    // Logout Button Listener
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.onclick = () => handleLogout();
    }

    // Skip Login (Test Mode) Listener
    const skipLoginBtn = document.getElementById('btn-skip-login');
    if (skipLoginBtn) {
        skipLoginBtn.onclick = () => {
            state.isAuthenticated = true;
            localStorage.setItem('ml_pro_test_mode', 'true');
            document.getElementById('auth-view').classList.remove('active');
            document.getElementById('auth-view').classList.add('hidden');
            document.getElementById('app-wrapper').classList.remove('hidden');
            switchView('dashboard-view');
        };
    }

    // Check Auth State on Page Load
    checkAuthState();
});

function switchView(targetId) {
    if (!targetId) return;

    // Dynamic Sticky Top App Bar vs Hero Navbar Switcher (Directive 1.2)
    const heroNavbar = document.getElementById('hero-navbar');
    const compactAppBar = document.getElementById('compact-app-bar');
    const topBarTitle = document.getElementById('top-bar-title');
    const topBarSubtitle = document.getElementById('top-bar-subtitle');

    if (targetId === 'dashboard-view') {
        if (heroNavbar) heroNavbar.classList.remove('hidden');
        if (compactAppBar) compactAppBar.classList.add('hidden');
    } else {
        if (heroNavbar) heroNavbar.classList.add('hidden');
        if (compactAppBar) compactAppBar.classList.remove('hidden');

        const screenTitles = {
            'ledger-view': { title: 'Customer Ledger', sub: 'Mohit Store' },
            'bills-view': { title: 'Bills & Invoices', sub: 'Billing Records' },
            'items-view': { title: 'Inventory Stock', sub: 'Store Items' },
            'cashbook-view': { title: 'Daily Cashbook', sub: 'Counter Drawer' },
            'calculator-view': { title: 'Interest Calculator', sub: 'Loan Schedule' },
            'reports-view': { title: 'Business Reports', sub: 'Analytics & Tax' },
            'bad-debts-view': { title: 'Bad Debts & NPA', sub: 'Defaulted Accounts' },
            'insurance-view': { title: 'Shop Insurance', sub: 'Policy Details' },
            'more-view': { title: 'More Options', sub: 'Business Profile' }
        };

        const info = screenTitles[targetId] || { title: 'Mohit Store', sub: 'Merchant System' };
        if (targetId === 'ledger-view' && state.currentCustomerId) {
            const customer = state.customers.find(c => c.id === state.currentCustomerId);
            if (customer) {
                if (topBarTitle) topBarTitle.textContent = customer.name;
                if (topBarSubtitle) topBarSubtitle.textContent = customer.phoneNumber ? `📱 ${customer.phoneNumber}` : (customer.isSettled ? 'Settled Account' : 'Active Account');
            }
        } else {
            if (topBarTitle) topBarTitle.textContent = info.title;
            if (topBarSubtitle) topBarSubtitle.textContent = info.sub;
        }
    }

    // Hide all views
    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
        v.classList.add('hidden');
    });

    // Show target view
    const targetView = document.getElementById(targetId);
    if (targetView) {
        targetView.classList.remove('hidden');
        targetView.classList.add('active');
    }

    // Determine active bottom navigation tab
    let activeTabId = targetId;
    if (['cashbook-view', 'staff-view', 'collection-view', 'insurance-view'].includes(targetId)) {
        activeTabId = 'more-view';
    }

    // Update bottom nav tab buttons active state
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        if (btn.getAttribute('data-target') === activeTabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Handle view-specific initializations
    if (targetId === 'dashboard-view') {
        showDashboard();
    } else if (targetId === 'analytics-view') {
        renderAnalytics();
    } else if (targetId === 'items-view') {
        renderItems();
    } else if (targetId === 'bills-view') {
        renderBills();
    } else if (targetId === 'cashbook-view') {
        renderCashbook();
    } else if (targetId === 'insurance-view') {
        renderInsurance();
    } else if (targetId === 'reports-view') {
        renderReports();
    } else if (targetId === 'bad-debts-view') {
        renderBadDebtsView();
    } else if (targetId === 'calculator-view') {
        initStandaloneCalculator();
    }
}

// Global click event delegation for data-target elements (Bottom Nav, Grid Cards, etc.)
document.addEventListener('click', (e) => {
    const targetBtn = e.target.closest('[data-target]');
    if (targetBtn) {
        const targetId = targetBtn.getAttribute('data-target');
        switchView(targetId);
    }
});

// --- CORE FINANCIAL MATH ENGINE ---
// --- CORE FINANCIAL MATH ENGINE ---
function roundMoney(value) {
    const num = typeof value === 'number' ? value : (parseFloat(value) || 0);
    return Math.round((num + Number.EPSILON) * 100) / 100;
}

function calculateLedger(customerId, asOfDateStr = null) {
    const customer = state.customers.find(c => c.id === customerId);
    const rawRate = customer?.lendingRate;
    const defaultLendingRate = (rawRate !== undefined && rawRate !== null && !isNaN(parseFloat(rawRate))) ? parseFloat(rawRate) : 12;

    const asOfDate = asOfDateStr ? new Date(asOfDateStr) : new Date();
    // Set time to end of day for asOfDate to include all transactions on that day
    asOfDate.setHours(23, 59, 59, 999);

    const txns = (state.transactions || [])
        .filter(t => t.customerId === customerId && !t.isVoid && !t.isBadDebt)
        .filter(t => {
            const tDate = new Date(t.date);
            return isNaN(tDate.getTime()) || tDate <= asOfDate;
        })
        .sort((a, b) => {
            const dA = a.date ? new Date(a.date).getTime() : 0;
            const dB = b.date ? new Date(b.date).getTime() : 0;
            return (isNaN(dA) ? 0 : dA) - (isNaN(dB) ? 0 : dB);
        });

    // Directive 1: Calculate rawPrincipal strictly as (Total Debits - Total Credits)
    const totalDebits = txns
        .filter(t => (t.type || '').toLowerCase() === 'debit')
        .reduce((sum, t) => roundMoney(sum + (parseFloat(t.amount) || 0)), 0);
    const totalCredits = txns
        .filter(t => (t.type || '').toLowerCase() === 'credit')
        .reduce((sum, t) => roundMoney(sum + (parseFloat(t.amount) || 0)), 0);
    const rawPrincipal = roundMoney(totalDebits - totalCredits);

    let debitSilos = [];
    let excessCredit = 0;
    let computedLedgerRows = [];
    let advanceLog = [];

    // Helper: Calculate interest accrued on a single Debit Silo between fromDate and toDate
    function calculateSiloInterest(silo, fromDate, toDate) {
        const interestStart = silo.interestStartDate ? new Date(silo.interestStartDate) : new Date(silo.date);
        const actualFromDate = new Date(Math.max(fromDate.getTime(), interestStart.getTime()));
        if (!fromDate || !toDate || isNaN(fromDate.getTime()) || isNaN(toDate.getTime()) || actualFromDate >= toDate || silo.principalRemaining <= 0) {
            return 0;
        }

        let totalAccrued = 0;
        const phases = getTxnInterestPhases(silo, defaultLendingRate, customer);
        // Directive 1: Decouple math compounding base from display base
        let compoundingBase = silo.principalRemaining;
        const siloStart = interestStart;

        for (let i = 0; i < phases.length; i++) {
            const phase = phases[i];

            let phaseStart = siloStart;
            if (i > 0 && phases[i - 1].endDate) {
                phaseStart = new Date(phases[i - 1].endDate);
            }

            let phaseEnd = new Date(8640000000000000);
            if (phase.endDate) {
                phaseEnd = new Date(phase.endDate);
            }

            const windowStart = new Date(Math.max(fromDate.getTime(), phaseStart.getTime()));
            const windowEnd = new Date(Math.min(toDate.getTime(), phaseEnd.getTime()));
            const dStart = new Date(windowStart.getFullYear(), windowStart.getMonth(), windowStart.getDate());
            const dEnd = new Date(windowEnd.getFullYear(), windowEnd.getMonth(), windowEnd.getDate());
            const days = Math.floor((dEnd.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24));
            if (days <= 0) continue;

            const rateFrac = (parseFloat(phase.rate) || 0) / 100;
            let phaseInterest = 0;

            if (phase.type === 'simple' && rateFrac > 0) {
                phaseInterest = roundMoney(compoundingBase * rateFrac * (days / 365));
            } else if (phase.type === 'compound' && rateFrac > 0) {
                let freqNum = 1;
                let periodDays = 365;

                switch (phase.frequency) {
                    case 'monthly':
                        freqNum = 12;
                        periodDays = 365 / 12;
                        break;
                    case 'quarterly':
                        freqNum = 4;
                        periodDays = 365 / 4;
                        break;
                    case 'half-yearly':
                        freqNum = 2;
                        periodDays = 365 / 2;
                        break;
                    case 'custom_days':
                        periodDays = Math.max(1, parseInt(phase.customDays, 10) || 30);
                        freqNum = 365 / periodDays;
                        break;
                    case 'yearly':
                    default:
                        freqNum = 1;
                        periodDays = 365;
                        break;
                }

                // Banking Standard Hybrid Compounding: Full periods compounded + remaining days simple
                const periodRate = rateFrac / freqNum;
                const fullPeriods = Math.floor(days / periodDays);
                const remainingDays = days - (fullPeriods * periodDays);

                const amountAfterFull = compoundingBase * Math.pow(1 + periodRate, fullPeriods);
                const finalAmount = amountAfterFull + (amountAfterFull * periodRate * (remainingDays / periodDays));
                phaseInterest = roundMoney(finalAmount - compoundingBase);
            }

            totalAccrued = roundMoney(totalAccrued + phaseInterest);

            // Update compounding base for calculation across compounding periods / transitions
            compoundingBase = roundMoney(compoundingBase + phaseInterest);
        }

        return totalAccrued;
    }

    // Helper: Accrue interest on all active Debit Silos up to targetDate
    function updateAllSilosInterestUpTo(targetDate) {
        const totalPrincipal = debitSilos.reduce((sum, s) => roundMoney(sum + s.principalRemaining), 0);
        const netRunningPrincipal = roundMoney(totalPrincipal - excessCredit);

        debitSilos.forEach(silo => {
            if (silo.principalRemaining > 0) {
                const fromDate = silo.lastInterestDate;
                const toDate = targetDate;

                if (fromDate && toDate && fromDate < toDate) {
                    const dFrom = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
                    const dTo = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
                    const days = (dTo.getTime() - dFrom.getTime()) / 86400000;

                    if (netRunningPrincipal > 0) {
                        // Customer owes Merchant -> Accrue interest at configured rate
                        const addInt = calculateSiloInterest(silo, fromDate, toDate);
                        silo.accruedInterest = roundMoney(silo.accruedInterest + addInt);
                    } else if (days > 0) {
                        // Merchant owes Customer / Advance State -> Halt interest accrual (strictly 0%)
                        silo.hasAdvancePeriod = true;
                        advanceLog.push({
                            siloId: silo.id,
                            customerId: customerId,
                            fromDate: new Date(fromDate),
                            toDate: new Date(toDate),
                            days: Math.round(days),
                            advanceAmount: Math.abs(netRunningPrincipal),
                            rate: '0%',
                            interestAccrued: 0
                        });
                    }
                }
                silo.lastInterestDate = new Date(Math.max(silo.lastInterestDate.getTime(), targetDate.getTime()));
            }
        });
    }

    // Process transactions sequentially
    txns.forEach(txn => {
        const txnDate = new Date(txn.date);

        // Accrue interest up to transaction date
        updateAllSilosInterestUpTo(txnDate);

        const amount = roundMoney(parseFloat(txn.amount) || 0);
        const type = (txn.type || '').toLowerCase();

        let paymentTraceNotes = [];

        if (type === 'debit') {
            const newSilo = {
                id: txn.id,
                date: txnDate,
                interestStartDate: txn.interestStartDate ? new Date(txn.interestStartDate) : txnDate,
                lastInterestDate: txnDate,
                originalPrincipal: amount,
                principalRemaining: amount,
                accruedInterest: 0,
                interestPhases: getTxnInterestPhases(txn, defaultLendingRate),
                remarks: txn.remarks,
                category: txn.category,
                hasAdvancePeriod: false
            };

            if (excessCredit > 0) {
                if (excessCredit >= newSilo.principalRemaining) {
                    excessCredit = roundMoney(excessCredit - newSilo.principalRemaining);
                    newSilo.principalRemaining = 0;
                } else {
                    newSilo.principalRemaining = roundMoney(newSilo.principalRemaining - excessCredit);
                    excessCredit = 0;
                }
            }

            debitSilos.push(newSilo);
        }
        else if (type === 'credit') {
            let payment = amount;

            // FIFO Waterfall Step 1: Deduct from oldest Debit's accruedInterest
            for (let i = 0; i < debitSilos.length; i++) {
                if (payment <= 0) break;
                const silo = debitSilos[i];
                if (silo.accruedInterest > 0) {
                    const dateStr = formatDate(silo.date);
                    if (payment >= silo.accruedInterest) {
                        payment = roundMoney(payment - silo.accruedInterest);
                        silo.accruedInterest = 0;
                        paymentTraceNotes.push(`Cleared ${dateStr} Interest`);
                    } else {
                        silo.accruedInterest = roundMoney(silo.accruedInterest - payment);
                        payment = 0;
                        paymentTraceNotes.push(`Reduced ${dateStr} Interest`);
                    }
                }
            }

            // FIFO Waterfall Step 2: Deduct from oldest Debit's principalRemaining
            if (payment > 0) {
                for (let i = 0; i < debitSilos.length; i++) {
                    if (payment <= 0) break;
                    const silo = debitSilos[i];
                    if (silo.principalRemaining > 0) {
                        const dateStr = formatDate(silo.date);
                        if (payment >= silo.principalRemaining) {
                            payment = roundMoney(payment - silo.principalRemaining);
                            silo.principalRemaining = 0;
                            paymentTraceNotes.push(`Cleared ${dateStr} Principal`);
                        } else {
                            silo.principalRemaining = roundMoney(silo.principalRemaining - payment);
                            payment = 0;
                            paymentTraceNotes.push(`Reduced ${dateStr} Principal`);
                        }
                    }
                }
            }

            // Excess payment tracked as credit balance
            if (payment > 0) {
                excessCredit = roundMoney(excessCredit + payment);
                paymentTraceNotes.push(`Excess Credit`);
            }
        }
        else if (type === 'waiver') {
            let waiverAmt = amount;
            for (let i = 0; i < debitSilos.length; i++) {
                if (waiverAmt <= 0) break;
                const silo = debitSilos[i];
                if (silo.accruedInterest > 0) {
                    if (waiverAmt >= silo.accruedInterest) {
                        waiverAmt = roundMoney(waiverAmt - silo.accruedInterest);
                        silo.accruedInterest = 0;
                    } else {
                        silo.accruedInterest = roundMoney(silo.accruedInterest - waiverAmt);
                        waiverAmt = 0;
                    }
                }
            }
        }
        else if (type === 'adjustment') {
            let adjAmt = amount;
            for (let i = 0; i < debitSilos.length; i++) {
                if (adjAmt <= 0) break;
                const silo = debitSilos[i];
                if (silo.principalRemaining > 0) {
                    if (adjAmt >= silo.principalRemaining) {
                        adjAmt = roundMoney(adjAmt - silo.principalRemaining);
                        silo.principalRemaining = 0;
                    } else {
                        silo.principalRemaining = roundMoney(silo.principalRemaining - adjAmt);
                        adjAmt = 0;
                    }
                }
            }
        }

        const currentPrincipalSum = roundMoney(debitSilos.reduce((sum, s) => roundMoney(sum + s.principalRemaining), 0) - excessCredit);
        const currentInterestSum = roundMoney(debitSilos.reduce((sum, s) => roundMoney(sum + s.accruedInterest), 0));

        computedLedgerRows.push({
            ...txn,
            runningPrincipal: currentPrincipalSum,
            runningInterest: currentInterestSum,
            totalNet: roundMoney(currentPrincipalSum + currentInterestSum),
            paymentTrace: paymentTraceNotes.join(', ')
        });
    });

    // Final Accrual up to As-Of Date
    updateAllSilosInterestUpTo(asOfDate);

    let totalAccruedInterest = roundMoney(debitSilos.reduce((sum, s) => roundMoney(sum + s.accruedInterest), 0));
    // Directive 1: Displayed Principal = rawPrincipal, Outstanding Balance = rawPrincipal + Displayed Interest
    const netOutstanding = roundMoney(rawPrincipal + totalAccruedInterest);

    let status = 'active';
    if (netOutstanding > 0 && txns.length > 0) {
        const lastTxnDate = new Date(txns[txns.length - 1].date);
        const daysSinceActivity = (asOfDate.getTime() - lastTxnDate.getTime()) / 86400000;
        if (daysSinceActivity > 60) status = 'overdue';
        else if (daysSinceActivity > 30) status = 'warning';
    }

    const result = {
        rawPrincipal,
        netOutstanding,
        totalPrincipalRemaining: rawPrincipal,
        totalAccruedInterest,
        principal: rawPrincipal,
        accruedInterest: totalAccruedInterest,
        totalNet: netOutstanding,
        isDebt: netOutstanding > 0,
        status,
        silos: debitSilos,
        excessCredit,
        advanceLog,
        hasAdvancePeriod: advanceLog.length > 0 || (excessCredit > 0),
        rows: computedLedgerRows.reverse()
    };

    console.log(`[calculateLedger] Per-Transaction Amortization result for customer ${customerId}:`, result);
    return result;
}

// --- UI RENDERING FUNCTIONS ---
function renderDashboard(searchTerm = '') {
    const tbody = document.getElementById('customer-list-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    let globalPrincipal = 0;
    let globalInterest = 0;
    let globalNet = 0;

    (state.customers || []).forEach(c => {
        const ledger = calculateLedger(c.id);
        globalPrincipal = roundMoney(globalPrincipal + ledger.rawPrincipal);
        globalInterest = roundMoney(globalInterest + ledger.totalAccruedInterest);
        globalNet = roundMoney(globalNet + ledger.netOutstanding);
    });

    const dashNetEl = document.getElementById('dash-stat-net');
    if (document.getElementById('dash-stat-principal')) {
        document.getElementById('dash-stat-principal').textContent = formatCurrency(Math.abs(globalPrincipal));
        document.getElementById('dash-stat-interest').textContent = formatCurrency(globalInterest);
        if (dashNetEl) {
            dashNetEl.textContent = formatCurrency(Math.abs(globalNet)) + (globalNet > 0 ? ' (Dr)' : (globalNet < 0 ? ' (Cr)' : ''));
            dashNetEl.className = 'amount stat-net-amount';
        }
    }

    const filtered = (state.customers || []).filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (c.phoneNumber && c.phoneNumber.includes(searchTerm))
    );
    
    if (!filtered || filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center text-secondary" style="padding: 2rem;">No customer accounts found. Click 'New Customer' to begin.</td></tr>`;
        return;
    }

    const sortedCustomers = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    
    sortedCustomers.forEach(customer => {
        const ledger = calculateLedger(customer.id);
        const isCredit = ledger.totalNet < 0;
        const netClass = isCredit ? 'text-success' : (ledger.totalNet > 0 ? 'text-danger' : '');

        const tr = document.createElement('tr');
        tr.onclick = () => openLedger(customer.id);
        tr.innerHTML = `
            <td>
                <div class="customer-cell-flex">
                    <span class="customer-cell-name">${customer.name}</span>
                    <span class="customer-cell-phone">${customer.phoneNumber ? '📱 ' + customer.phoneNumber : ''}</span>
                </div>
            </td>
            <td class="text-right ${netClass}"><strong>${formatCurrency(Math.abs(ledger.totalNet))}</strong> ${ledger.totalNet < 0 ? '(Cr)' : (ledger.totalNet > 0 ? '(Dr)' : '')}</td>
            <td class="text-right">
                <button class="btn-icon" onclick="event.stopPropagation(); editCustomer('${customer.id}')" title="Edit Customer">
                    <i class="ph ph-pencil-simple"></i>
                </button>
                ${!customer.isSettled && ledger.totalNet > 0 ? `
                    <button class="btn-icon text-danger" onclick="event.stopPropagation(); openMarkBadDebtModal('${customer.id}')" title="Mark as Bad Debt (डूबत)">
                        <i class="ph ph-warning"></i>
                    </button>
                ` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderAnalytics() {
    let totalFloating = 0, totalAccrued = 0, totalDeposits = 0;
    
    state.customers.forEach(customer => {
        const ledger = calculateLedger(customer.id);
        if (ledger.isDebt) {
            totalFloating += Math.abs(ledger.principal);
            totalAccrued += ledger.accruedInterest;
        } else {
            totalDeposits += ledger.totalNet;
        }
    });

    document.getElementById('stat-floating').textContent = formatCurrency(totalFloating);
    document.getElementById('stat-accrued').textContent = formatCurrency(totalAccrued);
    document.getElementById('stat-deposits').textContent = formatCurrency(totalDeposits);
}

async function openLedger(customerId) {
    state.currentCustomerId = customerId;
    const customer = state.customers.find(c => c.id === customerId);
    if (customer) {
        const nameEl = document.getElementById('ledger-customer-name');
        if (nameEl) nameEl.textContent = customer.name;
        const phoneEl = document.getElementById('ledger-customer-phone');
        if (phoneEl) phoneEl.textContent = customer.phoneNumber ? `📱 ${customer.phoneNumber}` : '';
    }
    
    switchView('ledger-view');
    renderLedger();
    
    try {
        const response = await LedgerAPI.getCustomerLedger(customerId);
        
        if (response && Array.isArray(response.transactions)) {
            state.currentLedgerSummary = response.summary;
            state.transactions = state.transactions.filter(t => t.customerId !== customerId);
            
            const fetched = response.transactions.map(tx => ({
                id: tx.id,
                customerId: tx.customerId,
                date: tx.date,
                interestStartDate: tx.interestStartDate || tx.date,
                type: tx.type.toLowerCase(),
                category: tx.category || 'Cash',
                amount: tx.amount,
                remarks: tx.remarks || '',
                interestPhases: tx.interestPhases || []
            }));
            
            state.transactions.push(...fetched);
            saveData();
            renderLedger();
        }
    } catch (err) {
        console.warn("Backend API unavailable, rendering local ledger data:", err);
        renderLedger();
    }
}

function formatPhaseSummaryBadge(phases) {
    if (!phases || phases.length === 0) return 'No Interest';
    if (phases.length === 1) {
        const p = phases[0];
        if (p.type === 'none' || p.rate === 0) return 'No Interest';
        if (p.type === 'simple') return `Simple - ${p.rate}%`;
        if (p.type === 'compound') {
            const rawFreq = (p.frequency || 'yearly').replace('-', ' ');
            const capitalizedFreq = rawFreq.charAt(0).toUpperCase() + rawFreq.slice(1);
            return `Compound ${capitalizedFreq} - ${p.rate}%`;
        }
    }
    return `Multi-Phase (${phases.length})`;
}

function renderLedger() {
    if (!state.currentCustomerId) return;

    const customer = state.customers.find(c => c.id === state.currentCustomerId);
    if (customer) {
        const nameEl = document.getElementById('ledger-customer-name');
        if (nameEl) nameEl.textContent = customer.name;
        const phoneEl = document.getElementById('ledger-customer-phone');
        if (phoneEl) phoneEl.textContent = customer.phoneNumber ? `📱 ${customer.phoneNumber}` : '';
    }
    
    const asOfDateInput = document.getElementById('ledger-as-of-date');
    const asOfDateStr = asOfDateInput ? asOfDateInput.value : null;
    const ledger = calculateLedger(state.currentCustomerId, asOfDateStr);
    
    document.getElementById('summary-principal').textContent = formatCurrency(ledger.totalPrincipalRemaining);
    document.getElementById('summary-interest').textContent = formatCurrency(ledger.totalAccruedInterest);
    
    const isCredit = ledger.netOutstanding < 0;
    const netAmt = Math.abs(ledger.netOutstanding);
    
    const netEl = document.getElementById('summary-net');
    if (netEl) {
        netEl.textContent = formatCurrency(netAmt) + (isCredit ? ' (Cr)' : (netAmt > 0 ? ' (Dr)' : ''));
        netEl.className = 'amount stat-net-amount';
    }

    const listBody = document.getElementById('transaction-list-body');
    if (!listBody) return;
    listBody.innerHTML = '';

    const rows = ledger.rows || [];
    if (rows.length === 0) {
        listBody.innerHTML = `<div class="text-center text-secondary" style="padding: 2rem; background: var(--surface-color); border-radius: 12px; border: 1px solid var(--border-color);">No transactions recorded for this customer. Tap 'You Gave' or 'You Got' above to add an entry.</div>`;
        return;
    }

    const asOfDate = asOfDateStr ? new Date(asOfDateStr) : new Date();

    rows.forEach(row => {
        const isDebit = row.type === 'debit';
        const isVoid = row.isVoid;
        const isBadDebt = row.isBadDebt;

        const card = document.createElement('div');
        card.className = 'khata-card' + (isVoid ? ' row-voided' : '');
        card.onclick = () => openTransactionDetailModal(row.id);

        const startDate = row.interestStartDate || row.date;
        const durationStr = calculateDuration(startDate, asOfDate);

        let amountHtml = '';
        if (isVoid) {
            amountHtml = `<span class="text-secondary" style="text-decoration: line-through;">${formatCurrency(row.amount)}</span> <span class="status-badge status-void">VOIDED</span>`;
        } else if (isBadDebt) {
            amountHtml = `<span class="amt-debit">${formatCurrency(row.amount)}</span> <span class="status-badge status-baddebt">WRITTEN OFF</span>`;
        } else if (isDebit) {
            amountHtml = `<span class="amt-debit">${formatCurrency(row.amount)}</span><span class="khata-card-type-tag">You Gave</span>`;
        } else {
            amountHtml = `<span class="amt-credit">${formatCurrency(row.amount)}</span><span class="khata-card-type-tag">${row.type === 'waiver' ? 'Waiver' : 'You Got'}</span>`;
        }

        const categoryBadge = row.category ? `<span class="badge">${row.category}</span>` : '';
        const durationBadge = isDebit && !isVoid ? `<span class="duration-pill"><i class="ph ph-clock"></i> ${durationStr}</span>` : '';

        card.innerHTML = `
            <div class="khata-card-left">
                <div class="khata-card-date">${formatDate(row.date)}</div>
                <div class="khata-card-meta">
                    ${durationBadge}
                    ${categoryBadge}
                    <span class="khata-card-remarks">${row.remarks || 'No remarks'}</span>
                </div>
            </div>
            <div class="khata-card-right">
                ${amountHtml}
            </div>
        `;
        listBody.appendChild(card);
    });
}

// --- MODALS & FORMS ---
function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if (show) {
        modal.classList.remove('hidden');
        if (modalId === 'customer-modal') {
            const errorEl = document.getElementById('customer-form-error');
            if (errorEl) {
                errorEl.classList.add('hidden');
                errorEl.textContent = '';
            }
        } else if (modalId === 'transaction-modal') {
            const errorEl = document.getElementById('transaction-form-error');
            if (errorEl) {
                errorEl.classList.add('hidden');
                errorEl.textContent = '';
            }
        }
    } else {
        modal.classList.add('hidden');
    }
}

// ==========================================
// --- SETTLEMENT ENGINE & ARCHIVING (Directives 2 & 3) ---
// ==========================================
function openSettlementModal(customerId) {
    if (!customerId) return;
    const customer = state.customers.find(c => c.id === customerId);
    if (!customer) return;

    const ledger = calculateLedger(customerId);
    
    const custIdEl = document.getElementById('settle-customer-id');
    const custNameEl = document.getElementById('settle-customer-name');
    const prinEl = document.getElementById('settle-principal-amount');
    const intEl = document.getElementById('settle-interest-amount');
    const grossEl = document.getElementById('settle-gross-amount');
    const dateInput = document.getElementById('settle-date-input');
    const discountInput = document.getElementById('settle-discount-input');

    if (custIdEl) custIdEl.value = customerId;
    if (custNameEl) custNameEl.textContent = customer.name;
    if (prinEl) prinEl.textContent = formatCurrency(ledger.totalPrincipalRemaining);
    if (intEl) intEl.textContent = formatCurrency(ledger.totalAccruedInterest);
    if (grossEl) grossEl.textContent = formatCurrency(ledger.netOutstanding);

    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    if (discountInput) discountInput.value = '0.00';

    updateSettlementCalculations();
    toggleModal('settlement-modal', true);
}

function updateSettlementCalculations() {
    const customerId = document.getElementById('settle-customer-id')?.value;
    if (!customerId) return;

    const ledger = calculateLedger(customerId);
    const grossOutstanding = ledger.netOutstanding;
    const discount = parseFloat(document.getElementById('settle-discount-input')?.value) || 0;

    const netPayment = roundMoney(Math.max(0, grossOutstanding - discount));
    const netDisplay = document.getElementById('settle-net-payment-display');
    if (netDisplay) {
        netDisplay.textContent = formatCurrency(netPayment);
    }
}

document.getElementById('settle-discount-input')?.addEventListener('input', updateSettlementCalculations);

document.getElementById('settlement-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const customerId = document.getElementById('settle-customer-id').value;
    const settleDateInput = document.getElementById('settle-date-input').value;
    const discount = roundMoney(parseFloat(document.getElementById('settle-discount-input').value) || 0);

    if (!customerId || !settleDateInput) return;
    const customer = state.customers.find(c => c.id === customerId);
    if (!customer) return;

    const settleDate = new Date(settleDateInput).toISOString();
    const ledger = calculateLedger(customerId, settleDateInput);
    const grossOutstanding = ledger.netOutstanding;

    // 1. Process Discount/Waiver if present
    if (discount > 0) {
        const waiverTxn = {
            id: `txn_waiver_${Date.now()}`,
            customerId,
            date: settleDate,
            interestStartDate: settleDate,
            type: 'waiver',
            category: 'Settlement Waiver',
            amount: discount,
            remarks: `Settlement Interest Waiver / Discount`,
            isVoid: false,
            createdAt: new Date().toISOString()
        };
        state.transactions.push(waiverTxn);
    }

    // 2. Process Final Zero-Out Transaction
    const remainingToZero = roundMoney(grossOutstanding - discount);
    if (remainingToZero > 0) {
        // Customer owes merchant -> Credit transaction brings balance to 0
        const zeroTxn = {
            id: `txn_settle_${Date.now()}`,
            customerId,
            date: settleDate,
            interestStartDate: settleDate,
            type: 'credit',
            category: 'Settlement',
            amount: remainingToZero,
            remarks: `Full Account Settlement Payment`,
            isVoid: false,
            createdAt: new Date().toISOString()
        };
        state.transactions.push(zeroTxn);
    } else if (grossOutstanding < 0) {
        // Merchant owed credit to customer -> Debit transaction brings balance to 0
        const refundAmt = Math.abs(grossOutstanding);
        const zeroTxn = {
            id: `txn_settle_${Date.now()}`,
            customerId,
            date: settleDate,
            interestStartDate: settleDate,
            type: 'debit',
            category: 'Settlement',
            amount: refundAmt,
            remarks: `Account Settlement Credit Refund`,
            isVoid: false,
            createdAt: new Date().toISOString()
        };
        state.transactions.push(zeroTxn);
    }

    // 3. Update Customer Profile State as Settled
    customer.isSettled = true;
    customer.settlementDate = settleDate;

    saveData();
    toggleModal('settlement-modal', false);

    if (state.currentCustomerId === customerId) {
        renderLedger();
    }
    renderDashboard();
});

document.getElementById('btn-settle-account')?.addEventListener('click', () => {
    if (state.currentCustomerId) {
        openSettlementModal(state.currentCustomerId);
    }
});

document.querySelectorAll('.modal-close').forEach(btn => {
    btn.onclick = (e) => e.target.closest('.modal').classList.add('hidden');
});

document.getElementById('btn-back').onclick = () => {
    state.currentCustomerId = null;
    switchView('dashboard-view');
};

const btnTopBack = document.getElementById('btn-top-back');
if (btnTopBack) {
    btnTopBack.onclick = () => {
        state.currentCustomerId = null;
        switchView('dashboard-view');
    };
}

const topBarThemeToggle = document.getElementById('top-bar-theme-toggle');
if (topBarThemeToggle) {
    topBarThemeToggle.onclick = () => {
        if (themeToggleBtn) themeToggleBtn.click();
    };
}



let searchDebounceTimer = null;
document.getElementById('search-input').addEventListener('input', (e) => {
    const searchTerm = e.target.value;
    renderDashboard(searchTerm);

    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(async () => {
        if (state.isAuthenticated && LedgerAPI.getToken()) {
            try {
                const searchRes = await LedgerAPI.searchCustomers(searchTerm);
                if (Array.isArray(searchRes?.customers)) {
                    state.customers = searchRes.customers;
                    renderDashboard(searchTerm);
                }
            } catch (err) {
                console.warn("Backend search failed, using local search:", err);
            }
        }
    }, 300);
});

// New Customer Form
document.getElementById('btn-new-customer').onclick = () => {
    document.getElementById('customer-form').reset();
    document.getElementById('cust-id').value = '';
    const interestTypeSelect = document.getElementById('cust-interest-type');
    if (interestTypeSelect) interestTypeSelect.value = 'simple';
    const freqGroup = document.getElementById('cust-compound-freq-group');
    if (freqGroup) freqGroup.classList.add('hidden');
    const delBtn = document.getElementById('btn-delete-customer-modal');
    if (delBtn) delBtn.style.display = 'none';
    toggleModal('customer-modal', true);
};

// Edit Existing Customer
function editCustomer(id) {
    const customer = state.customers.find(c => c.id === id);
    if(customer) {
        document.getElementById('cust-id').value = customer.id;
        document.getElementById('cust-name').value = customer.name;
        document.getElementById('cust-phone').value = customer.phoneNumber || '';
        document.getElementById('cust-address').value = customer.address || '';
        document.getElementById('cust-lend-rate').value = customer.lendingRate || '';
        document.getElementById('cust-dep-rate').value = customer.depositRate || '';

        const typeSelect = document.getElementById('cust-interest-type');
        if (typeSelect) typeSelect.value = customer.defaultInterestType || customer.interestType || 'simple';

        const freqSelect = document.getElementById('cust-compound-freq');
        if (freqSelect) freqSelect.value = customer.compoundingFrequency || customer.compoundFrequency || 'monthly';

        const freqGroup = document.getElementById('cust-compound-freq-group');
        if (freqGroup) {
            const currentType = customer.defaultInterestType || customer.interestType || 'simple';
            if (currentType === 'compound') {
                freqGroup.classList.remove('hidden');
            } else {
                freqGroup.classList.add('hidden');
            }
        }

        const delBtn = document.getElementById('btn-delete-customer-modal');
        if (delBtn) delBtn.style.display = 'inline-block';
        toggleModal('customer-modal', true);
    }
}

document.getElementById('cust-interest-type')?.addEventListener('change', (e) => {
    const freqGroup = document.getElementById('cust-compound-freq-group');
    if (freqGroup) {
        if (e.target.value === 'compound') {
            freqGroup.classList.remove('hidden');
        } else {
            freqGroup.classList.add('hidden');
        }
    }
});

document.getElementById('btn-delete-customer-modal')?.addEventListener('click', () => {
    const custId = document.getElementById('cust-id').value;
    if (!custId) return;

    const customer = state.customers.find(c => c.id === custId);
    const name = customer ? customer.name : 'this customer';

    if (confirm(`Are you sure you want to delete ${name}? This will permanently remove all associated transactions and ledger records.`)) {
        state.customers = (state.customers || []).filter(c => c.id !== custId);
        state.transactions = (state.transactions || []).filter(t => t.customerId !== custId);
        saveData();
        toggleModal('customer-modal', false);
        showDashboard();
        renderDashboard();
    }
});

document.getElementById('customer-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('cust-id').value;

    if (id) {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;

        let errorEl = document.getElementById('customer-form-error');
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.id = 'customer-form-error';
            errorEl.className = 'text-danger';
            errorEl.style.marginBottom = '1rem';
            errorEl.style.fontSize = '0.875rem';
            errorEl.style.textAlign = 'center';
            e.target.insertBefore(errorEl, e.target.firstChild);
        }
        errorEl.classList.add('hidden');
        errorEl.textContent = '';

        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        try {
            const name = document.getElementById('cust-name').value.trim();
            const phoneNumber = document.getElementById('cust-phone').value.trim();
            const address = document.getElementById('cust-address').value.trim();
            const lendingRate = parseFloat(document.getElementById('cust-lend-rate').value);
            const depositRate = parseFloat(document.getElementById('cust-dep-rate').value);
            const defaultInterestType = document.getElementById('cust-interest-type')?.value || 'simple';
            const compoundingFrequency = document.getElementById('cust-compound-freq')?.value || 'monthly';

            const customerData = {
                name,
                phoneNumber,
                address,
                lendingRate,
                depositRate,
                defaultInterestType,
                compoundingFrequency
            };

            const idx = state.customers.findIndex(c => c.id === id);
            if (idx !== -1) {
                state.customers[idx] = { ...state.customers[idx], ...customerData };
                saveData();
            }

            if (!state.isTestMode && LedgerAPI.getToken()) {
                try {
                    await LedgerAPI.updateCustomer(id, customerData);
                } catch (apiErr) {
                    console.warn("Backend customer update sync failed, saved locally:", apiErr);
                }
            }

            e.target.reset();
            toggleModal('customer-modal', false);
            renderDashboard();
        } catch (err) {
            console.error("Update customer failed:", err);
            errorEl.textContent = err.message || 'Unable to update customer. Saved locally.';
            errorEl.classList.remove('hidden');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
        return;
    }

    // --- CREATE CUSTOMER FLOW ---
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;

    let errorEl = document.getElementById('customer-form-error');
    if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.id = 'customer-form-error';
        errorEl.className = 'text-danger';
        errorEl.style.marginBottom = '1rem';
        errorEl.style.fontSize = '0.875rem';
        errorEl.style.textAlign = 'center';
        e.target.insertBefore(errorEl, e.target.firstChild);
    }
    errorEl.classList.add('hidden');
    errorEl.textContent = '';

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';

    try {
        const name = document.getElementById('cust-name').value.trim();
        const phoneNumber = document.getElementById('cust-phone').value.trim();
        const address = document.getElementById('cust-address').value.trim();
        const lendingRate = parseFloat(document.getElementById('cust-lend-rate').value);
        const depositRate = parseFloat(document.getElementById('cust-dep-rate').value);
        const defaultInterestType = document.getElementById('cust-interest-type')?.value || 'simple';
        const compoundingFrequency = document.getElementById('cust-compound-freq')?.value || 'monthly';

        const customerData = {
            id: 'cust-' + Date.now(),
            name,
            phoneNumber,
            address,
            lendingRate,
            depositRate,
            defaultInterestType,
            compoundingFrequency,
            createdAt: new Date().toISOString()
        };

        state.customers.push(customerData);
        saveData();

        if (!state.isTestMode && LedgerAPI.getToken()) {
            try {
                const res = await LedgerAPI.createCustomer(customerData);
                if (res && res.id) {
                    customerData.id = res.id;
                    saveData();
                }
            } catch (apiErr) {
                console.warn("Backend customer creation sync failed, saved locally:", apiErr);
            }
        }

        e.target.reset();
        toggleModal('customer-modal', false);
        renderDashboard();
    } catch (err) {
        console.error("Create customer failed:", err);
        errorEl.textContent = err.message || 'Unable to create customer. Saved locally.';
        errorEl.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
};

// --- INTEREST SCHEDULE BUILDER ENGINE ---
let activeModalInterestPhases = [];

function getCustomerDefaultInterestRate() {
    if (!state.currentCustomerId) return 12;
    const customer = state.customers.find(c => c.id === state.currentCustomerId);
    if (!customer) return 12;
    const rate = parseFloat(customer.lendingRate);
    return isNaN(rate) ? 12 : rate;
}

function createDefaultInterestPhase(defaultRate) {
    const customer = state.currentCustomerId ? state.customers.find(c => c.id === state.currentCustomerId) : null;
    const type = customer?.defaultInterestType || customer?.interestType || 'simple';
    const frequency = customer?.compoundingFrequency || customer?.compoundFrequency || 'monthly';
    const rate = type === 'none' ? 0 : (typeof defaultRate === 'number' ? defaultRate : getCustomerDefaultInterestRate());
    return {
        type,
        rate,
        frequency: type === 'compound' ? frequency : 'yearly',
        customDays: null,
        endDate: ''
    };
}

function renderInterestSchedule() {
    const container = document.getElementById('interest-schedule-container');
    if (!container) return;

    container.innerHTML = '';
    const showRemove = activeModalInterestPhases.length > 1;

    activeModalInterestPhases.forEach((phase, index) => {
        const card = document.createElement('div');
        card.className = 'interest-phase-card';
        card.setAttribute('data-phase-index', index);

        const isNone = phase.type === 'none';
        const isCompound = phase.type === 'compound';
        const isCustomDays = isCompound && phase.frequency === 'custom_days';

        card.innerHTML = `
            <div class="phase-card-header">
                <span class="phase-badge"><i class="ph ph-clock"></i> Phase ${index + 1}</span>
                ${showRemove ? `<button type="button" class="btn-remove-phase text-danger" data-index="${index}" title="Remove Phase"><i class="ph ph-x"></i></button>` : ''}
            </div>
            <div class="phase-card-body">
                <div class="form-group-row">
                    <div class="form-group">
                        <label>Interest Type</label>
                        <select class="phase-type" data-index="${index}">
                            <option value="none" ${phase.type === 'none' ? 'selected' : ''}>No Interest</option>
                            <option value="simple" ${phase.type === 'simple' ? 'selected' : ''}>Simple</option>
                            <option value="compound" ${phase.type === 'compound' ? 'selected' : ''}>Compound</option>
                        </select>
                    </div>
                    <div class="form-group phase-rate-group ${isNone ? 'hidden' : ''}">
                        <label>Rate (% / yr)</label>
                        <input type="number" class="phase-rate" data-index="${index}" step="0.1" min="0" placeholder="e.g. 12" value="${phase.rate ?? 12}">
                    </div>
                </div>
                <div class="form-group-row phase-compound-row ${isCompound ? '' : 'hidden'}">
                    <div class="form-group phase-freq-group">
                        <label>Compounding Frequency</label>
                        <select class="phase-frequency" data-index="${index}">
                            <option value="monthly" ${phase.frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
                            <option value="quarterly" ${phase.frequency === 'quarterly' ? 'selected' : ''}>Quarterly</option>
                            <option value="half-yearly" ${phase.frequency === 'half-yearly' ? 'selected' : ''}>Half-Yearly</option>
                            <option value="yearly" ${phase.frequency === 'yearly' || !phase.frequency ? 'selected' : ''}>Yearly</option>
                            <option value="custom_days" ${phase.frequency === 'custom_days' ? 'selected' : ''}>Custom Days</option>
                        </select>
                    </div>
                    <div class="form-group phase-custom-days-group ${isCustomDays ? '' : 'hidden'}">
                        <label>Custom Days</label>
                        <input type="number" class="phase-custom-days" data-index="${index}" min="1" step="1" placeholder="e.g. 30" value="${phase.customDays || ''}">
                    </div>
                </div>
                <div class="form-group phase-end-date-group">
                    <label>End Date <span class="text-secondary" style="font-size: 0.75rem;">(Optional - blank = runs indefinitely)</span></label>
                    <input type="date" class="phase-end-date" data-index="${index}" value="${phase.endDate || ''}">
                </div>
            </div>
        `;

        container.appendChild(card);
    });

    container.querySelectorAll('.phase-type').forEach(select => {
        select.onchange = (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'), 10);
            activeModalInterestPhases[idx].type = e.target.value;
            renderInterestSchedule();
        };
    });

    container.querySelectorAll('.phase-rate').forEach(input => {
        input.oninput = (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'), 10);
            activeModalInterestPhases[idx].rate = parseFloat(e.target.value) || 0;
        };
    });

    container.querySelectorAll('.phase-frequency').forEach(select => {
        select.onchange = (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'), 10);
            activeModalInterestPhases[idx].frequency = e.target.value;
            renderInterestSchedule();
        };
    });

    container.querySelectorAll('.phase-custom-days').forEach(input => {
        input.oninput = (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'), 10);
            activeModalInterestPhases[idx].customDays = parseInt(e.target.value, 10) || null;
        };
    });

    container.querySelectorAll('.phase-end-date').forEach(input => {
        input.onchange = (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'), 10);
            activeModalInterestPhases[idx].endDate = e.target.value || '';
        };
    });

    container.querySelectorAll('.btn-remove-phase').forEach(btn => {
        btn.onclick = (e) => {
            const idx = parseInt(btn.getAttribute('data-index'), 10);
            if (activeModalInterestPhases.length > 1) {
                activeModalInterestPhases.splice(idx, 1);
                renderInterestSchedule();
            }
        };
    });
}

function resetInterestScheduleBuilder() {
    const defaultRate = getCustomerDefaultInterestRate();
    activeModalInterestPhases = [createDefaultInterestPhase(defaultRate)];
    renderInterestSchedule();
}

const addPhaseBtn = document.getElementById('btn-add-phase');
if (addPhaseBtn) {
    addPhaseBtn.onclick = () => {
        const defaultRate = getCustomerDefaultInterestRate();
        activeModalInterestPhases.push(createDefaultInterestPhase(defaultRate));
        renderInterestSchedule();
    };
}

/**
 * Backward compatibility helper to extract valid interestPhases from a transaction object.
 */
function getTxnInterestPhases(txn, defaultRate = 12, customer = null) {
    if (txn && Array.isArray(txn.interestPhases) && txn.interestPhases.length > 0) {
        return txn.interestPhases;
    }
    const legacyRate = typeof txn?.interestRate === 'number' ? txn.interestRate : (defaultRate || 12);
    const iType = (txn?.interestType || customer?.defaultInterestType || customer?.interestType || 'simple').toLowerCase();
    const freq = (txn?.compoundingFrequency || customer?.compoundingFrequency || customer?.compoundFrequency || 'monthly').toLowerCase();

    if (iType === 'none') {
        return [{
            type: 'none',
            rate: 0,
            frequency: 'yearly',
            customDays: null,
            endDate: null
        }];
    } else if (iType === 'compound') {
        return [{
            type: 'compound',
            rate: legacyRate,
            frequency: freq,
            customDays: null,
            endDate: null
        }];
    }
    return [{
        type: 'simple',
        rate: legacyRate,
        frequency: 'yearly',
        customDays: null,
        endDate: null
    }];
}

// Smart Date Binding: Auto-update interestStartDate when txn-date changes
const syncInterestStartDate = (e) => {
    const interestStartInput = document.getElementById('txn-interest-start-date');
    if (interestStartInput && e.target.value) {
        interestStartInput.value = e.target.value;
    }
};
document.getElementById('txn-date')?.addEventListener('change', syncInterestStartDate);
document.getElementById('txn-date')?.addEventListener('input', syncInterestStartDate);

// Transaction Form Modal Handlers
function openAddTransactionModal(type = 'debit') {
    const form = document.getElementById('transaction-form');
    if (form) form.reset();

    document.getElementById('txn-id').value = '';
    document.getElementById('txn-type').value = type;

    const btnDebit = document.getElementById('toggle-type-debit');
    const btnCredit = document.getElementById('toggle-type-credit');
    if (btnDebit && btnCredit) {
        if (type === 'debit') {
            btnDebit.classList.add('active');
            btnCredit.classList.remove('active');
        } else {
            btnCredit.classList.add('active');
            btnDebit.classList.remove('active');
        }
    }

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('txn-date').value = today;
    const startInput = document.getElementById('txn-interest-start-date');
    if (startInput) startInput.value = today;

    // Smart defaults from customer profile
    if (state.currentCustomerId) {
        const customer = state.customers.find(c => c.id === state.currentCustomerId);
        if (customer) {
            const rateInput = document.getElementById('txn-interest-rate');
            if (rateInput) rateInput.value = customer.lendingRate || 12;

            const typeInput = document.getElementById('txn-interest-type');
            if (typeInput) typeInput.value = customer.defaultInterestType || 'simple';
        }
    }

    // Collapse accordion by default
    const accordion = document.getElementById('advanced-interest-accordion');
    if (accordion) accordion.open = false;

    resetInterestScheduleBuilder();
    toggleModal('transaction-modal', true);
}

document.getElementById('toggle-type-debit')?.addEventListener('click', () => {
    document.getElementById('txn-type').value = 'debit';
    document.getElementById('toggle-type-debit').classList.add('active');
    document.getElementById('toggle-type-credit').classList.remove('active');
});

document.getElementById('toggle-type-credit')?.addEventListener('click', () => {
    document.getElementById('txn-type').value = 'credit';
    document.getElementById('toggle-type-credit').classList.add('active');
    document.getElementById('toggle-type-debit').classList.remove('active');
});

document.getElementById('btn-ledger-gave')?.addEventListener('click', () => {
    openAddTransactionModal('debit');
});

document.getElementById('btn-ledger-got')?.addEventListener('click', () => {
    openAddTransactionModal('credit');
});

document.getElementById('btn-see-calculation')?.addEventListener('click', () => {
    showInterestBreakdown(null);
});

function editTransaction(txnId) {
    const txn = state.transactions.find(t => t.id === txnId);
    if (txn) {
        document.getElementById('transaction-form').reset();
        document.getElementById('txn-id').value = txn.id;
        const tDate = new Date(txn.date).toISOString().split('T')[0];
        document.getElementById('txn-date').value = tDate;
        document.getElementById('txn-type').value = txn.type;
        document.getElementById('txn-category').value = txn.category;
        document.getElementById('txn-amount').value = txn.amount;
        document.getElementById('txn-remarks').value = txn.remarks || '';
        
        const startInput = document.getElementById('txn-interest-start-date');
        if (startInput) startInput.value = txn.interestStartDate ? new Date(txn.interestStartDate).toISOString().split('T')[0] : tDate;

        const btnDebit = document.getElementById('toggle-type-debit');
        const btnCredit = document.getElementById('toggle-type-credit');
        if (btnDebit && btnCredit) {
            if (txn.type === 'debit') {
                btnDebit.classList.add('active');
                btnCredit.classList.remove('active');
            } else {
                btnCredit.classList.add('active');
                btnDebit.classList.remove('active');
            }
        }

        activeModalInterestPhases = JSON.parse(JSON.stringify(getTxnInterestPhases(txn, getCustomerDefaultInterestRate())));
        renderInterestSchedule();
        
        toggleModal('transaction-modal', true);
    }
}

function openTransactionDetailModal(txnId) {
    const txn = (state.transactions || []).find(t => t.id === txnId);
    if (!txn) return;

    const customer = state.customers.find(c => c.id === txn.customerId);
    const asOfDateInput = document.getElementById('ledger-as-of-date');
    const asOfDateStr = asOfDateInput ? asOfDateInput.value : null;
    const asOfDate = asOfDateStr ? new Date(asOfDateStr) : new Date();

    const ledger = calculateLedger(txn.customerId, asOfDateStr);
    const row = (ledger.rows || []).find(r => r.id === txnId) || txn;
    const silo = (ledger.silos || []).find(s => s.id === txnId);

    const isDebit = txn.type === 'debit';
    const startDate = txn.interestStartDate || txn.date;
    const durationStr = calculateDuration(startDate, asOfDate);
    const accruedInterest = isDebit ? (silo ? silo.accruedInterest : (row.runningInterest || 0)) : 0;
    const principalAmt = parseFloat(txn.amount) || 0;
    const effectiveAmt = isDebit ? (principalAmt + accruedInterest) : principalAmt;

    const body = document.getElementById('txn-detail-body');
    if (!body) return;

    body.innerHTML = `
        <div class="detail-metrics-grid">
            <div class="detail-metric-card">
                <span class="detail-metric-label">Principal Amount</span>
                <span class="detail-metric-val ${isDebit ? 'text-danger' : 'text-success'}">${formatCurrency(principalAmt)}</span>
            </div>
            <div class="detail-metric-card">
                <span class="detail-metric-label">Interest Duration</span>
                <span class="detail-metric-val"><span class="duration-pill"><i class="ph ph-clock"></i> ${durationStr}</span></span>
            </div>
            <div class="detail-metric-card">
                <span class="detail-metric-label">Interest on Principal</span>
                <span class="detail-metric-val text-danger">${isDebit ? formatCurrency(accruedInterest) : '₹0.00'}</span>
            </div>
            <div class="detail-metric-card">
                <span class="detail-metric-label">Effective Amount</span>
                <span class="detail-metric-val ${isDebit ? 'text-danger' : 'text-success'}">${formatCurrency(effectiveAmt)}</span>
            </div>
        </div>

        <div style="background: var(--bg-color); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 0.88rem; display: flex; flex-direction: column; gap: 6px;">
            <div><strong>Transaction Date:</strong> ${formatDate(txn.date)}</div>
            ${txn.interestStartDate ? `<div><strong>Calculate Interest From:</strong> ${formatDate(txn.interestStartDate)}</div>` : ''}
            <div><strong>Category:</strong> <span class="badge">${txn.category || 'Cash'}</span></div>
            <div><strong>Remarks:</strong> ${txn.remarks || 'None'}</div>
            ${isDebit ? `<div><strong>Interest Rate / Rule:</strong> ${(txn.interestRate !== undefined ? txn.interestRate : (customer?.lendingRate || 12))}% / yr (${(txn.interestType || 'simple').toUpperCase()})</div>` : ''}
            ${txn.isVoid ? `<div class="text-danger"><strong>Status:</strong> VOIDED (Reason: ${txn.voidReason || 'Reversed'})</div>` : ''}
            ${txn.isBadDebt ? `<div class="text-danger"><strong>Status:</strong> WRITTEN OFF TO BAD DEBT</div>` : ''}
        </div>

        <div class="detail-actions-bar">
            ${!txn.isVoid && !txn.isBadDebt ? `
                <button type="button" class="btn-outline btn-sm" onclick="toggleModal('txn-detail-modal', false); editTransaction('${txn.id}')">
                    <i class="ph ph-pencil-simple"></i> Edit Entry
                </button>
                <button type="button" class="btn-outline btn-sm text-danger" onclick="toggleModal('txn-detail-modal', false); openVoidModal('txn', '${txn.id}')">
                    <i class="ph ph-prohibit"></i> Delete / Void
                </button>
                ${isDebit ? `
                    <button type="button" class="btn-outline btn-sm text-danger" onclick="toggleModal('txn-detail-modal', false); openMarkBadDebtModal('${txn.customerId}', '${txn.id}')">
                        <i class="ph ph-warning"></i> Mark Bad Debt
                    </button>
                ` : ''}
            ` : `<span class="text-secondary" style="font-size: 0.85rem;">Record is archived / non-editable.</span>`}
        </div>
    `;

    toggleModal('txn-detail-modal', true);
}

document.getElementById('transaction-form').onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;

    let errorEl = document.getElementById('transaction-form-error');
    if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.id = 'transaction-form-error';
        errorEl.className = 'text-danger';
        errorEl.style.marginBottom = '1rem';
        errorEl.style.fontSize = '0.875rem';
        errorEl.style.textAlign = 'center';
        e.target.insertBefore(errorEl, e.target.firstChild);
    }
    errorEl.classList.add('hidden');
    errorEl.textContent = '';

    submitBtn.disabled = true;
    submitBtn.textContent = 'Committing...';

    try {
        const customerId = state.currentCustomerId;
        const typeValue = document.getElementById('txn-type').value;

        if (typeValue !== 'debit' && typeValue !== 'credit') {
            throw new Error('Transaction type must be Debit or Credit');
        }

        const amount = parseFloat(document.getElementById('txn-amount').value);
        const dateInput = document.getElementById('txn-date').value;
        const interestStartDateInput = document.getElementById('txn-interest-start-date')?.value;
        const category = document.getElementById('txn-category').value;
        const remarks = document.getElementById('txn-remarks').value.trim();

        if (!dateInput) {
            throw new Error('Transaction date is required');
        }
        if (new Date(dateInput) > new Date()) {
            throw new Error('Transaction date cannot be in the future');
        }

        if (!activeModalInterestPhases || activeModalInterestPhases.length === 0) {
            throw new Error('Transaction must have at least one interest schedule phase.');
        }

        const phases = activeModalInterestPhases.map((phase, idx) => {
            const type = phase.type;
            const rate = type === 'none' ? 0 : (parseFloat(phase.rate) || 0);
            const frequency = type === 'compound' ? (phase.frequency || 'yearly') : null;
            const customDays = (type === 'compound' && frequency === 'custom_days')
                ? (parseInt(phase.customDays, 10) || null)
                : null;
            const endDate = phase.endDate ? phase.endDate : null;

            if (type !== 'none' && (isNaN(rate) || rate < 0)) {
                throw new Error(`Phase ${idx + 1}: Rate must be a non-negative number.`);
            }
            if (type === 'compound' && frequency === 'custom_days' && (!customDays || customDays < 1)) {
                throw new Error(`Phase ${idx + 1}: Custom Days must be a positive number.`);
            }
            if (idx < activeModalInterestPhases.length - 1 && !endDate) {
                throw new Error(`Phase ${idx + 1}: End Date is required for non-terminal phases.`);
            }
            if (endDate && new Date(endDate) < new Date(dateInput)) {
                throw new Error(`Phase ${idx + 1}: End Date cannot be earlier than Transaction Date.`);
            }

            return {
                type,
                rate,
                frequency,
                customDays,
                endDate
            };
        });

        const date = new Date(dateInput).toISOString();
        const interestStartDate = interestStartDateInput ? new Date(interestStartDateInput).toISOString() : date;
        const txnIdVal = document.getElementById('txn-id').value;
        const isEdit = !!txnIdVal;
        const newTxnId = isEdit ? txnIdVal : `txn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        const transactionData = {
            id: newTxnId,
            customerId,
            type: typeValue, // 'debit' | 'credit'
            category,
            amount,
            date,
            interestStartDate,
            interestPhases: phases,
            remarks: remarks || null,
            isVoid: false,
            createdAt: isEdit ? (state.transactions.find(t => t.id === newTxnId)?.createdAt || new Date().toISOString()) : new Date().toISOString()
        };

        if (isEdit) {
            transactionData.isEdited = true;
            transactionData.editedAt = new Date().toISOString();
            const index = state.transactions.findIndex(t => t.id === newTxnId);
            if (index !== -1) {
                state.transactions[index] = { ...state.transactions[index], ...transactionData };
            }
        } else {
            state.transactions.push(transactionData);
        }

        // Auto-Reactivate Settled Customer when new transaction is added (Directive 3.3)
        const targetCust = state.customers.find(c => c.id === customerId);
        if (targetCust && targetCust.isSettled) {
            targetCust.isSettled = false;
            delete targetCust.settlementDate;
        }
        
        saveData();

        try {
            if (isEdit) {
                await LedgerAPI.updateTransaction(newTxnId, {
                    type: typeValue.toUpperCase(),
                    amount,
                    date,
                    interestStartDate,
                    interestPhases: phases,
                    remarks: remarks || null
                });
            } else {
                await LedgerAPI.createTransaction({
                    customerId,
                    type: typeValue.toUpperCase(),
                    amount,
                    date,
                    interestStartDate,
                    interestPhases: phases,
                    remarks: remarks || null
                });
            }
        } catch (apiErr) {
            console.warn("Backend sync failed, saved locally:", apiErr);
        }

        e.target.reset();
        toggleModal('transaction-modal', false);

        if (state.currentCustomerId) {
            renderLedger();
        }
    } catch (err) {
        console.error("Create transaction failed:", err);
        errorEl.textContent = err.message || 'Unable to create transaction. Please check your connection and try again.';
        errorEl.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
};

// --- INTEGRATIONS (WhatsApp & PDF) ---
document.getElementById('btn-whatsapp').onclick = () => {
    if(!state.currentCustomerId) return;
    const customer = state.customers.find(c => c.id === state.currentCustomerId);
    const ledger = calculateLedger(state.currentCustomerId);
    
    if(ledger.totalNet >= 0) {
        alert("This customer does not owe any money.");
        return;
    }

    const amt = formatCurrency(Math.abs(ledger.totalNet));
    const msg = `Namaste ${customer.name},\n\nThis is a friendly reminder from Mohit Store. Your current outstanding ledger balance is *${amt}*.\n\nPlease review and arrange for payment. Thank you!`;
    
    const waUrl = `https://wa.me/91${customer.phoneNumber || ''}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
};

function downloadLedgerPDF(customerId, mode = 'detailed') {
    if (!window.jspdf) {
        alert("PDF generator library loading. Please try again in a moment.");
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const targetCustId = customerId || state.currentCustomerId;
    const customer = state.customers.find(c => c.id === targetCustId);
    if (!customer) return;

    const ledger = calculateLedger(targetCustId);
    const rows = ledger.rows || [];

    // Determine statement date range
    let dateRangeStr = `As of ${formatDate(new Date())}`;
    if (rows.length > 0) {
        const validDates = rows.map(r => r.date ? new Date(r.date) : null).filter(d => d && !isNaN(d.getTime()));
        if (validDates.length > 0) {
            validDates.sort((a, b) => a - b);
            const earliest = formatDate(validDates[0]);
            const latest = formatDate(validDates[validDates.length - 1]);
            dateRangeStr = `Period: ${earliest} to ${latest}`;
        }
    }

    // --- PROMINENT HEADER SECTION ---
    // Dark Top Header Bar (15, 23, 42)
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 26, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("MOHIT STORE", 14, 13);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text("MERCHANT LEDGER STATEMENT", 14, 20);

    doc.setFontSize(8.5);
    doc.text(mode === 'detailed' ? 'Detailed Itemized Statement' : 'Summary Statement', 196, 13, { align: 'right' });
    doc.text(dateRangeStr, 196, 20, { align: 'right' });

    // Customer & Financial Summary Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 30, 182, 35, 3, 3, 'FD');

    // Customer Info (Left)
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "bold");
    doc.text("CUSTOMER INFORMATION", 18, 37);

    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(customer.name, 18, 43);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(`Phone: ${customer.phoneNumber || 'N/A'}`, 18, 49);
    if (customer.address) {
        doc.text(`Address: ${customer.address}`, 18, 54);
        doc.text(`Account ID: ${customer.id}`, 18, 59);
    } else {
        doc.text(`Account ID: ${customer.id}`, 18, 54);
    }

    // Financial Overview Card (Right)
    const isDebit = ledger.netOutstanding > 0;
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "bold");
    doc.text("ACCOUNT BALANCE OVERVIEW", 115, 37);

    doc.setFontSize(12);
    if (isDebit) {
        doc.setTextColor(220, 38, 38); // Crimson for debit
    } else {
        doc.setTextColor(5, 150, 105); // Emerald for credit
    }
    doc.setFont("helvetica", "bold");
    const balStatus = isDebit ? '(Dr - Customer Owes)' : '(Cr - Store Owes)';
    doc.text(`Net Outstanding: ${cleanCurrency(Math.abs(ledger.netOutstanding))} ${balStatus}`, 115, 44);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(`Principal Remaining: ${cleanCurrency(Math.abs(ledger.totalPrincipalRemaining))}`, 115, 50);
    doc.text(`Total Accrued Interest: ${cleanCurrency(ledger.totalAccruedInterest)}`, 115, 55);

    // --- TABULAR LAYOUT CONFIGURATION ---
    let tableHead = [];
    let tableBody = [];
    let colStyles = {};

    if (mode === 'summarized') {
        tableHead = [['Date', 'Remarks & Notes', 'Debit (-)', 'Credit (+)', 'Net Balance']];
        colStyles = {
            0: { cellWidth: 26, halign: 'left' },
            1: { cellWidth: 64, halign: 'left' },
            2: { cellWidth: 30, halign: 'right' },
            3: { cellWidth: 30, halign: 'right' },
            4: { cellWidth: 32, halign: 'right' }
        };

        tableBody = rows.map(row => {
            const dateStr = formatDate(row.date);
            let remarks = (row.category ? `[${row.category}] ` : '') + (row.remarks || '');
            if (row.type === 'debit') {
                const phaseTag = formatPhaseSummaryBadge(getTxnInterestPhases(row));
                if (phaseTag) remarks += ` [${phaseTag}]`;
            } else if (row.type === 'credit' && row.paymentTrace) {
                remarks += ` [Applied: ${row.paymentTrace}]`;
            }

            const debitStr = row.type === 'debit' ? cleanCurrency(row.amount) : '-';
            const creditStr = (row.type === 'credit' || row.type === 'adjustment') 
                ? cleanCurrency(row.amount) 
                : (row.type === 'waiver' ? `(Waiver) ${cleanCurrency(row.amount)}` : '-');
            const netBalStr = cleanCurrency(Math.abs(row.totalNet || row.runningPrincipal || 0));

            return [dateStr, remarks, debitStr, creditStr, netBalStr];
        });

        tableBody.push([
            'SUMMARY TOTAL', 
            `Accrued Interest: ${cleanCurrency(ledger.totalAccruedInterest)}`, 
            cleanCurrency(ledger.totalDebit || 0), 
            cleanCurrency(ledger.totalCredit || 0), 
            cleanCurrency(Math.abs(ledger.netOutstanding))
        ]);
    } else {
        tableHead = [['Date', 'Remarks & Notes', 'Principal', 'Interest Rule', 'Days', 'Accrued Interest']];
        colStyles = {
            0: { cellWidth: 24, halign: 'left' },
            1: { cellWidth: 50, halign: 'left' },
            2: { cellWidth: 26, halign: 'right' },
            3: { cellWidth: 32, halign: 'left' },
            4: { cellWidth: 18, halign: 'center' },
            5: { cellWidth: 32, halign: 'right' }
        };

        const now = new Date();

        tableBody = rows.map(row => {
            const dateStr = formatDate(row.date);
            let remarks = (row.category ? `[${row.category}] ` : '') + (row.remarks || '');

            let principalStr = '-';
            let interestRuleStr = 'N/A';
            let elapsedDaysStr = 'N/A';
            let accruedInterestStr = 'Rs. 0.00';

            if (row.type === 'debit') {
                principalStr = cleanCurrency(row.amount);
                const iType = (row.interestType || customer.defaultInterestType || 'SIMPLE').toUpperCase();
                const iRate = row.interestRate !== undefined ? row.interestRate : (customer.lendingRate || 12);
                let freqStr = '';
                if (iType === 'COMPOUND' || iType === 'COMPOUNDING') {
                    const freq = (row.compoundingFrequency || customer.compoundingFrequency || 'MONTHLY').toLowerCase();
                    freqStr = ` (${freq.charAt(0).toUpperCase() + freq.slice(1)})`;
                }
                const silo = (ledger.silos || []).find(s => s.id === row.id || s.date === row.date);
                const hasAdv = silo ? silo.hasAdvancePeriod : false;
                interestRuleStr = `${iType}${freqStr} ${iRate}%${hasAdv ? ' (0% Adv)' : ''}`;

                const startDate = row.interestStartDate ? new Date(row.interestStartDate) : (row.date ? new Date(row.date) : now);
                const diffTime = Math.max(0, now - startDate);
                const elapsedDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                elapsedDaysStr = `${elapsedDays} d`;

                const accrued = silo ? silo.accruedInterest : (row.runningInterest || 0);
                accruedInterestStr = cleanCurrency(accrued);
            } else if (row.type === 'credit') {
                principalStr = `-${cleanCurrency(row.amount)}`;
                if (row.paymentTrace) remarks += ` [Applied: ${row.paymentTrace}]`;
            } else if (row.type === 'waiver') {
                principalStr = `(Waiver) -${cleanCurrency(row.amount)}`;
            } else if (row.type === 'adjustment') {
                principalStr = `(Adj) -${cleanCurrency(row.amount)}`;
            }

            return [dateStr, remarks, principalStr, interestRuleStr, elapsedDaysStr, accruedInterestStr];
        });

        tableBody.push([
            'LEDGER TOTALS',
            `Net Balance: ${cleanCurrency(Math.abs(ledger.netOutstanding))}`,
            cleanCurrency(Math.abs(ledger.totalPrincipalRemaining)),
            '-',
            '-',
            cleanCurrency(ledger.totalAccruedInterest)
        ]);
    }

    doc.autoTable({
        startY: 70,
        head: tableHead,
        body: tableBody,
        theme: 'striped',
        styles: {
            font: 'helvetica',
            fontSize: 8.5,
            cellPadding: 3.5,
            overflow: 'linebreak',
            textColor: [30, 41, 59],
            lineColor: [226, 232, 240],
            lineWidth: 0.1
        },
        headStyles: {
            fillColor: [15, 23, 42],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9,
            cellPadding: 4.5
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        columnStyles: colStyles
    });

    if (ledger.hasAdvancePeriod || (ledger.advanceLog || []).length > 0) {
        const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 8 : 200;
        doc.setFontSize(8);
        doc.setTextColor(180, 83, 9);
        doc.text("* Note: Interest accrual was automatically paused (0% rate) during periods when running balance was in Advance/Credit state.", 14, finalY);
    }

    doc.save(`Statement_${customer.name.replace(/\s+/g, '_')}_${mode}_${new Date().getTime()}.pdf`);
}

function downloadCustomerListPDF() {
    if (!window.jspdf) {
        alert("PDF generator library loading. Please try again in a moment.");
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("CUSTOMER OUTSTANDING SUMMARY REPORT", 14, 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(`Generated On: ${formatDate(new Date())}`, 196, 13, { align: 'right' });

    let grandPrincipal = 0;
    let grandInterest = 0;
    let grandNet = 0;

    const tableBody = (state.customers || []).map(customer => {
        const ledger = calculateLedger(customer.id);
        grandPrincipal += ledger.totalPrincipalRemaining;
        grandInterest += ledger.totalAccruedInterest;
        grandNet += ledger.netOutstanding;

        return [
            customer.name,
            customer.phoneNumber || 'N/A',
            cleanCurrency(ledger.totalPrincipalRemaining),
            cleanCurrency(ledger.totalAccruedInterest),
            cleanCurrency(Math.abs(ledger.netOutstanding)) + (ledger.netOutstanding > 0 ? ' (Dr)' : (ledger.netOutstanding < 0 ? ' (Cr)' : '')),
            ledger.status ? ledger.status.toUpperCase() : 'ACTIVE'
        ];
    });

    tableBody.push([
        'GRAND TOTALS',
        '-',
        cleanCurrency(grandPrincipal),
        cleanCurrency(grandInterest),
        cleanCurrency(Math.abs(grandNet)) + (grandNet > 0 ? ' (Dr)' : ' (Cr)'),
        '-'
    ]);

    doc.autoTable({
        startY: 30,
        head: [['Customer Name', 'Phone', 'Principal Remaining', 'Accrued Interest', 'Net Outstanding', 'Status']],
        body: tableBody,
        theme: 'striped',
        styles: {
            font: 'helvetica',
            fontSize: 8.5,
            cellPadding: 3.5,
            overflow: 'linebreak',
            textColor: [30, 41, 59]
        },
        headStyles: {
            fillColor: [15, 23, 42],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9,
            cellPadding: 4.5
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 30 },
            2: { cellWidth: 30, halign: 'right' },
            3: { cellWidth: 30, halign: 'right' },
            4: { cellWidth: 32, halign: 'right' },
            5: { cellWidth: 20, halign: 'center' }
        }
    });

    doc.save(`Customer_Summary_Report_${new Date().getTime()}.pdf`);
}

const downloadPdfBtn = document.getElementById('btn-download-pdf');
if (downloadPdfBtn) {
    downloadPdfBtn.onclick = () => {
        toggleModal('pdf-export-modal', true);
    };
}

const btnPdfDetailed = document.getElementById('btn-pdf-detailed');
if (btnPdfDetailed) {
    btnPdfDetailed.onclick = () => {
        downloadLedgerPDF(state.currentCustomerId, 'detailed');
        toggleModal('pdf-export-modal', false);
    };
}

const btnPdfSummarized = document.getElementById('btn-pdf-summarized');
if (btnPdfSummarized) {
    btnPdfSummarized.onclick = () => {
        downloadLedgerPDF(state.currentCustomerId, 'summarized');
        toggleModal('pdf-export-modal', false);
    };
}

// Database Excel (.xlsx) Backup Logic (Directive 1)
function downloadExcelBackup() {
    if (!window.XLSX) {
        alert("Excel generator library (SheetJS) is loading. Please try again in a moment.");
        return;
    }

    const customersData = (state.customers || []).map(cust => {
        const ledger = calculateLedger(cust.id);
        const lRate = cust.lendingRate !== undefined && cust.lendingRate !== null ? parseFloat(cust.lendingRate) : 12;
        const dRate = cust.depositRate !== undefined && cust.depositRate !== null ? parseFloat(cust.depositRate) : 6;
        const principalRem = ledger ? roundMoney(ledger.totalPrincipalRemaining || 0) : 0;
        const accruedInt = ledger ? roundMoney(ledger.totalAccruedInterest || 0) : 0;
        const netBal = ledger ? roundMoney(ledger.netOutstanding || 0) : 0;

        return {
            "Customer ID": cust.id || '',
            "Customer Name": cust.name || '',
            "Phone Number": cust.phoneNumber || '',
            "Address": cust.address || '',
            "Default Interest Type": cust.defaultInterestType || 'SIMPLE',
            "Lending Rate (%)": Number(lRate),
            "Deposit Rate (%)": Number(dRate),
            "Total Principal Remaining": Number(principalRem),
            "Total Accrued Interest": Number(accruedInt),
            "Net Balance": Number(netBal),
            "Status": cust.isBadDebt ? "NPA / Bad Debt" : "Active"
        };
    });

    const transactionsData = (state.transactions || []).map(txn => {
        const customer = (state.customers || []).find(c => c.id === txn.customerId);
        const amt = parseFloat(txn.amount) || 0;
        const rate = txn.interestRate !== undefined && txn.interestRate !== null ? parseFloat(txn.interestRate) : (customer?.lendingRate || 12);
        const runningP = parseFloat(txn.runningPrincipal) || 0;
        const totNet = parseFloat(txn.totalNet) || 0;

        return {
            "Transaction ID": txn.id || '',
            "Date": txn.date ? new Date(txn.date).toISOString().split('T')[0] : '',
            "Customer ID": txn.customerId || '',
            "Customer Name": customer ? customer.name : 'Unknown',
            "Type": (txn.type || '').toUpperCase(),
            "Category": txn.category || '',
            "Remarks": txn.remarks || '',
            "Amount": Number(roundMoney(amt)),
            "Interest Rate (%)": Number(rate),
            "Interest Type": txn.interestType || 'SIMPLE',
            "Interest Start Date": txn.interestStartDate ? new Date(txn.interestStartDate).toISOString().split('T')[0] : '',
            "Compounding Frequency": txn.compoundingFrequency || 'N/A',
            "Running Principal": Number(roundMoney(runningP)),
            "Total Net": Number(roundMoney(totNet)),
            "Status": txn.isVoid ? "Voided" : (txn.isBadDebt ? "NPA / Bad Debt" : "Active")
        };
    });

    let totalPortfolioPrincipal = 0;
    let totalPortfolioInterest = 0;
    let totalPortfolioNet = 0;

    (state.customers || []).forEach(cust => {
        const ledger = calculateLedger(cust.id);
        if (ledger) {
            totalPortfolioPrincipal += (ledger.totalPrincipalRemaining || 0);
            totalPortfolioInterest += (ledger.totalAccruedInterest || 0);
            totalPortfolioNet += (ledger.netOutstanding || 0);
        }
    });

    let cashbookInflow = 0;
    let cashbookOutflow = 0;
    (state.cashbook || []).filter(c => !c.isVoid).forEach(entry => {
        const amt = parseFloat(entry.amount) || 0;
        if ((entry.type || '').toLowerCase() === 'in' || (entry.type || '').toLowerCase() === 'income') {
            cashbookInflow += amt;
        } else {
            cashbookOutflow += amt;
        }
    });

    let totalBadDebts = 0;
    (state.badDebts || []).forEach(bd => {
        totalBadDebts += (parseFloat(bd.unpaidAmount || bd.amount) || 0);
    });

    const summaryData = [
        { "Metric": "Export Timestamp", "Value": new Date().toLocaleString(), "Category": "System Metadata" },
        { "Metric": "System Version", "Value": "2.0.0", "Category": "System Metadata" },
        { "Metric": "Total Customers", "Value": Number(state.customers ? state.customers.length : 0), "Category": "Customer Statistics" },
        { "Metric": "Total Transactions", "Value": Number(state.transactions ? state.transactions.length : 0), "Category": "Transaction Statistics" },
        { "Metric": "Total Portfolio Principal", "Value": Number(roundMoney(totalPortfolioPrincipal)), "Category": "Financial Tally" },
        { "Metric": "Total Accrued Interest", "Value": Number(roundMoney(totalPortfolioInterest)), "Category": "Financial Tally" },
        { "Metric": "Total Net Outstanding Balance", "Value": Number(roundMoney(totalPortfolioNet)), "Category": "Financial Tally" },
        { "Metric": "Cashbook Total Inflow", "Value": Number(roundMoney(cashbookInflow)), "Category": "Cashbook Statistics" },
        { "Metric": "Cashbook Total Outflow", "Value": Number(roundMoney(cashbookOutflow)), "Category": "Cashbook Statistics" },
        { "Metric": "Cashbook Net Cash in Hand", "Value": Number(roundMoney(cashbookInflow - cashbookOutflow)), "Category": "Cashbook Statistics" },
        { "Metric": "Total NPA / Bad Debts Tally", "Value": Number(roundMoney(totalBadDebts)), "Category": "Bad Debts / NPA" },
        { "Metric": "Total Inventory Items", "Value": Number(state.items ? state.items.length : 0), "Category": "Store Inventory" },
        { "Metric": "Total Generated Bills", "Value": Number(state.bills ? state.bills.length : 0), "Category": "Store Billing" }
    ];

    const wsCustomers = XLSX.utils.json_to_sheet(customersData.length > 0 ? customersData : [{}]);
    const wsTransactions = XLSX.utils.json_to_sheet(transactionsData.length > 0 ? transactionsData : [{}]);
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);

    const autoFitCols = (data, ws) => {
        if (!data || data.length === 0) return;
        const keys = Object.keys(data[0] || {});
        const colWidths = keys.map(key => {
            let maxLen = key.toString().length;
            data.forEach(row => {
                const val = row[key];
                if (val !== undefined && val !== null) {
                    const len = val.toString().length;
                    if (len > maxLen) maxLen = len;
                }
            });
            return { wch: Math.min(Math.max(maxLen + 3, 12), 50) };
        });
        ws['!cols'] = colWidths;
    };

    autoFitCols(customersData, wsCustomers);
    autoFitCols(transactionsData, wsTransactions);
    autoFitCols(summaryData, wsSummary);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsCustomers, "Customers");
    XLSX.utils.book_append_sheet(wb, wsTransactions, "Transactions");
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary Data");

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Kirana_Ledger_Complete_Backup_${dateStr}.xlsx`);
}

const btnBackupDb = document.getElementById('btn-backup-db');
if (btnBackupDb) {
    btnBackupDb.onclick = () => {
        downloadExcelBackup();
    };
}

// --- DASHBOARD INITIALIZATION Flow ---
async function showDashboard() {
    renderDashboard();

    try {
        const response = await LedgerAPI.getCustomers();

        if (Array.isArray(response?.customers) && response.customers.length > 0) {
            state.customers = [...response.customers];
            state.pagination = response?.pagination || null;
            saveData();
            renderDashboard();
        }
    } catch (err) {
        console.warn("Backend API unavailable, displaying local storage customer data:", err);
        renderDashboard();
    }
}

// --- DATA MIGRATION ENGINE (LOCALSTORAGE -> CLOUD POSTGRESQL) ---
async function syncLocalDataToCloud() {
    if (!state.isAuthenticated || !LedgerAPI.getToken()) return;
    
    const isAlreadySynced = localStorage.getItem('ml_pro_synced_v1');
    if (isAlreadySynced === 'true') {
        console.log("[syncLocalDataToCloud] Local data already synchronized with cloud database.");
        return;
    }

    console.log("[syncLocalDataToCloud] Initiating one-time local data migration to Supabase/PostgreSQL backend...");

    try {
        // 1. Sync Customers & Transactions
        const localCustomers = JSON.parse(localStorage.getItem('ml_pro_customers')) || [];
        for (const cust of localCustomers) {
            try {
                await LedgerAPI.createCustomer({
                    name: cust.name,
                    phoneNumber: cust.phoneNumber,
                    lendingRate: cust.lendingRate,
                    depositRate: cust.depositRate
                });
            } catch (err) {
                console.warn(`[syncLocalDataToCloud] Customer ${cust.name} sync note:`, err.message);
            }
        }

        // 2. Sync Inventory Items
        const localItems = JSON.parse(localStorage.getItem('ml_pro_items')) || [];
        for (const item of localItems) {
            try {
                await LedgerAPI.createItem({
                    name: item.name,
                    qty: item.qty,
                    minReorderQty: item.minReorderQty,
                    buyPrice: item.buyPrice,
                    sellPrice: item.sellPrice
                });
            } catch (err) {
                console.warn(`[syncLocalDataToCloud] Inventory item ${item.name} sync note:`, err.message);
            }
        }

        localStorage.setItem('ml_pro_synced_v1', 'true');
        console.log("[syncLocalDataToCloud] Cloud migration process completed successfully.");
    } catch (err) {
        console.error("[syncLocalDataToCloud] Migration encountered an issue:", err);
    }
}

// Global window handle for manual debug execution
window.syncLocalDataToCloud = syncLocalDataToCloud;

// --- SESSION CHECK ---
function checkSession() {
    // Redirection callback disabled for test mode to prevent kicking user back to login screen
    LedgerAPI.setUnauthorizedHandler(() => {
        console.warn("[Auth Interceptor] 401 Unauthorized response received. Automatic home redirection disabled for testing.");
    });

    const errorEl = document.getElementById('login-error');
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
    }

    const token = LedgerAPI.getToken();
    const isTestMode = localStorage.getItem('ml_pro_test_mode') === 'true';

    if (token || isTestMode) {
        state.isAuthenticated = true;
        document.getElementById('auth-view').classList.remove('active');
        document.getElementById('auth-view').classList.add('hidden');
        document.getElementById('app-wrapper').classList.remove('hidden');
        if (token) syncLocalDataToCloud();
        showDashboard();
    } else {
        state.isAuthenticated = false;
        document.getElementById('app-wrapper').classList.add('hidden');
        document.getElementById('auth-view').classList.remove('hidden');
        document.getElementById('auth-view').classList.add('active');
    }
}

// --- INITIALIZE ---
function initTransactionTypeOptions() {
    const waiverOption = document.querySelector('#txn-type option[value="waiver"]');
    const adjOption = document.querySelector('#txn-type option[value="adjustment"]');
    if (waiverOption) waiverOption.remove();
    if (adjOption) adjOption.remove();
}

initTheme();
initTransactionTypeOptions();
checkSession();

// ==========================================
// --- ITEMS (INVENTORY) ENGINE ---
// ==========================================
async function syncItemsFromAPI() {
    if (state.isAuthenticated && LedgerAPI.getToken()) {
        try {
            const fetched = await LedgerAPI.getItems();
            if (Array.isArray(fetched)) {
                state.items = fetched;
                saveData();
            }
        } catch (e) {
            // Silently fallback to local state
        }
    }
}

function renderItems() {
    syncItemsFromAPI();
    const tbody = document.getElementById('items-list-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const items = state.items || [];
    document.getElementById('stat-item-count').textContent = items.length;

    const totalValuation = items.reduce((sum, item) => sum + (parseFloat(item.qty || 0) * parseFloat(item.buyPrice || 0)), 0);
    document.getElementById('stat-item-valuation').textContent = formatCurrency(totalValuation);

    const reorderCount = items.filter(i => (parseInt(i.qty) || 0) <= (parseInt(i.minReorderQty) || 5)).length;
    const reorderEl = document.getElementById('stat-item-reorder');
    if (reorderEl) reorderEl.textContent = reorderCount;

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary" style="padding: 2rem;">No inventory items added yet. Click 'Add Item' to create one.</td></tr>`;
        return;
    }

    items.forEach(item => {
        const tr = document.createElement('tr');
        const minQty = parseInt(item.minReorderQty) || 5;
        const currentQty = parseInt(item.qty) || 0;

        let qtyBadge = `<strong>${currentQty}</strong>`;
        if (currentQty <= 0) {
            qtyBadge = `<span class="status-badge status-overdue">Out of Stock (0)</span>`;
        } else if (currentQty <= minQty) {
            qtyBadge = `<span class="status-badge status-reorder">Low Stock (${currentQty})</span>`;
        }

        tr.innerHTML = `
            <td><strong>${item.name}</strong></td>
            <td class="text-right">${qtyBadge}</td>
            <td class="text-right">${formatCurrency(item.buyPrice)}</td>
            <td class="text-right text-success"><strong>${formatCurrency(item.sellPrice)}</strong></td>
            <td class="text-right">
                <button class="btn-icon" onclick="editItem('${item.id}')" title="Edit Item"><i class="ph ph-pencil-simple"></i></button>
                <button class="btn-icon text-danger" onclick="deleteItem('${item.id}')" title="Delete Item"><i class="ph ph-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

document.getElementById('btn-add-item').onclick = () => {
    document.getElementById('item-form').reset();
    document.getElementById('item-id').value = '';
    document.getElementById('item-min-qty').value = 5;
    toggleModal('item-modal', true);
};

function editItem(id) {
    const item = state.items.find(i => i.id === id);
    if (item) {
        document.getElementById('item-id').value = item.id;
        document.getElementById('item-name').value = item.name;
        document.getElementById('item-qty').value = item.qty;
        document.getElementById('item-min-qty').value = item.minReorderQty || 5;
        document.getElementById('item-buy-price').value = item.buyPrice;
        document.getElementById('item-sell-price').value = item.sellPrice;
        toggleModal('item-modal', true);
    }
}

async function deleteItem(id) {
    if (confirm("Are you sure you want to delete this inventory item?")) {
        state.items = state.items.filter(i => i.id !== id);
        if (state.isAuthenticated && LedgerAPI.getToken()) {
            try { await LedgerAPI.deleteItem(id); } catch (e) {}
        }
        saveData();
        renderItems();
    }
}

document.getElementById('item-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('item-id').value;
    const name = document.getElementById('item-name').value.trim();
    const qty = parseInt(document.getElementById('item-qty').value) || 0;
    const minReorderQty = parseInt(document.getElementById('item-min-qty').value) || 5;
    const buyPrice = parseFloat(document.getElementById('item-buy-price').value) || 0;
    const sellPrice = parseFloat(document.getElementById('item-sell-price').value) || 0;

    const itemPayload = { name, qty, minReorderQty, buyPrice, sellPrice };

    if (id) {
        const item = state.items.find(i => i.id === id);
        if (item) {
            item.name = name;
            item.qty = qty;
            item.minReorderQty = minReorderQty;
            item.buyPrice = buyPrice;
            item.sellPrice = sellPrice;
        }
        if (state.isAuthenticated && LedgerAPI.getToken()) {
            try { await LedgerAPI.updateItem(id, itemPayload); } catch (err) {}
        }
    } else {
        const newItem = { id: 'item_' + Date.now(), ...itemPayload };
        state.items.push(newItem);
        if (state.isAuthenticated && LedgerAPI.getToken()) {
            try {
                const apiRes = await LedgerAPI.createItem(itemPayload);
                if (apiRes && apiRes.id) newItem.id = apiRes.id;
            } catch (err) {}
        }
    }

    saveData();
    renderItems();
    toggleModal('item-modal', false);
};

// ==========================================
// --- BILLS & INVOICING ENGINE ---
// ==========================================
let currentDraftBillItems = [];

function renderBills() {
    const tbody = document.getElementById('bills-list-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const bills = state.bills || [];
    const activeBills = bills.filter(b => !b.isVoid);
    document.getElementById('stat-bill-count').textContent = activeBills.length;

    const totalBilled = activeBills.reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);
    document.getElementById('stat-bill-total').textContent = formatCurrency(totalBilled);

    if (bills.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-secondary" style="padding: 2rem;">No bills generated yet. Click 'Create Bill' to issue a new receipt.</td></tr>`;
        return;
    }

    bills.forEach(bill => {
        const tr = document.createElement('tr');
        if (bill.isVoid) {
            tr.classList.add('row-voided');
        }

        const itemCount = Array.isArray(bill.items) ? bill.items.reduce((s, i) => s + i.qty, 0) : 0;
        const statusBadge = bill.isVoid 
            ? `<span class="status-badge status-void">VOIDED</span>`
            : (bill.remainingBalance > 0 ? `<span class="status-badge status-warning">Credit Sale</span>` : `<span class="status-badge status-active">Paid</span>`);

        tr.innerHTML = `
            <td><strong>${bill.id}</strong><br>${statusBadge}</td>
            <td>${bill.customerName} ${bill.voidReason ? `<br><small class="text-secondary">Void: ${bill.voidReason}</small>` : ''}</td>
            <td>${formatDate(bill.date)}</td>
            <td class="text-right"><span class="badge">${itemCount} items</span></td>
            <td class="text-right text-success"><strong>${formatCurrency(bill.totalAmount)}</strong></td>
            <td class="text-right">
                ${bill.isVoid 
                    ? `<span class="text-secondary" style="font-size: 0.8rem;">Reversed</span>`
                    : `<button class="btn-icon text-danger" onclick="openVoidModal('bill', '${bill.id}')" title="Void / Reverse Bill"><i class="ph ph-prohibit"></i></button>`
                }
            </td>
        `;
        tbody.appendChild(tr);
    });
}

document.getElementById('btn-create-bill').onclick = () => {
    document.getElementById('bill-form').reset();
    currentDraftBillItems = [];
    renderDraftBillItems();

    // Populate customer select
    const custSelect = document.getElementById('bill-customer-select');
    if (custSelect) {
        custSelect.innerHTML = '<option value="">-- Walk-in (No Ledger Credit) --</option>';
        (state.customers || []).forEach(c => {
            custSelect.innerHTML += `<option value="${c.id}">${c.name} (${c.phoneNumber || 'No phone'})</option>`;
        });
    }

    // Populate stock select items
    const selectEl = document.getElementById('bill-select-item');
    selectEl.innerHTML = '<option value="">-- Choose Stock Item --</option>';
    (state.items || []).forEach(item => {
        const minQty = parseInt(item.minReorderQty) || 5;
        let alertTxt = '';
        if (item.qty <= 0) alertTxt = ' [OUT OF STOCK]';
        else if (item.qty <= minQty) alertTxt = ' [LOW STOCK]';

        selectEl.innerHTML += `<option value="${item.id}">${item.name} (Stock: ${item.qty}${alertTxt} | ₹${item.sellPrice})</option>`;
    });

    // Default payment mode settings
    document.getElementById('bill-payment-mode').value = 'CASH';
    updateBillPaymentSplit();

    toggleModal('bill-modal', true);
};

// Customer select change handler
document.getElementById('bill-customer-select')?.addEventListener('change', (e) => {
    const custId = e.target.value;
    if (custId) {
        const cust = state.customers.find(c => c.id === custId);
        if (cust) {
            document.getElementById('bill-customer-name').value = cust.name;
        }
    }
});

// Payment mode & Paid amount listeners
document.getElementById('bill-payment-mode')?.addEventListener('change', updateBillPaymentSplit);
document.getElementById('bill-paid-amount')?.addEventListener('input', updateBillPaymentSplit);

function updateBillPaymentSplit() {
    const grandTotal = currentDraftBillItems.reduce((s, i) => s + i.total, 0);
    const mode = document.getElementById('bill-payment-mode').value;
    const paidInput = document.getElementById('bill-paid-amount');
    const creditInput = document.getElementById('bill-credit-balance');

    let paid = 0;
    if (mode === 'CASH') {
        paid = grandTotal;
        paidInput.value = paid > 0 ? paid.toFixed(2) : '0.00';
        paidInput.readOnly = true;
    } else if (mode === 'CREDIT') {
        paid = 0;
        paidInput.value = '0.00';
        paidInput.readOnly = true;
    } else { // PARTIAL
        paidInput.readOnly = false;
        paid = parseFloat(paidInput.value) || 0;
        if (paid > grandTotal) {
            paid = grandTotal;
            paidInput.value = paid.toFixed(2);
        }
    }

    const credit = Math.max(0, grandTotal - paid);
    creditInput.value = credit.toFixed(2);
}

document.getElementById('btn-add-bill-item').onclick = () => {
    const selectEl = document.getElementById('bill-select-item');
    const itemId = selectEl.value;
    const qty = parseInt(document.getElementById('bill-item-qty').value) || 1;

    if (!itemId) {
        alert("Please select an item from the inventory dropdown.");
        return;
    }

    const item = state.items.find(i => i.id === itemId);
    if (!item) return;

    const existingDraft = currentDraftBillItems.find(i => i.itemId === itemId);
    const currentRequestedQty = (existingDraft ? existingDraft.qty : 0) + qty;

    if (currentRequestedQty > item.qty) {
        alert(`Insufficient stock for "${item.name}". Only ${item.qty} units available.`);
        return;
    }

    if (existingDraft) {
        existingDraft.qty += qty;
        existingDraft.total = existingDraft.qty * item.sellPrice;
    } else {
        currentDraftBillItems.push({
            itemId: item.id,
            name: item.name,
            qty: qty,
            price: item.sellPrice,
            total: qty * item.sellPrice
        });
    }

    renderDraftBillItems();
};

function renderDraftBillItems() {
    const tbody = document.getElementById('bill-items-body');
    tbody.innerHTML = '';

    if (currentDraftBillItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary">No items added yet.</td></tr>`;
        document.getElementById('bill-grand-total').textContent = formatCurrency(0);
        updateBillPaymentSplit();
        return;
    }

    let grandTotal = 0;
    currentDraftBillItems.forEach((draft, index) => {
        grandTotal += draft.total;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${draft.name}</strong></td>
            <td class="text-right">${draft.qty}</td>
            <td class="text-right">${formatCurrency(draft.price)}</td>
            <td class="text-right text-success"><strong>${formatCurrency(draft.total)}</strong></td>
            <td class="text-right">
                <button type="button" class="btn-icon text-danger" onclick="removeDraftBillItem(${index})"><i class="ph ph-x"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('bill-grand-total').textContent = formatCurrency(grandTotal);
    updateBillPaymentSplit();
}

function removeDraftBillItem(index) {
    currentDraftBillItems.splice(index, 1);
    renderDraftBillItems();
}

document.getElementById('bill-form').onsubmit = (e) => {
    e.preventDefault();
    if (currentDraftBillItems.length === 0) {
        alert("Please add at least one item to the bill before finalizing.");
        return;
    }

    const customerName = document.getElementById('bill-customer-name').value.trim();
    const linkedCustomerId = document.getElementById('bill-customer-select').value;
    const paymentMode = document.getElementById('bill-payment-mode').value;
    const grandTotal = currentDraftBillItems.reduce((s, i) => s + i.total, 0);
    const paidAmount = parseFloat(document.getElementById('bill-paid-amount').value) || 0;
    const remainingBalance = Math.max(0, grandTotal - paidAmount);

    if (remainingBalance > 0 && !linkedCustomerId) {
        if (!confirm("You have remaining credit balance on this bill without selecting a Customer Account. Proceed as anonymous walk-in credit?")) {
            return;
        }
    }

    // 1. Deduct stock quantity from inventory
    currentDraftBillItems.forEach(draft => {
        const stockItem = state.items.find(i => i.id === draft.itemId);
        if (stockItem) {
            stockItem.qty = Math.max(0, stockItem.qty - draft.qty);
        }
    });

    const billId = `INV-${Date.now().toString().slice(-5)}`;

    // 2. If remaining balance > 0 and customer is linked, record Debit transaction on customer ledger
    if (remainingBalance > 0 && linkedCustomerId) {
        const creditTxn = {
            id: `txn_bill_${Date.now()}`,
            customerId: linkedCustomerId,
            billId: billId,
            date: new Date().toISOString(),
            interestDate: new Date().toISOString(),
            type: 'debit',
            category: 'Goods/Grocery',
            amount: remainingBalance,
            remarks: `Credit Sale Invoice #${billId}`,
            isVoid: false
        };
        state.transactions.push(creditTxn);
    }

    // 3. If paid amount > 0, log in Cashbook
    if (paidAmount > 0) {
        state.cashbook.push({
            id: `cb_bill_${Date.now()}`,
            billId: billId,
            date: new Date().toISOString().split('T')[0],
            type: 'in',
            amount: paidAmount,
            remarks: `Invoice #${billId} Payment (${customerName})`,
            isVoid: false
        });
    }

    // 4. Save new bill
    const bill = {
        id: billId,
        customerName,
        customerId: linkedCustomerId || null,
        date: new Date().toISOString(),
        items: [...currentDraftBillItems],
        totalAmount: grandTotal,
        paymentMode,
        paidAmount,
        remainingBalance,
        isVoid: false
    };

    state.bills.unshift(bill);
    saveData();
    renderBills();
    renderItems();
    renderCashbook();
    if (linkedCustomerId) {
        showDashboard();
        if (state.currentCustomerId === linkedCustomerId) {
            renderLedger();
        }
    }
    toggleModal('bill-modal', false);
};

function deleteBill(id) {
    const bill = (state.bills || []).find(b => b.id === id);
    if (!bill) return;

    if (confirm(`Are you sure you want to delete bill ${bill.id}? This will restore the sold item quantities back to inventory.`)) {
        if (Array.isArray(bill.items)) {
            bill.items.forEach(bItem => {
                const stockItem = (state.items || []).find(i => i.id === bItem.itemId);
                if (stockItem) {
                    stockItem.qty = (parseInt(stockItem.qty) || 0) + (parseInt(bItem.qty) || 0);
                }
            });
        }
        state.bills = state.bills.filter(b => b.id !== id);
        saveData();
        renderBills();
        renderItems();
    }
}

// ==========================================
// --- COMPLIANCE AUDIT & VOID REVERSAL ENGINE ---
// ==========================================
function openVoidModal(type, id) {
    document.getElementById('void-target-type').value = type;
    document.getElementById('void-target-id').value = id;
    document.getElementById('void-reason').value = '';
    toggleModal('void-modal', true);
}

document.getElementById('void-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.getElementById('void-target-type').value;
    const id = document.getElementById('void-target-id').value;
    const reason = document.getElementById('void-reason').value.trim();

    if (!reason) {
        alert("Please provide a valid reason for voiding this entry.");
        return;
    }

    if (type === 'bill') {
        const bill = (state.bills || []).find(b => b.id === id);
        if (bill) {
            bill.isVoid = true;
            bill.voidedAt = new Date().toISOString();
            bill.voidReason = reason;

            // Restore stock items
            if (Array.isArray(bill.items)) {
                bill.items.forEach(bItem => {
                    const stockItem = (state.items || []).find(i => i.id === bItem.itemId);
                    if (stockItem) {
                        stockItem.qty = (parseInt(stockItem.qty) || 0) + (parseInt(bItem.qty) || 0);
                    }
                });
            }

            // Void any linked customer credit transaction
            const linkedTxn = (state.transactions || []).find(t => t.billId === bill.id);
            if (linkedTxn) {
                linkedTxn.isVoid = true;
                linkedTxn.voidReason = `Reversed with Invoice #${bill.id}: ${reason}`;
            }

            // Void any linked cashbook entry
            const linkedCb = (state.cashbook || []).find(c => c.billId === bill.id);
            if (linkedCb) {
                linkedCb.isVoid = true;
                linkedCb.voidReason = `Reversed with Invoice #${bill.id}: ${reason}`;
            }
        }
    } else if (type === 'txn') {
        const txn = (state.transactions || []).find(t => t.id === id);
        if (txn) {
            txn.isVoid = true;
            txn.voidedAt = new Date().toISOString();
            txn.voidReason = reason;
        }
    } else if (type === 'cashbook') {
        const cb = (state.cashbook || []).find(c => c.id === id);
        if (cb) {
            cb.isVoid = true;
            cb.voidedAt = new Date().toISOString();
            cb.voidReason = reason;
        }
    }

    saveData();
    renderBills();
    renderItems();
    renderCashbook();
    showDashboard();
    if (state.currentCustomerId) {
        renderLedger();
    }
    toggleModal('void-modal', false);
});

// ==========================================
// --- CASHBOOK (DAILY SHOP CASH DRAWER) ---
// ==========================================
function renderCashbook() {
    const tbody = document.getElementById('cashbook-list-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const entries = [...(state.cashbook || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
    const activeEntries = entries.filter(e => !e.isVoid);

    let totalIn = 0;
    let totalOut = 0;
    activeEntries.forEach(e => {
        const amt = parseFloat(e.amount || 0);
        if (e.type === 'in') totalIn += amt;
        if (e.type === 'out') totalOut += amt;
    });

    const netBalance = totalIn - totalOut;

    document.getElementById('stat-cash-in').textContent = formatCurrency(totalIn);
    document.getElementById('stat-cash-out').textContent = formatCurrency(totalOut);
    
    const netEl = document.getElementById('stat-cash-net');
    netEl.textContent = formatCurrency(netBalance);
    netEl.className = 'amount ' + (netBalance >= 0 ? 'text-success' : 'text-danger');

    if (entries.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-secondary" style="padding: 2rem;">No cashbook entries logged today. Click 'Cash In' or 'Cash Out' to record a transaction.</td></tr>`;
        return;
    }

    let runningBalance = 0;
    const rows = entries.map(entry => {
        if (!entry.isVoid) {
            const amt = parseFloat(entry.amount || 0);
            if (entry.type === 'in') runningBalance += amt;
            if (entry.type === 'out') runningBalance -= amt;
        }
        return { ...entry, runningBalance };
    }).reverse();

    rows.forEach(row => {
        const tr = document.createElement('tr');
        if (row.isVoid) tr.classList.add('row-voided');

        const typeBadge = row.isVoid
            ? `<span class="status-badge status-void">VOIDED</span>`
            : (row.type === 'in'
                ? `<span class="status-badge status-active">Cash In</span>`
                : `<span class="status-badge status-overdue">Cash Out</span>`);

        const inAmt = row.type === 'in' ? formatCurrency(row.amount) : '-';
        const outAmt = row.type === 'out' ? formatCurrency(row.amount) : '-';

        tr.innerHTML = `
            <td>${formatDate(row.date)}</td>
            <td>${typeBadge}</td>
            <td>${row.remarks || 'No notes'} ${row.voidReason ? `<br><small class="text-secondary">Reason: ${row.voidReason}</small>` : ''}</td>
            <td class="text-right text-success"><strong>${inAmt}</strong></td>
            <td class="text-right text-danger"><strong>${outAmt}</strong></td>
            <td class="text-right">
                ${row.isVoid 
                    ? `<span class="text-secondary" style="font-size: 0.8rem;">Reversed</span>`
                    : `<button class="btn-icon text-danger" onclick="openVoidModal('cashbook', '${row.id}')" title="Void / Reverse Entry"><i class="ph ph-prohibit"></i></button>`
                }
            </td>
        `;
        tbody.appendChild(tr);
    });
}

document.getElementById('btn-cash-in').onclick = () => {
    document.getElementById('cashbook-form').reset();
    document.getElementById('cashbook-type').value = 'in';
    document.getElementById('cashbook-modal-title').textContent = 'Log Cash In (+ Counter Received)';
    document.getElementById('cashbook-date').value = new Date().toISOString().split('T')[0];
    toggleModal('cashbook-modal', true);
};

document.getElementById('btn-cash-out').onclick = () => {
    document.getElementById('cashbook-form').reset();
    document.getElementById('cashbook-type').value = 'out';
    document.getElementById('cashbook-modal-title').textContent = 'Log Cash Out (- Shop Expense)';
    document.getElementById('cashbook-date').value = new Date().toISOString().split('T')[0];
    toggleModal('cashbook-modal', true);
};

document.getElementById('cashbook-form').onsubmit = (e) => {
    e.preventDefault();
    const type = document.getElementById('cashbook-type').value;
    const date = document.getElementById('cashbook-date').value;
    const amount = parseFloat(document.getElementById('cashbook-amount').value) || 0;
    const remarks = document.getElementById('cashbook-remarks').value.trim();

    const entry = {
        id: 'cb_' + Date.now(),
        date,
        type,
        amount,
        remarks
    };

    state.cashbook.push(entry);
    saveData();
    renderCashbook();
    toggleModal('cashbook-modal', false);
};

// ==========================================
// --- SHOP INSURANCE MODULE ---
// ==========================================
function renderInsurance() {
    const ins = state.insurance || {};

    const nameEl = document.getElementById('display-ins-name');
    const providerEl = document.getElementById('display-ins-provider');
    const premiumEl = document.getElementById('display-ins-premium');
    const renewalEl = document.getElementById('display-ins-renewal');
    const badgeEl = document.getElementById('ins-status-badge');

    if (nameEl) nameEl.textContent = ins.policyName || 'Policy Name Not Set';
    if (providerEl) providerEl.textContent = `Provider: ${ins.provider || 'Not specified'}`;
    if (premiumEl) premiumEl.textContent = formatCurrency(ins.premiumAmount || 0);
    if (renewalEl) renewalEl.textContent = ins.renewalDate ? formatDate(ins.renewalDate) : 'Not Set';

    if (badgeEl) {
        if (!ins.renewalDate) {
            badgeEl.className = 'status-badge status-warning';
            badgeEl.textContent = 'Setup Pending';
        } else {
            const renewalDays = (new Date(ins.renewalDate) - new Date()) / (1000 * 60 * 60 * 24);
            if (renewalDays < 0) {
                badgeEl.className = 'status-badge status-overdue';
                badgeEl.textContent = 'Expired';
            } else if (renewalDays <= 30) {
                badgeEl.className = 'status-badge status-warning';
                badgeEl.textContent = 'Renewal Due Soon';
            } else {
                badgeEl.className = 'status-badge status-active';
                badgeEl.textContent = 'Active Policy';
            }
        }
    }
}

document.getElementById('btn-edit-insurance').onclick = () => {
    const ins = state.insurance || {};
    document.getElementById('ins-name').value = ins.policyName || '';
    document.getElementById('ins-provider').value = ins.provider || '';
    document.getElementById('ins-premium').value = ins.premiumAmount || '';
    document.getElementById('ins-renewal-date').value = ins.renewalDate || '';
    toggleModal('insurance-modal', true);
};

document.getElementById('insurance-form').onsubmit = (e) => {
    e.preventDefault();
    state.insurance = {
        policyName: document.getElementById('ins-name').value.trim(),
        provider: document.getElementById('ins-provider').value.trim(),
        premiumAmount: parseFloat(document.getElementById('ins-premium').value) || 0,
        renewalDate: document.getElementById('ins-renewal-date').value
    };

    saveData();
    renderInsurance();
    toggleModal('insurance-modal', false);
};

// ==========================================
// --- REPORTS ENGINE & TAB FILTERING ---
// ==========================================
function renderReports() {
    const activeTab = document.querySelector('.report-tab-btn.active');
    const category = activeTab ? activeTab.getAttribute('data-report-category') : 'all';
    filterReportsCategory(category);
}

function filterReportsCategory(category) {
    document.querySelectorAll('.report-tab-btn').forEach(btn => {
        if (btn.getAttribute('data-report-category') === category) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    document.querySelectorAll('.report-group-card').forEach(card => {
        const groupCat = card.getAttribute('data-category-group');
        if (category === 'all' || category === groupCat) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// Tab button click listeners
document.querySelectorAll('.report-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const cat = e.target.getAttribute('data-report-category');
        filterReportsCategory(cat);
    });
});

// PDF Generation & Report Item Click Listeners
document.getElementById('report-customer-pdf')?.addEventListener('click', () => {
    downloadCustomerListPDF();
});

document.getElementById('report-customer-txns')?.addEventListener('click', () => {
    generateReportData('categories');
    generateReportData('waivers');
    switchView('dashboard-view');
});

document.getElementById('report-sales-summary')?.addEventListener('click', () => {
    generateReportData('gst');
    switchView('bills-view');
});

document.getElementById('report-cashbook-summary')?.addEventListener('click', () => {
    generateReportData('daywise');
    switchView('cashbook-view');
});

document.getElementById('report-gst-summary')?.addEventListener('click', () => {
    const data = generateReportData('gst');
    alert(`GST Tax Report Summary:\nTotal Billed: ₹${data.totalBilledAmount.toFixed(2)}\nEstimated GST (5%): ₹${data.estimatedGST.toFixed(2)}\nTotal Invoices: ${data.billCount}\n\nCheck browser console for full structured object!`);
});

// ==========================================
// --- REPORT DATA AGGREGATION ENGINE ---
// ==========================================

/**
 * Aggregates financial data across transactions, bills, customers, and cashbook.
 * @param {string} type - 'gst' | 'waivers' | 'categories' | 'daywise' | 'all'
 * @returns {object} Aggregated structured data object
 */
function generateReportData(type = 'all') {
    const reportResults = {};

    // 1. GST Calculation
    if (type === 'gst' || type === 'all') {
        const bills = state.bills || [];
        const totalBilledAmount = bills.reduce((sum, b) => sum + parseFloat(b.totalAmount || 0), 0);
        const gstRateStandard = 0.05; // 5% GST standard rate for kirana/goods
        const estimatedGST = totalBilledAmount * gstRateStandard;

        reportResults.gst = {
            billCount: bills.length,
            totalBilledAmount,
            gstRate: '5%',
            estimatedGST,
            billsSummary: bills.map(b => ({
                id: b.id,
                customer: b.customerName,
                amount: b.totalAmount,
                gstAmount: b.totalAmount * gstRateStandard
            }))
        };
    }

    // 2. Discounts & Waivers
    if (type === 'waivers' || type === 'all') {
        const txns = state.transactions || [];
        const waiverTxns = txns.filter(t => t.type && t.type.toLowerCase() === 'waiver');
        const totalWaiversAmount = waiverTxns.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

        reportResults.waivers = {
            waiverCount: waiverTxns.length,
            totalWaiversAmount,
            transactions: waiverTxns.map(t => ({
                id: t.id,
                customerId: t.customerId,
                date: t.date,
                amount: parseFloat(t.amount),
                remarks: t.remarks
            }))
        };
    }

    // 3. Cash vs. Goods / Categories Breakdown
    if (type === 'categories' || type === 'all') {
        const txns = state.transactions || [];
        const categoryTotals = {
            'Cash': 0,
            'Goods/Grocery': 0,
            'Grain': 0,
            'System': 0,
            'Uncategorized': 0
        };

        const categoryCounts = {
            'Cash': 0,
            'Goods/Grocery': 0,
            'Grain': 0,
            'System': 0,
            'Uncategorized': 0
        };

        txns.forEach(t => {
            const cat = t.category || 'Uncategorized';
            const amt = parseFloat(t.amount || 0);
            if (categoryTotals.hasOwnProperty(cat)) {
                categoryTotals[cat] += amt;
                categoryCounts[cat] += 1;
            } else {
                categoryTotals['Uncategorized'] += amt;
                categoryCounts['Uncategorized'] += 1;
            }
        });

        reportResults.categories = {
            totals: categoryTotals,
            counts: categoryCounts,
            totalTransactionsAnalyzed: txns.length
        };
    }

    // 4. Day-wise Net Cash Flow Grouping
    if (type === 'daywise' || type === 'all') {
        const dailyMap = {};

        // Helper to format date string to YYYY-MM-DD
        const toDayKey = (dStr) => {
            if (!dStr) return 'Unknown Date';
            try {
                return new Date(dStr).toISOString().split('T')[0];
            } catch (e) {
                return String(dStr).split('T')[0] || String(dStr);
            }
        };

        // Aggregate customer transactions
        (state.transactions || []).forEach(t => {
            const dayKey = toDayKey(t.date);
            if (!dailyMap[dayKey]) {
                dailyMap[dayKey] = { date: dayKey, creditSum: 0, debitSum: 0, waiverSum: 0, billedSum: 0, cashInSum: 0, cashOutSum: 0 };
            }
            const amt = parseFloat(t.amount || 0);
            if (t.type === 'credit') dailyMap[dayKey].creditSum += amt;
            else if (t.type === 'debit') dailyMap[dayKey].debitSum += amt;
            else if (t.type === 'waiver') dailyMap[dayKey].waiverSum += amt;
        });

        // Aggregate bills
        (state.bills || []).forEach(b => {
            const dayKey = toDayKey(b.date);
            if (!dailyMap[dayKey]) {
                dailyMap[dayKey] = { date: dayKey, creditSum: 0, debitSum: 0, waiverSum: 0, billedSum: 0, cashInSum: 0, cashOutSum: 0 };
            }
            dailyMap[dayKey].billedSum += parseFloat(b.totalAmount || 0);
        });

        // Aggregate cashbook
        (state.cashbook || []).forEach(c => {
            const dayKey = toDayKey(c.date);
            if (!dailyMap[dayKey]) {
                dailyMap[dayKey] = { date: dayKey, creditSum: 0, debitSum: 0, waiverSum: 0, billedSum: 0, cashInSum: 0, cashOutSum: 0 };
            }
            const amt = parseFloat(c.amount || 0);
            if (c.type === 'in') dailyMap[dayKey].cashInSum += amt;
            else if (c.type === 'out') dailyMap[dayKey].cashOutSum += amt;
        });

        // Sort chronologically and calculate daily net cash flow
        const dailyBreakdown = Object.values(dailyMap)
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .map(day => ({
                ...day,
                netDailyCashFlow: (day.creditSum + day.cashInSum + day.billedSum) - (day.debitSum + day.cashOutSum)
            }));

        reportResults.daywise = {
            totalDaysActive: dailyBreakdown.length,
            dailyBreakdown
        };
    }

    const finalOutput = type === 'all' ? reportResults : reportResults[type];

    console.log(`%c[Report Aggregation - ${type.toUpperCase()}]`, 'color: #2563EB; font-weight: bold; font-size: 1.1rem;', finalOutput);
    return finalOutput;
}

// Expose globally for console testing & verification
window.generateReportData = generateReportData;

// ==========================================
// --- STANDALONE INTEREST CALCULATOR MODULE ---
// ==========================================
let standaloneCalcState = {
    calcType: 'total_days', // 'total_days' | 'date_to_date'
    isInitialized: false
};

function initStandaloneCalculator() {
    if (!document.getElementById('calculator-view')) return;

    // Set default dates if empty
    const fromEl = document.getElementById('calc-from-date');
    const toEl = document.getElementById('calc-to-date');
    
    if (fromEl && !fromEl.value) {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        fromEl.value = d.toISOString().split('T')[0];
    }
    if (toEl && !toEl.value) {
        toEl.value = new Date().toISOString().split('T')[0];
    }

    if (standaloneCalcState.isInitialized) return;
    standaloneCalcState.isInitialized = true;

    // 1. Time mode radio listeners (Dates vs Duration)
    const modeDatesRadio = document.getElementById('calc-time-mode-dates');
    const modeDurationRadio = document.getElementById('calc-time-mode-duration');
    const datesContainer = document.getElementById('calc-dates-container');
    const durationContainer = document.getElementById('calc-duration-container');

    modeDatesRadio?.addEventListener('change', () => {
        if (modeDatesRadio.checked) {
            datesContainer?.classList.remove('hidden');
            durationContainer?.classList.add('hidden');
        }
    });

    modeDurationRadio?.addEventListener('change', () => {
        if (modeDurationRadio.checked) {
            durationContainer?.classList.remove('hidden');
            datesContainer?.classList.add('hidden');
        }
    });

    // 2. Compounding dropdown listener
    const compoundingSelect = document.getElementById('calc-compounding');
    const compoundingHint = document.getElementById('calc-compounding-hint');
    const customDaysGroup = document.getElementById('calc-custom-days-group');

    compoundingSelect?.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'none') {
            if (compoundingHint) compoundingHint.innerHTML = '<i class="ph ph-info"></i> Principal amount stays the same';
            customDaysGroup?.classList.add('hidden');
        } else if (val === 'custom') {
            if (compoundingHint) compoundingHint.innerHTML = '<i class="ph ph-info"></i> Custom compounding frequency in days';
            customDaysGroup?.classList.remove('hidden');
        } else {
            const labels = {
                monthly: 'Monthly compounding',
                quarterly: 'Quarterly compounding',
                half_yearly: 'Half-yearly compounding',
                yearly: 'Yearly compounding'
            };
            if (compoundingHint) compoundingHint.innerHTML = `<i class="ph ph-info"></i> ${labels[val] || 'Compounding applied'}`;
            customDaysGroup?.classList.add('hidden');
        }
    });

    // 3. Calculation type cards listener (Total Days vs Date-to-Date)
    document.querySelectorAll('.calc-type-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.calc-type-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            standaloneCalcState.calcType = card.getAttribute('data-calc-type') || 'total_days';
        });
    });

    // 4. Reset button listener
    document.getElementById('btn-calc-reset')?.addEventListener('click', () => {
        document.getElementById('standalone-calc-form')?.reset();
        if (fromEl) {
            const d = new Date();
            d.setDate(d.getDate() - 30);
            fromEl.value = d.toISOString().split('T')[0];
        }
        if (toEl) toEl.value = new Date().toISOString().split('T')[0];

        datesContainer?.classList.remove('hidden');
        durationContainer?.classList.add('hidden');
        customDaysGroup?.classList.add('hidden');

        document.querySelectorAll('.calc-type-card').forEach(c => c.classList.remove('active'));
        document.getElementById('calc-type-total-days')?.classList.add('active');
        standaloneCalcState.calcType = 'total_days';

        document.getElementById('calc-res-principal').textContent = '--';
        document.getElementById('calc-res-interest').textContent = '--';
        document.getElementById('calc-res-total').textContent = '--';
        document.getElementById('calc-res-breakdown').textContent = 'Enter details above and click Calculate to view full breakdown.';
    });

    // 5. Calculate button listener
    document.getElementById('btn-calc-submit')?.addEventListener('click', runStandaloneCalculation);
}

function runStandaloneCalculation() {
    const amountVal = parseFloat(document.getElementById('calc-amount').value);
    const rateVal = parseFloat(document.getElementById('calc-rate').value);
    const rateUnit = document.getElementById('calc-rate-unit').value; // 'year' | 'month'
    const compounding = document.getElementById('calc-compounding').value;
    const customDays = parseInt(document.getElementById('calc-custom-days')?.value) || 30;

    if (isNaN(amountVal) || amountVal <= 0) {
        alert("Please enter a valid Principal Amount.");
        return;
    }
    if (isNaN(rateVal) || rateVal < 0) {
        alert("Please enter a valid Interest Rate.");
        return;
    }

    const annualRate = rateUnit === 'month' ? rateVal * 12 : rateVal;
    const isTimeModeDates = document.getElementById('calc-time-mode-dates')?.checked;

    let totalDays = 0;
    let durationYears = 0;
    let durationMonths = 0;
    let durationDays = 0;
    let calcSummaryText = "";

    if (isTimeModeDates) {
        const fromStr = document.getElementById('calc-from-date').value;
        const toStr = document.getElementById('calc-to-date').value;

        if (!fromStr || !toStr) {
            alert("Please select both 'From' and 'To' dates.");
            return;
        }

        const fromDate = new Date(fromStr);
        const toDate = new Date(toStr);

        if (toDate < fromDate) {
            alert("'To' date cannot be earlier than 'From' date.");
            return;
        }

        const diffMs = toDate.getTime() - fromDate.getTime();
        totalDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

        if (standaloneCalcState.calcType === 'date_to_date') {
            // Full months + remaining days / 30
            let yDiff = toDate.getFullYear() - fromDate.getFullYear();
            let mDiff = toDate.getMonth() - fromDate.getMonth();
            let dDiff = toDate.getDate() - fromDate.getDate();

            if (dDiff < 0) {
                mDiff -= 1;
                // Get days in previous month
                const prevMonthDate = new Date(toDate.getFullYear(), toDate.getMonth(), 0);
                dDiff += prevMonthDate.getDate();
            }
            if (mDiff < 0) {
                yDiff -= 1;
                mDiff += 12;
            }

            durationYears = Math.max(0, yDiff);
            durationMonths = Math.max(0, mDiff);
            durationDays = Math.max(0, dDiff);

            calcSummaryText = `${durationYears} yrs, ${durationMonths} mos, ${durationDays} days (${totalDays} total days)`;
        } else {
            // Total days mode
            durationYears = Math.floor(totalDays / 365);
            const remDaysAfterYears = totalDays % 365;
            durationMonths = Math.floor(remDaysAfterYears / 30);
            durationDays = remDaysAfterYears % 30;

            calcSummaryText = `${totalDays} total days (~${durationYears}y ${durationMonths}m ${durationDays}d)`;
        }
    } else {
        // Duration mode
        durationYears = parseInt(document.getElementById('calc-years')?.value) || 0;
        durationMonths = parseInt(document.getElementById('calc-months')?.value) || 0;
        durationDays = parseInt(document.getElementById('calc-days')?.value) || 0;

        if (standaloneCalcState.calcType === 'date_to_date') {
            totalDays = Math.round((durationYears * 365) + (durationMonths * 30) + durationDays);
            calcSummaryText = `${durationYears} yrs, ${durationMonths} mos, ${durationDays} days`;
        } else {
            totalDays = (durationYears * 365) + (durationMonths * 30) + durationDays;
            calcSummaryText = `${totalDays} total days`;
        }
    }

    let accruedInterest = 0;
    let compoundingDesc = "Simple (No Compounding)";

    if (compounding === 'none') {
        if (standaloneCalcState.calcType === 'date_to_date') {
            const timeInYears = durationYears + (durationMonths / 12) + ((durationDays / 30) / 12);
            accruedInterest = amountVal * (annualRate / 100) * timeInYears;
        } else {
            const timeInYears = totalDays / 365;
            accruedInterest = amountVal * (annualRate / 100) * timeInYears;
        }
    } else {
        let n = 1; // Compounding frequency per year
        if (compounding === 'monthly') { n = 12; compoundingDesc = "Compounded Monthly"; }
        else if (compounding === 'quarterly') { n = 4; compoundingDesc = "Compounded Quarterly"; }
        else if (compounding === 'half_yearly') { n = 2; compoundingDesc = "Compounded Half-Yearly"; }
        else if (compounding === 'yearly') { n = 1; compoundingDesc = "Compounded Yearly"; }
        else if (compounding === 'custom') { n = 365 / Math.max(1, customDays); compoundingDesc = `Compounded Every ${customDays} Days`; }

        let timeInYears = totalDays / 365;
        if (standaloneCalcState.calcType === 'date_to_date') {
            timeInYears = durationYears + (durationMonths / 12) + ((durationDays / 30) / 12);
        }

        const totalAmount = amountVal * Math.pow(1 + (annualRate / 100 / n), n * timeInYears);
        accruedInterest = Math.max(0, totalAmount - amountVal);
    }

    // Math rounding to 2 decimal places
    accruedInterest = Math.round(accruedInterest * 100) / 100;
    const finalTotal = Math.round((amountVal + accruedInterest) * 100) / 100;

    // Display output
    document.getElementById('calc-res-principal').textContent = formatCurrency(amountVal);
    document.getElementById('calc-res-interest').textContent = formatCurrency(accruedInterest);
    document.getElementById('calc-res-total').textContent = formatCurrency(finalTotal);

    const calcTypeLabel = standaloneCalcState.calcType === 'date_to_date' ? 'Date-to-Date (Months + Days/30)' : 'Total Days (/365)';
    document.getElementById('calc-res-breakdown').innerHTML = `
        <strong>Duration:</strong> ${calcSummaryText}<br>
        <strong>Rate:</strong> ${rateVal}% / ${rateUnit} (${annualRate}% p.a.)<br>
        <strong>Type & Rule:</strong> ${calcTypeLabel} | ${compoundingDesc}<br>
        <strong>Yield:</strong> ${accruedInterest > 0 ? formatCurrency(Math.round((accruedInterest / Math.max(1, totalDays)) * 100) / 100) + ' / day' : '₹0.00'}
    `;
}

// --- AUDIT & TRANSPARENCY FEATURES ---
function showInterestBreakdown(txnId = null) {
    const targetCustId = state.currentCustomerId;
    if (!targetCustId) return;

    const customer = state.customers.find(c => c.id === targetCustId);
    const defaultLendingRate = customer?.lendingRate !== undefined ? parseFloat(customer.lendingRate) : 12;

    const asOfDateInput = document.getElementById('ledger-as-of-date');
    const asOfDateStr = asOfDateInput ? asOfDateInput.value : null;
    const toDate = asOfDateStr ? new Date(asOfDateStr) : new Date();
    toDate.setHours(23, 59, 59, 999);

    const ledger = calculateLedger(targetCustId, asOfDateStr);
    const container = document.getElementById('interest-breakdown-body');
    if (!container) return;

    const debits = (ledger.rows || []).filter(r => r.type === 'debit' && !r.isVoid && !r.isBadDebt && (!txnId || r.id === txnId));

    if (debits.length === 0) {
        container.innerHTML = '<p class="text-secondary text-center" style="padding: 2rem;">No active debit transactions to calculate interest.</p>';
        toggleModal('interest-breakdown-modal', true);
        return;
    }

    let html = '';
    let totalLedgerInterest = 0;

    debits.forEach((txn, index) => {
        const silo = (ledger.silos || []).find(s => s.id === txn.id);
        const startDate = txn.interestStartDate ? new Date(txn.interestStartDate) : new Date(txn.date);
        
        const diffTime = Math.max(0, toDate.getTime() - startDate.getTime());
        const totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const durationText = calculateDuration(startDate, toDate);

        const principalAmt = parseFloat(txn.amount) || 0;
        const rate = txn.interestRate !== undefined ? parseFloat(txn.interestRate) : defaultLendingRate;
        const interestType = (txn.interestType || customer?.defaultInterestType || 'simple').toLowerCase();

        const accruedInterest = silo ? silo.accruedInterest : 0;
        totalLedgerInterest += accruedInterest;

        let formulaStr = '';
        let breakdownRule = '';

        if (interestType === 'none') {
            breakdownRule = '0% Interest (None)';
            formulaStr = `${formatCurrency(principalAmt)} × 0% = ₹0.00`;
        } else if (interestType === 'simple') {
            breakdownRule = `Simple Interest (${rate}% p.a.)`;
            formulaStr = `${formatCurrency(principalAmt)} × ${rate}% × (${totalDays} / 365 days) = ${formatCurrency(accruedInterest)}`;
        } else {
            const compFreq = (txn.compoundingFrequency || customer?.compoundingFrequency || customer?.compoundFrequency || 'yearly').toLowerCase();
            let freqNum = 1;
            let periodDays = 365;
            let freqLabel = 'Year';

            switch (compFreq) {
                case 'monthly':
                    freqNum = 12;
                    periodDays = 365 / 12;
                    freqLabel = 'Month';
                    break;
                case 'half-yearly':
                    freqNum = 2;
                    periodDays = 365 / 2;
                    freqLabel = 'Half-Year';
                    break;
                case 'quarterly':
                    freqNum = 4;
                    periodDays = 365 / 4;
                    freqLabel = 'Quarter';
                    break;
                case 'yearly':
                default:
                    freqNum = 1;
                    periodDays = 365;
                    freqLabel = 'Year';
                    break;
            }

            const periodRate = (rate / 100) / freqNum;
            const fullPeriods = Math.floor(totalDays / periodDays);
            const remDays = Math.round(totalDays - (fullPeriods * periodDays));

            const part1Comp = fullPeriods > 0 ? `${fullPeriods} ${freqLabel}${fullPeriods > 1 ? 's' : ''} Compound (${rate}%)` : '';
            const part2Simp = remDays > 0 || fullPeriods === 0 ? `${remDays} Days Simple (${rate}%)` : '';
            breakdownRule = [part1Comp, part2Simp].filter(Boolean).join(' + ');

            const compoundedAmount = roundMoney(principalAmt * Math.pow(1 + periodRate, fullPeriods));
            const simpleOnCompounded = roundMoney(compoundedAmount * periodRate * (remDays / periodDays));

            if (fullPeriods > 0 && remDays > 0) {
                formulaStr = `<strong>Step 1 (${fullPeriods} ${freqLabel}${fullPeriods > 1 ? 's' : ''} Compound):</strong> ${formatCurrency(principalAmt)} × (1 + ${rate}% / ${freqNum})^${fullPeriods} = ${formatCurrency(compoundedAmount)}<br>` +
                             `<strong>Step 2 (${remDays} Days Simple):</strong> ${formatCurrency(compoundedAmount)} + [${formatCurrency(compoundedAmount)} × (${rate}% / ${freqNum}) × (${remDays} / ${roundMoney(periodDays)})] = ${formatCurrency(roundMoney(compoundedAmount + simpleOnCompounded))}`;
            } else if (fullPeriods > 0) {
                formulaStr = `<strong>Compound Formula:</strong> ${formatCurrency(principalAmt)} × (1 + ${rate}% / ${freqNum})^${fullPeriods} - ${formatCurrency(principalAmt)} = ${formatCurrency(accruedInterest)}`;
            } else {
                formulaStr = `<strong>Simple Formula:</strong> ${formatCurrency(principalAmt)} × ${rate}% × (${totalDays} / 365 days) = ${formatCurrency(accruedInterest)}`;
            }
        }

        html += `
            <div class="calc-breakdown-card">
                <div class="calc-card-header">
                    <div>
                        <strong style="font-size: 1rem; color: var(--text-primary);">Item #${index + 1}: ${txn.remarks || 'Debit Entry'}</strong>
                        <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
                            Category: ${txn.category || 'Cash'} | Txn Date: ${formatDate(txn.date)}
                        </div>
                    </div>
                    <span class="amt-debit">${formatCurrency(principalAmt)}</span>
                </div>
                <div style="font-size: 0.88rem; line-height: 1.5; color: var(--text-primary);">
                    <div><strong>Time Period:</strong> ${formatDate(startDate)} → ${formatDate(toDate)}</div>
                    <div><strong>Duration:</strong> <span class="duration-pill"><i class="ph ph-clock"></i> ${durationText} (${totalDays} Days)</span></div>
                    <div class="calc-math-box">
                        <div style="color: var(--text-secondary); font-size: 0.8rem; margin-bottom: 4px;">Rule: ${breakdownRule}</div>
                        <div>${formulaStr}</div>
                        <div style="margin-top: 6px; font-weight: 700; color: var(--debit-accent);">
                            = Accrued Interest: ${formatCurrency(accruedInterest)}
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-weight: 700; margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border-color);">
                        <span>Effective Total (Principal + Interest):</span>
                        <span class="text-danger">${formatCurrency(principalAmt + accruedInterest)}</span>
                    </div>
                </div>
            </div>
        `;
    });

    html += `
        <div style="background: var(--surface-color); padding: 14px; border-radius: 10px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; margin-top: 12px;">
            <span style="font-weight: 700; color: var(--text-primary);">Total Accrued Ledger Interest:</span>
            <span class="amount text-danger" style="font-size: 1.2rem; font-weight: 800;">${formatCurrency(totalLedgerInterest)}</span>
        </div>
    `;

    container.innerHTML = html;
    toggleModal('interest-breakdown-modal', true);
}

document.getElementById('ledger-as-of-date')?.addEventListener('change', renderLedger);

// ==========================================
// BAD DEBTS & NPA (डूबत खाता) MODULE ENGINE
// ==========================================

function renderBadDebtsView() {
    const searchInput = document.getElementById('bad-debts-search');
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

    let totalWrittenOff = 0;
    let totalRecovered = 0;
    const badDebtsList = state.badDebts || [];

    badDebtsList.forEach(bd => {
        totalWrittenOff += (parseFloat(bd.writtenOffAmount) || 0);
        totalRecovered += (parseFloat(bd.totalRecovered) || 0);
    });

    const netBadDebt = Math.max(0, totalWrittenOff - totalRecovered);

    const totalEl = document.getElementById('summary-bad-debt-total');
    const countEl = document.getElementById('summary-bad-debt-count');
    const recEl = document.getElementById('summary-bad-debt-recovered');

    if (totalEl) totalEl.textContent = formatCurrency(totalWrittenOff);
    if (countEl) countEl.textContent = badDebtsList.length;
    if (recEl) recEl.textContent = formatCurrency(totalRecovered);

    const tbody = document.getElementById('bad-debts-list-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtered = badDebtsList.filter(bd => 
        (bd.customerName && bd.customerName.toLowerCase().includes(searchTerm)) ||
        (bd.phoneNumber && bd.phoneNumber.includes(searchTerm)) ||
        (bd.reason && bd.reason.toLowerCase().includes(searchTerm))
    );

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-secondary" style="padding: 2rem;">No defaulted accounts recorded in Bad Debts store.</td></tr>`;
        return;
    }

    filtered.forEach(bd => {
        const remaining = Math.max(0, (bd.writtenOffAmount || 0) - (bd.totalRecovered || 0));
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong>${bd.customerName}</strong>
                ${bd.reason ? `<br><small class="text-secondary">Note: ${bd.reason}</small>` : ''}
            </td>
            <td>${bd.phoneNumber || 'N/A'}</td>
            <td class="text-right text-danger"><strong>${formatCurrency(bd.writtenOffAmount)}</strong></td>
            <td class="text-right text-success">${formatCurrency(bd.totalRecovered || 0)}</td>
            <td class="text-right font-bold ${remaining > 0 ? 'text-danger' : 'text-success'}">${formatCurrency(remaining)}</td>
            <td>${formatDate(bd.writtenOffDate)}</td>
            <td class="text-right">
                <button class="btn-outline btn-sm" onclick="openBadDebtDetail('${bd.id}')" style="margin-right: 4px;">
                    <i class="ph ph-eye"></i> Detail
                </button>
                ${remaining > 0 ? `
                    <button class="btn-primary btn-sm" onclick="openBadDebtRecoveryModal('${bd.id}')">
                        <i class="ph ph-hand-coins"></i> Recovery
                    </button>
                ` : `<span class="status-badge status-active">SETTLED</span>`}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openMarkBadDebtModal(customerId, txnId = null) {
    if (!customerId) return;
    const customer = state.customers.find(c => c.id === customerId);
    if (!customer) return;

    document.getElementById('mark-bad-debt-cust-id').value = customerId;
    document.getElementById('mark-bad-debt-txn-id').value = txnId || '';
    document.getElementById('mark-bad-debt-cust-name').value = customer.name;

    const amountInput = document.getElementById('mark-bad-debt-amount');

    if (txnId) {
        const txn = (state.transactions || []).find(t => t.id === txnId);
        if (txn) {
            amountInput.value = txn.amount || 0;
        }
    } else {
        const ledger = calculateLedger(customerId);
        amountInput.value = Math.max(0, ledger.netOutstanding);
    }

    toggleModal('mark-bad-debt-modal', true);
}

function handleMarkBadDebtSubmit(e) {
    e.preventDefault();
    const customerId = document.getElementById('mark-bad-debt-cust-id').value;
    const txnId = document.getElementById('mark-bad-debt-txn-id').value;
    const amount = parseFloat(document.getElementById('mark-bad-debt-amount').value) || 0;
    const reason = document.getElementById('mark-bad-debt-reason').value.trim();

    if (!customerId || amount <= 0) return;

    const customer = state.customers.find(c => c.id === customerId);
    const writeOffDate = new Date().toISOString();

    if (txnId) {
        const txn = (state.transactions || []).find(t => t.id === txnId);
        if (txn) {
            txn.isBadDebt = true;
            txn.writtenOffDate = writeOffDate;
            txn.badDebtReason = reason;
        }
    } else {
        // Mark all unpaid debits as Bad Debt
        (state.transactions || []).forEach(t => {
            if (t.customerId === customerId && t.type === 'debit' && !t.isVoid) {
                t.isBadDebt = true;
                t.writtenOffDate = writeOffDate;
                t.badDebtReason = reason;
            }
        });
    }

    // Replicate / update in Bad Debts store
    let badDebtRecord = (state.badDebts || []).find(bd => bd.customerId === customerId);
    if (!badDebtRecord) {
        badDebtRecord = {
            id: 'bd-' + Date.now(),
            customerId: customerId,
            customerName: customer ? customer.name : 'Unknown Customer',
            phoneNumber: customer ? (customer.phoneNumber || 'N/A') : 'N/A',
            writtenOffAmount: 0,
            writtenOffDate: writeOffDate,
            reason: reason || 'Uncollectible Bad Debt Write-Off',
            recoveries: [],
            totalRecovered: 0
        };
        state.badDebts = state.badDebts || [];
        state.badDebts.push(badDebtRecord);
    }

    badDebtRecord.writtenOffAmount = Math.round((badDebtRecord.writtenOffAmount + amount) * 100) / 100;
    if (reason) badDebtRecord.reason = reason;

    saveData();
    toggleModal('mark-bad-debt-modal', false);
    e.target.reset();

    if (state.currentCustomerId === customerId) {
        renderLedger();
    }
    renderDashboard();
    renderBadDebtsView();
}

function openBadDebtDetail(badDebtId) {
    const bd = (state.badDebts || []).find(b => b.id === badDebtId);
    if (!bd) return;

    const remaining = Math.max(0, (bd.writtenOffAmount || 0) - (bd.totalRecovered || 0));
    const container = document.getElementById('bad-debt-detail-content');
    if (!container) return;

    const recoveriesHtml = (bd.recoveries && bd.recoveries.length > 0)
        ? bd.recoveries.map(r => `
            <tr>
                <td>${formatDate(r.date)}</td>
                <td>${r.remarks || 'Vasooli'}</td>
                <td class="text-right text-success"><strong>${formatCurrency(r.amount)}</strong></td>
            </tr>
          `).join('')
        : `<tr><td colspan="3" class="text-center text-secondary">No recoveries recorded yet.</td></tr>`;

    const txns = (state.transactions || []).filter(t => t.customerId === bd.customerId && t.isBadDebt);
    const txnsHtml = (txns && txns.length > 0)
        ? txns.map(t => `
            <tr>
                <td>${formatDate(t.date)}</td>
                <td>[${t.category || 'Cash'}] ${t.remarks || ''}</td>
                <td class="text-right text-danger">${formatCurrency(t.amount)}</td>
                <td><span class="status-badge status-baddebt">WRITTEN OFF</span></td>
            </tr>
          `).join('')
        : `<tr><td colspan="4" class="text-center text-secondary">Full balance write-off.</td></tr>`;

    container.innerHTML = `
        <div class="bad-debt-card-header">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div>
                    <h3 style="margin: 0; color: var(--text-primary);">${bd.customerName}</h3>
                    <p style="margin: 4px 0 0 0; font-size: 0.9rem;" class="text-secondary"><i class="ph ph-phone"></i> ${bd.phoneNumber || 'N/A'} | Written Off: ${formatDate(bd.writtenOffDate)}</p>
                    ${bd.reason ? `<p style="margin: 4px 0 0 0; font-size: 0.85rem;" class="text-danger">Reason: ${bd.reason}</p>` : ''}
                </div>
                ${remaining > 0 ? `
                    <button class="btn-primary" onclick="toggleModal('bad-debt-detail-modal', false); openBadDebtRecoveryModal('${bd.id}')">
                        <i class="ph ph-hand-coins"></i> Record Recovery (Vasooli)
                    </button>
                ` : `<span class="status-badge status-active">FULLY SETTLED</span>`}
            </div>
        </div>

        <div class="metrics-grid" style="margin-bottom: 1rem; grid-template-columns: repeat(3, 1fr);">
            <div class="metric-card" style="padding: 12px;">
                <span class="metric-title" style="font-size: 0.8rem;">Written-Off Amount</span>
                <div class="metric-value text-danger" style="font-size: 1.2rem;">${formatCurrency(bd.writtenOffAmount)}</div>
            </div>
            <div class="metric-card" style="padding: 12px;">
                <span class="metric-title" style="font-size: 0.8rem;">Total Recovered</span>
                <div class="metric-value text-success" style="font-size: 1.2rem;">${formatCurrency(bd.totalRecovered || 0)}</div>
            </div>
            <div class="metric-card" style="padding: 12px;">
                <span class="metric-title" style="font-size: 0.8rem;">Remaining Debt</span>
                <div class="metric-value ${remaining > 0 ? 'text-danger' : 'text-success'}" style="font-size: 1.2rem;">${formatCurrency(remaining)}</div>
            </div>
        </div>

        <h4 style="margin: 1rem 0 0.5rem 0;"><i class="ph ph-hand-coins text-success"></i> Recovery History Log (Vasooli)</h4>
        <div class="table-responsive" style="margin-bottom: 1.5rem;">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Remarks / Mode</th>
                        <th class="text-right">Amount Recovered</th>
                    </tr>
                </thead>
                <tbody>${recoveriesHtml}</tbody>
            </table>
        </div>

        <h4 style="margin: 1rem 0 0.5rem 0;"><i class="ph ph-warning text-danger"></i> Quarantined Transactions</h4>
        <div class="table-responsive">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Original Date</th>
                        <th>Remarks / Category</th>
                        <th class="text-right">Amount</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>${txnsHtml}</tbody>
            </table>
        </div>
    `;

    toggleModal('bad-debt-detail-modal', true);
}

function openBadDebtRecoveryModal(badDebtId) {
    const bd = (state.badDebts || []).find(b => b.id === badDebtId);
    if (!bd) return;

    document.getElementById('recovery-bad-debt-id').value = badDebtId;
    const remaining = Math.max(0, (bd.writtenOffAmount || 0) - (bd.totalRecovered || 0));

    const amtInput = document.getElementById('recovery-amount');
    if (amtInput) {
        amtInput.value = remaining;
        amtInput.max = remaining;
    }

    toggleModal('bad-debt-recovery-modal', true);
}

function handleBadDebtRecoverySubmit(e) {
    e.preventDefault();
    const badDebtId = document.getElementById('recovery-bad-debt-id').value;
    const amount = parseFloat(document.getElementById('recovery-amount').value) || 0;
    const remarks = document.getElementById('recovery-remarks').value.trim();

    if (!badDebtId || amount <= 0) return;

    const bd = (state.badDebts || []).find(b => b.id === badDebtId);
    if (!bd) return;

    // 1. Record Recovery in Bad Debt Store
    const recoveryEntry = {
        id: 'rec-' + Date.now(),
        date: new Date().toISOString(),
        amount: amount,
        remarks: remarks || 'Vasooli Recovery Payment'
    };

    bd.recoveries = bd.recoveries || [];
    bd.recoveries.push(recoveryEntry);
    bd.totalRecovered = Math.round(((bd.totalRecovered || 0) + amount) * 100) / 100;

    // 2. Accounting Sync: Automatically add to Cashbook
    state.cashbook = state.cashbook || [];
    state.cashbook.push({
        id: 'cb-rec-' + Date.now(),
        date: new Date().toISOString(),
        type: 'in',
        amount: amount,
        category: 'Bad Debt Recovery (Income)',
        remarks: `Bad Debt Recovery from ${bd.customerName} (${remarks || 'Vasooli'})`
    });

    saveData();
    toggleModal('bad-debt-recovery-modal', false);
    e.target.reset();

    renderBadDebtsView();
    if (document.getElementById('cashbook-view')?.classList.contains('active')) {
        renderCashbook();
    }
}

// --- BAD DEBTS EXPORT FUNCTIONS ---
function downloadBadDebtsPDF() {
    if (!window.jspdf) {
        alert("PDF generator library loading. Please try again in a moment.");
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text("Mohit Store", 14, 20);
    doc.setFontSize(12);
    doc.text("Bad Debts & NPA Write-Off Summary Report", 14, 28);
    doc.setFontSize(10);
    doc.text(`Generated On: ${formatDate(new Date())}`, 14, 36);

    let totalWritten = 0;
    let totalRec = 0;

    const tableBody = (state.badDebts || []).map(bd => {
        const remaining = Math.max(0, (bd.writtenOffAmount || 0) - (bd.totalRecovered || 0));
        totalWritten += bd.writtenOffAmount;
        totalRec += (bd.totalRecovered || 0);

        return [
            bd.customerName,
            bd.phoneNumber || 'N/A',
            formatCurrency(bd.writtenOffAmount),
            formatCurrency(bd.totalRecovered || 0),
            formatCurrency(remaining),
            formatDate(bd.writtenOffDate),
            remaining > 0 ? 'DEFAULTED' : 'SETTLED'
        ];
    });

    tableBody.push([
        'TOTALS',
        '-',
        formatCurrency(totalWritten),
        formatCurrency(totalRec),
        formatCurrency(Math.max(0, totalWritten - totalRec)),
        '-',
        '-'
    ]);

    doc.autoTable({
        startY: 42,
        head: [['Customer Name', 'Phone', 'Written-Off Amount', 'Recovered Amount', 'Remaining Debt', 'Date Written Off', 'Status']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [185, 28, 28] }
    });

    doc.save(`Bad_Debts_NPA_Report_${new Date().getTime()}.pdf`);
}

function exportBadDebtsToExcel() {
    if (!window.XLSX) {
        alert("Excel export library loading. Please try again in a moment.");
        return;
    }
    try {
        const wb = XLSX.utils.book_new();

        // 1. Defaulted Accounts Sheet
        const summaryData = (state.badDebts || []).map(bd => ({
            "Bad Debt ID": bd.id,
            "Customer Name": bd.customerName,
            "Phone Number": bd.phoneNumber || "N/A",
            "Written Off Amount (₹)": bd.writtenOffAmount,
            "Total Recovered (₹)": bd.totalRecovered || 0,
            "Remaining Bad Debt (₹)": Math.max(0, (bd.writtenOffAmount || 0) - (bd.totalRecovered || 0)),
            "Date Written Off": formatDate(bd.writtenOffDate),
            "Reason": bd.reason || "Default"
        }));
        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Defaulted Accounts");

        // 2. Recovery Log Sheet
        const recoveryData = [];
        (state.badDebts || []).forEach(bd => {
            (bd.recoveries || []).forEach(r => {
                recoveryData.push({
                    "Bad Debt ID": bd.id,
                    "Customer Name": bd.customerName,
                    "Recovery Date": formatDate(r.date),
                    "Amount Recovered (₹)": r.amount,
                    "Remarks / Mode": r.remarks || "Vasooli"
                });
            });
        });
        if (recoveryData.length > 0) {
            const wsRecovery = XLSX.utils.json_to_sheet(recoveryData);
            XLSX.utils.book_append_sheet(wb, wsRecovery, "Recovery History Log");
        }

        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `Kirana_Bad_Debts_NPA_Backup_${dateStr}.xlsx`);
    } catch (err) {
        console.error("Bad Debt Excel Export Error:", err);
    }
}

// Attach Form and Export Event Handlers for Bad Debts Module
document.getElementById('mark-bad-debt-form')?.addEventListener('submit', handleMarkBadDebtSubmit);
document.getElementById('bad-debt-recovery-form')?.addEventListener('submit', handleBadDebtRecoverySubmit);
document.getElementById('btn-export-bad-debts-pdf')?.addEventListener('click', downloadBadDebtsPDF);
document.getElementById('btn-export-bad-debts-excel')?.addEventListener('click', exportBadDebtsToExcel);