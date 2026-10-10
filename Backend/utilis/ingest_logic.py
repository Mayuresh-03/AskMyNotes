import os
import json
import re
import logging
import fitz  # PyMuPDF
from sqlalchemy import text
from llama_index.core import Document, StorageContext, VectorStoreIndex
from llama_index.core.node_parser import SentenceSplitter
from google.genai import types

logger = logging.getLogger("askmynotes.rag")

PAGES_PER_BATCH = 5
VISION_MODEL = os.getenv("GOOGLE_VISION_MODEL", "gemini-3.5-flash")

class Ingestor:
    def __init__(self, vector_store, embed_model, genai_client):
        self.vector_store = vector_store
        self.embed_model = embed_model
        self.genai_client = genai_client
        self.splitter = SentenceSplitter(chunk_size=1024, chunk_overlap=100)

    def _clean_json_response(self, raw_text: str) -> str:
        clean_text = re.sub(r'```(?:json)?\s*|\s*```', '', raw_text).strip()
        return clean_text

    async def run_background_ingestion(self, note_id: int, file_path: str, file_name: str, subject_id: int, db_session_factory):
        """Asynchronous background task processing PDF pages in 5-page batches."""
        db = db_session_factory()
        try:
            doc = fitz.open(file_path)
            total_pages = len(doc)
            
            db.execute(text("UPDATE notes SET total_pages = :tp WHERE id = :nid"), {"tp": total_pages, "nid": note_id})
            db.commit()

            storage_context = StorageContext.from_defaults(vector_store=self.vector_store)
            successful_batches = 0
            last_error = None

            for i in range(0, total_pages, PAGES_PER_BATCH):
                batch_doc_list = []
                batch_page_numbers = list(range(i + 1, min(i + PAGES_PER_BATCH + 1, total_pages + 1)))

                prompt = f"""
                Analyze these PDF pages (Pages {batch_page_numbers}).
                1. Transcribe text into clean Markdown (preserve tables exactly).
                2. Identify the SPECIFIC SUBTOPIC (e.g., 'Memory Management', 'Deadlocks'). 
                   DO NOT use 'General' or 'Intro' if a specific header is visible.
                3. Return ONLY a JSON ARRAY of objects:
                   [{{\"page\": int, \"subtopic\": \"string\", \"content\": \"markdown\"}}]
                """
                
                contents = [prompt]

                for page_idx in range(i, min(i + PAGES_PER_BATCH, total_pages)):
                    page = doc.load_page(page_idx)
                    pix = page.get_pixmap(dpi=150)
                    img_bytes = bytes(pix.tobytes("jpeg"))
                    contents.append(
                        types.Part.from_bytes(
                            data=img_bytes, 
                            mime_type="image/jpeg"
                        )
                    )

                try:
                    response = await self.genai_client.aio.models.generate_content(
                        model=VISION_MODEL,
                        contents=contents,
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json"
                        )
                    )
                    
                    cleaned_json = self._clean_json_response(response.text or "[]")
                    batch_data = json.loads(cleaned_json)

                    for page_entry in batch_data:
                        page_doc = Document(
                            text=page_entry.get("content", ""),
                            metadata={
                                "file_name": file_name,
                                "file_path": file_name,
                                "page_number": page_entry.get("page"),
                                "subject_id": str(subject_id),
                                "subtopic": page_entry.get("subtopic", "General Topic")
                            }
                        )
                        batch_doc_list.append(page_doc)

                    if batch_doc_list:
                        batch_nodes = self.splitter.get_nodes_from_documents(batch_doc_list)
                        VectorStoreIndex(
                            nodes=batch_nodes,
                            storage_context=storage_context,
                            embed_model=self.embed_model
                        )

                    db.execute(
                        text("UPDATE notes SET pages_processed = :pp WHERE id = :nid"),
                        {"pp": min(i + PAGES_PER_BATCH, total_pages), "nid": note_id}
                    )
                    db.commit()

                    if batch_doc_list:
                        successful_batches += 1

                    logger.info(f"Note {note_id}: Successfully processed pages {batch_page_numbers}/{total_pages}")

                except Exception as e:
                    last_error = e
                    logger.error(f"Batch processing failed for pages {batch_page_numbers}: {e}")
                    continue

            doc.close()

            if successful_batches == 0:
                logger.error(f"Note {note_id}: ALL batches failed, marking as failed. Last error: {last_error}")
                db.execute(text("UPDATE notes SET status = 'failed' WHERE id = :nid"), {"nid": note_id})
            else:
                db.execute(text("UPDATE notes SET status = 'completed' WHERE id = :nid"), {"nid": note_id})
            db.commit()

        except Exception as e:
            logger.exception(f"Background ingestion failed for note {note_id}: {e}")
            db.execute(text("UPDATE notes SET status = 'failed' WHERE id = :nid"), {"nid": note_id})
            db.commit()
        finally:
            db.close()