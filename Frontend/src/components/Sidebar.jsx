import React from 'react';
import { NavLink as RouterNavLink, useParams } from 'react-router-dom';
import { useAuthStore } from '../authStore';
import { 
    LayoutDashboard, 
    FolderOpen, 
    MessageSquare, 
    GraduationCap, 
    User, 
    LogOut,
    BookOpenCheck,
    CircleDot,
    Brain
} from 'lucide-react';

const NavLink = ({ to, icon, children, badge }) => (
    <RouterNavLink
        to={to}
        end={to === "/app/dashboard"} 
        className={({ isActive }) =>
            `flex items-center justify-between p-3 my-1 rounded-xl transition-all duration-200 ${
                isActive 
                ? 'bg-green-600 text-white font-bold shadow-lg shadow-green-900/40' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`
        }
    >
        <div className="flex items-center">
            {icon}
            <span className="ml-4 text-sm">{children}</span>
        </div>
        {badge && (
            <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/20 font-bold">
                {badge}
            </span>
        )}
    </RouterNavLink>
);

export default function Sidebar() {
    const logout = useAuthStore((state) => state.logout);
    const user = useAuthStore((state) => state.user);
    const { subjectId } = useParams(); 
    
    const currentId = subjectId || "1";
    const userName = user?.full_name || user?.name || "User";
    const avatarInitial = userName.charAt(0).toUpperCase();

    return (
        <div className="h-screen w-72 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
            
            {/* Header: Project Branding */}
            <div className="p-8 border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="bg-green-600 p-2 rounded-xl shadow-lg shadow-green-900/20">
                        <BookOpenCheck className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white tracking-tight">AskMyNotes</h1>
                        <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest">AI Study Hub</p>
                    </div>
                </div>
            </div>

            {/* Navigation Section */}
            <nav className="flex-1 p-4 space-y-8 overflow-y-auto custom-scrollbar">
                <div>
                    <h2 className="px-4 mb-3 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                        Workspace
                    </h2>
                    <NavLink to="/app/dashboard" icon={<LayoutDashboard size={20} />}>
                        Dashboard
                    </NavLink>
                    <NavLink to="/app/notes" icon={<FolderOpen size={20} />}>
                        My Library
                    </NavLink>
                </div>

                <div>
                    <h2 className="px-4 mb-3 text-[10px] font-black text-green-500 uppercase tracking-[0.2em] flex items-center gap-2">
                        Learning Hub {subjectId && <CircleDot size={8} className="animate-pulse" />}
                    </h2>
                    
                    <NavLink 
                        to={`/app/hub/${currentId}`} 
                        icon={<MessageSquare size={20} />}
                        badge="Voice"
                    >
                        Chat with Notes
                    </NavLink>
                    
                    <NavLink to={`/app/study/${currentId}`} icon={<GraduationCap size={20} />}>
                        Study Mode
                    </NavLink>

                    <NavLink to={`/app/flashcards/${currentId}`} icon={<Brain size={20} />}>
                        Smart Recall
                    </NavLink>
                </div>
            </nav>

            {/* Footer Section with User Name */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-3 px-3 py-2 mb-2 rounded-xl bg-slate-800/50">
                    <div className="w-8 h-8 rounded-lg bg-green-600 text-white flex items-center justify-center font-black text-sm">
                        {avatarInitial}
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-xs font-black text-white truncate">{userName}</p>
                        <p className="text-[9px] text-slate-400 font-bold truncate">{user?.email || ""}</p>
                    </div>
                </div>

                <div className="space-y-1">
                    <NavLink to="/app/profile" icon={<User size={20} />}>
                        My Profile
                    </NavLink>
                    
                    <button 
                        onClick={logout}
                        className="w-full flex items-center p-3 my-1 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all font-bold"
                    >
                        <LogOut size={20} />
                        <span className="ml-4 text-sm">Log Out</span>
                    </button>
                </div>
            </div>
        </div>
    );
}