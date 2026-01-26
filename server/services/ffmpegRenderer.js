import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Instagram Reel dimensions (9:16 aspect ratio)
const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1920;

/**
 * Render a reel using FFmpeg
 * This creates a high-quality Instagram reel with:
 * - Video scaled to 1080x1920
 * - Styled subtitles (ASS format)
 * - Background music mixed with original audio
 */
export async function renderReelWithFFmpeg({
  videoPath,
  bgMusicPath,
  htmlContent,
  layoutConfig,
  srtData,
  subtitleConfig,
  duration
}) {
  const outputDir = path.join(__dirname, '..', 'outputs');
  await fs.mkdir(outputDir, { recursive: true });
  
  const timestamp = Date.now();
  const assPath = path.join(outputDir, `subtitles-${timestamp}.ass`);
  const outputPath = path.join(outputDir, `reel-${timestamp}.mp4`);

  try {
    console.log('📝 Generating subtitle file...');
    await generateAssSubtitles(srtData, subtitleConfig, assPath, layoutConfig);

    console.log('🎬 Rendering video with FFmpeg...');
    await renderWithFFmpeg({
      videoPath,
      bgMusicPath,
      assPath,
      outputPath,
      duration
    });

    // Cleanup subtitle file
    await fs.unlink(assPath).catch(() => {});

    console.log('✅ Render complete:', outputPath);
    return outputPath;

  } catch (error) {
    // Cleanup on error
    await fs.unlink(assPath).catch(() => {});
    throw error;
  }
}

/**
 * Generate ASS subtitle file with word-by-word highlighting
 */
