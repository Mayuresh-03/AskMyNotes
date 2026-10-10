from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Request, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from database.postgresConn import get_db, SessionLocal
from models.all_model import Subject, Note, SubjectShare, User as UserModel
from schemas.all_schema import TokenData
from auth import oauth2
from urllib.parse import quote
from typing import Optional
import os
import shutil
import json
import logging

logger = logging.getLogger("askmynotes.api")

router = APIRouter(tags=["Note Management"])

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BACKEND_ROOT, "uploads")
PODCAST_DIR = os.path.join(BACKEND_ROOT, "podcasts")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PODCAST_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# Subject Management
# ---------------------------------------------------------------------------

@router.post("/api/study/subjects")
async def create_subject(name: str, user_id: int, db: Session = Depends(get_db)):
    """Create a new study category for the user."""
    try:
        new_subject = Subject(name=name, user_id=user_id)
        db.add(new_subject)
        db.commit()
        db.refresh(new_subject)
        return {"id": new_subject.id, "name": new_subject.name}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/study/subjects/{user_id}")
async def get_user_subjects(user_id: int, db: Session = Depends(get_db)):
    """Fetch subjects for user, filtering out failed notes."""
    subjects = db.query(Subject).filter(Subject.user_id == user_id).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "files": [
                {
                    "id": n.id,
                    "name": n.file_name,
                    "status": getattr(n, "status", "completed"),
                    "pages_processed": getattr(n, "pages_processed", 0),
                    "total_pages": getattr(n, "total_pages", 0)
                } for n in s.notes if getattr(n, "status", "completed") != "failed"
            ]
        } for s in subjects
    ]

@router.delete("/api/study/subjects/{subject_id}")
async def delete_subject(subject_id: int, db: Session = Depends(get_db)):
    """Deletes a subject, its associated notes, local disk files, and vector embeddings."""
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    try:
        # Delete local files
        for note in subject.notes:
            if note.file_path and os.path.exists(note.file_path):
                try:
                    os.remove(note.file_path)
                except Exception as file_err:
                    logger.warning(f"Failed to delete disk asset '{note.file_path}': {file_err}")

        # Delete embeddings from vector DB
        db.execute(
            text("DELETE FROM data_note_embeddings WHERE (metadata_->>'subject_id') = :sid OR (metadata_->>'file_name') IN (SELECT file_name FROM notes WHERE subject_id = :subject_id_int)"),
            {"sid": str(subject_id), "subject_id_int": subject_id}
        )

        db.delete(subject)
        db.commit()
        return {"message": f"Successfully deleted subject ID {subject_id}"}
    except Exception as e:
        db.rollback()
        logger.error(f"Subject deletion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------------------------
# File Management & Ingestion
# ---------------------------------------------------------------------------

@router.post("/api/study/upload")
async def upload_file(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    subject_id: int = Form(...),
    db: Session = Depends(get_db)
):
    """Saves PDF to local disk instantly and schedules background ingestion."""
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    ext = file.filename.split(".")[-1].lower() if file.filename else ""
    if ext != "pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    file_path = os.path.join(UPLOAD_DIR, f"{subject_id}_{file.filename}")
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        logger.error(f"Failed to save upload to disk: {e}")
        raise HTTPException(status_code=500, detail="Failed to save uploaded file.")

    new_note = Note(
        file_name=file.filename,
        file_path=file_path,
        subject_id=subject_id,
        status="processing",
        pages_processed=0,
        total_pages=0
    )
    db.add(new_note)
    db.commit()
    db.refresh(new_note)

    engine = request.app.state.rag_engine
    background_tasks.add_task(
        engine.ingestor.run_background_ingestion,
        note_id=new_note.id,
        file_path=file_path,
        file_name=file.filename,
        subject_id=subject_id,
        db_session_factory=SessionLocal
    )

    return {
        "message": f"Upload received. Processing '{file.filename}' in background.",
        "note_id": new_note.id,
        "file_name": file.filename,
        "subject_id": str(subject_id),
        "status": "processing"
    }

@router.get("/api/study/files/status/{note_id}")
async def check_ingestion_status(note_id: int, db: Session = Depends(get_db)):
    """Status endpoint for frontend progress polling."""
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    return {
        "note_id": note.id,
        "status": note.status,
        "pages_processed": note.pages_processed,
        "total_pages": note.total_pages
    }

@router.get("/api/study/files/content/{subject_id}/{file_name}")
async def get_file_content(subject_id: int, file_name: str, db: Session = Depends(get_db)):
    """Retrieve text content for modal display with direct filename matching."""
    note = db.query(Note).filter(
        Note.subject_id == subject_id,
        Note.file_name == file_name
    ).first()

    if note and note.status == "processing":
        return {
            "file_name": file_name,
            "content": f"File is currently being processed ({note.pages_processed}/{note.total_pages or '?'} pages complete). Please refresh in a moment."
        }

    # Matches file_name or file_path regardless of whether subject_id key exists in metadata_ JSON
    query = text("""
        SELECT text 
        FROM data_note_embeddings 
        WHERE metadata_->>'file_name' = :fname 
           OR metadata_->>'file_path' LIKE :fname_like
        ORDER BY (metadata_->>'page_number')::int ASC
    """)
    
    try:
        result = db.execute(query, {
            "fname": file_name,
            "fname_like": f"%{file_name}%"
        }).all()
        
        if not result:
            debug_count = db.execute(
                text("SELECT count(*) FROM data_note_embeddings WHERE metadata_->>'file_name' LIKE :fname_like"),
                {"fname_like": f"%{file_name}%"}
            ).scalar()
            
            return {
                "file_name": file_name, 
                "content": f"No indexed text found for file '{file_name}'."
            }
            
        full_text = "\n\n".join([r[0] for r in result if r[0]])
        return {"file_name": file_name, "content": full_text}
    except Exception as e:
        logger.error(f"Preview Error: {e}")
        raise HTTPException(status_code=500, detail="Database preview failure.")

@router.get("/api/study/files/raw/{subject_id}/{file_name}")
async def get_raw_pdf(subject_id: int, file_name: str, db: Session = Depends(get_db)):
    """Serves the actual raw PDF binary file directly from disk storage."""
    file_path = os.path.join(UPLOAD_DIR, f"{subject_id}_{file_name}")
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Physical PDF file not found on server")
        
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=file_name,
        headers={"Content-Disposition": f"inline; filename={file_name}"}
    )

