import { newsPagesToProcess } from './webpageList';
import { processNewsWebsites } from './scrapers/newsScraper';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  try {
    console.log('Starting news processing...');
    
    // Process all news websites from our list
    await processNewsWebsites(newsPagesToProcess);
    
    console.log('News processing completed successfully.');
  } catch (error) {
    console.error('Error in news processing:', error);
    process.exit(1);
  }
}

// Run the script
main(); 