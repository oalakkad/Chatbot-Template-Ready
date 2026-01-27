import React, { useEffect, useState } from 'react';
import { Message } from '../types';
import { useTypewriter } from '../hooks/useTypewriter';
import { Bot, User } from 'lucide-react';
import { motion } from 'framer-motion';

interface ChatMessageProps {
    message: Message;
    isLatest: boolean;
    isAgentActive?: boolean;
    agentName?: string | null;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isLatest, isAgentActive, agentName }) => {
    const isUser = message.sender === 'user';

    // Only use typewriter for AI and ONLY if it's the latest message
    // Otherwise show full text immediately (history)
    const shouldType = !isUser && isLatest;
    const { displayedText } = useTypewriter(message.text, 15);

    const content = shouldType ? displayedText : message.text;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-4 items-end gap-3`}
        >
            {!isUser && (
                <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center shadow-lg shadow-blue-900/20 bg-slate-800 ring-2 ring-slate-700">
                    {isAgentActive ? (
                        <img
                            src={`https://ui-avatars.com/api/?name=${agentName || 'Agent'}&background=random&color=fff`}
                            alt="Agent"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-slate-800 flex items-center justify-center p-0.5">
                            <img
                                src="/logo.jpg"
                                alt="AI"
                                className="w-full h-full object-contain brightness-110 drop-shadow-md"
                            />
                        </div>
                    )}
                </div>
            )}

            <div
                className={`max-w-[80%] px-5 py-3.5 rounded-2xl backdrop-blur-sm ${isUser
                    ? 'bg-gradient-to-tr from-sky-500 to-blue-600 text-white rounded-br-none shadow-lg shadow-sky-500/20'
                    : 'bg-slate-800/80 text-slate-100 rounded-bl-none shadow-md border border-slate-700/50'
                    }`}
            >
                <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">
                    {content}
                    {shouldType && content.length < message.text.length && (
                        <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-sky-400 animate-pulse"></span>
                    )}
                </p>
                <span className={`text-[10px] block mt-2 text-right ${isUser ? 'text-white/70' : 'text-slate-400'}`}>
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>

            {isUser && (
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 shadow-lg ring-2 ring-slate-800">
                    <User size={16} />
                </div>
            )}
        </motion.div>
    );
};

export default ChatMessage;
