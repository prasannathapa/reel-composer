import React, { useEffect, useRef, useState, useMemo } from 'react';
import { LayoutConfigStep, SRTItem } from '../types';
import { Play, Pause, RefreshCw, Maximize, Minimize, Video, StopCircle, X, AlertTriangle, Monitor } from 'lucide-react';

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
  bgMusicVolume = 0.2
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [showExportInfo, setShowExportInfo] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  
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
        className={`flex flex-wrap justify-center items-center gap-x-1.5 gap-y-1 px-4 py-2 rounded-2xl transition-all duration-300 ${isFullHtml ? 'bg-black/80 backdrop-blur-md border border-white/10 shadow-2xl' : ''}`}
        style={{ minHeight: '60px' }} // STABILITY: Prevent layout shifts
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
                transition-all duration-150 inline-block text-2xl md:text-2xl font-black tracking-wide leading-tight
                ${isActive ? 'text-yellow-400 scale-110' : ''}
                ${isPast ? 'text-white' : 'text-white/40'}
              `}
              style={{
                textShadow: isActive 
                    ? '0 0 30px rgba(250, 204, 21, 0.6), 2px 2px 0px rgba(0,0,0,1)' 
                    : '2px 2px 0px rgba(0,0,0,0.8)'
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
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
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

  // --- Recording Logic ---
  const getSupportedMimeType = () => {
    if (typeof MediaRecorder === 'undefined') return '';
    const types = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4'
    ];
    return types.find(type => MediaRecorder.isTypeSupported(type)) || '';
  };

  const startRecording = async () => {
    try {
      const mimeType = getSupportedMimeType();
      if (!mimeType) {
        alert("Your browser does not support valid video recording formats.");
        return;
      }

      if (!fullScreenMode) {
        toggleFullScreen();
        await new Promise(r => setTimeout(r, 500)); 
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: true,
        preferCurrentTab: true, 
      } as any);

      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        a.download = `reel-export-${Date.now()}.${ext}`;
        a.click();
        
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(e => console.warn("Auto-play blocked", e));
        setIframeKey(prev => prev + 1); // Also reset iframe on recording start
      }

    } catch (err) {
      console.error("Recording failed", err);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (videoRef.current) videoRef.current.pause();
    }
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
          cursor: isRecording ? 'none' : 'default'
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

        {!fullScreenMode && !isRecording && (
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

      {!isRecording && (
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
            onClick={() => setShowExportInfo(true)}
            className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-medium transition-colors shadow-lg shadow-red-900/20"
          >
            <Video size={18} />
            Rec & Export
          </button>
        </div>
      )}

      {/* Export Information Modal */}
      {showExportInfo && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
           <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full shadow-2xl relative">
              <button 
                onClick={() => setShowExportInfo(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-4 text-amber-500">
                <AlertTriangle size={24} />
                <h3 className="text-lg font-bold text-white">Export Unavailable</h3>
              </div>
              
              <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                Server-side FFmpeg recording is currently <strong>disabled</strong> for the Public Preview.
              </p>
              
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-6 text-xs text-red-200 font-mono">
                 "Running video rendering for everyone for free would melt my servers! 🔥"
              </div>

              <div className="bg-black/40 p-4 rounded-lg border border-gray-800 mb-6">
                <h4 className="font-bold text-white text-sm mb-2 flex items-center gap-2">
                   <Monitor size={14} className="text-purple-400"/> Recommendation:
                </h4>
                <p className="text-xs text-gray-400">
                  Use <strong>OBS Studio</strong> or your system's screen recorder to capture the playback in high quality.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                 <button 
                   onClick={() => setShowExportInfo(false)}
                   className="w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors text-sm"
                 >
                   Got it, I'll use OBS
                 </button>
                 
                 <button
                   onClick={() => {
                     setShowExportInfo(false);
                     startRecording();
                   }}
                   className="text-[10px] text-gray-500 hover:text-gray-300 underline"
                 >
                   Try Browser Recorder (Experimental/Client-Side)
                 </button>
              </div>
           </div>
        </div>
      )}

      {isRecording && (
        <div className="fixed top-4 right-4 z-[100]">
           <button 
            onClick={stopRecording}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-full font-bold shadow-2xl animate-pulse"
          >
            <StopCircle size={20} />
            Stop Recording
          </button>
        </div>
      )}

       <div className="mt-2 text-gray-500 text-sm">
         {!isRecording && fullScreenMode && "Press ESC to exit fullscreen"}
         {isRecording && "Recording in progress... content will auto-download on finish."}
       </div>
    </div>
  );
};