import React, { useState, useRef, useEffect, useCallback } from 'react';
import { decodeAndGetAudioBuffer } from '../utils/audioUtils';
import { IconComponents } from './IconComponents';
import type { TimedScriptChunk, SubtitleStyle } from '../types';

interface ReelPreviewProps {
  imageUrls: string[];
  audioB64: string;
  title: string;
  timedScript: TimedScriptChunk[];
  subtitleStyle?: SubtitleStyle;
  bgMusicB64?: string;
  bgMusicVolume?: number;
}

export const ReelPreview: React.FC<ReelPreviewProps> = ({ imageUrls, audioB64, title, timedScript, subtitleStyle, bgMusicB64, bgMusicVolume = 20 }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const animationFrameRef = useRef<number>(0);
  const playbackStartTimeRef = useRef<number>(0);

  // Use refs for values accessed inside animation loop to avoid stale closures
  const isPlayingRef = useRef(false);
  const durationRef = useRef(0);
  const imageUrlsRef = useRef(imageUrls);
  const activeImageIndexRef = useRef(0);

  // Keep refs in sync with state/props
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { durationRef.current = duration; }, [duration]);
  useEffect(() => { imageUrlsRef.current = imageUrls; }, [imageUrls]);

  // Preload all images on mount / when imageUrls change
  useEffect(() => {
    imageUrls.forEach(url => {
      const img = new Image();
      img.src = url;
    });
  }, [imageUrls]);

  // Reset active index when imageUrls prop changes
  useEffect(() => {
    setActiveImageIndex(0);
    activeImageIndexRef.current = 0;
  }, [imageUrls]);

  const animationLoop = useCallback(() => {
    if (!audioContextRef.current || !isPlayingRef.current || durationRef.current === 0) return;

    const elapsedTime = audioContextRef.current.currentTime - playbackStartTimeRef.current;
    setPlaybackTime(elapsedTime);

    // Dynamically update image based on playback progress
    const urls = imageUrlsRef.current;
    const imageCount = urls.length;
    const segmentDuration = durationRef.current / imageCount;
    const newIndex = Math.min(Math.floor(elapsedTime / segmentDuration), imageCount - 1);

    if (newIndex !== activeImageIndexRef.current) {
      activeImageIndexRef.current = newIndex;
      setActiveImageIndex(newIndex);
    }

    animationFrameRef.current = requestAnimationFrame(animationLoop);
  }, []); // No dependencies — everything is read from refs

  const stopAnimationLoop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setPlaybackTime(0);
  }, []);

  useEffect(() => {
    const setupAudio = async () => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          gainNodeRef.current = audioContextRef.current.createGain();
          gainNodeRef.current.connect(audioContextRef.current.destination);
        }
        const { buffer, duration: audioDuration } = await decodeAndGetAudioBuffer(audioB64, audioContextRef.current);
        audioBufferRef.current = buffer;
        setDuration(audioDuration);
        setIsReady(true);
      } catch (error) {
        console.error("Failed to decode audio:", error);
        setIsReady(false);
      }
    };
    setupAudio();

    return () => {
      audioSourceRef.current?.stop();
      audioSourceRef.current?.disconnect();
      stopAnimationLoop();
    };
  }, [audioB64, stopAnimationLoop]);

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(animationLoop);
    } else {
      stopAnimationLoop();
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, animationLoop, stopAnimationLoop]);

  const playAudio = () => {
    if (!audioContextRef.current || !audioBufferRef.current || !gainNodeRef.current) return;

    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch (e) { }
      try { audioSourceRef.current.disconnect(); } catch (e) { }
    }

    audioSourceRef.current = audioContextRef.current.createBufferSource();
    audioSourceRef.current.buffer = audioBufferRef.current;
    audioSourceRef.current.connect(gainNodeRef.current);

    playbackStartTimeRef.current = audioContextRef.current.currentTime;
    audioSourceRef.current.start(0);

    audioSourceRef.current.onended = () => {
      setIsPlaying(false);
      setActiveImageIndex(0);
      activeImageIndexRef.current = 0;
      setPlaybackTime(0);
    };
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      if (audioSourceRef.current) {
        try { audioSourceRef.current.stop(); } catch (e) { }
      }
      setIsPlaying(false);
      setPlaybackTime(0);
      setActiveImageIndex(0);
      activeImageIndexRef.current = 0;
    } else {
      if (!isReady) return;
      playAudio();
      setIsPlaying(true);
    }
  };

  const handleMuteToggle = () => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isMuted ? 1 : 0;
      setIsMuted(!isMuted);
    }
  };

  const activeChunk = isPlaying ? timedScript.find(chunk => playbackTime >= chunk.start && playbackTime < chunk.end) : null;

  return (
    <div className="aspect-[9/16] w-full max-w-[300px] mx-auto bg-black rounded-3xl shadow-2xl overflow-hidden relative border-4 border-slate-700">
      {/* Crossfade image layers — all images rendered, only active one is visible */}
      {imageUrls.map((url, index) => (
        <img
          key={url}
          src={url}
          alt={`Rasm ${index + 1}`}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: index === activeImageIndex ? 1 : 0,
            transition: 'opacity 0.6s ease-in-out',
            transform: isPlaying ? `scale(1.15)` : 'scale(1)',
            animation: isPlaying ? `ken-burns ${duration}s linear forwards` : 'none',
          }}
        />
      ))}

      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>

      <div className="absolute inset-0 p-6 flex items-end pb-[20%] justify-center pointer-events-none text-center">
        {isPlaying && activeChunk ? (
          <p
            key={activeChunk.text}
            className="text-2xl lg:text-3xl font-bold"
            style={{ textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 3px 3px 6px rgba(0,0,0,0.8)' }}
          >
            {activeChunk.words.map((wordData, index) => {
              const hasAppeared = playbackTime >= wordData.start;
              const isCurrent = playbackTime >= wordData.start && playbackTime < wordData.end;

              const colorStyle = hasAppeared
                ? (isCurrent
                  ? { color: subtitleStyle?.activeColor || '#facc15' }
                  : { color: subtitleStyle?.defaultColor || '#ffffff' })
                : { color: 'transparent' };

              return (
                <span key={index} className="transition-colors duration-100" style={{ ...colorStyle, fontFamily: subtitleStyle?.fontFamily || 'inherit' }}>
                  {wordData.word}{' '}
                </span>
              );
            })}
          </p>
        ) : (
          <h2 className="text-white text-3xl font-bold" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.8)' }}>
            {title}
          </h2>
        )}
      </div>

      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <IconComponents.LoaderIcon className="w-10 h-10 text-white animate-spin" />
        </div>
      )}

      {isReady && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={handlePlayPause}
            className="w-20 h-20 rounded-full bg-black/40 text-white flex items-center justify-center backdrop-blur-sm transition hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white"
            aria-label={isPlaying ? "Pauza" : "O'ynatish"}
          >
            {isPlaying ? <IconComponents.PauseIcon className="w-12 h-12" /> : <IconComponents.PlayIcon className="w-12 h-12 pl-1" />}
          </button>
        </div>
      )}

      <div className="absolute bottom-4 right-4">
        <button
          onClick={handleMuteToggle}
          className="w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center backdrop-blur-sm transition hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white"
          aria-label={isMuted ? "Ovozni yoqish" : "Ovozni o'chirish"}
        >
          {isMuted ? <IconComponents.MutedIcon className="w-6 h-6" /> : <svg xmlns="http://www.w.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>}
        </button>
      </div>

    </div>
  );
};