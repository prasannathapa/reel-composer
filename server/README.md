# Reel Composer Export Server

FFmpeg-based video rendering server for high-quality Instagram reel exports.

## Prerequisites

### 1. Install FFmpeg

**macOS (Homebrew):**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Windows:**
Download from https://ffmpeg.org/download.html and add to PATH.

Verify installation:
```bash
ffmpeg -version
```

### 2. Install Node.js dependencies

```bash
cd server
npm install
```

## Running the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:3001`

## Running with Frontend

From the project root:
```bash
npm start  # Runs both frontend and server concurrently
```

Or run separately:
```bash
# Terminal 1 - Frontend
npm run dev

# Terminal 2 - Server
npm run server
```

## API Endpoints

### Health Check
```
GET /api/health
```

### Export Video
```
POST /api/export
Content-Type: multipart/form-data

Fields:
- video: Video file (required)
- bgMusic: Background music file (optional)
- renderData: JSON string with render configuration
```

## Output Specifications

- **Resolution:** 1080x1920 (Instagram Reel 9:16 aspect ratio)
- **Codec:** H.264 (libx264)
- **Quality:** CRF 18 (high quality)
- **Audio:** AAC 192kbps
- **Format:** MP4 with faststart for web

## Troubleshooting

### FFmpeg not found
Make sure FFmpeg is installed and in your PATH:
```bash
which ffmpeg  # macOS/Linux
where ffmpeg  # Windows
```

### Permission errors
The server creates `uploads/` and `outputs/` directories. Ensure write permissions.

### Large file uploads
The server accepts files up to 500MB. For larger files, increase the limit in `index.js`.
