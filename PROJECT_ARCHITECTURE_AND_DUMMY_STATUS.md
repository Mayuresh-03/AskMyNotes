# AskMyNotes — Architecture, Data Flow, Features, and What Is Still Dummy

## 1. Project Overview

AskMyNotes is an AI-powered study assistant built for students to:

- organize notes by subject
- upload PDFs/text notes
- ask AI questions grounded in their own notes
- generate flashcards from class content
- take AI-based quizzes
- track subject practice and learning progress

The project is structured as a full-stack application:

- Frontend: React + Vite
- Backend: FastAPI
- Database: PostgreSQL with pgvector
- AI layer: OpenAI + Gemini + vector search

The project’s main goal is to make learning more grounded, searchable, and personalized instead of relying on generic internet answers.

---

## 2. High-Level Architecture

### Frontend Layer

The frontend is in the `Frontend/` folder. It uses:

- React Router for page navigation
- Zustand for auth state (`authStore.js`)
- protected route logic in `App.jsx`
- pages for login, signup, dashboard, subject hub, notes library, flashcards, study mode, and profile

Key files:

- `Frontend/src/App.jsx` — router + auth guarded routes
- `Frontend/src/authStore.js` — login/logout and token handling
- `Frontend/src/pages/...` — app pages and UI flows

### Backend Layer

The backend is in the `Backend/` folder. It uses:

- FastAPI app initialization in `Backend/main.py`
- router modules under `Backend/router/`
- SQLAlchemy models under `Backend/models/`
- AI orchestration under `Backend/utilis/`

The app starts with a lifespan function that:

- creates `RAGEngine`
- creates `StudyEngine`
- creates all SQL tables via `Base.metadata.create_all(...)`

### Data and AI Layer

The AI/data layer performs two main jobs:

1. ingest and vectorize notes
2. answer questions and generate study content from subject-scoped context

This is handled by:

- `Backend/utilis/ai_config.py` — model and API configuration
- `Backend/utilis/rag_engine.py` — grounded chat and note ingestion
- `Backend/utilis/study_engine.py` — study generation, quiz generation, and search
- `Backend/utilis/vector_store.py` — vector database integration
- `Backend/utilis/ingest_logic.py` — ingestion and chunking logic

### Database Layer

The project uses PostgreSQL, with SQLAlchemy models for:

- `User`
- `Subject`
- `Note`
- `NoteEmbedding`
- `Flashcard`
- `PracticeSession`

The `NoteEmbedding` table stores text chunks plus vector embeddings, which are used for semantic retrieval.

---

## 3. Core Runtime Flow

### A. Authentication Flow

The user enters login/signup details in the frontend.

Flow:

1. Frontend calls auth endpoints from FastAPI.
2. Backend validates user credentials.
3. JWT token is created and returned.
4. Frontend stores the token and user data in localStorage.
5. On next reload, Zustand checks the saved JWT and restores authentication state.

Relevant files:

- `Frontend/src/authStore.js`
- `Backend/auth/token.py`
- `Backend/auth/oauth2.py`
- `Backend/router/auth_routes.py`

### B. Subject Creation Flow

The student creates a subject (like Math, OS, DBMS, etc.).

Flow:

1. Frontend sends subject name to `/api/study/subjects`
2. Backend creates a `Subject` record tied to the user
3. Subject appears in the dashboard and library

### C. Upload and Ingestion Flow

This is the most important data pipeline in the project.

Flow:

1. User uploads a PDF or TXT file in the library
2. Frontend sends the file to `/api/study/upload`
3. Backend checks the file extension and subject ID
4. `RAGEngine.ingest_pdf(...)` or `RAGEngine.ingest_txt(...)` is called
5. The ingestion logic extracts text from the document
6. The text is chunked into smaller sections
7. Each chunk is embedded using OpenAI embeddings
8. Chunks are saved in the vector database with metadata such as:
   - subject_id
   - file_name
   - page_number
   - text content
9. A `Note` record is created in SQL to track the uploaded file

This allows the system to later search the student’s own course materials, not just general internet content.

### D. Grounded Q&A Flow

This is the main “chat with my notes” workflow.

Flow:

1. User asks a question in the subject hub
2. The backend calls `RAGEngine.chat()`
3. The question is optionally rewritten using conversation history for follow-up questions
4. The query is embedded
5. The backend searches vectors filtered by the selected `subject_id`
6. Top matching chunks are retrieved
7. The system decides confidence based on similarity score
8. LLM answers using the retrieved chunks only
9. Citations are returned with file name and page number

The answer is intended to be grounded in the uploaded notes, not a hallucinated general answer.

### E. Flashcard Generation Flow

Flow:

1. Subject notes are read from vectorized chunks
2. StudyEngine fetches random relevant context
3. LLM generates structured flashcards in JSON format
4. Flashcards are saved into `Flashcards` table
5. Frontend displays flip cards with navigation controls

### F. Quiz Generation Flow

Flow:

1. Subject notes are sampled from the vector store
2. A prompt asks the LLM to create exactly 5 MCQs and 3 short-answer questions
3. The response is parsed as JSON
4. The frontend renders the quiz
5. Results are logged into `PracticeSession`

### G. Practice Analytics Flow

Flow:

1. User finishes quiz or flashcard activity
2. Backend saves practice result in `PracticeSession`
3. The dashboard calculates readiness or progress based on sessions and docs
4. The frontend shows subject readiness and recent insight cards

---

## 4. Project Features Present

### Implemented / Strongly Present

#### Authentication

- signup
- login
- JWT authentication
- protected frontend routes
- Google OAuth support
- forgot-password flow
- OTP verification flow
- password reset flow

#### Subject Management

- create subject
- list subjects by user
- associate file uploads with subject
- subject-scoped study space

