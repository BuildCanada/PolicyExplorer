# Canadian Political Policy Analyzer

This system tracks and analyzes policies from Canada's two major political parties (Liberal and Conservative) during election cycles. It ingests content from YouTube videos and party websites, stores the content with embeddings in a SQLite database, and provides a chat interface to ask questions about party positions.

## Features

- YouTube video processing with transcript extraction
  - Automatic fetching of recent videos from official channels
- News article scraping from party websites
- Web page scraping for party platforms and policies
- Text chunking and embedding generation using Gemini or OpenAI (configurable)
- Vector search to find relevant content for questions
- Chat interface powered by Gemini LLM to answer policy questions
- Party position comparison functionality
- Markdown export of processed content for easy reading

## Requirements

- Node.js (v16+)
- npm
- Python 3.8+ (for yt-dlp and Datasette)
- yt-dlp (for YouTube video processing)
- Datasette (optional, for database visualization)

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
   # API Keys
   GEMINI_API_KEY=your-gemini-api-key
   OPENAI_API_KEY=your-openai-api-key (optional)
   SERPER_API_KEY=your-serper-api-key (for web search, optional)
   groq_api_key=your-groq-api-key (optional)
   
   # Database Settings
   DB_PATH=./data/policy_data.db
   
   # Embedding Settings
   EMBEDDING_MODEL=gemini
   CHUNK_SIZE=1000
   CHUNK_OVERLAP=200
   
   # Optional: Set a custom video cutoff date
   # VIDEO_CUTOFF_DATE=2025-03-20
   ```

## Usage

### Configure Content Sources

1. YouTube videos:
   - The system automatically fetches recent videos from the official channels:
     - Liberal Party: Mark Carney's channel (https://www.youtube.com/@MarkJCarney)
     - Conservative Party: Pierre Poilievre's channel (https://www.youtube.com/@PierrePoilievre)
   - By default, it fetches videos uploaded within the last 3 months
   - You can override this by setting the `VIDEO_CUTOFF_DATE` environment variable
   - Add specific videos by editing `src/VideoList.ts`

2. News articles:
   - The system automatically scrapes news from:
     - Liberal Party website: https://liberal.ca/category/media-releases/
     - Conservative Party website: https://www.conservative.ca/news/

3. Web pages:
   - Edit `src/webpageList.ts` to add the web pages you want to scrape
   - Each entry should include a URL, party ID, and optional CSS selector

### Process Content

1. Reset the database (keeps party reference data):
   ```
   npm run reset:db
   ```

2. Process YouTube videos:
   ```
   npm run process:videos
   ```
   
   Limit the number of videos:
   ```
   npm run process:videos -- --max=10
   ```

3. Process news articles:
   ```
   npm run process:news
   ```

4. Process web pages:
   ```
   npm run process:webpages
   ```

5. Process all content types:
   ```
   npm run process:all
   ```

### Exploring the Database

For easy exploration of the database, install Datasette:

```
pip install datasette
```

Then run:

```
datasette data/policy_data.db
```

This provides a web interface to query and explore the data at http://localhost:8001.

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

The project supports multiple embedding models:

```
EMBEDDING_MODEL=gemini  # Uses text-embedding-004 (default)
EMBEDDING_MODEL=openai  # Uses OpenAI embeddings (requires OPENAI_API_KEY)
```

You can configure the text chunking settings:

```
CHUNK_SIZE=1000   # Characters per chunk
CHUNK_OVERLAP=200 # Overlap between chunks
```

### Development Scripts

The repository includes several helpful scripts for development:

- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Run the chat interface with nodemon for auto-reload
- `npm run test:embeddings` - Test embedding functionality
- `npm run migrate:db` - Run database migrations

## Project Structure

- `src/` - TypeScript source code
  - `database/` - Database models and repository
  - `scrapers/` - Web and news scrapers
  - `services/` - Embedding and chat services
  - `utils/` - Utility functions
- `data/` - Database and processed data
- `markdown/` - Exported markdown files
- `docs/` - Documentation

## Contributing

Contributions are welcome! Please feel free to submit a pull request.

## License

MIT 

export const embeddingConfig = {
  model: EMBEDDING_MODEL === 'gemini' ? 'text-embedding-004' : EMBEDDING_MODEL,
  provider: EMBEDDING_MODEL as EmbeddingModelType,
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP
}; 