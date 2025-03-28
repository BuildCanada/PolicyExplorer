import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database path from environment or default
const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../data/policy_data.db');

async function migrateDatabase() {
  console.log('Starting database migration...');
  console.log(`Using database at: ${dbPath}`);
  
  try {
    // Ensure the directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Open database connection
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    
    // Enable foreign keys
    await db.exec('PRAGMA foreign_keys = OFF');
    
    // Check if language column exists in sources table
    const tableInfo = await db.all("PRAGMA table_info(sources)");
    const hasLanguageColumn = tableInfo.some(column => column.name === 'language');
    
    if (!hasLanguageColumn) {
      console.log('Adding language column to sources table...');
      await db.exec("ALTER TABLE sources ADD COLUMN language TEXT NOT NULL DEFAULT 'en'");
      console.log('Created language column with default value of "en"');
      
      // Create index on language
      await db.exec("CREATE INDEX IF NOT EXISTS idx_sources_language ON sources(language)");
      console.log('Created index on language column');
    } else {
      console.log('Language column already exists in sources table');
    }
    
    // Turn foreign keys back on
    await db.exec('PRAGMA foreign_keys = ON');
    
    // Close connection
    await db.close();
    
    console.log('Database migration completed successfully');
  } catch (error) {
    console.error('Error during database migration:', error);
    process.exit(1);
  }
}

// Run the migration
migrateDatabase().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 