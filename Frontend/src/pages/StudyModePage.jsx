import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  GraduationCap, CheckCircle2, XCircle, HelpCircle, 
  RotateCcw, FileSearch, Loader2,
  ChevronDown, Sparkles, Layers, PlayCircle,
  Save
} from 'lucide-react';
import { useAuthStore } from '../authStore';
import { API_BASE_URL } from "../api/apiConfig";

const StudyModePage = () => {
  const { subjectId } = useParams(); 
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token } = useAuthStore();
  
  const [subjects, setSubjects] = useState([]); 
  const [subtopics, setSubtopics] = useState([]);
  const [selectedSubtopic, setSelectedSubtopic] = useState("ALL"); // "ALL" or specific subtopic
  
  const [activeTab, setActiveTab] = useState('mcq');
  const [selectedOptions, setSelectedOptions] = useState({}); 
  const [showModelAnswers, setShowModelAnswers] = useState({});
  const [quizData, setQuizData] = useState({ mcqs: [], short_answer: [] });
  const [loading, setLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const statsRef = useRef({ subjectId, user, token, selectedOptions, quizData });

  useEffect(() => {
    statsRef.current = { subjectId, user, token, selectedOptions, quizData };
  }, [selectedOptions, quizData, subjectId]);

  // Load adaptive quiz if passed directly from InDepthAnalytics
  useEffect(() => {
    if (location.state?.adaptiveQuiz) {
      setQuizData({ mcqs: location.state.adaptiveQuiz.questions_json || [], short_answer: [] });
      setHasStarted(true);
    }
  }, [location.state]);

  // Fetch User Subjects & Analytics Subtopics
  useEffect(() => {
    const fetchSubjectsAndTopics = async () => {
      try {
        const [subRes, analyticsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/study/subjects/${user.id}`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/api/study/analytics/${user.id}`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        
        const subData = await subRes.json();
        const analyticsData = await analyticsRes.json();

        setSubjects(subData);

        // Filter subtopics for current subject
        const currentSubjectAnalytics = analyticsData.find(s => String(s.subject_id) === String(subjectId));
        if (currentSubjectAnalytics?.topics) {
          setSubtopics(currentSubjectAnalytics.topics.map(t => t.name));
        }
      } catch (err) {
        console.error("Failed to load study subjects:", err);
      }
    };
    if (user?.id) fetchSubjectsAndTopics();
  }, [user, token, subjectId]);

  // Auto-Save on exit
  useEffect(() => {
    return () => {
      const { selectedOptions, quizData, subjectId, user, token } = statsRef.current;
      const answeredCount = Object.keys(selectedOptions).length;
      
      if (answeredCount > 0 && quizData.mcqs?.length > 0) {
        const correct = quizData.mcqs.filter((q, idx) => selectedOptions[idx] === q.correct_answer).length;
        const score = correct / quizData.mcqs.length;

        const body = JSON.stringify({
          user_id: user.id,
          subject_id: parseInt(subjectId),
          score: score,
          topic_data: { type: "AUTO_EXIT_SYNC", answered: answeredCount, subtopic: selectedSubtopic }
        });
        
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(`${API_BASE_URL}/api/study/log-practice`, blob);
      }
    };
  }, [selectedSubtopic]);

  const fetchQuiz = async () => {
    if (!subjectId) return;
    setLoading(true);
    setError(null);
    setHasStarted(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/study/study-mode/${subjectId}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ subtopic: selectedSubtopic })
      });
      if (!res.ok) throw new Error("Failed to generate quiz.");
      const data = await res.json(); 
      setQuizData(data);
      setSelectedOptions({});
      setShowModelAnswers({});
    } catch (err) {
      setError(err.message);
      setHasStarted(false);
    } finally {
      setLoading(false);
    }
  };

  const finishSession = async () => {
    const total = quizData.mcqs.length;
    const correct = quizData.mcqs.filter((q, idx) => selectedOptions[idx] === q.correct_answer).length;
    const finalScore = total > 0 ? correct / total : 0;

    setIsSaving(true);
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
          score: finalScore,
          topic_data: { type: "MANUAL_SUBMIT", correct, total, subtopic: selectedSubtopic }
        })
      });
      alert(`Mastery Updated! You scored ${(finalScore * 100).toFixed(0)}%`);
      navigate(`/app/analytics/${subjectId}`);
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubjectChange = (e) => {
    const newId = e.target.value;
    setHasStarted(false);
    setQuizData({ mcqs: [], short_answer: [] });
    navigate(`/app/study/${newId}`); 
  };

  const handleOptionSelect = (qIdx, optionText) => {
    if (selectedOptions[qIdx]) return;
    setSelectedOptions(prev => ({ ...prev, [qIdx]: optionText }));
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-6">
      <Loader2 className="animate-spin text-green-600" size={56} />
      <p className="text-xl font-black text-slate-900 uppercase tracking-widest animate-pulse">Contextualizing Quiz Items...</p>
    </div>
  );

  const allMcqsAnswered = quizData.mcqs.length > 0 && Object.keys(selectedOptions).length === quizData.mcqs.length;

  return (
    <div className="space-y-8 p-4 max-w-5xl mx-auto pb-20">
      
      {/* Progress Header */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex flex-col md:flex-row items-center gap-5">
          <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-xl">
            <Layers size={28} />
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Scope</p>
              <select value={subjectId || ""} onChange={handleSubjectChange} className="mt-1 bg-slate-50 border-none font-bold py-2 px-4 rounded-xl outline-none cursor-pointer text-sm min-w-[180px]">
                <option value="" disabled>Select Subject</option>
                {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
              </select>
            </div>

            {/* Subtopic Filter */}
            {subtopics.length > 0 && (
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Target Subtopic</p>
                <select value={selectedSubtopic} onChange={(e) => setSelectedSubtopic(e.target.value)} className="mt-1 bg-blue-50 text-blue-900 border-none font-bold py-1.5 px-3 rounded-xl outline-none cursor-pointer text-xs">
                  <option value="ALL">Entire Subject (All Topics)</option>
                  {subtopics.map((top, idx) => <option key={idx} value={top}>{top}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex gap-3">
          {allMcqsAnswered && (
            <button 
              onClick={finishSession}
              disabled={isSaving}
              className="flex items-center gap-2 px-8 py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all uppercase text-xs tracking-widest shadow-xl"
            >
              {isSaving ? <Loader2 className="animate-spin" size={16}/> : <Save size={18} />} Save Mastery
            </button>
          )}
          <button 
            onClick={fetchQuiz}
            className="flex items-center gap-2 px-8 py-4 bg-green-600 text-white font-black rounded-2xl hover:bg-green-700 transition-all uppercase text-xs tracking-widest shadow-xl"
          >
            {hasStarted ? <RotateCcw size={18} /> : <PlayCircle size={18} />} {hasStarted ? "Regenerate" : "Start Quiz"}
          </button>
        </div>
      </div>

      {!hasStarted ? (
        <div className="flex flex-col items-center justify-center py-24 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
          <GraduationCap size={48} className="text-slate-300 mb-4" />
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">AI Diagnostic Quiz</h2>
          <p className="text-slate-500 mt-2 text-center max-w-md font-medium">Select a subject subtopic or test your knowledge across the entire course scope.</p>
        </div>
      ) : (
        <>
          <div className="flex p-2 bg-slate-100 rounded-2xl w-fit">
            <button onClick={() => setActiveTab('mcq')} className={`px-10 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'mcq' ? 'bg-white text-green-600 shadow-md' : 'text-slate-500'}`}>MCQs</button>
            <button onClick={() => setActiveTab('short')} className={`px-10 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'short' ? 'bg-white text-green-600 shadow-md' : 'text-slate-500'}`}>Concepts</button>
          </div>

          {activeTab === 'mcq' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              {quizData.mcqs.map((q, idx) => {
                const hasAnswered = !!selectedOptions[idx];
                const isCorrect = selectedOptions[idx] === q.correct_answer;

                return (
                  <div key={idx} className={`p-10 rounded-[3rem] border-2 bg-white transition-all duration-300 ${
                    hasAnswered ? (isCorrect ? 'border-green-200 shadow-lg shadow-green-50' : 'border-red-200 shadow-lg shadow-red-50') : 'border-slate-100 shadow-sm'
                  }`}>
                    <div className="flex justify-between items-start mb-6">
                      <span className="px-4 py-1.5 bg-slate-100 text-slate-500 text-[10px] font-black rounded-full uppercase tracking-widest">Question {idx + 1}</span>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-4 py-1.5 rounded-full border border-slate-100">
                        <FileSearch size={12} className="text-green-500" /> {q.citation || "Note Context"} 
                      </div>
                    </div>
                    
                    <h3 className="text-2xl font-bold text-slate-900 leading-tight mb-8">{q.question}</h3>

                    <div className="grid grid-cols-1 gap-4">
                      {q.options.map((opt, i) => {
                        const isSelected = selectedOptions[idx] === opt;
                        const isCorrectOpt = opt === q.correct_answer;
                        
                        let style = "border-slate-100 text-slate-700 hover:border-green-200";
                        if (isSelected) style = isCorrectOpt ? "bg-green-600 border-green-600 text-white shadow-lg" : "bg-red-500 border-red-500 text-white shadow-lg";
                        else if (hasAnswered && isCorrectOpt) style = "bg-green-50 border-green-500 text-green-700";

                        return (
                          <button 
                            key={i} 
                            disabled={hasAnswered} 
                            onClick={() => handleOptionSelect(idx, opt)} 
                            className={`p-6 rounded-[1.5rem] border-2 transition-all text-left font-bold text-base ${style}`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>

                    {hasAnswered && (
                      <div className={`mt-8 p-8 rounded-3xl border-2 animate-in zoom-in-95 duration-300 ${isCorrect ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex items-center gap-2 mb-3">
                          <HelpCircle size={18} className={isCorrect ? 'text-green-600' : 'text-slate-500'} />
                          <span className="text-xs font-black uppercase tracking-widest text-slate-700">Tutor Insight</span>
                        </div>
                        <p className="text-sm font-bold text-slate-600 leading-relaxed italic">
                          {q.explanation || "This answer is grounded in your uploaded notes."}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'short' && (
            <div className="space-y-6">
              {quizData.short_answer.map((q, idx) => (
                <div key={idx} className="p-10 rounded-[2.5rem] border border-slate-100 bg-white shadow-sm">
                   <h3 className="text-xl font-bold text-slate-900 mb-6">{q.question}</h3>
                   <textarea placeholder="Write your explanation..." className="w-full p-6 rounded-2xl bg-slate-50 border-none min-h-[140px] font-medium outline-none focus:ring-2 focus:ring-green-500/20 mb-4" />
                   <button onClick={() => setShowModelAnswers(p => ({...p, [idx]: !p[idx]}))} className="text-xs font-black text-green-600 uppercase tracking-widest hover:underline">
                      {showModelAnswers[idx] ? "Hide Answer" : "Check Model Answer →"}
                   </button>
                   {showModelAnswers[idx] && <div className="mt-6 p-6 bg-slate-900 text-slate-300 rounded-2xl italic text-sm border-l-4 border-green-500">{q.expected_answer}</div>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StudyModePage;