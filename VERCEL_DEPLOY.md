# ReelCraft AI - Vercel Deployment Guide

Ushbu loyihani Vercel-ga joylash uchun quyidagi qadamlarni bajaring:

## 1. Vercel-ga loyihani ulash
1. Vercel.com saytiga kiring
2. "Add New..." -> "Project" tugmasini bosing
3. GitHub repozitoriyangizni tanlang va "Import" qiling

## 2. Sozlamalar (Build & Output Settings)
Vercel odatda Vite loyihasini avtomatik taniydi. Quyidagi sozlamalar to'g'riligiga ishonch hosil qiling:
- **Framework Preset:** Vite
- **Root Directory:** `./` (o'zgartirish shart emas)
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

## 3. Environment Variables (Juda muhim!)
"Environment Variables" bo'limida quyidagi o'zgaruvchini qo'shishingiz SHART:

- **Key:** `GEMINI_API_KEY`
- **Value:** `sizning_google_ai_studi_kalitingiz` (bu `.env.local` dagi kalit bilan bir xil bo'lishi kerak)

> **Eslatma:** Biz `vite.config.ts` da `GEMINI_API_KEY` ni ham, `VITE_GEMINI_API_KEY` ni ham o'qiydigan qilib sozladik, shuning uchun ikkalasi ham ishlaydi.

## 4. Deploy
"Deploy" tugmasini bosing. 1-2 daqiqada saytingiz ishga tushadi!

---

## Qo'shimcha ma'lumotlar
- **PWA:** Ilova PWA sifatida ishlaydi (mobilga o'rnatish mumkin).
- **Routing:** `vercel.json` fayli qo'shildi, bu sahifa yangilanganda 404 xatolik bo'lmasligini ta'minlaydi.
