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
const embeddingService_1 = require("./services/embeddingService");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
function testEmbeddings() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`Testing embedding model: ${embeddingService_1.embeddingConfig.model}`);
        try {
            const testText = "This is a test to verify that the embedding model is working correctly.";
            console.log(`Generating embeddings for: "${testText}"`);
            const startTime = Date.now();
            const embedding = yield (0, embeddingService_1.generateEmbeddings)(testText);
            const endTime = Date.now();
            console.log(`Successfully generated embedding with ${embedding.length} dimensions`);
            console.log(`Time taken: ${endTime - startTime}ms`);
            // Print the first 5 embedding values to verify
            console.log("First 5 embedding values:");
            console.log(embedding.slice(0, 5));
            console.log("Embedding test completed successfully!");
        }
        catch (error) {
            console.error("Error testing embeddings:", error);
            process.exit(1);
        }
    });
}
// Run the test
testEmbeddings().catch(error => {
    console.error("Unhandled error during embedding test:", error);
    process.exit(1);
});
