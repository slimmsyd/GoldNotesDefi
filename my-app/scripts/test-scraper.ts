
import { getCurrentGoldbackRate } from '../src/lib/goldback-scraper';

async function main() {
    console.log('Testing Goldback Scraper...');
    const result = await getCurrentGoldbackRate();
    if (result) {
        console.log('SUCCESS:');
        console.log(`Rate: ${result.rate}`);
        console.log(`Timestamp: ${new Date(result.timestamp).toISOString()}`);
    } else {
        console.error('FAILURE: Scraper returned null.');
    }
}

main();
