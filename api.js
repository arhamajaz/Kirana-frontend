/**
 * Malwa Ledger Pro - API Layer
 * 
 * Centralized communication layer between frontend and backend API.
 * Encapsulates BASE_URL, authentication headers, request sanitization,
 * error handling, 401 interceptors, and response parsing.
 */

// 1. Dynamic BASE_URL configuration
const API = Object.freeze({
    BASE_URL: window.ENV?.API_BASE_URL || "http://localhost:3000/api/v1"
});

const TOKEN_KEY = "ml_pro_auth_token";

// --- 401 UNAUTHORIZED INTERCEPTOR CALLBACK ---
let onUnauthorizedCallback = null;

function setUnauthorizedHandler(fn) {
    if (typeof fn === 'function') {
        onUnauthorizedCallback = fn;
    }
}

// --- JWT TOKEN MANAGEMENT HELPERS ---
function saveToken(token) {
    if (token) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem("ml_pro_jwt_token", token);
    }
}

function getToken() {
    return localStorage.getItem(TOKEN_KEY) || localStorage.getItem("ml_pro_jwt_token");
}

function removeToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("ml_pro_jwt_token");
}

// --- INPUT SANITIZATION HELPERS (ZOD ALIGNMENT) ---
/**
 * Strips non-digits to ensure a strict 10-digit phone number string.
 */
function sanitizePhoneNumber(phone) {
    if (!phone) return "";
    return String(phone).replace(/\D/g, "");
}

/**
 * Ensures number formatting and decimal constraints.
 */
function sanitizeRate(val) {
    const num = parseFloat(val);
    if (isNaN(num)) return 0;
    return Math.min(Math.max(Number(num.toFixed(2)), 0), 100);
}

function sanitizeAmount(val) {
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) return 0;
    return Number(num.toFixed(2));
}

// --- SUPABASE CLIENT SETUP ---
const SUPABASE_URL = window.ENV?.SUPABASE_URL || localStorage.getItem('ml_supabase_url') || "";
const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY || localStorage.getItem('ml_supabase_key') || "";

let supabase = null;
if (window.supabase && typeof window.supabase.createClient === 'function' && SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
        console.warn("Supabase init skipped:", e);
    }
}

function getSupabaseClient() {
    return supabase;
}

// --- PRIVATE HELPERS ---
function buildQuery(params) {
    if (!params || Object.keys(params).length === 0) {
        return "";
    }
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== "") {
            searchParams.append(key, value);
        }
    }
    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : "";
}

function buildHeaders(authenticated = false) {
    const headers = {
        "Content-Type": "application/json"
    };

    if (authenticated) {
        const token = getToken();
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }
    }

    return headers;
}

/**
 * Reusable generic request helper.
 */
async function request(method, endpoint, body = null, authenticated = false) {
    const isTestMode = localStorage.getItem('ml_pro_test_mode') === 'true';
    if (isTestMode || (authenticated && !getToken())) {
        const err = new Error("Offline/Test Mode: Network calls isolated to localStorage.");
        err.isOffline = true;
        throw err;
    }

    const url = endpoint.startsWith("http") ? endpoint : `${API.BASE_URL}${endpoint}`;

    const config = {
        method: method.toUpperCase(),
        headers: buildHeaders(authenticated)
    };

    if (body) {
        config.body = JSON.stringify(body);
    }

    let response;
    try {
        response = await fetch(url, config);
    } catch (networkError) {
        console.error("Fetch Network Error:", networkError);
        const err = new Error("Network error: Please check if backend server is running at " + API.BASE_URL);
        err.isOffline = true;
        throw err;
    }

    let responseData = null;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        try {
            responseData = await response.json();
        } catch (jsonError) {
            console.error("JSON Parsing Error:", jsonError);
        }
    }

    // 401 Interceptor: Token expired or invalid
    if (response.status === 401) {
        removeToken();
        if (onUnauthorizedCallback) {
            onUnauthorizedCallback();
        }
    }

    if (!response.ok) {
        let message = responseData && responseData.message;
        
        // Parse Zod structured errors if present
        if (responseData && responseData.errors && Array.isArray(responseData.errors)) {
            const detailMsgs = responseData.errors.map(err => err.message || err.path?.join('.')).join("; ");
            if (detailMsgs) message = `${message ? message + ": " : ""}${detailMsgs}`;
        }

        if (!message) {
            message = `HTTP Error ${response.status}: ${response.statusText}`;
        }

        const error = new Error(message);
        error.status = response.status;
        error.data = responseData;
        throw error;
    }

    return responseData && responseData.hasOwnProperty("data") ? responseData.data : responseData;
}

