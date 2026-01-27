import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PhoneOff, Mic, MicOff, Volume2, Loader2 } from 'lucide-react';

interface CallingOverlayProps {
    isOpen: boolean;
    onHangUp: () => void;
    onToggleListening: () => void;
    onToggleMute: () => void;
    isListening: boolean;
    isSpeaking: boolean;
    isProcessing?: boolean;
    isMuted: boolean;
    agentName: string;
}

const CallingOverlay: React.FC<CallingOverlayProps> = ({
    isOpen,
    onHangUp,
    onToggleListening,
    onToggleMute,
    isListening,
    isSpeaking,
    isProcessing,
    isMuted,
    agentName
}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-[60] bg-slate-900 flex flex-col items-center justify-between p-8 text-white"
                >
                    {/* Header */}
                    <div className="text-center mt-8">
                        <div className="text-blue-400 text-xs uppercase tracking-widest mb-2 font-bold">Encrypted AI Call</div>
                        <h2 className="text-2xl font-bold">{agentName}</h2>
                        <div className="flex items-center justify-center gap-2 mt-2">
                            <span className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-amber-500' : 'bg-blue-500'} animate-pulse`} />
                            <span className="text-slate-400 text-sm">
                                {isSpeaking ? 'Speaking...' : isProcessing ? 'Processing...' : isListening ? 'Listening...' : 'Connected'}
                            </span>
                        </div>
                    </div>

                    {/* Visualizer / Avatar */}
                    <div className="relative flex items-center justify-center">
                        {/* Pulse Rings */}
                        <AnimatePresence>
                            {(isSpeaking || isListening) && (
                                <>
                                    <motion.div
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1.5, opacity: [0, 0.2, 0] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        className="absolute w-32 h-32 rounded-full border-2 border-blue-500/30"
                                    />
                                    <motion.div
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 2, opacity: [0, 0.1, 0] }}
                                        transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                                        className="absolute w-32 h-32 rounded-full border-2 border-blue-500/20"
                                    />
                                </>
                            )}
                        </AnimatePresence>

                        <button
                            onClick={onToggleListening}
                            disabled={isSpeaking || isProcessing}
                            className={`w-32 h-32 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-700 flex items-center justify-center shadow-2xl shadow-blue-500/20 relative z-10 border-4 border-slate-800 transition-transform active:scale-95 ${isListening ? 'ring-4 ring-blue-500/50' : ''} ${(isSpeaking || isProcessing) ? 'opacity-80 cursor-not-allowed' : ''}`}
                        >
                            {isSpeaking ? (
                                <Volume2 size={48} className="text-white animate-bounce" />
                            ) : isProcessing ? (
                                <Loader2 size={48} className="text-white animate-spin text-blue-200" />
                            ) : (
                                <Mic size={48} className={isListening ? "text-white scale-110" : "text-blue-100 opacity-50"} />
                            )}
                        </button>
                    </div>

                    {/* Controls */}
                    <div className="mb-8 flex gap-6 items-center">
                        <button
                            onClick={onToggleMute}
                            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-red-500/20 text-red-400 ring-2 ring-red-500/50' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                            title={isMuted ? "Unmute Speaker" : "Mute Speaker"}
                        >
                            {isMuted ? <MicOff size={20} /> : <Volume2 size={20} />}
                        </button>

                        <button
                            onClick={onHangUp}
                            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 transition-all shadow-xl shadow-red-500/30 active:scale-95"
                        >
                            <PhoneOff size={28} />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default CallingOverlay;
