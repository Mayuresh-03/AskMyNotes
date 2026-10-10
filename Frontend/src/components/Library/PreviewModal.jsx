import React, { useState, useEffect } from 'react';
import { X, Loader2, FileText, ShieldCheck, Eye, Code } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuthStore } from '../../authStore';
import { API_BASE_URL } from "../../api/apiConfig";

const PreviewModal = ({ isOpen, fileData, onClose }) => {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState("pdf"); // 'pdf' or 'markdown'
  const { token } = useAuthStore();

  useEffect(() => {
    if (isOpen && fileData) {
      // Default back to PDF view when modal opens
      setViewMode("pdf");

      const fetchContent = async () => {
        setLoading(true);
        try {
          const res = await fetch(
            `${API_BASE_URL}/api/study/files/content/${fileData.subjectId}/${fileData.fileName}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          const data = await res.json();
          setContent(data.content);
        } catch (err) {
          setContent("Error: Could not retrieve document text.");
        } finally {
          setLoading(false);
        }
      };
      fetchContent();
    }
  }, [isOpen, fileData, token]);

  if (!isOpen) return null;

  // Raw PDF endpoint stream URL
  const pdfUrl = `${API_BASE_URL}/api/study/files/raw/${fileData?.subjectId}/${fileData?.fileName}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-5xl h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-xl text-green-700">
              <FileText size={20} />
            </div>
            <div>
              <span className="truncate max-w-[300px] sm:max-w-[400px] font-bold text-slate-800 block text-sm">
                {fileData?.fileName}
              </span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Document Preview
              </span>
            </div>
          </div>

          {/* Toggle View Mode Buttons */}
          <div className="flex items-center gap-2 bg-slate-200/60 p-1.5 rounded-2xl">
            <button
              onClick={() => setViewMode("pdf")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === "pdf"
                  ? "bg-white text-green-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Eye size={14} />
              <span>Original PDF</span>
            </button>
            
            <button
              onClick={() => setViewMode("markdown")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === "markdown"
                  ? "bg-white text-green-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Code size={14} />
              <span>Extracted RAG</span>
            </button>
          </div>

          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
            <X size={20}/>
          </button>
        </div>
        
        {/* Modal Body */}
        <div className="flex-1 overflow-hidden bg-slate-100 relative">
          {viewMode === "pdf" ? (
            /* --- Mode 1: Native PDF View --- */
            <iframe
              src={pdfUrl}
              title={fileData?.fileName}
              className="w-full h-full border-none"
            />
          ) : (
            /* --- Mode 2: Extracted Markdown View --- */
            <div className="h-full overflow-y-auto p-10 bg-white prose prose-slate max-w-none">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
                  <Loader2 className="animate-spin text-green-600" size={40} />
                  <p className="text-sm font-bold tracking-widest uppercase">Rendering RAG Markdown...</p>
                </div>
              ) : (
                <div className="markdown-container">
                  <div className="flex items-center gap-2 text-[10px] font-black text-green-600 bg-green-50 py-1.5 px-4 rounded-full w-fit mb-8 shadow-sm">
                    <ShieldCheck size={12} /> FORMATTED RAG CONTENT
                  </div>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {content || "No extracted text found."}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
          <p className="text-xs text-slate-400 font-semibold px-2">
            {viewMode === "pdf" ? "Viewing original stored PDF asset." : "Viewing parsed text chunks used for AI search."}
          </p>
          <button 
            onClick={onClose} 
            className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-2.5 rounded-2xl font-bold text-sm transition-all shadow-lg"
          >
            Close Preview
          </button>
        </div>

      </div>
    </div>
  );
};

export default PreviewModal;