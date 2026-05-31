import os
import json
from dotenv import load_dotenv
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import ChatOpenAI

load_dotenv()

# File path to persist current compared video metadata
METADATA_PATH = os.path.join(os.path.dirname(__file__), "..", "chroma_db", "metadata.json")

_embeddings = None
_vector_store = None

def get_embeddings():
    global _embeddings
    if _embeddings is None:
        from langchain_community.embeddings import HuggingFaceEmbeddings
        print("Loading HuggingFace Embeddings ('all-MiniLM-L6-v2')...")
        _embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={'device': 'cpu'}
        )
    return _embeddings

def get_vector_store():
    global _vector_store
    if _vector_store is None:
        from langchain_community.vectorstores import Chroma
        db_path = os.path.join(os.path.dirname(__file__), "..", "chroma_db")
        print(f"Loading Chroma DB at {db_path}...")
        _vector_store = Chroma(
            persist_directory=db_path,
            embedding_function=get_embeddings(),
            collection_name="video_rag"
        )
    return _vector_store

def save_videos_metadata(metadata_a: dict, metadata_b: dict):
    """Persists video A and video B metadata to a JSON file"""
    os.makedirs(os.path.dirname(METADATA_PATH), exist_ok=True)
    with open(METADATA_PATH, "w") as f:
        json.dump({"A": metadata_a, "B": metadata_b}, f, indent=2)

def load_videos_metadata():
    """Loads stored video metadata"""
    if not os.path.exists(METADATA_PATH):
        return {"A": None, "B": None}
    try:
        with open(METADATA_PATH, "r") as f:
            return json.load(f)
    except Exception:
        return {"A": None, "B": None}

def clear_vector_db():
    """Clears the Chroma collection to start a fresh comparison"""
    try:
        db = get_vector_store()
        db.delete_collection()
        # Reset the global variable to force recreation
        global _vector_store
        _vector_store = None
        
        # Also delete metadata JSON
        if os.path.exists(METADATA_PATH):
            os.remove(METADATA_PATH)
    except Exception as e:
        print(f"Error clearing vector store: {e}")

def add_transcript_to_db(transcript: str, video_id: str, metadata: dict):
    """Chunks transcript, embeds, and stores in local ChromaDB"""
    if not transcript or transcript == "No transcript could be retrieved for this video.":
        print(f"No transcript to add for video {video_id}")
        return
        
    db = get_vector_store()
    
    # Split text into chunks
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=100
    )
    chunks = text_splitter.split_text(transcript)
    
    # Create metadatas
    metadatas = [{
        "video_id": video_id,
        "video_title": metadata.get("title", f"Video {video_id}"),
        "creator": metadata.get("creator", "Creator"),
        "chunk_index": i,
        "url": metadata.get("url", "")
    } for i, _ in enumerate(chunks)]
    
    print(f"Adding {len(chunks)} chunks to vector store for Video {video_id}...")
    db.add_texts(
        texts=chunks,
        metadatas=metadatas
    )

def _video_prompt_block(slot: str, meta: dict) -> str:
    platform = "YouTube" if meta.get("is_youtube") else "Instagram Reel" if meta.get("is_instagram") else "Social Video"
    audience = "subscribers" if meta.get("is_youtube") else "followers"
    return (
        f"--- VIDEO {slot} ({platform}) ---\n"
        f"Title: {meta.get('title', 'N/A')}\n"
        f"Creator: {meta.get('creator', 'N/A')} ({meta.get('follower_count', 0):,} {audience})\n"
        f"Views: {meta.get('views', 0):,}\n"
        f"Likes: {meta.get('likes', 0):,}\n"
        f"Comments: {meta.get('comments', 0):,}\n"
        f"Engagement Rate: {meta.get('engagement_rate', 0.0)}%\n"
        f"Upload Date: {meta.get('upload_date', 'N/A')}\n"
        f"Duration: {meta.get('duration', 0)}s\n"
        f"Hashtags: {', '.join(meta.get('hashtags', []))}\n"
        f"URL: {meta.get('url', 'N/A')}\n"
    )

