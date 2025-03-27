import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { YoutubeTranscript } from 'youtube-transcript';
import { VideoInput, getVideosToProcess } from './VideoList';
import { ContentRepository, EmbeddingRepository, PartyRepository, ProcessingLogRepository, SourceRepository } from './database/repository';
import { chunkText, embeddingConfig, generateEmbeddings } from './services/embeddingService';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Set the cutoff date - only process videos published after this date
// For real-world usage, set a reasonable date in the past (e.g., 2 months ago)
// This ensures we can actually find videos on YouTube channels
// const twoMonthsAgo = new Date();
// twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
// const CUTOFF_DATE = twoMonthsAgo.toISOString().split('T')[0]; // Format: YYYY-MM-DD
const CUTOFF_DATE = '2025-03-20'; // Hardcoded cutoff date: March 20, 2025

console.log(`Using cutoff date: ${CUTOFF_DATE} (will only process videos published after this date)`);

// Check if --latest flag is provided
const useLatestOnly = process.argv.includes('--latest');

// Parse max videos parameter (--max=N)
let maxVideos = 100; // Increased default to 100 videos to process more by default
const maxArg = process.argv.find(arg => arg.startsWith('--max='));
if (maxArg) {
  const maxValue = parseInt(maxArg.split('=')[1], 10);
  if (!isNaN(maxValue) && maxValue > 0) {
    maxVideos = maxValue;
    console.log(`Will process up to ${maxVideos} videos`);
  } else {
    console.warn(`Invalid --max value, using default of ${maxVideos}`);
  }
}

const execAsync = promisify(exec);

const OUTPUT_DIR = path.resolve(__dirname, '../markdown'); // Output to 'markdown' folder

// Initialize repositories
const partyRepo = new PartyRepository();
const sourceRepo = new SourceRepository();
const contentRepo = new ContentRepository();
const embeddingRepo = new EmbeddingRepository();
const logRepo = new ProcessingLogRepository();

interface VideoMetadata {
  id: string;
  title: string;
  upload_date: string; // YYYYMMDD format from yt-dlp
  webpage_url: string;
  description?: string; // Optional description
  language?: string;  // Add language field
}

// Function to fetch metadata using yt-dlp
async function getVideoMetadata(youtubeUrl: string): Promise<VideoMetadata | null> {
  console.log(`Fetching metadata for: ${youtubeUrl}`);
  try {
    const command = `yt-dlp --dump-json --skip-download ${youtubeUrl}`;
    const { stdout, stderr } = await execAsync(command);

    if (stderr) {
      console.warn(`[yt-dlp stderr for ${youtubeUrl}]: ${stderr}`);
    }

    const metadata: VideoMetadata = JSON.parse(stdout);
    // Basic validation
    if (!metadata.id || !metadata.title || !metadata.upload_date) {
      console.error(`Error: Missing essential metadata for ${youtubeUrl}`);
      return null;
    }
    
    // Set default language to English (already filtered by VideoList)
    metadata.language = 'en';
    console.log(`  > Fetched Title: ${metadata.title}`);
    console.log(`  > Upload Date: ${formatDate(metadata.upload_date)}`);
    
    return metadata;
  } catch (error: any) {
    console.error(`Error fetching metadata for ${youtubeUrl}:`, error.message || error);
    return null;
  }
}

// Function to fetch transcript using youtube-transcript
async function getTranscript(youtubeUrl: string): Promise<string | null> {
  console.log(`Fetching transcript for: ${youtubeUrl}`);
  try {
    const transcriptItems = await YoutubeTranscript.fetchTranscript(youtubeUrl, {
        lang: 'en' // Prioritize English - change if needed or add fallback logic
    });

    if (!transcriptItems || transcriptItems.length === 0) {
        console.warn(`  > No transcript found for ${youtubeUrl}`);
        return null;
    }

    // Combine transcript parts into a single string
    const fullTranscript = transcriptItems.map(item => item.text).join(' ');
    console.log(`  > Fetched transcript (length: ${fullTranscript.length})`);
    return fullTranscript;
  } catch (error: any) {
     // Handle common error: Transcripts disabled
     if (error.message && error.message.includes('disabled transcript')) {
         console.warn(`  > Transcripts are disabled for ${youtubeUrl}`);
     } else if (error.message && error.message.includes('No transcript found')) {
         console.warn(`  > No transcript found for ${youtubeUrl} (may not exist or be in English)`);
     }
     else {
        console.error(`Error fetching transcript for ${youtubeUrl}:`, error.message || error);
     }
    return null;
  }
}

// Function to format date YYYYMMDD to YYYY-MM-DD
function formatDate(dateString: string): string {
    if (dateString && dateString.length === 8) {
        return `${dateString.substring(0, 4)}-${dateString.substring(4, 6)}-${dateString.substring(6, 8)}`;
    }
    return dateString; // Return original if format is unexpected
}

