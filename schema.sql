-- ================================================================
-- Malwa Ledger Pro - PostgreSQL / Supabase Relational Database Schema
-- ================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. MERCHANTS TABLE (Store Owner Identity & Credentials)
CREATE TABLE IF NOT EXISTS merchants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    shop_name VARCHAR(255) DEFAULT 'Malwa Grain Merchants',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. CUSTOMERS TABLE (Customer Ledger Profiles)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50),
    lending_rate NUMERIC(5, 2) DEFAULT 0.00,
    deposit_rate NUMERIC(5, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. INVENTORY ITEMS TABLE (Stock Management)
CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    qty INT NOT NULL DEFAULT 0 CHECK (qty >= 0),
    min_reorder_qty INT NOT NULL DEFAULT 5,
    buy_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    sell_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. BILLS TABLE (Invoices & Sales Receipts)
CREATE TABLE IF NOT EXISTS bills (
    id VARCHAR(100) PRIMARY KEY,
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    items_json JSONB NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_mode VARCHAR(50) NOT NULL DEFAULT 'CASH', -- CASH, CREDIT, PARTIAL
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    remaining_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    is_void BOOLEAN NOT NULL DEFAULT FALSE,
    void_reason TEXT,
    voided_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. TRANSACTIONS TABLE (Customer Debits/Credits & Waivers)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    bill_id VARCHAR(100) REFERENCES bills(id) ON DELETE SET NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    interest_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    type VARCHAR(50) NOT NULL, -- debit, credit, waiver, adjustment
    category VARCHAR(100) DEFAULT 'Cash', -- Cash, Goods/Grocery, Grain, System
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    remarks TEXT,
    is_void BOOLEAN NOT NULL DEFAULT FALSE,
    void_reason TEXT,
    voided_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. CASHBOOK TABLE (Shop Counter Cash Drawer Ledger)
CREATE TABLE IF NOT EXISTS cashbook (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    bill_id VARCHAR(100) REFERENCES bills(id) ON DELETE SET NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    type VARCHAR(20) NOT NULL, -- in, out
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    remarks TEXT,
    is_void BOOLEAN NOT NULL DEFAULT FALSE,
    void_reason TEXT,
    voided_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. INSURANCE TABLE (Shopkeeper Policy & Cover Details)
CREATE TABLE IF NOT EXISTS insurance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID UNIQUE NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    policy_name VARCHAR(255),
    provider VARCHAR(255),
    premium_amount NUMERIC(10, 2) DEFAULT 0.00,
    renewal_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES FOR HIGH-PERFORMANCE QUERYING
CREATE INDEX IF NOT EXISTS idx_customers_merchant ON customers(merchant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_items_merchant ON items(merchant_id);
CREATE INDEX IF NOT EXISTS idx_bills_merchant ON bills(merchant_id);
CREATE INDEX IF NOT EXISTS idx_cashbook_merchant ON cashbook(merchant_id);

-- ================================================================
-- ATOMIC STORED PROCEDURE FOR BILL CREATION & STOCK DECREMENT
-- ================================================================
CREATE OR REPLACE FUNCTION create_bill_atomic(
    p_merchant_id UUID,
    p_bill_id VARCHAR,
    p_customer_name VARCHAR,
    p_customer_id UUID,
    p_items JSONB,
    p_total_amount NUMERIC,
    p_payment_mode VARCHAR,
    p_paid_amount NUMERIC,
    p_remaining_balance NUMERIC
) RETURNS JSONB AS $$
DECLARE
    item_record JSONB;
    v_item_id UUID;
    v_item_qty INT;
    v_current_stock INT;
BEGIN
    -- 1. Validate & Decrement Inventory Stock Atomically
    FOR item_record IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := (item_record->>'itemId')::UUID;
        v_item_qty := (item_record->>'qty')::INT;

        -- Lock item row for update to prevent race conditions
        SELECT qty INTO v_current_stock FROM items 
        WHERE id = v_item_id AND merchant_id = p_merchant_id FOR UPDATE;
        
        IF v_current_stock IS NULL THEN
            RAISE EXCEPTION 'Item ID % not found for merchant %', v_item_id, p_merchant_id;
        END IF;

        IF v_current_stock < v_item_qty THEN
            RAISE EXCEPTION 'Insufficient stock for item ID %: available %, requested %', v_item_id, v_current_stock, v_item_qty;
        END IF;

        UPDATE items SET qty = qty - v_item_qty 
        WHERE id = v_item_id AND merchant_id = p_merchant_id;
    END LOOP;

    -- 2. Insert Bill Invoice Record
    INSERT INTO bills (id, merchant_id, customer_id, customer_name, date, items_json, total_amount, payment_mode, paid_amount, remaining_balance)
    VALUES (p_bill_id, p_merchant_id, p_customer_id, p_customer_name, NOW(), p_items, p_total_amount, p_payment_mode, p_paid_amount, p_remaining_balance);

    -- 3. If credit balance remains and customer is linked, log Debit transaction on customer ledger
    IF p_remaining_balance > 0 AND p_customer_id IS NOT NULL THEN
        INSERT INTO transactions (merchant_id, customer_id, bill_id, date, interest_date, type, category, amount, remarks)
        VALUES (p_merchant_id, p_customer_id, p_bill_id, NOW(), NOW(), 'debit', 'Goods/Grocery', p_remaining_balance, 'Credit Sale Invoice #' || p_bill_id);
    END IF;

    -- 4. If cash payment made, log in Cashbook
    IF p_paid_amount > 0 THEN
        INSERT INTO cashbook (merchant_id, bill_id, date, type, amount, remarks)
        VALUES (p_merchant_id, p_bill_id, CURRENT_DATE, 'in', p_paid_amount, 'Invoice #' || p_bill_id || ' Payment (' || p_customer_name || ')');
    END IF;

    RETURN jsonb_build_object('status', 'success', 'bill_id', p_bill_id);
END;
$$ LANGUAGE plpgsql;
