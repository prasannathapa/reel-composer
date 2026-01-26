import React from 'react';
import { ReelPlayer } from './ReelPlayer.tsx';
import { EditorPanel } from './EditorPanel.tsx';
import { GeneratedContent, SRTItem } from '@/types.ts';

interface EditorViewProps {
  videoUrl: string;
  srtData: SRTItem[];
  generatedContent: GeneratedContent;
  isFullScreen: boolean;
  toggleFullScreen: () => void;
  bgMusicUrl?: string;
  bgMusicVolume: number;
  isGenerating: boolean;
  onGenerate: () => void;
  onUpdate: (content: GeneratedContent) => void;
  videoFile: File | null;
  bgMusicFile?: File | null;
  topicContext: string;
  onTopicContextChange: (text: string) => void;
  srtText: string;
  bgMusicName?: string;
  onBgMusicChange: (file: File | null) => void;
  onBgVolumeChange: (vol: number) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  modelName: string;
  setModelName: (name: string) => void;
  onSaveApiKey: () => void;
  subtitleFontSize: number;
  onSubtitleFontSizeChange: (size: number) => void;
  subtitleFontFamily: string;
  onSubtitleFontFamilyChange: (family: string) => void;
  subtitleColor: string;
  onSubtitleColorChange: (color: string) => void;
  subtitleBgColor: string;
  onSubtitleBgColorChange: (color: string) => void;
  subtitlePaddingX: number;
  onSubtitlePaddingXChange: (padding: number) => void;
  subtitlePaddingY: number;
  onSubtitlePaddingYChange: (padding: number) => void;
}

export const EditorView: React.FC<EditorViewProps> = ({
  videoUrl,
  srtData,
  generatedContent,
  isFullScreen,
  toggleFullScreen,
  bgMusicUrl,
  bgMusicVolume,
  isGenerating,
  onGenerate,
  onUpdate,
  videoFile,
  bgMusicFile,
  topicContext,
  onTopicContextChange,
  srtText,
  bgMusicName,
  onBgMusicChange,
  onBgVolumeChange,
  apiKey,
  setApiKey,
  modelName,
  setModelName,
  onSaveApiKey,
  subtitleFontSize,
  onSubtitleFontSizeChange,
  subtitleFontFamily,
  onSubtitleFontFamilyChange,
  subtitleColor,
  onSubtitleColorChange,
  subtitleBgColor,
  onSubtitleBgColorChange,
  subtitlePaddingX,
  onSubtitlePaddingXChange,
  subtitlePaddingY,
  onSubtitlePaddingYChange
}) => {
  return (
    <div className="flex h-full">
      {/* Left: Player */}
      <div
        className={`flex-1 flex flex-col items-center justify-center bg-black/20 relative transition-all duration-300 ${isFullScreen ? 'w-full fixed inset-0 z-50 bg-black' : ''}`}
      >
        <ReelPlayer
          videoUrl={videoUrl}
          srtData={srtData}
          htmlContent={generatedContent.html}
          layoutConfig={generatedContent.layoutConfig}
          fullScreenMode={isFullScreen}
          toggleFullScreen={toggleFullScreen}
          bgMusicUrl={bgMusicUrl}
          bgMusicVolume={bgMusicVolume}
          subtitleFontSize={subtitleFontSize}
          subtitleFontFamily={subtitleFontFamily}
          subtitleColor={subtitleColor}
          subtitleBgColor={subtitleBgColor}
          subtitlePaddingX={subtitlePaddingX}
          subtitlePaddingY={subtitlePaddingY}
          videoFile={videoFile}
          bgMusicFile={bgMusicFile}
        />
      </div>

      {/* Right: Code/Config Editor (Hidden if fullscreen) */}
      {!isFullScreen && (
        <div className="w-[450px] border-l border-gray-800 bg-gray-900 z-10 shadow-2xl">
          <EditorPanel
            content={generatedContent}
            isGenerating={isGenerating}
            onGenerate={onGenerate}
            onUpdate={onUpdate}
            videoFile={videoFile}
            topicContext={topicContext}
            onTopicContextChange={onTopicContextChange}
            srtText={srtText}
            bgMusicName={bgMusicName}
            onBgMusicChange={onBgMusicChange}
            bgMusicVolume={bgMusicVolume}
            onBgVolumeChange={onBgVolumeChange}
            apiKey={apiKey}
            setApiKey={setApiKey}
            modelName={modelName}
            setModelName={setModelName}
            onSaveApiKey={onSaveApiKey}
            subtitleFontSize={subtitleFontSize}
            onSubtitleFontSizeChange={onSubtitleFontSizeChange}
            subtitleFontFamily={subtitleFontFamily}
            onSubtitleFontFamilyChange={onSubtitleFontFamilyChange}
            subtitleColor={subtitleColor}
            onSubtitleColorChange={onSubtitleColorChange}
            subtitleBgColor={subtitleBgColor}
            onSubtitleBgColorChange={onSubtitleBgColorChange}
            subtitlePaddingX={subtitlePaddingX}
            onSubtitlePaddingXChange={onSubtitlePaddingXChange}
            subtitlePaddingY={subtitlePaddingY}
            onSubtitlePaddingYChange={onSubtitlePaddingYChange}
          />
        </div>
      )}
    </div>
  );
};