// Function to check if a video is after the cutoff date
function isAfterCutoffDate(dateString: string): boolean {
    const formattedDate = formatDate(dateString);
    return formattedDate >= CUTOFF_DATE;
}

// Function to sanitize filenames (basic example)
function sanitizeFilename(name: string): string {
    return name.replace(/[^a-z0-9_\-\.]/gi, '_').substring(0, 100); // Keep it reasonably short
}

// Function to map candidate to party
async function getPartyIdForCandidate(candidate: string): Promise<number | undefined> {
  // This is a simplistic mapping - you might want to make this more robust
  if (candidate === 'Mark Carney') {
    const party = await partyRepo.getPartyByName('Liberal Party of Canada');
    return party?.id;
  } else if (candidate === 'Pierre Poilievre') {
    const party = await partyRepo.getPartyByName('Conservative Party of Canada');
    return party?.id;
  }
  return undefined;
}

// Function to save to database and generate embeddings
async function saveContentToDatabase(
  metadata: VideoMetadata, 
  transcript: string | null, 
  candidate: string
): Promise<void> {
  try {
    // First check if the source already exists by URL
    const sourceExists = await sourceRepo.sourceExistsByUrl(metadata.webpage_url);
    if (sourceExists) {
      console.log(`  > Source with URL ${metadata.webpage_url} already exists in database, skipping database save`);
      
      // Update processing log to mark as successful
      await logRepo.logProcessing({
        source_type: 'youtube',
        external_id: metadata.id,
        url: metadata.webpage_url,
        status: 'success'
      });
      
      return;
    }

    // Check if we've already processed this video in the processing log
    const hasProcessed = await logRepo.hasBeenProcessed(metadata.webpage_url);
    if (hasProcessed) {
      console.log(`  > Video ${metadata.id} already processed, skipping database save`);
      return;
    }

    // Get party ID
    const partyId = await getPartyIdForCandidate(candidate);
    if (!partyId) {
      throw new Error(`Could not find party ID for candidate: ${candidate}`);
    }
    
    // Save source
    let sourceId: number;
    try {
      sourceId = await sourceRepo.saveSource({
        party_id: partyId,
        title: metadata.title,
        source_type: 'youtube',
        url: metadata.webpage_url,
        external_id: metadata.id,
        date_published: formatDate(metadata.upload_date),
        language: metadata.language || 'en'  // Use detected language or default to English
      });
    } catch (error: any) {
      // If there's a unique constraint error, try to get the existing source ID
      if (error.message && error.message.includes('UNIQUE constraint failed')) {
        console.log(`  > Source already exists, fetching existing source ID`);
        const existingSource = await sourceRepo.getSourceByUrl(metadata.webpage_url);
        if (!existingSource || !existingSource.id) {
          throw new Error(`Failed to get existing source for URL ${metadata.webpage_url}`);
        }
        sourceId = existingSource.id;
      } else {
        throw error; // Re-throw other errors
      }
    }
    
    // Prepare content with metadata
    const contentMetadata = {
      candidate,
      description: metadata.description,
      hasTranscript: !!transcript
    };
    
    // Save content
    const contentId = await contentRepo.saveContent({
      source_id: sourceId,
      content_text: transcript || 'No transcript available',
      metadata: JSON.stringify(contentMetadata)
    });
    
    // Generate and save embeddings if we have transcript
    if (transcript) {
      console.log(`  > Generating embeddings for video ${metadata.id}`);
      const chunks = chunkText(transcript);
      
      // Process chunks and generate embeddings
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await generateEmbeddings(chunk);
        
        await embeddingRepo.saveEmbedding({
          content_id: contentId,
          chunk_index: i,
          chunk_text: chunk,
          embedding_model: embeddingConfig.model,
          embedding: embedding
        });
      }
      
      console.log(`  > Saved ${chunks.length} chunks with embeddings`);
    }
    
    // Log successful processing
    await logRepo.logProcessing({
      source_type: 'youtube',
      external_id: metadata.id,
      url: metadata.webpage_url,
      status: 'success'
    });
    
    console.log(`  > Saved video to database with ID ${sourceId}`);
  } catch (error: any) {
    console.error(`  > Error saving to database: ${error.message}`);
    
    // Log failed processing
    await logRepo.logProcessing({
      source_type: 'youtube',
      external_id: metadata.id,
      url: metadata.webpage_url,
      status: 'error',
      message: error.message
    });
  }
}

