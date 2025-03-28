# Dynamic Video Fetching

The Political Policy Analyzer now includes automatic video fetching from official candidate channels. This feature simplifies keeping your database up-to-date with the latest campaign messages.

## How It Works

The system uses the `yt-dlp` command-line tool to fetch video URLs from specified YouTube channels based on their upload date. This allows automatic processing of recent videos without manual URL collection.

### Configuration Options

The dynamic video fetching is configurable through:

1. **Date Filter**: Videos are filtered based on upload date (default: since March 20, 2025)
2. **Source Channels**: Currently set to fetch from:
   - Mark Carney (Liberal): `https://www.youtube.com/@MarkJCarney`
   - Pierre Poilievre (Conservative): `https://www.youtube.com/@PierrePoilievre/videos`
3. **Video Limits**: Control how many videos to process:
   - Per-channel limit (divides the total limit evenly between channels)
   - Total video limit (default: 20 videos total)

## Usage

### Command Line Options

Process only the latest videos from candidate channels:
```bash
npm run process:latest
```

Limit the number of videos processed:
```bash
npm run process:latest -- --max=10
```

### Fallback Mechanism

If the dynamic fetching fails or finds no videos, the system automatically falls back to the static video list defined in `src/videoList.ts`. This ensures processing can continue even if there are network issues or API changes.

### Implementation Details

The dynamic video fetching is implemented in `src/videoList.ts` with two main functions:

1. `fetchChannelVideos()`: Fetches videos from a single channel
2. `getVideosToProcess()`: Orchestrates fetching from all channels and combines results

## Requirements

- `yt-dlp` must be installed on your system
- Internet connection to access YouTube
- Appropriate API quotas if processing large numbers of videos

## Customization

You can customize the feature by editing `src/videoList.ts`:

1. Change the target date (`targetDate` variable)
2. Modify the channels to monitor
3. Adjust the default maximum videos processed

## Integration with Embedding Pipeline

Videos fetched dynamically go through the same processing pipeline as manually specified videos:
1. Metadata extraction
2. Transcript fetching
3. Content chunking
4. Embedding generation
5. Database storage

This ensures consistent analysis and retrieval capabilities across all processed content. 