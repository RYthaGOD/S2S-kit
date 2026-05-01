const PRECISION_FACTOR = 1000000000000n; // 1e12

function calculateYieldDelta(distributableYield, totalDapps) {
    return (distributableYield * PRECISION_FACTOR) / totalDapps;
}

function calculateOwed(vaultIndex, subIndex) {
    const delta = vaultIndex - subIndex;
    return delta / PRECISION_FACTOR;
}

// Test Case: Tiny yield vs Many dApps
const yield1 = 100n; // 100 lamports
const dapps = 101n; // 101 dApps

let vaultIndex = 0n;
let subIndex = 0n;

console.log("--- TEST 1: Dust Accumulation ---");
const delta = calculateYieldDelta(yield1, dapps);
console.log(`Yield: ${yield1}, Dapps: ${dapps} => Index Delta: ${delta}`);

vaultIndex += delta;
let owed = calculateOwed(vaultIndex, subIndex);
console.log(`Owed after 1 harvest: ${owed} (Expected: 0)`);

// Second harvest of same amount
vaultIndex += delta;
owed = calculateOwed(vaultIndex, subIndex);
console.log(`Owed after 2 harvests: ${owed} (Expected: 1)`);

if (owed === 1n) {
    console.log("✅ SUCCESS: Dust successfully accumulated into 1 lamport.");
} else {
    console.log("❌ FAILURE: Precision loss detected.");
}

// Test Case: Overflow check
console.log("\n--- TEST 2: Overflow Check ---");
const largeYield = 1000000000000n; // 1M SKR (approx 10^12 lamports)
const largeDelta = calculateYieldDelta(largeYield, 1n);
console.log(`Large Delta: ${largeDelta}`);
const maxU128 = 340282366920938463463374607431768211455n; 
console.log(`Max u128:     ${maxU128}`);

if (largeDelta < maxU128) {
    console.log("✅ SUCCESS: u128 handles 1M SKR yield with 1e12 precision.");
}
