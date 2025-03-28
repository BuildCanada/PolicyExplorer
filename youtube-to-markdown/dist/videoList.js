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
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchChannelVideos = fetchChannelVideos;
exports.getVideosToProcess = getVideosToProcess;
// src/VideoList.ts
const child_process_1 = require("child_process");
const util_1 = require("util");
const language_1 = require("./utils/language");
// Convert exec to Promise-based version
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * Fetches latest videos from a YouTube channel since a specific date
 * @param channelUrl URL of the YouTube channel
 * @param candidate Candidate name associated with the channel
 * @param sinceDate Date in YYYYMMDD format to filter videos
 * @param maxVideos Maximum number of videos to fetch (default: 10)
 */
function fetchChannelVideos(channelUrl_1, candidate_1, cutoffDate_1) {
    return __awaiter(this, arguments, void 0, function* (channelUrl, candidate, cutoffDate, maxVideos = 50) {
        try {
            console.log(`Fetching videos for ${candidate} from ${channelUrl} since ${cutoffDate}...`);
            // Format date for yt-dlp (YYYYMMDD)
            const formattedDate = cutoffDate.replace(/-/g, '');
            // Use the exact same command format that we know works from testing
            const command = `yt-dlp --print "%(id)s|%(title)s|%(upload_date)s" --no-playlist "${channelUrl}" --max-downloads ${maxVideos}`;
            console.log(`Executing: ${command}`);
            // Initialize videos array
            const videos = [];
            try {
                // Try normal execution
                const { stdout, stderr } = yield execAsync(command);
                if (stderr)
                    console.warn(`[yt-dlp stderr]: ${stderr}`);
                // Process output
                const lines = stdout.split('\n').filter((line) => line.trim());
                console.log(`Got ${lines.length} videos from standard execution`);
                // Process each line
                processVideoOutput(lines, videos, formattedDate, candidate);
            }
            catch (execError) {
                // Even when command fails, check if we got some output
                if (execError.stdout) {
                    console.log(`Command exited with code ${execError.code} but returned data - processing it`);
                    const lines = execError.stdout.split('\n').filter((line) => line.trim());
                    console.log(`Got ${lines.length} videos from error output`);
                    // Process each line
                    processVideoOutput(lines, videos, formattedDate, candidate);
                }
                else {
                    console.error(`No usable output from yt-dlp command: ${execError.message}`);
                }
            }
            console.log(`Found ${videos.length} English videos after cutoff date for ${candidate}`);
            return videos;
        }
        catch (error) {
            console.error(`Error fetching videos for ${candidate}:`, error);
            return [];
        }
    });
}
// Helper function to process video output from yt-dlp
function processVideoOutput(lines, videos, formattedDate, candidate) {
    for (const line of lines) {
        const [id, title, uploadDate] = line.split('|');
        // Skip if we don't have required fields
        if (!id || !title || !uploadDate) {
            console.warn(`Skipping video with missing fields: ${line}`);
            continue;
        }
        // Skip if before cutoff date
        if (uploadDate < formattedDate) {
            console.log(`Skipping video ${id} (${title}) - published on ${uploadDate}, before cutoff ${formattedDate}`);
            continue;
        }
        // Check if video is in English using our language detection
        const isEnglish = !(0, language_1.detectLanguage)(title).includes('fr');
        if (!isEnglish) {
            console.log(`Skipping non-English video: ${title}`);
            continue;
        }
        videos.push({
            url: `https://www.youtube.com/watch?v=${id}`,
            candidate
        });
        console.log(`Added video: ${id} - ${title} (${uploadDate})`);
    }
}
/**
 * Dynamically retrieves recent videos from specified channels
 * @param cutoffDate The cutoff date in YYYY-MM-DD format
 * @param maxTotalVideos Maximum total number of videos to process (default: 100)
 */
function getVideosToProcess(cutoffDate_1) {
    return __awaiter(this, arguments, void 0, function* (cutoffDate, maxTotalVideos = 100) {
        // Convert YYYY-MM-DD to YYYYMMDD format for yt-dlp
        const targetDate = cutoffDate.replace(/-/g, '');
        // Calculate per-channel limit (divide by 2 for two channels)
        const perChannelLimit = Math.ceil(maxTotalVideos / 2);
        try {
            console.log(`Fetching videos from channels published after ${cutoffDate} (${targetDate})`);
            // Store videos from both sources
            let poilievreVideos = [];
            let carneyVideos = [];
            // Manually process videos here using exec directly
            try {
                // Fetch Conservative videos
                const command1 = `yt-dlp --print "%(id)s|%(title)s|%(upload_date)s" --no-playlist "https://www.youtube.com/@PierrePoilievre/videos" --max-downloads ${perChannelLimit}`;
                try {
                    const { stdout } = yield execAsync(command1);
                    // Process output
                    poilievreVideos = processLines(stdout, 'Pierre Poilievre', targetDate);
                }
                catch (err) {
                    // Handle error case with stdout
                    if (err.stdout) {
                        console.log(`Command exited with code ${err.code} but returned data - processing it`);
                        poilievreVideos = processLines(err.stdout, 'Pierre Poilievre', targetDate);
                    }
                }
                // Fetch Liberal videos
                const command2 = `yt-dlp --print "%(id)s|%(title)s|%(upload_date)s" --no-playlist "https://www.youtube.com/@MarkJCarney" --max-downloads ${perChannelLimit}`;
                try {
                    const { stdout } = yield execAsync(command2);
                    // Process output
                    carneyVideos = processLines(stdout, 'Mark Carney', targetDate);
                }
                catch (err) {
                    // Handle error case with stdout
                    if (err.stdout) {
                        console.log(`Command exited with code ${err.code} but returned data - processing it`);
                        carneyVideos = processLines(err.stdout, 'Mark Carney', targetDate);
                    }
                }
            }
            catch (err) {
                console.error('Error in video processing:', err);
            }
            // Combine both sets of videos and limit to maxTotalVideos
            const allVideos = [...carneyVideos, ...poilievreVideos];
            console.log(`Total videos found from channels: ${allVideos.length}`);
            // Return all videos, but limit to maxTotalVideos
            return allVideos.slice(0, maxTotalVideos);
        }
        catch (error) {
            console.error('Error getting videos to process:', error.message || error);
            return []; // Return empty array on error
        }
    });
}
// Helper function to process lines and create VideoInput objects
function processLines(output, candidate, cutoffDate) {
    const videos = [];
    const lines = output.split('\n').filter((line) => line.trim());
    console.log(`Processing ${lines.length} lines for ${candidate}`);
    for (const line of lines) {
        const [id, title, uploadDate] = line.split('|');
        // Skip if missing required fields
        if (!id || !title || !uploadDate) {
            continue;
        }
        // Skip if before cutoff date
        if (uploadDate < cutoffDate) {
            console.log(`Skipping video ${id} (${title}) - published on ${uploadDate}, before cutoff ${cutoffDate}`);
            continue;
        }
        // Check if video is in English
        const isEnglish = !(0, language_1.detectLanguage)(title).includes('fr');
        if (!isEnglish) {
            console.log(`Skipping non-English video: ${title}`);
            continue;
        }
        videos.push({
            url: `https://www.youtube.com/watch?v=${id}`,
            candidate
        });
        console.log(`Added video: ${id} - ${title} (${uploadDate})`);
    }
    return videos;
}
