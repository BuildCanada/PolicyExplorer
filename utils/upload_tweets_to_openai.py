from openai import OpenAI
import os
import time
import json

client = OpenAI()

# Define the directory containing the tweets relative to this file
tweets_directory = os.path.join(os.path.dirname(__file__), "..", "tweets")

# Recursively gather all markdown file paths from tweets_directory
markdown_file_paths = []
for root, dirs, files in os.walk(tweets_directory):
    # Only look in directories named 'markdown'
    if os.path.basename(root) == 'markdown':
        for file in files:
            if file.lower().endswith(".md"):
                markdown_file_paths.append(os.path.join(root, file))

if not markdown_file_paths:
    print(f"No markdown files found in tweets directories")
    exit(0)

print(f"Found {len(markdown_file_paths)} markdown files to upload")

# Create a dictionary to store file information
file_info = {}

# Upload each file to OpenAI
for file_path in markdown_file_paths:
    file_name = os.path.basename(file_path)
    print(f"Uploading {file_path}...")
    
    try:
        with open(file_path, "rb") as file:
            response = client.files.create(
                file=file,
                purpose="vector_store"  # Using vector_store purpose
            )
            file_id = response.id
            
            # Store file information
            file_info[file_name] = {
                "file_id": file_id,
                "original_path": file_path
            }
            
            print(f"Uploaded {file_name} as {file_id}")
        
        # Small delay to avoid rate limiting
        time.sleep(0.5)
    
    except Exception as e:
        print(f"Error uploading {file_path}: {e}")

print(f"Successfully uploaded {len(file_info)} files to OpenAI")

# Save the file information to a JSON file for reference
output_file = "uploaded_tweet_files.json"
with open(output_file, "w") as f:
    json.dump(file_info, f, indent=2)

print(f"File information saved to {output_file}")
print("You can now use add_files_to_vector_store.py to associate these files with a vector store.") 