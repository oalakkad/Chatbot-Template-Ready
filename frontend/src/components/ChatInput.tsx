import React, { useState, KeyboardEvent, useRef } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';

interface ChatInputProps {
    onSend: (text: string) => void;
    onVoiceSend?: (audioBlob: Blob) => void;
    disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, onVoiceSend, disabled }) => {
    const [input, setInput] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const handleSend = () => {
        if (input.trim() && !disabled) {
            onSend(input);
            setInput('');
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !disabled && !isRecording) {
            handleSend();
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                if (onVoiceSend) onVoiceSend(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone. Please check permissions.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    return (
        <div className="p-4 bg-slate-900 border-t border-slate-800">
            <div className="flex items-center gap-3">
                <button
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={disabled}
                    className={`p-3 rounded-full transition-all ${isRecording ? 'bg-red-500/20 text-red-500 animate-pulse ring-2 ring-red-500/50' : 'bg-slate-800 text-sky-400 hover:bg-slate-700 ring-1 ring-slate-700'}`}
                    title={isRecording ? "Stop Recording" : "Send Voice Note"}
                >
                    {isRecording ? <Square size={20} /> : <Mic size={20} />}
                </button>
                <input
                    type="text"
                    className="flex-1 p-3.5 border border-slate-700 rounded-xl bg-slate-800/50 focus:outline-none focus:ring-2 focus:ring-sky-500/50 text-white text-sm placeholder:text-slate-500 transition-all"
                    placeholder={isRecording ? "Listening..." : "Type your message..."}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled || isRecording}
                />
                <button
                    onClick={handleSend}
                    disabled={disabled || !input.trim() || isRecording}
                    className="bg-gradient-to-r from-sky-500 to-blue-600 text-white p-3 rounded-xl hover:shadow-lg hover:shadow-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default ChatInput;