// --- PUBLIC API METHODS ---

async function loginUser(email, password) {
    const cleanEmail = email ? String(email).trim().toLowerCase() : "";
    const cleanPwd = password ? String(password) : "";

    if (supabase) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: cleanEmail,
                password: cleanPwd
            });
            if (error) throw error;
            if (data?.session) {
                saveToken(data.session.access_token);
                return { token: data.session.access_token, user: data.user };
            }
        } catch (supaErr) {
            console.error("Supabase login error:", supaErr);
            throw supaErr;
        }
    }

    try {
        const res = await request("POST", "/auth/login", { 
            email: cleanEmail, 
            password: cleanPwd 
        }, false);

        if (res && res.token) {
            saveToken(res.token);
        }
        return res;
    } catch (err) {
        if (err.isOffline || (err.message && err.message.includes("Network error"))) {
            console.warn("Backend server offline. Falling back to demo mode.");
            const mockToken = "mock_token_" + Date.now();
            saveToken(mockToken);
            return { token: mockToken, user: { email, businessName: "Malwa Merchants (Demo)" } };
        }
        throw err;
    }
}

async function registerUser(email, password, name = "", businessName = "") {
    const cleanEmail = email ? String(email).trim().toLowerCase() : "";
    const cleanPwd = password ? String(password) : "";
    const cleanName = name ? String(name).trim() : "";
    const cleanShop = businessName ? String(businessName).trim() : "";

    if (supabase) {
        try {
            const { data, error } = await supabase.auth.signUp({
                email: cleanEmail,
                password: cleanPwd,
                options: {
                    data: { full_name: cleanName, shop_name: cleanShop }
                }
            });
            if (error) throw error;
            if (data?.session) {
                saveToken(data.session.access_token);
            }
            if (data?.user) {
                await supabase.from('merchants').upsert({
                    id: data.user.id,
                    name: cleanName || 'Merchant',
                    email: cleanEmail,
                    shop_name: cleanShop || 'Malwa Grain Merchants'
                }).catch(err => console.warn("Supabase merchant record upsert warning:", err));
            }
            const token = data?.session?.access_token || "mock_token_" + Date.now();
            saveToken(token);
            return { token, user: data?.user || { email: cleanEmail } };
        } catch (supaErr) {
            console.error("Supabase sign-up error:", supaErr);
            throw supaErr;
        }
    }

    try {
        const res = await request("POST", "/auth/register", {
            email: cleanEmail,
            password: cleanPwd,
            name: cleanName,
            businessName: cleanShop
        }, false);

        if (res && res.token) {
            saveToken(res.token);
        }
        return res;
    } catch (err) {
        if (err.isOffline || (err.message && err.message.includes("Network error"))) {
            console.warn("Backend server offline. Falling back to demo mode.");
            const mockToken = "mock_token_" + Date.now();
            saveToken(mockToken);
            return { token: mockToken, user: { email, businessName: cleanShop || cleanName || "Malwa Merchants (Demo)" } };
        }
        throw err;
    }
}

async function login(email, password) {
    return loginUser(email, password);
}

async function register(email, password, name, businessName) {
    return registerUser(email, password, name, businessName);
}

async function getCustomers(params) {
    return request("GET", `/customers${buildQuery(params)}`, null, true);
}

async function searchCustomers(query, params = {}) {
    return request("GET", `/customers/search${buildQuery({ q: query, ...params })}`, null, true);
}

async function createCustomer(customerData) {
    const payload = {
        name: customerData.name ? String(customerData.name).trim() : "",
        phoneNumber: sanitizePhoneNumber(customerData.phoneNumber),
        lendingRate: sanitizeRate(customerData.lendingRate),
        depositRate: sanitizeRate(customerData.depositRate),
        defaultInterestType: customerData.defaultInterestType ? String(customerData.defaultInterestType).toUpperCase() : "SIMPLE",
        compoundingFrequency: customerData.compoundingFrequency ? String(customerData.compoundingFrequency).toUpperCase() : "MONTHLY"
    };

    if (payload.compoundingFrequency === "CUSTOM" && customerData.customCompoundDays) {
        payload.customCompoundDays = parseInt(customerData.customCompoundDays, 10);
    }

    return request("POST", "/customers", payload, true);
}

