#!/usr/bin/env python3
import json
import os
import glob
from datetime import datetime
import re
import sys

print("Script starting...")
print(f"Python version: {sys.version}")

def sanitize_filename(filename):
    """Remove characters that are invalid in filenames."""
    return re.sub(r'[\\/*?:"<>|]', "", filename)

def parse_tweet_datetime(created_at):
    """Parse the tweet's creation date into a more readable format."""
    try:
        # Format: "Thu Mar 27 03:17:10 +0000 2025"
        dt = datetime.strptime(created_at, "%a %b %d %H:%M:%S %z %Y")
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except:
        return created_at  # Return as-is if parsing fails

def format_user_info(user):
    """Format user information for display."""
    if not user or not isinstance(user, dict):
        return "Unknown User (@unknown)"
    
    name = user.get("name", "Unknown")
    username = user.get("userName", "unknown")
    return f"{name} (@{username})"

def convert_tweet_to_markdown(tweet, username):
    """Convert a single tweet to markdown format."""
    tweet_id = tweet.get("id", "unknown")
    
    # Get author information
    author = tweet.get("author", {})
    author_name = author.get("name", username)
    author_username = author.get("userName", username)
    
    # Get tweet content
    text = tweet.get("text", "")
    created_at = parse_tweet_datetime(tweet.get("createdAt", ""))
    tweet_url = tweet.get("url", "")
    
    # Format as markdown
    markdown = f"# Tweet by {author_name} (@{author_username})\n\n"
    markdown += f"{text}\n\n"
    
    # Handle quoted tweet if present
    quoted_tweet = tweet.get("quoted_tweet")
    if quoted_tweet and isinstance(quoted_tweet, dict):
        q_author = format_user_info(quoted_tweet.get("author", {}))
        q_text = quoted_tweet.get("text", "")
        q_url = quoted_tweet.get("url", "")
        
        markdown += "## Quoting Tweet\n\n"
        markdown += f"**{q_author}:** {q_text}\n\n"
        if q_url:
            markdown += f"[Original Quoted Tweet]({q_url})\n\n"
    
    # Handle retweeted tweet if present
    retweeted_tweet = tweet.get("retweeted_tweet")
    if retweeted_tweet and isinstance(retweeted_tweet, dict):
        rt_author = format_user_info(retweeted_tweet.get("author", {}))
        rt_text = retweeted_tweet.get("text", "")
        rt_url = retweeted_tweet.get("url", "")
        
        markdown += "## Retweeted Tweet\n\n"
        markdown += f"**{rt_author}:** {rt_text}\n\n"
        if rt_url:
            markdown += f"[Original Retweeted Tweet]({rt_url})\n\n"
        
        # Check if the retweet itself has a quoted tweet
        rt_quoted_tweet = retweeted_tweet.get("quoted_tweet")
        if rt_quoted_tweet and isinstance(rt_quoted_tweet, dict):
            rtq_author = format_user_info(rt_quoted_tweet.get("author", {}))
            rtq_text = rt_quoted_tweet.get("text", "")
            rtq_url = rt_quoted_tweet.get("url", "")
            
            markdown += "### Quoted in Retweet\n\n"
            markdown += f"**{rtq_author}:** {rtq_text}\n\n"
            if rtq_url:
                markdown += f"[Original Quote in Retweet]({rtq_url})\n\n"
    
    markdown += f"Date: {created_at}\n\n"
    markdown += f"[Original Tweet]({tweet_url})\n"
    
    return markdown, tweet_id

def process_json_file(json_file_path, output_dir):
    """Process a single JSON file containing tweets."""
    try:
        # Get username from directory path (two levels up from json file)
        username = os.path.basename(os.path.dirname(os.path.dirname(json_file_path)))
        
        # Create output directory for this user's markdown
        user_output_dir = os.path.join(output_dir, username, "markdown")
        os.makedirs(user_output_dir, exist_ok=True)
        
        # Read and parse JSON
        with open(json_file_path, 'r', encoding='utf-8') as f:
            try:
                tweet_data = json.load(f)
            except json.JSONDecodeError:
                print(f"Error parsing JSON in {json_file_path}")
                return 0
        
        # Check if the expected structure is present
        if not isinstance(tweet_data, dict):
            print(f"Unexpected format in {json_file_path}")
            return 0
        
        # Get the tweets list
        tweets = []
        data = tweet_data.get('data', {})
        
        # Add pin_tweet if it exists and is not None
        pin_tweet = data.get('pin_tweet')
        if pin_tweet and isinstance(pin_tweet, dict):
            tweets.append(pin_tweet)
        
        # Add regular tweets
        tweets_list = data.get('tweets', [])
        if isinstance(tweets_list, list):
            tweets.extend(tweets_list)
        
        tweets_processed = 0
        
        # Process each tweet
        for tweet in tweets:
            if not isinstance(tweet, dict):
                continue
            
            # Convert to markdown
            markdown_content, tweet_id = convert_tweet_to_markdown(tweet, username)
            
            # Write to file
            output_file = os.path.join(user_output_dir, f"{tweet_id}.md")
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(markdown_content)
            
            tweets_processed += 1
        
        return tweets_processed
    
    except Exception as e:
        print(f"Error processing {json_file_path}: {e}")
        return 0

def main():
    # Define directories
    tweets_dir = "tweets"
    
    print(f"Working directory: {os.getcwd()}")
    print(f"Tweets directory exists: {os.path.exists(tweets_dir)}")
    
    # Find all JSON files in the json subdirectories
    print("Searching for JSON files...")
    
    try:
        # Manual recursive search targeting the json subdirectories
        json_files = []
        for user_dir in os.listdir(tweets_dir):
            user_json_dir = os.path.join(tweets_dir, user_dir, "json")
            if os.path.isdir(user_json_dir):
                for file in os.listdir(user_json_dir):
                    if file.endswith('.json'):
                        json_files.append(os.path.join(user_json_dir, file))
    except Exception as e:
        print(f"Error walking directory: {e}")
        return
    
    total_files = len(json_files)
    print(f"Found {total_files} JSON files to process")
    
    if total_files == 0:
        print("No JSON files found. Check the tweets directory path.")
        return
    
    total_tweets = 0
    
    # Process each file
    for i, json_file in enumerate(json_files):
        print(f"Processing file {i+1}/{total_files}: {json_file}")
        tweets_processed = process_json_file(json_file, tweets_dir)
        total_tweets += tweets_processed
        print(f"  Converted {tweets_processed} tweets to markdown")
    
    print(f"\nConversion complete. {total_tweets} tweets converted to markdown.")

if __name__ == "__main__":
    main() 