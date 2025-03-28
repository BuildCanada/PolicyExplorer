import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Constants
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || '1000', 10);
const CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP || '200', 10);
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'gemini';

// Initialize Google AI
const googleAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Supported embedding model types
type EmbeddingModelType = 'gemini' | 'openai';

// Add rate limiting and retry parameters
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000; // 5 seconds delay between retries
const API_RATE_LIMIT_DELAY_MS = 1000; // 1 second delay between API calls

/**
 * Sleep for the specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Text chunking functionality to break down large texts
 */
export function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  if (!text || text.length <= size) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + size;
    
    // Don't break in the middle of a sentence if possible
    if (end < text.length) {
      // Look for sentence-ending punctuation followed by space/newline
      const sentenceEnd = text.substring(end - 50, end + 50).search(/[.!?]\s/);
      if (sentenceEnd > 0) {
        end = end - 50 + sentenceEnd + 2; // +2 to include the punctuation and space
      } else {
        // Fall back to word boundaries
        const lastSpace = text.lastIndexOf(' ', end);
        if (lastSpace > start) {
          end = lastSpace + 1;
        }
      }
    }

    chunks.push(text.substring(start, Math.min(end, text.length)));
    start = end - overlap;
  }

  return chunks;
}

/**
 * Generate embeddings for a text chunk with retries and rate limiting
 */
export async function generateEmbeddings(text: string): Promise<number[]> {
  let retries = 0;
  
  while (retries <= MAX_RETRIES) {
    try {
      // Add a delay for rate limiting (only after the first try)
      if (retries > 0) {
        console.log(`  > Retry ${retries}/${MAX_RETRIES} for generating embeddings after ${RETRY_DELAY_MS}ms delay`);
        await sleep(RETRY_DELAY_MS);
      } else if (retries === 0) {
        // Add a smaller delay even for the first request to avoid hitting rate limits
        await sleep(API_RATE_LIMIT_DELAY_MS);
      }
      
      // Use the configured model
      if (embeddingConfig.provider === 'gemini') {
        const result = await generateGeminiEmbeddings(text);
        return result;
      } else {
        throw new Error(`Unsupported embedding provider: ${embeddingConfig.provider}`);
      }
    } catch (error: any) {
      retries++;
      
      // If it's a rate limit error (429), wait longer before retrying
      if (error.message && error.message.includes('429')) {
        const longerDelay = RETRY_DELAY_MS * retries;
        console.warn(`  > Rate limit reached (429 error). Waiting ${longerDelay}ms before retry ${retries}/${MAX_RETRIES}`);
        await sleep(longerDelay);
      }
      
      // If we've used all retries, throw the error
      if (retries > MAX_RETRIES) {
        console.error(`  > Failed to generate embeddings after ${MAX_RETRIES} retries`);
        throw error;
      }
    }
  }
  
  // This should never be reached due to the throw in the loop, but TypeScript needs a return
  throw new Error('Failed to generate embeddings');
}

/**
 * Generate embeddings using Google's text-embedding-004 model
 */
async function generateGeminiEmbeddings(text: string): Promise<number[]> {
  try {
    // Use the text-embedding-004 model which has better rate limits
    const model = googleAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    
    return result.embedding.values;
  } catch (error) {
    console.error('Error generating Gemini embeddings:', error);
    throw error;
  }
}

/**
 * Process text with chunking and embeddings
 */
export async function processTextWithEmbeddings(
  text: string
): Promise<Array<{ text: string; embedding: number[] }>> {
  const chunks = chunkText(text);
  const results: Array<{ text: string; embedding: number[] }> = [];
  
  // Process chunks with rate limiting
  for (let i = 0; i < chunks.length; i++) {
    try {
      console.log(`  > Processing chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)`);
      
      // Add a delay between chunks to avoid hitting rate limits
      if (i > 0) {
        await sleep(API_RATE_LIMIT_DELAY_MS);
      }
      
      const embedding = await generateEmbeddings(chunks[i]);
      results.push({ text: chunks[i], embedding });
    } catch (error) {
      console.error(`  > Error processing chunk ${i + 1}:`, error);
      throw error;
    }
  }
  
  return results;
}

/**
 * Convert a number array to Buffer for storage in SQLite
 */
export function embeddingToBuffer(embedding: number[]): Buffer {
  return Buffer.from(Float32Array.from(embedding).buffer);
}

/**
 * Convert a Buffer back to number array from SQLite storage
 */
export function bufferToEmbedding(buffer: Buffer): number[] {
  return Array.from(new Float32Array(buffer.buffer));
}

// Export the current configuration
export const embeddingConfig = {
  model: EMBEDDING_MODEL === 'gemini' ? 'text-embedding-004' : EMBEDDING_MODEL,
  provider: EMBEDDING_MODEL as EmbeddingModelType,
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP
}; 