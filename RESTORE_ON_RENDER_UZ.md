# GEST — Oldingi sayt ko‘rinishini tiklash (Render uchun)

Bu ZIP avvalgi **v1.4.2 English-only sayt dizayni va ommaviy interfeysini** qaytaradi.
V1.5 dagi **global “GEST PUBLIC PILOT” banneri olib tashlangan**. Maxfiy hujjatlarni
himoyalash, production kalitlarni tekshirish va aynan Pilot Test 001 uchun alohida
pilot PDF hisoboti kabi xavfsizlik va natija funksiyalari saqlab qolingan.

## MUHIM: Render Free va yo‘qolayotgan o‘zgarishlar

**Render Free** ma'lumotlarini doimiy saqlamaydi. Siz sessiyani o‘zgartirasiz, lekin
server uyquga ketganda, qayta ishga tushganda yoki qayta deploy bo‘lganda **SQLite fayl
yo‘qoladi**. Kodda avval yaratiladigan namunaviy Prime School sessiyalari ham shu
sabab yana ko‘rinardi. Bu paket **production seed'ni to‘xtatadi**: yangi/bo‘sh bazada
faqat birinchi super-administrator yaratiladi. Lekin Free hosting **hali ham ma'lumotlarni
yo‘qotadi**. Doimiy saqlash uchun **Render paid Web Service + Persistent Disk** yoki
SQLite'dan mos doimiy database arxitekturasiga o'tish shart.

## Github & Render: aniq qadamlar

0. **O‘chirmang:** hozirgi GitHub repository, Render servisi, environment secrets,
   eski SQLite va yuklangan hujjatlar nusxalari. Eng avval mavjud ma'lumotlarni
   imkon qadar zaxiralang. Disk yaratish eski ephemeral fayllarni orqaga qaytarmaydi.
1. ZIP'dagi `gest-website` papkasini kompyuteringizda yangi joyga oching.
   `.env`, `data`, `storage`, `node_modules` fayllarini GitHub'ga yubormang.
2. GitHub Desktop'da oldingi repository'ni tanlang, oldingi fayllarni yangi
   `gest-website` ichidagi fayllar bilan almashtiring. *Private repository*.
   Repo root'ida `Dockerfile`, `package.json`, `scripts/`, `src/`, `views/` ko‘rinsin.
   Keyin **Commit to main → Push origin**.
3. Render Dashboard → GEST Web Service → Settings: Docker deployment ishlayotganini
   va repository/branch mosligini tekshiring. Render yangi commit uchun deploy qiladi.
4. Agar Render **paid** rejimida bo‘lsa, **Disks → Add disk**:
   - Mount path: `/app/storage` (Dockerfile'dagi `WORKDIR /app` uchun)
   - Hajmi: kichik sinov uchun siz tanlagan xizmatga mos hajm; o‘sganda kengaytiring.
5. Render → Environment → Variables, kamida:

       NODE_ENV=production
       DATABASE_PATH=/app/storage/db/gest.sqlite
       BASE_URL=https://gest-org.onrender.com
       TRUST_PROXY=true
       PAYMENT_MODE=manual
       SENSITIVE_UPLOADS_ENABLED=false

   Qolgan maxfiy kalitlar, haqiqiy admin loginlari va SMTP sozlamalari ham production
   tekshiruvidan o‘tishi kerak. Xususan SESSION_SECRET, VERIFICATION_HMAC_SECRET,
   TOKEN_HASH_SECRET, FEE_WAIVER_HMAC_SECRET, IDENTITY_ENCRYPTION_KEY *barqaror*
   qolishi kerak. Ularni Github'ga joylamang va bu chatga yubormang.
6. Render → Deploys: Deploy succeeded. Keyin saytingizni oching.
   Barcha public sahifalar, login, admin panel va `/health` yo‘lini tekshiring.
7. Test uchun bitta yangi markaz va sessiya yarating, sessiyani `closed`ga
   o‘zgartiring yoki markazni `inactive` qiling. Sahifani yangilang; so‘ng
   yangi deploydan keyin ham o‘zgarish saqlanishini tekshiring.

## Qaysi xususiyatlar saqlangan?

- GEST oldingi ENGLISH-only dizayn; header/footer va ranglar avvalgi holatda.
- Candidate, Centre Admin, Headquarters; booking, SQLite, sertifikat va verification.
- Pilot Test 001 bo‘yicha maxsus natija PDF faqat pilot natijalar uchun;
  Administrator Comments'da birinchi pilot va rasman tasdiqlanmagan score qaydi.
- Production boshlanganda avtomatik test sessiyalari va demo candidate **yaratilmaydi**.
- Haqiqiy hujjat/foto yuklash production’da xavfsizlik auditisiz o‘chiq turadi.

## Ma'lumotlarni himoya qilish

Bu ZIP hech qanday haqiqiy user ma'lumoti, pasport, .env yoki SQLite bazasini
qo‘shmaydi. SQLite faol bo‘lganda shunchaki copy/paste qilish to‘liq nusxa
bo‘lmasligi mumkin. Serverga haqiqiy ma'lumotlar ko‘chirishdan oldin to‘liq,
izchil backup oling. Render Free'dan yo‘qolgan ma'lumotlar bunday ZIP bilan
qayta tiklanmaydi. Admin parollarini xavfsiz saqlang va bir necha odam bilan
ulashmang.

Eslatma: agar hozirgi sayt haqiqiy odamlarning shaxsini tasdiqlovchi
hujjatlarini yig‘ayotgan bo‘lsa, xavfsizlik va qonuniy talablar tekshirilmaguncha
to‘xtatib turish zarur.
