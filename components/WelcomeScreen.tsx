
import React, { useState, useEffect } from 'react';
import { ArrowRight, ShieldCheck, AlertTriangle, ExternalLink, PlayCircle } from 'lucide-react';
import { validateGeminiConnection } from '../services/geminiService';
import { APP_CONFIG } from '../config';

interface WelcomeScreenProps {
  onComplete: (apiKey: string | null, model?: string, saveManualMode?: boolean) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onComplete }) => {
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Default model enforced internally
  const selectedModel = APP_CONFIG.DEFAULT_MODEL;

  // Prepopulate key if exists
  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey && storedKey !== APP_CONFIG.DEFAULT_API_KEY) {
        setApiKey(storedKey);
    }
  }, []);

  const handleValidation = async () => {
    if (!apiKey.trim()) {
      setError("Please enter a valid API Key.");
      return;
    }
    
    setIsValidating(true);
    setError(null);
    
    const isValid = await validateGeminiConnection(apiKey, selectedModel);
    
    setIsValidating(false);
    
    if (isValid) {
      onComplete(apiKey, selectedModel);
    } else {
      setError("Connection failed. Please check your key.");
    }
  };

  const handleManualSkip = () => {
    // Pass null to indicate manual mode (no API key)
    onComplete(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-6 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-pink-900/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>

      <div className="max-w-xl w-full bg-gray-900/80 backdrop-blur-xl border border-gray-800 rounded-3xl p-8 md:p-12 shadow-2xl relative z-10 animate-fade-in flex flex-col items-center">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-500 to-pink-500 mb-8 shadow-2xl shadow-purple-900/50 rotate-3 hover:rotate-6 transition-transform duration-500">
            <PlayCircle className="text-white fill-white/20" size={48} />
          </div>
          <h1 className="text-5xl md:text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-200 to-pink-200 tracking-tighter leading-tight">
            Reel Composer
          </h1>
          <p className="text-gray-400 mt-6 text-xl font-light max-w-sm mx-auto leading-relaxed">
            AI-powered director for high-retention video content.
          </p>
          <a href="https://blog.prasannathapa.in/reel-composer/" target="_blank" rel="noreferrer" className="inline-block mt-4 text-xs font-bold text-purple-400 hover:text-white uppercase tracking-widest border-b border-purple-500/30 hover:border-white transition-all pb-0.5">
            Read The Philosophy
          </a>
        </div>

        {/* API Key Form */}
        <div className="w-full space-y-6 animate-fade-in">
            
            <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                    <label className="text-sm font-semibold text-gray-300">Google Gemini API Key</label>
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-medium transition-colors">
                        <ExternalLink size={12} /> Get Free Key
                    </a>
                </div>
                <div className="relative group">
                    <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Paste your API Key here (AIzaSy...)"
                    className="w-full bg-black/50 border border-gray-700 rounded-2xl px-5 py-4 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all font-mono text-sm placeholder-gray-600 shadow-inner"
                    />
                    <div className="absolute inset-0 rounded-2xl bg-purple-500/5 pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
                </div>
                
                <div className="flex items-start gap-2 px-1">
                    <ShieldCheck className="text-green-500/80 shrink-0 mt-0.5" size={14} />
                    <p className="text-[11px] text-gray-500 leading-tight">
                        Your key is stored locally in your browser and sent directly to Google.
                    </p>
                </div>
            </div>

            <button
            onClick={handleValidation}
            disabled={isValidating}
            className={`w-full py-5 rounded-2xl font-bold text-lg transition-all shadow-xl hover:shadow-2xl hover:scale-[1.02] flex items-center justify-center gap-3 ${
                isValidating 
                ? 'bg-gray-800 cursor-not-allowed text-gray-500' 
                : 'bg-white text-black hover:bg-gray-100'
            }`}
            >
            {isValidating ? (
                <span className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-gray-500 border-t-white rounded-full animate-spin"></div>
                    Verifying...
                </span>
            ) : (
                <>Enter Studio <ArrowRight size={20} /></>
            )}
            </button>
            
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center justify-center gap-2 animate-shake text-center">
                <AlertTriangle size={16} className="shrink-0" /> {error}
                </div>
            )}

            <div className="pt-6 border-t border-gray-800/50 text-center">
                <button 
                    onClick={handleManualSkip}
                    className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                >
                    Or enter manual mode (No AI features)
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
