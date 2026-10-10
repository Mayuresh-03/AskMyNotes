import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BarChart3, AlertCircle, Sparkles, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../api/apiConfig';
import { useAuthStore } from '../authStore';

const InDepthAnalytics = () => {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuthStore();

  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingWeakQuiz, setIsGeneratingWeakQuiz] = useState(false);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/study/analytics/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        
        // Find analytics entry matching current subjectId
        const currentSubject = data.find((s) => String(s.subject_id) === String(subjectId));
        setAnalytics(currentSubject || null);
      } catch (err) {
        console.error('Failed to fetch subject analytics:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.id && subjectId) fetchAnalytics();
  }, [user, subjectId, token]);

  const handleGenerateWeakSpotQuiz = async () => {
    setIsGeneratingWeakQuiz(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/study/weakspot-quiz/${subjectId}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ user_id: user.id }),
      });

      const data = await res.json();
      if (res.ok) {
        // Navigate directly to quiz view with the generated remedial questions
        navigate(`/app/study-mode/${subjectId}`, { state: { adaptiveQuiz: data } });
      }
    } catch (err) {
      console.error('Weak spot quiz error:', err);
    } finally {
      setIsGeneratingWeakQuiz(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-120px)] items-center justify-center text-slate-400 font-bold text-xs">
        <Loader2 className="animate-spin mr-2" size={20} /> Loading Mastery Analytics...
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Top Navigation */}
      <button
        onClick={() => navigate('/app/library')}
        className="flex items-center gap-2 text-xs font-black text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft size={16} /> Back to Library
      </button>

      {/* Header */}
      <div className="flex items-center justify-between bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{analytics?.name || 'Subject Analytics'}</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Topic Mastery & AI Diagnostic</p>
        </div>

        <button
          onClick={handleGenerateWeakSpotQuiz}
          disabled={isGeneratingWeakQuiz}
          className="px-5 py-3 bg-amber-500 text-white rounded-2xl font-black text-xs shadow-lg hover:bg-amber-600 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {isGeneratingWeakQuiz ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
          Adaptive Weak-Spot Quiz
        </button>
      </div>

      {/* Topics Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {analytics?.topics?.map((topic, index) => {
          const isWeak = topic.mastery < 60;
          return (
            <div key={index} className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-black text-slate-800 text-sm">{topic.name}</h3>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">{topic.sessions} Quizzes Completed</span>
                </div>
                <span className={`text-xs font-black px-2.5 py-1 rounded-xl ${isWeak ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                  {topic.mastery}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${isWeak ? 'bg-amber-500' : 'bg-green-500'}`}
                  style={{ width: `${topic.mastery}%` }}
                />
              </div>

              {isWeak && (
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 bg-amber-50 p-2 rounded-xl">
                  <AlertCircle size={12} /> Target for Weak-Spot Review
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default InDepthAnalytics;