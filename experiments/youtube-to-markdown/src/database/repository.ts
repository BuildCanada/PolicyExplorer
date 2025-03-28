import { Database } from 'sqlite';
import { getDb } from './schema';
import { embeddingToBuffer } from '../services/embeddingService';

// Types for repository operations
export interface Source {
  id?: number;
  party_id: number;
  title: string;
  source_type: string;
  url: string;
  external_id?: string;
  date_published: string;
  language: string;
  created_at?: string;
}

export interface Content {
  id?: number;
  source_id: number;
  content_text: string;
  metadata?: string;
}

export interface EmbeddingChunk {
  id?: number;
  content_id: number;
  chunk_index: number;
  chunk_text: string;
  embedding_model: string;
  embedding: number[];
}

export interface Party {
  id?: number;
  name: string;
  abbreviation?: string;
}

export interface ProcessingLog {
  id?: number;
  source_type: string;
  external_id: string;
  url: string;
  status: 'success' | 'error' | 'pending';
  message?: string;
}

/**
 * Repository class for party-related operations
 */
export class PartyRepository {
  private async getDb(): Promise<Database> {
    return getDb();
  }

  /**
   * Get all parties
   */
  async getAllParties(): Promise<Party[]> {
    const db = await this.getDb();
    return db.all('SELECT * FROM parties ORDER BY name');
  }

  /**
   * Get a party by name
   */
  async getPartyByName(name: string): Promise<Party | undefined> {
    const db = await this.getDb();
    return db.get('SELECT * FROM parties WHERE name = ?', name);
  }

  /**
   * Get a party by abbreviation
   */
  async getPartyByAbbreviation(abbreviation: string): Promise<Party | undefined> {
    const db = await this.getDb();
    return db.get('SELECT * FROM parties WHERE abbreviation = ?', abbreviation);
  }

  /**
   * Get a party by ID
   */
  async getPartyById(id: number): Promise<Party | undefined> {
    const db = await this.getDb();
    return db.get('SELECT * FROM parties WHERE id = ?', id);
  }
}

/**
 * Repository class for source-related operations
 */
export class SourceRepository {
  private async getDb(): Promise<Database> {
    return getDb();
  }

