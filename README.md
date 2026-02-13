# ReelCraft AI

AI yordamida professional Instagram Reels va YouTube Shorts yaratish uchun mo'ljallangan web-ilova.

![App Screenshot](public/icon-512.svg)

## 🚀 Imkoniyatlar

- **Ko'p tilli qo'llab-quvvatlash:** 🇺🇿 O'zbek, 🇷🇺 Rus, va 🇬🇧 Ingliz tillarida kontent yaratish
- **AI Ssenariy:** "Deep Motivation", "Dark Psychology" yoki "Viral Quiz" uslubida avtomatik ssenariy yozish
- **AI Ovoz (TTS):** 
  - O'zbek tilida "a" harfini to'g'ri talaffuz qiladigan maxsus sozlangan ovoz
  - Rus va Ingliz tillari uchun professional diktor ovozlari
- **AI Rasmlar:** Ssenariyga mos realistik rasmlar generatsiyasi (Parallel 2 tadan)
- **Video Montaj:**
  - Rasmlar pan & zoom (Ken Burns) effekti bilan
  - Sozlanuvchi subtitrlar (font, rang, fon)
  - Fon musiqasi yuklash va ovozini sozlash
  - Full HD (1080p) va HD (720p) eksport
- **PWA:** Ilovani telefonga o'rnatish imkoniyati (Offline ishlash rejimi bilan)

## 🛠 O'rnatish va Ishga tushirish

1. **Repozitoriyni yuklab oling:** 
   ```bash
   git clone https://github.com/sizning-repo/ai-reels-creator.git
   cd ai-reels-creator
   ```

2. **Kutubxonalarni o'rnating:**
   ```bash
   npm install
   ```

3. **Env faylni sozlang:**
   `.env.local` faylini yarating va Google Gemini API kalitingizni yozing:
   ```env
   GEMINI_API_KEY=sizning_api_kalitingiz
   ```

4. **Ilovani ishga tushiring:**
   ```bash
   npm run dev
   ```
   Brauzerda `http://localhost:3000` manzilini oching.

## 🌐 Deploy (Vercel)

Ushbu loyiha Vercel-ga deploy qilish uchun to'liq moslashtirilgan.

1. **Vercel-ga ulanish:** Loyihani GitHub-ga yuklang va Vercel-da yangi loyiha sifatida import qiling.
2. **Environment Variables:** Vercel sozlamalarida `GEMINI_API_KEY` ni qo'shing.
3. **Build:** Vercel avtomatik ravishda `npm run build` komandasini ishlatadi.

Batafsil qo'llanma uchun [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md) fayliga qarang.

## 📱 PWA (Mobil Ilova) sifatida o'rnatish

Saytni telefonda ochganingizda "Home ekranga qo'shish" (Add to Home Screen) tugmasi orqali ilova sifatida o'rnatishingiz mumkin.

## Texnologiyalar

- **Frontend:** React, Vite, TailwindCSS
- **AI:** Google Gemini 2.0 Flash / Pro
- **Audio/Video:** Web Audio API, Canvas API, MediaRecorder API
