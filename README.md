# Reel Composer

[![reel-composer-banner.png](https://i.postimg.cc/NMjTQJ7D/reel-composer-banner.png)](https://postimg.cc/XZtX8gPB)

**Reel Composer** is a "Director's Studio" that transforms raw talking-head footage into high-retention "Edutainment" content (Instagram Reels / TikToks / YouTube Shorts).

It leverages **Google Gemini 2.0/2.5** to intelligently analyze your transcript and generate synchronized, broadcast-quality HTML5/GSAP animations that overlay your video.

---

## 🧠 The Philosophy: Quantity > Perfectionism

> _"In the world of algorithms, Volume is Leverage."_

To grow on social media, you must understand the **Statistics of Virality**.

### 1. The Probabilistic Reality

Going viral is a probabilistic event. It is a lottery where every video you post is a ticket.

- **Low Volume:** Posting 1 "Perfect" video a month = 12 chances/year.
- **High Volume:** Posting 1 "Good Enough" video a day = 365 chances/year.

### 2. The Credibility Trap

Usually, increasing volume means sacrificing quality. However, low-quality content hurts your authority (Credibility).

- **The Dilemma:** High-end motion graphics (Edutainment) build trust but take days to edit in After Effects.
- **The Solution:** **Reel Composer** automates the "Credibility Layer."

### 3. Automating Authority

This tool bridges the gap. It allows you to produce **High-Retention, Visually Intellectual Content** at the **Volume** required for statistical growth.

- **Don't compromise on Credibility.**
- **Don't compromise on Volume.**
- **Let AI handle the pixels.**

---

## 🎬 The "Pro" Workflow

To achieve the highest quality output, follow this content creation pipeline:

### 1. Record & Clean

Record your video. If you are recording in a noisy environment, pass your audio through **[Adobe Podcast Enhance](https://podcast.adobe.com/enhance)** to get studio-quality sound.

### 2. Transcribe (.SRT)

Generative AI needs context. Convert your video/audio into an SRT subtitle file.

- _Recommended Tool:_ **[zapsubs.com](https://www.zapsubs.com/)** or standard video editing software.

### 3. Compose (This App)

1.  **Upload:** Drop your Video and SRT file into Reel Composer.
2.  **Director's Brief:** (Optional) Describe the visual context (e.g., "I want a cyberpunk grid appearing when I say 'Matrix'").
3.  **Generate:** The app uses Gemini to generate a custom HTML animation layer and a dynamic split-screen layout JSON.

### 4. Refine with LLMs

The built-in editor allows you to tweak the code.

- _Workflow Tip:_ If the animation isn't quite right, copy the generated code, paste it into **ChatGPT/Claude/Gemini**, and say: _"Make the particles faster"_ or _"Change the color to green"_. Paste the updated code back into the Editor Panel.

### 5. Export

Record the final composition directly from the browser to get a polished `.webm` or `.mp4` file ready for social media.

- _Recommended Tool:_ **[OBS Studio](https://obsproject.com/)** or standard screen recording software to capture the playback.

---

## 🚀 Getting Started

This is a pure frontend application. No backend server is required.

### Prerequisites

- Node.js (v18+)

### Installation

```bash
# Clone the repository
git clone https://github.com/prasannathapa/reel-composer.git

# Install dependencies
npm install

# Run the development server
npm run dev
```

### API Key Configuration

**Note:** This repository does not include a live API key. You must provide your own **Google Gemini API Key**.

You can configure this in two ways:

1.  **Config File (Recommended for Dev):**
    Open `config.ts` and paste your key into `DEFAULT_API_KEY`.

    ```typescript
    export const APP_CONFIG = {
      DEFAULT_API_KEY: "PASTE_YOUR_KEY_HERE",
      // ...
    };
    ```

2.  **UI Settings (Portable):**
    Enter your key directly in the application's **Settings Panel** (Internal Generator section). The key is stored securely in your browser's `localStorage`.

---

## 🛠️ Tech Stack

- **Framework:** React 19 + TypeScript
- **Styling:** Tailwind CSS
- **AI Integration:** Google GenAI SDK (Gemini 2.5 Flash / Pro)
- **Animation Engine:** GSAP (GreenSock Animation Platform)
- **Icons:** Lucide React

---

## 👨‍💻 About the Author

![Prasanna Thapa](https://prasannathapa.in/banner.jpg)
**Prasanna Thapa**  
_Technical Architect / Software Engineer at Zoho_

I build tools that bridge the gap between creative expression and software engineering.

- 🌐 **Website:** [prasannathapa.in](https://prasannathapa.in/)
- 📝 **Blog:** [blog.prasannathapa.in](https://blog.prasannathapa.in)
- 🐙 **GitHub:** [@prasannathapa](https://github.com/prasannathapa)
- 💼 **LinkedIn:** [in/prasannathapa](https://www.linkedin.com/in/prasannathapa)
- 📸 **Instagram:** [@prasanna_thapa](https://instagram.com/prasanna_thapa)

---

_Built with ❤️ for creators._
