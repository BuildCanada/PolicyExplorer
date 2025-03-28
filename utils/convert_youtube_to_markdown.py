#!/usr/bin/env python3

import os
import json
import argparse
import re
import subprocess
from datetime import datetime, timedelta
import langdetect
from youtube_transcript_api import YouTubeTranscriptApi


# Define supported candidates
CANDIDATES = ["Mark Carney", "Pierre Poilievre", "Jagmeet Singh"]

# Set default output directory
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "youtube")


def detect_language(text):
    """
    Detect if text is in English or French
    Returns 'en' for English, 'fr' for French
    """
    # Skip detection for very short texts (less than 5 words)
    word_count = len(text.split())
    if word_count < 5:
        # For very short texts, rely on accents as a stronger signal
        return 'fr' if re.search(r'[éèêëàâäôöûüçîï]', text, re.IGNORECASE) else 'en'
    
    try:
        return langdetect.detect(text)
    except:
        # If language detection fails, check for French accents
        return 'fr' if re.search(r'[éèêëàâäôöûüçîï]', text, re.IGNORECASE) else 'en'


def format_date(date_str):
    """
    Format date string from YYYYMMDD to YYYY-MM-DD
    """
    if len(date_str) == 8:
        return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
    return date_str


def is_after_cutoff_date(date_str, cutoff_date):
    """Check if a date is after the cutoff date"""
    formatted_date = format_date(date_str)
    return formatted_date >= cutoff_date


def get_default_cutoff_date():
    """Get a default cutoff date (3 months ago)"""
    three_months_ago = datetime.now() - timedelta(days=90)
    return three_months_ago.strftime("%Y-%m-%d")


def sanitize_filename(name):
    """Sanitize a string to be used as a filename"""
    return re.sub(r'[^a-zA-Z0-9_\-\.]', '_', name)[:100]


def get_video_metadata(youtube_url):
    """
    Fetch metadata for a YouTube video using yt-dlp
    Returns: dict with video metadata or None if failed
    """
    print(f"Fetching metadata for: {youtube_url}")
    
    try:
        command = ["yt-dlp", "--dump-json", "--skip-download", youtube_url]
        result = subprocess.run(command, capture_output=True, text=True, check=True)
        
        if result.stderr:
            print(f"[yt-dlp stderr]: {result.stderr}")
        
        metadata = json.loads(result.stdout)
        
        # Basic validation
        if not all(key in metadata for key in ['id', 'title', 'upload_date']):
            print(f"Error: Missing essential metadata for {youtube_url}")
            return None
        
        # Set default language to English
        metadata['language'] = 'en'
        print(f"  > Fetched Title: {metadata['title']}")
        print(f"  > Upload Date: {format_date(metadata['upload_date'])}")
        
        return metadata
    
    except subprocess.CalledProcessError as e:
        print(f"Error executing yt-dlp: {e}")
        return None
    except json.JSONDecodeError:
        print(f"Error parsing metadata JSON for {youtube_url}")
        return None
    except Exception as e:
        print(f"Error fetching metadata for {youtube_url}: {e}")
        return None


def get_transcript(youtube_url):
    """
    Fetch transcript for a YouTube video
    Returns: transcript text or None if unavailable
    """
    print(f"Fetching transcript for: {youtube_url}")
    video_id = youtube_url.split("v=")[1] if "v=" in youtube_url else youtube_url.split("/")[-1]
    
    try:
        transcript_items = YouTubeTranscriptApi.get_transcript(video_id, languages=['en'])
        
        if not transcript_items:
            print(f"  > No transcript found for {youtube_url}")
            return None
        
        # Combine transcript parts into a single string
        full_transcript = " ".join(item['text'] for item in transcript_items)
        print(f"  > Fetched transcript (length: {len(full_transcript)})")
        return full_transcript
    
    except Exception as e:
        # Handle common errors
        error_msg = str(e)
        if "disabled" in error_msg:
            print(f"  > Transcripts are disabled for {youtube_url}")
        elif "No transcript found" in error_msg:
            print(f"  > No transcript found for {youtube_url} (may not exist or not be in English)")
        else:
            print(f"Error fetching transcript for {youtube_url}: {e}")
        return None


