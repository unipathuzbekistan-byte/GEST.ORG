GEST P001 - Supabase NoSuchKey Startup Fix

SABAB:
Supabase Storage mavjud bo'lmagan snapshot faylga HTTP 400 javob qaytaradi.
Javob mazmuni: {"statusCode":"404","error":"not_found","code":"NoSuchKey"}.
Oldingi GEST patch faqat HTTP 404 ni 'snapshot yo'q' deb tanigan.

QADAMLAR:
1. GitHub Desktop > GEST.ORG > Repository > Show in Explorer.
2. Shu ZIP dagi src/cloud-snapshot.js faylini repository dagi
   src/cloud-snapshot.js ustiga ko'chiring (Replace).
3. GitHub Desktop > Changes da faqat src/cloud-snapshot.js o'zgarganini tekshiring.
4. Summary: Fix missing Supabase snapshot startup
5. Commit to main > Push origin.
6. Render > GEST.ORG > Deploys da yangilanish Live bo'lganini tekshiring.
7. Render Environment: GEST_SUPABASE_ALLOW_EMPTY_START=true (BIRINCHI DEMO BOOT UCHUN),
   GEST_SUPABASE_MIRROR=true va qolgan maxfiy ulanish qiymatlari to'g'ri bo'lishi kerak.
8. Loglarda 'GEST mirror: persistent snapshot synced' chiqishini tekshiring.
9. Supabase Storage > gest-pilot-private ichida
   snapshots/gest-pilot-current.tar.gz paydo bo'lishini tasdiqlang.
10. SHUNDAN KEYINGINA GEST_SUPABASE_ALLOW_EMPTY_START=false deb o'zgartiring va
    Render deploy/restart qilib, snapshot tiklanishini tekshiring.

OGOHLANTIRISH:
- Snapshot paydo bo'lmaguncha haqiqiy nomzodlar, pasportlar, natijalarni saqlamang.
- Oldingi Render Free ma'lumotlari qayta ishga tushishda yo'qolgan bo'lishi mumkin.
- Bu patch faqat NoSuchKey boshlang'ich start xatosini tuzatadi; to'liq
  PostgreSQL migratsiyasi emas va to'liq production xavfsizlik auditi emas.
- .env, parollar, API kalitlari va hujjatlarni hech qachon GitHub'ga yuklamang.
- Supabase Sydney serverida haqiqiy ID hujjatlarni saqlashdan avval qonuniy
  talablar va shaxsiy ma'lumotlar xavfsizligini tekshiring.
