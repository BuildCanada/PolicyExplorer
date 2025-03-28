import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { initDb } from './database/schema';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Database path from environment or default
const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../data/policy_data.db');
// Markdown output directory
const markdownDir = path.resolve(__dirname, '../markdown');

// Check if --keep-markdown flag is provided (default is to clear markdown)
const keepMarkdown = process.argv.includes('--keep-markdown');

/**
 * Delete all files in a directory recursively
 */
async function clearDirectory(dirPath: string): Promise<void> {
  if (!fs.existsSync(dirPath)) {
    console.log(`Directory doesn't exist: ${dirPath}, skipping cleanup`);
    return;
  }

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively clear subdirectory
        await clearDirectory(entryPath);
        // Remove the now-empty directory
        fs.rmdirSync(entryPath);
      } else {
        // Delete file
        fs.unlinkSync(entryPath);
      }
    }
    
    console.log(`Cleared directory: ${dirPath}`);
  } catch (error) {
    console.error(`Error clearing directory ${dirPath}:`, error);
    throw error;
  }
}

async function resetDatabase() {
  console.log('Starting database reset...');
  
  // Clear markdown files if flag not set
  if (!keepMarkdown) {
    console.log('Clearing markdown files...');
    try {
      await clearDirectory(markdownDir);
      console.log('All markdown files have been deleted.');
    } catch (error) {
      console.error('Error clearing markdown files:', error);
    }
  } else {
    console.log('Keeping markdown files (--keep-markdown flag is set)');
  }
  
  let db: Database | null = null;
  
  try {
    // Check if database exists - if not, just initialize a new one
    if (!fs.existsSync(dbPath)) {
      console.log(`Database file doesn't exist at ${dbPath}, initializing fresh database`);
      await initDb();
      console.log('Fresh database initialized successfully.');
      return;
    }
    
    // Open the existing database
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    
    console.log('Connected to existing database. Retrieving table list...');
    
    // Get all tables except sqlite_sequence (system table)
    const tables = await db.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('sqlite_sequence', 'parties')"
    );
    
    console.log(`Found ${tables.length} tables to clear: ${tables.map(t => t.name).join(', ')}`);
    
    // Start a transaction
    await db.run('BEGIN TRANSACTION');
    
    // Delete data from each table (except parties, which is reference data)
    for (const table of tables) {
      console.log(`Clearing data from table: ${table.name}`);
      await db.run(`DELETE FROM ${table.name}`);
    }
    
    // Reset auto-increment counters
    console.log('Resetting auto-increment counters...');
    await db.run("DELETE FROM sqlite_sequence WHERE name NOT IN ('parties')");
    
    // Commit the transaction
    await db.run('COMMIT');
    
    console.log('Database reset complete. All content, sources, embeddings, and processing logs have been cleared.');
    console.log('Party reference data has been preserved.');
    
  } catch (error) {
    console.error('Error during database reset:', error);
    // Try to rollback if there was an error
    if (db) {
      try {
        await db.run('ROLLBACK');
        console.log('Transaction rolled back due to error.');
      } catch (rollbackError) {
        console.error('Error during rollback:', rollbackError);
      }
    }
    process.exit(1);
  } finally {
    // Close the database connection
    if (db) {
      await db.close();
    }
  }
  
  console.log('\nReset Summary:');
  console.log('- Database tables cleared (except parties table)');
  console.log(`- Markdown files: ${!keepMarkdown ? 'Cleared' : 'Preserved'}`);
  console.log('\nYou can now reprocess your content with:');
  console.log('  npm run process:all');
  console.log('Or process individual content types:');
  console.log('  npm run process:videos');
  console.log('  npm run process:news');
  console.log('  npm run process:webpages');
}

// Run the reset function
resetDatabase().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 