def query_rag_stream(question: str, chat_history: list):
    """Retrieves relevant transcript chunks and streams RAG response using OpenRouter LLM"""
    db = get_vector_store()
    v_meta = load_videos_metadata()
    
    meta_a = v_meta.get("A") or {}
    meta_b = v_meta.get("B") or {}
    
    # RAG Retrieval - search for related content in both transcripts
    # We fetch top 5 relevant chunks
    docs = db.similarity_search(question, k=5)
    
    # Extract matching chunks and construct citations list
    retrieved_chunks = []
    cited_sources = []
    for doc in docs:
        vid = doc.metadata.get("video_id", "A")
        chunk_idx = doc.metadata.get("chunk_index", 0)
        title = doc.metadata.get("video_title", f"Video {vid}")
        
        chunk_info = {
            "video_id": vid,
            "video_title": title,
            "chunk_index": chunk_idx,
            "content": doc.page_content
        }
        retrieved_chunks.append(f"[Video {vid}, Chunk {chunk_idx + 1}]: {doc.page_content}")
        
        source_id = f"Video {vid}"
        chunk_num = chunk_idx + 1
        cite_key = f"{source_id}:chunk:{chunk_num}"
        if cite_key not in [s.get("key") for s in cited_sources]:
            cited_sources.append({
                "key": cite_key,
                "source": source_id,
                "chunk": chunk_num,
                "title": title,
                "url": doc.metadata.get("url", "")
            })
            
    retrieved_context = "\n\n".join(retrieved_chunks)
    
    # Format chat history for prompt
    formatted_history = ""
    for msg in chat_history[-6:]: # Keep last 3 turns
        role = "User" if msg.get("role") == "user" else "Assistant"
        formatted_history += f"{role}: {msg.get('content')}\n"
        
    # Build System and User Prompt
    system_prompt = (
        "You are an expert Social Media Strategist and RAG Assistant helping creators compare two social videos.\n"
        "Videos may be from YouTube, Instagram Reels, or any mix of those platforms.\n\n"
        "Here is the structured metadata for the two videos being compared:\n\n"
        f"{_video_prompt_block('A', meta_a)}\n"
        f"{_video_prompt_block('B', meta_b)}\n"
        f"--- TRANSCRIPT CONTEXT (Retrieved from Database) ---\n"
        f"{retrieved_context if retrieved_context else 'No matching transcript parts found.'}\n\n"
        f"--- CHAT HISTORY ---\n"
        f"{formatted_history if formatted_history else 'None'}\n\n"
        "Instructions:\n"
        "1. Provide a comprehensive, professional, and strategic response. Use bullet points and paragraphs for readability.\n"
        "2. Directly answer comparative queries using the provided metadata and transcripts, regardless of whether both videos are from the same platform.\n"
        "3. CITATION REQUIREMENT: Whenever you reference specific information, ideas, or spoken text from a video transcript, you MUST cite the source inline (e.g., '[Video A]' or '[Video B]'). Cite prominently.\n"
        "4. Output must be clean, structured markdown. Maintain context across turns.\n"
    )
    
    # Initialize OpenRouter LLM (Gemini 2.5 Flash is highly capable and low cost)
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY environment variable is not set.")
        
    llm = ChatOpenAI(
        openai_api_key=api_key,
        openai_api_base="https://openrouter.ai/api/v1",
        model_name="google/gemini-2.5-flash",
        default_headers={
            "HTTP-Referer": "http://localhost:5173",
            "X-Title": "Video RAG Chatbot"
        },
        streaming=True,
        temperature=0.4,
        max_tokens=1500
    )
    
    # Stream the generator
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": question}
    ]
    
    # Yield source citations first (so UI can capture and display them)
    yield f"__SOURCES__:{json.dumps(cited_sources)}\n"
    
    try:
        for chunk in llm.stream(messages):
            yield chunk.content
    except Exception as e:
        print(f"Error during LLM streaming: {e}")
        yield f"\n\n[System Error: Failed to generate streaming response from OpenRouter: {e}]"
