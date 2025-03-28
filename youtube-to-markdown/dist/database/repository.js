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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessingLogRepository = exports.EmbeddingRepository = exports.ContentRepository = exports.SourceRepository = exports.PartyRepository = void 0;
const schema_1 = require("./schema");
const embeddingService_1 = require("../services/embeddingService");
/**
 * Repository class for party-related operations
 */
class PartyRepository {
    getDb() {
        return __awaiter(this, void 0, void 0, function* () {
            return (0, schema_1.getDb)();
        });
    }
    /**
     * Get all parties
     */
    getAllParties() {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield this.getDb();
            return db.all('SELECT * FROM parties ORDER BY name');
        });
    }
    /**
     * Get a party by name
     */
    getPartyByName(name) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield this.getDb();
            return db.get('SELECT * FROM parties WHERE name = ?', name);
        });
    }
    /**
     * Get a party by abbreviation
     */
    getPartyByAbbreviation(abbreviation) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield this.getDb();
            return db.get('SELECT * FROM parties WHERE abbreviation = ?', abbreviation);
        });
    }
    /**
     * Get a party by ID
     */
    getPartyById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield this.getDb();
            return db.get('SELECT * FROM parties WHERE id = ?', id);
        });
    }
}
exports.PartyRepository = PartyRepository;
/**
 * Repository class for source-related operations
 */
