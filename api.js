/**
 * Malwa Ledger Pro - API Layer
 * 
 * This file serves as the centralized communication layer between the frontend
 * and the backend API. It encapsulates all request configurations, headers,
 * query parameters, authentication headers, error handling, and JSON parsing.
 */

// 1. Immutable BASE_URL configuration
const API = Object.freeze({
    BASE_URL: "http://localhost:3000/api/v1"
});

const TOKEN_KEY = "ml_pro_jwt_token";

// --- JWT TOKEN MANAGEMENT HELPERS ---

/**
 * Saves the JWT token to local storage.
 * @param {string} token - The JWT token to save.
 */
function saveToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Retrieves the JWT token from local storage.
 * @returns {string|null} The stored JWT token, or null if it doesn't exist.
 */
function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

/**
 * Removes the JWT token from local storage.
 */
function removeToken() {
    localStorage.removeItem(TOKEN_KEY);
}

// --- PRIVATE HELPERS ---

/**
 * Converts a params object into a standard query string.
 * Uses URLSearchParams to prevent manual string concatenation.
 * 
 * @param {Object} params - Key-value parameters.
 * @returns {string} The query string starting with '?' or an empty string.
 */
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

/**
 * Builds request headers. Attaches Content-Type and Authorization token automatically
 * if the endpoint is authenticated.
 * 
 * @param {boolean} authenticated - True if the endpoint requires a JWT token.
 * @returns {Object} Request headers object.
 */
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
 * Handles fetch, parses response JSON, handles HTTP status codes, and returns data.
 * 
 * @param {string} method - HTTP Method (e.g. 'GET', 'POST', 'PATCH', 'DELETE').
 * @param {string} endpoint - API Endpoint relative to BASE_URL (or absolute URL).
 * @param {Object|null} body - Request payload body.
 * @param {boolean} authenticated - True if request needs authorization header.
 * @returns {Promise<any>} The parsed response data object (usually response.data).
 */
async function request(method, endpoint, body = null, authenticated = false) {
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
        throw new Error("Network error: Please check your internet connection.");
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

    if (!response.ok) {
        const message = (responseData && responseData.message) || `HTTP Error ${response.status}: ${response.statusText}`;
        const error = new Error(message);
        error.status = response.status;
        error.data = responseData;
        throw error;
    }

    // Standard response format contains `{ status: "success", data: ... }`.
    // Automatically return responseData.data if it exists, otherwise responseData.
    return responseData && responseData.hasOwnProperty("data") ? responseData.data : responseData;
}

// --- PUBLIC API METHODS ---

/**
 * Handles merchant login.
 * @param {string} email - Merchant email address.
 * @param {string} password - Merchant password.
 * @returns {Promise<Object>} The login response data (containing token).
 */
async function login(email, password) {
    return request("POST", "/auth/login", { email, password }, false);
}

/**
 * Retrieves a list of customers with optional filters and pagination.
 * @param {Object} params - Query parameters (search/q, page, limit, sort, order).
 * @returns {Promise<Array>} List of customer objects.
 */
async function getCustomers(params) {
    return request("GET", `/customers${buildQuery(params)}`, null, true);
}

/**
 * Creates a new customer record.
 * @param {Object} customerData - Customer details.
 * @returns {Promise<Object>} The created customer object.
 */
async function createCustomer(customerData) {
    return request("POST", "/customers", customerData, true);
}

/**
 * Updates an existing customer's details.
 * @param {string} id - Customer ID.
 * @param {Object} customerData - Updated fields.
 * @returns {Promise<Object>} The updated customer object.
 */
async function updateCustomer(id, customerData) {
    return request("PATCH", `/customers/${id}`, customerData, true);
}

/**
 * Deletes a customer by ID.
 * @param {string} id - Customer ID.
 * @returns {Promise<Object>} Deletion result confirmation.
 */
async function deleteCustomer(id) {
    return request("DELETE", `/customers/${id}`, null, true);
}

/**
 * Creates a new transaction.
 * @param {Object} transactionData - Transaction details.
 * @returns {Promise<Object>} The created transaction object.
 */
async function createTransaction(transactionData) {
    return request("POST", "/transactions", transactionData, true);
}

/**
 * Retrieves ledger calculations for a specific customer.
 * @param {string} customerId - The customer ID.
 * @param {Object} params - Optional calculation date query param.
 * @returns {Promise<Object>} Ledger data including summary balances and transactions.
 */
async function getCustomerLedger(customerId, params) {
    return request("GET", `/customers/${customerId}/ledger${buildQuery(params)}`, null, true);
}

/**
 * Checks server health status.
 * @returns {Promise<Object>} Health check status information.
 */
async function healthCheck() {
    const serverUrl = API.BASE_URL.replace("/api/v1", "");
    return request("GET", `${serverUrl}/health`, null, false);
}

/**
 * Retrieves inventory items.
 */
async function getItems(params) {
    return request("GET", `/items${buildQuery(params)}`, null, true);
}

/**
 * Creates a new inventory item.
 */
async function createItem(itemData) {
    return request("POST", "/items", itemData, true);
}

/**
 * Updates an inventory item.
 */
async function updateItem(id, itemData) {
    return request("PATCH", `/items/${id}`, itemData, true);
}

/**
 * Deletes an inventory item.
 */
async function deleteItem(id) {
    return request("DELETE", `/items/${id}`, null, true);
}

/**
 * Retrieves list of invoices / bills.
 */
async function getBills(params) {
    return request("GET", `/bills${buildQuery(params)}`, null, true);
}

/**
 * Creates a new invoice / bill atomically with stock deduction.
 */
async function createBill(billData) {
    return request("POST", "/bills", billData, true);
}

/**
 * Voids a bill record.
 */
async function voidBill(id, reasonData) {
    return request("POST", `/bills/${id}/void`, reasonData, true);
}

/**
 * Retrieves cashbook entries.
 */
async function getCashbook(params) {
    return request("GET", `/cashbook${buildQuery(params)}`, null, true);
}

/**
 * Creates a cashbook entry.
 */
async function createCashbookEntry(entryData) {
    return request("POST", "/cashbook", entryData, true);
}

/**
 * Voids a cashbook entry.
 */
async function voidCashbookEntry(id, reasonData) {
    return request("POST", `/cashbook/${id}/void`, reasonData, true);
}

/**
 * Retrieves insurance policy details.
 */
async function getInsurance() {
    return request("GET", "/insurance", null, true);
}

/**
 * Updates insurance policy details.
 */
async function updateInsurance(insuranceData) {
    return request("PUT", "/insurance", insuranceData, true);
}

/**
 * Retrieves aggregated financial report summaries.
 */
async function getReportSummary(type = "all") {
    return request("GET", `/reports/summary${buildQuery({ type })}`, null, true);
}

/**
 * Voids a customer transaction.
 */
async function voidTransaction(id, reasonData) {
    return request("POST", `/transactions/${id}/void`, reasonData, true);
}

// 9. Expose public API globally under a frozen object
window.LedgerAPI = Object.freeze({
    login,
    getCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    createTransaction,
    getCustomerLedger,
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
    healthCheck,
    saveToken,
    getToken,
    removeToken
});
