import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { renderReelWithFFmpeg } from './services/ffmpegRenderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Reel Composer Server is running' });
});

// Export endpoint
app.post('/api/export', upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'bgMusic', maxCount: 1 }
]), async (req, res) => {
  let videoPath = null;
  let bgMusicPath = null;
  let outputPath = null;

  try {
    // Parse request data
    const {
      htmlContent,
      layoutConfig,
      srtData,
      subtitleConfig,
      duration
    } = JSON.parse(req.body.renderData);

    // Get file paths
    if (!req.files || !req.files['video']) {
      throw new Error('Video file is required');
    }
    
    videoPath = req.files['video'][0].path;
    bgMusicPath = req.files['bgMusic'] ? req.files['bgMusic'][0].path : null;

    console.log('Starting render with config:', {
      videoPath,
      bgMusicPath,
      duration,
      layoutSteps: layoutConfig?.length || 0,
      srtItems: srtData?.length || 0
    });

    // Render the video
    outputPath = await renderReelWithFFmpeg({
      videoPath,
      bgMusicPath,
      htmlContent,
      layoutConfig,
      srtData,
      subtitleConfig,
      duration
    });

    // Send the rendered file
    res.download(outputPath, `reel-export-${Date.now()}.mp4`, async (err) => {
      // Cleanup files after download
      await cleanupFiles([videoPath, bgMusicPath, outputPath]);
      
      if (err) {
        console.error('Download error:', err);
      }
    });

  } catch (error) {
    console.error('Export error:', error);
    
    // Cleanup on error
    await cleanupFiles([videoPath, bgMusicPath, outputPath]);
    
    res.status(500).json({ 
      error: 'Export failed', 
      message: error.message 
    });
  }
});

// Cleanup helper
async function cleanupFiles(files) {
  for (const file of files) {
    if (file) {
      try {
        await fs.unlink(file);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

// Serve static files from output directory (for development)
app.use('/outputs', express.static(path.join(__dirname, 'outputs')));

app.listen(PORT, () => {
  console.log(`🎬 Reel Composer Server running on http://localhost:${PORT}`);
});