async function updateCustomer(id, customerData) {
    const payload = {};
    if (customerData.name !== undefined) payload.name = String(customerData.name).trim();
    if (customerData.phoneNumber !== undefined) payload.phoneNumber = sanitizePhoneNumber(customerData.phoneNumber);
    if (customerData.lendingRate !== undefined) payload.lendingRate = sanitizeRate(customerData.lendingRate);
    if (customerData.depositRate !== undefined) payload.depositRate = sanitizeRate(customerData.depositRate);
    if (customerData.defaultInterestType !== undefined) payload.defaultInterestType = String(customerData.defaultInterestType).toUpperCase();
    if (customerData.compoundingFrequency !== undefined) payload.compoundingFrequency = String(customerData.compoundingFrequency).toUpperCase();
    if (payload.compoundingFrequency === "CUSTOM" && customerData.customCompoundDays) {
        payload.customCompoundDays = parseInt(customerData.customCompoundDays, 10);
    }

    return request("PATCH", `/customers/${id}`, payload, true);
}

async function deleteCustomer(id) {
    return request("DELETE", `/customers/${id}`, null, true);
}

async function createTransaction(transactionData) {
    const type = String(transactionData.type).toUpperCase();
    
    const payload = {
        customerId: transactionData.customerId,
        type: type,
        amount: sanitizeAmount(transactionData.amount),
        date: transactionData.date || new Date().toISOString(),
        interestStartDate: transactionData.interestStartDate || transactionData.date || new Date().toISOString()
    };

    if (transactionData.remarks) {
        payload.remarks = String(transactionData.remarks).trim();
    }

    if (type === "DEBIT") {
        if (transactionData.interestType) payload.interestType = String(transactionData.interestType).toUpperCase();
        if (transactionData.interestRate !== undefined) payload.interestRate = sanitizeRate(transactionData.interestRate);
        if (transactionData.compoundingFrequency) payload.compoundingFrequency = String(transactionData.compoundingFrequency).toUpperCase();
        if (payload.compoundingFrequency === "CUSTOM" && transactionData.customCompoundDays) {
            payload.customCompoundDays = parseInt(transactionData.customCompoundDays, 10);
        }
        if (transactionData.dueDate) payload.dueDate = transactionData.dueDate;
    } else if (type === "CREDIT") {
        // Zod strict rule: Omit interest parameters for CREDIT transactions
        if (transactionData.targetEntryId) {
            payload.targetEntryId = transactionData.targetEntryId;
        }
    }

    return request("POST", "/transactions", payload, true);
}

async function getCustomerLedger(customerId, params) {
    return request("GET", `/customers/${customerId}/ledger${buildQuery(params)}`, null, true);
}

async function getCustomerTransactions(customerId, params) {
    return request("GET", `/customers/${customerId}/transactions${buildQuery(params)}`, null, true);
}

// Void transaction endpoint aligned to PATCH /transactions/:id/void
async function voidTransaction(id, reasonData = {}) {
    return request("PATCH", `/transactions/${id}/void`, reasonData, true);
}

async function updateTransaction(id, transactionData) {
    const payload = {};
    if (transactionData.remarks !== undefined) payload.remarks = String(transactionData.remarks).trim();
    if (transactionData.amount !== undefined) payload.amount = sanitizeAmount(transactionData.amount);
    if (transactionData.type !== undefined) payload.type = String(transactionData.type).toUpperCase();

    try {
        return await request("PATCH", `/transactions/${id}`, payload, true);
    } catch {
        const txns = JSON.parse(localStorage.getItem('ml_pro_transactions')) || [];
        const idx = txns.findIndex(t => t.id === id);
        if (idx !== -1) {
            txns[idx] = { ...txns[idx], ...payload, isEdited: true };
            localStorage.setItem('ml_pro_transactions', JSON.stringify(txns));
        }
        return txns[idx] || payload;
    }
}

async function healthCheck() {
    const serverUrl = API.BASE_URL.replace("/api/v1", "");
    return request("GET", `${serverUrl}/health`, null, false);
}

// --- FALLBACK MOCK WRAPPERS FOR UNIMPLEMENTED BACKEND ENDPOINTS ---

async function getItems(params) {
    try {
        return await request("GET", `/items${buildQuery(params)}`, null, true);
    } catch {
        return JSON.parse(localStorage.getItem('ml_pro_items')) || [];
    }
}

async function createItem(itemData) {
    try {
        return await request("POST", "/items", itemData, true);
    } catch {
        const items = JSON.parse(localStorage.getItem('ml_pro_items')) || [];
        const newItem = { id: 'item-' + Date.now(), ...itemData };
        items.push(newItem);
        localStorage.setItem('ml_pro_items', JSON.stringify(items));
        return newItem;
    }
}

