import React, {useEffect, useRef, useState} from 'react';
import {FileUpload} from '@/src/components/FileUpload.tsx';
import {WelcomeScreen} from '@/src/components/WelcomeScreen.tsx';
import {MobileBlocker} from '@/src/components/MobileBlocker.tsx';
import {AppHeader} from '@/src/components/AppHeader.tsx';
import {GeneratingScreen} from '@/src/components/GeneratingScreen.tsx';
import {EditorView} from '@/src/views/EditorView.tsx';
import {Snackbar} from '@/src/components/Snackbar.tsx';
import {ReplaceSceneDialog} from '@/src/components/ReplaceSceneDialog.tsx';
import {parseSRT} from '@/src/utils/srtParser.ts';
import {AppState, GeneratedContent, SRTItem} from '../types.ts';
import {generateReelContent} from '@/src/services/geminiService.ts';
import {APP_CONFIG} from '../config.ts';
import {constructPrompt, EXAMPLE_HTML, EXAMPLE_JSON, EXAMPLE_SRT, EXAMPLE_TOPIC} from '@/src/utils/promptTemplates.ts';

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

  // Subtitle Style State
  const [subtitleFontSize, setSubtitleFontSize] = useState(32);
  const [subtitleFontFamily, setSubtitleFontFamily] = useState('Inter');
  const [subtitleColor, setSubtitleColor] = useState('#FFFFFF');
  const [subtitleBgColor, setSubtitleBgColor] = useState('rgba(0,0,0,0.8)');
  const [subtitlePaddingX, setSubtitlePaddingX] = useState(16);
  const [subtitlePaddingY, setSubtitlePaddingY] = useState(8);

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

  const handleNewProject = () => {
    setAppState(AppState.UPLOAD);
    setGeneratedContent(null);
    setBgMusicFile(null);
    setPendingContent(null);
    setShowReplaceDialog(false);
    setIsAudioOnly(false);
  };

  return (
    <>
      <MobileBlocker/>

      {/* Main App Container - Only rendered on Desktop (md+) */}
      <div className="hidden md:contents">
        {appState === AppState.WELCOME ? (
          <WelcomeScreen onComplete={handleWelcomeComplete}/>
        ) : (
          <div className="w-full h-screen flex flex-col bg-gray-950 text-white overflow-hidden relative">
            {/* Header */}
            {!isFullScreen && appState !== AppState.UPLOAD && (
              <AppHeader
                onResetAuth={handleResetAuth}
                onNewProject={handleNewProject}
              />
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

              {/* State: Generating */}
              {appState === AppState.GENERATING && (
                <GeneratingScreen
                  isAudioOnly={isAudioOnly}
                  topicContext={topicContext}
                  onTopicContextChange={setTopicContext}
                  isGenerating={isGenerating}
                  showManualButton={showManualButton}
                  error={error}
                  onEnterStudio={handleEnterStudio}
                  onManualModeEnter={handleManualModeEnter}
                  onResetAuth={handleResetAuth}
                  apiKey={apiKey}
                  srtDataLength={srtData.length}
                />
              )}

              {/* State: Editor */}
              {appState === AppState.EDITOR && generatedContent && (
                <EditorView
                  videoUrl={videoUrl}
                  srtData={srtData}
                  generatedContent={generatedContent}
                  isFullScreen={isFullScreen}
                  toggleFullScreen={toggleFullScreen}
                  bgMusicUrl={bgMusicUrl}
                  bgMusicVolume={bgMusicVolume}
                  isGenerating={isGenerating}
                  onGenerate={handleGenerate}
                  onUpdate={setGeneratedContent}
                  videoFile={videoFile}
                  bgMusicFile={bgMusicFile}
                  topicContext={topicContext}
                  onTopicContextChange={setTopicContext}
                  srtText={srtTextRaw}
                  bgMusicName={bgMusicFile?.name}
                  onBgMusicChange={setBgMusicFile}
                  onBgVolumeChange={setBgMusicVolume}
                  apiKey={apiKey}
                  setApiKey={setApiKey}
                  modelName={modelName}
                  setModelName={setModelName}
                  onSaveApiKey={saveApiKeyToStorage}
                  subtitleFontSize={subtitleFontSize}
                  onSubtitleFontSizeChange={setSubtitleFontSize}
                  subtitleFontFamily={subtitleFontFamily}
                  onSubtitleFontFamilyChange={setSubtitleFontFamily}
                  subtitleColor={subtitleColor}
                  onSubtitleColorChange={setSubtitleColor}
                  subtitleBgColor={subtitleBgColor}
                  onSubtitleBgColorChange={setSubtitleBgColor}
                  subtitlePaddingX={subtitlePaddingX}
                  onSubtitlePaddingXChange={setSubtitlePaddingX}
                  subtitlePaddingY={subtitlePaddingY}
                  onSubtitlePaddingYChange={setSubtitlePaddingY}
                />
              )}
            </main>

            {/* Snackbar */}
            <Snackbar
              show={showSnackbar}
              message="Prompt Copied to Clipboard!"
            />

            {/* Replace Scene Dialog */}
            <ReplaceSceneDialog
              show={showReplaceDialog}
              onConfirm={handleConfirmReplace}
              onCancel={handleCancelReplace}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default App;