class SourceRepository {
    getDb() {
        return __awaiter(this, void 0, void 0, function* () {
            return (0, schema_1.getDb)();
        });
    }
    /**
     * Save a new source
     */
    saveSource(source) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield this.getDb();
            const result = yield db.run(`INSERT INTO sources (party_id, title, source_type, url, external_id, date_published, language)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [source.party_id, source.title, source.source_type, source.url, source.external_id, source.date_published, source.language]);
            return result.lastID;
        });
    }
    /**
     * Check if a source exists by URL
     */
    sourceExistsByUrl(url) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const db = yield this.getDb();
            const result = yield db.get('SELECT COUNT(*) as count FROM sources WHERE url = ?', [url]);
            return ((_a = result === null || result === void 0 ? void 0 : result.count) !== null && _a !== void 0 ? _a : 0) > 0;
        });
    }
    /**
     * Get a source by URL
     */
    getSourceByUrl(url) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield this.getDb();
            const result = yield db.get('SELECT * FROM sources WHERE url = ?', [url]);
            return result || null;
        });
    }
    /**
     * Get sources by party ID
     */
    getSourcesByPartyId(partyId) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield this.getDb();
            return db.all('SELECT * FROM sources WHERE party_id = ? ORDER BY date_published DESC', partyId);
        });
    }
    // Add method to get sources by language
    getSourcesByLanguage(language) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield this.getDb();
            return yield db.all('SELECT * FROM sources WHERE language = ?', [language]);
        });
    }
}
exports.SourceRepository = SourceRepository;
/**
 * Repository class for content-related operations
 */
class ContentRepository {
    getDb() {
        return __awaiter(this, void 0, void 0, function* () {
            return (0, schema_1.getDb)();
        });
    }
    /**
     * Save new content
     */
    saveContent(content) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield this.getDb();
            const result = yield db.run('INSERT INTO content (source_id, content_text, metadata) VALUES (?, ?, ?)', content.source_id, content.content_text, content.metadata);
            return result.lastID || 0;
        });
    }
    /**
     * Get content by source ID
     */
    getContentBySourceId(sourceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield this.getDb();
            return db.get('SELECT * FROM content WHERE source_id = ?', sourceId);
        });
    }
}
exports.ContentRepository = ContentRepository;
/**
 * Repository class for embedding-related operations
 */
class EmbeddingRepository {
    getDb() {
        return __awaiter(this, void 0, void 0, function* () {
            return (0, schema_1.getDb)();
        });
    }
    /**
     * Save an embedding chunk
     */
    saveEmbedding(embedding) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield this.getDb();
            // Convert embedding array to Buffer for BLOB storage
            const embeddingBlob = (0, embeddingService_1.embeddingToBuffer)(embedding.embedding);
            const result = yield db.run(`INSERT INTO embeddings (content_id, chunk_index, chunk_text, embedding_model, embedding) 
       VALUES (?, ?, ?, ?, ?)`, embedding.content_id, embedding.chunk_index, embedding.chunk_text, embedding.embedding_model, embeddingBlob);
            return result.lastID || 0;
        });
    }
    /**
     * Save multiple embedding chunks in a transaction
     */
    saveEmbeddings(embeddings) {
        return __awaiter(this, void 0, void 0, function* () {
            if (embeddings.length === 0)
                return;
            const db = yield this.getDb();
            const stmt = yield db.prepare(`INSERT INTO embeddings (content_id, chunk_index, chunk_text, embedding_model, embedding) 
       VALUES (?, ?, ?, ?, ?)`);
            yield db.run('BEGIN TRANSACTION');
            try {
                for (const embedding of embeddings) {
                    const embeddingBlob = (0, embeddingService_1.embeddingToBuffer)(embedding.embedding);
                    yield stmt.run(embedding.content_id, embedding.chunk_index, embedding.chunk_text, embedding.embedding_model, embeddingBlob);
                }
                yield db.run('COMMIT');
            }
            catch (error) {
                yield db.run('ROLLBACK');
                throw error;
            }
            finally {
                yield stmt.finalize();
            }
        });
    }
    /**
     * Get embeddings by content ID
     */
    getEmbeddingsByContentId(contentId) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield this.getDb();
            return db.all('SELECT id, content_id, chunk_index, chunk_text, embedding_model FROM embeddings WHERE content_id = ? ORDER BY chunk_index', contentId);
        });
    }
}
exports.EmbeddingRepository = EmbeddingRepository;
/**
 * Repository class for processing log operations
 */
class ProcessingLogRepository {
    getDb() {
        return __awaiter(this, void 0, void 0, function* () {
            return (0, schema_1.getDb)();
        });
    }
    /**
     * Log a processing attempt
     */
    logProcessing(log) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield this.getDb();
            try {
                // First check if there's already an entry for this URL
                const existing = yield db.get('SELECT id, status FROM processing_log WHERE url = ?', log.url);
                if (existing) {
                    // If existing entry with same status, don't update
                    if (existing.status === log.status) {
                        return existing.id;
                    }
                    // If existing entry but different status, update it
                    const result = yield db.run(`UPDATE processing_log 
           SET source_type = ?, external_id = ?, status = ?, message = ?, processed_at = CURRENT_TIMESTAMP
           WHERE id = ?`, log.source_type, log.external_id, log.status, log.message, existing.id);
                    return existing.id;
                }
                else {
                    // Insert new record
                    const result = yield db.run(`INSERT INTO processing_log (source_type, external_id, url, status, message) 
           VALUES (?, ?, ?, ?, ?)`, log.source_type, log.external_id, log.url, log.status, log.message);
                    return result.lastID || 0;
                }
            }
            catch (error) {
                // If there's a unique constraint error, it means another process inserted the record
                // between our check and insert. In this case, just return 0 
                console.warn(`Warning inserting processing log: ${error}`);
                return 0;
            }
        });
    }
    /**
     * Check if a URL has been processed successfully
     */
    hasBeenProcessed(url) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield this.getDb();
            // First check processing_log
            const logResult = yield db.get('SELECT id FROM processing_log WHERE url = ? AND status = ?', url, 'success');
            if (logResult) {
                return true;
            }
            // Also check if URL exists in sources table 
            const sourceResult = yield db.get('SELECT id FROM sources WHERE url = ?', url);
            return !!sourceResult;
        });
    }
}
exports.ProcessingLogRepository = ProcessingLogRepository;
