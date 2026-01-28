import { MerkleTree } from 'merkletreejs';
import crypto from 'crypto';

/**
 * Computes the SHA256 hash of a string.
 * This matches the hashing algorithm used in our on-chain verification (assumed).
 */
export function hashSerial(serial: string): Buffer {
    return crypto.createHash('sha256').update(serial).digest();
}

/**
 * SHA256 hash function for MerkleTree
 */
function sha256(data: Buffer): Buffer {
    return crypto.createHash('sha256').update(data).digest();
}

/**
 * Builds a Merkle Tree from a list of serial number strings.
 */
export function buildMerkleTree(serials: string[]): MerkleTree {
    const leaves = serials.map(hashSerial);
    // Sort pairs to ensure determinism if required by the on-chain program
    return new MerkleTree(leaves, sha256, { sortPairs: true });
}

/**
 * Verifies if a serial is in the tree.
 */
export function verifySerial(serial: string, tree: MerkleTree): boolean {
    const leaf = hashSerial(serial);
    const proof = tree.getProof(leaf);
    return tree.verify(proof, leaf, tree.getRoot());
}