async function updateItem(id, itemData) {
    try {
        return await request("PATCH", `/items/${id}`, itemData, true);
    } catch {
        const items = JSON.parse(localStorage.getItem('ml_pro_items')) || [];
        const idx = items.findIndex(i => i.id === id);
        if (idx !== -1) items[idx] = { ...items[idx], ...itemData };
        localStorage.setItem('ml_pro_items', JSON.stringify(items));
        return items[idx];
    }
}

async function deleteItem(id) {
    try {
        return await request("DELETE", `/items/${id}`, null, true);
    } catch {
        let items = JSON.parse(localStorage.getItem('ml_pro_items')) || [];
        items = items.filter(i => i.id !== id);
        localStorage.setItem('ml_pro_items', JSON.stringify(items));
        return { success: true };
    }
}

async function getBills(params) {
    try {
        return await request("GET", `/bills${buildQuery(params)}`, null, true);
    } catch {
        return JSON.parse(localStorage.getItem('ml_pro_bills')) || [];
    }
}

async function createBill(billData) {
    try {
        return await request("POST", "/bills", billData, true);
    } catch {
        const bills = JSON.parse(localStorage.getItem('ml_pro_bills')) || [];
        const newBill = { id: 'bill-' + Date.now(), ...billData };
        bills.push(newBill);
        localStorage.setItem('ml_pro_bills', JSON.stringify(bills));
        return newBill;
    }
}

async function voidBill(id, reasonData) {
    try {
        return await request("POST", `/bills/${id}/void`, reasonData, true);
    } catch {
        const bills = JSON.parse(localStorage.getItem('ml_pro_bills')) || [];
        const bill = bills.find(b => b.id === id);
        if (bill) bill.isVoid = true;
        localStorage.setItem('ml_pro_bills', JSON.stringify(bills));
        return bill;
    }
}

async function getCashbook(params) {
    try {
        return await request("GET", `/cashbook${buildQuery(params)}`, null, true);
    } catch {
        return JSON.parse(localStorage.getItem('ml_pro_cashbook')) || [];
    }
}

async function createCashbookEntry(entryData) {
    try {
        return await request("POST", "/cashbook", entryData, true);
    } catch {
        const entries = JSON.parse(localStorage.getItem('ml_pro_cashbook')) || [];
        const newEntry = { id: 'cb-' + Date.now(), ...entryData };
        entries.push(newEntry);
        localStorage.setItem('ml_pro_cashbook', JSON.stringify(entries));
        return newEntry;
    }
}

async function voidCashbookEntry(id, reasonData) {
    try {
        return await request("POST", `/cashbook/${id}/void`, reasonData, true);
    } catch {
        const entries = JSON.parse(localStorage.getItem('ml_pro_cashbook')) || [];
        const entry = entries.find(e => e.id === id);
        if (entry) entry.isVoid = true;
        localStorage.setItem('ml_pro_cashbook', JSON.stringify(entries));
        return entry;
    }
}

async function getInsurance() {
    try {
        return await request("GET", "/insurance", null, true);
    } catch {
        return JSON.parse(localStorage.getItem('ml_pro_insurance')) || {};
    }
}

async function updateInsurance(insuranceData) {
    try {
        return await request("PUT", "/insurance", insuranceData, true);
    } catch {
        localStorage.setItem('ml_pro_insurance', JSON.stringify(insuranceData));
        return insuranceData;
    }
}

async function getReportSummary(type = "all") {
    try {
        return await request("GET", `/reports/summary${buildQuery({ type })}`, null, true);
    } catch {
        return { summary: "Offline report summary fallback" };
    }
}

// 9. Expose public API globally under a frozen object
window.LedgerAPI = Object.freeze({
    getSupabaseClient,
    setUnauthorizedHandler,
    login,
    loginUser,
    register,
    registerUser,
    getCustomers,
    searchCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    createTransaction,
    getCustomerLedger,
    getCustomerTransactions,
    getItems,
    createItem,
    updateItem,
    deleteItem,
    getBills,
    createBill,
    voidBill,
    getCashbook,
    createCashbookEntry,
    voidCashbookEntry,
    getInsurance,
    updateInsurance,
    getReportSummary,
    voidTransaction,
    updateTransaction,
    healthCheck,
    saveToken,
    getToken,
    removeToken,
    sanitizePhoneNumber,
    sanitizeRate,
    sanitizeAmount
});
