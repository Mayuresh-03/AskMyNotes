import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../authStore';
import { API_BASE_URL } from '../api/apiConfig';
import { 
  Brain, ChevronLeft, ChevronRight, Zap, RotateCcw, 
  Loader2, PlayCircle, CheckCircle, RefreshCcw, ShieldCheck,
  Radio, Volume2, Square, Sparkles
} from 'lucide-react';

const FlashcardsPage = () => {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  
  const [subjects, setSubjects] = useState([]);
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [error, setError] = useState(null);

  // Audio Podcast State
  const [isGeneratingPodcast, setIsGeneratingPodcast] = useState(false);
  const [isPlayingPodcast, setIsPlayingPodcast] = useState(false);
  const audioRef = useRef(null);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (cards.length === 0) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped(!isFlipped);
      } else if (e.code === 'ArrowRight') {
        handleNext();
      } else if (e.code === 'ArrowLeft') {
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cards, isFlipped, currentIndex]);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/study/subjects/${user.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setSubjects(data);
      } catch (err) {
        console.error("Failed to load subjects:", err);
      }
    };
    if (user?.id) fetchSubjects();
  }, [user, token]);

  const stopPodcastAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlayingPodcast(false);
    }
  };

  const handleGeneratePodcast = async () => {
    if (!subjectId) return;
    setIsGeneratingPodcast(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/study/podcast/${subjectId}`, {
        method: "POST",
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error("Podcast generation failed.");

      const audioBlob = await res.blob();
      stopPodcastAudio();

      const audio = new Audio(URL.createObjectURL(audioBlob));
      audioRef.current = audio;
      audio.onplay = () => setIsPlayingPodcast(true);
      audio.onended = () => setIsPlayingPodcast(false);
      audio.play();

    } catch (err) {
      console.error("Podcast Generation Error:", err);
      alert("Failed to generate audio podcast summary. Ensure notes are uploaded for this subject.");
    } finally {
      setIsGeneratingPodcast(false);
    }
  };

  const fetchFlashcards = async () => {
    if (!subjectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/study/generate-flashcards/${subjectId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.length === 0) throw new Error("No notes found to generate cards.");
      setCards(data);
      setCurrentIndex(0);
      setIsFlipped(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const logMastery = async (status) => {
    setIsLogging(true);
    try {
      await fetch(`${API_BASE_URL}/api/study/log-practice`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          user_id: user.id,
          subject_id: parseInt(subjectId),
          score: status === 'mastered' ? 1.0 : 0.0,
          topic_data: { 
            card_front: cards[currentIndex].front,
            status: status 
          }
        })
      });
      handleNext();
    } catch (err) {
      console.error("Failed to log practice:", err);
    } finally {
      setIsLogging(false);
    }
  };

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % cards.length);
    }, 150);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
    }, 150);
  };

  return (
    <div className="space-y-8 p-4 max-w-4xl mx-auto pb-20">
      {/* Header & Selector */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-green-600 text-white rounded-2xl shadow-lg">
            <Brain size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Smart Recall</h2>
            <select 
              value={subjectId || ""} 
              onChange={(e) => navigate(`/app/flashcards/${e.target.value}`)}
              className="mt-1 bg-transparent text-xs font-bold text-slate-500 uppercase tracking-widest outline-none cursor-pointer"
            >
              <option value="" disabled>Change Subject</option>
              {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
            </select>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Audio Podcast Button */}
          <button 
            onClick={handleGeneratePodcast}
            disabled={!subjectId || isGeneratingPodcast}
            className="flex items-center gap-2 px-5 py-3 bg-amber-500 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-amber-600 transition-all shadow-md disabled:opacity-50"
          >
            {isGeneratingPodcast ? <Loader2 className="animate-spin" size={16} /> : <Radio size={16} />}
            <span>Podcast Summary</span>
          </button>

          <button 
            onClick={fetchFlashcards}
            disabled={!subjectId || loading}
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <RotateCcw size={16} />}
            Generate Deck
          </button>
        </div>
      </div>

      {/* Audio Podcast Player Bar */}
      {isPlayingPodcast && (
        <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-between border border-slate-800 shadow-xl animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 text-white rounded-xl">
              <Volume2 size={20} className="animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-amber-400">Playing Audio Podcast Overview</p>
              <p className="text-[10px] text-slate-400 font-bold">Synthesized 2-minute overview grounded in your notes</p>
            </div>
          </div>

          <button 
            onClick={stopPodcastAudio} 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-[10px] font-black uppercase transition-all"
          >
            <Square size={12} fill="currentColor" /> Stop
          </button>
        </div>
      )}

      {/* Main Flashcard View */}
      {loading ? (
        <div className="h-96 flex flex-col items-center justify-center space-y-4">
           <Loader2 className="animate-spin text-green-600" size={48} />
           <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Synthesizing study deck...</p>
        </div>
      ) : cards.length > 0 ? (
        <div className="space-y-10 animate-in fade-in duration-500">
          
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Card {currentIndex + 1} of {cards.length}</span>
            <div className="w-64 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all duration-500" 
                  style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
                />
            </div>
          </div>

          {/* 3D Flip Card */}
          <div 
            className="group h-[420px] w-full [perspective:1000px] cursor-pointer"
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <div className={`relative h-full w-full transition-all duration-500 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
              
              {/* Front Side */}
              <div className="absolute inset-0 h-full w-full bg-white border-2 border-slate-100 rounded-[3rem] p-10 flex flex-col items-center justify-center text-center shadow-xl [backface-visibility:hidden]">
                <Zap className="text-green-500 mb-6" size={32} />
                <p className="text-2xl font-bold text-slate-800 leading-tight">
                  {cards[currentIndex].front}
                </p>
                <p className="mt-8 text-[10px] font-black text-slate-300 uppercase tracking-widest">Space to Flip • Click to reveal</p>
              </div>

              {/* Back Side */}
              <div className="absolute inset-0 h-full w-full bg-slate-900 border-2 border-slate-800 rounded-[3rem] p-10 flex flex-col items-center justify-center text-center shadow-2xl [transform:rotateY(180deg)] [backface-visibility:hidden]">
                <ShieldCheck className="text-green-400 mb-6" size={32} />
                <p className="text-xl font-medium text-slate-200 leading-relaxed italic mb-10 px-4">
                  "{cards[currentIndex].back}"
                </p>
                
                {/* Mastery Action Buttons */}
                <div className="flex gap-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => logMastery('needs_review')}
                      disabled={isLogging}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl border border-white/10 text-xs font-black uppercase tracking-tighter transition-all"
                    >
                      <RefreshCcw size={14} /> Review
                    </button>
                    <button 
                      onClick={() => logMastery('mastered')}
                      disabled={isLogging}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-500 text-white rounded-2xl shadow-lg shadow-green-900/40 text-xs font-black uppercase tracking-tighter transition-all"
                    >
                      <CheckCircle size={14} /> Mastered
                    </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center items-center gap-8">
            <button onClick={handlePrev} className="p-4 bg-white border border-slate-100 rounded-full shadow-lg text-slate-400 hover:text-green-600 transition-all active:scale-90">
              <ChevronLeft size={28} />
            </button>
            <button onClick={handleNext} className="p-4 bg-white border border-slate-100 rounded-full shadow-lg text-slate-400 hover:text-green-600 transition-all active:scale-90">
              <ChevronRight size={28} />
            </button>
          </div>

        </div>
      ) : (
        <div className="h-96 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem] flex flex-col items-center justify-center text-center p-10">
          <PlayCircle size={48} className="text-slate-300 mb-4" />
          <h3 className="text-lg font-black text-slate-800 tracking-tight">Generate Study Deck</h3>
          <p className="text-slate-500 text-sm mt-1 mb-8 max-w-xs font-medium">Select a subject above to transform your notes into interactive active-recall cards or listen to an audio podcast.</p>
        </div>
      )}
    </div>
  );
};

export default FlashcardsPage;