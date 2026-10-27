# GEST pilot: Render Free + Supabase private Storage (temporary bridge)

**Eslatma:** GEST hozir SQLite'dan foydalanadi. Bu vaqtinchalik yechim PostgreSQL'ga to'liq ko'chirmaydi: SQLite va `storage/` fayllarining izchil nusxasi Supabase private bucket'iga yuboriladi va Render qayta ishga tushganda tiklanadi. Siz yaratgan 29 ta PostgreSQL jadval **hali ishlatilmaydi**.

## 1. Supabase'da bucket yaratish
Supabase → SQL Editor → `SUPABASE_PILOT_SETUP.sql` matnini joylang → Run. Natijada `gest-pilot-private` va `public=false` chiqishi kerak. Supabase → Project Settings → API Keys ichidan maxfiy **service_role** kalitini oling. Kalitni faqat Render Environment'da saqlang, GitHub'ga yoki chatga yubormang.

## 2. GitHub Desktop orqali kodni yangilash
`GEST.ORG` repository'ni oching → Show in Explorer. Ushbu ZIP ichidagi `gest-website` papkasining **ichidagi fayllarni** eski repository asosiy papkasiga ko'chiring. `.git`, `.env`, `data`, `storage` papkalarini o'chirmang. GitHub Desktop'da maxfiy fayllar staged bo'lmaganini tekshiring. Summary: `Add Supabase pilot persistence`, Commit to main → Push origin.

## 3. Render → GEST.ORG → Environment
Quyidagi qiymatlarni sozlang (bo'sh qator yoki sharhlarni qiymatga qo'shmang):

| Variable | Value |
| --- | --- |
| `GEST_SUPABASE_MIRROR` | `true` |
| `SUPABASE_URL` | Siz yaratgan `gest-production` loyihasining `https://...supabase.co` URL'i |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard'dagi **secret service_role** key; hech kimga yubormang |
| `GEST_SUPABASE_BACKUP_BUCKET` | `gest-pilot-private` |
| `DATABASE_PATH` | `./storage/db/gest.sqlite` |
| `GEST_SUPABASE_ALLOW_EMPTY_START` | `true` (faqat BIRINCHI bo'sh demo deployda) |
| `WEB_CONCURRENCY` | `1` |
| `SENSITIVE_UPLOADS_ENABLED` | `false` |

Boshqa production qiymatlari, shu jumladan `SESSION_SECRET`, `IDENTITY_ENCRYPTION_KEY`, `BASE_URL`, `SUPER_ADMIN_*`, `SMTP_*` qiymatlarini saqlang, almashtirmang. `DATABASE_PATH` avval boshqa yo'lda bo'lgan bo'lsa, avval demo ma'lumotlarni ehtiyotkorlik bilan eksport qiling; yangi deploy vaqtida Render Free'ning vaqtinchalik eski fayllari yo'qolishi mumkin.

## 4. Kichik demo sinovi (zarur)
1. Render'da Deploy **Live** bo'lsin; Logs'da `GEST mirror: persistent snapshot synced` ko'rinsin.
2. Supabase → Storage → `gest-pilot-private` → `snapshots/gest-pilot-current.tar.gz` borligini ko'ring; private obyekt bo'lishi shart.
3. GEST admin'da faqat demo markaz va demo sessiya yarating. Cloud snapshot yangilanganini tekshiring.
4. Render service'ni **o'chirmasdan** restart qiling. Logs'da `GEST mirror: SQLite and private files restored from Supabase` bo'lishi kerak. Demo markaz va sessiya hali turganini tekshiring.
5. BIRINCHI snapshot tasdiqlangach, Render Environment'da `GEST_SUPABASE_ALLOW_EMPTY_START` qiymatini `false` qiling. Shundan keyingi qayta ishga tushishda backup topilmasa server ishlamasligi kerak; bu tasodifan bo'sh bazaga qaytib ketishni oldini oladi.

## Muhim cheklovlar
- Bu **pilot uchun sinov**: 1 ta Render instance, kichik demo ma'lumotlar va 45 MB dan kichik snapshot. Render Free uptime kafolatlamaydi, Supabase Free esa faol bo'lmasa pauza qilishi mumkin.
- Har POST'dan keyin snapshot yuboriladi. Ulanish uzilsa server 503 qaytaradi; lokal operatsiya allaqachon bajarilgan bo'lishi mumkin. Amalni tekshirmasdan qayta yubormang.
- SQLite'dagi barcha ma'lumotlar hali PostgreSQL'ning 29 jadvaliga o'tmagan. Production migratsiyasi alohida loyihadir.
- Real pasport, ID yoki biometrik suratlarni Sydney Supabase regioniga yuborishni **hozircha yoqmang**. Shaxsiy ma'lumotlar bo'yicha huquqiy tekshiruv bo'lmagan. `SENSITIVE_UPLOADS_ENABLED=false` qolsin.
- ID upload o'chirilganligi sababli onlayn booking ham to'liq ishlamaydi. 28-oktabrdagi birinchi pilotda **offline candidate list**, bosma javob varaqalari va asl ID'ni test markazida ko'rish asosiy zaxira jarayon bo'lsin. Test ishtirokchilarini demo sifatida ro'yxatdan o'tkazmang; ular uchun shaxsiy ma'lumotlar alohida himoya qilinishi kerak.
- Supabase snapshotning o'zi backup strategiyasi yoki qonuniy ruxsat o'rnini bosmaydi.
