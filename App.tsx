
import React, { useState, useCallback, useEffect } from 'react';
import { generateScriptAndImagePrompt, generateImage, generateAudio, generateTrendingTopics, findImageUrls, analyzeAudioContent } from './services/geminiService';
import type { GenerationStatus, ProgressStep, ReelContent, VoiceOption, TopicCategory, TimedScriptChunk, WordTiming, ImageSourceOption, AudioSourceOption, VideoQuality, SubtitleStyle, ContentLanguage } from './types';
import { initialProgressSteps, availableVoices } from './constants';
import { ReelPreview } from './components/ReelPreview';
import { IconComponents } from './components/IconComponents';
import { ProgressTracker } from './components/ProgressTracker';
import { SubtitleStylePicker } from './components/SubtitleStylePicker';
import { createVideoFromReelContent } from './utils/videoGenerator';
import { TrendingTopicsModal } from './components/TrendingTopicsModal';
import { decodeAndGetAudioBuffer } from './utils/audioUtils';
import { logoB64 } from './assets/logo';

const MAX_WORDS_PER_SUBTITLE = 4;

const splitIntoChunks = (text: string, maxWords: number): string[] => {
    const words = text.split(' ');
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += maxWords) {
        chunks.push(words.slice(i, i + maxWords).join(' '));
    }
    return chunks;
};

const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
    fontFamily: 'Arial, sans-serif',
    fontSize: 36,
    activeColor: '#FFD700',
    defaultColor: '#FFFFFF',
    bgEnabled: true,
    bgColor: 'rgba(0,0,0,0.6)',
};

