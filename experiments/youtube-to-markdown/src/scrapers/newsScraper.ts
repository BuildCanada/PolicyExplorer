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

interface NewsPage {
  url: string;
  party_id: number;
  maxPages?: number; // Max number of pages to scrape (pagination)
  cutoffDate: string; // Format: 'YYYY-MM-DD'
}

interface NewsArticle {
  title: string;
  url: string;
  date: string; // Format: 'YYYY-MM-DD'
  language: string;
  content?: string;
  isAfterCutoff: boolean;
}

/**
 * Extract article links from a Liberal Party news page
 */
async function extractLiberalArticles(url: string, page: number = 1, cutoffDate: string): Promise<NewsArticle[]> {
  try {
    const pageUrl = page === 1 ? url : `${url}page/${page}/`;
    console.log(`Scraping Liberal news page: ${pageUrl}`);
    
    const response = await axios.get(pageUrl);
    const html = response.data as string;
    
    // Debug: Save HTML for inspection
    console.log(`Response HTML length: ${html.length} characters`);
    
    const $ = cheerio.load(html);
    const articles: NewsArticle[] = [];
    
    // Try more specific selectors based on the Liberal website structure
    $('.lp__content article, .article, .entry, .media-release, .post').each((i, el) => {
      try {
        const titleNode = $(el).find('h1, h2, h3, h4').first();
        const title = titleNode.text().trim();
        
        // Try to find the URL - first in the title's a tag, then in a "Read More" link
        let articleUrl = '';
        const titleLink = titleNode.find('a').first();
        if (titleLink.length) {
          articleUrl = titleLink.attr('href') || '';
        }
        
        // If no URL in title, look for specific "Read More" links  
        if (!articleUrl) {
          const readMoreLink = $(el).find('a.read-more, a.more-link, a:contains("Read More")').first();
          if (readMoreLink.length) {
            articleUrl = readMoreLink.attr('href') || '';
          }
        }
        
        // Liberal site often has a 'Read More' as text inside an a tag
        if (!articleUrl) {
          $(el).find('a').each((_, link) => {
            const linkText = $(link).text().toLowerCase().trim();
            if (linkText.includes('read more') || linkText.includes('read full')) {
              articleUrl = $(link).attr('href') || '';
              return false; // Break the loop
            }
          });
        }
        
        // If still no URL, look more broadly for any link
        if (!articleUrl) {
          const anyLink = $(el).find('a').first();
          if (anyLink.length) {
            articleUrl = anyLink.attr('href') || '';
          }
        }
        
        console.log(`Found article: "${title}" URL: ${articleUrl}`);
        
        // Try to extract date - Liberal site might have it in different formats
        let dateText = '';
        // Look for date in various formats
        dateText = $(el).find('.date, time, .posted-on, .entry-date, .post-date').first().text().trim();
        if (!dateText) {
          dateText = $(el).find('time').attr('datetime') || '';
        }
        
        console.log(`Date text found: "${dateText}"`);
        
        // Convert date format if needed
        let date = dateText;
        
        // Format the date properly as YYYY-MM-DD
        if (dateText) {
          // Handle possible date formats
          if (dateText.match(/\d{4}-\d{2}-\d{2}/)) {
            // Already in YYYY-MM-DD format
            date = dateText.match(/\d{4}-\d{2}-\d{2}/)![0];
          } else {
            // Try to parse other formats
            const parsedDate = new Date(dateText);
            if (!isNaN(parsedDate.getTime())) {
              date = parsedDate.toISOString().split('T')[0];
            } else {
              // Match patterns like "March 26, 2025"
              const dateMatch = dateText.match(/([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/);
              if (dateMatch) {
                const [_, month, day, year] = dateMatch;
                const monthNum = new Date(`${month} 1, 2000`).getMonth() + 1;
                date = `${year}-${monthNum.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
              } else {
                // If we can't parse, default to current date
                date = new Date().toISOString().split('T')[0];
              }
            }
          }
        } else {
          // Default to current date if no date is found
          date = new Date().toISOString().split('T')[0];
        }
        
        // Check if article is after cutoff date
        const isAfterCutoff = date >= cutoffDate;
        
        // Make the URL absolute if it's relative
        if (articleUrl && articleUrl.startsWith('/')) {
          const urlObj = new URL(url);
          articleUrl = `${urlObj.origin}${articleUrl}`;
        }
        
        if (articleUrl) {
          articles.push({
            title,
            url: articleUrl,
            date,
            isAfterCutoff,
            language: 'en'
          });
          
          console.log(`Added article: ${title}, Date: ${date}, After cutoff: ${isAfterCutoff}`);
        }
      } catch (error) {
        console.error(`Error extracting article info:`, error);
      }
    });
    
    // If we still didn't find articles, try a more generic approach
    if (articles.length === 0) {
      console.log('Trying alternative Liberal article detection method...');
      
      // Look for Read More links, they often point to articles
      $('a:contains("Read More")').each((i, el) => {
        try {
          const articleUrl = $(el).attr('href') || '';
          
          // Find the closest heading or container
          const title = $(el).closest('article, .post, .entry')
                       .find('h1, h2, h3, h4, .title, .post-title')
                       .first()
                       .text().trim();
          
          if (title && articleUrl) {
            // Use a default date (current) - we'll fetch the actual date when we scrape the article
            const date = new Date().toISOString().split('T')[0];
            const isAfterCutoff = date >= cutoffDate;
            
            articles.push({
              title,
              url: articleUrl,
              date,
              isAfterCutoff,
              language: 'en'
            });
            
            console.log(`Added article via alternative method: ${title} - ${articleUrl}`);
          }
        } catch (error) {
          console.error('Error in alternative article detection:', error);
        }
      });
    }
    
    console.log(`Found ${articles.length} articles on Liberal page ${page}`);
    return articles;
  } catch (error) {
    console.error(`Error scraping Liberal news page ${url}:`, error);
    return [];
  }
}

/**
 * Extract article links from a Conservative Party news page
 */
async function extractConservativeArticles(url: string, page: number = 1, cutoffDate: string): Promise<NewsArticle[]> {
  try {
    // Conservative site likely uses a different pagination mechanism
    const pageUrl = page === 1 ? url : `${url}&page=${page}`;
    console.log(`Scraping Conservative news page: ${pageUrl}`);
    
    const response = await axios.get(pageUrl);
    const html = response.data as string;
    
    // Debug: Save HTML for inspection
    console.log(`Response HTML length: ${html.length} characters`);
    
    const $ = cheerio.load(html);
    const articles: NewsArticle[] = [];
    
    // Look for specific news item structures
    console.log('Looking for Conservative news items...');

    // First specifically look for the grid-container pattern from the example
    console.log('Checking for grid-container article links...');
    $('.grid-container').each((i, el) => {
      try {
        // Get the direct link
        const linkEl = $(el).find('a').first();
        if (!linkEl.length) return;
        
        const href = linkEl.attr('href');
        if (!href) return;
        
        // Extract the post title and date
        const postTitle = $(el).find('.post-title').text().trim();
        const postDate = $(el).find('.post-date').text().trim();
        
        console.log(`Found grid-container article: "${postTitle}" (${postDate}) at URL: ${href}`);
        
        // Convert date if possible
        let date = new Date().toISOString().split('T')[0]; // Default to today
        
        if (postDate) {
          // Try to parse the date - expected format "March 26, 2025"
          const dateMatch = postDate.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
          if (dateMatch) {
            const [_, month, day, year] = dateMatch;
            const monthNum = new Date(`${month} 1, 2000`).getMonth() + 1;
            date = `${year}-${monthNum.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
          }
        }
        
        // Check if the article is after the cutoff date
        const isAfterCutoff = date >= cutoffDate;
        
        // Make the URL absolute if it's relative
        let fullUrl = href;
        if (href.startsWith('/')) {
          const urlObj = new URL(url);
          fullUrl = `${urlObj.origin}${href}`;
        }
        
        if (fullUrl && postTitle) {
          articles.push({
            title: postTitle,
            url: fullUrl,
            date,
            isAfterCutoff,
            language: 'en'
          });
          
          console.log(`Added grid-container article: ${postTitle}, Date: ${date}, After cutoff: ${isAfterCutoff}`);
        }
      } catch (error) {
        console.error(`Error extracting grid-container article:`, error);
      }
    });
    
    // Then continue with the existing detection methods
    $('#content article, .news-item, .post, li.post, .news-card').each((i, el) => {
      try {
        // Find the title - try different approaches
        let title = '';
        let titleNode = $(el).find('h1, h2, h3, h4, h5, .entry-title, .news-title, .post-title').first();
        
        if (titleNode.length) {
          title = titleNode.text().trim();
        } else {
          // Alternative: look for strong text that might be a title
          titleNode = $(el).find('strong').first();
          title = titleNode.text().trim();
        }
        
        // Try different strategies to find the URL
        let articleUrl = '';
        
        // First try a link in the title
        if (titleNode.length) {
          const titleLink = titleNode.find('a').first();
          if (titleLink.length) {
            articleUrl = titleLink.attr('href') || '';
          }
        }
        
        // If no URL in title, look for a link containing the title text
        if (!articleUrl && title) {
          $(el).find('a').each((_, link) => {
            const linkText = $(link).text().trim();
            if (linkText === title || title.includes(linkText) || linkText.includes(title)) {
              articleUrl = $(link).attr('href') || '';
              return false; // Break the loop
            }
          });
        }
        
        // If still no URL, look for any "Read More" type links
        if (!articleUrl) {
          const readMoreLink = $(el).find('a:contains("Read More"), a:contains("Continue"), a.more-link').first();
          if (readMoreLink.length) {
            articleUrl = readMoreLink.attr('href') || '';
          }
        }
        
        // Last resort: get the first link
        if (!articleUrl) {
          const anyLink = $(el).find('a').first();
          if (anyLink.length) {
            articleUrl = anyLink.attr('href') || '';
          }
        }
        
        console.log(`Found article: "${title}" URL: ${articleUrl}`);
        
        // Try to extract date with various selectors
        let dateText = $(el).find('.date, time, .meta-date, .entry-date, .posted-on').text().trim();
        
        if (!dateText) {
          // Look for date in the meta section
          dateText = $(el).find('.entry-meta, .post-meta, .meta').text().trim();
          
          // Extract date pattern if found
          const metaDateMatch = dateText.match(/[A-Za-z]+ \d{1,2},? \d{4}/);
          if (metaDateMatch) {
            dateText = metaDateMatch[0];
          }
        }
        
        console.log(`Date text found: "${dateText}"`);
        
        // If the date is in a format like "March 26, 2025", convert it
        let date = dateText;
        
        if (dateText) {
          // Check if it matches the format "Month DD, YYYY" or variants
          const dateMatch = dateText.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
          if (dateMatch) {
            const [_, month, day, year] = dateMatch;
            const monthNum = new Date(`${month} 1, 2000`).getMonth() + 1;
            date = `${year}-${monthNum.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
          } else {
            // Try to parse other formats
            const parsedDate = new Date(dateText);
            if (!isNaN(parsedDate.getTime())) {
              date = parsedDate.toISOString().split('T')[0];
            } else {
              // If we can't parse, default to current date
              date = new Date().toISOString().split('T')[0];
            }
          }
        } else {
          // Default to current date if no date is found
          date = new Date().toISOString().split('T')[0];
        }
        
        // Check if article is after cutoff date
        const isAfterCutoff = date >= cutoffDate;
        
        // If the URL is relative, make it absolute
        let fullUrl = articleUrl;
        if (articleUrl && articleUrl.startsWith('/')) {
          const urlObj = new URL(url);
          fullUrl = `${urlObj.origin}${articleUrl}`;
        }
        
        if (fullUrl && title) {
          articles.push({
            title,
            url: fullUrl,
            date,
            isAfterCutoff,
            language: 'en'
          });
          
          console.log(`Added article: ${title}, Date: ${date}, After cutoff: ${isAfterCutoff}`);
        }
      } catch (error) {
        console.error(`Error extracting Conservative article info:`, error);
      }
    });
    
    // If we still didn't find any articles, try a more generic approach
    if (articles.length === 0) {
      console.log('Trying alternative Conservative article detection method...');
      
      // Just look for links that might be news items
      $('a').each((i, el) => {
        const $el = $(el);
        const href = $el.attr('href');
        
        // Skip navigation and social media links
        if (!href || href.includes('#') || href.includes('facebook') || 
            href.includes('twitter') || href.includes('instagram')) {
          return;
        }
        
        // Only process links that might be news articles
        if (href.includes('/news/') || href.includes('/media/') || 
            href.includes('statement') || href.includes('announces')) {
          
          const title = $el.text().trim();
          
          if (title && title.length > 15) { // Assuming real titles are longer than 15 chars
            // Use a default date (current) - we'll fetch the actual date when we scrape the article
            const date = new Date().toISOString().split('T')[0];
            const isAfterCutoff = date >= cutoffDate;
            
            // Make URL absolute if needed
            let fullUrl = href;
            if (href.startsWith('/')) {
              const urlObj = new URL(url);
              fullUrl = `${urlObj.origin}${href}`;
            }
            
            articles.push({
              title,
              url: fullUrl,
              date,
              isAfterCutoff,
              language: 'en'
            });
            
            console.log(`Added article via alternative method: ${title} - ${fullUrl}`);
          }
        }
      });
    }
    
    console.log(`Found ${articles.length} articles on Conservative page ${page}`);
    return articles;
  } catch (error) {
    console.error(`Error scraping Conservative news page ${url}:`, error);
    return [];
  }
}

/**
 * Scrape a single news article and extract its content
 */
async function scrapeArticleContent(article: NewsArticle, partyId: number): Promise<string> {
  try {
    console.log(`Scraping article: ${article.url}`);
    
    const response = await axios.get(article.url);
    const html = response.data as string;
    const $ = cheerio.load(html);
    
    // Save HTML length for debugging
    console.log(`  > Article HTML length: ${html.length} characters`);
    
    // Use different selectors based on party
    let contentSelector = '';
    
    if (partyId === 1) { // Liberal
      contentSelector = '.post-content, .article-content, .entry-content, main';
    } else if (partyId === 2) { // Conservative
      // Conservative sites often put main content in these areas
      contentSelector = '#content, .content, article, .post-content, .entry-content, main, .article-main, .announcement, .article-body, .main-content';
    }
    
    // First remove unwanted elements that might contain noise
    $('script, style, nav, header, footer, .site-header, .site-footer, .nav, .menu, .sidebar, .signup-form, .newsletter, form').remove();
    
    // For Conservative pages, try to get the full announcement or article section
    let content = '';
    
    if (partyId === 2) {
      // Conservative site: look for main content within articles
      // First try the selector
      content = $(contentSelector).text();
      
      // If main selector didn't get enough content, try more specific approaches
      if (!content || content.length < 100) {
        // Try to find date, title and content
        const title = $('h1, h2.entry-title, .entry-title').first().text().trim();
        console.log(`  > Found article title: "${title}"`);
        
        // Find content paragraphs - typically the meat of the content
        const paragraphs: string[] = [];
        $('article p, .content p, #content p, main p').each((_, el) => {
          const text = $(el).text().trim();
          if (text && text.length > 20) { // Only substantial paragraphs
            paragraphs.push(text);
          }
        });
        
        // If we have title and paragraphs, combine them
        if (title && paragraphs.length > 0) {
          content = title + '\n\n' + paragraphs.join('\n\n');
        }
      }
      
      // If still not enough content, look for any non-empty p tags
      if (!content || content.length < 100) {
        const allParagraphs: string[] = [];
        $('p').each((_, el) => {
          const text = $(el).text().trim();
          if (text && text.length > 20) {
            allParagraphs.push(text);
          }
        });
        
        content = allParagraphs.join('\n\n');
      }
    } else {
      // Liberal site: try the main content selector
      content = $(contentSelector).text();
    }
    
    // If still no content found with specific selectors, try to get the body text
    if (!content || content.length < 100) {
      console.log('  > Falling back to basic body content extraction');
      
      // Look for any reasonable size text blocks
      const textBlocks: string[] = [];
      $('body').find('p, h1, h2, h3, h4, h5, li').each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 15) {
          textBlocks.push(text);
        }
      });
      
      content = textBlocks.join('\n\n');
    }
    
    // Final fallback - just get all body text
    if (!content || content.length < 100) {
      content = $('body').text();
    }
    
    // Clean up the content
    content = content.replace(/\s+/g, ' ').trim();
    
    // For Conservative articles, try to update the article.date with actual date if found
    if (partyId === 2) {
      // Look for date patterns
      const dateText = $('.date, time, .meta-date, .entry-date, .posted-on').text().trim();
      if (dateText) {
        console.log(`  > Found date text: "${dateText}"`);
        // Try to extract and parse the date
        const dateMatch = dateText.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
        if (dateMatch) {
          const [_, month, day, year] = dateMatch;
          const monthNum = new Date(`${month} 1, 2000`).getMonth() + 1;
          article.date = `${year}-${monthNum.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
          console.log(`  > Updated article date to ${article.date}`);
        }
      }
    }
    
    console.log(`  > Extracted content length: ${content.length} characters`);
    
    return content;
  } catch (error) {
    console.error(`Error scraping article ${article.url}:`, error);
    return `Failed to scrape content: ${error}`;
  }
}

/**
 * Save an article to the database
 */
async function saveArticle(article: NewsArticle, partyId: number): Promise<void> {
  try {
    // Check if we've already processed this URL
    const hasProcessed = await logRepo.hasBeenProcessed(article.url);
    if (hasProcessed) {
      console.log(`  > Article ${article.url} already processed, skipping`);
      return;
    }
    
    // Log pending processing
    await logRepo.logProcessing({
      source_type: 'news_article',
      external_id: article.url,
      url: article.url,
      status: 'pending'
    });
    
    // Scrape the article content if not already present
    if (!article.content) {
      article.content = await scrapeArticleContent(article, partyId);
    }
    
    if (!article.content) {
      throw new Error('Failed to extract article content');
    }
    
    // Save source
    const sourceId = await sourceRepo.saveSource({
      party_id: partyId,
      title: article.title,
      source_type: 'news_article',
      url: article.url,
      date_published: article.date,
      language: article.language
    });
    
    // Save content
    const contentId = await contentRepo.saveContent({
      source_id: sourceId,
      content_text: article.content,
      metadata: JSON.stringify({ 
        type: 'news_article',
        date: article.date,
        party_id: partyId
      })
    });
    
    // Process with embeddings
    console.log(`  > Generating embeddings for article: ${article.title}`);
    const processedChunks = await processTextWithEmbeddings(article.content);
    
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
      source_type: 'news_article',
      external_id: article.url,
      url: article.url,
      status: 'success'
    });
    
    console.log(`  > Successfully saved article to database: ${article.title}`);
  } catch (error: any) {
    console.error(`  > Error saving article to database: ${error.message}`);
    
    // Log failed processing
    await logRepo.logProcessing({
      source_type: 'news_article',
      external_id: article.url,
      url: article.url,
      status: 'error',
      message: error.message
    });
  }
}

/**
 * Process a news website and its articles
 */
export async function processNewsWebsite(newsPage: NewsPage): Promise<void> {
  console.log(`Processing news website: ${newsPage.url} for party ID: ${newsPage.party_id}`);
  
  const maxPages = newsPage.maxPages || 5; // Default to 5 pages if not specified
  let allArticles: NewsArticle[] = [];
  
  // Extract articles based on party
  for (let page = 1; page <= maxPages; page++) {
    let articles: NewsArticle[] = [];
    
    if (newsPage.party_id === 1) { // Liberal
      articles = await extractLiberalArticles(newsPage.url, page, newsPage.cutoffDate);
    } else if (newsPage.party_id === 2) { // Conservative
      articles = await extractConservativeArticles(newsPage.url, page, newsPage.cutoffDate);
      
      // For Conservative Party, we want to specifically look for all linked news articles
      if (page === 1) {
        console.log('Collecting all Conservative news article links from the news page...');
        
        try {
          const response = await axios.get(newsPage.url);
          const $ = cheerio.load(response.data as string);
          
          // Find all news links on the page
          $('a').each((_, link) => {
            const href = $(link).attr('href');
            // Skip if no href or it's an external link or non-news link
            if (!href || href.includes('://') && !href.includes('conservative.ca') || 
                href.includes('#') || href.includes('?')) {
              return;
            }
            
            // Check if it looks like a news article URL
            if (href.includes('/news/') || href.includes('/statement') || 
                href.includes('/announces') || href.includes('/lower-taxes') || 
                href.includes('/axe') || href.includes('/secure')) {
              
              // Get the text and clean it up
              const linkText = $(link).text().trim();
              if (linkText.length > 15) { // Avoid navigation links
                // Make URL absolute if needed
                let fullUrl = href;
                if (href.startsWith('/')) {
                  const urlObj = new URL(newsPage.url);
                  fullUrl = `${urlObj.origin}${href}`;
                } else if (!href.startsWith('http')) {
                  const urlObj = new URL(newsPage.url);
                  fullUrl = `${urlObj.origin}/${href}`;
                }
                
                // Avoid duplicates
                if (!articles.some(a => a.url === fullUrl)) {
                  // Use current date as default, will be updated when we fetch the article
                  const today = new Date().toISOString().split('T')[0];
                  
                  articles.push({
                    title: linkText,
                    url: fullUrl,
                    date: today,
                    isAfterCutoff: today >= newsPage.cutoffDate,
                    language: 'en'
                  });
                  
                  console.log(`Added news article from link: ${linkText} - ${fullUrl}`);
                }
              }
            }
          });
        } catch (error) {
          console.error('Error collecting Conservative news links:', error);
        }
      }
    }
    
    // Filter to keep only articles after the cutoff date
    const newArticles = articles.filter(article => article.isAfterCutoff);
    console.log(`Found ${newArticles.length} new articles after ${newsPage.cutoffDate} on page ${page}`);
    
    allArticles = [...allArticles, ...newArticles];
    
    // If we found fewer articles than expected, assume we've reached the end
    if (articles.length === 0 || articles.length < 10) {
      break;
    }
  }
  
  console.log(`Total new articles to process: ${allArticles.length}`);
  
  // Process each article
  for (const article of allArticles) {
    try {
      await saveArticle(article, newsPage.party_id);
    } catch (error) {
      console.error(`Error processing article ${article.url}:`, error);
    }
  }
  
  console.log(`Finished processing news website: ${newsPage.url}`);
}

/**
 * Process multiple news websites
 */
export async function processNewsWebsites(newsPages: NewsPage[]): Promise<void> {
  console.log(`Starting to process ${newsPages.length} news websites...`);
  
  for (const newsPage of newsPages) {
    try {
      await processNewsWebsite(newsPage);
    } catch (error) {
      console.error(`Error processing news website ${newsPage.url}:`, error);
    }
  }
  
  console.log('Finished processing all news websites.');
} 