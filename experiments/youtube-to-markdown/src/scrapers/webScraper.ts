import axios from 'axios';
import * as cheerio from 'cheerio';
import { ContentRepository, ProcessingLogRepository, SourceRepository } from '../database/repository';
import { processTextWithEmbeddings, embeddingConfig } from '../services/embeddingService';
import { EmbeddingRepository } from '../database/repository';

// Initialize repositories
const sourceRepo = new SourceRepository();
const contentRepo = new ContentRepository();
const logRepo = new ProcessingLogRepository();
const embeddingRepo = new EmbeddingRepository();

interface WebPage {
  url: string;
  party_id: number;
  selector?: string; // Optional CSS selector to target specific content
}

interface ScrapedArticle {
  title: string;
  url: string;
  date: string;
  language: string;  // Add language field
}

/**
 * Scrape a web page and extract its text content
 */
async function scrapeWebPage(webpage: WebPage): Promise<{ title: string, content: string } | null> {
  try {
    console.log(`Scraping webpage: ${webpage.url}`);
    
    // Check if we've already processed this URL
    const hasProcessed = await logRepo.hasBeenProcessed(webpage.url);
    if (hasProcessed) {
      console.log(`  > URL ${webpage.url} already processed, skipping`);
      return null;
    }
    
    // Log pending processing
    await logRepo.logProcessing({
      source_type: 'webpage',
      external_id: webpage.url,
      url: webpage.url,
      status: 'pending'
    });
    
    // Fetch webpage
    const response = await axios.get(webpage.url);
    const html = response.data as string;
    
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
  } catch (error: any) {
    console.error(`Error scraping ${webpage.url}:`, error.message || error);
    
    // Log failed processing
    await logRepo.logProcessing({
      source_type: 'webpage',
      external_id: webpage.url,
      url: webpage.url,
      status: 'error', 
      message: error.message
    });
    
    return null;
  }
}

/**
 * Save scraped content to the database
 */
async function saveScrapedContent(webpage: WebPage, title: string, content: string): Promise<void> {
  try {
    // Save source
    const sourceId = await sourceRepo.saveSource({
      party_id: webpage.party_id,
      title: title,
      source_type: 'webpage',
      url: webpage.url,
      date_published: new Date().toISOString().split('T')[0],
      language: detectLanguage(title, content)
    });
    
    // Save content
    const contentId = await contentRepo.saveContent({
      source_id: sourceId,
      content_text: content,
      metadata: JSON.stringify({ type: 'webpage' })
    });
    
    // Process with embeddings
    console.log(`  > Generating embeddings for webpage ${webpage.url}`);
    const processedChunks = await processTextWithEmbeddings(content);
    
    // Save embeddings
    for (let i = 0; i < processedChunks.length; i++) {
      const { text, embedding } = processedChunks[i];
      
      await embeddingRepo.saveEmbedding({
        content_id: contentId,
        chunk_index: i,
        chunk_text: text,
        embedding_model: embeddingConfig.model,
        embedding: embedding
      });
    }
    
    console.log(`  > Saved ${processedChunks.length} chunks with embeddings`);
    
    // Log successful processing
    await logRepo.logProcessing({
      source_type: 'webpage',
      external_id: webpage.url,
      url: webpage.url,
      status: 'success'
    });
    
    console.log(`  > Successfully saved webpage to database with ID ${sourceId}`);
  } catch (error: any) {
    console.error(`  > Error saving webpage content to database: ${error.message}`);
    
    // Log failed processing
    await logRepo.logProcessing({
      source_type: 'webpage',
      external_id: webpage.url,
      url: webpage.url,
      status: 'error',
      message: error.message
    });
  }
}

/**
 * Process a list of webpages to scrape
 */
export async function processWebpages(webpages: WebPage[]): Promise<void> {
  console.log(`Starting to process ${webpages.length} webpages...`);
  
  for (const webpage of webpages) {
    try {
      const scrapedData = await scrapeWebPage(webpage);
      
      if (scrapedData) {
        await saveScrapedContent(webpage, scrapedData.title, scrapedData.content);
      }
    } catch (error: any) {
      console.error(`Error processing webpage ${webpage.url}:`, error.message || error);
    }
  }
  
  console.log('Finished processing webpages.');
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
function detectLanguage(title: string, content: string): string {
  // Simple language detection based on common French words and patterns
  const frenchWords = ['le', 'la', 'les', 'un', 'une', 'des', 'et', 'en', 'de', 'du', 'des'];
  const frenchPatterns = /[éèêëàâäôöûüçîï]|(le|la|les|un|une|des)\s/i;
  
  const textToCheck = `${title} ${content}`.toLowerCase();
  
  // Count French words
  const frenchWordCount = frenchWords.filter(word => 
    textToCheck.includes(` ${word} `) || 
    textToCheck.startsWith(`${word} `) || 
    textToCheck.endsWith(` ${word}`)
  ).length;
  
  // Check for French patterns
  const hasFrenchPatterns = frenchPatterns.test(textToCheck);
  
  // If we find French words or patterns, mark as French
  if (frenchWordCount > 2 || hasFrenchPatterns) {
    return 'fr';
  }
  
  // Default to English
  return 'en';
}

export async function scrapeNewsPage(url: string): Promise<ScrapedArticle[]> {
  try {
    console.log(`Fetching webpage: ${url}`);
    const response = await axios.get(url);
    const html = response.data as string;
    const $ = cheerio.load(html);
    
    // Detect language from the page content
    const language = detectLanguage($('title').text(), $('body').text());
    console.log(`Detected language: ${language}`);
    
    // Extract articles
    const articles: ScrapedArticle[] = [];
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
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return [];
  }
} 