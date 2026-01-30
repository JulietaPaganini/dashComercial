
import { findPotentialDuplicates } from './src/services/ClientUnification.js';

const testCases = [
    "ABSA - LINCOLN",
    "ABSA - LINCONL",
    "Coca Cola",
    "Coca-Cola",
    "Google",
    "Google Inc",
    "  Space Check  ",
    "Space Check"
];

const results = findPotentialDuplicates(testCases);
console.log(JSON.stringify(results, null, 2));

if (results.length === 0) {
    console.error("FAILED to find duplicates");
} else {
    console.log("SUCCESS: Found duplicates");
}
