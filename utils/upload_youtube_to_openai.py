#!/usr/bin/env python3

import os
import argparse
import glob
import json
import sys
from pathlib import Path
import openai
from datetime import datetime
import time
from dotenv import load_dotenv

# Import the YouTube processing functionality
from convert_youtube_to_markdown import process_videos

# Try to import the vector store function, with fallback if not available
try:
    # Import add_to_vector_store function from the vector store module
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from add_files_to_vector_store import add_to_vector_store
    VECTOR_STORE_AVAILABLE = True
except ImportError:
    print("Warning: Vector store module not available. Files will be uploaded to OpenAI but not added to vector store.")
    VECTOR_STORE_AVAILABLE = False

# Load environment variables from .env file
load_dotenv()

# Configure OpenAI client
openai.api_key = os.getenv("OPENAI_API_KEY")

# Default paths
DEFAULT_YOUTUBE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "youtube")
UPLOAD_LOG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "youtube_uploads.jsonl")


def upload_file_to_openai(file_path, purpose="assistants"):
    """
    Upload a file to OpenAI and return the file ID
    """
    print(f"Uploading file: {file_path}")
    
    try:
        with open(file_path, "rb") as file:
            response = openai.files.create(
                file=file,
                purpose=purpose
            )
        file_id = response.id
        print(f"  > Uploaded successfully, file ID: {file_id}")
        return file_id
    
    except Exception as e:
        print(f"  > Error uploading file {file_path}: {e}")
        return None


def log_uploaded_file(file_path, file_id):
    """
    Log the uploaded file details to the log file
    """
    log_entry = {
        "file_path": file_path,
        "file_id": file_id,
        "timestamp": datetime.now().isoformat()
    }
    
    # Ensure log directory exists
    os.makedirs(os.path.dirname(UPLOAD_LOG_PATH), exist_ok=True)
    
    # Append to log file
    with open(UPLOAD_LOG_PATH, "a") as log_file:
        log_file.write(json.dumps(log_entry) + "\n")


def get_uploaded_files():
    """
    Get list of files that have already been uploaded
    """
    if not os.path.exists(UPLOAD_LOG_PATH):
        return set()
    
    uploaded_files = set()
    with open(UPLOAD_LOG_PATH, "r") as log_file:
        for line in log_file:
            try:
                entry = json.loads(line.strip())
                uploaded_files.add(entry["file_path"])
            except:
                pass
    
    return uploaded_files


def add_files_to_vector_store(file_paths):
    """
    Add files to the vector store if available
    Returns number of files added
    """
    if not VECTOR_STORE_AVAILABLE:
        print("Vector store functionality not available, skipping vector store integration")
        return 0
    
    try:
        print(f"Adding {len(file_paths)} files to vector store...")
        count = 0
        for file_path in file_paths:
            try:
                add_to_vector_store(file_path)
                count += 1
                print(f"  > Added {file_path} to vector store")
            except Exception as e:
                print(f"  > Error adding {file_path} to vector store: {e}")
        
        print(f"Successfully added {count} files to vector store")
        return count
    except Exception as e:
        print(f"Error adding files to vector store: {e}")
        return 0


def process_and_upload_youtube(cutoff_date=None, max_videos=50, input_dir=None, process_new=True):
    """
    Process YouTube videos and upload generated markdown files to OpenAI
    
    Args:
        cutoff_date: Only process videos published after this date (YYYY-MM-DD)
        max_videos: Maximum number of videos to process
        input_dir: Directory containing markdown files (if not processing new videos)
        process_new: Whether to process new videos from YouTube
        
    Returns:
        List of OpenAI file IDs for uploaded files
    """
    # Track statistics
    stats = {
        "processed": 0,
        "uploaded": 0,
        "already_uploaded": 0,
        "errors": 0,
        "vector_store_added": 0
    }
    
    # Get list of already uploaded files
    uploaded_files = get_uploaded_files()
    print(f"Found {len(uploaded_files)} already uploaded files")
    
    # List to store new file IDs
    file_ids = []
    
    # List to store files that need to be added to vector store
    vector_store_files = []
    
    # Step 1: Process videos if requested
    markdown_files = []
    if process_new:
        print("Processing new videos from YouTube...")
        try:
            new_files = process_videos(cutoff_date, max_videos)
            markdown_files.extend(new_files)
            stats["processed"] = len(new_files)
        except Exception as e:
            print(f"Error processing videos: {e}")
    
    # Step 2: Find existing markdown files if input directory provided
    if input_dir:
        print(f"Looking for existing markdown files in {input_dir}...")
        for candidate in os.listdir(input_dir):
            candidate_dir = os.path.join(input_dir, candidate)
            if os.path.isdir(candidate_dir):
                for md_file in glob.glob(os.path.join(candidate_dir, "*.md")):
                    if md_file not in markdown_files:
                        markdown_files.append(md_file)
    
    print(f"Found {len(markdown_files)} total markdown files")
    
    # Step 3: Upload files that haven't been uploaded yet
    for file_path in markdown_files:
        # Skip if already uploaded
        if file_path in uploaded_files:
            print(f"Skipping {file_path} - already uploaded")
            stats["already_uploaded"] += 1
            continue
        
        # Upload to OpenAI
        file_id = upload_file_to_openai(file_path)
        
        if file_id:
            # Log the upload
            log_uploaded_file(file_path, file_id)
            file_ids.append(file_id)
            stats["uploaded"] += 1
            
            # Add to list for vector store integration
            vector_store_files.append(file_path)
            
            # Sleep briefly to avoid rate limits
            time.sleep(0.2)
        else:
            stats["errors"] += 1
    
    # Step 4: Add files to vector store
    if vector_store_files:
        stats["vector_store_added"] = add_files_to_vector_store(vector_store_files)
    
    # Print summary
    print("\nUpload summary:")
    print(f"  - Total markdown files: {len(markdown_files)}")
    print(f"  - New videos processed: {stats['processed']}")
    print(f"  - Files uploaded to OpenAI: {stats['uploaded']}")
    print(f"  - Files added to vector store: {stats['vector_store_added']}")
    print(f"  - Files already uploaded: {stats['already_uploaded']}")
    print(f"  - Errors: {stats['errors']}")
    
    return file_ids


def main():
    """Main entry point for the script"""
    parser = argparse.ArgumentParser(description='Process and upload YouTube videos to OpenAI')
    parser.add_argument('--cutoff', type=str, help='Cutoff date in YYYY-MM-DD format')
    parser.add_argument('--max', type=int, help='Maximum number of videos to process',
                      default=50)
    parser.add_argument('--input', type=str, help='Input directory for existing markdown files',
                      default=DEFAULT_YOUTUBE_DIR)
    parser.add_argument('--skip-processing', action='store_true', 
                      help='Skip processing new videos, only upload existing files')
    parser.add_argument('--skip-vector-store', action='store_true',
                      help='Skip adding files to vector store')
    
    args = parser.parse_args()
    
    # If --skip-vector-store is provided, temporarily disable vector store functionality
    if args.skip_vector_store:
        global VECTOR_STORE_AVAILABLE
        VECTOR_STORE_AVAILABLE = False
    
    process_and_upload_youtube(
        cutoff_date=args.cutoff,
        max_videos=args.max,
        input_dir=args.input,
        process_new=not args.skip_processing
    )


if __name__ == "__main__":
    main() 