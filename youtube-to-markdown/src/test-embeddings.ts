import { generateEmbeddings, embeddingConfig } from './services/embeddingService';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testEmbeddings() {
  console.log(`Testing embedding model: ${embeddingConfig.model}`);
  
  try {
    const testText = "This is a test to verify that the embedding model is working correctly.";
    console.log(`Generating embeddings for: "${testText}"`);
    
    const startTime = Date.now();
    const embedding = await generateEmbeddings(testText);
    const endTime = Date.now();
    
    console.log(`Successfully generated embedding with ${embedding.length} dimensions`);
    console.log(`Time taken: ${endTime - startTime}ms`);
    
    // Print the first 5 embedding values to verify
    console.log("First 5 embedding values:");
    console.log(embedding.slice(0, 5));
    
    console.log("Embedding test completed successfully!");
  } catch (error) {
    console.error("Error testing embeddings:", error);
    process.exit(1);
  }
}

// Run the test
testEmbeddings().catch(error => {
  console.error("Unhandled error during embedding test:", error);
  process.exit(1);
}); 