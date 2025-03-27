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
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const youtube_transcript_1 = require("youtube-transcript");
const VideoList_1 = require("./VideoList");
const repository_1 = require("./database/repository");
const embeddingService_1 = require("./services/embeddingService");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
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
    }
    else {
        console.warn(`Invalid --max value, using default of ${maxVideos}`);
    }
}
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const OUTPUT_DIR = path_1.default.resolve(__dirname, '../markdown'); // Output to 'markdown' folder
// Initialize repositories
const partyRepo = new repository_1.PartyRepository();
const sourceRepo = new repository_1.SourceRepository();
const contentRepo = new repository_1.ContentRepository();
const embeddingRepo = new repository_1.EmbeddingRepository();
const logRepo = new repository_1.ProcessingLogRepository();
// Function to fetch metadata using yt-dlp
function getVideoMetadata(youtubeUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`Fetching metadata for: ${youtubeUrl}`);
        try {
            const command = `yt-dlp --dump-json --skip-download ${youtubeUrl}`;
            const { stdout, stderr } = yield execAsync(command);
            if (stderr) {
                console.warn(`[yt-dlp stderr for ${youtubeUrl}]: ${stderr}`);
            }
            const metadata = JSON.parse(stdout);
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
        }
        catch (error) {
            console.error(`Error fetching metadata for ${youtubeUrl}:`, error.message || error);
            return null;
        }
    });
}
// Function to fetch transcript using youtube-transcript
function getTranscript(youtubeUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`Fetching transcript for: ${youtubeUrl}`);
        try {
            const transcriptItems = yield youtube_transcript_1.YoutubeTranscript.fetchTranscript(youtubeUrl, {
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
        }
        catch (error) {
            // Handle common error: Transcripts disabled
            if (error.message && error.message.includes('disabled transcript')) {
                console.warn(`  > Transcripts are disabled for ${youtubeUrl}`);
            }
            else if (error.message && error.message.includes('No transcript found')) {
                console.warn(`  > No transcript found for ${youtubeUrl} (may not exist or be in English)`);
            }
            else {
                console.error(`Error fetching transcript for ${youtubeUrl}:`, error.message || error);
            }
            return null;
        }
    });
}
// Function to format date YYYYMMDD to YYYY-MM-DD
function formatDate(dateString) {
    if (dateString && dateString.length === 8) {
        return `${dateString.substring(0, 4)}-${dateString.substring(4, 6)}-${dateString.substring(6, 8)}`;
    }
    return dateString; // Return original if format is unexpected
}
// Function to check if a video is after the cutoff date
function isAfterCutoffDate(dateString) {
    const formattedDate = formatDate(dateString);
    return formattedDate >= CUTOFF_DATE;
}
// Function to sanitize filenames (basic example)
function sanitizeFilename(name) {
    return name.replace(/[^a-z0-9_\-\.]/gi, '_').substring(0, 100); // Keep it reasonably short
}
// Function to map candidate to party
function getPartyIdForCandidate(candidate) {
    return __awaiter(this, void 0, void 0, function* () {
        // This is a simplistic mapping - you might want to make this more robust
        if (candidate === 'Mark Carney') {
            const party = yield partyRepo.getPartyByName('Liberal Party of Canada');
            return party === null || party === void 0 ? void 0 : party.id;
        }
        else if (candidate === 'Pierre Poilievre') {
            const party = yield partyRepo.getPartyByName('Conservative Party of Canada');
            return party === null || party === void 0 ? void 0 : party.id;
        }
        return undefined;
    });
}
// Function to save to database and generate embeddings
function saveContentToDatabase(metadata, transcript, candidate) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // First check if the source already exists by URL
            const sourceExists = yield sourceRepo.sourceExistsByUrl(metadata.webpage_url);
            if (sourceExists) {
                console.log(`  > Source with URL ${metadata.webpage_url} already exists in database, skipping database save`);
                // Update processing log to mark as successful
                yield logRepo.logProcessing({
                    source_type: 'youtube',
                    external_id: metadata.id,
                    url: metadata.webpage_url,
                    status: 'success'
                });
                return;
            }
            // Check if we've already processed this video in the processing log
            const hasProcessed = yield logRepo.hasBeenProcessed(metadata.webpage_url);
            if (hasProcessed) {
                console.log(`  > Video ${metadata.id} already processed, skipping database save`);
                return;
            }
            // Get party ID
            const partyId = yield getPartyIdForCandidate(candidate);
            if (!partyId) {
                throw new Error(`Could not find party ID for candidate: ${candidate}`);
            }
            // Save source
            let sourceId;
            try {
                sourceId = yield sourceRepo.saveSource({
                    party_id: partyId,
                    title: metadata.title,
                    source_type: 'youtube',
                    url: metadata.webpage_url,
                    external_id: metadata.id,
                    date_published: formatDate(metadata.upload_date),
                    language: metadata.language || 'en' // Use detected language or default to English
                });
            }
            catch (error) {
                // If there's a unique constraint error, try to get the existing source ID
                if (error.message && error.message.includes('UNIQUE constraint failed')) {
                    console.log(`  > Source already exists, fetching existing source ID`);
                    const existingSource = yield sourceRepo.getSourceByUrl(metadata.webpage_url);
                    if (!existingSource || !existingSource.id) {
                        throw new Error(`Failed to get existing source for URL ${metadata.webpage_url}`);
                    }
                    sourceId = existingSource.id;
                }
                else {
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
            const contentId = yield contentRepo.saveContent({
                source_id: sourceId,
                content_text: transcript || 'No transcript available',
                metadata: JSON.stringify(contentMetadata)
            });
            // Generate and save embeddings if we have transcript
            if (transcript) {
                console.log(`  > Generating embeddings for video ${metadata.id}`);
                const chunks = (0, embeddingService_1.chunkText)(transcript);
                // Process chunks and generate embeddings
                for (let i = 0; i < chunks.length; i++) {
                    const chunk = chunks[i];
                    const embedding = yield (0, embeddingService_1.generateEmbeddings)(chunk);
                    yield embeddingRepo.saveEmbedding({
                        content_id: contentId,
                        chunk_index: i,
                        chunk_text: chunk,
                        embedding_model: embeddingService_1.embeddingConfig.model,
                        embedding: embedding
                    });
                }
                console.log(`  > Saved ${chunks.length} chunks with embeddings`);
            }
            // Log successful processing
            yield logRepo.logProcessing({
                source_type: 'youtube',
                external_id: metadata.id,
                url: metadata.webpage_url,
                status: 'success'
            });
            console.log(`  > Saved video to database with ID ${sourceId}`);
        }
        catch (error) {
            console.error(`  > Error saving to database: ${error.message}`);
            // Log failed processing
            yield logRepo.logProcessing({
                source_type: 'youtube',
                external_id: metadata.id,
                url: metadata.webpage_url,
                status: 'error',
                message: error.message
            });
        }
    });
}
// Main processing function
function processVideos() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Starting video processing...');
        console.log(`Using cutoff date: ${CUTOFF_DATE} (will only process videos published after this date)`);
        // Create the output directory if it doesn't exist
        if (!fs_1.default.existsSync(OUTPUT_DIR)) {
            fs_1.default.mkdirSync(OUTPUT_DIR, { recursive: true });
        }
        // Videos to process
        let videos = [];
        // Try dynamic fetching first
        try {
            console.log('Attempting to dynamically fetch recent videos...');
            // Pass the CUTOFF_DATE to getVideosToProcess
            const dynamicVideos = yield (0, VideoList_1.getVideosToProcess)(CUTOFF_DATE, maxVideos);
            if (dynamicVideos && dynamicVideos.length > 0) {
                videos = dynamicVideos;
                console.log(`Fetched ${videos.length} videos dynamically`);
            }
            else {
                console.log('No videos found using dynamic fetching, using empty list');
                videos = [];
            }
        }
        catch (error) {
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
                const metadata = yield getVideoMetadata(videoInput.url);
                if (!metadata) {
                    console.error(`Skipping video due to metadata fetch error: ${videoInput.url}`);
                    yield logRepo.logProcessing({
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
                const sourceExists = yield sourceRepo.sourceExistsByUrl(videoInput.url);
                if (sourceExists) {
                    console.log(`  > Video already exists in database, skipping`);
                    skippedCount++;
                    continue;
                }
                // Check if we've already processed this video in processing log
                const hasProcessed = yield logRepo.hasBeenProcessed(videoInput.url);
                if (hasProcessed) {
                    console.log(`  > Video ${videoInput.url} already processed, skipping`);
                    skippedCount++;
                    continue;
                }
                // Log pending processing
                yield logRepo.logProcessing({
                    source_type: 'youtube',
                    external_id: metadata.id,
                    url: videoInput.url,
                    status: 'pending'
                });
                const transcript = yield getTranscript(videoInput.url);
                // Save to database
                yield saveContentToDatabase(metadata, transcript, videoInput.candidate);
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
                }
                else {
                    markdownContent += "*Transcript not available or could not be fetched.*";
                }
                if (metadata.description) {
                    markdownContent += `\n\n## Video Description\n\n${metadata.description}`;
                }
                // --- Save Markdown File ---
                const candidateDir = path_1.default.join(OUTPUT_DIR, sanitizeFilename(videoInput.candidate));
                const filename = `${metadata.id}.md`; // Use video ID for unique filename
                const filePath = path_1.default.join(candidateDir, filename);
                try {
                    // Ensure the candidate directory exists
                    yield fs_1.default.promises.mkdir(candidateDir, { recursive: true });
                    // Write the file
                    yield fs_1.default.promises.writeFile(filePath, markdownContent);
                    console.log(`  >> Successfully saved Markdown to: ${filePath}`);
                    processedCount++;
                }
                catch (error) {
                    console.error(`Error saving Markdown file ${filePath}:`, error.message || error);
                    errorCount++;
                }
            }
            catch (error) {
                console.error(`Error processing video ${videoInput.url}:`, error.message || error);
                // Log failed processing
                yield logRepo.logProcessing({
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
    });
}
// Run the main function
processVideos().catch(error => {
    console.error("\nUnhandled error during processing:", error);
    process.exit(1);
});
