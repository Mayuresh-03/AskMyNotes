import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Mic, Send, ShieldCheck, Loader2, MessageSquare, Info,
  AlertCircle, Square, Volume2, History, X, Clock, Globe, ExternalLink,
  ChevronRight, ChevronLeft, BookOpen, ChevronDown
} from 'lucide-react';
import { useAuthStore } from '../authStore';
import { API_BASE_URL } from "../api/apiConfig";

const SubjectHub = () => {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  
  // State Management
  const [subjects, setSubjects] = useState([]);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hello! I'm your AI Study Copilot. What would you like to explore from your notes today?" }
  ]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  // Drawer and UI States
  const [activeEvidence, setActiveEvidence] = useState(null);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  
  const audioRef = useRef(null);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    const fetchSubs = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/study/subjects/${user.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setSubjects(data);
      } catch (err) {
        console.error("Failed to load subjects", err);
      }
    };
    if (user?.id) fetchSubs();
  }, [user, token]);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlayingVoice(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    const userMsg = { role: 'user', content: query };
    const history = messages.map(m => ({ role: m.role, content: m.content }));
    
    setMessages(prev => [...prev, userMsg]);
    setQuery("");
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/study/chat/${subjectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ query, subject_id: parseInt(subjectId), history })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.answer, 
        citations: data.citations, 
        confidence: data.confidence 
      }]);
      setActiveEvidence(data.citations);
    } catch (err) { 
      console.error("Chat Error:", err); 
    } finally {
      setIsLoading(false);
    }
  };

  const handleWebSearch = async () => {
    setIsLoading(true);
    try {
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content;
      
      const res = await fetch(`${API_BASE_URL}/api/study/web-search/${subjectId}`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
            query: lastUserMsg || "General search context",
            subject_id: parseInt(subjectId) 
        })
      });
      
      const data = await res.json();
  
      if (data.error) {
        alert(`Search Error: ${data.error}`);
      } else if (data.links && data.links.length > 0) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "I've found these verified resources:",
          webLinks: data.links,
          isWebSource: true
        }]);
      } else {
        alert("No external resources found for this specific topic.");
      }
    } catch (err) { 
      console.error("Web Search Failed", err); 
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder.current = new MediaRecorder(stream);
        audioChunks.current = [];
        mediaRecorder.current.ondataavailable = (e) => audioChunks.current.push(e.data);
        mediaRecorder.current.onstop = async () => {
          const blob = new Blob(audioChunks.current, { type: 'audio/wav' });
          handleVoiceUpload(blob);
          stream.getTracks().forEach(t => t.stop());
        };
        mediaRecorder.current.start();
        setIsRecording(true);
      } catch (err) { alert("Microphone access failed."); }
    }
  };

  const handleVoiceUpload = async (blob) => {
    setIsLoading(true);
    const formData = new FormData();
    formData.append("file", blob, "recording.wav");
    formData.append("history", JSON.stringify(messages.map(m => ({ role: m.role, content: m.content }))));

    try {
      const res = await fetch(`${API_BASE_URL}/api/study/voice-chat/${subjectId}`, {
        method: "POST",
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!res.ok) throw new Error("Voice pipeline failed");

      const audioBlob = await res.blob();
      stopAudio();
      
      const audio = new Audio(URL.createObjectURL(audioBlob));
      audioRef.current = audio;
      audio.onplay = () => setIsPlayingVoice(true);
      audio.onended = () => setIsPlayingVoice(false);
      audio.play();

      const rawTranscript = res.headers.get("X-Transcript");
      const rawAnswer = res.headers.get("X-Answer");
      const rawCitations = res.headers.get("X-Citations");
      const confidence = res.headers.get("X-Confidence") || "Medium";

      const transcript = rawTranscript ? decodeURIComponent(rawTranscript) : "Voice Query";
      const answer = rawAnswer ? decodeURIComponent(rawAnswer) : "Audio Response Processed";
      
      let citations = null;
      try { if (rawCitations) citations = JSON.parse(decodeURIComponent(rawCitations)); } catch (e) { citations = null; }

      setMessages(prev => [
        ...prev, 
        { role: 'user', content: transcript }, 
        { role: 'assistant', content: answer, citations, confidence, isVoice: true }
      ]);

      if (citations) setActiveEvidence(citations);

    } catch (err) { 
      console.error("Voice Processing Error:", err); 
    } finally { 
      setIsLoading(false); 
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] gap-0 p-0 bg-white relative overflow-hidden">
      
      {/* Left History Drawer */}
      {isHistoryOpen && (
        <div className="absolute inset-y-0 left-0 w-80 bg-white z-50 border-r border-slate-100 shadow-2xl animate-in slide-in-from-left duration-300 flex flex-col">
          <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-900 text-white">
            <div className="flex items-center gap-2 font-black text-xs uppercase tracking-widest text-green-400">
              <History size={16}/> Session History
            </div>
            <button onClick={() => setIsHistoryOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={18}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center opacity-40">
             <Clock size={32} className="text-slate-200 mb-4" />
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Awaiting history...</p>
          </div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <div className="w-20 bg-white border-r border-slate-100 flex flex-col items-center py-8 gap-6 z-10 shrink-0">
          <button onClick={() => setIsHistoryOpen(true)} className="p-4 rounded-2xl bg-slate-50 text-slate-400 hover:text-green-600 transition-all shadow-sm" title="History">
            <History size={24} />
          </button>
          <button onClick={handleWebSearch} disabled={messages.length < 2 || isLoading} className="p-4 rounded-2xl bg-blue-50 text-blue-500 hover:bg-blue-600 hover:text-white transition-all shadow-sm group disabled:opacity-30" title="Web Search Context">
            <Globe size={24} className="group-hover:rotate-12 transition-transform" />
          </button>
      </div>

      {/* Main Chat View */}
      <div className={`flex-1 flex flex-col transition-all duration-500 ease-in-out ${isEvidenceOpen ? 'mr-80' : 'mr-0'}`}>
        
        {/* Header */}
        <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center text-white shadow-md"><MessageSquare size={20}/></div>
            <div>
              <h2 className="font-black text-slate-900 tracking-tight">AI Note Copilot</h2>
              <div className="flex items-center gap-1 text-[9px] text-green-600 font-black uppercase"><ShieldCheck size={10}/> Grounded Learning</div>
            </div>
          </div>

          <div className="relative min-w-[200px]">
            <select value={subjectId} onChange={(e) => navigate(`/app/hub/${e.target.value}`)} className="w-full appearance-none bg-slate-50 border-none text-xs font-bold p-3 pr-10 rounded-xl outline-none cursor-pointer">
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-3 text-slate-400 pointer-events-none" size={14} />
          </div>
        </div>
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/40">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
              <div className={`max-w-[80%] p-5 rounded-3xl shadow-sm relative ${m.role === 'user' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-100 text-slate-800'}`}>
                <p className="text-sm font-medium leading-relaxed">{m.content}</p>
                
                {m.webLinks && (
                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                    {m.webLinks.map((link, idx) => (
                      <a 
                        key={idx} 
                        href={link.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-100 group hover:bg-blue-600 transition-all duration-300"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <BookOpen size={14} className="text-blue-600 group-hover:text-white shrink-0" />
                          <span className="text-[11px] font-black text-blue-900 group-hover:text-white truncate uppercase tracking-tighter">{link.title}</span>
                        </div>
                        <ExternalLink size={12} className="text-blue-400 group-hover:text-white" />
                      </a>
                    ))}
                  </div>
                )}
                
                <div className="flex items-center gap-3 mt-3">
                  {m.role === 'assistant' && m.confidence && (
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${m.confidence === 'High' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600'}`}>
                      {m.confidence} Confidence
                    </span>
                  )}
                  {m.citations && (
                    <button 
                      onClick={() => { setActiveEvidence(m.citations); setIsEvidenceOpen(true); }} 
                      className="text-[9px] font-black text-green-600 uppercase hover:underline"
                    >
                      View Internal Evidence →
                    </button>
                  )}
                  {m.isVoice && isPlayingVoice && (
                    <button onClick={stopAudio} className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-600 rounded-lg text-[8px] font-black uppercase"><Square size={10} fill="currentColor"/> Stop</button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isLoading && <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest animate-pulse"><Loader2 className="animate-spin" size={14}/> Contextualizing...</div>}
          <div ref={scrollRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-6 bg-white border-t border-slate-100">
          <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-200 focus-within:ring-2 focus-within:ring-green-500/20 transition-all">
            <button type="button" onClick={toggleRecording} className={`p-3 rounded-xl transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-slate-400 shadow-sm hover:text-green-600'}`}>
              {isRecording ? <Volume2 size={20}/> : <Mic size={20}/>}
            </button>
            <input value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1 bg-transparent border-none outline-none text-sm font-bold px-2 text-slate-700" placeholder="Ask your notes..." />
            <button type="submit" className="p-3 bg-green-600 text-white rounded-xl shadow-lg hover:bg-green-700 active:scale-95 transition-all"><Send size={20}/></button>
          </div>
        </form>
      </div>

      {/* Evidence Drawer */}
      <div className={`fixed top-0 right-0 h-full bg-slate-900 w-80 shadow-2xl z-40 transition-transform duration-500 transform ${isEvidenceOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-8 h-full flex flex-col">
          <div className="flex justify-between items-center mb-10 border-b border-white/10 pb-4">
             <div className="flex items-center gap-2 text-green-400 font-black text-xs uppercase tracking-widest">
                <Info size={18}/> Internal Evidence Log
             </div>
             <button onClick={() => setIsEvidenceOpen(false)} className="p-1 text-slate-400 hover:text-white transition-colors"><X size={20}/></button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {activeEvidence ? activeEvidence.map((c, i) => (
              <div key={i} className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-green-500/30 transition-all group">
                <div className="text-green-400 text-[8px] font-black mb-2 flex items-center gap-2 uppercase tracking-widest">
                  <div className="w-1 h-1 rounded-full bg-green-500"></div>
                  {c.file_name} {c.page_number ? `(Pg ${c.page_number})` : ''}
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed italic">"{c.chunk_text}..."</p>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center h-full opacity-20 text-white text-center">
                 <AlertCircle size={40} className="mb-4" />
                 <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Knowledge Grounding</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <button 
        onClick={() => setIsEvidenceOpen(!isEvidenceOpen)}
        className={`fixed top-1/2 -translate-y-1/2 right-0 z-50 p-2 bg-slate-900 text-white rounded-l-xl border-y border-l border-slate-700 shadow-xl transition-all duration-500 ${isEvidenceOpen ? 'mr-80' : 'mr-0'}`}
      >
        {isEvidenceOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>

    </div>
  );
};

export default SubjectHub;