const App: React.FC = () => {
    const [topic, setTopic] = useState<string>('');
    const [useGoogleSearch, setUseGoogleSearch] = useState<boolean>(false);
    const [selectedVoice, setSelectedVoice] = useState<VoiceOption>('Umbriel');
    const [status, setStatus] = useState<GenerationStatus>('IDLE');
    const [progress, setProgress] = useState<ProgressStep[]>(initialProgressSteps);
    const [reelContent, setReelContent] = useState<Partial<ReelContent> | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    const [copySuccess, setCopySuccess] = useState<string>('');
    const [failedStep, setFailedStep] = useState<ProgressStep['id'] | null>(null);

    // State for image source selection
    const [imageSource, setImageSource] = useState<ImageSourceOption>('generate');
    const [uploadedImagesB64, setUploadedImagesB64] = useState<string[]>([]);

    // State for audio source selection
    const [audioSource, setAudioSource] = useState<AudioSourceOption>('generate');
    const [uploadedAudioB64, setUploadedAudioB64] = useState<string | null>(null);


    // State for trending topics feature
    const [isTopicsModalOpen, setIsTopicsModalOpen] = useState<boolean>(false);
    const [trendingTopics, setTrendingTopics] = useState<TopicCategory[]>([]);
    const [isTopicsLoading, setIsTopicsLoading] = useState<boolean>(false);
    const [topicsError, setTopicsError] = useState<string | null>(null);

    // Phase 2: Drag & Drop
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

    // Phase 2: Video Quality
    const [videoQuality, setVideoQuality] = useState<VideoQuality>('1080p');

    // Content Language
    const [contentLanguage, setContentLanguage] = useState<ContentLanguage>('uz');

    // Phase 2: Script Editing
    const [isEditingScript, setIsEditingScript] = useState<boolean>(false);
    const [editedScript, setEditedScript] = useState<string>('');

    // Phase 3: Subtitle Style
    const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(DEFAULT_SUBTITLE_STYLE);

    // Phase 3: Background Music
    const [bgMusicB64, setBgMusicB64] = useState<string | null>(null);
    const [bgMusicVolume, setBgMusicVolume] = useState<number>(20);
    const [bgMusicName, setBgMusicName] = useState<string>('');

    useEffect(() => {
        const getImageStepLabel = () => {
            switch (imageSource) {
                case 'upload': return 'Rasmlar Tayyorlanmoqda';
                case 'find': return 'Rasmlar Qidirilmoqda';
                case 'generate':
                default:
                    return 'Rasmlar Yaratilmoqda';
            }
        };

        const getScriptStepLabel = () => {
            return audioSource === 'upload' ? 'Audio Tahlil Qilinmoqda' : 'Ssenariy va Tavsiflar Yaratilmoqda';
        };

        setProgress(prev =>
            prev.map(step => {
                if (step.id === 'image') return { ...step, label: getImageStepLabel() };
                if (step.id === 'script') return { ...step, label: getScriptStepLabel() };
                if (step.id === 'audio') return { ...step, label: audioSource === 'upload' ? 'Subtitrlar Sinxronlanmoqda' : 'Audio Yaratilmoqda' };
                return step;
            })
        );
    }, [imageSource, audioSource]);


    const updateProgress = (stepId: ProgressStep['id'], stepStatus: ProgressStep['status'], progress?: number, detail?: string) => {
        setProgress(prev =>
            prev.map(step => (step.id === stepId ? { ...step, status: stepStatus, ...(progress !== undefined ? { progress } : {}), ...(detail !== undefined ? { detail } : {}) } : step))
        );
    };

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            if (uploadedImagesB64.length + files.length > 4) {
                setError("Siz ko'pi bilan 4 ta rasm yuklashingiz mumkin.");
                // Reset file input to allow re-selection of the same file later if needed
                event.target.value = '';
                return;
            }

            const fileReadPromises = Array.from(files).map((file: File) => {
                return new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = () => reject(new Error(`Faylni o'qishda xatolik: ${file.name}`));
                    reader.readAsDataURL(file);
                });
            });

            Promise.all(fileReadPromises)
                .then(newImages => {
                    setUploadedImagesB64(prev => [...prev, ...newImages]);
                })
                .catch((err: unknown) => {
                    if (err instanceof Error) {
                        setError(err.message);
                    } else {
                        setError('Faylni o\'qishda noma\'lum xatolik yuz berdi.');
                    }
                });
            event.target.value = '';
        }
    };

    const handleAudioChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                setError("Audio fayl hajmi 10MB dan oshmasligi kerak.");
                event.target.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                setUploadedAudioB64(reader.result as string);
                setError(null);
            };
            reader.onerror = () => setError("Audio faylni o'qishda xatolik.");
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveImage = (indexToRemove: number) => {
        setUploadedImagesB64(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    // Phase 2: Drag & Drop handlers
    const handleDragStart = (index: number) => {
        setDragIndex(index);
    };
    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        setDropTargetIndex(index);
    };
    const handleDragLeave = () => {
        setDropTargetIndex(null);
    };
    const handleDrop = (index: number) => {
        if (dragIndex === null || dragIndex === index) {
            setDragIndex(null);
            setDropTargetIndex(null);
            return;
        }
        setUploadedImagesB64(prev => {
            const updated = [...prev];
            const [moved] = updated.splice(dragIndex, 1);
            updated.splice(index, 0, moved);
            return updated;
        });
        setDragIndex(null);
        setDropTargetIndex(null);
    };
    const handleDragEnd = () => {
        setDragIndex(null);
        setDropTargetIndex(null);
    };

    // Phase 2: Script editing — re-generate audio from edited script
    const handleRegenerateAudio = useCallback(async () => {
        if (!editedScript.trim() || !reelContent) return;
        const newScript = editedScript.split('\n').filter(l => l.trim().length > 0);
        setReelContent(prev => ({ ...prev, script: newScript }));
        setIsEditingScript(false);

        setStatus('GENERATING');
        setError(null);
        setProgress(prev => prev.map(step =>
            step.id === 'audio' ? { ...step, status: 'running', progress: 10, detail: 'Qayta audio yaratilmoqda...' } : step
        ));

        try {
            const currentAudioB64 = await generateAudio(newScript.join(' '), selectedVoice, contentLanguage);

            const audioContextForDuration = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            const { duration } = await decodeAndGetAudioBuffer(currentAudioB64, audioContextForDuration);
            await audioContextForDuration.close();

            const processedScript = newScript.flatMap(line => splitIntoChunks(line, MAX_WORDS_PER_SUBTITLE));
            const totalChars = processedScript.reduce((acc, line) => acc + line.length, 0);
            const charsPerSecond = totalChars > 0 ? totalChars / duration : 10;
            let currentTime = 0;
            const timedScript: TimedScriptChunk[] = processedScript.map(line => {
                const lineDuration = line.length / charsPerSecond;
                const words = line.split(' ').filter(w => w.length > 0);
                let wordStartTime = currentTime;
                const timedWords: WordTiming[] = words.map((word, idx) => {
                    const charLen = word.length + (idx < words.length - 1 ? 1 : 0);
                    const wordDuration = charLen / charsPerSecond;
                    const t = { word, start: wordStartTime, end: wordStartTime + wordDuration };
                    wordStartTime += wordDuration;
                    return t;
                });
                const chunk: TimedScriptChunk = { text: line, start: currentTime, end: currentTime + lineDuration, words: timedWords };
                currentTime += lineDuration;
                return chunk;
            });

            setReelContent(prev => ({ ...prev, audioB64: currentAudioB64, timedScript }));
            setProgress(prev => prev.map(step =>
                step.id === 'audio' ? { ...step, status: 'complete', progress: 100, detail: '' } : step
            ));
            setStatus('COMPLETE');
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "Qayta urinib ko'ring.";
            setError(`Audio qayta yaratishda xatolik. ${message}`);
            setProgress(prev => prev.map(step =>
                step.id === 'audio' ? { ...step, status: 'error' } : step
            ));
            setFailedStep('audio');
            setStatus('ERROR');
        }
    }, [editedScript, reelContent, selectedVoice, contentLanguage]);


    const handleGenerate = useCallback(async (resumeFromStep?: ProgressStep['id']) => {
        if (imageSource === 'upload' && uploadedImagesB64.length === 0) {
            setError("Video uchun kamida bitta rasm yuklang.");
            return;
        }
        if (audioSource === 'upload' && !uploadedAudioB64) {
            setError("Iltimos, audio fayl yuklang.");
            return;
        }
        if (audioSource === 'generate' && !topic.trim()) {
            setError("Iltimos, mavzu kiriting.");
            return;
        }
        if (status === 'GENERATING') return;

        setStatus('GENERATING');
        setError(null);
        setFailedStep(null);

        if (!resumeFromStep) {
            setReelContent(null);
            setProgress(initialProgressSteps.map(step => {
                if (step.id === 'image') return { ...step, label: imageSource === 'upload' ? 'Rasmlar Tayyorlanmoqda' : 'Rasmlar Yaratilmoqda', status: 'pending', progress: 0, detail: '' };
                if (step.id === 'script') return { ...step, label: audioSource === 'upload' ? 'Audio Tahlil Qilinmoqda' : 'Ssenariy va Tavsiflar Yaratilmoqda', status: 'pending', progress: 0, detail: '' };
                if (step.id === 'audio') return { ...step, label: audioSource === 'upload' ? 'Subtitrlar Sinxronlanmoqda' : 'Audio Yaratilmoqda', status: 'pending', progress: 0, detail: '' };
                return { ...step, status: 'pending', progress: 0, detail: '' };
            }));
        } else {
            // Reset only the failed step and subsequent steps
            const stepOrder: ProgressStep['id'][] = ['script', 'image', 'audio'];
            const resumeIndex = stepOrder.indexOf(resumeFromStep);
            setProgress(prev => prev.map(step => {
                const stepIndex = stepOrder.indexOf(step.id);
                if (stepIndex >= resumeIndex) return { ...step, status: 'pending', progress: 0, detail: '' };
                return step;
            }));
        }

        let currentStep: ProgressStep['id'] = 'script';
        const stepOrder: ProgressStep['id'][] = ['script', 'image', 'audio'];
        const shouldSkip = (stepId: ProgressStep['id']) => {
            if (!resumeFromStep) return false;
            return stepOrder.indexOf(stepId) < stepOrder.indexOf(resumeFromStep);
        };

        try {
            let currentScript: string[] = reelContent?.script || [];
            let currentImagePrompts: string[] | undefined = reelContent?.imagePrompts || [];
            let currentHashtags: string[] | undefined = reelContent?.hashtags || [];
            let currentAudioB64 = reelContent?.audioB64 || '';
            let analyzedTopic = topic;

            // Step 1: Script/Analysis
            if (!shouldSkip('script')) {
                updateProgress('script', 'running', 0, 'Boshlanmoqda...');

                if (audioSource === 'upload' && uploadedAudioB64) {
                    const analysis = await analyzeAudioContent(uploadedAudioB64);
                    currentScript = analysis.script;
                    currentImagePrompts = analysis.imagePrompts;
                    currentHashtags = analysis.hashtags;
                    analyzedTopic = analysis.topic;
                    currentAudioB64 = uploadedAudioB64;
                    if (!topic) setTopic(analysis.topic);
                } else {
                    const shouldGeneratePrompts = imageSource === 'generate';
                    const scriptData = await generateScriptAndImagePrompt(topic, useGoogleSearch, !shouldGeneratePrompts, contentLanguage);
                    currentScript = scriptData.script;
                    currentImagePrompts = scriptData.imagePrompts;
                    currentHashtags = scriptData.hashtags;
                    if (scriptData.sources) {
                        setReelContent(prev => ({ ...prev, sources: scriptData.sources }));
                    }
                }

                setReelContent(prev => ({
                    ...prev,
                    script: currentScript,
                    imagePrompts: currentImagePrompts,
                    hashtags: currentHashtags,
                }));
                updateProgress('script', 'complete', 100);
            }

            // Step 2: Generate or use uploaded image
            if (!shouldSkip('image')) {
                currentStep = 'image';
                updateProgress('image', 'running', 0, 'Boshlanmoqda...');
                let imageUrls: string[];

                if (imageSource === 'upload') {
                    imageUrls = uploadedImagesB64;
                    updateProgress('image', 'running', 100, `${imageUrls.length} ta rasm tayyor`);
                } else if (imageSource === 'find') {
                    updateProgress('image', 'running', 10, 'Qidirilmoqda...');
                    imageUrls = await findImageUrls(analyzedTopic || topic, 4);
                    updateProgress('image', 'running', 100, `${imageUrls.length} ta rasm topildi`);
                } else { // 'generate' — parallel 2 at a time
                    const generatedImageB64s: string[] = [];
                    const promptsToUse = currentImagePrompts && currentImagePrompts.length > 0 ? [...currentImagePrompts] : [analyzedTopic || topic];

                    while (promptsToUse.length < 4) promptsToUse.push(promptsToUse[0]);
                    const slicedPrompts = promptsToUse.slice(0, 4);

                    // Generate 2 at a time in parallel
                    for (let i = 0; i < slicedPrompts.length; i += 2) {
                        const batch = slicedPrompts.slice(i, i + 2);
                        const results = await Promise.all(batch.map(prompt => generateImage(prompt)));
                        generatedImageB64s.push(...results);
                        const done = Math.min(generatedImageB64s.length, slicedPrompts.length);
                        updateProgress('image', 'running', Math.round((done / slicedPrompts.length) * 100), `${done}/${slicedPrompts.length} rasm`);
                        // Rate limit delay between batches
                        if (i + 2 < slicedPrompts.length) {
                            await new Promise(r => setTimeout(r, 3000));
                        }
                    }
                    imageUrls = generatedImageB64s.map(b64 => `data:image/png;base64,${b64}`);
                }

                if (imageUrls.length === 0) {
                    throw new Error('Video uchun hech qanday rasm topilmadi yoki yaratilmadi.');
                }

                setReelContent(prev => ({ ...prev, imageUrls }));
                updateProgress('image', 'complete', 100);
            }

            // Step 3: Audio Processing (or Timing Calculation)
            if (!shouldSkip('audio')) {
                currentStep = 'audio';
                updateProgress('audio', 'running', 10, 'Audio yaratilmoqda...');

                if (audioSource === 'generate') {
                    currentAudioB64 = await generateAudio(currentScript.join(' '), selectedVoice, contentLanguage);
                }

                if (!currentAudioB64) throw new Error("Audio mavjud emas.");

                updateProgress('audio', 'running', 60, 'Sinxronlanmoqda...');

                // Calculate timings
                const audioContextForDuration = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                const { duration } = await decodeAndGetAudioBuffer(currentAudioB64, audioContextForDuration);
                await audioContextForDuration.close();

                const processedScript = currentScript.flatMap(line => splitIntoChunks(line, MAX_WORDS_PER_SUBTITLE));
                const totalChars = processedScript.reduce((acc, line) => acc + line.length, 0);
                const charsPerSecond = totalChars > 0 ? totalChars / duration : 10;
                let currentTime = 0;
                const timedScript: TimedScriptChunk[] = processedScript.map(line => {
                    const lineDuration = line.length / charsPerSecond;
                    const words = line.split(' ').filter(w => w.length > 0);
                    let wordStartTime = currentTime;

                    const timedWords: WordTiming[] = words.map((word, index) => {
                        const charLengthWithSpace = word.length + (index < words.length - 1 ? 1 : 0);
                        const wordDuration = charLengthWithSpace / charsPerSecond;
                        const timing = {
                            word,
                            start: wordStartTime,
                            end: wordStartTime + wordDuration,
                        };
                        wordStartTime += wordDuration;
                        return timing;
                    });

                    const chunk: TimedScriptChunk = {
                        text: line,
                        start: currentTime,
                        end: currentTime + lineDuration,
                        words: timedWords,
                    };
                    currentTime += lineDuration;
                    return chunk;
                });

                setReelContent(prev => ({ ...prev, audioB64: currentAudioB64, timedScript }));
                updateProgress('audio', 'complete', 100);
            }

            setStatus('COMPLETE');
        } catch (e: unknown) {
            console.error(e);
            const message = e instanceof Error ? e.message : "Qayta urinib ko'ring.";
            setError(`${currentStep} bosqichida xatolik yuz berdi. ${message}`);
            updateProgress(currentStep, 'error');
            setFailedStep(currentStep);
            setStatus('ERROR');
        }
    }, [topic, status, useGoogleSearch, selectedVoice, imageSource, uploadedImagesB64, audioSource, uploadedAudioB64, reelContent, contentLanguage]);

    const handleDownload = async () => {
        if (!reelContent?.imageUrls || reelContent.imageUrls.length === 0 || !reelContent.audioB64 || !reelContent.timedScript) return;

        setIsDownloading(true);
        setError(null);

        try {
            const { blob: videoBlob, fileExtension } = await createVideoFromReelContent(
                reelContent.imageUrls,
                reelContent.audioB64,
                topic || "My Reel",
                reelContent.timedScript,
                videoQuality,
                subtitleStyle,
                bgMusicB64 || undefined,
                bgMusicVolume
            );

            const url = URL.createObjectURL(videoBlob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            const safeFileName = (topic || "video").replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const fileName = `${safeFileName}.${fileExtension}`;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (e: unknown) {
            console.error("Error creating video for download:", e);
            const errorMessage = e instanceof Error ? e.message : String(e);
            setError(`Videoni yuklab olishda xatolik: ${errorMessage}`);
        } finally {
            setIsDownloading(false);
        }
    };

    const handleCopyHashtags = () => {
        if (!reelContent?.hashtags) return;
        const hashtagText = reelContent.hashtags.join(' ');
        navigator.clipboard.writeText(hashtagText).then(() => {
            setCopySuccess('Nusxalandi!');
            setTimeout(() => setCopySuccess(''), 2000);
        }).catch((err: unknown) => {
            console.error('Could not copy text: ', err);
            setCopySuccess('Xato!');
            setTimeout(() => setCopySuccess(''), 2000);
        });
    };

    const handleFetchTopics = useCallback(async () => {
        setIsTopicsModalOpen(true);
        if (trendingTopics.length > 0 && !topicsError) return;

        setIsTopicsLoading(true);
        setTopicsError(null);
        try {
            const topics = await generateTrendingTopics();
            setTrendingTopics(topics);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : "Mavzularni yuklab bo'lmadi.";
            setTopicsError(message);
        } finally {
            setIsTopicsLoading(false);
        }
    }, [trendingTopics.length, topicsError]);

    const handleSelectTopic = (selectedTopic: string) => {
        setTopic(selectedTopic);
        setIsTopicsModalOpen(false);
    };


    const isLoading = status === 'GENERATING';

    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col items-center p-4 sm:p-6 md:p-8">
            <div className="w-full max-w-4xl mx-auto">
                <header className="text-center mb-8">
                    <div className="flex items-center justify-center gap-3 mb-2">
                        <img src={logoB64} alt="Ilova Logotipi" className="w-10 h-10 rounded-full" />
                        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-500 text-transparent bg-clip-text">
                            ReelCraft AI
                        </h1>
                    </div>
                    <p className="text-slate-400 max-w-2xl mx-auto">
                        Istalgan mavzuda ssenariy, rasm va ovozlashtirishga ega qisqa video yaratish uchun g'oyangizni kiriting yoki tayyor audio yuklang.
                    </p>
                </header>

                <main className="space-y-8">
                    <div className="bg-slate-800/50 p-6 rounded-lg shadow-lg border border-slate-700">

                        {/* Audio Source Selection */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-slate-400 mb-2">
                                Audio Manbasi
                            </label>
                            <div className="flex bg-slate-900 border border-slate-600 rounded-md p-1 w-full sm:w-auto sm:max-w-md">
                                <button
                                    onClick={() => setAudioSource('generate')}
                                    disabled={isLoading}
                                    className={`flex-1 px-3 py-2 text-sm font-semibold rounded-md transition-colors ${audioSource === 'generate' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700/50'}`}
                                >
                                    AI Yordamida Yaratish (TTS)
                                </button>
                                <button
                                    onClick={() => setAudioSource('upload')}
                                    disabled={isLoading}
                                    className={`flex-1 px-3 py-2 text-sm font-semibold rounded-md transition-colors ${audioSource === 'upload' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700/50'}`}
                                >
                                    Ovozli Fayl Yuklash
                                </button>
                            </div>
                        </div>

                        {audioSource === 'generate' ? (
                            // MODE: Generate from Topic
                            <>
                                <div className="flex justify-between items-center mb-2 animate-fade-in">
                                    <label htmlFor="topic-input" className="block text-lg font-medium text-slate-300">
                                        Reel Mavzusi
                                    </label>
                                    <button
                                        onClick={handleFetchTopics}
                                        disabled={isLoading}
                                        className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <IconComponents.LightbulbIcon className="w-5 h-5" />
                                        Mavzu G'oyalari
                                    </button>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-4 mb-4 animate-fade-in">
                                    <input
                                        id="topic-input"
                                        type="text"
                                        value={topic}
                                        onChange={(e) => setTopic(e.target.value)}
                                        placeholder="Masalan, Nima uchun osmon ko'k?"
                                        disabled={isLoading}
                                        className="flex-grow bg-slate-900 border border-slate-600 rounded-md px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:opacity-50"
                                    />
                                </div>
                                <div className="flex items-center justify-start mb-4 animate-fade-in">
                                    <label htmlFor="google-search-toggle" className="flex items-center cursor-pointer">
                                        <div className="relative">
                                            <input
                                                type="checkbox"
                                                id="google-search-toggle"
                                                className="sr-only"
                                                checked={useGoogleSearch}
                                                onChange={(e) => setUseGoogleSearch(e.target.checked)}
                                                disabled={isLoading}
                                            />
                                            <div className="block bg-slate-700 w-14 h-8 rounded-full transition"></div>
                                            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-300 ease-in-out ${useGoogleSearch ? 'transform translate-x-full bg-indigo-400' : 'bg-slate-400'}`}></div>
                                        </div>
                                        <div className="ml-3 text-slate-300 font-medium">
                                            Google Qidiruv bilan eng so'nggi ma'lumotlarni oling
                                        </div>
                                    </label>
                                </div>
                            </>
                        ) : (
                            // MODE: Upload Audio
                            <div className="mb-4 animate-fade-in">
                                <label className="block text-sm font-medium text-slate-400 mb-2">
                                    Ovozli Fayl (.mp3, .wav, .ogg - max 10MB)
                                </label>
                                {!uploadedAudioB64 ? (
                                    <div className="relative border-2 border-dashed border-slate-600 rounded-lg p-6 text-center hover:border-indigo-500 transition-colors">
                                        <IconComponents.UploadIcon className="mx-auto h-12 w-12 text-slate-500" />
                                        <span className="mt-2 block text-sm font-semibold text-slate-300">
                                            Audio faylni tanlang
                                        </span>
                                        <input
                                            type="file"
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            accept="audio/mp3, audio/wav, audio/ogg, audio/mpeg"
                                            onChange={handleAudioChange}
                                            disabled={isLoading}
                                        />
                                    </div>
                                ) : (
                                    <div className="bg-slate-900 border border-green-500/50 rounded-lg p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-green-500/20 p-2 rounded-full">
                                                <IconComponents.CheckIcon className="w-5 h-5 text-green-400" />
                                            </div>
                                            <span className="text-slate-200 font-medium">Audio yuklandi</span>
                                        </div>
                                        <button
                                            onClick={() => setUploadedAudioB64(null)}
                                            disabled={isLoading}
                                            className="text-red-400 hover:text-red-300 text-sm font-semibold"
                                        >
                                            O'chirish
                                        </button>
                                    </div>
                                )}
                                <p className="mt-2 text-xs text-slate-500">
                                    * Sun'iy intellekt audioni tahlil qilib, unga mos rasm va subtitrlarni avtomatik yaratadi.
                                </p>
                            </div>
                        )}

                        {/* Generate Button */}
                        <div className="mt-6">
                            <button
                                onClick={handleGenerate}
                                disabled={isLoading || (audioSource === 'generate' && !topic.trim()) || (audioSource === 'upload' && !uploadedAudioB64)}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-md shadow-lg hover:from-indigo-500 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-slate-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <>
                                        <IconComponents.LoaderIcon className="w-5 h-5 animate-spin" />
                                        Jarayon ketmoqda...
                                    </>
                                ) : (
                                    <>
                                        <IconComponents.MagicWandIcon className="w-5 h-5" />
                                        {audioSource === 'upload' ? 'Videoni Yig\'ish' : 'Reel Yaratish'}
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Additional Options Divider */}
                        <div className="mt-8 pt-4 border-t border-slate-700/50 space-y-6">

                            {/* Image Source */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">
                                    Rasm Manbasi
                                </label>
                                <div className="flex bg-slate-900 border border-slate-600 rounded-md p-1 w-full sm:w-auto sm:max-w-md">
                                    <button
                                        onClick={() => setImageSource('generate')}
                                        disabled={isLoading}
                                        className={`flex-1 px-3 py-2 text-sm font-semibold rounded-md transition-colors ${imageSource === 'generate' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700/50'}`}
                                    >
                                        AI Yordamida Yaratish
                                    </button>
                                    <button
                                        onClick={() => setImageSource('find')}
                                        disabled={isLoading}
                                        className={`flex-1 px-3 py-2 text-sm font-semibold rounded-md transition-colors ${imageSource === 'find' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700/50'}`}
                                    >
                                        AI Yordamida Topish
                                    </button>
                                    <button
                                        onClick={() => setImageSource('upload')}
                                        disabled={isLoading}
                                        className={`flex-1 px-3 py-2 text-sm font-semibold rounded-md transition-colors ${imageSource === 'upload' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700/50'}`}
                                    >
                                        O'zim Yuklash
                                    </button>
                                </div>
                            </div>

                            {imageSource === 'upload' && (
                                <div className="animate-fade-in space-y-4">
                                    <label htmlFor="image-upload" className="block text-sm font-medium text-slate-400">
                                        Rasmlaringizni Yuklang (4 tagacha)
                                    </label>

                                    {uploadedImagesB64.length > 0 && (
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                            {uploadedImagesB64.map((imgB64, index) => (
                                                <div
                                                    key={index}
                                                    className={`relative group aspect-square cursor-grab active:cursor-grabbing transition-all duration-200 ${dragIndex === index ? 'opacity-40 scale-95' : ''} ${dropTargetIndex === index && dragIndex !== index ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-800 rounded-lg' : ''}`}
                                                    draggable={!isLoading}
                                                    onDragStart={() => handleDragStart(index)}
                                                    onDragOver={(e) => handleDragOver(e, index)}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={() => handleDrop(index)}
                                                    onDragEnd={handleDragEnd}
                                                >
                                                    <img src={imgB64} alt={`Yuklangan rasm ${index + 1}`} className="w-full h-full object-cover rounded-lg border border-slate-600" />
                                                    <div className="absolute top-1 left-1 bg-black/70 text-white text-xs font-bold px-1.5 py-0.5 rounded">{index + 1}</div>
                                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleRemoveImage(index)}
                                                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white text-sm font-semibold rounded-md shadow-md hover:bg-red-500 transition"
                                                            disabled={isLoading}
                                                            aria-label={`Rasm ${index + 1} ni o'chirish`}
                                                        >
                                                            <IconComponents.TrashIcon className="w-4 h-4" />
                                                            O'chirish
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {uploadedImagesB64.length < 4 && (
                                        <div className="relative border-2 border-dashed border-slate-600 rounded-lg p-6 text-center hover:border-indigo-500 transition-colors">
                                            <IconComponents.UploadIcon className="mx-auto h-12 w-12 text-slate-500" />
                                            <span className="mt-2 block text-sm font-semibold text-slate-300">
                                                Rasmlarni tanlang ({uploadedImagesB64.length}/4)
                                            </span>
                                            <p className="text-xs text-slate-500">PNG, JPG, WEBP</p>
                                            <input
                                                id="image-upload"
                                                type="file"
                                                multiple
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                accept="image/png, image/jpeg, image/webp"
                                                onChange={handleImageChange}
                                                disabled={isLoading || uploadedImagesB64.length >= 4}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Voice Select (Only if generating audio) */}
                            {audioSource === 'generate' && (
                                <div className="animate-fade-in">
                                    <label htmlFor="voice-select" className="block text-sm font-medium text-slate-400 mb-2">
                                        Ovozni Tanlang
                                    </label>
                                    <select
                                        id="voice-select"
                                        value={selectedVoice}
                                        onChange={(e) => setSelectedVoice(e.target.value as VoiceOption)}
                                        disabled={isLoading}
                                        className="w-full sm:max-w-xs bg-slate-900 border border-slate-600 rounded-md px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:opacity-50"
                                    >
                                        {availableVoices.map(voice => (
                                            <option key={voice.id} value={voice.id}>{voice.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Content Language Selection */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">
                                    Kontent Tili
                                </label>
                                <div className="flex bg-slate-900 border border-slate-600 rounded-md p-1 w-full sm:w-auto sm:max-w-xs">
                                    <button
                                        onClick={() => setContentLanguage('uz')}
                                        disabled={isLoading}
                                        className={`flex-1 px-3 py-2 text-sm font-semibold rounded-md transition-colors ${contentLanguage === 'uz' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700/50'}`}
                                    >
                                        🇺🇿 O'zbekcha
                                    </button>
                                    <button
                                        onClick={() => setContentLanguage('ru')}
                                        disabled={isLoading}
                                        className={`flex-1 px-3 py-2 text-sm font-semibold rounded-md transition-colors ${contentLanguage === 'ru' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700/50'}`}
                                    >
                                        🇷🇺 Русский
                                    </button>
                                    <button
                                        onClick={() => setContentLanguage('en')}
                                        disabled={isLoading}
                                        className={`flex-1 px-3 py-2 text-sm font-semibold rounded-md transition-colors ${contentLanguage === 'en' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700/50'}`}
                                    >
                                        🇬🇧 English
                                    </button>
                                </div>
                            </div>

                            {/* Video Quality Selection */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">
                                    Video Sifati
                                </label>
                                <div className="flex bg-slate-900 border border-slate-600 rounded-md p-1 w-full sm:w-auto sm:max-w-xs">
                                    <button
                                        onClick={() => setVideoQuality('720p')}
                                        disabled={isLoading}
                                        className={`flex-1 px-3 py-2 text-sm font-semibold rounded-md transition-colors ${videoQuality === '720p' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700/50'}`}
                                    >
                                        720p (Tez)
                                    </button>
                                    <button
                                        onClick={() => setVideoQuality('1080p')}
                                        disabled={isLoading}
                                        className={`flex-1 px-3 py-2 text-sm font-semibold rounded-md transition-colors ${videoQuality === '1080p' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700/50'}`}
                                    >
                                        1080p (Sifatli)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {status !== 'IDLE' && <ProgressTracker steps={progress} />}

                    {error && (
                        <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg">
                            <div className="flex items-start gap-3">
                                <IconComponents.ErrorIcon className="w-6 h-6 flex-shrink-0 mt-0.5" />
                                <div className="flex-grow">
                                    <h3 className="font-bold">Xatolik yuz berdi</h3>
                                    <p className="text-sm">{error}</p>
                                </div>
                            </div>
                            {failedStep && (
                                <div className="mt-3 flex justify-end">
                                    <button
                                        onClick={() => handleGenerate(failedStep)}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-md transition"
                                    >
                                        <IconComponents.MagicWandIcon className="w-4 h-4" />
                                        Davom Etish
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {status === 'COMPLETE' && reelContent?.imageUrls && reelContent.imageUrls.length > 0 && reelContent.audioB64 && reelContent.timedScript && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-center">Reelingiz Tayyor!</h2>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                                <div className="lg:col-span-1 space-y-4">
                                    <ReelPreview
                                        title={topic || "Video Preview"}
                                        imageUrls={reelContent.imageUrls}
                                        audioB64={reelContent.audioB64}
                                        timedScript={reelContent.timedScript}
                                        subtitleStyle={subtitleStyle}
                                        bgMusicB64={bgMusicB64 || undefined}
                                        bgMusicVolume={bgMusicVolume}
                                    />
                                    <SubtitleStylePicker style={subtitleStyle} onChange={setSubtitleStyle} />
                                </div>
                                <div className="lg:col-span-2 bg-slate-800/50 p-6 rounded-lg border border-slate-700 space-y-4">
                                    {reelContent.imagePrompts && (
                                        <div>
                                            <h3 className="text-lg font-semibold text-cyan-400">Rasm Tavsiflari (AI tomonidan taklif qilingan)</h3>
                                            {reelContent.imagePrompts.map((prompt, index) => (
                                                <p key={index} className="text-slate-400 italic mt-2">"{prompt}"</p>
                                            ))}
                                        </div>
                                    )}
                                    <div>
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-lg font-semibold text-cyan-400">
                                                {audioSource === 'upload' ? 'Transkripsiya (Audiodan olingan)' : 'Ssenariy'}
                                            </h3>
                                            {audioSource !== 'upload' && (
                                                <button
                                                    onClick={() => {
                                                        if (isEditingScript) {
                                                            setIsEditingScript(false);
                                                        } else {
                                                            setEditedScript(reelContent.script?.join('\n') || '');
                                                            setIsEditingScript(true);
                                                        }
                                                    }}
                                                    className="text-sm text-indigo-400 hover:text-indigo-300 transition font-semibold px-3 py-1 rounded-md bg-slate-700/50 hover:bg-slate-700"
                                                >
                                                    {isEditingScript ? 'Bekor qilish' : 'Tahrirlash ✏️'}
                                                </button>
                                            )}
                                        </div>
                                        {isEditingScript ? (
                                            <div className="mt-2 space-y-3">
                                                <textarea
                                                    value={editedScript}
                                                    onChange={(e) => setEditedScript(e.target.value)}
                                                    className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition min-h-[150px] resize-y"
                                                    placeholder="Har bir gap yangi qatorda..."
                                                />
                                                <button
                                                    onClick={handleRegenerateAudio}
                                                    disabled={status === 'GENERATING' || !editedScript.trim()}
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <IconComponents.MagicWandIcon className="w-4 h-4" />
                                                    Saqlash va Audio Qayta Yaratish
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="text-slate-300 whitespace-pre-wrap mt-2">{reelContent.script?.join('\n')}</p>
                                        )}
                                    </div>
                                    {reelContent.hashtags && reelContent.hashtags.length > 0 && (
                                        <div className="pt-4 border-t border-slate-700/50">
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-lg font-semibold text-cyan-400 flex items-center gap-2">
                                                    <IconComponents.HashtagIcon className="w-5 h-5" />
                                                    Tavsiya etilgan Heshteglar
                                                </h3>
                                                <button onClick={handleCopyHashtags} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors relative font-semibold px-3 py-1 rounded-md bg-slate-700/50 hover:bg-slate-700">
                                                    {copySuccess ? copySuccess : 'Nusxalash'}
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                {reelContent.hashtags.map((tag, index) => (
                                                    <span key={index} className="bg-slate-700 text-cyan-300 text-sm font-medium px-3 py-1 rounded-full">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {reelContent.sources && reelContent.sources.length > 0 && (
                                        <div className="pt-4 border-t border-slate-700/50">
                                            <h3 className="text-lg font-semibold text-cyan-400 flex items-center gap-2">
                                                <IconComponents.LinkIcon className="w-5 h-5" />
                                                Manbalar
                                            </h3>
                                            <ul className="list-none space-y-1 mt-2">
                                                {reelContent.sources.map((source, index) => (
                                                    <li key={index} className="text-slate-400 truncate">
                                                        <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline hover:text-indigo-300 transition inline-flex items-center gap-1.5">
                                                            <span>{source.title || source.uri}</span>
                                                        </a>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Background Music Upload */}
                                    <div className="pt-4 border-t border-slate-700/50">
                                        <h3 className="text-lg font-semibold text-cyan-400 mb-3">🎵 Fon Musiqasi</h3>
                                        {bgMusicB64 ? (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between bg-slate-900/50 p-3 rounded-md">
                                                    <span className="text-sm text-slate-300 truncate">{bgMusicName}</span>
                                                    <button
                                                        onClick={() => { setBgMusicB64(null); setBgMusicName(''); }}
                                                        className="text-red-400 hover:text-red-300 text-sm font-semibold"
                                                    >
                                                        O'chirish
                                                    </button>
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1">Ovoz balansi: {bgMusicVolume}%</label>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="100"
                                                        value={bgMusicVolume}
                                                        onChange={(e) => setBgMusicVolume(parseInt(e.target.value))}
                                                        className="w-full accent-indigo-500"
                                                    />
                                                    <div className="flex justify-between text-xs text-slate-500">
                                                        <span>Ovoz kuchli</span>
                                                        <span>Musiqa kuchli</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="relative border-2 border-dashed border-slate-600 rounded-lg p-4 text-center hover:border-indigo-500 transition-colors">
                                                <IconComponents.UploadIcon className="mx-auto h-8 w-8 text-slate-500" />
                                                <span className="mt-1 block text-sm text-slate-400">MP3 yoki WAV faylni yuklang</span>
                                                <input
                                                    type="file"
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                    accept="audio/mpeg, audio/wav, audio/mp3"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        setBgMusicName(file.name);
                                                        const reader = new FileReader();
                                                        reader.onload = (evt) => {
                                                            const result = evt.target?.result as string;
                                                            setBgMusicB64(result);
                                                        };
                                                        reader.readAsDataURL(file);
                                                        e.target.value = '';
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-center pt-4">
                                <button
                                    onClick={handleDownload}
                                    disabled={isDownloading}
                                    className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-green-600 text-white font-semibold rounded-md shadow-md hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 focus:ring-offset-slate-900 transition disabled:bg-green-800 disabled:text-slate-400 disabled:cursor-not-allowed"
                                >
                                    {isDownloading ? (
                                        <>
                                            <IconComponents.LoaderIcon className="w-5 h-5 animate-spin" />
                                            Yuklanmoqda...
                                        </>
                                    ) : (
                                        <>
                                            <IconComponents.DownloadIcon className="w-5 h-5" />
                                            Videoni Yuklab Olish
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </main>
                <TrendingTopicsModal
                    isOpen={isTopicsModalOpen}
                    onClose={() => setIsTopicsModalOpen(false)}
                    isLoading={isTopicsLoading}
                    topics={trendingTopics}
                    error={topicsError}
                    onSelectTopic={handleSelectTopic}
                    onRetry={handleFetchTopics}
                />
            </div>
        </div>
    );
};

export default App;
