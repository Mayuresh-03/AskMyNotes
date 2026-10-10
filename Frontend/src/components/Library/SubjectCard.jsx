import React from 'react';
import {
  FileText,
  Target,
  Brain,
  Activity,
  Upload,
  Loader2,
  BarChart3,
  Eye,
  Trash2
} from 'lucide-react';

const FileItem = ({ file, onPreview, onDelete }) => (
  <div className="group/file relative flex items-center justify-between p-5 bg-slate-50/50 rounded-[1.5rem] border border-slate-100 hover:border-green-300 hover:bg-white transition-all duration-300">
    <div className="flex items-center gap-3 overflow-hidden">
      <div className="p-2 bg-white rounded-xl shadow-sm group-hover/file:bg-green-50 transition-colors">
        <FileText size={16} className="text-slate-400 group-hover/file:text-green-600" />
      </div>
      <span className="text-xs font-bold text-slate-700 truncate">{file.name}</span>
    </div>
    <div className="flex gap-1.5 opacity-0 group-hover/file:opacity-100 transition-opacity translate-x-2 group-hover/file:translate-x-0 duration-300">
      <button
        onClick={() => onPreview(file.name)}
        className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all"
      >
        <Eye size={18} />
      </button>
      <button
        onClick={() => onDelete(file.name)}
        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
      >
        <Trash2 size={18} />
      </button>
    </div>
  </div>
);

const SubjectCard = ({ sub, stats, uploadingId, onUpload, onPreview, onDelete }) => {
  // Aggregate stats from the new nested topics array
  const topics = stats?.topics || [];
  const totalSessions = topics.reduce((acc, t) => acc + t.sessions, 0);
  const avgMastery = topics.length > 0
    ? Math.round(topics.reduce((acc, t) => acc + t.mastery, 0) / topics.length)
    : 0;

  return (
    <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden group hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500">

      {/* Header & Overall Mastery */}
      <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-50/20">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-green-600 text-white rounded-[1.5rem] shadow-lg shadow-green-200 relative">
            <FileText size={24} />
            {avgMastery > 80 && (
              <div className="absolute -top-2 -right-2 bg-yellow-400 text-slate-900 p-1 rounded-full shadow-md">
                <Target size={12} fill="currentColor" />
              </div>
            )}
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-2xl tracking-tight">{sub.name}</h3>
            <div className="flex items-center gap-4 mt-1">
              <div className="flex items-center gap-1.5">
                <Brain size={12} className="text-slate-400" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {topics.length} Topics Identified
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Activity size={12} className="text-slate-400" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {totalSessions} Total Sessions
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Aggregate Mastery Bar */}
        <div className="flex items-center gap-6 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm min-w-[280px]">
          <div className="flex-1">
            <div className="flex justify-between items-center mb-2 px-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Global Mastery</span>
              <span className={`text-[10px] font-black ${avgMastery > 70 ? 'text-green-600' : 'text-orange-500'}`}>
                {avgMastery}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ease-out ${avgMastery > 70 ? 'bg-green-500' : 'bg-orange-400'}`}
                style={{ width: `${avgMastery}%` }}
              />
            </div>
          </div>
          <div className="w-[1px] h-10 bg-slate-100"></div>
          <input
            type="file"
            id={`up-${sub.id}`}
            className="hidden"
            multiple
            accept=".pdf,.txt"
            onChange={(e) => onUpload(sub.id, e.target.files)}
          />
          <button
            onClick={() => document.getElementById(`up-${sub.id}`).click()}
            disabled={uploadingId === sub.id}
            className="p-3 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all shadow-lg active:scale-95"
          >
            {uploadingId === sub.id ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
          </button>
        </div>
      </div>

      {/* NEW: Semantic Topic Breakdown */}
      {topics.length > 0 && (
        <div className="px-8 pt-6 pb-2">
          <div className="mb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Brain size={12} className="text-green-600" />
              Revision Progress by Subtopic
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {topics.map((topic, idx) => (
              <div key={idx} className="flex items-center justify-between bg-slate-50/50 p-4 rounded-2xl border border-slate-100 group/topic hover:bg-white hover:border-green-200 transition-all">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-700">{topic.name}</span>
                  <span className="text-[9px] font-black text-slate-400 uppercase mt-0.5">{topic.sessions} practices</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden sm:flex flex-col items-end">
                    <div className="w-16 h-1 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: `${topic.mastery}%` }} />
                    </div>
                    <span className="text-[9px] font-black text-green-600 mt-1">{topic.mastery}%</span>
                  </div>
                  {/* Targeted Quiz Button */}
                  <button
                    onClick={() => window.location.href = `/study/${sub.id}?topic=${encodeURIComponent(topic.name)}`}
                    className="p-2 bg-white text-slate-400 border border-slate-200 rounded-xl hover:bg-green-600 hover:text-white hover:border-green-600 transition-all shadow-sm"
                  >
                    <Brain size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Files Grid */}
      <div className="p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 bg-white">
        {sub.files?.map((f, i) => (
          <FileItem
            key={i}
            file={f}
            onPreview={() => onPreview(f.name, sub.id)}
            onDelete={() => onDelete(sub.id, f.name)}
          />
        ))}

        {(!sub.files || sub.files.length === 0) && (
          <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/30">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
              <BarChart3 size={32} className="opacity-20" />
            </div>
            <h4 className="text-slate-400 font-black text-xs uppercase tracking-widest">No Study Material Found</h4>
            <p className="text-[10px] text-slate-300 mt-1">Upload notes to activate AI mastery tracking.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubjectCard;