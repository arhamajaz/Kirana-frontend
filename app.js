/**
 * Malwa Ledger Pro - Core Engine
 */

// --- STATE MANAGEMENT ---
let state = {
    isAuthenticated: false,
    customers: JSON.parse(localStorage.getItem('ml_pro_customers')) || [],
    transactions: JSON.parse(localStorage.getItem('ml_pro_transactions')) || [],
    currentCustomerId: null
};

function saveData() {
    localStorage.setItem('ml_pro_customers', JSON.stringify(state.customers));
    localStorage.setItem('ml_pro_transactions', JSON.stringify(state.transactions));
}

// --- FORMATTERS ---
const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-IN');

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

// --- AUTHENTICATION & NAVIGATION ---
document.getElementById('login-form').onsubmit = (e) => {
    e.preventDefault();
    state.isAuthenticated = true;
    document.getElementById('auth-view').classList.remove('active');
    document.getElementById('auth-view').classList.add('hidden');
    document.getElementById('app-wrapper').classList.remove('hidden');
    renderDashboard();
};

document.getElementById('btn-logout').onclick = () => {
    state.isAuthenticated = false;
    document.getElementById('app-wrapper').classList.add('hidden');
    document.getElementById('auth-view').classList.remove('hidden');
    document.getElementById('auth-view').classList.add('active');
};

document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        
        document.querySelectorAll('.tab-content').forEach(c => c.classList.replace('active', 'hidden'));
        document.getElementById('ledger-view').classList.replace('active', 'hidden'); 
        
        const targetId = e.target.getAttribute('data-target');
        document.getElementById(targetId).classList.replace('hidden', 'active');
        
        if (targetId === 'dashboard-view') renderDashboard();
        if (targetId === 'analytics-view') renderAnalytics();
    });
});

// --- CORE FINANCIAL MATH ENGINE ---
function calculateLedger(customerId) {
    const customer = state.customers.find(c => c.id === customerId);
    const txns = state.transactions
        .filter(t => t.customerId === customerId)
        .sort((a, b) => new Date(a.date) - new Date(b.date)); 

    let principal = 0;
    let accruedInterest = 0;
    let lastDate = null;
    let computedLedger = [];
    let lastActivityDate = null;

    txns.forEach(txn => {
        const currentDate = new Date(txn.interestDate);
        lastActivityDate = new Date(txn.date);
        
        if (lastDate) {
            const daysElapsed = (currentDate - lastDate) / (1000 * 60 * 60 * 24);
            if (daysElapsed > 0 && principal !== 0) {
                const annualRate = principal < 0 ? parseFloat(customer.lendRate) : parseFloat(customer.depRate);
                const r = annualRate / 100;
                const interestForPeriod = Math.abs(principal) * (Math.pow(1 + r / 365, daysElapsed) - 1);
                accruedInterest += interestForPeriod;
            }
        }

        let amount = parseFloat(txn.amount);

        if (txn.type === 'waiver') {
            accruedInterest = Math.max(0, accruedInterest - amount); 
        } 
        else if (txn.type === 'adjustment') {
            principal += amount; 
        }
        else if (txn.type === 'credit') { 
            if (principal < 0) {
                if (accruedInterest > 0) {
                    if (amount >= accruedInterest) {
                        amount -= accruedInterest;
                        accruedInterest = 0;       
                        principal += amount;       
                    } else {
                        accruedInterest -= amount; 
                    }
                } else {
                    principal += amount; 
                }
            } else {
                principal += amount;
            }
        } else {
            principal -= amount;
        }

        lastDate = currentDate;
        
        computedLedger.push({
            ...txn,
            runningPrincipal: principal,
            runningInterest: accruedInterest
        });
    });

    const isDebt = principal < 0;
    const totalNet = isDebt ? (principal - accruedInterest) : (principal + accruedInterest);

    let status = 'active';
    if (isDebt && lastActivityDate) {
        const daysSinceActivity = (new Date() - lastActivityDate) / (1000 * 60 * 60 * 24);
        if (daysSinceActivity > 60) status = 'overdue';
        else if (daysSinceActivity > 30) status = 'warning';
    }

    return { principal, accruedInterest, totalNet, isDebt, status, rows: computedLedger.reverse() };
}

// --- UI RENDERING FUNCTIONS ---
function renderDashboard(searchTerm = '') {
    const tbody = document.getElementById('customer-list-body');
    tbody.innerHTML = '';

    const filtered = state.customers.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.phone.includes(searchTerm)
    );

    filtered.forEach(customer => {
        const ledger = calculateLedger(customer.id);
        const netClass = ledger.totalNet < 0 ? 'text-danger' : (ledger.totalNet > 0 ? 'text-success' : '');
        
        let statusBadge = `<span class="status-badge status-active">Active</span>`;
        if (ledger.status === 'overdue') statusBadge = `<span class="status-badge status-overdue">Overdue</span>`;
        if (ledger.status === 'warning') statusBadge = `<span class="status-badge status-warning">Warning</span>`;

        const tr = document.createElement('tr');
        tr.onclick = () => openLedger(customer.id);
        tr.innerHTML = `
            <td><strong>${customer.name}</strong><br><small class="text-secondary">${customer.phone}</small></td>
            <td>${statusBadge}</td>
            <td class="text-right ${netClass}"><strong>${formatCurrency(Math.abs(ledger.totalNet))}</strong> ${ledger.totalNet < 0 ? '(Dr)' : (ledger.totalNet > 0 ? '(Cr)' : '')}</td>
            <td class="text-right">
                <button class="btn-icon" onclick="event.stopPropagation(); editCustomer('${customer.id}')">
                    <i class="ph ph-pencil-simple"></i>
                </button>
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

function openLedger(customerId) {
    state.currentCustomerId = customerId;
    const customer = state.customers.find(c => c.id === customerId);
    document.getElementById('ledger-customer-name').textContent = customer.name;
    
    document.querySelectorAll('.tab-content').forEach(c => c.classList.replace('active', 'hidden'));
    document.getElementById('ledger-view').classList.replace('hidden', 'active');
    
    renderLedger();
}

function renderLedger() {
    if (!state.currentCustomerId) return;
    
    const ledger = calculateLedger(state.currentCustomerId);
    
    document.getElementById('summary-principal').textContent = formatCurrency(Math.abs(ledger.principal));
    document.getElementById('summary-interest').textContent = formatCurrency(ledger.accruedInterest);
    
    const netEl = document.getElementById('summary-net');
    netEl.textContent = formatCurrency(Math.abs(ledger.totalNet)) + (ledger.totalNet < 0 ? ' (Dr)' : (ledger.totalNet > 0 ? ' (Cr)' : ''));
    netEl.className = 'amount ' + (ledger.totalNet < 0 ? 'text-danger' : (ledger.totalNet > 0 ? 'text-success' : ''));

    const tbody = document.getElementById('transaction-list-body');
    tbody.innerHTML = '';

    ledger.rows.forEach(row => {
        let debitAmt = '-', creditAmt = '-';
        if (row.type === 'debit') debitAmt = formatCurrency(row.amount);
        if (row.type === 'credit' || row.type === 'adjustment') creditAmt = formatCurrency(row.amount);
        if (row.type === 'waiver') creditAmt = `(Waiver) ${formatCurrency(row.amount)}`;

        const pClass = row.runningPrincipal < 0 ? 'text-danger' : (row.runningPrincipal > 0 ? 'text-success' : '');
        const categoryBadge = row.category ? `<span class="badge">${row.category}</span>` : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div>${formatDate(row.date)}</div>
                <div style="font-size:0.75rem; color:var(--text-secondary)">Int: ${formatDate(row.interestDate)}</div>
            </td>
            <td>${categoryBadge} ${row.remarks}</td>
            <td class="text-right text-danger">${debitAmt}</td>
            <td class="text-right text-success">${creditAmt}</td>
            <td class="text-right ${pClass}">${formatCurrency(Math.abs(row.runningPrincipal))}</td>
            <td class="text-right">${formatCurrency(row.runningInterest)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- MODALS & FORMS ---
function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if (show) modal.classList.remove('hidden');
    else modal.classList.add('hidden');
}

document.querySelectorAll('.modal-close').forEach(btn => {
    btn.onclick = (e) => e.target.closest('.modal').classList.add('hidden');
});

document.getElementById('btn-back').onclick = () => {
    state.currentCustomerId = null;
    document.getElementById('ledger-view').classList.replace('active', 'hidden');
    document.getElementById('dashboard-view').classList.replace('hidden', 'active');
    renderDashboard();
};

document.getElementById('search-input').addEventListener('input', (e) => renderDashboard(e.target.value));

// New Customer Form
document.getElementById('btn-new-customer').onclick = () => {
    document.getElementById('customer-form').reset();
    document.getElementById('cust-id').value = '';
    toggleModal('customer-modal', true);
};

// Edit Existing Customer
function editCustomer(id) {
    const customer = state.customers.find(c => c.id === id);
    if(customer) {
        document.getElementById('cust-id').value = customer.id;
        document.getElementById('cust-name').value = customer.name;
        document.getElementById('cust-phone').value = customer.phone;
        document.getElementById('cust-lend-rate').value = customer.lendRate;
        document.getElementById('cust-dep-rate').value = customer.depRate;
        toggleModal('customer-modal', true);
    }
}

document.getElementById('customer-form').onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById('cust-id').value || 'CUST-' + Date.now();
    const customer = {
        id,
        name: document.getElementById('cust-name').value,
        phone: document.getElementById('cust-phone').value,
        lendRate: document.getElementById('cust-lend-rate').value,
        depRate: document.getElementById('cust-dep-rate').value
    };

    const existingIndex = state.customers.findIndex(c => c.id === id);
    if (existingIndex > -1) state.customers[existingIndex] = customer;
    else state.customers.push(customer);

    saveData();
    toggleModal('customer-modal', false);
    renderDashboard();
};

// Transaction Form
document.getElementById('btn-add-transaction').onclick = () => {
    document.getElementById('transaction-form').reset();
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('txn-date').value = today;
    document.getElementById('txn-interest-date').value = today;
    toggleModal('transaction-modal', true);
};

document.getElementById('transaction-form').onsubmit = (e) => {
    e.preventDefault();
    const txn = {
        id: 'TXN-' + Date.now(),
        customerId: state.currentCustomerId,
        date: document.getElementById('txn-date').value,
        interestDate: document.getElementById('txn-interest-date').value,
        type: document.getElementById('txn-type').value,
        category: document.getElementById('txn-category').value,
        amount: document.getElementById('txn-amount').value,
        remarks: document.getElementById('txn-remarks').value
    };

    state.transactions.push(txn);
    saveData();
    toggleModal('transaction-modal', false);
    renderLedger();
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
    const msg = `Namaste ${customer.name},\n\nThis is a friendly reminder from Malwa Grain Merchants. Your current outstanding ledger balance is *${amt}*.\n\nPlease review and arrange for payment. Thank you!`;
    
    const waUrl = `https://wa.me/91${customer.phone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
};

document.getElementById('btn-download-pdf').onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const customer = state.customers.find(c => c.id === state.currentCustomerId);
    const ledger = calculateLedger(state.currentCustomerId);

    doc.setFontSize(20);
    doc.text("Malwa Grain Merchants", 14, 20);
    doc.setFontSize(12);
    doc.text("Statement of Account", 14, 28);
    
    doc.setFontSize(10);
    doc.text(`Customer Name: ${customer.name}`, 14, 40);
    doc.text(`Phone: ${customer.phone}`, 14, 45);
    doc.text(`Generated On: ${formatDate(new Date())}`, 14, 50);

    doc.text(`Net Outstanding: ${formatCurrency(Math.abs(ledger.totalNet))} ${ledger.totalNet < 0 ? '(Dr - You Owe)' : '(Cr - We Owe)'}`, 140, 40);
    doc.text(`Principal: ${formatCurrency(Math.abs(ledger.principal))}`, 140, 45);
    doc.text(`Accrued Interest: ${formatCurrency(ledger.accruedInterest)}`, 140, 50);

    const tableBody = ledger.rows.map(row => [
        formatDate(row.date),
        (row.category ? `[${row.category}] ` : '') + row.remarks,
        row.type === 'debit' ? formatCurrency(row.amount) : '-',
        row.type === 'credit' || row.type === 'adjustment' ? formatCurrency(row.amount) : (row.type === 'waiver' ? `(Waiver) ${formatCurrency(row.amount)}` : '-'),
        formatCurrency(Math.abs(row.runningPrincipal)),
        formatCurrency(row.runningInterest)
    ]);

    doc.autoTable({
        startY: 60,
        head: [['Date', 'Remarks', 'Debit (-)', 'Credit (+)', 'Principal', 'Acc. Interest']],
        body: tableBody,
        theme: 'striped',
        headStyles: { fillColor: [17, 24, 39] }
    });

    doc.save(`Statement_${customer.name.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
};

// --- INITIALIZE ---
initTheme();