// Main processing function
async function processVideos() {
  console.log('Starting video processing...');
  console.log(`Using cutoff date: ${CUTOFF_DATE} (will only process videos published after this date)`);
  
  // Create the output directory if it doesn't exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Videos to process
  let videos: VideoInput[] = [];
  
  // Try dynamic fetching first
  try {
    console.log('Attempting to dynamically fetch recent videos...');
    // Pass the CUTOFF_DATE to getVideosToProcess
    const dynamicVideos = await getVideosToProcess(CUTOFF_DATE, maxVideos);
    
    if (dynamicVideos && dynamicVideos.length > 0) {
      videos = dynamicVideos;
      console.log(`Fetched ${videos.length} videos dynamically`);
    } else {
      console.log('No videos found using dynamic fetching, using empty list');
      videos = [];
    }
  } catch (error) {
    console.error('Error dynamically fetching videos:', error);
    console.log('Using empty video list');
    videos = [];
  }

  console.log(`Found a total of ${videos.length} videos to potentially process`);
  
  // Limit the number of videos to process to maxVideos
  if (videos.length > maxVideos) {
    console.log(`Limiting processing to ${maxVideos} videos`);
    videos = videos.slice(0, maxVideos);
  }
  
  // Track successfully processed videos
  let processedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let beforeCutoffCount = 0;

  for (const videoInput of videos) {
    console.log(`\nProcessing URL: ${videoInput.url} for Candidate: ${videoInput.candidate}`);

    try {
      // First check metadata to determine publication date
      const metadata = await getVideoMetadata(videoInput.url);
      if (!metadata) {
        console.error(`Skipping video due to metadata fetch error: ${videoInput.url}`);
        
        await logRepo.logProcessing({
          source_type: 'youtube',
          external_id: '',
          url: videoInput.url,
          status: 'error',
          message: 'Failed to fetch metadata'
        });
        
        errorCount++;
        continue; // Skip to the next video
      }
      
      // Check if the video is after our cutoff date
      if (!isAfterCutoffDate(metadata.upload_date)) {
        console.log(`  > Video published on ${formatDate(metadata.upload_date)} is before cutoff date ${CUTOFF_DATE}, skipping`);
        beforeCutoffCount++;
        continue; // Skip to the next video
      }
      
      // Check if this URL already exists in sources table
      const sourceExists = await sourceRepo.sourceExistsByUrl(videoInput.url);
      if (sourceExists) {
        console.log(`  > Video already exists in database, skipping`);
        skippedCount++;
        continue;
      }
      
      // Check if we've already processed this video in processing log
      const hasProcessed = await logRepo.hasBeenProcessed(videoInput.url);
      if (hasProcessed) {
        console.log(`  > Video ${videoInput.url} already processed, skipping`);
        skippedCount++;
        continue;
      }
      
      // Log pending processing
      await logRepo.logProcessing({
        source_type: 'youtube',
        external_id: metadata.id,
        url: videoInput.url,
        status: 'pending'
      });

      const transcript = await getTranscript(videoInput.url);
    
      // Save to database
      await saveContentToDatabase(metadata, transcript, videoInput.candidate);

      // --- Create Markdown Content ---
      let markdownContent = `---
title: "${metadata.title.replace(/"/g, '\\"')}" # Escape quotes in title
candidate: "${videoInput.candidate}"
date: ${formatDate(metadata.upload_date)}
video_url: ${metadata.webpage_url}
id: ${metadata.id}
---

# ${metadata.title}

**Candidate:** ${videoInput.candidate}
**Date:** ${formatDate(metadata.upload_date)}
**Source:** [YouTube Video](${metadata.webpage_url})

## Transcript

`; // Using YAML front matter for metadata

      if (transcript) {
        markdownContent += transcript;
      } else {
        markdownContent += "*Transcript not available or could not be fetched.*";
      }

       if (metadata.description) {
           markdownContent += `\n\n## Video Description\n\n${metadata.description}`;
       }


      // --- Save Markdown File ---
      const candidateDir = path.join(OUTPUT_DIR, sanitizeFilename(videoInput.candidate));
      const filename = `${metadata.id}.md`; // Use video ID for unique filename
      const filePath = path.join(candidateDir, filename);

      try {
        // Ensure the candidate directory exists
        await fs.promises.mkdir(candidateDir, { recursive: true });
        // Write the file
        await fs.promises.writeFile(filePath, markdownContent);
        console.log(`  >> Successfully saved Markdown to: ${filePath}`);
        processedCount++;
      } catch (error: any) {
        console.error(`Error saving Markdown file ${filePath}:`, error.message || error);
        errorCount++;
      }
    } catch (error: any) {
      console.error(`Error processing video ${videoInput.url}:`, error.message || error);
      
      // Log failed processing
      await logRepo.logProcessing({
        source_type: 'youtube',
        external_id: '',
        url: videoInput.url,
        status: 'error',
        message: error.message
      });
      
      errorCount++;
    }
  }

  console.log('\nVideo processing summary:');
  console.log(`  - Total videos found: ${videos.length}`);
  console.log(`  - Videos before cutoff date (${CUTOFF_DATE}): ${beforeCutoffCount}`);
  console.log(`  - Successfully processed: ${processedCount}`);
  console.log(`  - Skipped (already processed): ${skippedCount}`);
  console.log(`  - Errors: ${errorCount}`);
  console.log('\nVideo processing finished.');
}

// Run the main function
processVideos().catch(error => {
  console.error("\nUnhandled error during processing:", error);
  process.exit(1);
});