'use client';

import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Message } from '../types';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { MessageCircle, X, Minimize2, Loader2, Phone, Power, User } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import CallingOverlay from './CallingOverlay';

export default function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const sessionIdRef = useRef<string>('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isCalling, setIsCalling] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    useEffect(() => {
        if (!sessionIdRef.current) {
            // Retrieve or generate
            const stored = localStorage.getItem('chat_session_id');
            if (stored) sessionIdRef.current = stored;
            else {
                sessionIdRef.current = uuidv4();
                localStorage.setItem('chat_session_id', sessionIdRef.current);
            }
        }
    }, []);

    // POLLING LOGIC
    useEffect(() => {
        if (!isOpen) return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch('http://127.0.0.1:8000/chat/poll', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: sessionIdRef.current })
                });
                if (res.ok) {
                    const data = await res.json();

                    if (data.session_ended) {
                        localStorage.removeItem('chat_session_id');
                        sessionIdRef.current = uuidv4();
                        localStorage.setItem('chat_session_id', sessionIdRef.current);
                        setIsAgentActive(false);
                        setMessages((prev) => [
                            ...prev,
                            { id: uuidv4(), text: "Session ended by agent. Starting new chat...", sender: 'ai', timestamp: new Date() }
                        ]);
                        return; // Stop processing other messages if session ended
                    }

                    if (data.active_agent) {
                        setIsAgentActive(true);
                        if (data.agent_name) setAgentName(data.agent_name);
                    }

                    if (data.has_new && data.messages.length > 0) {
                        setMessages(prev => {
                            let newPrev = [...prev];
                            data.messages.forEach((m: any) => {
                                // De-duplicate: If an AI message matches or is a subset of what we already have, skip it.
                                const isDup = (m.sender === 'ai' || m.sender === 'admin') && newPrev.some(em =>
                                    em.sender === 'ai' &&
                                    em.text.length > 0 &&
                                    (m.text.trim() === em.text.trim() || m.text.includes(em.text.trim()) || em.text.includes(m.text.trim()))
                                );
                                if (!isDup) {
                                    newPrev.push({
                                        id: uuidv4(),
                                        text: m.text,
                                        sender: m.sender === 'admin' ? 'ai' : m.sender,
                                        timestamp: m.timestamp ? new Date(m.timestamp) : new Date()
                                    });
                                }
                            });
                            return newPrev;
                        });
                    }
                }
            } catch (e) {
                // ignore polling errors
            }
        }, 3000); // Check every 3s

        return () => clearInterval(interval);
    }, [isOpen]);

    const hasGreeted = useRef(false);
    const [isAgentActive, setIsAgentActive] = useState(false);
    const [agentName, setAgentName] = useState<string | null>(null);

    const handleOpen = () => {
        setIsOpen(true);
        if (!hasGreeted.current && messages.length === 0) {
            hasGreeted.current = true;
            sendMessage('');
        }
    };

    const sendMessage = async (text: string) => {
        if (!text && messages.length > 0) return;

        const newMessage: Message | null = text ? {
            id: uuidv4(),
            text: text,
            sender: 'user',
            timestamp: new Date(),
        } : null;

        if (newMessage) {
            setMessages(prev => [...prev, newMessage]);
        }

        setIsLoading(true);

        if (isAgentActive) {
            try {
                await fetch('http://127.0.0.1:8000/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session_id: sessionIdRef.current,
                        message: text,
                    }),
                });
            } catch (error) {
                console.error('Agent message error:', error);
            } finally {
                setIsLoading(false);
            }
            return;
        }

        // Prepare bot message placeholder
        const botMessageId = uuidv4();
        let fullBotText = "";

        try {
            const response = await fetch('http://127.0.0.1:8000/chat/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionIdRef.current,
                    message: text,
                }),
            });

            if (!response.ok) throw new Error('Stream request failed');

            // 1. Check if the response switched to takeover mode immediately
            // (Standard stream doesn't return JSON unless it's an error, 
            // but our backend yields the takeover response as the first chunk)

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response body');
            const decoder = new TextDecoder();

            // Add initial empty bot message with streaming flag
            setMessages(prev => [...prev, {
                id: botMessageId,
                text: "",
                sender: 'ai',
                timestamp: new Date(),
                isStreaming: true
            }]);

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                fullBotText += chunk;

                // Update the bot message in real-time
                setMessages(prev => prev.map(m =>
                    m.id === botMessageId ? { ...m, text: fullBotText } : m
                ));
            }

            // Once done, remove streaming flag and mark as streamed to avoid typewriter re-run
            setMessages(prev => prev.map(m =>
                m.id === botMessageId ? { ...m, isStreaming: false, wasStreamed: true } : m
            ));

            // Instant fallback: If the message looks like a takeover, set isAgentActive immediately
            if (fullBotText.toLowerCase().includes("connecting you to a human")) {
                setIsAgentActive(true);
            }

        } catch (error) {
            console.error('Streaming Error:', error);
            // Fallback for errors
            setMessages(prev => prev.map(m =>
                m.id === botMessageId ? { ...m, text: "I'm having trouble connecting right now. Please try again." } : m
            ));
        } finally {
            setIsLoading(false);
        }
    };

    const handleVoiceSend = async (audioBlob: Blob) => {
        setIsLoading(true);
        if (isCalling) setIsListening(false);

        const userMsgId = uuidv4();
        const botMsgId = uuidv4();

        // 1. Add User Message placeholder immediately
        setMessages(prev => [
            ...prev,
            {
                id: userMsgId,
                text: "🎤 Processing Voice Note...",
                sender: 'user',
                timestamp: new Date()
            }
        ]);

        // Only add AI placeholder if NO agent is active
        if (!isAgentActive) {
            setMessages(prev => [
                ...prev,
                {
                    id: botMsgId,
                    text: "",
                    sender: 'ai',
                    timestamp: new Date(),
                    isStreaming: true
                }
            ]);
        }

        const formData = new FormData();
        const extension = audioBlob.type.includes('webm') ? 'webm' : audioBlob.type.includes('ogg') ? 'ogg' : 'wav';
        formData.append('audio', audioBlob, `voice_note.${extension}`);
        formData.append('session_id', sessionIdRef.current);

        try {
            const res = await fetch('http://127.0.0.1:8000/chat/voice', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ detail: 'Unknown error' }));
                console.error("[VOICE_FATAL_ERROR] Backend returned error:", errorData);
                throw new Error(`Voice sync error: ${errorData.detail || 'Connection failed'}`);
            }

            const data = await res.json();

            // 2. Resolve placeholders with real data
            if (data.transcription) {
                setLastTranscription(data.transcription);
                // Clear after 8 seconds
                setTimeout(() => setLastTranscription(""), 8000);
            }

            setMessages(prev => prev.map(m => {
                if (m.id === userMsgId) return { ...m, text: data.transcription };
                if (m.id === botMsgId) return {
                    ...m,
                    text: data.response_text,
                    isStreaming: false,
                    wasStreamed: true,
                    timestamp: data.timestamp ? new Date(data.timestamp) : new Date()
                };
                return m;
            }));

            // Sync agent state immediately if response indicates takeover
            if (data.state === 'HUMAN_TAKEOVER') {
                setIsAgentActive(true);
            }

            // Play AI Voice
            if (data.audio_base64 && !isMuted) {
                if (isCalling) setIsSpeaking(true);
                const audio = new Audio(`data:audio/mp3;base64,${data.audio_base64}`);
                audioRef.current = audio;
                audio.volume = isMuted ? 0 : 1;
                audio.onended = () => {
                    setIsSpeaking(false);
                };
                await audio.play();
            } else if (isMuted && isCalling) {
                console.log('[CALL] Audio muted, skipping playback');
            }
        } catch (error) {
            console.error('Voice Error:', error);
            // Fallback for errors
            setMessages(prev => prev.map(m => {
                if (m.id === userMsgId) return { ...m, text: "🎤 (Voice processing failed)" };
                if (m.id === botMsgId) return { ...m, text: "I'm sorry, I couldn't process that voice note. Please try again.", isStreaming: false };
                return m;
            }));
        } finally {
            setIsLoading(false);
        }
    };

    const toggleCallListening = async () => {
        if (isListening) {
            console.log("[CALL] Stopping recording...");
            if (mediaRecorderRef.current) {
                mediaRecorderRef.current.stop();
                setIsListening(false);
            }
        } else {
            try {
                console.log("[CALL] Requesting microphone access...");
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                console.log("[CALL] Microphone access granted");
                const mediaRecorder = new MediaRecorder(stream);
                mediaRecorderRef.current = mediaRecorder;
                audioChunksRef.current = [];

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                        console.log("[CALL] Audio chunk received:", event.data.size, "bytes");
                    }
                };

                mediaRecorder.onstop = () => {
                    console.log("[CALL] Recording stopped, processing audio. Type:", mediaRecorder.mimeType);
                    const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
                    console.log("[CALL] Audio blob created:", audioBlob.size, "bytes");
                    handleVoiceSend(audioBlob);
                    stream.getTracks().forEach(track => track.stop());
                };

                mediaRecorder.start();
                setIsListening(true);
                console.log("[CALL] Recording started successfully");
            } catch (err) {
                console.error("[CALL] Microphone error:", err);
                alert("Microphone access denied or error occurred.");
            }
        }
    };
    const [showEndChatModal, setShowEndChatModal] = useState(false);

    const handleEndChat = () => {
        setShowEndChatModal(true);
    };

    const confirmEndChat = async () => {
        setShowEndChatModal(false);
        try {
            await fetch('http://127.0.0.1:8000/chat/end', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionIdRef.current })
            });

            // Generate new session ID for next time
            localStorage.removeItem('chat_session_id');
            const newId = uuidv4();
            sessionIdRef.current = newId;
            localStorage.setItem('chat_session_id', newId);

            // Reset UI
            setIsAgentActive(false);
            setMessages((prev) => [
                ...prev,
                { id: uuidv4(), text: "You have ended the chat.", sender: 'ai', timestamp: new Date() }
            ]);
            // Optional: Close widget after delay
            setTimeout(() => {
                setIsOpen(false);
                setMessages([]); // Clear history for new chat
            }, 1500);

        } catch (e) {
            console.error("Failed to end chat", e);
        }
    };

    const [lastTranscription, setLastTranscription] = useState<string>("");

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4 font-sans antialiased">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="w-[480px] h-[600px] bg-slate-900 rounded-2xl shadow-2xl shadow-blue-900/20 overflow-hidden border border-slate-700 flex flex-col"
                    >
                        {/* Header */}
                        <div className={`p-4 flex items-center justify-between shrink-0 transition-colors duration-500 ${isAgentActive ? 'bg-gradient-to-r from-purple-900 to-indigo-900' : 'bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900'} border-b border-white/5`}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white font-bold border border-white/30 overflow-hidden">
                                    {isAgentActive ? (
                                        <img
                                            src={`https://ui-avatars.com/api/?name=${agentName || 'Agent'}&background=random&color=fff`}
                                            alt="Agent"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-white flex items-center justify-center p-1">
                                            <img
                                                src="/logo.jpg"
                                                alt="Logo"
                                                className="w-full h-full object-contain"
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="text-white">
                                    <h3 className="font-bold text-base tracking-wide text-sky-100">{isAgentActive ? `${agentName || 'Agent'} - AL-TIJARIA` : 'AL-TIJARIA Help Desk'}</h3>
                                    <p className="text-xs text-sky-200/70 flex items-center gap-1.5 font-medium">
                                        <span className={`w-1.5 h-1.5 rounded-full ${isAgentActive ? 'bg-red-400 animate-pulse' : 'bg-green-400'}`}></span>
                                        {isAgentActive ? 'Connected to Human' : 'Online'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setIsCalling(true)}
                                    className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-full transition-colors"
                                    title="Call AI"
                                >
                                    <Phone size={18} />
                                </button>
                                <button
                                    onClick={handleEndChat}
                                    className="text-white/80 hover:text-white hover:bg-red-500/20 p-2 rounded-full transition-colors"
                                    title="End Chat"
                                >
                                    <Power size={18} />
                                </button>
                                <button
                                    onClick={() => {
                                        console.log('[CHAT] Minimizing, stopping audio');
                                        // Stop any playing audio
                                        if (audioRef.current) {
                                            audioRef.current.pause();
                                            audioRef.current.currentTime = 0;
                                        }
                                        setIsSpeaking(false);
                                        setIsOpen(false);
                                    }}
                                    className="text-white/60 hover:text-white hover:bg-white/10 p-2 rounded-full transition-colors"
                                    title="Minimize"
                                >
                                    <Minimize2 size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Calling UI */}
                        <CallingOverlay
                            isOpen={isCalling}
                            onHangUp={() => {
                                console.log('[CALL] Hanging up, stopping all audio');
                                // Stop any playing audio immediately
                                if (audioRef.current) {
                                    audioRef.current.pause();
                                    audioRef.current.currentTime = 0;
                                }
                                setIsCalling(false);
                                if (isListening && mediaRecorderRef.current) {
                                    mediaRecorderRef.current.onstop = null; // Prevent sending
                                    mediaRecorderRef.current.stop();
                                }
                                setIsListening(false);
                                setIsSpeaking(false);
                                setIsMuted(false); // Reset mute on hangup
                                setLastTranscription(""); // Clear debug info
                            }}
                            onToggleListening={toggleCallListening}
                            onToggleMute={() => setIsMuted(!isMuted)}
                            isListening={isListening}
                            isSpeaking={isSpeaking}
                            isProcessing={isLoading}
                            isMuted={isMuted}
                            agentName={isAgentActive ? "Support Agent" : "Help Desk AI"}
                            transcription={lastTranscription}
                        />

                        {/* Chat Area */}
                        <div className="flex-1 overflow-y-auto p-4 bg-[#0f172a] relative scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                            <div className="text-center text-xs text-slate-500 mb-6 mt-2">
                                <span className="bg-slate-800 px-3 py-1 rounded-full border border-slate-700/50">Today</span>
                            </div>

                            {messages.map((msg, index) => (
                                <ChatMessage
                                    key={msg.id}
                                    message={msg}
                                    isLatest={index === messages.length - 1}
                                    isAgentActive={isAgentActive}
                                    agentName={agentName}
                                />
                            ))}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Quick Actions */}
                        {messages.length > 0 && (
                            <div className="flex gap-2 px-4 pb-3 pt-2 overflow-x-auto bg-[#0f172a] scrollbar-none">
                                <button
                                    onClick={() => sendMessage("I have a general question about company policies.")}
                                    className="whitespace-nowrap px-3.5 py-2 bg-slate-800 text-sky-400 text-xs font-medium rounded-full border border-slate-700 hover:bg-slate-700 hover:border-sky-500/30 transition-all active:scale-95"
                                >
                                    General Questions
                                </button>
                                <button
                                    onClick={() => sendMessage("I need to talk to a human agent.")}
                                    className="whitespace-nowrap px-3.5 py-2 bg-slate-800 text-sky-400 text-xs font-medium rounded-full border border-slate-700 hover:bg-slate-700 hover:border-sky-500/30 transition-all active:scale-95"
                                >
                                    Talk to Help Desk
                                </button>
                            </div>
                        )}

                        {/* Input Area */}
                        <div className="p-0 border-t border-slate-800 bg-slate-900">
                            <ChatInput
                                onSend={sendMessage}
                                onVoiceSend={handleVoiceSend}
                                disabled={isLoading}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Custom End Chat Modal */}
            <AnimatePresence>
                {showEndChatModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
                        >
                            <h3 className="text-xl font-bold text-white mb-2">End Conversation?</h3>
                            <p className="text-slate-400 text-sm mb-6">
                                Are you sure you want to end this chat? This will clear your chat history.
                            </p>
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setShowEndChatModal(false)}
                                    className="px-4 py-2 rounded-lg text-slate-300 hover:bg-white/5 transition-colors text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmEndChat}
                                    className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium shadow-lg shadow-red-500/20"
                                >
                                    Yes, End Chat
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Floating Toggle Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={isOpen ? () => {
                    console.log('[CHAT] Closing widget, stopping audio');
                    // Stop any playing audio
                    if (audioRef.current) {
                        audioRef.current.pause();
                        audioRef.current.currentTime = 0;
                    }
                    setIsSpeaking(false);
                    setIsOpen(false);
                } : handleOpen}
                className={`w-14 h-14 rounded-full shadow-2xl shadow-blue-500/30 flex items-center justify-center text-white transition-all duration-300 ${isOpen ? 'bg-slate-700 rotate-90 border border-slate-600' : 'bg-gradient-to-tr from-sky-500 to-blue-600 border border-white/10'
                    }`}
            >
                {isOpen ? <X size={24} /> : <MessageCircle size={28} />}
            </motion.button>
        </div >
    );
}