@router.delete("/api/study/files/{subject_id}/{file_name}")
async def delete_file(subject_id: int, file_name: str, db: Session = Depends(get_db)):
    """Deletes note metadata, local disk copy, and cascading note embeddings."""
    note = db.query(Note).filter(
        Note.subject_id == subject_id, 
        Note.file_name == file_name
    ).first()
    
    if not note: 
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        if note.file_path and os.path.exists(note.file_path):
            try:
                os.remove(note.file_path)
            except Exception as file_err:
                logger.warning(f"Failed to delete disk asset '{note.file_path}': {file_err}")

        # Delete embeddings matching this file name
        db.execute(
            text("DELETE FROM data_note_embeddings WHERE metadata_->>'file_name' = :fname OR metadata_->>'file_path' LIKE :fname_like"),
            {"fname": file_name, "fname_like": f"%{file_name}%"}
        )

        db.delete(note)
        db.commit()
        return {"message": f"Successfully removed {file_name}"}
    except Exception as e:
        db.rollback()
        logger.error(f"File deletion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------------------------
# Audio Podcast Overview & Weak-Spot Diagnostics
# ---------------------------------------------------------------------------

@router.post("/api/study/podcast/{subject_id}")
async def generate_subject_podcast(
    subject_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """Synthesizes a 2-minute Audio Podcast Summary grounded in subject notes."""
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    engine = request.app.state.rag_engine
    try:
        podcast_record = await engine.generate_subject_podcast(
            subject_id=subject_id, 
            db_session=SessionLocal
        )
        
        if not podcast_record:
            raise HTTPException(status_code=404, detail="No notes found to generate podcast summary.")

        if os.path.exists(podcast_record.audio_path):
            return FileResponse(
                path=podcast_record.audio_path, 
                media_type="audio/wav", 
                filename=f"{subject.name}_summary.wav"
            )

        raise HTTPException(status_code=500, detail="Audio podcast file missing from storage.")

    except Exception as e:
        logger.exception(f"Podcast generation failed for subject {subject_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/study/weakspot-quiz/{subject_id}")
async def generate_weakspot_quiz(
    subject_id: int,
    body: dict,
    request: Request,
    db: Session = Depends(get_db)
):
    """Generates an adaptive remediation quiz focused on low-mastery (<60%) subtopics."""
    user_id = body.get("user_id")
    engine = request.app.state.study_engine
    
    try:
        adaptive_questions = await engine.generate_remedial_questions(subject_id=subject_id, user_id=user_id)
        return {"subject_id": str(subject_id), "questions_json": adaptive_questions}
    except Exception as e:
        logger.exception(f"Weak-spot quiz generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------------------------
# Voice Interaction & YouTube Ingestion
# ---------------------------------------------------------------------------

@router.post("/api/study/voice-chat/{subject_id}")
async def voice_chat_endpoint(
    subject_id: int,
    request: Request,
    file: UploadFile = File(...),
    history: Optional[str] = Form("[]")
):
    """Full Voice Pipeline: Transcribes audio, performs RAG query, and streams WAV response."""
    engine = request.app.state.rag_engine
    try:
        audio_bytes = await file.read()
        
        parsed_history = []
        if history and history.strip():
            try:
                parsed_history = json.loads(history)
            except Exception:
                parsed_history = []

        result = await engine.voice_chat(
            audio_bytes=audio_bytes,
            audio_filename=file.filename or "recording.wav",
            subject_id=subject_id,
            history=parsed_history
        )

        safe_transcript = quote(result.get("transcript", ""))
        safe_answer = quote(result.get("answer", ""))
        safe_citations = quote(json.dumps(result.get("citations", [])))

        return StreamingResponse(
            result["audio_iter"],
            media_type="audio/wav",
            headers={
                "X-Transcript": safe_transcript,
                "X-Answer": safe_answer,
                "X-Confidence": result.get("confidence", "Medium"),
                "X-Citations": safe_citations,
            }
        )
    except Exception as e:
        logger.exception(f"Voice Chat execution failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/study/ingest-youtube")
async def ingest_youtube_video(
    request: Request,
    subject_id: int = Form(...),
    youtube_url: str = Form(...),
    db: Session = Depends(get_db)
):
    """Ingests YouTube video transcripts directly into the RAG vector store."""
    try:
        from llama_index.readers.youtube_transcript import YoutubeTranscriptReader
        reader = YoutubeTranscriptReader()
        documents = reader.load_data(ytlinks=[youtube_url])
        
        if not documents:
            raise HTTPException(status_code=400, detail="Could not extract video transcript.")

        doc_text = documents[0].text
        video_id = documents[0].extra_info.get("video_id", "YouTube_Video")
        file_name = f"YouTube_Lecture_{video_id}.txt"

        file_path = os.path.join(UPLOAD_DIR, f"{subject_id}_{file_name}")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(doc_text)

        new_note = Note(
            file_name=file_name,
            file_path=file_path,
            subject_id=subject_id,
            status="completed",
            pages_processed=1,
            total_pages=1
        )
        db.add(new_note)
        db.commit()

        engine = request.app.state.rag_engine
        from llama_index.core import Document, VectorStoreIndex, StorageContext

        doc = Document(
            text=doc_text,
            metadata={
                "file_name": file_name,
                "file_path": file_name,
                "subject_id": str(subject_id),
                "subtopic": "YouTube Video Lecture",
                "page_number": 1
            }
        )
        nodes = engine.ingestor.splitter.get_nodes_from_documents([doc])
        
        storage_context = StorageContext.from_defaults(vector_store=engine.db.vector_store)
        VectorStoreIndex(nodes=nodes, storage_context=storage_context, embed_model=engine.config.embed_model)

        return {"message": f"Successfully indexed YouTube video '{file_name}' into subject notes!"}

    except Exception as e:
        db.rollback()
        logger.error(f"YouTube ingestion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/study/share-subject")
async def share_subject_workspace(
    subject_id: int = Form(...),
    target_email: str = Form(...),
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(oauth2.get_current_user)
):
    """Grants another user access to a subject workspace."""
    target_user = db.query(UserModel).filter(UserModel.email == target_email).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User with this email not found.")

    existing_share = db.query(SubjectShare).filter(
        SubjectShare.subject_id == subject_id,
        SubjectShare.shared_with_user_id == target_user.id
    ).first()

    if existing_share:
        return {"message": "Subject is already shared with this user."}

    share = SubjectShare(
        subject_id=subject_id,
        shared_with_user_id=target_user.id,
        role="viewer"
    )
    db.add(share)
    db.commit()

    return {"message": f"Successfully shared subject workspace with {target_email}"}