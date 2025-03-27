from openai import OpenAI
import os
import contextlib  # Added for proper context management and exiting

client = OpenAI()

## Use the existing vector store named "Public Accounts" if it exists; otherwise create one.
vector_stores = client.beta.vector_stores.list()   # Assuming list() returns the available vector stores
vector_store = next((vs for vs in vector_stores if vs.name == "Public Accounts"), None)
if vector_store is None:
    vector_store = client.beta.vector_stores.create(name="Public Accounts")

# Define the directory containing the PDFs relative to this file
pdfs_directory = os.path.join(os.path.dirname(__file__), "..", "PublicAccountsPDFs","2024")

# Recursively gather all PDF file paths from pdfs_directory
pdf_file_paths = []
for root, dirs, files in os.walk(pdfs_directory):
    for file in files:
        if file.lower().endswith(".pdf"):
            pdf_file_paths.append(os.path.join(root, file))

if not pdf_file_paths:
    print(f"No PDF files found in directory: {pdfs_directory}")
    exit(0)

# Use contextlib.ExitStack to ensure all file streams are properly closed after the upload.
with contextlib.ExitStack() as stack:
    file_streams = [stack.enter_context(open(file_path, "rb")) for file_path in pdf_file_paths]

    # Use the upload and poll SDK helper to upload the files, add them to the vector store,
    # and poll the status of the file batch for completion.
    file_batch = client.beta.vector_stores.file_batches.upload_and_poll(
      vector_store_id=vector_store.id,
      files=file_streams
    )

# You can print the status and the file counts of the batch to see the result of this operation.
print(file_batch.status)
print(file_batch.file_counts)