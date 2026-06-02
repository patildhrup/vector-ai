# Vector AI

Vector is a social video comparison platform that uses retrieval-augmented generation (RAG) to compare two videos from YouTube or Instagram Reel.

It extracts video metadata, transcribes spoken content, embeds transcript segments into a local vector store, and delivers contextual AI responses with inline citations.

## Live demo

- Web app: https://vector-ai-nr5f.onrender.com/
- Demo video: https://youtu.be/ujTwDT2jiqU

## What it does

- Accepts two social video URLs and identifies each platform as YouTube or Instagram.
- Extracts metadata such as title, creator, views, likes, comments, upload date, duration, and engagement rate.
- Retrieves transcripts using YouTube's transcript API when available.
- Falls back to local Whisper transcription for unsupported videos or missing captions.
- Splits transcript text into chunks, embeds them with HuggingFace embeddings, and stores them in ChromaDB.
- Answers natural language questions using a streaming RAG chat interface, with source-aware citations from the transcripts.

## Key features

- Cross-platform comparison for YouTube and Instagram Reels
- Automatic transcript retrieval and local Whisper fallback
- Local Chroma vector store for fast semantic search
- Context-aware AI responses with citations for transparency
- Streaming response support for a responsive chat experience
- Metadata comparison cards for both videos

## Architecture

- Frontend: React + Vite + Tailwind CSS
- Backend: FastAPI + Uvicorn
- Vector store: ChromaDB
- Embeddings: `sentence-transformers/all-MiniLM-L6-v2`
- Transcript extraction: `youtube-transcript-api`, `yt-dlp`, and `whisper`
- LLM: OpenRouter (`google/gemini-2.5-flash`) via `langchain-openai`

## Folder structure

- `backend/` — FastAPI service, RAG logic, transcript and metadata processing
- `frontend/` — React UI for video selection, comparison, and chat
- `backend/chroma_db/` — persisted Chroma database and metadata store

## Getting started

### Prerequisites

- Python 3.12+
- Node.js 20+ and npm
- `OPENROUTER_API_KEY` for OpenRouter access

### Backend

1. Open a terminal and navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Create a `.env` file in `backend/` with:
   ```env
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   ```
4. Start the backend server:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

### Frontend

1. Open a second terminal and navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open the local frontend URL shown by Vite in your browser.


```

## Usage

1. Add one YouTube video and one Instagram Reel, or two videos from either platform.
2. Select two videos for comparison.
3. Click `Compare` to process transcripts and load metadata.
4. Ask follow-up questions in the chat interface.
5. The application responds with AI-backed analysis and cites video sources.

```
### Thanks for comming ☺️

```