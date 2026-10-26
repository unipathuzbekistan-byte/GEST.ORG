# GEST — Ommaviy pilotni VPS'da ishga tushirish (v1.5)

**Maqsad:** barcha Express sahifalarini, login, SQLite, xodim panellari, QR-verification va PDF generatorini bitta HTTPS domenida ishlatish. Sayt faqat ingliz tilida. Netlify bu loyiha uchun doimiy backend sifatida tanlanmadi.

## 0. Chegara va xavfsizlik

- **Hozircha ommaviy PILOT:** CEFR chegaralari xalqaro validatsiyadan o'tmagan. Ekranda pilot ogohlantirishi mavjud. Bu paket muassasalar GEST ni tan olganini anglatmaydi.
- **SENSITIVE_UPLOADS_ENABLED=false** — productionda pasport va markazdagi surat yuklash standart holatda bloklangan. Haqiqiy shaxsiy ma'lumotlarni yig'ishdan OLDIN huquqshunos va mustaqil xavfsizlik mutaxassisi tekshiruvi, privacy/terms sahifalarining haqiqiy matni, fayllarni virusli PDF uchun skanerlash, voyaga yetmaganlar roziligi, ma'lumotlarni saqlash joyi va retention tartibini tasdiqlash kerak.
- To'lov sandboxi productionda ishlamaydi; **PAYMENT_MODE=manual** bilan markaz to'lovni qo'lda tasdiqlaydi, real karta ma'lumotlari olinmaydi. Real Click/Payme integratsiyasi yo'q.
- Avvalgi haqiqiy ma'lumotlarni namoyish hostingiga **ko'chirmang**. Dastlab sun'iy test ma'lumotlari ishlating. Bu ZIP ichida foydalanuvchi ma'lumotlari yoki maxfiy kalitlar yo'q.

## 1. Server va domen

