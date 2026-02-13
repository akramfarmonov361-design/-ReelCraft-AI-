import { decodeAndGetAudioBuffer } from './audioUtils';
import type { TimedScriptChunk, WordTiming, VideoQuality, SubtitleStyle } from '../types';

const QUALITY_CONFIGS: Record<VideoQuality, { width: number; height: number }> = {
    '720p': { width: 720, height: 1280 },
    '1080p': { width: 1080, height: 1920 },
};

const loadImage = (url: string): Promise<HTMLImageElement | null> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (err) => {
            console.error(`Failed to load image. It might be a network issue or CORS policy. URL: ${url}`);
            resolve(null);
        };
        img.src = url;
    });
};

const getWrappedLines = (context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const words = text.split(' ');
    let line = '';
    const lines: string[] = [];
    for (const word of words) {
        const testLine = line + word + ' ';
        if (context.measureText(testLine).width > maxWidth && line.length > 0) {
            lines.push(line.trim());
            line = word + ' ';
        } else {
            line = testLine;
        }
    }
    lines.push(line.trim());
    return lines;
}

export const createVideoFromReelContent = async (
    imageUrls: string[],
    audioB64: string,
    title: string,
    timedScript: TimedScriptChunk[],
    quality: VideoQuality = '1080p',
    subtitleStyle?: SubtitleStyle,
    bgMusicB64?: string,
    bgMusicVolume: number = 20
): Promise<{ blob: Blob; fileExtension: 'mp4' | 'webm' }> => {
    const { width, height } = QUALITY_CONFIGS[quality];
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Could not get canvas context');
    }

    const [imagesOrNulls, { buffer: audioBuffer }] = await Promise.all([
        Promise.all(imageUrls.map(loadImage)),
        decodeAndGetAudioBuffer(audioB64, new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 })),
    ]);

    if (imagesOrNulls.every(img => img === null)) {
        throw new Error('All images failed to load, likely due to CORS policy. Cannot create video.');
    }

    const duration = audioBuffer.duration;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const destination = audioContext.createMediaStreamDestination();

    // Main voiceover
    const voiceSource = audioContext.createBufferSource();
    voiceSource.buffer = audioBuffer;
    const voiceGain = audioContext.createGain();
    voiceGain.gain.value = bgMusicB64 ? (1 - bgMusicVolume / 200) : 1; // slightly reduce if bg music
    voiceSource.connect(voiceGain).connect(destination);

    // Background music (if provided)
    let bgSource: AudioBufferSourceNode | undefined;
    if (bgMusicB64) {
        try {
            const bgAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const { buffer: bgBuffer } = await decodeAndGetAudioBuffer(bgMusicB64, bgAudioCtx);
            await bgAudioCtx.close();
            bgSource = audioContext.createBufferSource();
            bgSource.buffer = bgBuffer;
            bgSource.loop = true; // loop bg music to match voiceover duration
            const bgGain = audioContext.createGain();
            bgGain.gain.value = bgMusicVolume / 100;
            bgSource.connect(bgGain).connect(destination);
        } catch (e) {
            console.warn('Background music failed to load, proceeding without it:', e);
        }
    }

    const audioTrack = destination.stream.getAudioTracks()[0];

    const videoStream = canvas.captureStream(30);
    const videoTrack = videoStream.getVideoTracks()[0];

    const combinedStream = new MediaStream([videoTrack, audioTrack]);

    const mp4MimeType = 'video/mp4';
    const webmMimeType = 'video/webm';

    let chosenMimeType: string;
    let fileExtension: 'mp4' | 'webm';

    if (MediaRecorder.isTypeSupported(mp4MimeType)) {
        chosenMimeType = mp4MimeType;
        fileExtension = 'mp4';
    } else {
        console.warn('MP4 recording not supported, falling back to WebM.');
        chosenMimeType = webmMimeType;
        fileExtension = 'webm';
    }

    const recorder = new MediaRecorder(combinedStream, { mimeType: chosenMimeType });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            chunks.push(event.data);
        }
    };

    const recordingPromise = new Promise<{ blob: Blob; fileExtension: 'mp4' | 'webm' }>((resolve, reject) => {
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: chosenMimeType });
            resolve({ blob, fileExtension });
        };
        recorder.onerror = (event) => {
            reject((event as any).error || new Error('MediaRecorder error'));
        }
    });

    recorder.start();
    voiceSource.start();
    if (bgSource) bgSource.start();

    // Capture actual start time — audioContext.currentTime doesn't start at 0
    const audioStartTime = audioContext.currentTime;

    // Use setInterval instead of requestAnimationFrame
    // rAF pauses when tab is inactive, causing stuttering in recorded video
    const FPS = 30;
    const frameInterval = 1000 / FPS;

    // Cache for subtitle layout to avoid expensive measureText every frame
    let lastSubtitleChunk: TimedScriptChunk | null = null;
    let cachedWrappedLines: WordTiming[][] = [];
    let cachedSubtitleBlockStartY: number = 0;

    const drawFrame = () => {
        // Calculate elapsed time relative to when audio actually started
        const elapsedTime = audioContext.currentTime - audioStartTime;

        // Add 0.5s buffer to ensure video doesn't cut off early (audio longer than video fix)
        if (elapsedTime >= duration + 0.5 || recorder.state !== 'recording') {
            clearInterval(frameTimer);
            if (recorder.state === 'recording') {
                recorder.stop();
            }
            if (audioContext.state !== 'closed') {
                voiceSource.stop();
                if (bgSource) try { bgSource.stop(); } catch (_) { }
                audioContext.close();
            }
            return;
        }

        const progress = Math.min(elapsedTime / duration, 1);

        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, width, height);

        const imageCount = imageUrls.length;
        const segmentDuration = duration / imageCount;
        const currentImageIndex = Math.min(Math.floor(elapsedTime / segmentDuration), imageCount - 1);
        const image = imagesOrNulls[currentImageIndex];

        // Safeguard to prevent crash if an image is missing
        if (image) {
            const scale = 1.2;
            const panRange = 0.08;
            const panAmount = -panRange + (2 * panRange * progress);

            const imgRatio = image.width / image.height;
            const canvasRatio = width / height;
            let sw, sh, sx, sy;

            if (imgRatio > canvasRatio) {
                sh = image.height;
                sw = sh * canvasRatio;
                sx = (image.width - sw) / 2;
                sy = 0;
            } else {
                sw = image.width;
                sh = sw / canvasRatio;
                sx = 0;
                sy = (image.height - sh) / 2;
            }

            ctx.save();
            ctx.translate(width / 2, height / 2);
            ctx.scale(scale, scale);
            ctx.translate(panAmount * width, panAmount * height);
            ctx.drawImage(image, sx, sy, sw, sh, -width / 2, -height / 2, width, height);
            ctx.restore();
        }


        ctx.save();
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 10;

        // Draw Subtitles
        const activeSubtitle = timedScript.find(chunk => elapsedTime >= chunk.start && elapsedTime < chunk.end);
        if (activeSubtitle && activeSubtitle.words && activeSubtitle.words.length > 0) {
            const sFont = subtitleStyle?.fontFamily || 'sans-serif';
            const sFontSize = subtitleStyle?.fontSize ? Math.round(subtitleStyle.fontSize * (width / 1080) * 1.8) : 70;
            ctx.font = `bold ${sFontSize}px ${sFont}`;
            ctx.textBaseline = 'top';
            ctx.textAlign = 'left';
            ctx.shadowColor = 'rgba(0, 0, 0, 1)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 3;

            const subtitleMaxWidth = width * 0.9;
            const subtitleLineHeight = sFontSize + 10;

            // Check if we need to recalculate layout
            if (activeSubtitle !== lastSubtitleChunk) {
                let lineBuffer: WordTiming[] = [];
                const wrappedLines: WordTiming[][] = [];
                for (const wordData of activeSubtitle.words) {
                    const currentLineText = lineBuffer.map(w => w.word).join(' ');
                    const testLine = currentLineText ? `${currentLineText} ${wordData.word}` : wordData.word;
                    if (ctx.measureText(testLine).width > subtitleMaxWidth && lineBuffer.length > 0) {
                        wrappedLines.push(lineBuffer);
                        lineBuffer = [wordData];
                    } else {
                        lineBuffer.push(wordData);
                    }
                }
                wrappedLines.push(lineBuffer);

                const totalSubtitleHeight = wrappedLines.length * subtitleLineHeight;
                // Cache the results
                cachedWrappedLines = wrappedLines;
                cachedSubtitleBlockStartY = height * 0.75 - totalSubtitleHeight / 2;
                lastSubtitleChunk = activeSubtitle;
            }

            const wrappedLines = cachedWrappedLines;
            const subtitleBlockStartY = cachedSubtitleBlockStartY;

            // Draw background behind subtitles if enabled
            if (subtitleStyle?.bgEnabled) {
                const bgPadding = 12;
                ctx.fillStyle = subtitleStyle.bgColor || 'rgba(0,0,0,0.6)';
                wrappedLines.forEach((lineOfWords, lineIndex) => {
                    const lineText = lineOfWords.map(w => w.word).join(' ');
                    const lineWidth = ctx.measureText(lineText).width;
                    const bgX = (width - lineWidth) / 2 - bgPadding;
                    const bgY = subtitleBlockStartY + (lineIndex * subtitleLineHeight) - bgPadding / 2;
                    ctx.fillRect(bgX, bgY, lineWidth + bgPadding * 2, subtitleLineHeight + bgPadding / 2);
                });
            }

            wrappedLines.forEach((lineOfWords, lineIndex) => {
                const lineText = lineOfWords.map(w => w.word).join(' ');
                const totalLineWidth = ctx.measureText(lineText).width;
                let currentX = (width - totalLineWidth) / 2;
                const currentY = subtitleBlockStartY + (lineIndex * subtitleLineHeight);

                for (const wordData of lineOfWords) {
                    const hasAppeared = elapsedTime >= wordData.start;
                    const isCurrent = elapsedTime >= wordData.start && elapsedTime < wordData.end;

                    if (hasAppeared) {
                        ctx.fillStyle = isCurrent ? (subtitleStyle?.activeColor || '#FFD700') : (subtitleStyle?.defaultColor || '#FFFFFF');
                        ctx.fillText(wordData.word, currentX, currentY);
                    }
                    currentX += ctx.measureText(wordData.word + ' ').width;
                }
            });
        } else {
            // Reset cache if no active subtitle
            if (lastSubtitleChunk !== null) {
                lastSubtitleChunk = null;
                cachedWrappedLines = [];
            }
        }
        ctx.restore();
    };

    const frameTimer = setInterval(drawFrame, frameInterval);

    return recordingPromise;
};