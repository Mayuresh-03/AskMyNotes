import React, { useState } from 'react';
import { Upload, Youtube, FileText, Loader2, X } from 'lucide-react';
import { API_BASE_URL } from '../api/apiConfig';
import { useAuthStore } from '../authStore';

const UploadModal = ({ isOpen, onClose, subjectId, onUploadSuccess }) => {
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState('pdf'); // 'pdf' | 'youtube'
  const [file, setFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handlePdfUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setIsLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('subject_id', subjectId);

    try {
      const res = await fetch(`${API_BASE_URL}/api/study/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to upload file');
      const data = await res.json();
      onUploadSuccess(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleYoutubeIngest = async (e) => {
    e.preventDefault();
    if (!youtubeUrl) return;

    setIsLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('youtube_url', youtubeUrl);
    formData.append('subject_id', subjectId);

    try {
      const res = await fetch(`${API_BASE_URL}/api/study/ingest-youtube`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'YouTube ingestion failed');

      onUploadSuccess(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-black text-slate-900 text-lg">Add Material to Subject</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-2xl mb-6">
          <button
            onClick={() => setActiveTab('pdf')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
              activeTab === 'pdf' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            <FileText size={16} /> PDF Document
          </button>
          <button
            onClick={() => setActiveTab('youtube')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
              activeTab === 'youtube' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'
            }`}
          >
            <Youtube size={16} /> YouTube Video
          </button>
        </div>

        {error && <div className="p-3 mb-4 rounded-xl bg-red-50 text-red-600 text-xs font-bold">{error}</div>}

        {activeTab === 'pdf' ? (
          <form onSubmit={handlePdfUpload} className="space-y-4">
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-green-500 transition-colors">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files[0])}
                className="hidden"
                id="pdf-input"
              />
              <label htmlFor="pdf-input" className="cursor-pointer flex flex-col items-center">
                <Upload size={32} className="text-slate-400 mb-2" />
                <span className="text-xs font-bold text-slate-700">
                  {file ? file.name : 'Click to select or drag PDF file'}
                </span>
              </label>
            </div>
            <button
              type="submit"
              disabled={!file || isLoading}
              className="w-full py-3 bg-green-600 text-white font-bold text-xs rounded-xl shadow-lg hover:bg-green-700 disabled:opacity-40 flex justify-center items-center gap-2"
            >
              {isLoading ? <Loader2 className="animate-spin" size={16} /> : 'Upload & Process PDF'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleYoutubeIngest} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2">YouTube Video URL</label>
              <input
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-red-500"
              />
            </div>
            <button
              type="submit"
              disabled={!youtubeUrl || isLoading}
              className="w-full py-3 bg-red-600 text-white font-bold text-xs rounded-xl shadow-lg hover:bg-red-700 disabled:opacity-40 flex justify-center items-center gap-2"
            >
              {isLoading ? <Loader2 className="animate-spin" size={16} /> : 'Import Video Transcript'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default UploadModal;