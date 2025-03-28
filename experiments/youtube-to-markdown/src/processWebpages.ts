import { processWebpages } from './scrapers/webScraper';
import { webpagesToProcess } from './webpageList';
import { initDb, closeDb } from './database/schema';

async function main() {
  console.log('Starting webpage processing...');
  
  // Initialize the database
  await initDb();
  
  // Process all webpages
  await processWebpages(webpagesToProcess);
  
  // Close the database connection
  await closeDb();
  
  console.log('Webpage processing completed!');
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error during webpage processing:', error);
  process.exit(1);
}); 