async function generateAssSubtitles(srtData, subtitleConfig, outputPath, layoutConfig) {
  const {
    fontSize = 32,
    fontFamily = 'Arial',
    color = '#FFFFFF',
    bgColor = 'rgba(0,0,0,0.8)',
    paddingX = 16,
    paddingY = 8
  } = subtitleConfig || {};

  // Scale font size for 1080p
  const scaledFontSize = Math.round(fontSize * (OUTPUT_WIDTH / 360));

  // Convert colors to ASS format
  const primaryColor = hexToAssColor(color);
  const highlightColor = hexToAssColor('#fbbf24'); // Amber highlight
  const outlineColor = '&H00000000';
  const backColor = rgbaToAssColor(bgColor);

  // Calculate vertical margin based on layout
  // Default to center of screen
  let marginV = Math.round(OUTPUT_HEIGHT * 0.5);
  
  // Try to get the most common split ratio from layout config
  if (layoutConfig && layoutConfig.length > 0) {
    const splitLayout = layoutConfig.find(l => l.layoutMode === 'split');
    if (splitLayout && splitLayout.splitRatio) {
      marginV = Math.round(OUTPUT_HEIGHT * splitLayout.splitRatio);
    }
  }

  const header = `[Script Info]
Title: Reel Subtitles
ScriptType: v4.00+
PlayResX: ${OUTPUT_WIDTH}
PlayResY: ${OUTPUT_HEIGHT}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontFamily},${scaledFontSize},${primaryColor},${highlightColor},${outlineColor},${backColor},-1,0,0,0,100,100,0,0,3,4,2,5,${paddingX * 3},${paddingX * 3},${paddingY * 3},1
Style: Highlight,${fontFamily},${Math.round(scaledFontSize * 1.1)},${highlightColor},${highlightColor},${outlineColor},${backColor},-1,0,0,0,100,100,0,0,3,4,2,5,${paddingX * 3},${paddingX * 3},${paddingY * 3},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  // Generate events with word-by-word animation
  const events = [];
  
  for (const item of srtData) {
    const words = item.text.split(' ');
    const duration = item.endTime - item.startTime;
    const wordDuration = duration / words.length;
    
    // Create a single dialogue line with karaoke-style highlighting
    const start = formatAssTime(item.startTime);
    const end = formatAssTime(item.endTime);
    
    // Build karaoke text with timing
    let karaokeText = '';
    words.forEach((word, index) => {
      const wordMs = Math.round(wordDuration * 100); // centiseconds
      karaokeText += `{\\k${wordMs}}${word} `;
    });
    
    // Add position override for dynamic positioning
    const posY = marginV;
    const positionTag = `{\\pos(${OUTPUT_WIDTH / 2},${posY})}`;
    
    events.push(`Dialogue: 0,${start},${end},Default,,0,0,0,karaoke,${positionTag}${karaokeText.trim()}`);
  }

  await fs.writeFile(outputPath, header + events.join('\n'));
}

/**
 * Convert hex color to ASS format (&HAABBGGRR)
 */
function hexToAssColor(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  const r = hex.substring(0, 2);
  const g = hex.substring(2, 4);
  const b = hex.substring(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

/**
 * Convert rgba to ASS format with alpha
 */
function rgbaToAssColor(rgba) {
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
  if (match) {
    const r = parseInt(match[1]).toString(16).padStart(2, '0');
    const g = parseInt(match[2]).toString(16).padStart(2, '0');
    const b = parseInt(match[3]).toString(16).padStart(2, '0');
    const alpha = match[4] ? Math.round((1 - parseFloat(match[4])) * 255) : 0;
    const a = alpha.toString(16).padStart(2, '0');
    return `&H${a}${b}${g}${r}`.toUpperCase();
  }
  return '&H80000000';
}

/**
 * Format time for ASS (H:MM:SS.CC)
 */
function formatAssTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.round((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/**
 * Render the final video with FFmpeg
 */
async function renderWithFFmpeg({ videoPath, bgMusicPath, assPath, outputPath, duration }) {
  return new Promise((resolve, reject) => {
    // Escape the ASS path for FFmpeg filter
    const escapedAssPath = assPath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "'\\''");
    
    // Build filter complex
    let filterComplex = '';
    
    // Scale video to Instagram Reel dimensions (1080x1920)
    // Use crop and scale to fit 9:16 aspect ratio
    filterComplex += `[0:v]scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:force_original_aspect_ratio=increase,`;
    filterComplex += `crop=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT},`;
    filterComplex += `setsar=1,`;
    // Add subtitles
    filterComplex += `ass='${escapedAssPath}'[outv]`;
    
    // Audio mixing
    let audioMap;
    if (bgMusicPath) {
      // Mix original audio with background music
      filterComplex += `;[0:a]volume=1[a0];[1:a]volume=0.3,aloop=loop=-1:size=2e9[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=2[outa]`;
      audioMap = '[outa]';
    } else {
      audioMap = '0:a?';
    }

    const args = [
      '-y', // Overwrite output
      '-i', videoPath, // Input video
    ];

    // Add background music input if provided
    if (bgMusicPath) {
      args.push('-i', bgMusicPath);
    }

    args.push(
      '-filter_complex', filterComplex,
      '-map', '[outv]',
      '-map', audioMap,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '18', // High quality (lower = better, 18-23 is good)
      '-profile:v', 'high',
      '-level', '4.0',
      '-pix_fmt', 'yuv420p', // Compatibility
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '48000',
      '-movflags', '+faststart', // Web optimization
    );

    // Add duration limit if specified
    if (duration && duration > 0) {
      args.push('-t', String(duration));
    }

    args.push(outputPath);

    console.log('FFmpeg command:', 'ffmpeg', args.join(' '));

    const ffmpeg = spawn('ffmpeg', args);

    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
      // Log progress
      const timeMatch = data.toString().match(/time=(\d+:\d+:\d+\.\d+)/);
      if (timeMatch) {
        process.stdout.write(`\r  Encoding: ${timeMatch[1]}`);
      }
    });

    ffmpeg.on('close', (code) => {
      console.log(''); // New line after progress
      if (code === 0) {
        resolve(outputPath);
      } else {
        console.error('FFmpeg stderr:', stderr.slice(-1000));
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`FFmpeg error: ${err.message}. Make sure FFmpeg is installed.`));
    });
  });
}
