
import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { VoiceOption, TopicCategory, ContentLanguage } from "../types";
import { curatedViralTopics } from "../constants";

let ai: GoogleGenAI | null = null;

// Lazy initialization of the AI client
function getAiInstance(): GoogleGenAI {
    if (ai) {
        return ai;
    }
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
    }
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return ai;
}

// Utility for retrying failed API calls with exponential backoff
async function withRetry<T>(fn: () => Promise<T>, retries = 5, delay = 2000): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        const errorMsg = error?.message || "";
        const errorStatus = error?.status || "";
        const errorCode = error?.code || 0;

        // Check for Rate Limit / Quota (429)
        const isRateLimit =
            errorStatus === "RESOURCE_EXHAUSTED" ||
            errorCode === 429 ||
            errorMsg.includes("429") ||
            errorMsg.includes("quota") ||
            errorMsg.includes("RESOURCE_EXHAUSTED");

        // Check for Server Errors (5xx)
        const isServerError =
            errorStatus === "INTERNAL" ||
            errorCode === 500 ||
            errorMsg.includes("500") ||
            errorMsg.includes("Internal error") ||
            errorMsg.includes("overloaded");

        if (retries > 0 && (isRateLimit || isServerError)) {
            // If rate limit, wait longer (start with 5s). If server error, standard delay.
            const actualDelay = isRateLimit ? Math.max(delay, 5000) : delay;

            console.warn(`API Error (${errorCode || errorStatus}). Retrying in ${actualDelay / 1000}s... (${retries} attempts left)`);

            await new Promise(resolve => setTimeout(resolve, actualDelay));
            // Exponential backoff
            return withRetry(fn, retries - 1, actualDelay * 2);
        }

        // Transform error message for end-user if it's a quota issue
        if (isRateLimit) {
            throw new Error("API so'rovlar limiti (Quota) tugadi. Tizim bir necha bor urindi, lekin hozircha natija yo'q. Iltimos, 1-2 daqiqadan so'ng qayta urinib ko'ring.");
        }

        throw error;
    }
}


// Helper to clean potential markdown and extract JSON from responses
function cleanAndParseJson(jsonString: string): any {
    const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
    const match = jsonString.match(codeBlockRegex);
    let cleaned = match ? match[1] : jsonString;

    const firstOpenBrace = cleaned.indexOf('{');
    const firstOpenBracket = cleaned.indexOf('[');
    const lastCloseBrace = cleaned.lastIndexOf('}');
    const lastCloseBracket = cleaned.lastIndexOf(']');

    let start = -1;
    if (firstOpenBrace !== -1 && firstOpenBracket !== -1) {
        start = Math.min(firstOpenBrace, firstOpenBracket);
    } else if (firstOpenBrace !== -1) {
        start = firstOpenBrace;
    } else if (firstOpenBracket !== -1) {
        start = firstOpenBracket;
    }

    let end = -1;
    if (lastCloseBrace !== -1 && lastCloseBracket !== -1) {
        end = Math.max(lastCloseBrace, lastCloseBracket);
    } else if (lastCloseBrace !== -1) {
        end = lastCloseBrace;
    } else if (lastCloseBracket !== -1) {
        end = lastCloseBracket;
    }

    if (start !== -1 && end !== -1 && start <= end) {
        cleaned = cleaned.substring(start, end + 1);
    }

    try {
        return JSON.parse(cleaned);
    } catch (e) {
        console.error("JSON parsing error for input:", cleaned);
        throw e;
    }
}

export async function generateScriptAndImagePrompt(
    topic: string,
    useGoogleSearch: boolean,
    skipImagePrompts: boolean,
    language: ContentLanguage = 'uz'
): Promise<{ script: string[]; imagePrompts?: string[]; sources?: { uri: string, title: string }[], hashtags?: string[] }> {
    try {
        const aiClient = getAiInstance();
        const isQuizMode = /quiz|viktorina|test|savol|bilim/i.test(topic);

        const langConfig = {
            uz: {
                quizPrompt: `Siz Instagram Reels va TikTok uchun "Viral Quiz" (Viktorina) yaratuvchi professional ssenariychisiz.
Mavzu: '${topic}'.
MAQSAD: Tomoshabinni ushlab turish va izoh yozishga undash.
TUZILISH: 1. Hook, 2. 3 ta savol (Oson, O'rtacha, Qiyin), 3. Javobdan oldin pauza, 4. Outro.
EMOJI YO'Q. Faqat matn. O'ZBEK TILIDA YOZING.`,
                mainPrompt: `Siz Instagram Reels va YouTube Shorts uchun professional ssenariy muallifisiz.
Mavzu: '${topic}'.
MAQSAD: Video VIRAL bo'lishi va mavzuga mos his-tuyg'uni berishi kerak.
USLUB (Mavzuga qarab o'zingiz tanlang):
- Agar mavzu bayram, tabrik yoki xursandchilik bo'lsa: Samimiy, ilhomlantiruvchi va yorqin uslubda yozing. Rasm tavsiflari ham "yorqin yorug'lik, issiq ranglar, quvonchli atmosfera" ni aks ettirsin.
- Agar mavzu ta'lim yoki faktlar bo'lsa: Qiziqarli va ob'ektiv yozing.
- Agar mavzu sirli, tarixiy yoki chuqur motivatsiya bo'lsa: "Deep Motivation" yoki "Dark Psychology" uslubida, sirli va epik yozing.
YONDASHUV: Har doim realistik nuqtai nazardan yondoshing. Abstrakt, o'ta bo'rttirilgan, fantastik yoki g'ayritabiiy o'xshatishlardan qoching (masalan, beton orasidan chiqqan gul, osmondagi ulkan toj va hokazo keraksiz). Hayotiy va haqiqiy kadrlar yozing.
QOIDA: Qisqa gaplar va e'tiborni tortuvchi tuzilish. EMOJI YO'Q. Faqat matn. O'ZBEK TILIDA YOZING.`,
                jsonInstruction: skipImagePrompts
                    ? `Javob faqat JSON: { "script": ["Gap 1...", ...], "hashtags": ["#tag1", ...] }`
                    : `Javob faqat JSON: { "script": ["Gap 1...", ...], "imagePrompts": ["Mavzu hissiyotiga mos, REALISTIK va hayotiy inglizcha rasm tavsifi (photorealistic, natural) 1", ...], "hashtags": ["#tag1", ...] }`,
                topicPrefix: 'Mavzu',
            },
            ru: {
                quizPrompt: `Вы профессиональный сценарист вирусных викторин для Instagram Reels и TikTok.
Тема: '${topic}'.
ЦЕЛЬ: Удержать внимание и побудить оставить комментарий.
СТРУКТУРА: 1. Хук, 2. 3 вопроса (лёгкий, средний, сложный), 3. Пауза перед ответом, 4. Аутро.
БЕЗ ЭМОДЗИ. Только текст. ПИШИТЕ НА РУССКОМ ЯЗЫКЕ.`,
                mainPrompt: `Вы профессиональный сценарист для Instagram Reels и YouTube Shorts.
Тема: '${topic}'.
ЦЕЛЬ: Видео должно стать ВИРУСНЫМ и передавать правильную эмоцию темы.
СТИЛЬ (выберите в зависимости от темы):
- Если праздник или поздравление: Искренний, вдохновляющий и светлый стиль. Описания картинок должны передавать "яркий свет, теплые цвета, радостную атмосферу".
- Если образование или факты: Увлекательно и объективно.
- Если тайна, история или глубокая мотивация: Стиль "Deep Motivation" или "Dark Psychology", эпично и таинственно.
ПОДХОД: Всегда используйте реалистичный подход. Избегайте абстрактных, чрезмерно преувеличенных, фантастических метафор. Описывайте жизненные и реальные кадры.
ПРАВИЛА: Короткие предложения и цепляющая структура. БЕЗ ЭМОДЗИ. Только текст. ПИШИТЕ НА РУССКОМ ЯЗЫКЕ.`,
                jsonInstruction: skipImagePrompts
                    ? `Ответ только в JSON: { "script": ["Предложение 1...", ...], "hashtags": ["#тег1", ...] }`
                    : `Ответ только в JSON: { "script": ["Предложение 1...", ...], "imagePrompts": ["Реалистичное жизненное описание картинки на английском (photorealistic, natural) 1", ...], "hashtags": ["#тег1", ...] }`,
                topicPrefix: 'Тема',
            },
            en: {
                quizPrompt: `You are a professional viral quiz scriptwriter for Instagram Reels and TikTok.
Topic: '${topic}'.
GOAL: Hook the viewer and encourage comments.
STRUCTURE: 1. Hook, 2. 3 questions (Easy, Medium, Hard), 3. Pause before answer, 4. Outro.
NO EMOJIS. Text only. WRITE IN ENGLISH.`,
                mainPrompt: `You are a professional scriptwriter for Instagram Reels and YouTube Shorts.
Topic: '${topic}'.
GOAL: This video MUST go VIRAL and match the exact emotion of the topic.
STYLE (Choose based on the topic):
- If it's a celebration or greeting: Sincere, inspiring, and bright. Image prompts must reflect "bright lighting, warm colors, joyful atmosphere".
- If educational or facts: Engaging and objective.
- If mystery, history, or deep motivation: "Deep Motivation" or "Dark Psychology" style, epic and mysterious.
APPROACH: Always use a realistic perspective. Avoid abstract, overly exaggerated, or fantastical metaphors (e.g. no glowing floating crowns or roses growing from concrete). Focus on authentic, real-world imagery and narrative.
RULES: Short sentences, engaging structure. NO EMOJIS. Text only. WRITE IN ENGLISH.`,
                jsonInstruction: skipImagePrompts
                    ? `Response must be JSON only: { "script": ["Sentence 1...", ...], "hashtags": ["#tag1", ...] }`
                    : `Response must be JSON only: { "script": ["Sentence 1...", ...], "imagePrompts": ["Realistic, real-world English image prompt (photorealistic, authentic) 1", ...], "hashtags": ["#tag1", ...] }`,
                topicPrefix: 'Topic',
            },
        };

        const lang = langConfig[language];
        const systemInstruction = isQuizMode ? lang.quizPrompt : lang.mainPrompt;

        const requestConfig: any = {
            systemInstruction: `${systemInstruction}\n\n${lang.jsonInstruction}`
        };
        let contents = `${lang.topicPrefix}: ${topic}.`;

        if (useGoogleSearch) {
            requestConfig.tools = [{ googleSearch: {} }];
        } else {
            requestConfig.responseMimeType = "application/json";
            requestConfig.responseSchema = {
                type: Type.OBJECT,
                properties: {
                    script: { type: Type.ARRAY, items: { type: Type.STRING } },
                    hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                    ...(skipImagePrompts ? {} : { imagePrompts: { type: Type.ARRAY, items: { type: Type.STRING } } })
                },
                required: ["script", "hashtags", ...(skipImagePrompts ? [] : ["imagePrompts"])]
            };
        }

        const response = await withRetry<GenerateContentResponse>(() => aiClient.models.generateContent({
            model: "gemini-3-pro-preview",
            contents,
            config: requestConfig,
        }));

        const result = cleanAndParseJson(response.text || "");

        if (useGoogleSearch) {
            const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
            const sourceMap = new Map<string, { uri: string; title: string }>();
            if (Array.isArray(groundingChunks)) {
                for (const chunk of groundingChunks) {
                    if (chunk?.web?.uri) {
                        sourceMap.set(chunk.web.uri, { uri: chunk.web.uri, title: chunk.web.title || chunk.web.uri });
                    }
                }
            }
            result.sources = Array.from(sourceMap.values());
        }

        return result;
    } catch (error: unknown) {
        console.error("Ssenariy yaratishda xatolik:", error);
        throw error;
    }
}

