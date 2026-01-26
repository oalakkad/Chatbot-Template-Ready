'use client';

import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Message } from '../types';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { MessageCircle, X, Minimize2, Loader2, Phone } from 'lucide-react';
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
                    }

                    if (data.has_new && data.messages.length > 0) {
                        data.messages.forEach((m: any) => {
                            const newMsg: Message = {
                                id: uuidv4(),
                                text: m.text,
                                sender: m.sender === 'admin' ? 'ai' : m.sender,
                                timestamp: m.timestamp ? new Date(m.timestamp) : new Date()
                            };
                            setMessages(prev => [...prev, newMsg]);
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

        try {
            const response = await fetch('http://127.0.0.1:8000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionIdRef.current,
                    message: text,
                }),
            });

            if (!response.ok) throw new Error('Network response was not ok');

            const data = await response.json();

            if (data.response) {
                const botMessage: Message = {
                    id: uuidv4(),
                    text: data.response,
                    sender: 'ai',
                    timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
                };
                setMessages(prev => [...prev, botMessage]);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleVoiceSend = async (audioBlob: Blob) => {
        setIsLoading(true);
        if (isCalling) setIsListening(false);

        const formData = new FormData();
        formData.append('session_id', sessionIdRef.current);
        formData.append('audio', audioBlob, 'voice_note.wav');

        try {
            const res = await fetch('http://127.0.0.1:8000/chat/voice', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) throw new Error('Voice sync error');

            const data = await res.json();

            // Add user message to UI
            const userMsg: Message = {
                id: uuidv4(),
                text: data.transcription,
                sender: 'user',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, userMsg]);

            // Add AI message to UI
            const botMsg: Message = {
                id: uuidv4(),
                text: data.response_text,
                sender: 'ai',
                timestamp: data.timestamp ? new Date(data.timestamp) : new Date()
            };
            setMessages(prev => [...prev, botMsg]);

            // Play AI Voice
            if (data.audio_base64) {
                if (isCalling) setIsSpeaking(true);
                const audio = new Audio(`data:audio/mp3;base64,${data.audio_base64}`);
                audioRef.current = audio;
                audio.onended = () => {
                    setIsSpeaking(false);
                };
                await audio.play();
            }
        } catch (error) {
            console.error('Voice Error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleCallListening = async () => {
        if (isListening) {
            if (mediaRecorderRef.current) {
                mediaRecorderRef.current.stop();
                setIsListening(false);
            }
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mediaRecorder = new MediaRecorder(stream);
                mediaRecorderRef.current = mediaRecorder;
                audioChunksRef.current = [];

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) audioChunksRef.current.push(event.data);
                };

                mediaRecorder.onstop = () => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                    handleVoiceSend(audioBlob);
                    stream.getTracks().forEach(track => track.stop());
                };

                mediaRecorder.start();
                setIsListening(true);
            } catch (err) {
                console.error("Mic error:", err);
                alert("Microphone access denied or error occurred.");
            }
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4 font-sans antialiased">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="w-[380px] h-[600px] bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col"
                    >
                        {/* Header */}
                        <div className={`p-4 flex items-center justify-between shrink-0 transition-colors duration-500 ${isAgentActive ? 'bg-gradient-to-r from-purple-600 to-indigo-700' : 'bg-gradient-to-r from-blue-600 to-indigo-700'}`}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white font-bold border border-white/30">
                                    <span className="text-sm">{isAgentActive ? 'AG' : 'HD'}</span>
                                </div>
                                <div className="text-white">
                                    <h3 className="font-semibold text-base">{isAgentActive ? 'Live Agent Support' : 'Company Help Desk'}</h3>
                                    <p className="text-xs text-blue-100 opacity-90 flex items-center gap-1">
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
                                    onClick={() => setIsOpen(false)}
                                    className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-full transition-colors"
                                >
                                    <Minimize2 size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Calling UI */}
                        <CallingOverlay
                            isOpen={isCalling}
                            onHangUp={() => {
                                setIsCalling(false);
                                if (isListening && mediaRecorderRef.current) {
                                    mediaRecorderRef.current.onstop = null; // Prevent sending
                                    mediaRecorderRef.current.stop();
                                }
                                setIsListening(false);
                            }}
                            onToggleListening={toggleCallListening}
                            isListening={isListening}
                            isSpeaking={isSpeaking}
                            agentName={isAgentActive ? "Support Agent" : "Help Desk AI"}
                        />

                        {/* Chat Area */}
                        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50 relative">
                            <div className="text-center text-xs text-gray-400 mb-6 mt-2">
                                <span className="bg-gray-100 px-3 py-1 rounded-full">Today</span>
                            </div>

                            {messages.map((msg, index) => (
                                <ChatMessage
                                    key={msg.id}
                                    message={msg}
                                    isLatest={index === messages.length - 1}
                                />
                            ))}

                            {isLoading && (
                                <div className="flex justify-start mb-4">
                                    <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-none shadow-sm border border-gray-100 flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                                        <span className="text-xs text-gray-500">Processing...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Quick Actions */}
                        {messages.length > 0 && (
                            <div className="flex gap-2 px-4 pb-2 overflow-x-auto">
                                <button
                                    onClick={() => sendMessage("I have a general question about company policies.")}
                                    className="whitespace-nowrap px-3 py-1.5 bg-blue-50 text-blue-600 text-xs rounded-full border border-blue-100 hover:bg-blue-100 transition-colors"
                                >
                                    General Questions
                                </button>
                                <button
                                    onClick={() => sendMessage("I need to talk to a human agent.")}
                                    className="whitespace-nowrap px-3 py-1.5 bg-blue-50 text-blue-600 text-xs rounded-full border border-blue-100 hover:bg-blue-100 transition-colors"
                                >
                                    Talk to Help Desk
                                </button>
                            </div>
                        )}

                        {/* Input Area */}
                        <div className="p-0 border-t border-gray-100 bg-white">
                            <ChatInput
                                onSend={sendMessage}
                                onVoiceSend={handleVoiceSend}
                                disabled={isLoading}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Toggle Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={isOpen ? () => setIsOpen(false) : handleOpen}
                className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white transition-all duration-300 ${isOpen ? 'bg-gray-800 rotate-90' : 'bg-gradient-to-r from-blue-600 to-indigo-600'
                    }`}
            >
                {isOpen ? <X size={24} /> : <MessageCircle size={28} />}
            </motion.button>
        </div>
    );
}
