import { LayoutConfigStep, SRTItem } from '@/types.ts';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface ExportConfig {
  videoFile: File;
  bgMusicFile?: File | null;
  htmlContent: string;
  layoutConfig: LayoutConfigStep[];
  srtData: SRTItem[];
  subtitleConfig: {
    fontSize: number;
    fontFamily: string;
    color: string;
    bgColor: string;
    paddingX: number;
    paddingY: number;
  };
  duration: number;
}

export interface ExportProgress {
  status: 'preparing' | 'uploading' | 'rendering' | 'downloading' | 'complete' | 'error';
  progress: number;
  message: string;
}

/**
 * Export reel using server-side FFmpeg rendering
 */
export async function exportReelWithFFmpeg(
  config: ExportConfig,
  onProgress: (progress: ExportProgress) => void
): Promise<void> {
  try {
    onProgress({ status: 'preparing', progress: 5, message: 'Preparing files...' });

    // Create form data
    const formData = new FormData();
    formData.append('video', config.videoFile);
    
    if (config.bgMusicFile) {
      formData.append('bgMusic', config.bgMusicFile);
    }

    // Add render data as JSON
    const renderData = {
      htmlContent: config.htmlContent,
      layoutConfig: config.layoutConfig,
      srtData: config.srtData,
      subtitleConfig: config.subtitleConfig,
      duration: config.duration
    };
    formData.append('renderData', JSON.stringify(renderData));

    onProgress({ status: 'uploading', progress: 15, message: 'Uploading files to server...' });

    // Make the request
    const response = await fetch(`${API_BASE_URL}/api/export`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Export failed' }));
      throw new Error(error.message || 'Export failed');
    }

    onProgress({ status: 'rendering', progress: 50, message: 'Rendering video with FFmpeg...' });

    // Get the blob
    const blob = await response.blob();

    onProgress({ status: 'downloading', progress: 90, message: 'Preparing download...' });

    // Download the file
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reel-export-${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onProgress({ status: 'complete', progress: 100, message: 'Export complete!' });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed';
    onProgress({ status: 'error', progress: 0, message });
    throw error;
  }
}

/**
 * Check if the export server is available
 */
export async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch {
    return false;
  }
}