export async function findImageUrls(topic: string, count: number): Promise<string[]> {
    try {
        const aiClient = getAiInstance();
        const response = await withRetry<GenerateContentResponse>(() => aiClient.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Find ${count} high-quality portrait image URLs for: '${topic}'. Return JSON: { "imageUrls": ["url1", ...] }`,
            config: { tools: [{ googleSearch: {} }] },
        }));
        const result = cleanAndParseJson(response.text || "");
        return result.imageUrls || [];
    } catch (error: unknown) {
        console.error("Rasm topishda xatolik:", error);
        return [];
    }
}

export async function generateImage(prompt: string): Promise<string> {
    const aiClient = getAiInstance();
    let primaryError: any = null;

    // 1. Primary Model: Gemini 2.5 Flash Image
    try {
        const response = await withRetry<GenerateContentResponse>(() => aiClient.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
            config: {
                imageConfig: {
                    aspectRatio: "9:16"
                }
            },
        }), 2, 2000); // Try 2 times

        const data = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
        if (data) return data;
    } catch (error: unknown) {
        console.warn("Gemini 2.5 Flash Image failed, attempting fallback...", error);
        primaryError = error;
    }

    // 2. Fallback Model: Imagen 4.0 (Attempt only if 2.5 failed)
    try {
        const response: any = await withRetry(() => aiClient.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                aspectRatio: '9:16',
                outputMimeType: 'image/jpeg'
            },
        }), 1, 2000); // Only 1 attempt

        const data = response.generatedImages?.[0]?.image?.imageBytes;
        if (data) return data;
    } catch (error: unknown) {
        // Just log warning, do not overwrite primaryError which is likely the root cause (e.g. Quota)
        console.warn("Imagen 4.0 fallback failed (skipping other fallbacks to avoid 403/404):", error);
    }

    // Removed Gemini 3 Pro Image and Imagen 3.0 from fallback chain as they were causing 403/404 errors for this user context.

    throw primaryError || new Error("Rasm yaratib bo'lmadi. Iltimos, qayta urinib ko'ring.");
}

export async function generateAudio(script: string, voice: VoiceOption, language: ContentLanguage = 'uz'): Promise<string> {
    try {
        const aiClient = getAiInstance();

        let preparedScript = script;
        let announcerInstruction = '';

        if (language === 'uz') {
            // Phonetic corrections for better Uzbek pronunciation
            preparedScript = script
                .replace(/\b2024\b/g, "ikki ming yigirma to'rt")
                .replace(/\b2025\b/g, "ikki ming yigirma besh")
                .replace(/\b2026\b/g, "ikki ming yigirma olti")
                .replace(/\btarix\b/gi, "taarix")
                .replace(/tarixiy/gi, "taarixiy")
                .replace(/\bhaqiqat/gi, "haaqiqaat")
                .replace(/\bbalki/gi, "baalki")
                .replace(/\bmasalan/gi, "maasalan")
                .replace(/\bsabab/gi, "saabab")
                .replace(/\bsababli/gi, "saababli")
                .replace(/\bbarchamiz/gi, "baarchamiz")
                .replace(/\bbarcha/gi, "baarcha")
                .replace(/\bhayot/gi, "haayot")
                .replace(/\bfaqat/gi, "faaqat")
                .replace(/\bqanday/gi, "qaanday")
                .replace(/\bqadam/gi, "qaadam")
                .replace(/\basosan/gi, "aasosan")
                .replace(/\bahamiyat/gi, "aahamiyat")
                .replace(/\baslida/gi, "aaslida")
                .replace(/\bnatija/gi, "naatija")
                .replace(/\bxalq/gi, "xaalq")
                .replace(/\bmamlakat/gi, "maamlakaat")
                .replace(/\btashkil/gi, "taashkil")
                .replace(/\bdavlat/gi, "daavlat")
                .replace(/\bjamiyat/gi, "jaamiyat");

            announcerInstruction = `Siz professional o'zbek tili diktorisiz. Eng muhim qoida: O'ZBEK TILIDA "A" HARFINI ANIQ VA KENG TALAFFUZ QILING. "A" tovushini hech qachon "O" tovushiga o'xshatmang. Har bir "a" harfi "a" bo'lib qolishi kerak. Talaffuz qoidalari: 1) "A" unlisini doimo keng, ochiq aytish. 2) So'zlarning oxirgi bo'g'inidagi urg'uga e'tibor berish. 3) Neytral, ishonchli va barqaror tempda gapiring. 4) Har bir gap oxirida ovoz tonini bir oz pasaytiring. 5) Nutq tabiiy va hayotiy chiqishi kerak.\nOvozlashtirish uchun matn: `;
        } else if (language === 'ru') {
            announcerInstruction = `Вы профессиональный русскоязычный диктор. Говорите чётко, уверенно и с правильным интонированием. Стиль: профессиональный закадровый голос. Делайте короткие паузы между предложениями. Интонацию понижайте в конце каждого предложения.\nТекст для озвучки: `;
        } else {
            announcerInstruction = `You are a professional English voice-over narrator. Speak clearly, confidently, with proper intonation. Style: professional documentary narrator. Make short pauses between sentences. Lower your tone at the end of each sentence.\nText to narrate: `;
        }

        // Add pauses for all languages
        preparedScript = preparedScript
            .replace(/\./g, '... ')
            .replace(/!/g, '!... ')
            .replace(/\?/g, '?... ');

        const finalPrompt = `${announcerInstruction}${preparedScript}`;

        const response = await withRetry<GenerateContentResponse>(() => aiClient.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: finalPrompt }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voice },
                    },
                },
            },
        }));

        const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!audioData) throw new Error("Audio ma'lumotlari bo'sh qaytdi");
        return audioData;
    } catch (error: unknown) {
        console.error("Audio yaratishda xatolik (TTS 500 yoki boshqa):", error);
        throw error;
    }
}

