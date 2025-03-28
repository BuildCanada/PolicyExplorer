"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.processWebpages = processWebpages;
exports.scrapeNewsPage = scrapeNewsPage;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const repository_1 = require("../database/repository");
const embeddingService_1 = require("../services/embeddingService");
const repository_2 = require("../database/repository");
// Initialize repositories
const sourceRepo = new repository_1.SourceRepository();
const contentRepo = new repository_1.ContentRepository();
const logRepo = new repository_1.ProcessingLogRepository();
const embeddingRepo = new repository_2.EmbeddingRepository();
/**
 * Scrape a web page and extract its text content
 */
function scrapeWebPage(webpage) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log(`Scraping webpage: ${webpage.url}`);
            // Check if we've already processed this URL
            const hasProcessed = yield logRepo.hasBeenProcessed(webpage.url);
            if (hasProcessed) {
                console.log(`  > URL ${webpage.url} already processed, skipping`);
                return null;
            }
            // Log pending processing
            yield logRepo.logProcessing({
                source_type: 'webpage',
                external_id: webpage.url,
                url: webpage.url,
                status: 'pending'
            });
            // Fetch webpage
            const response = yield axios_1.default.get(webpage.url);
            const html = response.data;
            // Parse HTML
            const $ = cheerio.load(html);
            // Get page title
            const title = $('title').text().trim();
            // Extract content based on selector or default to main content areas
            let contentSelector = webpage.selector || 'main, article, .content, .main-content, #content, #main-content';
            let content = $(contentSelector).text();
            // If no content found with specific selectors, try to get the body text
            if (!content.trim()) {
                // Remove script, style, nav, header, footer elements
                $('script, style, nav, header, footer').remove();
                content = $('body').text();
            }
            // Clean up the content - remove excessive whitespace
            content = content.replace(/\s+/g, ' ').trim();
            if (!content) {
                throw new Error('No content could be extracted from the page');
            }
            console.log(`  > Successfully scraped page. Title: ${title}, Content length: ${content.length}`);
            return {
                title,
                content
            };
        }
        catch (error) {
            console.error(`Error scraping ${webpage.url}:`, error.message || error);
            // Log failed processing
            yield logRepo.logProcessing({
                source_type: 'webpage',
                external_id: webpage.url,
                url: webpage.url,
                status: 'error',
                message: error.message
            });
            return null;
        }
    });
}
/**
 * Save scraped content to the database
 */
function saveScrapedContent(webpage, title, content) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Save source
            const sourceId = yield sourceRepo.saveSource({
                party_id: webpage.party_id,
                title: title,
                source_type: 'webpage',
                url: webpage.url,
                date_published: new Date().toISOString().split('T')[0],
                language: detectLanguage(title, content)
            });
            // Save content
            const contentId = yield contentRepo.saveContent({
                source_id: sourceId,
                content_text: content,
                metadata: JSON.stringify({ type: 'webpage' })
            });
            // Process with embeddings
            console.log(`  > Generating embeddings for webpage ${webpage.url}`);
            const processedChunks = yield (0, embeddingService_1.processTextWithEmbeddings)(content);
            // Save embeddings
            for (let i = 0; i < processedChunks.length; i++) {
                const { text, embedding } = processedChunks[i];
                yield embeddingRepo.saveEmbedding({
                    content_id: contentId,
                    chunk_index: i,
                    chunk_text: text,
                    embedding_model: embeddingService_1.embeddingConfig.model,
                    embedding: embedding
                });
            }
            console.log(`  > Saved ${processedChunks.length} chunks with embeddings`);
            // Log successful processing
            yield logRepo.logProcessing({
                source_type: 'webpage',
                external_id: webpage.url,
                url: webpage.url,
                status: 'success'
            });
            console.log(`  > Successfully saved webpage to database with ID ${sourceId}`);
        }
        catch (error) {
            console.error(`  > Error saving webpage content to database: ${error.message}`);
            // Log failed processing
            yield logRepo.logProcessing({
                source_type: 'webpage',
                external_id: webpage.url,
                url: webpage.url,
                status: 'error',
                message: error.message
            });
        }
    });
}
/**
 * Process a list of webpages to scrape
 */
function processWebpages(webpages) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`Starting to process ${webpages.length} webpages...`);
        for (const webpage of webpages) {
            try {
                const scrapedData = yield scrapeWebPage(webpage);
                if (scrapedData) {
                    yield saveScrapedContent(webpage, scrapedData.title, scrapedData.content);
                }
            }
            catch (error) {
                console.error(`Error processing webpage ${webpage.url}:`, error.message || error);
            }
        }
        console.log('Finished processing webpages.');
    });
}
// Example usage:
// const pagesToScrape = [
//   { 
//     url: 'https://liberal.ca/our-platform', 
//     party_id: 1, // Liberal Party ID
//     selector: '.platform-content'
//   },
//   {
//     url: 'https://conservative.ca/plan',
//     party_id: 2, // Conservative Party ID
//     selector: '.policy-content'
//   }
// ];
// 
// processWebpages(pagesToScrape).catch(error => {
//   console.error("Unhandled error during web scraping:", error);
//   process.exit(1);
// }); 
// Function to detect language from title and content
function detectLanguage(title, content) {
    // Simple language detection based on common French words and patterns
    const frenchWords = ['le', 'la', 'les', 'un', 'une', 'des', 'et', 'en', 'de', 'du', 'des'];
    const frenchPatterns = /[éèêëàâäôöûüçîï]|(le|la|les|un|une|des)\s/i;
    const textToCheck = `${title} ${content}`.toLowerCase();
    // Count French words
    const frenchWordCount = frenchWords.filter(word => textToCheck.includes(` ${word} `) ||
        textToCheck.startsWith(`${word} `) ||
        textToCheck.endsWith(` ${word}`)).length;
    // Check for French patterns
    const hasFrenchPatterns = frenchPatterns.test(textToCheck);
    // If we find French words or patterns, mark as French
    if (frenchWordCount > 2 || hasFrenchPatterns) {
        return 'fr';
    }
    // Default to English
    return 'en';
}
function scrapeNewsPage(url) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log(`Fetching webpage: ${url}`);
            const response = yield axios_1.default.get(url);
            const html = response.data;
            const $ = cheerio.load(html);
            // Detect language from the page content
            const language = detectLanguage($('title').text(), $('body').text());
            console.log(`Detected language: ${language}`);
            // Extract articles
            const articles = [];
            $('article, .post, .entry, .media-release').each((_, element) => {
                const $element = $(element);
                const title = $element.find('h1, h2, h3, .title, .entry-title').first().text().trim();
                const link = $element.find('a').first().attr('href');
                const date = $element.find('.date, .entry-date, time').first().text().trim();
                if (title && link) {
                    articles.push({
                        title,
                        url: link.startsWith('http') ? link : new URL(link, url).href,
                        date: date || new Date().toISOString().split('T')[0],
                        language
                    });
                }
            });
            return articles;
        }
        catch (error) {
            console.error(`Error scraping ${url}:`, error);
            return [];
        }
    });
}