#### Upload and Library

- PDF upload support
- TXT upload route support
- file listing
- file preview by subject
- file deletion

#### AI Chat / RAG

- subject-scoped question answering
- retrieval from notes only
- citations
- confidence scoring
- history-aware follow-up queries

#### Flashcards

- AI-generated cards
- flip interaction
- navigation controls
- mastering / needs review actions

#### Study Mode

- MCQ generation
- short answer generation
- subject-based quiz workflow
- explanation and citation support

#### Analytics / Dashboard

- active subjects count
- total files count
- subject readiness bar
- recent insights UI
- practice logging backend table

#### Profile Page

- UI for name, email, preferences, and mastery heatmap
- voice preference toggle
- teacher persona selection

---

## 5. What the Project Is Doing Under the Hood

The software has a real AI study assistant design:

- it treats each subject as an isolated knowledge base
- it stores chunks as embeddings for semantic matching
- it uses citations to ground answers in upload content
- it separates SQL metadata from vector retrieval
- it aims to move from passive reading to active recall and evaluation

This is a strong academic prototype with the right learning-product architecture.

---

## 6. Actual Data Model

The main SQL tables are:

### `users`

- id
- full_name
- email
- hashed_password
- created_at

### `subjects`

- id
- name
- user_id

### `notes`

- id
- file_name
- subject_id
- created_at

### `note_embeddings`

- id
- note_id
- content
- embedding (pgvector)

### `flashcards`

- id
- subject_id
- front
- back
- difficulty
- last_reviewed
- next_review
- created_at

### `practice_sessions`

- id
- user_id
- subject_id
- score
- topic_data
- timestamp

This gives the app a practical foundation for both content retrieval and learning analytics.

---

## 7. What Is Dummy / Mock / Not Fully Implemented

This is the important part.

### 1. Dashboard values are partly fake

In `Frontend/src/pages/DashboardPage.jsx`:

- practice score is hardcoded as `84%`
- readiness is derived just from file count: `Math.min(fileCount * 20, 100)`
- “Recent Insights” text is static and generic

This means the dashboard is visually polished but not yet backed by a real mastery engine.

### 2. Profile heatmap is mock

In `Frontend/src/pages/ProfilePage.jsx` the comment says:

> “Mocking 28 days of study activity intensity”

The UI generates 28 blocks to look like a calendar heatmap, but it is not connected to real practice history.

### 3. Subject limit is a demo constraint

The README explicitly says the app currently limits subjects to three as a product/demo constraint.

This is a product choice for UI demo purposes, not necessarily a full backend business rule.

### 4. Voice feature is not fully connected

There is a voice interaction UI and `RAGEngine.voice_chat()` in backend, but the feature is incomplete:

- no real voice route in the current router
- `AIConfig` does not appear to initialize the `openai_client` used by the voice chat

This means voice is mostly a planned feature or a prototype scaffold.

### 5. Some AI routes are mismatched or incomplete

The README notes a mismatch:

- the floating chatbot calls `/api/chat/query`, but no such route appears in current backend routes
- some route naming and frontend calls are not fully aligned

### 6. TXT ingestion is not fully implemented

The README specifically calls out:

- TXT upload is routed, but `RAGEngine.ingest_txt` needs implementation

So the backend path exists but the actual working logic may not be complete yet.

### 7. Profile preferences are mostly frontend-only

The profile page has preferences for:

- language
- voice interaction
- teacher persona

But the README says these are mostly front-end-only and not fully persisted into the backend.

### 8. Spaced repetition is not real yet

`Flashcard` records include fields like:

- difficulty
- last_reviewed
- next_review

But the README says a complete spaced repetition algorithm is not implemented yet.

### 9. File deletion is not fully safe

The backend removes the SQL record but the README warns that vector cleanup should be stronger in production.

### 10. Security and ownership checks are not fully enforced

The README clearly states that some routes should verify ownership and restrict admin-only access before production use.

---

## 8. What Is Real vs What Is Prototype

### Real / Functional Core

- user auth system
- subject creation
- file upload and metadata storage
- vector-backed note search
- grounded AI answer generation
- flashcard generation
- quiz generation
- practice logging tables

### Prototype / Demo Layer

- dashboard percentage values
- heatmap chart placeholder
- text-only or approximate analytics
- voice flow scaffold
- some UI-only preference toggles
- subject/card visual limits
- incomplete production security checks

---

## 9. Important Architectural Observations

### Strengths

- strong separation between frontend, backend, and AI layers
- subject-scoped retrieval is a good design decision
- citations and grounded answers make it more educational and trustworthy
- PostgreSQL + pgvector is appropriate for document search
- modular AI flow makes future upgrades easier

### Weaknesses / Risks

- some endpoints are not fully aligned with the frontend
- voice and chatbot flows appear partially built
- some values are fake placeholders for demo purposes
- production security and ownership enforcement are incomplete
- vector cleanup and file validation are not yet strong enough

---

## 10. Recommended Summary

This project is a solid AI study-assistant prototype with a real architecture and strong educational intent. It already contains the core systems for:

- subject-based note management
- PDF document ingestion
- AI-based grounded chat
- flashcards
- quizzes
- practice logging

But several parts are currently demo-oriented or placeholder-driven, especially around analytics UI, profile heatmaps, voice features, and some backend route completeness. The system is best described as a working academic prototype with a clear path to a production-ready intelligent tutoring platform.

---

## 11. Final Assessment

If you want a single sentence:

> AskMyNotes is a feature-rich AI study workspace prototype where the actual document ingestion, note-grounded chat, flashcard generation, and quiz generation are real and meaningful, but parts of the analytics, voice features, profile personalization, and demo UI still behave like placeholders rather than final production logic.
