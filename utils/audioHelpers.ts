
export const extractAudioBlob = async (videoFile: File): Promise<Blob> => {
  try {
    const arrayBuffer = await videoFile.arrayBuffer();
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    
    // WAV Encoder
    const numOfChan = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let i;
    let sample;
    let offset = 0;
    let pos = 0;

    const setUint16 = (data: any) => {
      view.setUint16(pos, data, true);
      pos += 2;
    };
    const setUint32 = (data: any) => {
      view.setUint32(pos, data, true);
      pos += 4;
    };

    setUint32(0x46464952); // "RIFF"
    setUint32(36 + audioBuffer.length * numOfChan * 2); 
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt " 
    setUint32(16); 
    setUint16(1); // PCM 
    setUint16(numOfChan);
    setUint32(audioBuffer.sampleRate);
    setUint32(audioBuffer.sampleRate * 2 * numOfChan); 
    setUint16(numOfChan * 2); 
    setUint16(16); 
    setUint32(0x61746164); // "data" 
    setUint32(audioBuffer.length * numOfChan * 2); 

    for(i = 0; i < audioBuffer.numberOfChannels; i++)
      channels.push(audioBuffer.getChannelData(i));

    while(pos < audioBuffer.length) {
      for(i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][pos])); 
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; 
        view.setInt16(44 + offset, sample, true);
        offset += 2;
      }
      pos++;
    }

    return new Blob([buffer], {type: "audio/wav"});
    
  } catch (e) {
    console.error("Audio extraction error:", e);
    throw new Error("Failed to extract audio. Browser may not support decoding this video format.");
  }
};

export const extractWavFromVideo = async (videoFile: File): Promise<void> => {
    const blob = await extractAudioBlob(videoFile);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extracted_audio_${Date.now()}.wav`;
    a.click();
    URL.revokeObjectURL(url);
};

export const fileToBase64 = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data url prefix (e.g. "data:audio/mp3;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

export const pcmToWav = (pcmData: Uint8Array, sampleRate: number = 24000, numChannels: number = 1): Blob => {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const totalDataLen = pcmData.length;

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + totalDataLen, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * numChannels * 2, true); // ByteRate
  view.setUint16(32, numChannels * 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, totalDataLen, true);

  const blob = new Blob([header, pcmData], { type: 'audio/wav' });
  return blob;
};
