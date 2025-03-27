# Canadian Political Policy Analyzer

This system tracks and analyzes policies from Canada's two major political parties (Liberal and Conservative) during election cycles. It ingests content from YouTube videos and party websites, stores the content with embeddings in a SQLite database, and provides a chat interface to ask questions about party positions.

## Features

- YouTube video processing with transcript extraction
  - Automatic fetching of recent videos from official channels
- Web page scraping for party platforms and policies
- Text chunking and embedding generation using Gemini or OpenAI (configurable)
- Vector search to find relevant content for questions
- Chat interface powered by Gemini LLM to answer policy questions
- Party position comparison functionality

## Requirements

- Node.js (v14+)
- npm
- Python 3.6+ (for yt-dlp)
- yt-dlp (for YouTube video processing)

## Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Install yt-dlp (if you plan to use the YouTube video processor):
   ```
   # On macOS
   brew install yt-dlp
   
   # On Ubuntu/Debian
   sudo apt install yt-dlp
   
   # On Windows (with Chocolatey)
   choco install yt-dlp
   ```
4. Set up your API keys in the `.env` file:
   ```
   GEMINI_API_KEY=your-gemini-api-key
   OPENAI_API_KEY=your-openai-api-key (optional)
   ```

## Usage

### Configure Content Sources

1. YouTube videos:
   - The system can automatically fetch recent videos from the official channels:
     - Liberal Party: Mark Carney's channel (https://www.youtube.com/@MarkJCarney)
     - Conservative Party: Pierre Poilievre's channel (https://www.youtube.com/@PierrePoilievre)
   - By default, it fetches videos uploaded since March 20, 2025
   - Alternatively, you can edit `src/videoList.ts` to add specific YouTube videos you want to process
   - Each video should include a URL and a candidate/party association

2. Web pages:
   - Edit `src/webpageList.ts` to add the web pages you want to scrape
   - Each entry should include a URL, party ID, and optional CSS selector

### Process Content

1. Process YouTube videos:
   ```
   npm run process:videos
   ```

2. Process only latest videos from official channels:
   ```
   npm run process:latest
   ```
   
   You can also limit the number of videos:
   ```
   npm run process:latest -- --max=10
   ```

3. Process web pages:
   ```
   npm run process:webpages
   ```

4. Process both:
   ```
   npm run process:all
   ```

### Start the Chat Interface

```
npm run start:chat
```

This will start an interactive command-line chat interface where you can ask questions about Canadian party policies.

#### Example Questions

- "What is the Liberal Party's position on housing?"
- "Compare the Conservative and Liberal positions on climate change"
- "What has Pierre Poilievre said about tax cuts?"
- "How do the Liberals and Conservatives differ on military spending?"

## Customization

### Embedding Models

This project uses Google's latest experimental embedding model `gemini-embedding-exp-03-07`, which provides 3072-dimensional embeddings. You can configure the embedding settings in the `.env` file:

```
EMBEDDING_MODEL=gemini  # Uses gemini-embedding-exp-03-07
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
```

For detailed information about our embedding implementation, see [docs/embedding-models.md](docs/embedding-models.md).

### Adding New Content Types

To add a new content source:

1. Create a new scraper in the `src/scrapers` directory
2. Update the database schema if needed
3. Create a new processor script that uses the scraper

### Dynamic Video Fetching

The system automatically fetches recent videos from the official YouTube channels of Mark Carney (Liberal) and Pierre Poilievre (Conservative). You can customize this behavior by modifying the following in `src/videoList.ts`:

```typescript
// Change the target date (format: YYYYMMDD)
const targetDate = '20250320';

// Modify the maximum number of videos to fetch per channel
const maxVideos = 10;
```

This ensures your policy analysis stays up-to-date with the latest campaign messages without manual intervention.

## License

MIT 