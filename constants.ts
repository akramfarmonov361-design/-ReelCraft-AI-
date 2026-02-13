

import type { ProgressStep, VoiceOption, TopicCategory } from './types';

export const initialProgressSteps: ProgressStep[] = [
  { id: 'script', label: 'Ssenariy va Tavsiflar Yaratilmoqda', status: 'pending' },
  { id: 'image', label: 'Rasm Yaratilmoqda', status: 'pending' },
  { id: 'audio', label: 'Audio Yaratilmoqda', status: 'pending' },
];

export const availableVoices: { id: VoiceOption, name: string }[] = [
  { id: 'Zephyr', name: 'Zephyr (Do\'stona va Tabiiy)' },
  { id: 'Kore', name: 'Kore (Yumshoq va Tiniq)' },
  { id: 'Fenrir', name: 'Fenrir (Tiniq va Ishonchli)' },
  { id: 'Charon', name: 'Charon (Xotirjam)' },
  { id: 'Achernar', name: 'Achernar (G\'ayratli)' },
  { id: 'Puck', name: 'Puck (Xushchaqchaq)' },
  { id: 'Gacrux', name: 'Gacrux (Jiddiy)' },
  { id: 'Umbriel', name: 'Umar (Hujjatli Film Ovozi)' },
  { id: 'Schedar', name: 'Schedar (Yorqin va Ishonchli)' },
  { id: 'Sulafat', name: 'Sulafat (Mayin va Tinchlantiruvchi)' },
  { id: 'Despina', name: 'Despina (O\'ynoqi va G\'ayratli)' },
];

export const curatedViralTopics: TopicCategory[] = [
  {
    category: '🧠 Bilim va Viktorinalar',
    topics: [
      'Geografiya Quiz: Poytaxtlarni qanchalik bilasiz?',
      'Tarixiy Viktorina: Amir Temur davri',
      'Koinot sirlari: Mars haqida 3 ta savol',
      'Mantiqiy savollar: IQ darajangizni tekshiring',
      'Avtomobillar Quiz: Belgilarni taniysizmi?',
    ],
  },
  {
    category: '💡 Texnologiya va Sun\'iy Intellekt',
    topics: [
      'Keyingi 5 yilda SI hayotimizni qanday o\'zgartiradi',
      'Telefoningiz siz haqingizda biladigan 5 ta qo\'rqinchli narsa',
      'SI yordamida qanday qilib pul ishlash mumkin',
      'O\'zbekistonda startaplar uchun eng yaxshi g\'oyalar',
      '2025-yilda kutilayotgan eng zo\'r texnologiyalar',
    ],
  },
  {
    category: '🌍 Hayot Tarzi va Psixologiya',
    topics: [
      'Sizni zaiflashtiradigan 5 ta kundalik odat',
      'Telefondan kamroq foydalanish hayotingizni qanday o\'zgartiradi',
      'Muvaffaqiyatli insonlarning tonggi odatlari',
      'Boshqalarning fikriga e\'tibor bermaslikni qanday o\'rganish mumkin',
      'Introvertlarning yashirin kuchi',
    ],
  },
  {
    category: '💸 Pul, Biznes va Motivatsiya',
    topics: [
      'Yoshlar onlayn tarzda noldan qanday pul ishlamoqda',
      'Passiv daromad tushunchasi: bir marta ishlang, doim foyda oling',
      'Sarmoyasiz boshlash mumkin bo\'lgan 3 ta onlayn biznes',
      'Bu motivatsiya emas, bu intizom. Shu bilan yashang.',
      'O\'zbekistonda biznes ochish uchun 5 ta maslahat',
    ],
  },
  {
    category: '🤯 Faktlar va Bilimlar',
    topics: [
      'Inson tanasi haqida siz bilmagan 5 ta ajoyib fakt',
      'Dunyoning eng g\'alati qonunlari',
      'Ko\'pchilik bilmaydigan tarixiy sirlar',
      'Registon maydoni haqida 3 ta qiziqarli fakt',
      'Amir Temur haqida eng mashhur afsonalar',
    ],
  },
  {
    category: '🎬 Trendlar, Filmlar va Madaniyat',
    topics: [
      'O\'zbekistonda hozir eng ommabop bo\'lgan seriallar',
      'Mashhur o\'zbek filmlaridan unutilmas iqtiboslar',
      'Mashhurlar SI avatarida qanday ko\'rinishda bo\'lardi',
      'Navro\'z bayramining kelib chiqish tarixi',
      'O\'zbek to\'ylaridagi eng kulgili holatlar',
    ],
  },
];
