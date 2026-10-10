import React, { useState } from 'react';
import { Share2, Mail, Loader2, X } from 'lucide-react';
import { API_BASE_URL } from '../api/apiConfig';
import { useAuthStore } from '../authStore';

const ShareModal = ({ isOpen, onClose, subjectId, subjectName }) => {
  const { token } = useAuthStore();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });

  if (!isOpen) return null;

  const handleShare = async (e) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setStatusMessage({ text: '', type: '' });

    const formData = new FormData();
    formData.append('subject_id', subjectId);
    formData.append('target_email', email);

    try {
      const res = await fetch(`${API_BASE_URL}/api/study/share-subject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to share subject');

      setStatusMessage({ text: data.message, type: 'success' });
      setEmail('');
    } catch (err) {
      setStatusMessage({ text: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2 font-black text-slate-900 text-base">
            <Share2 className="text-green-600" size={20} /> Share Workspace
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full">
            <X size={20} />
          </button>
        </div>

        <p className="text-xs text-slate-500 font-medium mb-6">
          Invite a classmate to access notes, vector chat, and flashcards for <strong className="text-slate-800">{subjectName}</strong>.
        </p>

        {statusMessage.text && (
          <div className={`p-3 rounded-xl mb-4 text-xs font-bold ${statusMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {statusMessage.text}
          </div>
        )}

        <form onSubmit={handleShare} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-3.5 text-slate-400" size={16} />
            <input
              type="email"
              placeholder="classmate@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-green-500"
            />
          </div>
          <button
            type="submit"
            disabled={!email || isLoading}
            className="w-full py-3 bg-slate-900 text-white font-bold text-xs rounded-xl shadow-lg hover:bg-slate-800 disabled:opacity-40 flex justify-center items-center gap-2"
          >
            {isLoading ? <Loader2 className="animate-spin" size={16} /> : 'Send Invite'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ShareModal;