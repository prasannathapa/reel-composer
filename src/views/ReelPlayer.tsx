import React, { useEffect, useRef, useState, useMemo } from 'react';
import { LayoutConfigStep, SRTItem } from '@/types.ts';
import { Play, Pause, RefreshCw, Maximize, Minimize, Download, X, Loader2 } from 'lucide-react';
import { exportReelWithFFmpeg, checkServerHealth, ExportProgress } from '@/src/services/exportService.ts';

interface ReelPlayerProps {
  videoUrl: string;
  srtData: SRTItem[];
  htmlContent: string;
  layoutConfig: LayoutConfigStep[];
  onTimeUpdate?: (time: number) => void;
  fullScreenMode: boolean;
  toggleFullScreen: () => void;
  bgMusicUrl?: string;
  bgMusicVolume?: number;
  subtitleFontSize?: number;
  subtitleFontFamily?: string;
  subtitleColor?: string;
  subtitleBgColor?: string;
  subtitlePaddingX?: number;
  subtitlePaddingY?: number;
  // New props for export
  videoFile?: File | null;
  bgMusicFile?: File | null;
}

export const ReelPlayer: React.FC<ReelPlayerProps> = ({
  videoUrl,
  srtData,
  htmlContent,
  layoutConfig,
  onTimeUpdate,
  fullScreenMode,
  toggleFullScreen,
  bgMusicUrl,
  bgMusicVolume = 0.2,
  subtitleFontSize = 32,
  subtitleFontFamily = 'Inter',
  subtitleColor = '#FFFFFF',
  subtitleBgColor = 'rgba(0,0,0,0.8)',
  subtitlePaddingX = 16,
  subtitlePaddingY = 8,
  videoFile,
  bgMusicFile
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);

  // Key to force re-render iframe on restart
  const [iframeKey, setIframeKey] = useState(0);

  // --- Computed State based on Time ---
  const currentLayout = useMemo(() => {
    // 1. Try to find the specific layout step for the current time
    const match = layoutConfig.find(step => currentTime >= step.startTime && currentTime < step.endTime);
    if (match) return match;

    // 2. If no match, check if we are past the last step (keep the final state)
    if (layoutConfig.length > 0) {
      const lastStep = layoutConfig[layoutConfig.length - 1];
      if (currentTime >= lastStep.endTime) {
        return lastStep;
      }
    }

    // 3. Fallback default
    return layoutConfig[0] || {
      layoutMode: 'split',
      splitRatio: 0.5,
      captionPosition: 'center',
      startTime: 0,
      endTime: 9999
    };
  }, [currentTime, layoutConfig]);

  const currentCaption = useMemo(() => {
    return srtData.find(item => currentTime >= item.startTime && currentTime <= item.endTime);
  }, [currentTime, srtData]);

  // --- Check server availability on mount ---
  useEffect(() => {
    checkServerHealth().then(setServerAvailable);
  }, []);

  // --- Styles calculation ---
  const getLayoutStyles = () => {
    const { layoutMode, splitRatio = 0.5 } = currentLayout;

    let htmlHeight = '50%';
    let videoHeight = '50%';
    let htmlZIndex = 10;
    let videoZIndex = 10;

    if (layoutMode === 'full-video') {
      htmlHeight = '0%';
      videoHeight = '100%';
      htmlZIndex = 0;
    } else if (layoutMode === 'full-html') {
      htmlHeight = '100%';
      videoHeight = '0%';
      videoZIndex = 0;
    } else if (layoutMode === 'split') {
      htmlHeight = `${splitRatio * 100}%`;
      videoHeight = `${(1 - splitRatio) * 100}%`;
    }

    // Smooth transition style
    const transition = 'height 0.5s cubic-bezier(0.4, 0, 0.2, 1)';

    return {
      htmlContainer: { height: htmlHeight, transition, zIndex: htmlZIndex },
      videoContainer: { height: videoHeight, transition, zIndex: videoZIndex },
    };
  };

  const getCaptionStyle = () => {
    const { layoutMode, splitRatio = 0.5, captionPosition } = currentLayout;

    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '90%',
      display: 'flex',
      justifyContent: 'center',
      textAlign: 'center',
      pointerEvents: 'none',
      zIndex: 50, // Ensure high Z-index
      transition: 'top 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
    };

    if (captionPosition === 'hidden') {
      return { ...baseStyle, display: 'none' };
    }

    if (layoutMode === 'split') {
      // In split mode, position the caption exactly on the dividing line
      return { ...baseStyle, top: `${splitRatio * 100}%` };
    }

    // Full screen modes fallback
    switch (captionPosition) {
      case 'top': return { ...baseStyle, top: '15%' };
      case 'center': return { ...baseStyle, top: '50%' };
      case 'bottom':
      default: return { ...baseStyle, top: '80%' };
    }
  };

  const layoutStyles = getLayoutStyles();
  const captionStyle = getCaptionStyle();
  const isFullHtml = currentLayout.layoutMode === 'full-html';

  // --- Word-by-Word Animation Logic (With Chunking) ---
  const renderAnimatedCaption = () => {
    if (!currentCaption) return null;

    const WORDS_PER_VIEW = 5; // Max words to show at once

    // Split full text into words
    const allWords = currentCaption.text.split(' ');

    // Calculate progress through the current segment (0 to 1)
    const duration = currentCaption.endTime - currentCaption.startTime;
    const elapsed = currentTime - currentCaption.startTime;
    const progress = Math.max(0, Math.min(1, elapsed / duration));

    // Determine which word is currently being spoken (Global Index)
    const globalActiveIndex = Math.floor(progress * allWords.length);

    // Determine which "Page" (Chunk) of words we are on
    const currentChunkIndex = Math.floor(globalActiveIndex / WORDS_PER_VIEW);

    // Slice the array to get only the current chunk
    const startWordIndex = currentChunkIndex * WORDS_PER_VIEW;
    const endWordIndex = startWordIndex + WORDS_PER_VIEW;
    const visibleWords = allWords.slice(startWordIndex, endWordIndex);

    return (
      <div
        className={`flex flex-wrap justify-center items-center gap-x-1.5 gap-y-1 rounded-2xl transition-all duration-300 ${isFullHtml ? 'backdrop-blur-md border border-white/10 shadow-2xl' : ''}`}
        style={{
          minHeight: '60px',
          backgroundColor: subtitleBgColor,
          fontFamily: subtitleFontFamily,
          paddingLeft: `${subtitlePaddingX}px`,
          paddingRight: `${subtitlePaddingX}px`,
          paddingTop: `${subtitlePaddingY}px`,
          paddingBottom: `${subtitlePaddingY}px`
        }}
      >
        {visibleWords.map((word, index) => {
          // Calculate the true index of this word in the original full sentence
          const trueIndex = startWordIndex + index;

          const isActive = trueIndex === globalActiveIndex;
          const isPast = trueIndex < globalActiveIndex;

          return (
            <span
              key={`${currentCaption.id}-${trueIndex}`}
              className={`
                transition-all duration-150 inline-block font-black tracking-wide leading-tight
                ${isActive ? 'scale-110' : ''}
              `}
              style={{
                fontSize: `${subtitleFontSize}px`,
                color: isActive ? '#fbbf24' : (isPast ? subtitleColor : `${subtitleColor}66`),
                textShadow: isActive
                    ? '0 0 30px rgba(250, 204, 21, 0.6), 2px 2px 0px rgba(0,0,0,1)'
                    : '2px 2px 0px rgba(0,0,0,0.8)',
                fontFamily: subtitleFontFamily
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  };

  // --- Messaging Helper ---
  const postMessageToIframe = (message: any) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(message, '*');
    }
  };

  // --- Iframe Load Handler ---
  const handleIframeLoad = () => {
    if (videoRef.current) {
      postMessageToIframe({
        type: 'timeupdate',
        time: videoRef.current.currentTime
      });

      if (!videoRef.current.paused) {
         postMessageToIframe({ type: 'play' });
      }
    }
  };

  // --- Background Music Management ---

  // 1. Handle Volume Changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = bgMusicVolume;
    }
  }, [bgMusicVolume]);

  // 2. Handle Source Changes
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      if (bgMusicUrl) {
        // Load new source
        audio.src = bgMusicUrl;
        audio.load();
        audio.volume = bgMusicVolume; // Ensure volume is set immediately

        // Sync to video immediately
        if (videoRef.current) {
          audio.currentTime = videoRef.current.currentTime;
          if (!videoRef.current.paused) {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
              playPromise.catch(error => {
                console.warn("Auto-play prevented (Audio):", error);
              });
            }
          }
        }
      } else {
        // Clear source if removed
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
    }
  }, [bgMusicUrl]);


  // --- Sync Logic (High Frequency Loop) ---
  useEffect(() => {
    let animationFrameId: number;

    const syncLoop = () => {
      const video = videoRef.current;
      if (video && !video.paused) {
        const time = video.currentTime;
        setCurrentTime(time);

        postMessageToIframe({ type: 'timeupdate', time });

        // Sync Audio logic
        if (audioRef.current && bgMusicUrl && !audioRef.current.paused) {
          const drift = Math.abs(audioRef.current.currentTime - time);
          // Tighten drift tolerance and sync
          if (drift > 0.2) {
            audioRef.current.currentTime = time;
          }
        }
        // Force play if video is playing but audio isn't (and audio exists)
        else if (audioRef.current && bgMusicUrl && audioRef.current.paused && video.readyState >= 3) {
             audioRef.current.currentTime = time;
             audioRef.current.play().catch(() => {});
        }

        if (onTimeUpdate) {
           onTimeUpdate(time);
        }
      }
      animationFrameId = requestAnimationFrame(syncLoop);
    };

    animationFrameId = requestAnimationFrame(syncLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [onTimeUpdate, bgMusicUrl]);

  // --- Event Listeners for State ---
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;

    const handlePlay = () => {
      setIsPlaying(true);
      postMessageToIframe({ type: 'play' });
      if (audio && audio.src) audio.play().catch(() => {});
    };

    const handlePause = () => {
      setIsPlaying(false);
      postMessageToIframe({ type: 'pause' });
      if (audio) audio.pause();
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      postMessageToIframe({ type: 'timeupdate', time: video.currentTime });
    };

    const handleEnded = () => {
      setIsPlaying(false);
      postMessageToIframe({ type: 'pause' });
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };

    const handleTimeUpdate = () => {
        if (video.paused) {
            setCurrentTime(video.currentTime);
            postMessageToIframe({ type: 'timeupdate', time: video.currentTime });
            if (audio) audio.currentTime = video.currentTime;
        }
    };

    const handleSeeked = () => {
      handleTimeUpdate();
      if (audio) audio.currentTime = video.currentTime;
    }

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('seeked', handleSeeked);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('seeked', handleSeeked);
    };
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
    }
  };

  const restart = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();

      // Force Iframe Reload
      setIframeKey(prev => prev + 1);

      // Reset Audio
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    }
  };

  // --- Export Logic ---
  const handleExport = async () => {
    if (!videoFile) {
      alert('Video file is required for export');
      return;
    }

    setIsExporting(true);
    setExportProgress({ status: 'preparing', progress: 0, message: 'Starting export...' });

    try {
      await exportReelWithFFmpeg(
        {
          videoFile,
          bgMusicFile: bgMusicFile || null,
          htmlContent,
          layoutConfig,
          srtData,
          subtitleConfig: {
            fontSize: subtitleFontSize,
            fontFamily: subtitleFontFamily,
            color: subtitleColor,
            bgColor: subtitleBgColor,
            paddingX: subtitlePaddingX,
            paddingY: subtitlePaddingY
          },
          duration
        },
        setExportProgress
      );
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const openExportModal = () => {
    setShowExportModal(true);
    setExportProgress(null);
    // Re-check server availability
    checkServerHealth().then(setServerAvailable);
  };

  return (
    <div className={`flex flex-col items-center justify-center ${fullScreenMode ? 'fixed inset-0 z-50 bg-black' : 'h-full'}`}>

      <div
        className="relative bg-black overflow-hidden shadow-2xl border border-gray-800"
        style={{
          width: fullScreenMode ? '100vh' : '360px',
          height: fullScreenMode ? '100vh' : '640px',
          aspectRatio: '9/16',
          maxWidth: fullScreenMode ? '100vw' : '100%',
        }}
      >
        <div
          className="absolute top-0 left-0 w-full overflow-hidden bg-gray-900"
          style={layoutStyles.htmlContainer}
        >
          <iframe
            key={iframeKey} // Force Re-render on key change
            ref={iframeRef}
            srcDoc={htmlContent}
            onLoad={handleIframeLoad}
            title="Generated Animation"
            className="w-full h-full border-0 pointer-events-none select-none"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>

        <div
          className="absolute bottom-0 left-0 w-full overflow-hidden bg-black"
          style={layoutStyles.videoContainer}
        >
          {/* Main Video */}
          <video
            key={videoUrl}
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-cover"
            playsInline
            muted={false}
          />
          {/* Background Music - Hidden */}
          <audio
            ref={audioRef}
            loop
          />
        </div>

        {currentCaption && (
          <div style={captionStyle}>
            <div className="relative group max-w-[95%]">
              {!isFullHtml && (
                 <div className="absolute inset-0 bg-black/60 backdrop-blur-md rounded-xl -z-10 shadow-lg border border-white/5" />
              )}
              {renderAnimatedCaption()}
            </div>
          </div>
        )}

        {!fullScreenMode && (
          <div className="absolute bottom-4 left-0 w-full px-4 flex items-center justify-between z-50 opacity-0 hover:opacity-100 transition-opacity">
            <button onClick={togglePlay} className="p-2 bg-white/20 hover:bg-white/40 backdrop-blur rounded-full text-white">
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <span className="text-xs font-mono text-white/80 bg-black/40 px-2 py-1 rounded">
              {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
            </span>
            <button onClick={restart} className="p-2 bg-white/20 hover:bg-white/40 backdrop-blur rounded-full text-white" title="Restart & Reload HTML">
              <RefreshCw size={20} />
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-4">
         <button
          onClick={togglePlay}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        <button
          onClick={toggleFullScreen}
          className="flex items-center gap-2 px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
        >
          {fullScreenMode ? <Minimize size={18} /> : <Maximize size={18} />}
          {fullScreenMode ? 'Exit Fullscreen' : 'Fullscreen Preview'}
        </button>

        <button
          onClick={openExportModal}
          className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-lg font-medium transition-all shadow-lg shadow-emerald-900/30"
        >
          <Download size={18} />
          Export HD
        </button>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => !isExporting && setShowExportModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white disabled:opacity-50"
              disabled={isExporting}
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <Download size={24} className="text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Export HD Video</h3>
                <p className="text-sm text-gray-400">Instagram Reel (1080×1920)</p>
              </div>
            </div>

            {/* Server Status */}
            <div className="mb-6 p-3 rounded-lg border border-gray-800 bg-gray-800/50">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  serverAvailable === null ? 'bg-yellow-500 animate-pulse' :
                  serverAvailable ? 'bg-emerald-500' : 'bg-red-500'
                }`} />
                <span className="text-sm text-gray-300">
                  {serverAvailable === null && 'Checking server...'}
                  {serverAvailable === true && 'Export server connected'}
                  {serverAvailable === false && 'Export server not available'}
                </span>
              </div>
              {serverAvailable === false && (
                <p className="text-xs text-gray-500 mt-2">
                  Make sure the server is running: <code className="text-amber-400">cd server && npm start</code>
                </p>
              )}
            </div>

            {/* Export Features */}
            <div className="mb-6 space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <span className="text-emerald-400">✓</span> High quality 1080p output
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <span className="text-emerald-400">✓</span> No watermarks or quality loss
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <span className="text-emerald-400">✓</span> Embedded subtitles with styling
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <span className="text-emerald-400">✓</span> Background music included
              </div>
            </div>

            {/* Progress */}
            {exportProgress && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">{exportProgress.message}</span>
                  <span className="text-sm font-mono text-emerald-400">{exportProgress.progress}%</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      exportProgress.status === 'error' ? 'bg-red-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                    }`}
                    style={{ width: `${exportProgress.progress}%` }}
                  />
                </div>
                {exportProgress.status === 'complete' && (
                  <p className="text-emerald-400 text-sm mt-3 text-center">
                    ✓ Download started! Check your downloads folder.
                  </p>
                )}
                {exportProgress.status === 'error' && (
                  <p className="text-red-400 text-sm mt-3">
                    ✗ {exportProgress.message}
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors text-gray-300"
                disabled={isExporting}
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={!serverAvailable || isExporting || !videoFile}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed rounded-lg font-bold transition-all flex items-center justify-center gap-2"
              >
                {isExporting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    Start Export
                  </>
                )}
              </button>
            </div>

            {!videoFile && (
              <p className="text-amber-400 text-xs mt-3 text-center">
                Video file is required. Please reload the project with a video.
              </p>
            )}
          </div>
        </div>
      )}

       <div className="mt-2 text-gray-500 text-sm">
         {fullScreenMode && "Press ESC to exit fullscreen"}
       </div>
    </div>
  );
};
