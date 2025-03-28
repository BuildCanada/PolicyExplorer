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
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
function debugDateFiltering() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('DEBUG: Testing YouTube video date filtering');
        // Example hardcoded cutoff date (same as in processVideos.ts)
        const cutoffDate = '2025-03-20';
        const formattedCutoff = cutoffDate.replace(/-/g, ''); // Format to YYYYMMDD
        console.log(`Cutoff date: ${cutoffDate} (formatted: ${formattedCutoff})`);
        try {
            // Get a small sample of videos
            const channelUrl = 'https://www.youtube.com/@PierrePoilievre/videos';
            const command = `yt-dlp --flat-playlist --print "%(id)s|%(title)s|%(upload_date)s" --max-downloads 10 "${channelUrl}"`;
            console.log(`Executing: ${command}`);
            const { stdout, stderr } = yield execAsync(command);
            if (stderr) {
                console.warn(`[yt-dlp stderr]: ${stderr}`);
            }
            // Process and log all results including dates
            const lines = stdout.split('\n').filter(line => line.trim());
            console.log(`Found ${lines.length} videos for testing`);
            for (const line of lines) {
                const [id, title, uploadDate] = line.split('|');
                if (!id || !title || !uploadDate) {
                    console.log(`Malformed line: ${line}`);
                    continue;
                }
                const shouldInclude = uploadDate >= formattedCutoff;
                console.log(`---`);
                console.log(`ID: ${id}`);
                console.log(`Title: ${title}`);
                console.log(`Upload date: ${uploadDate}`);
                console.log(`Include? ${shouldInclude} (${uploadDate} ${shouldInclude ? '>=' : '<'} ${formattedCutoff})`);
            }
        }
        catch (error) {
            console.error('Error during debug:', error);
        }
    });
}
// Run the debug function
debugDateFiltering().catch(console.error);
