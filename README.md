# AskMyNotes

AskMyNotes is an AI-powered personal study workspace that transforms a student's notes into an interactive learning environment. Users can organize documents by subject, upload academic material, ask questions grounded in their own notes, inspect source evidence, generate flashcards, take AI-created quizzes, and track practice performance.

The central product idea is simple:

> Chat with your notes, not the internet.

AskMyNotes combines document management, computer-vision-based PDF ingestion, semantic search, Retrieval-Augmented Generation (RAG), active recall, quiz generation, and learning analytics in one application.

## Table of Contents

- [Project Goals](#project-goals)
- [Key Features](#key-features)
- [How the System Works](#how-the-system-works)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Application Flow](#application-flow)
- [Backend API](#backend-api)
- [Database Design](#database-design)
- [AI Pipeline](#ai-pipeline)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [Docker Setup](#docker-setup)
- [Current Limitations](#current-limitations)
- [Future Roadmap](#future-roadmap)
- [Security and Production Checklist](#security-and-production-checklist)
- [Project Value](#project-value)

## Project Goals

AskMyNotes is designed to solve common study problems:

- Notes are scattered across PDFs, text files, and folders.
- General-purpose AI can answer outside the student's syllabus.
- Students often revise without knowing which topics are weak.
- Creating flashcards and practice tests manually takes time.
- Scanned PDFs are difficult to process with ordinary text extraction.
- Notes, practice results, and revision progress are usually disconnected.

The application addresses these problems by turning personal study material into a searchable, explainable, and practice-oriented knowledge base.

## Key Features

### 1. Authentication and Account Management

- Email and password registration.
- Password hashing before database storage.
- JWT-based login sessions.
- Protected frontend routes.
- Google OAuth integration.
- Forgot-password flow using a time-limited email OTP.
- User profile management.
- Local session restoration through the frontend authentication store.

Relevant implementation:

- `Backend/router/auth_routes.py`
- `Backend/router/user_routes.py`
- `Backend/auth/hashing.py`
- `Backend/auth/oauth2.py`
- `Backend/auth/token.py`
- `Frontend/src/authStore.js`

### 2. Subject-Based Study Workspace

Users can create subject scopes such as:

- Operating Systems
- Database Management Systems
- Computer Networks
- Machine Learning
- Mathematics
- Software Engineering

Each subject can contain uploaded notes and generated learning resources. The frontend currently limits a user to three subject scopes as a product/demo constraint.

Subject functionality includes:

- Create a subject.
- List a user's subjects.
- View source documents inside a subject.
- Open a subject-specific AI hub.
- Start subject-specific quizzes.
- Generate subject-specific flashcards.

### 3. PDF and Text Note Upload

The upload flow accepts PDF files and is intended to support TXT files.

For PDFs, AskMyNotes:

1. Reads the uploaded bytes.
2. Converts PDF pages into images.
3. Sends page images to Gemini Vision.
4. Extracts clean Markdown text.
5. Preserves tables where possible.
6. Identifies specific subtopics.
7. Adds file, page, subject, and topic metadata.
8. Splits extracted content into overlapping chunks.
9. Generates vector embeddings.
10. Stores the chunks in PostgreSQL with pgvector.

This allows the system to process scanned or image-based academic PDFs, not only ordinary text PDFs.

### 4. Document Preview and Deletion

Users can preview extracted content from an uploaded file. The preview is assembled from indexed chunks and ordered by page number.

Users can also delete files from a subject library. The relational note record is removed, although vector cleanup should be strengthened before production deployment.

### 5. Subject-Scoped AI Chat

The Subject Hub provides an AI study copilot for questions such as:

- Explain this topic in simple terms.
- Compare two concepts from my notes.
- Summarize this chapter.
- What are the advantages and disadvantages of this method?
- Which algorithm is more efficient according to the notes?

The chat system:

- Searches only the selected subject.
- Uses vector similarity to find relevant chunks.
- Retrieves the top matching passages.
- Uses recent conversation history for follow-up questions.
- Rewrites follow-up questions into standalone search queries.
- Generates an answer from the retrieved context.
- Returns citations and a confidence label.
- Refuses to invent an answer when relevant notes cannot be found.

### 6. Grounding, Citations, and Evidence

Each grounded answer can include:

- Source file name.
- Source page number.
- A short matching text snippet.
- High, Medium, or Low confidence.

The frontend displays this information in an evidence drawer so students can verify the AI response against their own material.

This makes the system more transparent than a chatbot that returns unsupported answers.

### 7. External Educational Search

When the student's notes are not enough, the Subject Hub can request external educational links.

The search flow:

1. Takes the latest user question.
2. Refines it into a short technical query.
3. Sends it to an external search service.
4. Extracts result titles, URLs, and sources.
5. Displays the links inside the conversation.

Internal note evidence and external links are presented as separate sources.

### 8. AI-Generated Flashcards

AskMyNotes can generate a deck of flashcards from the selected subject's notes.

Each card contains:

- A question or prompt on the front.
- An answer on the back.
- Database timestamps.
- Difficulty and review metadata for future spaced repetition.

The flashcard interface supports:

- Click-to-flip interaction.
- Spacebar to flip.
- Left and right arrow navigation.
- Previous and next controls.
- Progress tracking.
- Needs Review action.
- Mastered action.

### 9. AI Study Mode

Study Mode generates a structured quiz strictly from the selected subject's notes.

The current generation contract requests:

- Exactly 5 multiple-choice questions.
- Exactly 3 short-answer questions.

Multiple-choice questions provide:

- Four answer options.
- Correct answer.
- Explanation.
- Source citation.
- Immediate correctness feedback.

Short-answer questions provide:

- A response area for the student.
- A model answer that can be revealed.
- A source citation when available.

### 10. Practice Logging and Mastery Analytics

Practice sessions can record:

- User ID.
- Subject ID.
- Score.
- Topic or activity metadata.
- Timestamp.

Practice records are created from quiz completion, quiz exit synchronization, and flashcard mastery actions.

The analytics layer is intended to calculate:

- Subject mastery.
- Topic mastery.
- Practice-session count.
- Average scores.
- Revision activity.

### 11. Dashboard and Library

The dashboard provides an overview of:

- Active subjects.
- Uploaded source documents.
- Subject readiness.
- Recent insights.
- Navigation to the library and subject hubs.

The library provides:

- Subject creation.
- File upload.
- File preview.
- File deletion.
- Subject-level analytics.
- Navigation to AI chat, Study Mode, and Smart Recall.

### 12. Profile and Preferences

The profile experience includes UI for:

- Full name.
- Email address.
- Language preference.
- Voice interaction preference.
- Teacher persona.
- Topic mastery heatmap.

Some of these preferences are currently frontend-only and should be persisted through a backend profile settings API.

## How the System Works

A typical study session follows this sequence:

1. A student creates an account or signs in.
2. The student creates a subject.
3. The student uploads one or more study documents.
4. The backend processes the documents with Gemini Vision and LlamaIndex.
5. Text is split into chunks and embedded with OpenAI embeddings.
6. Chunks are stored in PostgreSQL with pgvector.
7. The student opens the subject hub.
8. The student asks a question.
9. The backend searches only that subject's vectors.
10. The language model answers using the retrieved context.
11. The UI shows citations and confidence.
12. The student generates flashcards or a quiz.
13. Practice results are stored.
14. The dashboard and library use those results for progress tracking.

## Architecture

```mermaid
flowchart LR
    Student[Student] --> Frontend[React + Vite Frontend]
    Frontend --> Auth[JWT and Google OAuth]
    Frontend --> API[FastAPI Backend]

    API --> SQL[(PostgreSQL)]
    API --> Vector[(pgvector)]

    API --> Ingest[Document Ingestion]
    Ingest --> Vision[Gemini Vision]
    Ingest --> Embed[OpenAI Embeddings]
    Embed --> Vector

    API --> RAG[RAG Engine]
    RAG --> Vector
    RAG --> LLM[OpenAI LLM]

    API --> Study[Study Engine]
    Study --> Vector
    Study --> LLM

    API --> Search[External Web Search]
```

## Technology Stack

### Frontend

- React 19
- Vite
- React Router
- Zustand
- Tailwind CSS
- Lucide React icons
- React Markdown
- Remark GFM

### Backend

- Python 3.12
- FastAPI
- Uvicorn
- SQLAlchemy
- PostgreSQL
- pgvector
- Alembic
- Pydantic
- JWT and Authlib
- HTTPX
- SendGrid

### AI and Data Processing

- LlamaIndex
- OpenAI GPT-4o
- OpenAI GPT-4o-mini
- OpenAI `text-embedding-3-small`
- Gemini 2.5 Flash
- Gemini Vision
- pdf2image
- Poppler

## Repository Structure

```text
Version_1/
├── Backend/
│   ├── main.py                  # FastAPI application entry point
│   ├── requirements.txt         # Python dependencies
│   ├── Dockerfile
│   ├── auth/                    # Password hashing and JWT utilities
│   ├── database/                # SQLAlchemy engine and sessions
│   ├── models/                  # Database models
│   ├── router/                  # Authentication, user, note, and AI routes
│   ├── schemas/                 # Pydantic request and response schemas
│   ├── utilis/                  # AI config, RAG, ingestion, vector store, study logic
│   └── alembic/                 # Database migration configuration
├── Frontend/
│   ├── package.json
│   ├── Dockerfile
│   ├── src/
│   │   ├── App.jsx              # Routes and protected-route wrapper
│   │   ├── authStore.js         # Zustand authentication state
│   │   ├── api/                 # API configuration
│   │   ├── components/          # Layout, sidebar, chatbot, library components
│   │   └── pages/               # Dashboard, library, chat, quiz, flashcards, auth
│   └── public/
├── docker-compose.yml
└── README.md
```

## Backend API

### Authentication

```text
POST /api/auth/login
GET  /api/auth/login/google
GET  /api/auth/google/callback
POST /api/auth/forgot-password
POST /api/auth/verify-otp
POST /api/auth/reset-password
```

### Users

```text
POST /api/users/
GET  /api/users/me
GET  /api/users/{user_id}
GET  /api/users/
PUT  /api/users/me
```

### Subjects and Files

```text
POST   /api/study/subjects
GET    /api/study/subjects/{user_id}
POST   /api/study/upload
GET    /api/study/files/content/{subject_id}/{file_name}
DELETE /api/study/files/{subject_id}/{file_name}
```

### AI Learning

```text
POST /api/study/chat/{subject_id}
POST /api/study/generate-flashcards/{subject_id}
POST /api/study/study-mode/{subject_id}
POST /api/study/log-practice
GET  /api/study/analytics/{user_id}
POST /api/study/web-search/{subject_id}
```

## Database Design

The main SQLAlchemy models are defined in `Backend/models/all_model.py`.

### User

Stores account information:

- ID
- Full name
- Email
- Hashed password
- Creation timestamp

### Subject

Stores a user's study categories:

- ID
- Name
- Owner user ID

### Note

Stores uploaded file metadata:

- ID
- File name
- Subject ID
- Creation timestamp

### NoteEmbedding

Stores searchable document chunks:

- ID
- Note ID
- Chunk content
- Vector embedding

The LlamaIndex vector store also maintains document metadata required for subject filtering and citations.

### Flashcard

Stores generated revision cards:

- ID
- Subject ID
- Front text
- Back text
- Difficulty
- Last reviewed time
- Next review time
- Creation timestamp

### PracticeSession

Stores learning activity:

- ID
- User ID
- Subject ID
- Score
- Topic/activity JSON data
- Timestamp

## AI Pipeline

### Ingestion Pipeline

```text
PDF bytes
  -> PDF pages
  -> Page images
  -> Gemini Vision transcription
  -> Markdown documents
  -> Subtopic metadata
  -> SentenceSplitter chunks
  -> OpenAI embeddings
  -> PostgreSQL pgvector
```

### Question Answering Pipeline

```text
User question
  -> Optional conversation rewriting
  -> Query embedding
  -> Subject-filtered vector search
  -> Top matching chunks
  -> Grounded LLM prompt
  -> Answer, citations, and confidence
```

### Flashcard and Quiz Pipeline

```text
Subject chunks
  -> Random context selection
  -> Structured LLM prompt
  -> JSON validation/parsing
  -> Database persistence
  -> Interactive frontend activity
  -> Practice logging
```

## Local Development

### Prerequisites

Install the following first:

- Python 3.12 or later
- Node.js 20 or later
- PostgreSQL with the pgvector extension, or a compatible hosted PostgreSQL service
- Poppler utilities for PDF-to-image conversion
- OpenAI API access
- Gemini API access
- Optional Google OAuth, SendGrid, and search-service credentials

### Start the Backend

```powershell
cd Backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend is available at:

```text
http://localhost:8000
```

FastAPI documentation is available at:

```text
http://localhost:8000/docs
```

### Start the Frontend

Open another terminal:

```powershell
cd Frontend
npm install
npm run dev
```

The frontend is available at:

```text
http://localhost:5173
```

The frontend API base URL is configured in:

```text
Frontend/src/api/apiConfig.js
```

### Frontend Commands

```powershell
npm run dev       # Start the Vite development server
npm run build     # Create a production build
npm run lint      # Run ESLint
npm run preview   # Preview the production build
```

## Environment Variables

Do not commit real credentials. Create local `.env` files and use placeholder values in documentation.

### Backend Variables

```env
DATABASE_URL=postgresql://user:password@host:5432/database
SECRET_KEY=replace-with-a-long-random-secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
SESSION_SECRET=replace-with-a-long-random-session-secret
OPENAI_API_KEY=replace-with-openai-key
GEMINI_API_KEY=replace-with-gemini-key
SERPER_API_KEY=replace-with-search-key
GOOGLE_CLIENT_ID=replace-with-google-client-id
GOOGLE_CLIENT_SECRET=replace-with-google-client-secret
SENDGRID_API_KEY=replace-with-sendgrid-key
SENDER_EMAIL=verified-sender@example.com
```

### Frontend Variables

The current frontend uses `http://localhost:8000` directly in `src/api/apiConfig.js`. For deployment, move this value to a Vite environment variable such as:

```env
VITE_API_BASE_URL=http://localhost:8000
```

## Docker Setup

The repository includes Dockerfiles for both services and a Docker Compose file.

Before using Compose, verify the directory names in `docker-compose.yml`. The repository folders are named `Backend` and `Frontend`, while the current Compose file refers to lowercase `backend` and `frontend`. This may work on a case-insensitive Windows filesystem but can fail on Linux or case-sensitive CI systems.

After correcting the paths for the target environment:

```powershell
docker compose up --build
```

Services are intended to run on:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:8000
```

## Current Limitations

The current repository contains a strong prototype foundation, but some features need additional implementation before production release.

### Incomplete or Mismatched Features

- TXT upload is routed by the backend, but `RAGEngine.ingest_txt` needs to be implemented.
- The frontend exposes a voice-chat flow, but the corresponding backend route is not present in the current AI router.
- The voice engine refers to an OpenAI client that is not currently initialized in `AIConfig`.
- The floating global chatbot calls `/api/chat/query`, but that endpoint is not present in the shown backend routes.
- Profile preferences are mostly frontend state and are not fully persisted.
- Some dashboard scores, timestamps, and heatmap values are mock or approximate values.
- Flashcard scheduling fields exist, but a complete spaced-repetition algorithm is not implemented.

### Security and Data Integrity Risks

- Subject and file routes should consistently verify ownership using the authenticated user.
- User listing routes should be restricted to administrators.
- File deletion should explicitly remove associated vector chunks.
- File size, MIME type, page count, and query length limits should be enforced.
- Production deployments must not use fallback JWT or session secrets.
- API keys must not be committed to the repository.
- External AI services may receive uploaded study content, so users should be informed through a privacy policy.

## Future Roadmap

### Phase 1: Reliability and Security

- Complete TXT ingestion.
- Implement and test voice-chat endpoints.
- Implement or remove the global chatbot.
- Add subject ownership checks to every route.
- Add role-based administration.
- Add explicit vector cleanup on document deletion.
- Add upload limits and file validation.
- Replace fallback secrets with mandatory environment validation.
- Add backend and frontend automated tests.

### Phase 2: Better Learning Experience

- Implement spaced repetition using SM-2 or FSRS.
- Add adaptive quizzes based on weak topics.
- Improve short-answer evaluation with partial credit.
- Add timed exam mode.
- Add personalized study plans based on exam dates and available time.
- Add daily revision reminders.
- Add bookmarks, annotations, and highlights.
- Allow students to regenerate cards by difficulty or topic.

### Phase 3: Advanced AI

- Complete real-time voice tutoring.
- Add speech-to-text and text-to-speech streaming.
- Support images, PowerPoint files, Word documents, audio, and video transcripts.
- Understand diagrams, charts, handwritten notes, and mathematical figures.
- Add citation highlighting and source-page navigation.
- Add answer verification to classify responses as supported, partially supported, or unsupported.
- Build topic graphs showing relationships between concepts.
- Support configurable tutor personas and explanation levels.

### Phase 4: Collaboration and Education

- Add shared study groups.
- Add collaborative subjects and annotations.
- Add teacher dashboards.
- Allow teachers to create classes and assignments.
- Add group quizzes and class analytics.
- Add institutional login and organization management.

### Phase 5: Accessibility and Mobile

- Add mobile applications using React Native or Flutter.
- Add camera-based note scanning.
- Add offline flashcards.
- Add push notifications.
- Add multilingual answers.
- Add screen-reader support, keyboard navigation, captions, and high-contrast themes.

## Security and Production Checklist

Before deployment:

- Rotate any credentials that have been exposed during development.
- Remove `.env` files from Git tracking.
- Add `.env` to `.gitignore`.
- Use a secret manager in production.
- Configure HTTPS.
- Restrict CORS to trusted frontend origins.
- Add rate limiting to authentication and AI endpoints.
- Verify authenticated ownership of every subject and document.
- Validate all uploaded files.
- Add database migrations and backups.
- Add structured logging without logging secrets or personal document contents.
- Add monitoring for failed ingestion and AI provider errors.
- Define retention and deletion policies for uploaded documents.
- Inform users how their notes are processed by external AI providers.

## Project Value

AskMyNotes is differentiated by the connection between four activities that are normally separated:

1. Organizing personal academic documents.
2. Asking grounded questions about those documents.
3. Turning documents into active-recall material.
4. Measuring learning progress over time.

Its strongest differentiators are:

- Subject-scoped AI retrieval.
- Source citations and evidence inspection.
- Vision-based processing for scanned PDFs.
- Automatic flashcards and quizzes.
- A foundation for voice-based tutoring.
- A path from passive reading to measurable practice.

## Project Description

AskMyNotes is an AI-powered personalized learning platform that transforms a student's notes into an interactive study environment. Users can organize their materials by subject, upload PDF and text documents, ask questions, inspect source evidence, generate flashcards, and take AI-generated quizzes. The system uses computer vision to understand scanned documents, vector embeddings to perform semantic search, and Retrieval-Augmented Generation to produce answers grounded in the user's own study materials. By connecting document management, question answering, active recall, practice tracking, and mastery analytics in one platform, AskMyNotes helps students study more efficiently and with greater confidence.
