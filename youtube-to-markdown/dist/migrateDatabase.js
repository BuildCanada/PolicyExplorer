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
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
// Database path from environment or default
const dbPath = process.env.DB_PATH || path_1.default.resolve(__dirname, '../data/policy_data.db');
function migrateDatabase() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Starting database migration...');
        console.log(`Using database at: ${dbPath}`);
        try {
            // Ensure the directory exists
            const dir = path_1.default.dirname(dbPath);
            if (!fs_1.default.existsSync(dir)) {
                fs_1.default.mkdirSync(dir, { recursive: true });
            }
            // Open database connection
            const db = yield (0, sqlite_1.open)({
                filename: dbPath,
                driver: sqlite3_1.default.Database
            });
            // Enable foreign keys
            yield db.exec('PRAGMA foreign_keys = OFF');
            // Check if language column exists in sources table
            const tableInfo = yield db.all("PRAGMA table_info(sources)");
            const hasLanguageColumn = tableInfo.some(column => column.name === 'language');
            if (!hasLanguageColumn) {
                console.log('Adding language column to sources table...');
                yield db.exec("ALTER TABLE sources ADD COLUMN language TEXT NOT NULL DEFAULT 'en'");
                console.log('Created language column with default value of "en"');
                // Create index on language
                yield db.exec("CREATE INDEX IF NOT EXISTS idx_sources_language ON sources(language)");
                console.log('Created index on language column');
            }
            else {
                console.log('Language column already exists in sources table');
            }
            // Turn foreign keys back on
            yield db.exec('PRAGMA foreign_keys = ON');
            // Close connection
            yield db.close();
            console.log('Database migration completed successfully');
        }
        catch (error) {
            console.error('Error during database migration:', error);
            process.exit(1);
        }
    });
}
// Run the migration
migrateDatabase().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
