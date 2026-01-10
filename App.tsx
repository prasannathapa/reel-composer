
import React, { useState, useEffect, useRef } from 'react';
import { FileUpload } from './components/FileUpload';
import { ReelPlayer } from './components/ReelPlayer';
import { EditorPanel } from './components/EditorPanel';
import { WelcomeScreen } from './components/WelcomeScreen';
import { parseSRT } from './utils/srtParser';
import { AppState, GeneratedContent, SRTItem } from './types';
import { Edit3, AlertCircle, LayoutTemplate, CheckCircle2, Globe, Github, Linkedin, Instagram, Facebook, BookOpen, X, Sparkles, Smartphone, Monitor, ArrowLeft, Key } from 'lucide-react';
import { generateReelContent } from './services/geminiService';
import { APP_CONFIG } from './config';
import { constructPrompt, EXAMPLE_SRT, EXAMPLE_TOPIC, EXAMPLE_HTML, EXAMPLE_JSON } from './utils/promptTemplates';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(() => {
    // Check for manual mode opt-out first
    const manualModePref = localStorage.getItem('manual_mode_opt_out');
    if (manualModePref === 'true') {
        return AppState.UPLOAD;
    }

    // Check local storage on initial load
    const stored = localStorage.getItem('gemini_api_key');
    // If key exists, go to UPLOAD, else WELCOME
    return stored ? AppState.UPLOAD : AppState.WELCOME;
  });

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isAudioOnly, setIsAudioOnly] = useState(false); // Track if using dummy video/audio only
  const [srtData, setSrtData] = useState<SRTItem[]>([]);
  const [srtTextRaw, setSrtTextRaw] = useState<string>('');
  const [topicContext, setTopicContext] = useState(''); 
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSnackbar, setShowSnackbar] = useState(false);
  
  // Manual Mode & Latency Handling
  const [showManualButton, setShowManualButton] = useState(false);
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const [pendingContent, setPendingContent] = useState<GeneratedContent | null>(null);
  const isManualModeRef = useRef(false);
  const manualTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Settings State
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('gemini_api_key') || "";
  });
  const [modelName, setModelName] = useState(() => {
      return localStorage.getItem('gemini_model_pref') || APP_CONFIG.DEFAULT_MODEL;
  });

  // Audio State
  const [bgMusicFile, setBgMusicFile] = useState<File | null>(null);
  const [bgMusicUrl, setBgMusicUrl] = useState<string | undefined>(undefined);
  const [bgMusicVolume, setBgMusicVolume] = useState(0.2);

  // Manage Video Object URL
  useEffect(() => {
    if (!videoFile) return;
    const newUrl = URL.createObjectURL(videoFile);
    setVideoUrl(newUrl);
    return () => URL.revokeObjectURL(newUrl);
  }, [videoFile]);

  // Manage Audio Object URL
  useEffect(() => {
    if (!bgMusicFile) {
      setBgMusicUrl(undefined);
      return;
    }
    const newUrl = URL.createObjectURL(bgMusicFile);
    setBgMusicUrl(newUrl);
    return () => URL.revokeObjectURL(newUrl);
  }, [bgMusicFile]);

  const saveApiKeyToStorage = () => {
    if (apiKey) {
      localStorage.setItem('gemini_api_key', apiKey);
    } else {
      localStorage.removeItem('gemini_api_key');
    }
    
    // Save model pref
    if (modelName) {
        localStorage.setItem('gemini_model_pref', modelName);
    }
  };
  
  const handleWelcomeComplete = (key: string | null, model?: string, saveManualMode?: boolean) => {
    if (key) {
      setApiKey(key);
      localStorage.setItem('gemini_api_key', key);
      
      // Save Model
      if (model) {
          setModelName(model);
          localStorage.setItem('gemini_model_pref', model);
      }
    } else {
      // User skipped
      setApiKey("");
      localStorage.removeItem('gemini_api_key');
      
      if (saveManualMode) {
          localStorage.setItem('manual_mode_opt_out', 'true');
      }
    }
    setAppState(AppState.UPLOAD);
  };

  const handleResetAuth = () => {
    // Return to welcome screen.
    // NOTE: We do NOT clear the API Key from localStorage or state here.
    // This allows the Welcome Screen to pre-populate the existing key for editing.
    setAppState(AppState.WELCOME);
    
    // Reset file states
    setGeneratedContent(null);
    setVideoFile(null);
    setSrtData([]);
  };

  const handleFilesSelected = async (video: File, srt: File, isAudioMode: boolean) => {
    try {
      setVideoFile(video);
      setIsAudioOnly(isAudioMode);
      const srtText = await srt.text();
      setSrtTextRaw(srtText);
      const parsedSrt = parseSRT(srtText);
      setSrtData(parsedSrt);
      setAppState(AppState.GENERATING);
    } catch (e) {
      setError("Failed to parse files.");
    }
  };

  const handleGenerate = async () => {
     if (!videoFile || srtData.length === 0) return;
     if (!apiKey.trim()) {
       setError("API Key is missing. Auto-generate is disabled. Please add a key in settings or use Manual Mode.");
       return;
     }

     saveApiKeyToStorage();

     setIsGenerating(true);
     setError(null);
     try {
       // Check if we are REFINING existing content
       const existingHtml = generatedContent?.html;
       const existingLayout = generatedContent?.layoutConfig;

       const content = await generateReelContent(
           srtTextRaw, 
           topicContext, 
           apiKey, 
           modelName,
           existingHtml,
           existingLayout,
           isAudioOnly
       );
       setGeneratedContent(content);
       // Clear refinement text after success? Optional. Keeping it allows user to iterate.
     } catch (err: any) {
       setError(err.message || "Failed to generate content.");
     } finally {
       setIsGenerating(false);
     }
  };

  const handleEnterStudio = async () => {
    let currentSrtRaw = srtTextRaw;
    let currentTopic = topicContext;

    if (srtData.length === 0) {
      currentSrtRaw = EXAMPLE_SRT;
      currentTopic = EXAMPLE_TOPIC;
      setSrtTextRaw(currentSrtRaw);
      setSrtData(parseSRT(currentSrtRaw));
      setTopicContext(currentTopic);
    }

    const prompt = constructPrompt(currentTopic, currentSrtRaw);
    navigator.clipboard.writeText(prompt);
    
    setShowSnackbar(true);
    setTimeout(() => setShowSnackbar(false), 3000);

    // If NO API KEY -> Force Manual Mode
    if (!apiKey.trim()) {
      handleManualModeEnter();
      return;
    }

    // Setup Generation State
    setIsGenerating(true);
    setError(null);
    setShowManualButton(false);
    isManualModeRef.current = false;

    // Start 10s Timer for Manual Mode Option
    if (manualTimerRef.current) clearTimeout(manualTimerRef.current);
    manualTimerRef.current = setTimeout(() => {
        setShowManualButton(true);
    }, 10000); // 10 seconds
    
    try {
      // Initial Generation - No existing content yet
      const content = await generateReelContent(currentSrtRaw, currentTopic, apiKey, modelName, undefined, undefined, isAudioOnly);
      
      if (isManualModeRef.current) {
          // User already entered manual mode, ask to replace
          setPendingContent(content);
          setShowReplaceDialog(true);
      } else {
          // Normal flow
          setGeneratedContent(content);
          setAppState(AppState.EDITOR);
      }
    } catch (err: any) {
      console.warn("API Generation failed.", err);
      
      // If user is already in manual mode, ignore errors (they are editing demo content)
      if (!isManualModeRef.current) {
          // FALLBACK TO PREDEFINED SAMPLE
          // However, if it's a specific API error (like 429), we want to show it.
          if (err.message && (err.message.includes("429") || err.message.includes("API Key") || err.message.includes("Quota"))) {
             setError(err.message);
          } else {
            // Only fallback on generic/unknown errors, or if user prefers fallback flow
             try {
                const fallbackContent: GeneratedContent = {
                  html: EXAMPLE_HTML,
                  layoutConfig: JSON.parse(EXAMPLE_JSON),
                  reasoning: "Fallback to Demo Content (API Error or Quota Exceeded)"
                };
                setGeneratedContent(fallbackContent);
                setAppState(AppState.EDITOR);
              } catch (fallbackErr) {
                console.error("Fallback failed", fallbackErr);
                setError(err.message || "Failed to generate initial content.");
              }
          }
      }
    } finally {
      if (manualTimerRef.current) clearTimeout(manualTimerRef.current);
      setIsGenerating(false);
    }
  };

  const handleManualModeEnter = () => {
      isManualModeRef.current = true;
      // Load demo content immediately so the editor isn't empty
      setGeneratedContent({
          html: EXAMPLE_HTML,
          layoutConfig: JSON.parse(EXAMPLE_JSON),
          reasoning: "Manual Mode Entry"
      });
      setAppState(AppState.EDITOR);
  };

  const handleConfirmReplace = () => {
      if (pendingContent) {
          setGeneratedContent(pendingContent);
      }
      setShowReplaceDialog(false);
      setPendingContent(null);
  };

  const handleCancelReplace = () => {
      setShowReplaceDialog(false);
      setPendingContent(null);
  };

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  return (
    <>
      {/* Mobile/Tablet Blocking Overlay */}
      <div className="fixed inset-0 z-[9999] bg-gray-950 flex flex-col items-center justify-center p-8 text-center md:hidden">
        <div className="w-20 h-20 bg-gradient-to-br from-purple-900/20 to-pink-900/20 rounded-2xl border border-gray-800 flex items-center justify-center mb-6 shadow-2xl relative overflow-hidden">
            <Smartphone size={32} className="text-gray-500 relative z-10" />
            <div className="absolute inset-0 bg-red-500/10 rotate-45 transform scale-150"></div>
        </div>
        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 mb-3">
            Desktop Experience Required
        </h2>
        <p className="text-gray-400 max-w-xs leading-relaxed text-sm">
            Reel Composer is a professional studio tool designed for larger screens. 
            <br/><br/>
            Please open this application on your <strong>Laptop</strong> or <strong>Desktop</strong>.
        </p>
        <div className="mt-8 flex items-center gap-2 text-xs text-gray-500 uppercase tracking-widest">
            <Monitor size={14} />
            <span>Best viewed on 1024px+</span>
        </div>
      </div>

      {/* Main App Container - Only rendered on Desktop (md+) */}
      <div className="hidden md:contents">
        {appState === AppState.WELCOME ? (
            <WelcomeScreen onComplete={handleWelcomeComplete} />
        ) : (
            <div className="w-full h-screen flex flex-col bg-gray-950 text-white overflow-hidden relative">
            
            {/* Header (Simplified - Only show 'Change Key' button if not in UPLOAD/WELCOME to avoid duplication) */}
            {!isFullScreen && appState !== AppState.UPLOAD && (
                <header className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-black/50 backdrop-blur-sm z-10 shrink-0">
                <div className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">
                    Reel Composer
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                    
                    <button 
                        onClick={handleResetAuth}
                        className="flex items-center gap-2 hover:text-white transition-colors"
                        title="Reset API Key"
                    >
                        <Key size={16} />
                        <span className="hidden lg:inline">Change Key</span>
                    </button>

                    <div className="w-px h-4 bg-gray-700"></div>

                    <button 
                        onClick={() => {
                        setAppState(AppState.UPLOAD);
                        setGeneratedContent(null);
                        setBgMusicFile(null);
                        setPendingContent(null);
                        setShowReplaceDialog(false);
                        setIsAudioOnly(false); // Reset
                        }} 
                        className="hover:text-white transition-colors"
                    >
                        New Project
                    </button>
                    <div className="w-px h-4 bg-gray-700"></div>
                    <span className="text-xs uppercase tracking-widest text-purple-400">v1.2.5</span>
                </div>
                </header>
            )}

            {/* Main Content Area */}
            <main className="flex-1 overflow-hidden relative flex flex-col">
                
                {/* State: Upload */}
                {appState === AppState.UPLOAD && (
                <div className="flex flex-col h-full overflow-y-auto">
                    <div className="flex-1">
                        <FileUpload 
                            onFilesSelected={handleFilesSelected} 
                            apiKey={apiKey} 
                            onBack={handleResetAuth} 
                        />
                    </div>
                </div>
                )}

                {/* State: Setup (Context) */}
                {appState === AppState.GENERATING && (
                <div className="flex flex-col h-full overflow-auto">
                    <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto p-6 space-y-8 animate-fade-in">
                        <div className="text-center space-y-2">
                            <div className="mx-auto w-16 h-16 bg-purple-900/30 rounded-full flex items-center justify-center text-purple-400 mb-4">
                            <LayoutTemplate size={32} />
                            </div>
                            <h2 className="text-3xl font-bold">Director's Studio</h2>
                            <p className="text-gray-400 max-w-md mx-auto">
                            {isAudioOnly 
                               ? "Audio-Only Mode: We will generate full-screen visuals to accompany your script." 
                               : "Describe your video topic. We'll copy this prompt to your clipboard and auto-generate the initial animation scene."}
                            </p>
                        </div>

                        <div className="w-full space-y-4">
                        <label className="block text-sm font-medium text-gray-400 uppercase tracking-wider">Video Topic / Visual Context <span className="text-gray-500 text-xs normal-case">(Optional)</span></label>
                        <textarea 
                            value={topicContext}
                            onChange={(e) => setTopicContext(e.target.value)}
                            placeholder={isAudioOnly ? "e.g. Visuals should be about space exploration, with planets and stars." : "e.g. This video explains Quantum Tunneling. I want particles passing through barriers..."}
                            className="w-full h-32 bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none transition-all"
                        />
                        </div>
                        
                        <div className="w-full space-y-3">
                            <button 
                            onClick={handleEnterStudio}
                            disabled={isGenerating}
                            className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
                                isGenerating
                                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-purple-900/20 hover:scale-[1.02]'
                            }`}
                            >
                            {isGenerating ? (
                                <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Generating Scene...
                                </>
                            ) : (
                                <>
                                <Edit3 size={18} />
                                {!apiKey ? "No API Key - Enter Manual Mode" : (srtData.length === 0 ? "Enter Demo Studio" : "Enter Studio & Auto-Generate")}
                                </>
                            )}
                            </button>

                            {/* Manual Mode Option - Appears after 10s */}
                            {isGenerating && showManualButton && (
                                <div className="animate-fade-in text-center pt-2">
                                    <span className="text-xs text-gray-500 block mb-2">Taking longer than expected?</span>
                                    <button 
                                        onClick={handleManualModeEnter}
                                        className="text-sm text-purple-400 hover:text-white underline underline-offset-4 decoration-purple-500/30 hover:decoration-purple-500 transition-all"
                                    >
                                        Skip & Enter Manual Mode
                                    </button>
                                </div>
                            )}
                        </div>

                        {error && (
                        <div className="w-full p-4 bg-red-900/20 border border-red-800 rounded-lg flex flex-col gap-3 animate-fade-in">
                            <div className="flex items-start gap-3">
                                <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <h4 className="text-sm font-bold text-red-300">Generation Failed</h4>
                                    <p className="text-xs text-red-200 mt-1 leading-relaxed">{error}</p>
                                </div>
                            </div>
                            
                            <div className="flex gap-3 pl-8">
                                <button 
                                    onClick={handleResetAuth}
                                    className="px-4 py-2 bg-red-900/50 hover:bg-red-900 text-white text-xs rounded-lg transition-colors border border-red-700/50"
                                >
                                    Update API Key
                                </button>
                                <button 
                                    onClick={handleManualModeEnter}
                                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition-colors border border-gray-700"
                                >
                                    Continue in Manual Mode
                                </button>
                            </div>
                        </div>
                        )}
                    </div>
                </div>
                )}

                {/* State: Editor (Split View) */}
                {appState === AppState.EDITOR && generatedContent && (
                <div className="flex h-full">
                    {/* Left: Player */}
                    <div className={`flex-1 flex flex-col items-center justify-center bg-black/20 relative transition-all duration-300 ${isFullScreen ? 'w-full fixed inset-0 z-50 bg-black' : ''}`}>
                    <ReelPlayer 
                        videoUrl={videoUrl}
                        srtData={srtData}
                        htmlContent={generatedContent.html}
                        layoutConfig={generatedContent.layoutConfig}
                        fullScreenMode={isFullScreen}
                        toggleFullScreen={toggleFullScreen}
                        bgMusicUrl={bgMusicUrl}
                        bgMusicVolume={bgMusicVolume}
                    />
                    </div>

                    {/* Right: Code/Config Editor (Hidden if fullscreen) */}
                    {!isFullScreen && (
                    <div className="w-[450px] border-l border-gray-800 bg-gray-900 z-10 shadow-2xl">
                        <EditorPanel 
                        content={generatedContent}
                        isGenerating={isGenerating}
                        onGenerate={handleGenerate}
                        onUpdate={setGeneratedContent}
                        videoFile={videoFile}
                        topicContext={topicContext}
                        onTopicContextChange={setTopicContext}
                        srtText={srtTextRaw}
                        bgMusicName={bgMusicFile?.name}
                        onBgMusicChange={setBgMusicFile}
                        bgMusicVolume={bgMusicVolume}
                        onBgVolumeChange={setBgMusicVolume}
                        apiKey={apiKey}
                        setApiKey={setApiKey}
                        modelName={modelName}
                        setModelName={setModelName}
                        onSaveApiKey={saveApiKeyToStorage}
                        />
                    </div>
                    )}
                </div>
                )}
            </main>

            {/* Snackbar */}
            <div className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-white text-black px-6 py-3 rounded-full font-bold shadow-2xl z-[100] transition-all duration-300 flex items-center gap-2 ${showSnackbar ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
                <CheckCircle2 size={20} className="text-green-600" />
                Prompt Copied to Clipboard!
            </div>

            {/* Replace Scene Dialog (Delayed Response) */}
            {showReplaceDialog && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-500/20 text-green-400 rounded-lg">
                                    <Sparkles size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Scene Generated</h3>
                                    <p className="text-xs text-gray-400">The AI has finished generating your scene.</p>
                                </div>
                            </div>
                            <button onClick={handleCancelReplace} className="text-gray-500 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <p className="text-sm text-gray-300 mb-6 leading-relaxed">
                            A new scene has arrived from the background generation process. Would you like to replace your current manual setup with the AI-generated one?
                        </p>

                        <div className="flex gap-3">
                            <button 
                                onClick={handleCancelReplace}
                                className="flex-1 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium text-sm transition-colors"
                            >
                                Keep Manual
                            </button>
                            <button 
                                onClick={handleConfirmReplace}
                                className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition-colors"
                            >
                                Replace Scene
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </div>
        )}
      </div>
    </>
  );
};

export default App;