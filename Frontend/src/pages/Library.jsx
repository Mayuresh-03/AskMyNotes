import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, BarChart2, Share2, Plus, FileText, Youtube } from 'lucide-react';
import { API_BASE_URL } from '../api/apiConfig';
import { useAuthStore } from '../authStore';
import UploadModal from '../components/UploadModal';
import ShareModal from '../components/ShareModal';

const Library = () => {
  const navigate = useNavigate();
  const { user, token } = useAuthStore();

  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/study/subjects/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setSubjects(data);
      } catch (err) {
        console.error('Failed to load library:', err);
      }
    };
    if (user?.id) loadSubjects();
  }, [user, token]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">My Study Library</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Manage Workspace Subjects & Content</p>
        </div>
      </div>

      {/* Subject Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subjects.map((s) => (
          <div key={s.id} className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-6">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center font-black">
                  <BookOpen size={20} />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSelectedSubject(s); setIsShareOpen(true); }}
                    className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all"
                    title="Share Workspace"
                  >
                    <Share2 size={16} />
                  </button>
                  <button
                    onClick={() => navigate(`/app/analytics/${s.id}`)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                    title="In-Depth Analytics"
                  >
                    <BarChart2 size={16} />
                  </button>
                </div>
              </div>

              <h3 className="font-black text-slate-900 text-lg">{s.name}</h3>
              <p className="text-xs font-bold text-slate-400 mt-1">{s.files?.length || 0} Indexed Materials</p>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-50">
              <button
                onClick={() => navigate(`/app/hub/${s.id}`)}
                className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-all text-center"
              >
                Open Copilot
              </button>
              <button
                onClick={() => { setSelectedSubject(s); setIsUploadOpen(true); }}
                className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"
                title="Add Material (PDF / YouTube)"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modals */}
      {selectedSubject && (
        <>
          <UploadModal
            isOpen={isUploadOpen}
            onClose={() => setIsUploadOpen(false)}
            subjectId={selectedSubject.id}
            onUploadSuccess={() => window.location.reload()}
          />
          <ShareModal
            isOpen={isShareOpen}
            onClose={() => setIsShareOpen(false)}
            subjectId={selectedSubject.id}
            subjectName={selectedSubject.name}
          />
        </>
      )}
    </div>
  );
};

export default Library;