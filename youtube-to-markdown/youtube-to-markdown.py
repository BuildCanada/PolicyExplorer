from youtube_transcript_api import YouTubeTranscriptApi
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np

# --- CONFIG ---
video_ids = [
    "aNThs1qx2hA",
    "WwM7WU442KE",
    "ORfSSPO4P4E"
]
embedding_model_name = "all-MiniLM-L6-v2"

# --- STEP 1: Fetch transcripts ---
def fetch_transcripts(video_ids):
    transcripts = {}
    for vid in video_ids:
        try:
            transcript = YouTubeTranscriptApi.get_transcript(vid)
            text = " ".join([entry['text'] for entry in transcript])
            transcripts[vid] = text
        except Exception as e:
            transcripts[vid] = f"Error: {str(e)}"
    return transcripts

# --- STEP 2: Chunk the transcript ---
def chunk_text(text, chunk_size=500, overlap=50):
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i+chunk_size])
        chunks.append(chunk)
    return chunks

# --- STEP 3: Embed and store with FAISS ---
def create_faiss_index(chunks, model):
    vectors = model.encode(chunks)
    dimension = vectors.shape[1]
    index = faiss.IndexFlatL2(dimension)
    index.add(np.array(vectors))
    return index, vectors

# --- MAIN ---
transcripts = fetch_transcripts(video_ids)
model = SentenceTransformer(embedding_model_name)

all_chunks = []
metadata = []
for vid, text in transcripts.items():
    if not text.startswith("Error"):
        chunks = chunk_text(text)
        all_chunks.extend(chunks)
        metadata.extend([vid] * len(chunks))

index, vectors = create_faiss_index(all_chunks, model)

# Optionally save index to disk
# faiss.write_index(index, "youtube_transcripts.index")