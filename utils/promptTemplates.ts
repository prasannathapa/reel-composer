
export const EXAMPLE_TOPIC = "Bloom Filters and Security Architecture (Demo)";

export const EXAMPLE_SRT = `1
00:00:00,000 --> 00:00:00,880
Here's a challenge.

2
00:00:01,120 --> 00:00:02,520
You have to process billions

3
00:00:02,520 --> 00:00:04,000
of events a day with a huge

4
00:00:04,000 --> 00:00:05,200
threat database that cannot

5
00:00:05,200 --> 00:00:06,260
be loaded into your RAM.`;

// --- SIMPLE DEFAULTS FOR MANUAL MODE / FALLBACK ---

export const EXAMPLE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Simple Template</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
<style>
    body { margin: 0; background: #000; color: white; font-family: sans-serif; overflow: hidden; display: flex; align-items: center; justify-content: center; height: 100vh; }
    .container { text-align: center; opacity: 0; transform: scale(0.8); }
    h1 { font-size: 8vmin; color: #00f3ff; text-transform: uppercase; margin: 0; }
    p { font-size: 4vmin; color: #888; margin-top: 2vmin; }
</style>
</head>
<body>
    <div class="container">
        <h1>Manual Mode</h1>
        <p>Start Editing...</p>
    </div>
    <script>
        const tl = gsap.timeline({ paused: true });
        
        // Simple Animation
        tl.to(".container", { opacity: 1, scale: 1, duration: 1, ease: "back.out" });
        tl.to("h1", { color: "#ff0055", duration: 0.5 }, 2);

        // Sync Logic
        window.addEventListener('message', (e) => {
            const { type, time } = e.data;
            if (type === 'timeupdate') tl.seek(time);
            if (type === 'play') tl.play();
            if (type === 'pause') tl.pause();
        });
    </script>
</body>
</html>`;

export const EXAMPLE_JSON = `[
  {
    "startTime": 0,
    "endTime": 100,
    "layoutMode": "split",
    "splitRatio": 0.5,
    "captionPosition": "top",
    "note": "Default Simple Layout"
  }
]`;


// --- HIGH QUALITY REFERENCE FOR PROMPT ENGINEERING ---

const REFERENCE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Bloom Filter Reference</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/TextPlugin.min.js"></script>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&family=Oswald:wght@500;700&display=swap" rel="stylesheet">
<style>
    :root { --bg-deep: #050505; --primary: #00f3ff; --danger: #ff0055; }
    body, html { margin: 0; width: 100%; height: 100%; background: transparent; font-family: 'Oswald', sans-serif; overflow: hidden; color: white; }
    #stage { position: relative; width: 100%; height: 100%; background: radial-gradient(circle at center, #111827 0%, #000000 90%); perspective: 1000px; display: flex; justify-content: center; align-items: center; }
    .scene { position: absolute; opacity: 0; display: flex; flex-direction: column; align-items: center; }
    .h1-mega { font-size: 14vmin; text-shadow: 0 0 30px rgba(0, 243, 255, 0.4); }
    .cell { width: 5vmin; height: 5vmin; border: 1px solid #333; margin: 0.5vmin; display: inline-flex; align-items: center; justify-content: center; font-family: 'JetBrains Mono'; }
    .is-set { background: var(--danger); border-color: var(--danger); box-shadow: 0 0 15px var(--danger); }
</style>
</head>
<body>
<div id="stage">
    <div class="scene" id="s1">
        <h1 class="h1-mega">BLOOM<br>FILTER</h1>
    </div>
    <div class="scene" id="s2">
        <div id="grid" style="display:flex; flex-wrap:wrap; width: 60vmin; justify-content:center;"></div>
    </div>
</div>
<script>
    gsap.registerPlugin(TextPlugin);
    const tl = gsap.timeline({ paused: true });
    
    // Grid Setup
    const grid = document.getElementById('grid');
    for(let i=0; i<10; i++) {
        let d = document.createElement('div'); d.className = 'cell'; d.innerText = 0; grid.appendChild(d);
    }

    // Animation Sequence
    tl.to("#s1", { opacity: 1, duration: 1 });
    tl.to("#s1", { opacity: 0, scale: 1.5, duration: 0.5 }, 3);
    tl.to("#s2", { opacity: 1 }, 3.5);
    tl.to(".cell:nth-child(3)", { background: "#ff0055", text: "1", duration: 0.2 }, 4);

    window.addEventListener('message', (e) => {
        const { type, time } = e.data;
        if (type === 'timeupdate') tl.seek(time);
        if (type === 'play') tl.play();
        if (type === 'pause') tl.pause();
    });
</script>
</body>
</html>`;

const REFERENCE_JSON = `[
{
"startTime": 0,
"endTime": 10,
"layoutMode": "split",
"splitRatio": 0.55,
"captionPosition": "top",
"note": "Intro Title"
},
{
"startTime": 10,
"endTime": 20,
"layoutMode": "split",
"splitRatio": 0.6,
"captionPosition": "bottom",
"note": "Grid Visualization"
}
]`;

export const constructPrompt = (topic: string, srt: string) => {
    return `
I am creating an Instagram Reel that combines a speaker video with dynamic HTML overlays.
I need you to act as a Creative Director and Frontend Developer.

### REFERENCE EXAMPLE (LEARN FROM THIS STYLE AND CODE STRUCTURE)

**Context:** ${EXAMPLE_TOPIC}

**Reference Transcript (SRT):**
${EXAMPLE_SRT}

**Reference Output (HTML/GSAP) - HIGH QUALITY:**
${REFERENCE_HTML}

**Reference Output (Layout JSON) - COMPLEX TIMELINE:**
${REFERENCE_JSON}

---

### NOW GENERATE FOR THE FOLLOWING TASK:

**My Video Topic:**
${topic || "General Content"}

**My Transcript (SRT):**
${srt}

---

REQUEST:
Please provide two separate pieces of code following the Reference Example's quality:

### 1. HTML/CSS/JS Animation
Create a stunning, self-contained HTML file.
- **Libraries:** You MUST use GSAP (GreenSock) for animations.
- **Syncing:** The app sends 'timeupdate', 'play', 'pause' events via window.postMessage. The JS must listen to these.
- **Design:** Dark mode, Neon accents, Glassmorphism. 9:16 Portrait aspect ratio.
- **Code Structure:** NO unescaped newlines in strings. Use template literals.

### 2. Layout Configuration (JSON)
Structure:
[
  {
    "startTime": 0.0,
    "endTime": 10.0,
    "layoutMode": "split", // or "full-video", "full-html"
    "splitRatio": 0.55, 
    "captionPosition": "center"
  }
]
`;
};
