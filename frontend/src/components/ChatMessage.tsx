import React from 'react';
import { Message } from '../types';
import { useTypewriter } from '../hooks/useTypewriter';
import { User } from 'lucide-react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessageProps {
    message: Message;
    isLatest: boolean;
    isAgentActive?: boolean;
    agentName?: string | null;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isLatest, isAgentActive, agentName }) => {
    const isUser = message.sender === 'user';

    // Typewriter rules:
    // Only for AI, latest msg, not currently streaming, and not ALREADY streamed.
    const shouldType = !isUser && isLatest && !message.isStreaming && !message.wasStreamed;

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
                className={`max-w-[85%] px-5 py-3.5 rounded-2xl backdrop-blur-md ${isUser
                    ? 'bg-gradient-to-tr from-sky-500 to-blue-600 text-white rounded-br-none shadow-lg shadow-sky-500/20'
                    : 'bg-slate-900/95 text-slate-100 rounded-bl-none shadow-2xl border border-blue-500/20'
                    }`}
            >
                <div className={`text-[0.925rem] leading-relaxed prose prose-invert max-w-none ${!isUser ? 'premium-rag-content' : ''}`}>
                    {isUser ? (
                        <p className="whitespace-pre-wrap">{content}</p>
                    ) : content.length === 0 && message.isStreaming ? (
                        <div className="flex flex-col gap-2 py-1">
                            <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs uppercase tracking-widest animate-pulse">
                                <div className="w-1.5 h-1.5 bg-sky-400 rounded-full"></div>
                                Searching Knowledge Base...
                            </div>
                            <div className="space-y-2">
                                <div className="h-2 bg-slate-800 rounded-full w-3/4 animate-pulse"></div>
                                <div className="h-2 bg-slate-800 rounded-full w-1/2 animate-pulse"></div>
                            </div>
                        </div>
                    ) : (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {content}
                        </ReactMarkdown>
                    )}

                    {/* Streaming Indicator */}
                    {message.isStreaming && content.length > 0 && (
                        <span className="inline-block w-2 h-4 ml-1 align-middle bg-sky-400 animate-pulse shadow-[0_0_10px_rgba(56,189,248,0.7)] rounded-sm"></span>
                    )}
                </div>

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
