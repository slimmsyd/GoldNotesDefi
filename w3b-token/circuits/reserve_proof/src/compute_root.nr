// circuits/reserve_proof/src/compute_root.nr
// 
// Helper to compute the merkle root for the current Prover.toml values
// Run with: nargo execute --package compute_root

use crate::compute_merkle_root;

fn main(
    serials: [Field; 10],
    active_count: u32
) -> pub Field {
    // Simply compute and return the root
    compute_merkle_root(serials, active_count)
}
