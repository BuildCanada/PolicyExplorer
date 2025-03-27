# PolicyExplorer
Tracking policy positions for each federal party. 


## Tweet to Markdown Converter

This script converts tweets stored in JSON format to individual markdown files. It's designed to work with the existing tweet directory structure and creates markdown files for tweets.

## Directory Structure

The script expects the following directory structure:
```
tweets/
  ├── Username1/
  │    ├── json/      # Contains raw JSON files from Twitter API
  │    └── markdown/  # Output directory for markdown files
  ├── Username2/
  │    ├── json/
  │    └── markdown/
  └── ...
```

## Features

- Processes all JSON files in the `tweets/*/json` directories
- Generates one markdown file per tweet with the tweet ID as the filename
- Saves markdown files to the corresponding `tweets/*/markdown` directory
- Includes author name, username, tweet text, date, and a link to the original tweet
- Properly handles quoted tweets and retweets, including their content and links
- Handles pinned tweets and regular tweets
- Error handling for malformed JSON files

## Usage

1. Make sure the script has executable permissions:
   ```bash
   chmod +x convert_tweets_to_markdown.py
   ```

2. Run the script:
   ```bash
   ./convert_tweets_to_markdown.py
   ```

3. The converted markdown files will be saved in the `tweets/*/markdown` directories.

## Output Format

Each markdown file will have the following format:

```markdown
# Tweet by Author Name (@username)

Tweet text content here

Date: YYYY-MM-DD HH:MM:SS

[Original Tweet](https://x.com/username/status/tweet_id)
```

For quote tweets, the format will include:

```markdown
## Quoting Tweet

**Author Name (@username):** Quoted tweet text content here

[Original Quoted Tweet](https://x.com/username/status/tweet_id)
```

For retweets, the format will include:

```markdown
## Retweeted Tweet

**Author Name (@username):** Retweeted text content here

[Original Retweeted Tweet](https://x.com/username/status/tweet_id)
```

## Requirements

- Python 3.6 or higher
- No external dependencies (uses only standard library modules)

## Integration with OpenAI Vector Store

The one-file-per-tweet approach makes it efficient to:
1. Upload only new tweets to the vector store
2. Create individual vector embeddings per tweet
3. Easily track and manage changes

## Related Scripts

- `scrapers/scrape_tweets.sh` - Downloads tweets from Twitter API and saves them to the json subdirectory 