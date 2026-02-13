
function decodeBase64(base64: string): Uint8Array {
  // Remove Data URI prefix if present (e.g. "data:audio/mp3;base64,")
  const cleanBase64 = base64.replace(/^data:.*?;base64,/, '');
  const binaryString = atob(cleanBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeRawPCM(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export async function decodeAndGetAudioBuffer(base64: string, ctx: AudioContext): Promise<{buffer: AudioBuffer, duration: number}> {
    // Determine if input is a Data URI (uploaded file) or Raw PCM (Gemini output)
    const isDataUri = base64.trim().startsWith('data:');
    
    const byteData = decodeBase64(base64);

    if (isDataUri) {
        // For uploaded files (mp3, wav, etc.), use the browser's native decoder.
        // We use slice(0) to create a copy of the buffer because decodeAudioData takes ownership/detaches it.
        const audioBuffer = await ctx.decodeAudioData(byteData.buffer.slice(0));
        return { buffer: audioBuffer, duration: audioBuffer.duration };
    } else {
        // For Gemini TTS/Live API, the output is Raw 24kHz Mono PCM (Int16)
        const audioBuffer = await decodeRawPCM(
            byteData,
            ctx,
            24000, 
            1 
        );
        return { buffer: audioBuffer, duration: audioBuffer.duration };
    }
}
