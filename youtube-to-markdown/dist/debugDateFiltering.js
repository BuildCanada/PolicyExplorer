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
/**
 * Debug function to test different date filtering approaches with yt-dlp
 */
function debugDateFiltering() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Starting date filtering debug...');
        // Test case 1: Use --dateafter with a recent date (should find nothing after 2025)
        const futureDate = '20250320'; // March 20, 2025
        // Test case 2: Use --dateafter with a past date (should find videos)
        const pastDate = '20230101'; // January 1, 2023
        // Test different approaches for each channel
        const channels = [
            { url: 'https://www.youtube.com/@PierrePoilievre/videos', name: 'Pierre Poilievre' },
            { url: 'https://www.youtube.com/@MarkJCarney', name: 'Mark Carney' }
        ];
        for (const channel of channels) {
            console.log(`\n========= Testing for ${channel.name} (${channel.url}) =========`);
            // Test 1: Try the future date filter - this should find no videos
            console.log(`\nTest 1: Using --dateafter ${futureDate} (future date - should find no videos)`);
            try {
                const command1 = `yt-dlp --dateafter ${futureDate} --max-downloads 2 --no-warnings --print "%(id)s|%(title)s|%(upload_date)s" "${channel.url}"`;
                console.log(`Executing: ${command1}`);
                const { stdout: stdout1, stderr: stderr1 } = yield execAsync(command1);
                if (stderr1) {
                    console.error(`Error: ${stderr1}`);
                }
                console.log('Output:');
                if (stdout1.trim()) {
                    console.log(stdout1.trim());
                }
                else {
                    console.log('No videos found (expected for future date)');
                }
            }
            catch (error) {
                console.error(`Error executing command: ${error.message}`);
                if (error.stderr)
                    console.error(`stderr: ${error.stderr}`);
            }
            // Test 2: Try with a past date - this should find videos
            console.log(`\nTest 2: Using --dateafter ${pastDate} (past date - should find videos)`);
            try {
                const command2 = `yt-dlp --dateafter ${pastDate} --max-downloads 2 --no-warnings --print "%(id)s|%(title)s|%(upload_date)s" "${channel.url}"`;
                console.log(`Executing: ${command2}`);
                const { stdout: stdout2, stderr: stderr2 } = yield execAsync(command2);
                if (stderr2) {
                    console.error(`Error: ${stderr2}`);
                }
                console.log('Output:');
                if (stdout2.trim()) {
                    console.log(stdout2.trim());
                    // Parse the results to verify dates
                    const lines = stdout2.trim().split('\n');
                    console.log(`Found ${lines.length} videos`);
                    for (const line of lines) {
                        const [id, title, uploadDate] = line.split('|');
                        console.log(`Video: ${title} (ID: ${id}) - Upload date: ${uploadDate}`);
                    }
                }
                else {
                    console.log('No videos found (unexpected for past date)');
                }
            }
            catch (error) {
                console.error(`Error executing command: ${error.message}`);
                if (error.stderr)
                    console.error(`stderr: ${error.stderr}`);
            }
            // Test 3: Try with flat-playlist approach to get dates directly
            console.log(`\nTest 3: Using --flat-playlist with id,upload_date printing`);
            try {
                const command3 = `yt-dlp --flat-playlist --print id,upload_date --max-downloads 5 "${channel.url}"`;
                console.log(`Executing: ${command3}`);
                const { stdout: stdout3, stderr: stderr3 } = yield execAsync(command3);
                if (stderr3) {
                    console.error(`Error: ${stderr3}`);
                }
                console.log('Output:');
                if (stdout3.trim()) {
                    console.log(stdout3.trim());
                    // Parse the results to verify the format
                    const lines = stdout3.trim().split('\n');
                    console.log(`Found ${lines.length} entries`);
                    // Check if dates are actually being returned
                    const hasUploadDates = lines.some(line => {
                        const parts = line.trim().split(' ');
                        return parts.length === 2 && /^\d{8}$/.test(parts[1]);
                    });
                    console.log(`Date information provided: ${hasUploadDates ? 'Yes' : 'No'}`);
                }
                else {
                    console.log('No data found');
                }
            }
            catch (error) {
                console.error(`Error executing command: ${error.message}`);
                if (error.stderr)
                    console.error(`stderr: ${error.stderr}`);
            }
        }
        console.log('\nDebug complete!');
    });
}
// Run the debug function
debugDateFiltering().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
