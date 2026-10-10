import json
import httpx
from sqlalchemy import text
import logging

logger = logging.getLogger("askmynotes.rag")

class StudyEngine:
    def __init__(self, rag_engine):
        # We store the passed RAGEngine instance to access its DB and Config
        self.rag = rag_engine 

    async def generate_smart_flashcards(self, subject_id: int):
        """Analyze subject notes and create 10 high-quality flashcards."""
        with self.rag.db.engine.connect() as conn:
            query = text("SELECT text FROM data_note_embeddings WHERE (metadata_->>'subject_id') = :sid ORDER BY RANDOM() LIMIT 15")
            rows = conn.execute(query, {"sid": str(subject_id)}).all()
        
        if not rows:
            return []

        context = "\n".join([r[0] for r in rows if r[0]])
        prompt = f"Based on these notes, generate 10 Flashcards in JSON format: [{{'front': 'question', 'back': 'answer'}}].\nNotes: {context}"
        
        response = await self.rag.config.llm_mini.acomplete(prompt)
        return json.loads(response.text.strip().replace('```json', '').replace('```', ''))

    async def generate_study_questions(self, subject_id):
        """Fetch text chunks and generate exactly 5 MCQs and 3 Short Answers."""
        with self.rag.db.engine.connect() as conn:
            query = text("""
                SELECT text 
                FROM data_note_embeddings 
                WHERE (metadata_->>'subject_id') = :sid 
                ORDER BY RANDOM() LIMIT 12
            """)
            result = conn.execute(query, {"sid": str(subject_id)})
            rows = result.all()

        if not rows:
            return {"error": "No notes found for this subject."}

        context = "\n\n".join([row[0] for row in rows if row[0]])
        
        prompt = f"""
        You are an expert tutor. Based ON THE CONTEXT BELOW, generate a study quiz.
        STRICT REQUIREMENT: You MUST generate EXACTLY 5 MCQs and EXACTLY 3 Short Answer questions.
        
        JSON Schema:
        {{
            "mcqs": [
                {{
                    "question": "str",
                    "options": ["opt1", "opt2", "opt3", "opt4"],
                    "correct_answer": "exact string of the correct option",
                    "explanation": "detailed feedback",
                    "citation": "source document name"
                }}
            ],
            "short_answer": [
                {{
                    "question": "str",
                    "expected_answer": "str",
                    "citation": "source document name"
                }}
            ]
        }}
        
        CONTEXT:
        {context}
        """
        
        response = await self.rag.config.llm_mini.acomplete(prompt)
        cleaned_json = response.text.strip().replace('```json', '').replace('```', '')
        return json.loads(cleaned_json)

    async def contextual_web_search(self, query: str, subject_id: int):
        """Live web search using SerpApi.com."""
        if not self.rag.config.serper_api_key:
            return {"error": "API Key missing.", "links": []}

        try:
            search_prompt = f"Create a short, technical search query for: {query}"
            refined_res = await self.rag.config.llm_mini.acomplete(search_prompt)
            refined_query = str(refined_res.text).strip()

            params = {
                "engine": "google",
                "q": refined_query,
                "api_key": self.rag.config.serper_api_key,
                "num": 5 
            }

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get("https://serpapi.com/search", params=params)
                if response.status_code != 200:
                    logger.error(f"SerpApi Error: {response.status_code} - {response.text}")
                    return {"error": "Search service error.", "links": []}
                data = response.json()

            links = []
            organic = data.get("organic_results", [])
            for result in organic:
                links.append({
                    "title": result.get("title", "Untitled Resource"),
                    "url": result.get("link"),
                    "source": result.get("source", "Web")
                })
                
            return {"links": links}

        except Exception as e:
            logger.error(f"DETAILED Resource fetch failed: {str(e)}", exc_info=True)
            return {"error": str(e), "links": []}

    async def generate_remedial_weakspot_quiz(self, user_id: int, subject_id: int, db):
        """Analyses performance analytics to build a targeted quiz for low-mastery subtopics."""
        query = text("""
            SELECT COALESCE(topic_data->>'subtopic', 'General') as subtopic, AVG(score) as avg_score
            FROM practice_sessions
            WHERE user_id = :uid AND subject_id = :sid
            GROUP BY subtopic
            ORDER BY avg_score ASC LIMIT 2
        """)
        weak_topics = db.execute(query, {"uid": user_id, "sid": subject_id}).all()
        
        target_topics = [t[0] for t in weak_topics if t[0]] if weak_topics else ["General Concepts"]

        context_query = text("""
            SELECT text FROM data_note_embeddings 
            WHERE (metadata_->>'subject_id') = :sid 
            AND (metadata_->>'subtopic') IN :topics
            LIMIT 10
        """)
        rows = db.execute(context_query, {"sid": str(subject_id), "topics": tuple(target_topics)}).all()
        context = "\n".join([r[0] for r in rows if r[0]]) if rows else "General notes context."

        prompt = f"""
        The student is struggling with these specific subtopics: {', '.join(target_topics)}.
        Generate 5 targeted Multiple Choice Questions to strengthen their understanding.
        Return ONLY a JSON array with keys: 'question', 'options' (array of 4 strings), and 'answer'.

        CONTEXT:
        {context}
        """

        res = await self.rag.config.llm_mini.acomplete(prompt)
        raw_text = res.text.strip().replace("```json", "").replace("```", "")
        questions = json.loads(raw_text)

        from models.all_model import WeakSpotQuiz
        quiz_record = WeakSpotQuiz(
            subject_id=subject_id,
            user_id=user_id,
            questions_json=questions
        )
        db.add(quiz_record)
        db.commit()
        db.refresh(quiz_record)
        
        return quiz_record