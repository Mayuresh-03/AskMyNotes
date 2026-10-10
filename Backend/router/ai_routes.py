from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database.postgresConn import get_db
from models.all_model import Flashcard, PracticeSession
from schemas.all_schema import ChatRequest, StudyModeResponse, MCQ, ShortAnswer
from sqlalchemy import text
import datetime
import logging

router = APIRouter(prefix="/api/study", tags=["AI Learning"])
logger = logging.getLogger("askmynotes.rag")

@router.post("/chat/{subject_id}")
async def chat(request: Request, subject_id: int, body: ChatRequest):
    """Subject-scoped Chat with Conversational Memory."""
    engine = request.app.state.rag_engine 
    return await engine.chat(
        query=body.query, 
        subject_id=subject_id, 
        history=body.history
    )

@router.post("/generate-flashcards/{subject_id}")
async def generate_flashcards(subject_id: int, request: Request, db: Session = Depends(get_db)):
    """Analyze subject notes and synthesize study flashcards."""
    engine = request.app.state.rag_engine
    
    try:
        new_cards = await engine.generate_smart_flashcards(subject_id)
        if not new_cards:
            return []

        for card in new_cards:
            db.add(Flashcard(
                subject_id=subject_id, 
                front=card.get('front'), 
                back=card.get('back')
            ))
        db.commit()
        return new_cards
    except Exception as e:
        db.rollback()
        logger.error(f"Flashcard generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate flashcards")

@router.post("/study-mode/{subject_id}", response_model=StudyModeResponse)
async def study_mode(subject_id: int, request: Request):
    """Generate quiz questions strictly for the selected subject_id."""
    engine = request.app.state.study_engine
    
    try:
        result = await engine.generate_study_questions(subject_id)
        
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])

        return StudyModeResponse(
            subject_id=str(subject_id),
            mcqs=[MCQ(**m) for m in result.get("mcqs", [])],
            short_answer=[ShortAnswer(**s) for s in result.get("short_answer", [])],
            error=None
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Study-mode generation failed")
        raise HTTPException(status_code=500, detail=str(e))
    
@router.post("/log-practice")
async def log_practice(session_data: dict, db: Session = Depends(get_db)):
    """Save quiz results to update Mastery Analytics."""
    try:
        raw_user_id = session_data.get("user_id")
        raw_subject_id = session_data.get("subject_id")
        raw_score = session_data.get("score")

        if raw_user_id is None or raw_subject_id is None or raw_score is None:
            raise HTTPException(status_code=400, detail="Missing required fields: user_id, subject_id, or score")

        user_id = int(raw_user_id)
        subject_id = int(raw_subject_id)
        score = float(raw_score)
        topic_data = session_data.get("topic_data")

        new_session = PracticeSession(
            user_id=user_id,
            subject_id=subject_id,
            score=score,
            topic_data=topic_data,
            timestamp=datetime.datetime.utcnow()
        )
        
        db.add(new_session)
        db.commit()
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to log practice: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/{user_id}")
async def get_user_analytics(user_id: int, db: Session = Depends(get_db)):
    """Calculates mastery based on practice sessions and subtopics."""
    query = text("""
        SELECT 
            s.id as subject_id,
            s.name as subject_name,
            COALESCE(p.topic_data->>'subtopic', 'Intro/General') as subtopic_name,
            ROUND((AVG(COALESCE(p.score, 0)) * 100)::numeric, 1) as subtopic_mastery,
            COUNT(p.id) as sessions_count
        FROM subjects s
        INNER JOIN notes n ON s.id = n.subject_id 
        LEFT JOIN practice_sessions p ON s.id = p.subject_id
        WHERE s.user_id = :uid
        GROUP BY s.id, s.name, subtopic_name
    """)
    
    try:
        results = db.execute(query, {"uid": user_id}).all()
        analytics_data = {}
        for r in results:
            sid = r[0]
            if sid not in analytics_data:
                analytics_data[sid] = {"subject_id": sid, "name": r[1], "topics": []}
            
            raw_mastery = r[3]
            analytics_data[sid]["topics"].append({
                "name": r[2],
                "mastery": float(raw_mastery) if raw_mastery else 0.0,
                "sessions": r[4]
            })
            
        return list(analytics_data.values())
    except Exception as e:
        logger.error(f"Analytics fetch failed: {e}")
        return []

@router.post("/web-search/{subject_id}")
async def web_search(request: Request, subject_id: int, body: ChatRequest):
    """Perform a contextual web search."""
    engine = request.app.state.study_engine
    user_query = body.query.strip() if body.query else None
    
    if not user_query:
        raise HTTPException(status_code=400, detail="Query string is required")

    try:
        result = await engine.contextual_web_search(
            query=user_query, 
            subject_id=subject_id
        )
        
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
            
        return result
    except Exception as e:
        logger.error(f"Web search route failed: {e}")
        raise HTTPException(status_code=500, detail="Internal search failure")