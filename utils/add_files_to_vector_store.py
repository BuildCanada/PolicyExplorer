from openai import OpenAI
import os
import time
import json
import argparse

client = OpenAI()

def parse_arguments():
    parser = argparse.ArgumentParser(description='Add files to an OpenAI vector store')
    parser.add_argument('--store', default='Policy Explorer',
                      help='Name of the vector store to add files to')
    parser.add_argument('--limit', type=int, default=None,
                      help='Limit the number of files to process (for testing)')
    parser.add_argument('--purpose', default='assistants',
                      help='Filter files by purpose (e.g., "vector_store", "assistants")')
    return parser.parse_args()

def main():
    args = parse_arguments()
    
    # Get all existing files from OpenAI
    print("Fetching list of existing files from OpenAI...")
    try:
        existing_files = client.files.list(purpose=args.purpose)
        if args.limit:
            existing_files.data = existing_files.data[:args.limit]
        
        print(f"Found {len(existing_files.data)} existing files in OpenAI")
    except Exception as e:
        print(f"Error fetching files from OpenAI: {e}")
        exit(1)
    
    if not existing_files.data:
        print("No files found in your OpenAI account. Exiting.")
        exit(0)
    
    # Find the existing vector store
    try:
        vector_stores = client.vector_stores.list()
        vector_store = next((vs for vs in vector_stores.data if vs.name == args.store), None)
        
        if vector_store:
            print(f"Using vector store: {vector_store.name} (ID: {vector_store.id})")
        else:
            print(f"Error: Vector store '{args.store}' not found. Would you like to create it? (y/n)")
            choice = input().lower()
            if choice == 'y':
                vector_store = client.vector_stores.create(name=args.store)
                print(f"Created new vector store: {vector_store.id}")
            else:
                print("Exiting...")
                exit(1)
    except Exception as e:
        print(f"Error accessing vector stores: {e}")
        exit(1)
    
    # Create a list to store vector store file associations
    vector_store_files = []
    
    # Associate each file with the vector store
    for file in existing_files.data:
        file_id = file.id
        file_name = file.filename
        
        print(f"Adding file {file_name} (ID: {file_id}) to vector store...")
        
        try:
            # Associate file with vector store
            vector_store_file = client.vector_stores.files.create(
                vector_store_id=vector_store.id,
                file_id=file_id
            )
            vector_store_files.append({
                "file_name": file_name,
                "file_id": file_id,
                "vector_store_file_id": vector_store_file.id
            })
            print(f"Associated file {file_id} with vector store {vector_store.id}")
            
            # Small delay to avoid rate limiting
            time.sleep(0.1)
        
        except Exception as e:
            if "already exists" in str(e).lower():
                print(f"File {file_id} is already associated with this vector store")
            else:
                print(f"Error associating file {file_id} with vector store: {e}")
    
    print(f"Successfully associated {len(vector_store_files)} files with vector store '{vector_store.name}'")
    
    # Save the vector store file IDs to a JSON file for reference
    output_file = "vector_store_files.json"
    with open(output_file, "w") as f:
        json.dump({
            "vector_store_id": vector_store.id,
            "vector_store_name": vector_store.name,
            "files": vector_store_files
        }, f, indent=2)
    
    print(f"Vector store file information saved to {output_file}")

if __name__ == "__main__":
    main() 