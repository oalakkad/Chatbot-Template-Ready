import React, { useEffect, useState } from 'react';
import { Message } from '../types';
import { useTypewriter } from '../hooks/useTypewriter';
import { Bot, User } from 'lucide-react';
import { motion } from 'framer-motion';

interface ChatMessageProps {
    message: Message;
    isLatest: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isLatest }) => {
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
            className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-4 items-end gap-2`}
        >
            {!isUser && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
                    <Bot size={16} />
                </div>
            )}

            <div
                className={`max-w-[75%] px-5 py-3 rounded-2xl ${isUser
                        ? 'bg-gradient-to-tr from-blue-600 to-blue-700 text-white rounded-br-none shadow-lg shadow-blue-500/20'
                        : 'bg-white text-gray-800 rounded-bl-none shadow-md border border-gray-100'
                    }`}
            >
                <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">
                    {content}
                    {shouldType && content.length < message.text.length && (
                        <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-blue-500 animate-pulse"></span>
                    )}
                </p>
                <span className={`text-[10px] block mt-2 text-right opacity-70`}>
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>

            {isUser && (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 shadow-sm">
                    <User size={16} />
                </div>
            )}
        </motion.div>
    );
};

export default ChatMessage;
