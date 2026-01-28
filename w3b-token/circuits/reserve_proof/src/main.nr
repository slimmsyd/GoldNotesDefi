// circuits/reserve_proof/src/main.nr
//
// Proof of Unique Asset Reserve (Production-Grade)
//
// DESIGN:
// - Serials are SHA256 hashes of serial strings (truncated to Field)
// - Uses SHA256 for Merkle tree hashing (matches off-chain merkletreejs)
// - Binary Merkle tree structure (matches merkletreejs with sortPairs: true)
// - Input MUST be pre-sorted in ascending order for O(n) uniqueness check

use sha256::sha256_var;

fn main(
    // PRIVATE INPUTS (never revealed)
    serials: [Field; 20],     // SHA256 hashes of serial strings (sorted, ascending)
    active_count: u32,        // How many serials are actually in use (1-20)

    // PUBLIC INPUTS (visible on-chain)
    merkle_root: pub Field,   // The expected root hash
    total_supply: pub Field   // Claimed token supply (must be <= active_count)
) -> pub Field {  // Return the computed root for verification
    // 1. Verify count covers supply (we have enough reserves)
    let active_u64 = active_count as u64;
    let supply_u64 = total_supply as u64;
    assert(active_u64 >= supply_u64, "Reserves must be >= token supply");

    // 2. Compute Merkle root from serials (binary tree with SHA256)
    let computed_root = compute_merkle_root(serials, active_count);

    // 3. Verify merkle root matches (skip if merkle_root is 0 - bootstrap mode)
    if merkle_root != 0 {
        assert(computed_root == merkle_root, "Merkle root mismatch");
    }

    // 4. Verify uniqueness via sorted order check - O(n)
    verify_sorted_uniqueness(serials, active_count);

    // Return computed root (useful for bootstrapping)
    computed_root
}

// ============ SHA256 HELPERS ============

/// Convert two Field elements to bytes, concatenate, hash with SHA256, and truncate back to Field
fn sha256_pair(a: Field, b: Field) -> Field {
    // Convert fields to 32-byte arrays (big-endian)
    let a_bytes: [u8; 32] = a.to_be_bytes();
    let b_bytes: [u8; 32] = b.to_be_bytes();

    // Concatenate into 64-byte input
    let mut input: [u8; 64] = [0; 64];
    for i in 0..32 {
        input[i] = a_bytes[i];
        input[32 + i] = b_bytes[i];
    }

    // Hash with SHA256 (using the sha256 library)
    let hash: [u8; 32] = sha256_var(input, 64);

    // Truncate to Field (take first 31 bytes to stay within BN254 field)
    bytes31_to_field(hash)
}

/// Convert first 31 bytes of a 32-byte array to a Field element
fn bytes31_to_field(bytes: [u8; 32]) -> Field {
    let mut result: Field = 0;
    for i in 0..31 {
        result = result * 256 + bytes[i] as Field;
    }
    result
}

// ============ MERKLE TREE ============

/// Hash two leaves together, sorting them first for determinism
/// This matches merkletreejs with { sortPairs: true }
fn hash_pair(left: Field, right: Field) -> Field {
    // Sort for determinism (smaller value first)
    if left.lt(right) {
        sha256_pair(left, right)
    } else {
        sha256_pair(right, left)
    }
}

/// Compute binary Merkle root from leaves using SHA256
/// Matches merkletreejs binary tree structure with sortPairs: true
fn compute_merkle_root(leaves: [Field; 20], count: u32) -> Field {
    // Handle edge case: count == 0
    let mut result: Field = 0;

    if count > 0 {
        // Working array for tree levels
        let mut nodes: [Field; 20] = leaves;
        let mut level_size: u32 = count;

        // Handle single leaf case - just use the leaf itself
        // For count > 1, build the tree
        if count == 1 {
            result = leaves[0];
        } else {
            // Build tree bottom-up
            // Iterate a fixed number of times (log2(20) ~ 5 levels max)
            for _level in 0..5 {
                if level_size > 1 {
                    let pairs = level_size / 2;
                    let has_odd = level_size % 2 == 1;

                    // Hash pairs
                    for i in 0..10 {  // max 10 pairs at any level
                        if i < pairs {
                            let left_idx = i * 2;
                            let right_idx = i * 2 + 1;
                            nodes[i] = hash_pair(nodes[left_idx], nodes[right_idx]);
                        }
                    }

                    // Handle odd node - promote to next level
                    if has_odd {
                        nodes[pairs] = nodes[level_size - 1];
                        level_size = pairs + 1;
                    } else {
                        level_size = pairs;
                    }
                }
            }
            result = nodes[0];
        }
    }

    result
}

