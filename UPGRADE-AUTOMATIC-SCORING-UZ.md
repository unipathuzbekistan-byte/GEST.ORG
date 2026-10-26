# GEST Automatic Scoring — Windows yangilash va birinchi sinov

Bu **mavjud GEST saytingizga qo‘shiladigan**, allaqachon ishlayotgan sertifikatlar, UZ001/UZ002 markazlar, imzolar va bazani saqlaydigan yangilanishdir. Avvalgi tarixiy/manual natijalar avtomatik qayta hisoblanmaydi.

## 1. Serverni to‘xtatish va zaxira

VS Code terminalida `Ctrl+C` bosing. Agar Windows `Terminate batch job (Y/N)?` desa, `Y` va Enter bosing. 3000-portda eski server qolmaganini tekshiring. Windows Explorer orqali **butun `gest-website` papkangiz nusxasini** boshqa joyga oling; kamida `.env`, `data`, `storage` papkalarini saqlang. Xususan, SQLite `.sqlite`, `-wal`, `-shm` fayllari uchun server to‘xtagan bo‘lsin.

## 2. Update ZIP o‘rnatish

`gest-automatic-scoring-update.zip` ni yuklab, `Extract All` qiling. Ichidagi `src`, `views`, `public`, `tests`, `scripts` va `package.json` fayllarini **o‘zingizdagi `gest-website` ichiga** ko‘chiring; bir xil nomli loyiha fayllarini almashtirishga rozilik bering. Yangilanish ZIP ichida **`.env`, `data`, `storage` va `node_modules` yo‘q**. Ularga tegmang. ZIP'dan chiqadigan yo‘riqnoma (`UPGRADE-AUTOMATIC-SCORING-UZ.md`) bilan birga ko‘chirsa ham bo‘ladi.

## 3. Ishga tushirish

VS Code'da o‘sha loyiha papkasini ochib, PowerShell terminalida:

```powershell
npm.cmd start
```

Server `GEST ready` desa, `http://localhost:3000/admin/pilot/forms` ni super admin hisobingiz bilan oching. `npm.cmd install` faqat bog‘liqliklar oldindan o‘rnatilmagan bo‘lsa kerak bo‘ladi. Bu yangilanish yangi npm bog‘liqligi kiritmaydi.

## 4. Tekshirish uchun DEMO answer key yaratish

**Faqat sinov uchun** terminalda quyidagini ishga tushiring (serverni oldin to‘xtatishingiz mumkin):

```powershell
npm.cmd run seed:pilot-demo
npm.cmd start
```

Shunda `DEMO-PILOT-001` nomli maxsus kalit yaratiladi. 40 ta Reading va 35 ta Listening javobi `A, B, C, D` takroridan iborat. Bu haqiqiy imtihon materiali emas. Production (`NODE_ENV=production`) rejimida demo kalit yaratish bloklangan.

Super admin → **Pilot scoring** → **Assign a form to a session**: bo‘sh, hali natijasi bo‘lmagan UZ002 sessiyasini va `DEMO-PILOT-001` ni tanlang, **Assign** bosing. Bu bog‘lanish **qaytarilmas**: noto‘g‘ri sessiyani tanlasangiz, yangi sessiya yaratib alohida form bilan ishlang. Eski natijalari bor sessiyaga form bog‘lash taqiqlangan.

Haqiqiy pilot uchun o‘zingiz tuzgan original test materiallarining 40 va 35 ta javoblarini kiritib yangi, noyob form yarating. Answer key faqat Headquarters tomonidan kiritiladi; test markaziga ko‘rsatilmaydi.

## 5. Nomzodni sinov sessiyasiga yozish

Test candidate hisobida UZ002 sessiyasini band qiling. Markaz administratori → **Session registrants** → nomzodning original ID hujjatini solishtirish → **Check in**. Ro‘yxatdagi **Scores** ni oching. Pilot sessiyada yangi `Pilot scoring` sahifasi chiqadi (legacy sessiyada eski 0–100 forma qoladi).

**Reading/Listening:** har bir savol javobini vergul yoki yangi qatordan ajratib, aniq 40 va 35 ta kiriting. Bo‘sh qoldirilgan savol `-`. `A, B, C, D` ketma-ketligini to‘g‘ri kiritsangiz, demo kalit bilan 100/100 olasiz. Server xom javoblarni solishtiradi; 30/40 = 75, 28/35 = 80.