export async function analyzeAudioContent(audioB64: string): Promise<{
    script: string[];
    imagePrompts: string[];
    hashtags: string[];
    topic: string;
}> {
    try {
        const aiClient = getAiInstance();
        // Remove data URL prefix if present
        const cleanB64 = audioB64.replace(/^data:audio\/\w+;base64,/, "");

        const prompt = `Ushbu audio faylni tinglang va quyidagi ishlarni bajaring:
1. Audiodagi matnni (transkripsiya) aniq yozib oling.
2. Audio mazmuniga mos keladigan, video foni uchun 4 ta vizual rasm tavsifini (image prompts) ingliz tilida yarating.
3. Audio mazmunidan kelib chiqib, qisqa sarlavha (topic) va 5 ta heshteg yozing.

Javobni faqat JSON formatida qaytaring:
{
  "topic": "Mavzu nomi",
  "script": ["Gap 1", "Gap 2", ...],
  "imagePrompts": ["Prompt 1", "Prompt 2", ...],
  "hashtags": ["#tag1", "#tag2", ...]
}`;

        const response = await withRetry<GenerateContentResponse>(() => aiClient.models.generateContent({
            model: "gemini-2.5-flash",
            contents: {
                parts: [
                    { inlineData: { mimeType: "audio/mp3", data: cleanB64 } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        topic: { type: Type.STRING },
                        script: { type: Type.ARRAY, items: { type: Type.STRING } },
                        imagePrompts: { type: Type.ARRAY, items: { type: Type.STRING } },
                        hashtags: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["topic", "script", "imagePrompts", "hashtags"]
                }
            }
        }));

        const result = cleanAndParseJson(response.text || "");
        return result;
    } catch (error: unknown) {
        console.error("Audio tahlil qilishda xatolik:", error);
        throw error;
    }
}

export async function generateTrendingTopics(): Promise<TopicCategory[]> {
    try {
        const aiClient = getAiInstance();
        const response = await withRetry<GenerateContentResponse>(() => aiClient.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: "O'zbekistonda bugun eng trend bo'lgan 10 ta mavzuni toping. Faqat JSON array qaytaring.",
            config: {
                systemInstruction: "Siz trend tahlilchisisiz. Faqat JSON array of strings qaytaring.",
                tools: [{ googleSearch: {} }],
            },
        }));
        const todays = cleanAndParseJson(response.text || "");
        return [
            { category: "🔥 Bugungi Trendlar", topics: todays },
            ...curatedViralTopics
        ];
    } catch (error: unknown) {
        console.error("Trendlarni olishda xatolik:", error);
        return curatedViralTopics;
    }
}