O'zbekiston hududidagi yoki huquqiy jihatdan mos VPS tanlang. Kamida taxminan 2 vCPU, 4 GB RAM va 20 GB SSD resursini sinov uchun boshlang'ich konfiguratsiya deb oling (yuklamaga qarab o'zgartiriladi). Ubuntu LTS, Docker Engine va Docker Compose pluginini o'rnating. Server firewall: SSH(22) faqat administrator IP manzillaridan, 80/443 umumiy. Domen DNS `A` recordini server public IPv4 manziliga yo'naltiring. Domenning haqiqiy egaligi va savdo belgisi mavjudligini tekshiring.

## 2. Fayllarni serverga joylang

ZIP dan GEST loyihasini, masalan, `/srv/gest` ga ko'chiring. `node_modules`, `.env`, `data`, `storage` papkalarini GitHub repozitoriyga **joylamang**. Alohida, maxfiy konfiguratsiya va server saqlovchi papkalarni yaratish kerak.

```bash
cd /srv/gest
node scripts/create-production-env.js
nano .env.production
```

`.env.production` ichidagi `GEST_DOMAIN`, `BASE_URL=https://...`, ikkala admin email va `SMTP_*` qiymatlarini haqiqiy ma'lumotlar bilan almashtiring. Tasodifiy yaratilgan parol/kalitlarni **o'zgartirmasdan** xavfsiz password managerga ko'chiring. Ixtiyoriy test uchun `GEST_PUBLIC_PILOT_MODE=true`, `SENSITIVE_UPLOADS_ENABLED=false`, `PAYMENT_MODE=manual` qoldiring. `SMTP_FROM` haqiqiy sender domenida bo'lishi lozim. `NODE_ENV=production`, `TRUST_PROXY=true` bo'lsin.

**Mavjud lokal SQLite'ni ko'chirishda**: `VERIFICATION_HMAC_SECRET`, `TOKEN_HASH_SECRET`, `IDENTITY_ENCRYPTION_KEY`, `FEE_WAIVER_HMAC_SECRET` va boshqa tegishli kalitlar oldingi tizimdagi aynan o'sha qiymatlar bo'lishi shart. Aks holda oldingi kodlar tekshirilmaydi yoki shifrlangan hujjatlar ochilmaydi. Ko'chirishdan avval izchil backup oling, ruxsatlar va ma'lumotlarni saqlash qonunini tekshiring.

## 3. Ma'lumot saqlovchi papkalar va HTTPS

```bash
mkdir -p data storage/photos storage/certificates storage/signatures storage/identity-documents
# Rasmiy Node Docker obrazidagi 'node' foydalanuvchi UID=1000; volume yozish huquqi:
sudo chown -R 1000:1000 data storage
chmod 700 data storage storage/*
chmod 600 .env.production
# Domen va SMTP to'g'ri bo'lgach:
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
# Tekshirish:
docker compose --env-file .env.production -f docker-compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=60 gest
curl -I https://SIZNING-DOMENINGIZ/
curl https://SIZNING-DOMENINGIZ/health
```

Caddy TLS sertifikatini avtomatik oladi (DNS to'g'ri, 80/443 ochiq bo'lsa). Express faqat Caddy ichki tarmog'ida ochiq; tashqi dunyoda 3000 port ochilmaydi.

## 4. Sinovlar

- HTTPS'ning to'g'ri ishlashi va HTTP→HTTPS o'tishini ko'ring.
- Inglizcha public sahifalar (`/`, `/about`, `/format`, `/scoring`, `/centres`) va `/health` ni tekshiring.
- Pilot ogohlantirishi ko'rinishini tekshiring. Kontakt/privacy/terms sahifalaridagi huquqiy placeholders uchun mustaqil legal review tugamaguncha haqiqiy nomzodlarni ro'yxatdan o'tkazmang.
- Super Admin va Centre Admin autentifikatsiyasi, sessiya yaratish, demo registratsiya va SMTP tasdiqlashni faqat sun'iy ma'lumotlar bilan tekshiring.
- Pilot Test 001 natijalari uchun alohida **Download Pilot Result PDF** funksiyasidan foydalaning: unda majburiy **not an official score** izohi bor. Pilot natijalar rasmiy QR verification bazasida VALID deb chiqmaydi. Oddiy rasmiy sertifikat chiqarish esa pilot natijalar uchun bloklangan. QR kodi haqiqiy domenni ochsin, noto'g'ri va revoke qilingan kodlar rad etilsin.
- `SENSITIVE_UPLOADS_ENABLED=false` ekanini tekshiring. Uni faqat muvofiqlik/security ko'rigi tugagach yoqing.
- Avtomatik backup, tiklash ssenariysi, monitoring, log rotation, yangilash/patch rejasi va 2FA o'rnatish bo'yicha reja tuzing.

## 5. Backup

SQLite WAL fayllarini faol paytda oddiy copy/paste qilmang. Izchil snapshot uchun `node scripts/backup.js` foydalaning, so'ng `storage` papkasini shu backup bilan bir vaqtda arxivlang. Backupni alohida serverga yoki shifrlangan saqlash joyiga muntazam chiqarib, tiklashni alohida sinang. `.env.production` kriptografik kalitlarini alohida maxfiy va zaxiralangan joyda saqlang.

## 6. Muhim cheklovlar

Production ishga tushirishning o'zi yuridik/audit ishlarining tugaganini bildirmaydi. Pasport, ID va shaxsni tekshirish uchun ishlatilgan fotosuratlar maxsus himoya talab qiladi; qaysi ma'lumotlar qanday joyda saqlanishi O'zbekiston qonunlariga ko'ra tekshirilishi kerak. Bitta SQLite va lokal fayllarga asoslangan arxitektura uchun **bitta instance** ishlating. Katta trafik uchun keyinchalik ma'lumotlar bazasi va storage arxitekturasini o'zgartirish talab etiladi.
