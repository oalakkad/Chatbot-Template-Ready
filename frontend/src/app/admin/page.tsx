'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
    Users, MessageSquare, FileText, Search,
    LogOut, Send, User as UserIcon, Shield,
    CheckCircle, AlertCircle, Clock, Plus, X, Database, Upload, File, Trash2, Loader2
} from 'lucide-react';

interface User {
    id: number;
    full_name: string;
    email: string;
    phone: string;
    department: string;
    role: string;
}

interface ChatMessage {
    sender: string;
    text: string;
    timestamp: string;
}

interface SessionData {
    session_id: string;
    status: string; // 'NEEDS_ATTENTION', 'ACTIVE', 'IDLE'
    user_name?: string;
    user_dept?: string;
}

export default function AdminPage() {
    // Auth State
    const [token, setToken] = useState<string>('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('admin123');
    const [adminInfo, setAdminInfo] = useState<{ name: string, role: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Data State
    const [view, setView] = useState<'users' | 'live' | 'logs' | 'knowledge'>('live');
    const [users, setUsers] = useState<User[]>([]);
    const [sessions, setSessions] = useState<SessionData[]>([]);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [selectedSession, setSelectedSession] = useState<string | null>(null);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [replyText, setReplyText] = useState('');

    // Knowledge Base Upload State
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });


    const [searchQuery, setSearchQuery] = useState('');

    // Modal State
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [newUser, setNewUser] = useState({ full_name: '', email: '', phone: '', password: '', department: '', role: 'user' });
    const [incomingSession, setIncomingSession] = useState<SessionData | null>(null);
    const [processing, setProcessing] = useState(false);

    // Refs
    const chatEndRef = useRef<HTMLDivElement>(null);
    const prevAttentionCount = useRef(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Toast State
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleUploadConfirm = async () => {
        if (filesToUpload.length === 0 || processing) return;

        setProcessing(true);
        setUploadProgress({ current: 0, total: filesToUpload.length });

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < filesToUpload.length; i++) {
            setUploadProgress(prev => ({ ...prev, current: i + 1 }));
            const file = filesToUpload[i];
            const formData = new FormData();
            formData.append('file', file);

            try {
                const res = await fetch('http://127.0.0.1:8000/admin/knowledge/upload', {
                    method: 'POST',
                    body: formData,
                });
                if (res.ok) {
                    successCount++;
                } else {
                    failCount++;
                    console.error(`Failed to upload ${file.name}`);
                }
            } catch (err) {
                console.error(err);
                failCount++;
            }
        }

        setProcessing(false);
        setFilesToUpload([]);
        setShowUploadModal(false);
        fetchDocuments();

        if (failCount === 0) {
            showToast(`Successfully uploaded ${successCount} documents!`, "success");
        } else {
            showToast(`Uploaded ${successCount} files. ${failCount} failed.`, "error");
        }
    };


    useEffect(() => {
        audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); // Simple ping sound

        // Restore session
        const storedToken = localStorage.getItem('adminToken');
        const storedUser = localStorage.getItem('adminInfo');
        if (storedToken) setToken(storedToken);
        if (storedUser) {
            try {
                setAdminInfo(JSON.parse(storedUser));
            } catch (e) {
                console.error("Failed to parse admin info", e);
            }
        }
    }, []);

    // --- AUTHENTICATION ---
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const res = await fetch('http://127.0.0.1:8000/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            if (res.ok) {
                const data = await res.json();
                setToken(data.token);
                setAdminInfo(data.user);
                localStorage.setItem('adminToken', data.token); // Save token
                localStorage.setItem('adminInfo', JSON.stringify(data.user)); // Save user info

                // Initial Fetch
                fetchUsers();
                fetchSessions();
            } else {
                alert('Invalid credentials');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    // Restore Session
    useEffect(() => {
        const storedToken = localStorage.getItem('adminToken');
        const storedInfo = localStorage.getItem('adminInfo');

        if (storedToken) {
            setToken(storedToken);
            // If info is missing, fetch it from backend to fix "Administrator" placeholder
            if (!storedInfo) {
                fetch('http://127.0.0.1:8000/admin/me', {
                    headers: { 'Authorization': storedToken }
                })
                    .then(res => res.json())
                    .then(data => {
                        if (data.name) {
                            setAdminInfo(data);
                            localStorage.setItem('adminInfo', JSON.stringify(data));
                        }
                    })
                    .catch(e => console.error("Could not recover profile:", e));
            }
        }
        if (storedInfo) {
            setAdminInfo(JSON.parse(storedInfo));
        }
    }, []);

    // --- DATA FETCHING ---
    const fetchUsers = async () => {
        try { const res = await fetch('http://127.0.0.1:8000/users'); setUsers(await res.json()); } catch (e) { }
    };

    const fetchDocuments = async () => {
        try {
            const res = await fetch('http://127.0.0.1:8000/admin/knowledge/files');
            const data = await res.json();
            setDocuments(data);
        } catch (e) {
            console.error("Failed to fetch documents");
        }
    };

    const deleteDocument = async (id: number, filename: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Document',
            message: `Are you sure you want to delete "${filename}"? This action cannot be undone.`,
            onConfirm: async () => {
                setProcessing(true);
                try {
                    const res = await fetch(`http://127.0.0.1:8000/admin/knowledge/delete/${id}`, {
                        method: 'DELETE'
                    });
                    if (res.ok) {
                        showToast("Document deleted successfully", "success");
                        fetchDocuments();
                        setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    } else {
                        showToast("Failed to delete document", "error");
                    }
                } catch (e) {
                    showToast("Network error during delete", "error");
                } finally {
                    setProcessing(false);
                }
            }
        });
    };

    const fetchSessions = async () => {
        try {
            const res = await fetch('http://127.0.0.1:8000/admin/sessions');
            const data = await res.json();
            setSessions(data);

            // Check for new attention needed (excluding currently open session)
            const currentAttentionCount = data.filter((s: SessionData) =>
                s.status === 'NEEDS_ATTENTION' && s.session_id !== selectedSession
            ).length;

            if (currentAttentionCount > prevAttentionCount.current) {
                // Play sound only if it's a NEW request not currently being viewed
                audioRef.current?.play().catch(() => { });
            }
            prevAttentionCount.current = currentAttentionCount;
        } catch (e) {
            console.error("Failed to fetch sessions");
        }
    };

    useEffect(() => {
        fetchSessions();
        const interval = setInterval(fetchSessions, 2000);
        return () => clearInterval(interval);
    }, []);

    // Poll documents when in knowledge view
    useEffect(() => {
        if (view === 'knowledge') {
            fetchDocuments();
            const interval = setInterval(fetchDocuments, 5000); // Auto-refresh documents
            return () => clearInterval(interval);
        }
        if (view === 'users') fetchUsers();
    }, [view]);



    const fetchChat = async (sid: string) => {
        try { const res = await fetch(`http://127.0.0.1:8000/admin/chat/${sid}`); setChatHistory(await res.json()); } catch (e) { }
    };

    // --- EFFECTS ---
    // Poll sessions active
    useEffect(() => {
        if (!token) return;
        const interval = setInterval(fetchSessions, 5000);
        return () => clearInterval(interval);
    }, [token]);

    // Poll active chat
    useEffect(() => {
        if (selectedSession) {
            fetchChat(selectedSession);
            const interval = setInterval(() => fetchChat(selectedSession), 2000);
            return () => clearInterval(interval);
        }
    }, [selectedSession]);

    // Scroll to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    // --- ACTIONS ---
    const sendReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyText || !selectedSession) return;

        await fetch('http://127.0.0.1:8000/admin/reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: selectedSession, message: replyText })
        });
        setReplyText('');
        fetchChat(selectedSession);
    };

    const endSession = async () => {
        if (!selectedSession) return;
        if (!confirm("Are you sure you want to end this session?")) return;

        // Optimistic Update: Immediately mark locally as ENDED to hide it from Live view
        setSessions(prev => prev.map(s =>
            s.session_id === selectedSession ? { ...s, status: 'ENDED' } : s
        ));

        const sessionIdToEnd = selectedSession;
        setSelectedSession(null); // Clear active view

        try {
            await fetch('http://127.0.0.1:8000/admin/session/end', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionIdToEnd, message: '' })
            });
            // Re-fetch to sync truth
            fetchSessions();
        } catch (e) {
            console.error("Failed to end session", e);
        }
    };

    const registerUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('http://127.0.0.1:8000/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newUser)
            });
            if (res.ok) {
                alert("User created successfully");
                setIsUserModalOpen(false);
                setNewUser({ full_name: '', email: '', phone: '', password: '', department: '', role: 'user' });
                fetchUsers();
            } else {
                alert("Failed to create user");
            }
        } catch (e) {
            console.error(e);
        }
    };

    const deleteUser = async (id: number, name: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete User',
            message: `Are you sure you want to delete user "${name}"? This action cannot be undone.`,
            onConfirm: async () => {
                setProcessing(true);
                try {
                    const res = await fetch(`http://127.0.0.1:8000/admin/users/${id}`, {
                        method: 'DELETE'
                    });
                    if (res.ok) {
                        showToast("User deleted successfully", "success");
                        fetchUsers();
                        setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    } else {
                        showToast("Failed to delete user", "error");
                    }
                } catch (e) {
                    showToast("Network error during delete", "error");
                } finally {
                    setProcessing(false);
                }
            }
        });
    };

    // --- FILTERING ---
    const filteredSessions = sessions.filter(s => {
        if (view === 'live') {
            // Live: Show Active, Needs Attention, and Idle (if not ended)
            return s.status !== 'ENDED';
        }
        if (view === 'logs') {
            // Logs: Show everything
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return s.session_id.toLowerCase().includes(q) ||
                    (s.user_name && s.user_name.toLowerCase().includes(q)) ||
                    (s.user_dept && s.user_dept.toLowerCase().includes(q));
            }
            return true;
        }
        return true;
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'NEEDS_ATTENTION': return 'bg-red-500/10 text-red-400 border-red-500/50';
            case 'ACTIVE': return 'bg-green-500/10 text-green-400 border-green-500/50';
            case 'IDLE': return 'bg-gray-500/10 text-gray-400 border-gray-500/50';
            default: return 'bg-gray-500/10 text-gray-400';
        }
    };

    // --- LOGIN SCREEN ---
    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0B0F19] text-white overflow-hidden relative">
                {/* Background Blobs */}
                <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600/20 rounded-full blur-[128px] -translate-x-1/2 -translate-y-1/2" />
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-violet-600/20 rounded-full blur-[128px] translate-x-1/2 translate-y-1/2" />

                <div className="relative w-full max-w-md p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
                    <div className="text-center mb-10">
                        <div className="mx-auto w-24 h-24 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4 overflow-hidden p-2">
                            {/* Placeholder for Al-Tijaria Logo - using a high-quality text representation or image if available */}
                            <img
                                src="/logo.jpg"
                                alt="Al-Tijaria Logo"
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight">AL-TIJARIA Admin</h1>
                        <p className="text-slate-400 text-sm mt-2">Enter your credentials to access the secure dashboard.</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Email Address</label>
                            <input
                                type="email"
                                className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="name@example.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Password</label>
                            <input
                                type="password"
                                className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                        </div>
                        <button
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-semibold py-3.5 rounded-lg shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] disabled:opacity-70"
                        >
                            {isLoading ? 'Authenticating...' : 'Sign In'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // --- MAIN DASHBOARD ---
    return (
        <main className="flex h-screen bg-[#0B0F19] text-slate-200 font-sans overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-900/50 border-r border-white/5 flex flex-col backdrop-blur-xl z-10">
                <div className="p-6 flex items-center gap-3 border-b border-white/5">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center overflow-hidden p-1 shadow-lg shadow-blue-500/20">
                        <img
                            src="/logo.jpg"
                            alt="Logo"
                            className="w-full h-full object-contain"
                        />
                    </div>
                    <span className="font-bold text-lg tracking-tight text-white">AL-TIJARIA Admin</span>
                </div>

                <nav className="space-y-4">
                    <button
                        onClick={() => setView('live')}
                        className={`w-full flex items-center space-x-3 p-4 rounded-xl transition-all ${view === 'live' ? 'bg-blue-600 shadow-lg shadow-blue-900/40 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                    >
                        <MessageSquare size={20} />
                        <span className="font-medium">Live Support</span>
                    </button>
                    <button
                        onClick={() => setView('users')}
                        className={`w-full flex items-center space-x-3 p-4 rounded-xl transition-all ${view === 'users' ? 'bg-blue-600 shadow-lg shadow-blue-900/40 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                    >
                        <Users size={20} />
                        <span className="font-medium">User Management</span>
                    </button>
                    <button
                        onClick={() => setView('logs')}
                        className={`w-full flex items-center space-x-3 p-4 rounded-xl transition-all ${view === 'logs' ? 'bg-blue-600 shadow-lg shadow-blue-900/40 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                    >
                        <FileText size={20} />
                        <span className="font-medium">Chat Logs</span>
                    </button>
                    <button
                        onClick={() => setView('knowledge')}
                        className={`w-full flex items-center space-x-3 p-4 rounded-xl transition-all ${view === 'knowledge' ? 'bg-blue-600 shadow-lg shadow-blue-900/40 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                    >
                        <Database size={20} />
                        <span className="font-medium">Knowledge Base</span>
                    </button>
                </nav>

                <div className="flex-1" />

                {/* Sidebar Profile Card */}
                <div className="m-4 p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3 shadow-xl backdrop-blur-md">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20 shrink-0">
                        {(adminInfo?.name || 'A').charAt(0)}
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-sm font-bold text-white truncate leading-tight">
                            {adminInfo?.name || 'Administrator'}
                        </p>
                        <p className="text-[10px] text-blue-400 uppercase tracking-widest mt-1 font-semibold">
                            {adminInfo?.role || 'Support'}
                        </p>
                    </div>
                </div>

                <div className="p-4 border-t border-white/5">
                    <button onClick={() => {
                        setToken('');
                        setAdminInfo(null);
                        localStorage.removeItem('adminToken');
                        localStorage.removeItem('adminInfo');
                    }} className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-sm px-4">
                        <LogOut size={16} />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Content Area */}
            <div className="flex-1 flex flex-col relative">
                {/* Background Gradients */}
                <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />

                {/* Header */}
                <header className="h-16 border-b border-white/5 flex items-center px-8 justify-between shrink-0 bg-[#0B0F19]/80 backdrop-blur-md z-10">
                    <h2 className="text-lg font-bold text-white">
                        {view === 'live' && 'Live Support Queue'}
                        {view === 'users' && 'User Management'}
                        {view === 'logs' && 'Session History'}
                    </h2>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-xs text-slate-400 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            System Operational
                        </div>
                    </div>
                </header>


                {/* INCOMING REQUEST MODAL */}
                {incomingSession && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-slate-900 border border-blue-500/30 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-center">
                                <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-3 animate-bounce">
                                    <AlertCircle size={32} className="text-white" />
                                </div>
                                <h3 className="text-xl font-bold text-white">Incoming Request!</h3>
                                <p className="text-blue-100 text-sm mt-1">A user is waiting for support.</p>
                            </div>
                            <div className="p-6 text-center">
                                <h4 className="font-bold text-white text-lg">{incomingSession.user_name || 'Guest User'}</h4>
                                <p className="text-slate-400 text-sm mb-6">{incomingSession.user_dept || 'General Department'}</p>

                                <div className="space-y-3">
                                    <button
                                        onClick={async () => {
                                            // 1. Auto-greet logic FIRST
                                            const agentName = adminInfo?.name || 'Support Agent';
                                            console.log("[DEBUG] Accepting chat. Agent:", agentName, "Session:", incomingSession.session_id);
                                            const greeting = `Hello, I am ${agentName} from AL-TIJARIA. How can I help you today?`;

                                            try {
                                                const res = await fetch('http://127.0.0.1:8000/admin/reply', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        session_id: incomingSession.session_id,
                                                        message: greeting,
                                                        agent_name: agentName
                                                    })
                                                });
                                                const data = await res.json();
                                                console.log("[DEBUG] Greeting sent response:", data);
                                            } catch (err) {
                                                console.error("[DEBUG] Failed to send auto-greeting", err);
                                            }

                                            // 2. THEN open the view (triggers history fetch)
                                            console.log("[DEBUG] Switching view to live...");
                                            setSelectedSession(incomingSession.session_id);
                                            setView('live');
                                            setIncomingSession(null);
                                        }}
                                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20"
                                    >
                                        Accept & Open Chat
                                    </button>
                                    <button
                                        onClick={() => setIncomingSession(null)}
                                        className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 rounded-xl transition-all"
                                    >
                                        Accept (Stay Here)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-6 relative z-0">

                    {/* USERS VIEW */}
                    {view === 'users' && (
                        <div className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden shadow-xl p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-semibold text-white">All Registered Users</h3>
                                <button
                                    onClick={() => setIsUserModalOpen(true)}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all"
                                >
                                    <Plus size={16} />
                                    Add New User
                                </button>
                            </div>
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="p-5 font-semibold">Full Name</th>
                                        <th className="p-5 font-semibold">Email</th>
                                        <th className="p-5 font-semibold">Phone</th>
                                        <th className="p-5 font-semibold">Dept</th>
                                        <th className="p-5 font-semibold">Role</th>
                                        <th className="p-5 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-sm text-slate-300">
                                    {users.map(u => (
                                        <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="p-5 font-medium text-white flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-xs font-bold">
                                                    {u.full_name.charAt(0)}
                                                </div>
                                                {u.full_name}
                                            </td>
                                            <td className="p-5">{u.email}</td>
                                            <td className="p-5 font-mono text-xs">{u.phone}</td>
                                            <td className="p-5">{u.department}</td>
                                            <td className="p-5">
                                                <span className={`px-2 py-1 rounded text-xs border ${u.role === 'admin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/50' : 'bg-slate-800 border-white/10'}`}>
                                                    {u.role.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="p-5 text-right">
                                                <button
                                                    onClick={() => deleteUser(u.id, u.full_name)}
                                                    className="p-2 text-slate-500 hover:text-red-500 transition-colors"
                                                    title="Delete User"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* LIVE & LOGS VIEW */}
                    {(view === 'live' || view === 'logs') && (
                        <div className="flex h-full gap-6">
                            {/* Session List */}
                            <div className="w-80 flex flex-col bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden shrink-0 shadow-xl backdrop-blur-sm">
                                <div className="p-4 border-b border-white/5">
                                    {view === 'logs' && (
                                        <div className="relative mb-2">
                                            <Search className="absolute left-3 top-2.5 text-slate-500 w-4 h-4" />
                                            <input
                                                className="w-full bg-black/20 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500/50 transition-colors placeholder-slate-600"
                                                placeholder="Search session ID..."
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                            />
                                        </div>
                                    )}
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                        {view === 'live' ? 'Active Conversations' : 'History'}
                                    </h3>
                                </div>

                                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                    {filteredSessions.length === 0 && (
                                        <div className="text-center p-8 text-slate-500 text-sm">
                                            No sessions found.
                                        </div>
                                    )}
                                    {filteredSessions.map(session => (
                                        <div
                                            key={session.session_id}
                                            onClick={() => setSelectedSession(session.session_id)}
                                            className={`p-3 rounded-xl cursor-pointer border transition-all ${selectedSession === session.session_id
                                                ? 'bg-blue-600/10 border-blue-600/50 shadow-md'
                                                : 'bg-transparent border-transparent hover:bg-white/5'
                                                }`}
                                        >
                                            <div className="flex justify-between items-center mb-1.5">
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${getStatusColor(session.status)}`}>
                                                    {session.status === 'NEEDS_ATTENTION' ? '🔥 HELP' : session.status}
                                                </span>
                                                <span className="text-[10px] text-slate-500 font-mono">
                                                    {session.session_id.slice(0, 4)}
                                                </span>
                                            </div>
                                            <div className="text-sm font-bold text-slate-200 truncate">
                                                {session.user_name || 'Guest User'}
                                            </div>
                                            <div className="text-xs text-slate-400 truncate font-mono">
                                                {session.user_dept || 'General'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Chat Window */}
                            <div className="flex-1 bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden shadow-xl flex flex-col backdrop-blur-sm">
                                {selectedSession ? (
                                    <>
                                        {/* Chat Header */}
                                        <div className="p-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-white/10">
                                                    <UserIcon className="w-5 h-5 text-slate-400" />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-bold text-white">Session {selectedSession.slice(0, 8)}...</h3>
                                                    <p className="text-xs text-slate-400">Connection Secure</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={endSession}
                                                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg text-xs font-bold transition-colors"
                                            >
                                                End Session
                                            </button>
                                        </div>

                                        {/* Messages */}
                                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-black/10">
                                            {chatHistory.map((msg, i) => (
                                                <div key={i} className={`flex flex-col ${msg.sender === 'user' ? 'items-start' : 'items-end'}`}>
                                                    <div className={`max-w-[80%] rounded-2xl px-5 py-3 text-sm shadow-md ${msg.sender === 'user'
                                                        ? 'bg-slate-800 text-slate-200 rounded-tl-none border border-white/5'
                                                        : msg.sender === 'admin'
                                                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none'
                                                            : 'bg-indigo-900/50 text-indigo-100 border border-indigo-500/20' // AI
                                                        }`}>
                                                        {msg.text}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{msg.sender}</span>
                                                        <span className="text-[10px] text-slate-600">
                                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                            <div ref={chatEndRef} />
                                        </div>

                                        {/* Input */}
                                        <form onSubmit={async (e) => {
                                            e.preventDefault();
                                            if (!replyText.trim() || !selectedSession) return;

                                            try {
                                                const agentName = adminInfo?.name || 'Support Agent';
                                                await fetch('http://127.0.0.1:8000/admin/reply', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        session_id: selectedSession,
                                                        message: replyText,
                                                        agent_name: agentName
                                                    })
                                                });
                                                setReplyText('');
                                                // Optimistic update
                                                const newMsg = {
                                                    sender: 'admin',
                                                    text: replyText,
                                                    timestamp: new Date().toISOString()
                                                };
                                                setChatHistory(prev => [...prev, newMsg]);
                                            } catch (err) {
                                                console.error(err);
                                            }
                                        }} className="p-4 border-t border-white/5 bg-white/[0.02] flex gap-3">
                                            <input
                                                className="flex-1 bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors placeholder-slate-600"
                                                placeholder="Type your reply here..."
                                                value={replyText}
                                                onChange={e => setReplyText(e.target.value)}
                                            />
                                            <button className="bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20 hover:scale-105 active:scale-95">
                                                <Send size={18} />
                                                Send
                                            </button>
                                        </form>
                                    </>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                                        <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                                            <MessageSquare className="w-8 h-8 opacity-50" />
                                        </div>
                                        <p>Select a session to view conversation</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* CREATE USER MODAL */}
                    {isUserModalOpen && (
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                            <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                                    <h3 className="font-bold text-white text-lg">Create New User Accounts</h3>
                                    <button onClick={() => setIsUserModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>
                                <form onSubmit={registerUser} className="p-6 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-slate-400 ml-1">Full Name</label>
                                            <input
                                                required
                                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50"
                                                value={newUser.full_name}
                                                onChange={e => setNewUser({ ...newUser, full_name: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-slate-400 ml-1">Phone</label>
                                            <input
                                                required
                                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50"
                                                value={newUser.phone}
                                                onChange={e => setNewUser({ ...newUser, phone: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-400 ml-1">Email Address</label>
                                        <input
                                            required
                                            type="email"
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50"
                                            value={newUser.email}
                                            onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-400 ml-1">Password</label>
                                        <input
                                            required
                                            type="password"
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50"
                                            value={newUser.password}
                                            onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-slate-400 ml-1">Department</label>
                                            <input
                                                required
                                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50"
                                                value={newUser.department}
                                                onChange={e => setNewUser({ ...newUser, department: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-slate-400 ml-1">Role</label>
                                            <select
                                                className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50 text-slate-200 cursor-pointer"
                                                value={newUser.role}
                                                onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                            >
                                                <option value="user" className="bg-slate-900 text-white">User</option>
                                                <option value="agent" className="bg-slate-900 text-white">Support Agent</option>
                                                <option value="admin" className="bg-slate-900 text-white">Admin</option>
                                            </select>
                                        </div>
                                    </div>
                                    <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl mt-4 transition-colors shadow-lg">
                                        Create Account
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}


                    {view === 'knowledge' && (
                        <div className="max-w-6xl mx-auto space-y-8">
                            <div>
                                <h2 className="text-3xl font-bold mb-2">Knowledge Base</h2>
                                <p className="text-slate-400">Manage documents for AI Retrieval (RAG).</p>
                            </div>

                            {/* UPLOAD CONFIRMATION MODAL */}
                            {showUploadModal && filesToUpload.length > 0 && (
                                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-fade-in">
                                        <div className="flex items-center gap-4 mb-4 text-blue-400">
                                            <div className="p-3 bg-blue-500/20 rounded-full">
                                                <Upload size={24} />
                                            </div>
                                            <h3 className="text-xl font-bold text-white">Confirm Batch Upload</h3>
                                        </div>

                                        <div className="space-y-4 mb-8">
                                            <div className="p-4 bg-slate-800 rounded-xl border border-slate-700 max-h-48 overflow-y-auto">
                                                <p className="text-sm text-slate-400 mb-2 sticky top-0 bg-slate-800 pb-2 border-b border-slate-700">
                                                    {filesToUpload.length} Documents Selected
                                                </p>
                                                <ul className="space-y-2">
                                                    {filesToUpload.map((f, i) => (
                                                        <li key={i} className="font-mono text-sm text-white truncate flex items-center gap-2">
                                                            <FileText size={14} className="text-slate-500 shrink-0" />
                                                            {f.name}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            <div className="flex gap-2 text-sm text-slate-300">
                                                <AlertCircle size={16} className="text-blue-400 mt-0.5 shrink-0" />
                                                <p>These documents will be indexed and immediately available for the Chatbot.</p>
                                            </div>
                                        </div>

                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => {
                                                    if (!processing) {
                                                        setShowUploadModal(false);
                                                        setFilesToUpload([]);
                                                    }
                                                }}
                                                disabled={processing}
                                                className="flex-1 py-3 rounded-xl font-medium text-slate-300 hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleUploadConfirm}
                                                disabled={processing}
                                                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                            >
                                                {processing ? (
                                                    <>
                                                        <Loader2 size={18} className="animate-spin" />
                                                        {uploadProgress.current}/{uploadProgress.total}
                                                    </>
                                                ) : (
                                                    "Yes, Upload All"
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* UPLOAD CARD */}
                            <div className="bg-slate-800/50 border border-slate-700 rounded-3xl p-8 backdrop-blur-xl transition-all hover:bg-slate-800/70 border-dashed border-2 relative">
                                <input
                                    type="file"
                                    accept=".pdf"
                                    multiple
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            setFilesToUpload(Array.from(e.target.files));
                                            setShowUploadModal(true);
                                            e.target.value = ''; // Reset
                                        }
                                    }}
                                />
                                <div className="flex flex-col items-center justify-center text-center space-y-4">
                                    <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center">
                                        <Upload size={32} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">Upload New Documents</h3>
                                        <p className="text-slate-400 mt-2">Drag and drop your PDFs here, or click to browse.</p>
                                    </div>
                                    <span className="px-3 py-1 bg-slate-700 text-xs text-slate-300 rounded-full">PDF Only • Batch Upload Support</span>
                                </div>
                            </div>

                            {/* DOCUMENT LIST */}
                            <div className="bg-slate-800/50 border border-slate-700 rounded-3xl backdrop-blur-xl mb-8">
                                <div className="p-6 border-b border-slate-700 flex justify-between items-center shrink-0">
                                    <h3 className="font-bold text-lg flex items-center gap-2">
                                        <Database size={20} className="text-blue-400" />
                                        Indexed Documents
                                    </h3>
                                    <span className="text-xs text-slate-500">{documents.length} Documents</span>
                                </div>

                                <div>
                                    {documents.length === 0 ? (
                                        <div className="p-12 text-center text-slate-500">
                                            <File size={48} className="mx-auto mb-4 opacity-50" />
                                            <p>No documents indexed yet.</p>
                                            <p className="text-sm mt-1">Upload a PDF to get started.</p>
                                        </div>
                                    ) : (
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase">
                                                <tr>
                                                    <th className="px-6 py-4">Status</th>
                                                    <th className="px-6 py-4">Filename</th>
                                                    <th className="px-6 py-4">Chunks</th>
                                                    <th className="px-6 py-4">Date</th>
                                                    <th className="px-6 py-4">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-700 text-sm md:text-base">
                                                {documents.map((doc: any) => (
                                                    <tr key={doc.id} className="hover:bg-white/5 transition-colors">
                                                        <td className="px-6 py-4">
                                                            {doc.status === 'READY' ? (
                                                                <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded-md text-xs font-bold border border-green-500/30">READY</span>
                                                            ) : doc.status === 'INDEXING' ? (
                                                                <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded-md text-xs font-bold border border-blue-500/30 animate-pulse">INDEXING...</span>
                                                            ) : (
                                                                <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded-md text-xs font-bold border border-red-500/30">ERROR</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 font-medium text-white flex items-center gap-2">
                                                            <FileText size={16} className="text-slate-400" />
                                                            {doc.filename}
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-300">
                                                            {doc.chunk_count} Chunks
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-400 text-xs">
                                                            {new Date(doc.upload_date).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <button
                                                                onClick={() => deleteDocument(doc.id, doc.filename)}
                                                                className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                                                                title="Delete Document"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    {/* TOAST NOTIFICATION */}
                    {toast && (
                        <div className={`fixed bottom-8 right-8 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in z-50 ${toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                            }`}>
                            {toast.type === 'success' ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
                            <p className="font-semibold">{toast.message}</p>
                        </div>
                    )}

                    {/* CONFIRMATION MODAL */}
                    {confirmModal.isOpen && (
                        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
                            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-scale-in">
                                <div className="flex items-center gap-3 text-red-500 mb-4">
                                    <div className="p-3 bg-red-500/10 rounded-full">
                                        <AlertCircle size={24} />
                                    </div>
                                    <h3 className="text-xl font-bold text-white">{confirmModal.title}</h3>
                                </div>

                                <p className="text-slate-300 mb-8 leading-relaxed">
                                    {confirmModal.message}
                                </p>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => !processing && setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                                        disabled={processing}
                                        className="flex-1 py-3 rounded-xl font-medium text-slate-300 hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmModal.onConfirm}
                                        disabled={processing}
                                        className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {processing ? (
                                            <>
                                                <Loader2 size={18} className="animate-spin" />
                                                Deleting...
                                            </>
                                        ) : (
                                            "Delete"
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div >
        </main >
    );
}
