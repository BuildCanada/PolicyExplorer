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
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const schema_1 = require("./database/schema");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Load environment variables
dotenv_1.default.config();
// Database path from environment or default
const dbPath = process.env.DB_PATH || path_1.default.resolve(__dirname, '../data/policy_data.db');
// Markdown output directory
const markdownDir = path_1.default.resolve(__dirname, '../markdown');
// Check if --keep-markdown flag is provided (default is to clear markdown)
const keepMarkdown = process.argv.includes('--keep-markdown');
/**
 * Delete all files in a directory recursively
 */
function clearDirectory(dirPath) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!fs_1.default.existsSync(dirPath)) {
            console.log(`Directory doesn't exist: ${dirPath}, skipping cleanup`);
            return;
        }
        try {
            const entries = fs_1.default.readdirSync(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const entryPath = path_1.default.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    // Recursively clear subdirectory
                    yield clearDirectory(entryPath);
                    // Remove the now-empty directory
                    fs_1.default.rmdirSync(entryPath);
                }
                else {
                    // Delete file
                    fs_1.default.unlinkSync(entryPath);
                }
            }
            console.log(`Cleared directory: ${dirPath}`);
        }
        catch (error) {
            console.error(`Error clearing directory ${dirPath}:`, error);
            throw error;
        }
    });
}
function resetDatabase() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Starting database reset...');
        // Clear markdown files if flag not set
        if (!keepMarkdown) {
            console.log('Clearing markdown files...');
            try {
                yield clearDirectory(markdownDir);
                console.log('All markdown files have been deleted.');
            }
            catch (error) {
                console.error('Error clearing markdown files:', error);
            }
        }
        else {
            console.log('Keeping markdown files (--keep-markdown flag is set)');
        }
        let db = null;
        try {
            // Check if database exists - if not, just initialize a new one
            if (!fs_1.default.existsSync(dbPath)) {
                console.log(`Database file doesn't exist at ${dbPath}, initializing fresh database`);
                yield (0, schema_1.initDb)();
                console.log('Fresh database initialized successfully.');
                return;
            }
            // Open the existing database
            db = yield (0, sqlite_1.open)({
                filename: dbPath,
                driver: sqlite3_1.default.Database
            });
            console.log('Connected to existing database. Retrieving table list...');
            // Get all tables except sqlite_sequence (system table)
            const tables = yield db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('sqlite_sequence', 'parties')");
            console.log(`Found ${tables.length} tables to clear: ${tables.map(t => t.name).join(', ')}`);
            // Start a transaction
            yield db.run('BEGIN TRANSACTION');
            // Delete data from each table (except parties, which is reference data)
            for (const table of tables) {
                console.log(`Clearing data from table: ${table.name}`);
                yield db.run(`DELETE FROM ${table.name}`);
            }
            // Reset auto-increment counters
            console.log('Resetting auto-increment counters...');
            yield db.run("DELETE FROM sqlite_sequence WHERE name NOT IN ('parties')");
            // Commit the transaction
            yield db.run('COMMIT');
            console.log('Database reset complete. All content, sources, embeddings, and processing logs have been cleared.');
            console.log('Party reference data has been preserved.');
        }
        catch (error) {
            console.error('Error during database reset:', error);
            // Try to rollback if there was an error
            if (db) {
                try {
                    yield db.run('ROLLBACK');
                    console.log('Transaction rolled back due to error.');
                }
                catch (rollbackError) {
                    console.error('Error during rollback:', rollbackError);
                }
            }
            process.exit(1);
        }
        finally {
            // Close the database connection
            if (db) {
                yield db.close();
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
    });
}
// Run the reset function
resetDatabase().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
