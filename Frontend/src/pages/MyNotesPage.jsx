import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, FolderPlus, Activity, BarChart2, Share2, Plus } from 'lucide-react';
import { useAuthStore } from '../authStore';
import { API_BASE_URL } from "../api/apiConfig";
import PreviewModal from '../components/Library/PreviewModal';
import SubjectCard from '../components/Library/SubjectCard';
import ShareModal from '../components/ShareModal';
import UploadModal from '../components/UploadModal';

const MyNotesPage = () => {
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const [subjects, setSubjects] = useState([]);
  const [analytics, setAnalytics] = useState({}); 
  const [newSubjectName, setNewSubjectName] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  // Modal States
  const [selectedShareSubject, setSelectedShareSubject] = useState(null);
  const [selectedUploadSubjectId, setSelectedUploadSubjectId] = useState(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const subRes = await fetch(`${API_BASE_URL}/api/study/subjects/${user.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const subData = await subRes.json();
      setSubjects(Array.isArray(subData) ? subData : []);

      const analyticsRes = await fetch(`${API_BASE_URL}/api/study/analytics/${user.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const analyticsData = await analyticsRes.json();
      
      const analyticsMap = {};
      if (Array.isArray(analyticsData)) {
        analyticsData.forEach(item => {
          analyticsMap[item.subject_id] = item;
        });
      }
      setAnalytics(analyticsMap);
    } catch (err) {
      console.error("Dashboard sync error:", err);
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) fetchDashboardData();
  }, [user]);

  const handleCreateSubject = async () => {
    if (!newSubjectName.trim() || subjects.length >= 3) return;
    setIsCreating(true);
    try {
      const queryParams = new URLSearchParams({ name: newSubjectName.trim(), user_id: user.id }).toString();
      const res = await fetch(`${API_BASE_URL}/api/study/subjects?${queryParams}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        setNewSubjectName("");
        await fetchDashboardData();
      }
    } catch (err) { console.error(err); } finally { setIsCreating(false); }
  };

  const handleFileUpload = async (subjectId, files) => {
    setUploadingId(subjectId);
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('subject_id', subjectId);
      try {
        await fetch(`${API_BASE_URL}/api/study/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData,
        });
      } catch (err) { console.error(err); }
    }
    setUploadingId(null);
    fetchDashboardData();
  };

  const handleFileDelete = async (subId, fileName) => {
    if (!window.confirm(`Delete ${fileName}?`)) return;
    try {
      await fetch(`${API_BASE_URL}/api/study/files/${subId}/${fileName}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchDashboardData();
    } catch (err) { console.error(err); }
  };

  if (loading) return (
    <div className="flex flex-col h-64 items-center justify-center gap-4">
      <Loader2 className="animate-spin text-green-600" size={32} />
      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Compiling Mastery Data...</p>
    </div>
  );

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      <PreviewModal 
        isOpen={!!previewFile} 
        fileData={previewFile} 
        onClose={() => setPreviewFile(null)} 
      />

      {/* Share Subject Workspace Modal */}
      {selectedShareSubject && (
        <ShareModal 
          isOpen={!!selectedShareSubject}
          onClose={() => setSelectedShareSubject(null)}
          subjectId={selectedShareSubject.id}
          subjectName={selectedShareSubject.name}
        />
      )}

      {/* Upload Modal (PDF or YouTube Ingestion) */}
      {selectedUploadSubjectId && (
        <UploadModal 
          isOpen={!!selectedUploadSubjectId}
          onClose={() => setSelectedUploadSubjectId(null)}
          subjectId={selectedUploadSubjectId}
          onUploadSuccess={() => fetchDashboardData()}
        />
      )}
      
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Library & Mastery</h1>
          <p className="text-slate-500 text-sm mt-1">Analyzing <span className="font-bold text-slate-900">{subjects.length}/3</span> subject scopes.</p>
        </div>
        <div className="hidden md:flex gap-4">
           <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
              <Activity size={14} className="text-green-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Real-time sync</span>
           </div>
        </div>
      </header>

      {/* Subject Creator */}
      <div className="flex gap-3 bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
        <input 
          value={newSubjectName}
          onChange={(e) => setNewSubjectName(e.target.value)}
          placeholder={subjects.length >= 3 ? "Limit reached" : "Add a new subject..."}
          className="flex-1 bg-slate-50 border-none rounded-2xl px-5 py-3 outline-none focus:ring-2 focus:ring-green-500 text-sm font-bold"
        />
        <button 
          onClick={handleCreateSubject}
          disabled={isCreating || subjects.length >= 3 || !newSubjectName.trim()}
          className="bg-green-600 text-white px-10 rounded-2xl font-black text-xs uppercase flex items-center gap-2 hover:bg-green-700 shadow-lg shadow-green-100 disabled:opacity-50"
        >
          {isCreating ? <Loader2 className="animate-spin" size={18}/> : <FolderPlus size={18}/>}
          Create Scope
        </button>
      </div>

      {/* Subject Mastery List */}
      <div className="grid grid-cols-1 gap-10">
        {subjects.map((sub) => (
          <div key={sub.id} className="relative group">
            {/* Action Bar Header overlay for Subject Card */}
            <div className="flex justify-end items-center gap-2 mb-2 pr-2">
              <button
                onClick={() => setSelectedUploadSubjectId(sub.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold text-xs transition-all"
                title="Add Material (PDF / YouTube)"
              >
                <Plus size={14} />
                <span>Add Material</span>
              </button>

              <button
                onClick={() => setSelectedShareSubject(sub)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-green-50 hover:text-green-700 rounded-xl font-bold text-xs transition-all"
                title="Share Workspace"
              >
                <Share2 size={14} />
                <span>Share</span>
              </button>

              <button
                onClick={() => navigate(`/app/analytics/${sub.id}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl font-bold text-xs transition-all shadow-sm"
                title="View Subtopic Mastery & Diagnostics"
              >
                <BarChart2 size={14} />
                <span>In-Depth Analysis</span>
              </button>
            </div>

            <SubjectCard 
              sub={sub}
              stats={analytics[sub.id] || { mastery_percentage: 0, practice_count: 0, flashcards_total: 0 }}
              uploadingId={uploadingId}
              onUpload={handleFileUpload}
              onPreview={(fileName, subjectId) => setPreviewFile({ fileName, subjectId })}
              onDelete={handleFileDelete}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyNotesPage;