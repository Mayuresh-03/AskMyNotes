import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from llama_index.vector_stores.postgres import PGVectorStore

DATABASE_URL = os.getenv("DATABASE_URL")

class VectorStoreManager:
    def __init__(self):
        if not DATABASE_URL:
            raise RuntimeError("DATABASE_URL is not set in environment.")
            
        # Passing table_name="note_embeddings" causes LlamaIndex PGVectorStore
        # to manage the underlying table named "data_note_embeddings".
        self.vector_store = PGVectorStore.from_params(
            connection_string=DATABASE_URL,
            async_connection_string=DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://"),
            table_name="note_embeddings",
            embed_dim=1536,
            hybrid_search=False
        )
        self.engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        self.SessionLocal = sessionmaker(bind=self.engine)

    def reset_vector_store(self):
        with self.engine.connect() as conn:
            conn.execute(text("TRUNCATE TABLE data_note_embeddings CASCADE"))
            conn.commit()