  /**
   * Save a new source
   */
  async saveSource(source: Omit<Source, 'id' | 'created_at'>): Promise<number> {
    const db = await this.getDb();
    const result = await db.run(
      `INSERT INTO sources (party_id, title, source_type, url, external_id, date_published, language)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [source.party_id, source.title, source.source_type, source.url, source.external_id, source.date_published, source.language]
    );
    return result.lastID!;
  }

  /**
   * Check if a source exists by URL
   */
  async sourceExistsByUrl(url: string): Promise<boolean> {
    const db = await this.getDb();
    const result = await db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM sources WHERE url = ?',
      [url]
    );
    return (result?.count ?? 0) > 0;
  }

  /**
   * Get a source by URL
   */
  async getSourceByUrl(url: string): Promise<Source | null> {
    const db = await this.getDb();
    const result = await db.get<Source>(
      'SELECT * FROM sources WHERE url = ?',
      [url]
    );
    return result || null;
  }

  /**
   * Get sources by party ID
   */
  async getSourcesByPartyId(partyId: number): Promise<Source[]> {
    const db = await this.getDb();
    return db.all('SELECT * FROM sources WHERE party_id = ? ORDER BY date_published DESC', partyId);
  }

  // Add method to get sources by language
  async getSourcesByLanguage(language: string): Promise<Source[]> {
    const db = await this.getDb();
    return await db.all<Source[]>(
      'SELECT * FROM sources WHERE language = ?',
      [language]
    );
  }
}

/**
 * Repository class for content-related operations
 */
export class ContentRepository {
  private async getDb(): Promise<Database> {
    return getDb();
  }

  /**
   * Save new content
   */
  async saveContent(content: Content): Promise<number> {
    const db = await this.getDb();
    const result = await db.run(
      'INSERT INTO content (source_id, content_text, metadata) VALUES (?, ?, ?)',
      content.source_id, content.content_text, content.metadata
    );
    return result.lastID || 0;
  }

  /**
   * Get content by source ID
   */
  async getContentBySourceId(sourceId: number): Promise<Content | undefined> {
    const db = await this.getDb();
    return db.get('SELECT * FROM content WHERE source_id = ?', sourceId);
  }
}

/**
 * Repository class for embedding-related operations
 */
export class EmbeddingRepository {
  private async getDb(): Promise<Database> {
    return getDb();
  }

  /**
   * Save an embedding chunk
   */
  async saveEmbedding(embedding: EmbeddingChunk): Promise<number> {
    const db = await this.getDb();
    // Convert embedding array to Buffer for BLOB storage
    const embeddingBlob = embeddingToBuffer(embedding.embedding);
    
    const result = await db.run(
      `INSERT INTO embeddings (content_id, chunk_index, chunk_text, embedding_model, embedding) 
       VALUES (?, ?, ?, ?, ?)`,
      embedding.content_id, embedding.chunk_index, embedding.chunk_text, embedding.embedding_model, embeddingBlob
    );
    return result.lastID || 0;
  }

  /**
   * Save multiple embedding chunks in a transaction
   */
  async saveEmbeddings(embeddings: EmbeddingChunk[]): Promise<void> {
    if (embeddings.length === 0) return;
    
    const db = await this.getDb();
    const stmt = await db.prepare(
      `INSERT INTO embeddings (content_id, chunk_index, chunk_text, embedding_model, embedding) 
       VALUES (?, ?, ?, ?, ?)`
    );
    
    await db.run('BEGIN TRANSACTION');
    
    try {
      for (const embedding of embeddings) {
        const embeddingBlob = embeddingToBuffer(embedding.embedding);
        await stmt.run(
          embedding.content_id, 
          embedding.chunk_index, 
          embedding.chunk_text, 
          embedding.embedding_model, 
          embeddingBlob
        );
      }
      
      await db.run('COMMIT');
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    } finally {
      await stmt.finalize();
    }
  }

  /**
   * Get embeddings by content ID
   */
  async getEmbeddingsByContentId(contentId: number): Promise<EmbeddingChunk[]> {
    const db = await this.getDb();
    return db.all(
      'SELECT id, content_id, chunk_index, chunk_text, embedding_model FROM embeddings WHERE content_id = ? ORDER BY chunk_index',
      contentId
    );
  }
}

/**
 * Repository class for processing log operations
 */
export class ProcessingLogRepository {
  private async getDb(): Promise<Database> {
    return getDb();
  }

  /**
   * Log a processing attempt
   */
  async logProcessing(log: ProcessingLog): Promise<number> {
    const db = await this.getDb();
    
    try {
      // First check if there's already an entry for this URL
      const existing = await db.get(
        'SELECT id, status FROM processing_log WHERE url = ?',
        log.url
      );
      
      if (existing) {
        // If existing entry with same status, don't update
        if (existing.status === log.status) {
          return existing.id;
        }
        
        // If existing entry but different status, update it
        const result = await db.run(
          `UPDATE processing_log 
           SET source_type = ?, external_id = ?, status = ?, message = ?, processed_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          log.source_type, log.external_id, log.status, log.message, existing.id
        );
        return existing.id;
      } else {
        // Insert new record
        const result = await db.run(
          `INSERT INTO processing_log (source_type, external_id, url, status, message) 
           VALUES (?, ?, ?, ?, ?)`,
          log.source_type, log.external_id, log.url, log.status, log.message
        );
        return result.lastID || 0;
      }
    } catch (error) {
      // If there's a unique constraint error, it means another process inserted the record
      // between our check and insert. In this case, just return 0 
      console.warn(`Warning inserting processing log: ${error}`);
      return 0;
    }
  }

  /**
   * Check if a URL has been processed successfully
   */
  async hasBeenProcessed(url: string): Promise<boolean> {
    const db = await this.getDb();
    
    // First check processing_log
    const logResult = await db.get(
      'SELECT id FROM processing_log WHERE url = ? AND status = ?', 
      url, 'success'
    );
    
    if (logResult) {
      return true;
    }
    
    // Also check if URL exists in sources table 
    const sourceResult = await db.get(
      'SELECT id FROM sources WHERE url = ?',
      url
    );
    
    return !!sourceResult;
  }
} 