# Embedding Models

## Current Implementation

As of July 2024, we use Google's `gemini-embedding-exp-03-07` model, which is their latest experimental embedding model. This model is more recent than `text-embedding-004` (released in April 2024).

### Model Properties

#### gemini-embedding-exp-03-07
- 3072 dimensions for embeddings (confirmed through testing)
- Experimental model with improved performance
- Higher dimensional representation compared to previous models
- Processing time of approximately 700-800ms per embedding generation

## Configuration

Embedding settings can be configured in `.env`:
- `EMBEDDING_MODEL=gemini` (uses gemini-embedding-exp-03-07)
- `CHUNK_SIZE=1000` (size of text chunks for processing)
- `CHUNK_OVERLAP=200` (overlap between text chunks)

## Chunking Strategy

We use a smart chunking strategy that:
1. Breaks text into manageable chunks of ~1000 tokens
2. Maintains 200 tokens of overlap between chunks for context preservation
3. Tries to break at natural sentence boundaries rather than mid-sentence
4. Falls back to word boundaries if needed

## Storage

Embeddings are stored in SQLite as binary BLOB fields, with helper functions:
- `embeddingToBuffer`: Converts number arrays to Buffer for storage
- `bufferToEmbedding`: Converts Buffer back to number arrays

## Testing

We've included a test script to verify embedding functionality:

```bash
npm run test:embeddings
```

This script demonstrates the embedding process and outputs dimension information and processing time.

## Updating Models

To update the embedding model:
1. Edit `src/services/embeddingService.ts`
2. Update the model name in `generateGeminiEmbeddings()`
3. Run the test script to verify the new model works correctly 