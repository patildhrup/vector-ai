from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from app.video_processor import extract_video_metadata, get_transcript_for_url
from app.rag_service import (
    clear_vector_db,
    add_transcript_to_db,
    save_videos_metadata,
    load_videos_metadata,
    query_rag_stream
)

router = APIRouter()

def _platform_name(meta: dict) -> str:
    if meta.get("is_youtube"):
        return "YouTube"
    if meta.get("is_instagram"):
        return "Instagram Reel"
    return "Social Video"

def _audience_label(meta: dict) -> str:
    if meta.get("is_youtube"):
        return "subscribers"
    return "followers"

class ProcessRequest(BaseModel):
    url_a: str
    url_b: str

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    question: str
    chat_history: List[Dict[str, Any]] = []

@router.get("/api/status")
async def get_status():
    """Checks if videos are already loaded and returns their metadata if so"""
    metadata = load_videos_metadata()
    if metadata.get("A") and metadata.get("B"):
        return {
            "loaded": True,
            "video_a": metadata["A"],
            "video_b": metadata["B"]
        }
    return {"loaded": False}

@router.post("/api/process")
async def process_videos(request: ProcessRequest):
    """Processes both videos: extracts metadata, transcribes them, splits, embeds, and stores in ChromaDB"""
    url_a = request.url_a.strip()
    url_b = request.url_b.strip()
    
    if not url_a or not url_b:
        raise HTTPException(status_code=400, detail="Both video URLs are required.")
        
    print(f"Starting video processing for URLs:\n  Video A: {url_a}\n  Video B: {url_b}")
    
    # 1. Clear database to start fresh
    print("Clearing vector store for fresh comparison...")
    clear_vector_db()
    
    # 2. Extract metadata (platform detected from URL)
    print("Extracting Video A metadata...")
    meta_a = extract_video_metadata(url_a)
    
    print("Extracting Video B metadata...")
    meta_b = extract_video_metadata(url_b)
    
    platform_a = _platform_name(meta_a)
    platform_b = _platform_name(meta_b)
    meta_a["label"] = f"Video A ({platform_a})"
    meta_b["label"] = f"Video B ({platform_b})"
    
    # 3. Extract transcripts
    print("Retrieving Video A transcript...")
    transcript_a = get_transcript_for_url(
        url_a,
        is_youtube=meta_a.get("is_youtube", False),
        video_id=meta_a.get("video_id", ""),
    )
    
    print("Retrieving Video B transcript...")
    transcript_b = get_transcript_for_url(
        url_b,
        is_youtube=meta_b.get("is_youtube", False),
        video_id=meta_b.get("video_id", ""),
    )
    
    # 4. Persist video metadata
    print("Saving videos metadata...")
    save_videos_metadata(meta_a, meta_b)
    
    # 5. Chunk, Embed, and Index transcripts in ChromaDB
    print("Indexing Video A transcript in ChromaDB...")
    add_transcript_to_db(transcript_a, "A", meta_a)
    
    print("Indexing Video B transcript in ChromaDB...")
    add_transcript_to_db(transcript_b, "B", meta_b)
    
    print("Processing complete!")
    return {
        "success": True,
        "video_a": meta_a,
        "video_b": meta_b
    }

@router.post("/api/chat")
async def chat_rag(request: ChatRequest):
    """Streams the RAG response with inline source citations and maintains memory"""
    if not request.question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
        
    metadata = load_videos_metadata()
    if not metadata.get("A") or not metadata.get("B"):
        raise HTTPException(status_code=400, detail="No videos processed yet. Please upload video URLs first.")
        
    print(f"Chat RAG query: {request.question}")
    
    # Return streaming text generator
    generator = query_rag_stream(request.question, request.chat_history)
    return StreamingResponse(generator, media_type="text/plain")

@router.post("/api/clear")
async def clear_comparison():
    """Clears currently loaded comparison"""
    clear_vector_db()
    return {"success": True, "message": "Vector DB and metadata cleared."}
