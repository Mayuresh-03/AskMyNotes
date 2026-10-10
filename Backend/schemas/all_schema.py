from pydantic import BaseModel, ConfigDict, EmailStr, Field
from datetime import datetime
from datetime import datetime
from typing import List, Optional, Any

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    # Made Optional to prevent validation errors if the DB field is missing
    created_at: Optional[datetime] = None 
    
    # This allows Pydantic to read SQLAlchemy models
    model_config = ConfigDict(from_attributes=True)

# --- Auth Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str
    
class TokenData(BaseModel):
    username: Optional[str] = None

class TokenWithUser(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# --- Password Reset Schemas ---
class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str

# --- NEW: RAG & Chat Schemas ---

class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, description="The user's question.")
    subject_id: int = Field(..., description="Subject ID to search in.")
    history: List[dict] = Field(
        default_factory=list,
        description="Optional conversation history (list of {role, content}).",
    )

class Citation(BaseModel):
    file_name: str
    page_number: int
    relevance_score: float = Field(0.0)
    chunk_text: str = Field("", description="Short snippet from the matched chunk.")

class ChatResponse(BaseModel):
    answer: str
    citations: List[Citation]
    confidence: str = Field(..., description="'High', 'Medium', or 'Low'")

# --- NEW: Study Mode Schemas ---

class MCQ(BaseModel):
    question: str
    options: List[str]
    correct_answer: str
    explanation: str = ""
    citation: str = ""

class ShortAnswer(BaseModel):
    question: str
    expected_answer: str
    citation: str = ""

class StudyModeResponse(BaseModel):
    subject_id: str
    mcqs: List[MCQ] = []
    short_answer: List[ShortAnswer] = []
    error: Optional[str] = None

# --- NEW: Upload Schemas ---

class UploadResponse(BaseModel):
    message: str
    file_name: str
    subject_id: str
    pages_processed: int
    chunks_created: int

# Rebuild models to handle any forward references
ChatResponse.model_rebuild()
StudyModeResponse.model_rebuild()
UserResponse.model_rebuild()