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
exports.VectorSearchService = void 0;
const schema_1 = require("../database/schema");
const embeddingService_1 = require("./embeddingService");
/**
 * Vector similarity search service to find relevant content
 */
class VectorSearchService {
    getDb() {
        return __awaiter(this, void 0, void 0, function* () {
            return (0, schema_1.getDb)();
        });
    }
    /**
     * Calculate the cosine similarity between two vectors
     */
    cosineSimilarity(vectorA, vectorB) {
        if (vectorA.length !== vectorB.length) {
            throw new Error('Vectors must have the same length');
        }
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vectorA.length; i++) {
            dotProduct += vectorA[i] * vectorB[i];
            normA += vectorA[i] * vectorA[i];
            normB += vectorB[i] * vectorB[i];
        }
        if (normA === 0 || normB === 0) {
            return 0;
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
    /**
     * Search for relevant content based on query embedding
     */
    searchByEmbedding(embedding_1) {
        return __awaiter(this, arguments, void 0, function* (embedding, options = {}) {
            const db = yield this.getDb();
            // Set default options
            const limit = options.limit || 10;
            const minSimilarity = options.minSimilarity || 0.7;
            // Build additional filters
            const filters = [];
            const params = [];
            if (options.partyIds && options.partyIds.length > 0) {
                filters.push(`s.party_id IN (${options.partyIds.map(() => '?').join(', ')})`);
                params.push(...options.partyIds);
            }
            if (options.sourceTypes && options.sourceTypes.length > 0) {
                filters.push(`s.source_type IN (${options.sourceTypes.map(() => '?').join(', ')})`);
                params.push(...options.sourceTypes);
            }
            if (options.dateFrom) {
                filters.push('s.date_published >= ?');
                params.push(options.dateFrom);
            }
            if (options.dateTo) {
                filters.push('s.date_published <= ?');
                params.push(options.dateTo);
            }
            // Get all embeddings
            const embeddings = yield db.all(`
      SELECT 
        e.id AS chunk_id,
        e.content_id,
        e.chunk_text,
        e.embedding,
        s.title,
        s.url,
        s.source_type,
        s.date_published,
        p.name AS party_name
      FROM embeddings e
      JOIN content c ON e.content_id = c.id
      JOIN sources s ON c.source_id = s.id
      JOIN parties p ON s.party_id = p.id
      ${filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : ''}
    `, ...params);
            // Calculate similarity and filter results
            const results = embeddings.map(row => {
                // Convert BLOB to embedding array
                const rowEmbedding = (0, embeddingService_1.bufferToEmbedding)(row.embedding);
                // Calculate similarity
                const similarity = this.cosineSimilarity(embedding, rowEmbedding);
                return {
                    chunk_id: row.chunk_id,
                    content_id: row.content_id,
                    chunk_text: row.chunk_text,
                    similarity,
                    title: row.title,
                    url: row.url,
                    source_type: row.source_type,
                    party_name: row.party_name,
                    date_published: row.date_published
                };
            })
                .filter(result => result.similarity >= minSimilarity)
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, limit);
            return results;
        });
    }
    /**
     * Search for relevant content based on text query
     */
    search(query_1) {
        return __awaiter(this, arguments, void 0, function* (query, options = {}) {
            // Generate embedding for the query
            const queryEmbedding = yield (0, embeddingService_1.generateEmbeddings)(query);
            // Search by embedding
            return this.searchByEmbedding(queryEmbedding, options);
        });
    }
    /**
     * Group search results by party and provide summaries
     */
    groupResultsByParty(results) {
        const groupedResults = {};
        for (const result of results) {
            if (!groupedResults[result.party_name]) {
                groupedResults[result.party_name] = [];
            }
            groupedResults[result.party_name].push(result.chunk_text);
        }
        return groupedResults;
    }
}
exports.VectorSearchService = VectorSearchService;
