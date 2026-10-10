import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../authStore';
import { 
  BookOpen, 
  FileText, 
  BrainCircuit, 
  Mic2,
  ChevronRight,
  Clock,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  Activity,
  Plus,
  BarChart2,
  AlertCircle
} from 'lucide-react';
import { API_BASE_URL } from "../api/apiConfig";

const SubjectCard = ({ title, fileCount, subjectId, onNavigate, onAnalytics }) => (
  <div 
    className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-green-100 transition-all group flex flex-col justify-between"
  >
    <div>
      <div className="flex justify-between items-start">
        <div className="p-3 rounded-2xl bg-green-50 text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
          <BookOpen className="w-6 h-6" />
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onAnalytics(subjectId); }}
          className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center gap-1 text-[10px] font-black uppercase"
          title="View Topic Mastery & Diagnostics"
        >
          <BarChart2 className="w-4 h-4" />
          <span>Analytics</span>
        </button>
      </div>
      <div className="mt-6">
        <h3 className="text-lg font-black text-slate-900 group-hover:text-green-700 transition-colors">{title}</h3>
        <div className="flex items-center text-sm font-bold text-slate-400 mt-1">
          <FileText className="w-4 h-4 mr-1.5 text-green-500" />
          {fileCount} Source Documents 
        </div>
      </div>
    </div>

    <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-50">
      <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">Grounded Workspace</span>
      <button 
        onClick={() => onNavigate(subjectId)}
        className="flex items-center text-green-600 text-xs font-black uppercase tracking-widest hover:underline"
      >
        Open Hub <ChevronRight className="w-3 h-3 ml-1" />
      </button>
    </div>
  </div>
);

const DashboardPage = () => {
  const { user, token } = useAuthStore();
  const userName = user?.full_name?.split(' ')[0] || 'Scholar';
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [subRes, analyticsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/study/subjects/${user.id}`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/api/study/analytics/${user.id}`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        const subData = await subRes.json();
        const analyticsData = await analyticsRes.json();

        setSubjects(Array.isArray(subData) ? subData : []);
        
        const analyticsMap = {};
        if (Array.isArray(analyticsData)) {
          analyticsData.forEach(item => { analyticsMap[item.subject_id] = item; });
        }
        setAnalytics(analyticsMap);

      } catch (err) {
        console.error("Dashboard Load Error:", err);
      } finally {
        setLoading(false);
      }
    };
    if (user?.id) fetchDashboardData();
  }, [user, token]);

  const totalFiles = subjects.reduce((acc, sub) => acc + (sub.files?.length || 0), 0);
  const activeSubjects = subjects.filter(s => s.files?.length > 0).length;

  return (
    <div className="space-y-8 p-2 max-w-7xl mx-auto pb-20">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
            Welcome back, {userName}! <Sparkles className="text-green-500 w-6 h-6 animate-pulse" />
          </h1>
          <p className="text-slate-500 mt-2 font-medium">
            Your personal AI knowledge base is synchronized and ready for study.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/app/notes')}
            className="px-6 py-4 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-800 shadow-xl transition-all flex items-center gap-2"
          >
            <Plus size={16} /> Create Subject Scope 
          </button>
          <button 
            onClick={() => navigate('/app/notes')}
            className="px-6 py-4 bg-green-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-green-700 shadow-xl shadow-green-100 transition-all flex items-center gap-2"
          >
            <FileText size={16} /> My Library 
          </button>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center gap-5 shadow-sm">
           <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl"><TrendingUp size={24}/></div>
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Scopes</p>
              <p className="text-xl font-black text-slate-900">{activeSubjects}</p>
           </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center gap-5 shadow-sm">
           <div className="p-4 bg-green-50 text-green-600 rounded-2xl"><Activity size={24}/></div>
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grounded Files</p>
              <p className="text-xl font-black text-slate-900">{totalFiles}</p>
           </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center gap-5 shadow-sm">
           <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl"><CheckCircle2 size={24}/></div>
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Practice Completed</p>
              <p className="text-xl font-black text-slate-900">
                {Object.values(analytics).reduce((acc, curr) => acc + (curr.practice_count || 0), 0)} Quizzes
              </p>
           </div>
        </div>
      </div>

      {/* Subject Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {subjects.slice(0, 3).map((sub) => (
          <SubjectCard 
            key={sub.id}
            subjectId={sub.id}
            title={sub.name}
            fileCount={sub.files?.length || 0}
            onNavigate={(id) => navigate(`/app/hub/${id}`)}
            onAnalytics={(id) => navigate(`/app/analytics/${id}`)}
          />
        ))}
      </div>

      {/* Readiness & Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Subject Readiness Index */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 tracking-tight">
                  <BrainCircuit size={24} className="text-green-600" /> Subject Readiness Index
              </h3>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">AI analysis of current knowledge coverage</p>
            </div>
            <span className="text-[10px] font-black text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-100 uppercase tracking-widest">
                Grounded
            </span>
          </div>
          
          <div className="space-y-8">
             {subjects.length > 0 ? subjects.map((sub, index) => {
                 const fileCount = sub.files?.length || 0;
                 const mastery = analytics[sub.id]?.mastery_percentage || Math.min(fileCount * 25, 100);
                 return (
                   <div key={index} className="group">
                      <div className="flex justify-between mb-3 items-end px-1">
                          <span className="text-sm font-black text-slate-700 uppercase tracking-tight group-hover:text-green-600 transition-colors">{sub.name}</span>
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => navigate(`/app/analytics/${sub.id}`)}
                              className="text-[10px] font-black text-blue-600 hover:underline uppercase"
                            >
                              In-Depth Diagnostics →
                            </button>
                            <span className="text-xs font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-md">{mastery}%</span>
                          </div>
                      </div>
                      <div className="w-full bg-slate-50 h-4 rounded-full overflow-hidden border border-slate-100">
                          <div 
                              className="bg-green-500 h-full rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                              style={{ width: `${mastery}%` }}
                          />
                      </div>
                   </div>
                 )
             }) : (
               <p className="text-center text-slate-300 font-bold uppercase py-10">No active study subjects found</p>
             )}
          </div>
        </div>

        {/* Recent Insights Panel */}
        <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl flex flex-col border border-slate-800">
          <h3 className="text-lg font-black text-white mb-6 flex items-center gap-3 tracking-tight">
            <Mic2 size={24} className="text-green-400" /> Voice & Audio Assistant
          </h3>
          
          <div className="flex-1 space-y-5">
            {subjects.length > 0 ? subjects.filter(s => s.files?.length > 0).slice(0, 3).map((sub, i) => (
                <div 
                  key={i} 
                  onClick={() => navigate(`/app/hub/${sub.id}`)}
                  className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-green-500/30 transition-all cursor-pointer group"
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                          <span className="text-[10px] font-black text-white uppercase tracking-widest">{sub.name}</span>
                        </div>
                        <span className="text-[9px] text-green-400 font-bold uppercase">Launch Voice</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium leading-relaxed italic group-hover:text-slate-300">
                        "Your documents are processed. Speak directly to generate instant audio summaries."
                    </p>
                </div>
            )) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-700">
                <Activity size={40} className="mb-3 opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-widest">No recent logs</p>
              </div>
            )}

            <div className="pt-6 mt-auto">
                <button 
                  onClick={() => navigate('/app/notes')}
                  className="w-full py-4 text-[10px] font-black text-green-400 border border-green-500/20 uppercase tracking-[0.2em] rounded-xl hover:bg-green-500/10 transition-all"
                >
                    Manage Knowledge Base
                </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DashboardPage;