// ============ UNIQUENESS CHECK ============

/// O(n) uniqueness check: list must be sorted in strict ascending order
fn verify_sorted_uniqueness(serials: [Field; 20], count: u32) {
    for i in 0..19 {
        if (i < count) & ((i + 1) < count) {
            assert(serials[i].lt(serials[i + 1]), "List must be sorted ascending with no duplicates");
        }
    }
}

// ============ TESTS ============

#[test]
fn test_single_leaf() {
    let serials: [Field; 20] = [
        0x0000000000000001,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ];
    let active_count: u32 = 1;
    let total_supply: Field = 1;

    // Single leaf should return the leaf itself
    let merkle_root = compute_merkle_root(serials, active_count);
    assert(merkle_root == 0x0000000000000001);

    let result = main(serials, active_count, merkle_root, total_supply);
    assert(result == merkle_root);
}

#[test]
fn test_two_leaves() {
    let serials: [Field; 20] = [
        0x0000000000000001,
        0x0000000000000005,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ];
    let active_count: u32 = 2;
    let total_supply: Field = 2;

    let merkle_root = compute_merkle_root(serials, active_count);

    let result = main(serials, active_count, merkle_root, total_supply);
    assert(result == merkle_root);
}

#[test]
fn test_sorted_unique_list() {
    let serials: [Field; 20] = [
        0x0000000000000001,
        0x0000000000000005,
        0x000000000000000a,
        0x000000000000000f,
        0x0000000000000014,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ];
    let active_count: u32 = 5;
    let total_supply: Field = 5;
    let merkle_root = compute_merkle_root(serials, active_count);

    let result = main(serials, active_count, merkle_root, total_supply);
    assert(result == merkle_root);
}

#[test]
fn test_reserves_exceed_supply() {
    let serials: [Field; 20] = [
        0x0000000000000001,
        0x0000000000000005,
        0x000000000000000a,
        0x000000000000000f,
        0x0000000000000014,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ];
    let active_count: u32 = 5;
    let total_supply: Field = 3;  // Supply less than reserves - should pass
    let merkle_root = compute_merkle_root(serials, active_count);

    let result = main(serials, active_count, merkle_root, total_supply);
    assert(result == merkle_root);
}

#[test(should_fail_with = "List must be sorted ascending with no duplicates")]
fn test_unsorted_list_fails() {
    let serials: [Field; 20] = [
        0x0000000000000005,
        0x0000000000000001,  // out of order
        0x000000000000000a,
        0x000000000000000f,
        0x0000000000000014,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ];
    let active_count: u32 = 5;
    let merkle_root = compute_merkle_root(serials, active_count);
    let _ = main(serials, active_count, merkle_root, 5);
}

#[test(should_fail_with = "List must be sorted ascending with no duplicates")]
fn test_duplicate_fails() {
    let serials: [Field; 20] = [
        0x0000000000000001,
        0x0000000000000005,
        0x0000000000000005,  // Duplicate
        0x000000000000000f,
        0x0000000000000014,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ];
    let active_count: u32 = 5;
    let merkle_root = compute_merkle_root(serials, active_count);
    let _ = main(serials, active_count, merkle_root, 5);
}

#[test(should_fail_with = "Reserves must be >= token supply")]
fn test_insufficient_reserves_fails() {
    let serials: [Field; 20] = [
        0x0000000000000001,
        0x0000000000000005,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ];
    let active_count: u32 = 2;
    let total_supply: Field = 5;  // Claiming more than we have
    let merkle_root = compute_merkle_root(serials, active_count);
    let _ = main(serials, active_count, merkle_root, total_supply);
}

#[test]
fn test_bootstrap_mode() {
    let serials: [Field; 20] = [
        0x0000000000000001,
        0x0000000000000005,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ];
    let active_count: u32 = 2;
    let total_supply: Field = 2;
    let merkle_root: Field = 0;  // Bootstrap mode - skip root verification

    let result = main(serials, active_count, merkle_root, total_supply);
    // Should return computed root without failing
    assert(result != 0);
}
