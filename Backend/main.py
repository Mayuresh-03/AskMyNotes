import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from starlette.middleware.sessions import SessionMiddleware
from dotenv import load_dotenv

# 1. Load env first
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("askmynotes.api")

# 2. Database & Models setup
from database.postgresConn import engine, Base
from models.all_model import User, Subject, Note, NoteEmbedding, Flashcard, PracticeSession

# 3. Import Engines
from utilis.rag_engine import RAGEngine
from utilis.study_engine import StudyEngine 

# 4. Define Lifespan for Engine initialization
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AskMyNotes backend and Engines...")
    
    # Initialize Core RAG Engine
    app.state.rag_engine = RAGEngine()
    
    # Initialize Study Engine for Flashcards/Web Search
    app.state.study_engine = StudyEngine(app.state.rag_engine)
    
    # Create tables in Supabase (pgvector extension must be enabled).
    # create_all does not alter an existing data_note_embeddings table, so add
    # the LlamaIndex node_id column when it is missing.
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        conn.execute(text(
            "ALTER TABLE data_note_embeddings "
            "ADD COLUMN IF NOT EXISTS node_id VARCHAR"
        ))
    
    yield
    logger.info("Shutting down AskMyNotes backend.")

# 5. Initialize App with Lifespan
app = FastAPI(title="AskMyNotes", lifespan=lifespan)

# 6. Secure Session Middleware
app.add_middleware(
    SessionMiddleware, 
    secret_key=os.getenv("SESSION_SECRET", "super-secret-fallback-key"),
    same_site="lax",
    https_only=False
)

# 7. CORS Configuration with Exposed Response Headers
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Transcript", "X-Answer", "X-Confidence", "X-Citations"],
)

# 8. Import Existing Routers (NO study_routes)
from router import auth_routes, user_routes, note_routes, ai_routes

app.include_router(auth_routes.router)
app.include_router(user_routes.router)
app.include_router(note_routes.router)
app.include_router(ai_routes.router)

@app.get("/")
def root():
    return {"message": "Welcome to AskMyNotes!"}