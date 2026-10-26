# GEST v1.3 — Windows uchun xavfsiz yangilash

## 1. Serverni to'xtating va zaxiralang
VS Code terminalida `Ctrl+C` bosing. `C:\Users\user\Desktop\gest-website` papkasini butunligicha (ayniqsa `.env`, `data`, `storage` va imzolarni) boshqa joyga ko'chirib zaxiralang.

## 2. Kichik ZIP yangilanishini joylashtiring
`gest-secure-registration-v1.3-update.zip` faylini oching. Undagi loyiha yo'llari (`src`, `views`, `public`, `scripts`, `tests` va boshqalar) `gest-website` papkasiga mos. Zip ichidagi fayllarni `gest-website` ichiga qo'shing; bir xil nomli **kod** fayllari uchun `Replace` tanlang.

**JUDA MUHIM:** `.env`, `data`, `storage` papkalarini O'CHIRMANG va ustidan yozmang. Yangilanish ZIP ichida bu maxfiy/ishlayotgan fayllar yo'q. `logo.png` va imzolar almashtirilmaydi. SQL jadvallari npm start paytida qo'shiladi, eski natijalar va sertifikatlar saqlanadi.

## 3. Serverni qayta ishga tushiring
PowerShell terminali:

```powershell
npm.cmd install
npm.cmd start
```

Birinchi ishga tushishda eski `.env` fayliga `IDENTITY_ENCRYPTION_KEY` qo'shiladi va 32 baytli random kalit yaratiladi. Uni hech kimga ko'rsatmang. **Keyinchalik bu kalitni yo'qotsangiz shifrlangan pasport/PDF fayllarini ochib bo'lmaydi.** Zaxira bilan birga alohida xavfsiz saqlang.

## 4. Sinov (real pasport ishlatmang)
1. Test nomzod bilan `/candidate/profile` sahifasiga kiring va profilni to'ldiring.
2. Sinov uchun to'qima shaxsiy ma'lumotli JPG yoki oddiy PDF fayl yuklang; `Document received` yozuvi chiqsin.
3. `/sessions` orqali kelajakdagi UZ002 sessiyani tanlang va booking qiling.
4. Markaz admin bilan `/centre` → o'sha session → `ID check & centre photo` tugmasini oching.
5. ID hujjatni ko'rish (download) funksiyasini sinang. **Test uchun real shaxsning hujjatini yubormang.**
6. Kameraga ruxsat bering; sinov uchun kameradan fotosurat oling yoki qurilma kamerasidan JPG faylni tanlang.
7. `Candidate physically present` va `Original ID matched` belgilarini tasdiqlab `Verify identity and check in` bosing.
8. Registrants ro'yxatida `Verified & checked in` chiqsin. Keyin scoring → approval → demo PDF chiqarib, markazda olingan rasm tushganini tekshiring.
9. `/candidate/data-export` va `/candidate/identity-document/download` orqali o'z faylini qaytarib olish ishlashini tekshiring.

Kamera **localhost yoki HTTPS** orqali ishlaydi. Oddiy HTTP'da boshqa qurilmaning kamerasini ishga tushirish brauzer tomonidan bloklanadi.

## 5. Ishga tushirishdan oldin
- Oldin chat/screenshotda ko'ringan `.env` sirlarini xavfsiz rotatsiya qiling (shifrlash kaliti esa mavjud hujjatlarga bog'liq; almashtirish uchun avval qayta shifrlash jarayoni talab qilinadi).
- Antivirus/malware scanner yoki sertifikatlangan fayl skanerlash xizmati ulansin, ayniqsa PDF uchun.
- Maxfiylik/saqlash siyosatini huquqshunos ko'rib chiqsin; voyaga yetmaganlar uchun ota-ona/vasiy roziligi kerak bo'lishi mumkin.
- Admin MFA, HTTPS, disk backup (jumladan kalit) va security audit zarur.
- `npm.cmd test` va `npm.cmd run test:flow` ni (Chromium o'rnatilgan holda) bajarib tekshiring.

**Eslatma:** avtomatik yuzni tanib olish yo'q. Xodim asl hujjatni va nomzodni shaxsan tekshirishi shart.
