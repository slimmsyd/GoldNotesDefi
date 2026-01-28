import fetch from 'node-fetch'; // You might need to install 'node-fetch' if using older node, or use native fetch in Node 18+

const API_URL = 'http://localhost:3001/api/v1/goldback/new_batch';

function generateBatch(batchId: string, startId: number, count: number): string[] {
    const serials = [];
    for (let i = 0; i < count; i++) {
        // Format: GB-2026-XXXXXX
        const id = (startId + i).toString().padStart(6, '0');
        serials.push(`GB-2026-${id}`);
    }
    return serials;
}

async function main() {
    const batchId = `BATCH-${Date.now()}`;
    // Simulate a batch of 50 new notes
    const serials = generateBatch(batchId, Math.floor(Math.random() * 10000), 10);

    console.log(`Generating Batch ${batchId} with ${serials.length} items...`);
    console.log(`Sample: ${serials[0]} ... ${serials[serials.length - 1]}`);

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batchId, serials })
        });

        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Failed to send batch:', error);
    }
}

main();
