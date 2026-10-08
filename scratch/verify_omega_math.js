const { calculateLedger, calculateElapsedCalendarMonths, roundMoney } = require('../backend/src/utils/ledgerEngine');

// Omega Scenario Setup
const lendingRate = 12.5; // 12.5% yearly default
const calculationDate = new Date('2025-12-31T23:59:59.999Z');

const txns = [
    {
        id: 'tx-omega-1',
        type: 'DEBIT',
        amount: 100500.25,
        date: new Date('2020-01-01T00:00:00.000Z'),
        interestRate: 12.5,
        rateUnit: 'yearly',
        interestType: 'compound'
    },
    {
        id: 'tx-omega-2',
        type: 'DEBIT',
        amount: 50250.75,
        date: new Date('2021-08-15T00:00:00.000Z'),
        interestRate: 15.2,
        rateUnit: 'yearly',
        interestType: 'compound'
    },
    {
        id: 'tx-omega-3',
        type: 'CREDIT',
        amount: 45000.00,
        date: new Date('2022-11-10T00:00:00.000Z')
    },
    {
        id: 'tx-omega-4',
        type: 'DEBIT',
        amount: 12345.50,
        date: new Date('2024-02-28T00:00:00.000Z'),
        interestRate: 10.5,
        rateUnit: 'yearly',
        interestType: 'simple'
    }
];

console.log("=== OMEGA SCENARIO CANONICAL MATHEMATICAL AUDIT ===");

const result = calculateLedger(txns, lendingRate, calculationDate);

console.log("\n1. Overall Ledger Result:");
console.log("   Current Principal      :", result.currentPrincipal);
console.log("   Current Advance        :", result.currentAdvance);
console.log("   Total Accrued Interest :", result.totalAccruedInterest);
console.log("   Total Net Owed         :", roundMoney(result.currentPrincipal + result.totalAccruedInterest));

console.log(`\n2. BreakdownLog Phase Audit (${result.breakdownLog.length} Phases):`);
result.breakdownLog.forEach((phase, idx) => {
    console.log(`\n   --- PHASE ${idx + 1} ---`);
    console.log(`   Dates            : ${new Date(phase.startDate).toISOString().split('T')[0]} -> ${new Date(phase.endDate).toISOString().split('T')[0]}`);
    console.log(`   Days Elapsed     : ${phase.daysElapsed}`);
    console.log(`   Elapsed Months   : ${phase.elapsedMonths}`);
    console.log(`   Active Principal : ${phase.activePrincipal}`);
    console.log(`   Rate Applied     : ${phase.rateApplied}`);
    console.log(`   Interest Generated: ${phase.interestGenerated}`);
    console.log(`   Interest Accrued : ${phase.interestAccrued}`);
});
