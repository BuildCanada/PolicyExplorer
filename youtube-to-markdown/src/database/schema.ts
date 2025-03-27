import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import fs from 'fs';
import path from 'path';

// Define the database file path
const DB_PATH = path.resolve(__dirname, '../../data/policy_data.db');

// Ensure the directory exists
const ensureDbDir = () => {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Initialize the database connection
export async function initDb(): Promise<Database> {
  ensureDbDir();
  
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });
  
  // Enable foreign keys
  await db.exec('PRAGMA foreign_keys = ON');
  
  // Create tables if they don't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS parties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      abbreviation TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      party_id INTEGER,
      title TEXT NOT NULL,
      source_type TEXT NOT NULL, -- 'youtube', 'webpage', 'document', etc.
      url TEXT NOT NULL UNIQUE,
      external_id TEXT, -- e.g., YouTube video ID
      date_published TEXT, -- YYYY-MM-DD
      language TEXT NOT NULL DEFAULT 'en',
      processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (party_id) REFERENCES parties(id)
    );
    
    CREATE TABLE IF NOT EXISTS content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL,
      content_text TEXT NOT NULL,
      metadata TEXT, -- JSON string with additional metadata
      FOREIGN KEY (source_id) REFERENCES sources(id)
    );
    
    CREATE TABLE IF NOT EXISTS embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content_id INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      embedding_model TEXT NOT NULL, -- e.g., 'gemini-embed-text', 'openai-text-embedding-3-small'
      embedding BLOB NOT NULL, -- binary blob of the embedding vector
      UNIQUE(content_id, chunk_index, embedding_model),
      FOREIGN KEY (content_id) REFERENCES content(id)
    );

    CREATE TABLE IF NOT EXISTS processing_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL,
      external_id TEXT NOT NULL,
      url TEXT NOT NULL,
      status TEXT NOT NULL, -- 'success', 'error', 'pending'
      message TEXT,
      processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_type, url)
    );
  `);
  
  // Insert default parties if they don't exist
  const parties = [
    { name: 'Liberal Party of Canada', abbreviation: 'LPC' },
    { name: 'Conservative Party of Canada', abbreviation: 'CPC' }
  ];
  
  const insertParty = await db.prepare(
    'INSERT OR IGNORE INTO parties (name, abbreviation) VALUES (?, ?)'
  );
  
  for (const party of parties) {
    await insertParty.run(party.name, party.abbreviation);
  }
  
  await insertParty.finalize();
  
  return db;
}

// Export the database connection singleton
let dbConnection: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!dbConnection) {
    dbConnection = await initDb();
  }
  return dbConnection;
}

// Close the database connection
export async function closeDb(): Promise<void> {
  if (dbConnection) {
    await dbConnection.close();
    dbConnection = null;
  }
} 