**Speaking:** Fluency, Vocabulary, Grammar, Pronunciation mezonlariga 0–10 orasida butun son kiriting. Summasi 0–40; server 0–100 ga o‘tkazadi.

**Writing:** Har bir marker Task 1 va Task 2 bo‘yicha 4 tadan 0–10 mezon kiritadi. Birinchi markaz administratori 1-marker bo‘ladi. Ikkinchi belgi uchun **boshqa administrator hisobiga** kiring yoki GEST super admin `/admin/pilot/booking/BOOKING_ID` sahifasidan mustaqil mark qo‘ysin. Bir xil akkaunt ikki marta baho bera olmaydi; oldingi ball boshqa markerga ko‘rsatilmaydi. Dastlabki ikki baho farqi >10 bo‘lsa, uchinchi mustaqil marker kerak. Kerak bo‘lsa UZ002 uchun yana bir markaz admin akkauntini yarating.

Ikkala mustaqil Writing bahosi yetgach va barcha komponentlar saqlangach, **Submit pilot scores** tugmasini bosing. Natijalar bloklanadi.

## 6. Headquarters tasdiqlashi

Super admin → **Results** → `PILOT — provisional only` belgili natija → **Approve pilot diagnostic only**. Natija Candidate Dashboard'da `PROVISIONAL PILOT — NOT AN OFFICIAL CERTIFICATE` sifatida ko‘rinadi. Super admin `/admin/pilot/results/RESULT_ID` sahifasidan oddiy **diagnostik hisobot**ni ko‘ra oladi. **Rasmiy Test Report Form va unga QR/security code berilmaydi**. Bu ataylab qilingan: testni CEFR'ga moslashtirish ilmiy validatsiyadan o‘tmagan.

## Ball formulalari

- Reading: `Math.round(to‘g‘ri / 40 × 100)`.
- Listening: `Math.round(to‘g‘ri / 35 × 100)`.
- Writing, har marker: Task 1 jami 0–40 → 40%, Task 2 jami 0–40 → 60%; `Math.round(task1Jami + 1.5 × task2Jami)`. Ikki marker ballining o‘rtachasi yaxlitlanadi; farq >10 bo‘lsa, 3 marker ballining **medianasi** olinadi.
- Speaking: 4 mezon jami 0–40 → `Math.round(jami × 2.5)`.
- Overall: `Math.round((Reading + Listening + Writing + Speaking) / 4)`.
- CEFR: avval sozlangan `<A1: 0–19`, `A1:20–34`, `A2:35–49`, `B1:50–64`, `B2:65–79`, `C1:80–91`, `C2:92–100` **faqat vaqtinchalik pilot tasnif**. Bu xom-to‘g‘ri javoblardan ilmiy CEFR darajasi isbotlangani degani emas.

## Pilot rubric uchun dastlabki descriptorlar

| Ball | Examiner uchun umumiy yo‘naltiruvchi anchor |
|---|---|
| 0 | O‘lchashga yaroqli javob mavjud emas |
| 1–2 | Juda cheklangan yoki tushunarsiz javob; kommunikativ maqsadga deyarli erishmagan |
| 3–4 | Qisman bajarilgan topshiriq; ko‘p xatolar va cheklangan lug‘at |
| 5–6 | Asosiy vazifa bajarilgan, lekin izchillik, ravonlik va aniqlikda kamchiliklar bor |
| 7–8 | Yetarlicha ravon, izchil, to‘g‘ri va vazifaga mos javob; mayda nuqsonlar |
| 9–10 | Aniq, tabiiy, keng imkoniyatli va juda samarali javob; juda kam nuqsonlar |

Bu umumiy **pilot descriptorlar**; har bir mezon va bosqich uchun batafsil ekspert rubric, baholovchilar treningi va kelishuv statistikasi alohida ishlab chiqilishi zarur. Examiner tajribasi va mustaqil tekshiruvsiz haqiqiy test uchun yetarli emas.

## Qiyinchilik bo‘lsa

`npm.cmd start` ishga tushmasa, **`.env` faylini yubormang**: unda maxfiy kalitlar bor. Terminal xatosining maxfiy ma’lumotlarsiz qismini yuboring. Avvalgi imzolar uchun `storage/signatures` ni zaxirada saqlang. Yangilanishni muammosiz qaytarish kerak bo‘lsa, serverni to‘xtatib, oldin olingan butun papka zaxirasiga qayting; migratsiyani avtomatik teskari ishlatmang.
