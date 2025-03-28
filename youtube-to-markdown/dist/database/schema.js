"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDb = initDb;
exports.getDb = getDb;
exports.closeDb = closeDb;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Define the database file path
const DB_PATH = path_1.default.resolve(__dirname, '../../data/policy_data.db');
// Ensure the directory exists
const ensureDbDir = () => {
    const dir = path_1.default.dirname(DB_PATH);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
};
// Initialize the database connection
function initDb() {
    return __awaiter(this, void 0, void 0, function* () {
        ensureDbDir();
        const db = yield (0, sqlite_1.open)({
            filename: DB_PATH,
            driver: sqlite3_1.default.Database
        });
        // Enable foreign keys
        yield db.exec('PRAGMA foreign_keys = ON');
        // Create tables if they don't exist
        yield db.exec(`
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
        const insertParty = yield db.prepare('INSERT OR IGNORE INTO parties (name, abbreviation) VALUES (?, ?)');
        for (const party of parties) {
            yield insertParty.run(party.name, party.abbreviation);
        }
        yield insertParty.finalize();
        return db;
    });
}
// Export the database connection singleton
let dbConnection = null;
function getDb() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!dbConnection) {
            dbConnection = yield initDb();
        }
        return dbConnection;
    });
}
// Close the database connection
function closeDb() {
    return __awaiter(this, void 0, void 0, function* () {
        if (dbConnection) {
            yield dbConnection.close();
            dbConnection = null;
        }
    });
}
