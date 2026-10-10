import json
import re
import logging
import io
import os
from sqlalchemy import text
from llama_index.core import VectorStoreIndex, StorageContext, Document

from .ai_config import AIConfig
from .vector_store import VectorStoreManager
from .ingest_logic import Ingestor

logger = logging.getLogger("askmynotes.rag")

class RAGEngine:
    def __init__(self):
        self.config = AIConfig()
        self.db = VectorStoreManager()

        self.ingestor = Ingestor(
            vector_store=self.db.vector_store, 
            embed_model=self.config.embed_model, 
            genai_client=self.config.genai_client 
        )

    async def ingest_pdf(self, note_id: int, file_path: str, file_name: str, subject_id: int, db_session_factory):
        """
        Delegates processing to the background ingestion handler.
        Reads pages in batches from local disk using PyMuPDF and updates status.
        """
        await self.ingestor.run_background_ingestion(
            note_id=note_id,
            file_path=file_path,
            file_name=file_name,
            subject_id=subject_id,
            db_session_factory=db_session_factory
        )
        return {
            "note_id": note_id,
            "file_name": file_name, 
            "subject_id": str(subject_id), 
            "status": "processing"
        }

    async def voice_chat(self, audio_bytes: bytes, audio_filename: str, subject_id: int, history: list = None):
        """Full Voice Pipeline: Gemini STT -> Vector RAG -> Gemini TTS."""
        transcript = await self.config.transcribe(audio_bytes, audio_filename)

        if not transcript:
            raise ValueError("Could not transcribe any speech.")

        chat_result = await self.chat(
            query=transcript,
            subject_id=subject_id,
            history=history
        )

        wav_bytes = await self.config.synthesize_speech(chat_result["answer"], voice="Kore")

        return {
            "transcript": transcript,
            "answer": chat_result["answer"],
            "citations": chat_result["citations"],
            "confidence": chat_result["confidence"],
            "audio_iter": iter([wav_bytes])
        }

    async def chat(self, query: str, subject_id: int, history: list = None):
        """Subject-scoped Chat with Conversational Memory and Top-Match Confidence."""
        
        contextualized_query = query
        if history and len(history) > 1:
            try:
                history_text = "\n".join([
                    f"{m.get('role', 'user').upper()}: {m.get('content', '')}" 
                    for m in history[-5:] if isinstance(m, dict)
                ])
                rewrite_prompt = (
                    f"History:\n{history_text}\n\n"
                    f"Rewrite this follow-up into a single standalone search query. "
                    f"Return ONLY the search text without commentary or quotes: {query}"
                )
                rewrite_res = await self.config.llm_mini.acomplete(rewrite_prompt)
                cleaned_rewrite = rewrite_res.text.strip().strip('"').strip("'")
                if cleaned_rewrite:
                    contextualized_query = cleaned_rewrite
            except Exception as rewrite_err:
                logger.warning(f"Query rewrite skipped due to parsing error: {rewrite_err}")

        # Vector Similarity Search matching metadata_->>'subject_id'
        query_embedding = self.config.embed_model.get_query_embedding(contextualized_query)
        sql_query = text("""
            SELECT text, metadata_, 1 - (embedding <=> :emb) AS similarity
            FROM data_note_embeddings
            WHERE (metadata_->>'subject_id')::text = :sid
            ORDER BY similarity DESC LIMIT 5
        """)

        with self.db.engine.connect() as conn:
            result = conn.execute(sql_query, {"emb": str(query_embedding), "sid": str(subject_id)})
            rows = result.all()

        if not rows or rows[0][2] < 0.25:
            return {"answer": "I couldn't find that in your notes.", "citations": [], "confidence": "Low"}

        top_sim = rows[0][2]
        confidence = "High" if top_sim > 0.60 else ("Medium" if top_sim > 0.40 else "Low")

        context = "\n\n".join([f"Source: {r[1].get('file_name')} (Pg {r[1].get('page_number')}):\n{r[0]}" for r in rows])
        prompt = f"System: Use ONLY the context to answer. Context:\n{context}\n\nUser: {contextualized_query}"
        response = await self.config.llm.acomplete(prompt)
        
        citations = [{
            "file_name": r[1].get("file_name"), 
            "page_number": r[1].get("page_number"), 
            "chunk_text": r[0][:200]
        } for r in rows]

        return {"answer": response.text, "citations": citations, "confidence": confidence}

    async def generate_smart_flashcards(self, subject_id: int):
        """Analyze subject notes and synthesize 10 high-quality flashcards."""
        try:
            with self.db.engine.connect() as conn:
                query = text("""
                    SELECT text 
                    FROM data_note_embeddings 
                    WHERE (metadata_->>'subject_id')::text = :sid 
                    ORDER BY RANDOM() LIMIT 15
                """)
                rows = conn.execute(query, {"sid": str(subject_id)}).all()
            
            if not rows:
                logger.warning(f"No note embeddings found for subject {subject_id}")
                return []

            context = "\n\n".join([r[0] for r in rows if r[0] and r[0].strip()])
            if not context.strip():
                logger.warning(f"Empty context text for subject {subject_id}")
                return []

            prompt = f"""
            You are a flashcard generator. Analyze the context below and create 10 flashcards.
            Output MUST be a valid, raw JSON array of objects with 'front' (question) and 'back' (answer) keys.

            CONTEXT:
            {context}
            """
            
            response = await self.config.llm_mini.acomplete(prompt)
            raw_text = str(response.text).strip() if hasattr(response, "text") and response.text else str(response).strip()

            if not raw_text:
                return []

            json_match = re.search(r'\[\s*\{.*\}\s*\]', raw_text, re.DOTALL)
            cleaned_json = json_match.group(0) if json_match else re.sub(r'```(?:json)?', '', raw_text).replace('```', '').strip()

            flashcards = json.loads(cleaned_json)
            return flashcards if isinstance(flashcards, list) else []

        except Exception as e:
            logger.error(f"Flashcard generation failed: {e}")
            return []

    async def generate_subject_podcast(self, subject_id: int, db_session):
        """Synthesizes a 2-minute study overview podcast and stores the audio file to disk."""
        with self.db.engine.connect() as conn:
            query = text("""
                SELECT text FROM data_note_embeddings 
                WHERE (metadata_->>'subject_id')::text = :sid 
                ORDER BY RANDOM() LIMIT 20
            """)
            rows = conn.execute(query, {"sid": str(subject_id)}).all()

        if not rows:
            return None

        context = "\n".join([r[0] for r in rows if r[0]])
        prompt = f"""
        Synthesize the following course notes into a 2-minute energetic educational podcast summary.
        Summarize core concepts, major definitions, and key exam takeaways clearly.
        
        NOTES:
        {context}
        """
        
        summary_res = await self.config.llm.acomplete(prompt)
        script_text = summary_res.text.strip()

        wav_bytes = await self.config.synthesize_speech(script_text, voice="Charon")

        backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        podcast_dir = os.path.join(backend_root, "uploads", "podcasts")
        os.makedirs(podcast_dir, exist_ok=True)
        file_path = os.path.join(podcast_dir, f"podcast_subject_{subject_id}.wav")

        with open(file_path, "wb") as f:
            f.write(wav_bytes)

        from models.all_model import SubjectAudioPodcast
        db = db_session()
        podcast_record = SubjectAudioPodcast(
            subject_id=subject_id,
            title="Subject Overview Podcast",
            audio_path=file_path,
            transcript=script_text
        )
        db.add(podcast_record)
        db.commit()
        db.refresh(podcast_record)
        db.close()

        return podcast_record