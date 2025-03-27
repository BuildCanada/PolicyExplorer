import { Database } from 'sqlite';
import { getDb } from '../database/schema';
import { bufferToEmbedding, generateEmbeddings } from './embeddingService';

interface SearchResult {
  chunk_id: number;
  content_id: number;
  chunk_text: string;
  similarity: number;
  title: string;
  url: string;
  source_type: string;
  party_name: string;
  date_published?: string;
}

/**
 * Vector similarity search service to find relevant content
 */
export class VectorSearchService {
  private async getDb(): Promise<Database> {
    return getDb();
  }
  
  /**
   * Calculate the cosine similarity between two vectors
   */
  private cosineSimilarity(vectorA: number[], vectorB: number[]): number {
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
  async searchByEmbedding(
    embedding: number[], 
    options: { 
      limit?: number;
      minSimilarity?: number;
      partyIds?: number[];
      sourceTypes?: string[];
      dateFrom?: string;
      dateTo?: string;
    } = {}
  ): Promise<SearchResult[]> {
    const db = await this.getDb();
    
    // Set default options
    const limit = options.limit || 10;
    const minSimilarity = options.minSimilarity || 0.7;
    
    // Build additional filters
    const filters = [];
    const params: any[] = [];
    
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
    const embeddings = await db.all(`
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
    const results: SearchResult[] = embeddings.map(row => {
      // Convert BLOB to embedding array
      const rowEmbedding = bufferToEmbedding(row.embedding);
      
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
  }
  
  /**
   * Search for relevant content based on text query
   */
  async search(
    query: string,
    options: { 
      limit?: number;
      minSimilarity?: number;
      partyIds?: number[];
      sourceTypes?: string[];
      dateFrom?: string;
      dateTo?: string;
    } = {}
  ): Promise<SearchResult[]> {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbeddings(query);
    
    // Search by embedding
    return this.searchByEmbedding(queryEmbedding, options);
  }
  
  /**
   * Group search results by party and provide summaries
   */
  groupResultsByParty(results: SearchResult[]): Record<string, string[]> {
    const groupedResults: Record<string, string[]> = {};
    
    for (const result of results) {
      if (!groupedResults[result.party_name]) {
        groupedResults[result.party_name] = [];
      }
      
      groupedResults[result.party_name].push(result.chunk_text);
    }
    
    return groupedResults;
  }
} 