def get_videos_to_process(cutoff_date, max_videos=50):
    """
    Dynamically retrieve recent videos from specified channels
    Returns: list of dicts with video URL and candidate
    """
    print(f"Fetching videos published after {cutoff_date}")
    
    # Calculate per-channel limit
    per_channel_limit = max_videos // 2
    
    all_videos = []
    
    # Channels to process
    channels = {
        "https://www.youtube.com/@PierrePoilievre/videos": "Pierre Poilievre",
        "https://www.youtube.com/@MarkJCarney": "Mark Carney",
        "https://www.youtube.com/@jagmeetsingh": "Jagmeet Singh"
    }
    
    # Process each channel
    for channel_url, candidate in channels.items():
        print(f"Processing channel: {channel_url} for candidate: {candidate}")
        try:
            command = [
                "yt-dlp", 
                "--print", "%(id)s|%(title)s|%(upload_date)s", 
                "--no-playlist", 
                channel_url, 
                "--max-downloads", str(per_channel_limit)
            ]
            
            result = subprocess.run(command, capture_output=True, text=True)
            
            if result.returncode != 0 and not result.stdout:
                print(f"Error fetching videos for {candidate}: {result.stderr}")
                continue
            
            # Process output
            lines = result.stdout.strip().split('\n')
            print(f"Got {len(lines)} videos from {candidate}")
            
            # Parse video information
            for line in lines:
                if not line.strip():
                    continue
                
                parts = line.split('|')
                if len(parts) < 3:
                    continue
                
                video_id, title, upload_date = parts
                
                # Skip if before cutoff date
                formatted_date = upload_date
                if len(upload_date) == 8:  # YYYYMMDD format
                    formatted_date = f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:8]}"
                
                if formatted_date < cutoff_date:
                    print(f"Skipping video {video_id} - published on {formatted_date}, before cutoff {cutoff_date}")
                    continue
                
                # Check if video is in English
                is_english = detect_language(title) == 'en'
                if not is_english:
                    print(f"Skipping non-English video: {title}")
                    continue
                
                all_videos.append({
                    "url": f"https://www.youtube.com/watch?v={video_id}",
                    "candidate": candidate
                })
                
                print(f"Added video: {video_id} - {title} ({formatted_date})")
            
        except Exception as e:
            print(f"Error processing channel {channel_url}: {e}")
    
    print(f"Total videos found from channels: {len(all_videos)}")
    return all_videos[:max_videos]


def process_videos(cutoff_date=None, max_videos=50, output_dir=None):
    """
    Main function to process videos
    - Fetches videos published after cutoff_date
    - Downloads metadata and transcripts
    - Converts to markdown
    
    Returns: list of processed markdown file paths
    """
    # Set defaults
    if cutoff_date is None:
        cutoff_date = get_default_cutoff_date()
    
    if output_dir is None:
        output_dir = OUTPUT_DIR
    
    print(f"Starting video processing...")
    print(f"Using cutoff date: {cutoff_date} (will only process videos published after this date)")
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Get videos to process
    videos = get_videos_to_process(cutoff_date, max_videos)
    
    # Track processing stats
    processed_files = []
    processed_count = 0
    skipped_count = 0
    error_count = 0
    before_cutoff_count = 0
    
    # Process each video
    for video in videos:
        youtube_url = video["url"]
        candidate = video["candidate"]
        
        print(f"\nProcessing URL: {youtube_url} for Candidate: {candidate}")
        
        try:
            # Get video metadata
            metadata = get_video_metadata(youtube_url)
            if not metadata:
                print(f"Skipping video due to metadata fetch error: {youtube_url}")
                error_count += 1
                continue
            
            # Check if the video is after our cutoff date
            if not is_after_cutoff_date(metadata["upload_date"], cutoff_date):
                print(f"  > Video published on {format_date(metadata['upload_date'])} is before cutoff date {cutoff_date}, skipping")
                before_cutoff_count += 1
                continue
            
            # Check if markdown file already exists
            candidate_dir = os.path.join(output_dir, sanitize_filename(candidate))
            os.makedirs(candidate_dir, exist_ok=True)
            
            filename = f"{metadata['id']}.md"
            file_path = os.path.join(candidate_dir, filename)
            
            if os.path.exists(file_path):
                print(f"  > Markdown file already exists for video {metadata['id']}, skipping")
                skipped_count += 1
                continue
            
            # Get transcript
            transcript = get_transcript(youtube_url)
            
            # Create markdown content
            markdown_content = f"""---
title: "{metadata['title'].replace('"', '\\"')}"
candidate: "{candidate}"
date: {format_date(metadata['upload_date'])}
video_url: {metadata['webpage_url']}
id: {metadata['id']}
---

# {metadata['title']}

**Candidate:** {candidate}
**Date:** {format_date(metadata['upload_date'])}
**Source:** [YouTube Video]({metadata['webpage_url']})

## Transcript

"""
            
            if transcript:
                markdown_content += transcript
            else:
                markdown_content += "*Transcript not available or could not be fetched.*"
            
            if 'description' in metadata and metadata['description']:
                markdown_content += f"\n\n## Video Description\n\n{metadata['description']}"
            
            # Write markdown file
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(markdown_content)
            
            print(f"  > Successfully saved Markdown to: {file_path}")
            processed_count += 1
            processed_files.append(file_path)
            
        except Exception as e:
            print(f"Error processing video {youtube_url}: {e}")
            error_count += 1
    
    # Print summary
    print('\nVideo processing summary:')
    print(f"  - Total videos found: {len(videos)}")
    print(f"  - Videos before cutoff date ({cutoff_date}): {before_cutoff_count}")
    print(f"  - Successfully processed: {processed_count}")
    print(f"  - Skipped (already processed): {skipped_count}")
    print(f"  - Errors: {error_count}")
    
    return processed_files


def main():
    """Main entry point for the script"""
    parser = argparse.ArgumentParser(description='Convert YouTube videos to markdown')
    parser.add_argument('--cutoff', type=str, help='Cutoff date in YYYY-MM-DD format',
                       default=get_default_cutoff_date())
    parser.add_argument('--max', type=int, help='Maximum number of videos to process',
                       default=50)
    parser.add_argument('--output', type=str, help='Output directory',
                       default=OUTPUT_DIR)
    
    args = parser.parse_args()
    
    process_videos(args.cutoff, args.max, args.output)


if __name__ == "__main__":
    main() 