# GEST v1.4: Payment Sandbox + Fee Waiver — Windows bo‘yicha yo‘riqnoma

> Diqqat: faqat rivojlantirish/test rejimi. Kartadan pul yechilmaydi. Click, Payme yoki bankga ulanish yo‘q.

## A. Avval o‘z ma’lumotlaringizni saqlang

1. VS Code terminalida `Ctrl+C` bilan GEST serverini to‘xtating. Agar Windows `Y/N` deb so‘rasa, `Y` ni kiriting.
2. PowerShell'da loyiha papkasida `npm.cmd run backup` ni bajaring. Bu SQLite bazasining alohida `.sqlite` backup faylini yaratadi (`backups/` ichida).
3. Windows Explorer orqali **butun** `gest-website` papkasini (`.env`, `data`, `storage` va `backups` bilan) boshqa xavfsiz, shifrlangan joyga ko‘chirib saqlang. Tasodifan serverning asl papkasini o‘chirib yubormang. Hujjat va imzo fayllarini internetga yoki ommaviy papkaga yuklamang.
4. Bu chat ichidan sizning Windows kompyuteringizdagi asl bazaning backup nusxasini yaratib bo‘lmaydi; uni o‘zingizning kompyuteringizda bajaring.

## B. Yangi kodni o‘rnatish

1. `gest-payment-fee-waiver-v1.4-update.zip` arxivini yuklab, `Extract All` qiling.
2. Arxivdagi `src`, `views`, `public`, `scripts`, `tests` papkalaridagi fayllarni kompyuteringizdagi `gest-website` ichidagi mos joylarga **merge / replace** qiling.
3. ZIP ichidagi `.env.example`, `README.md`, `UPGRADE-PAYMENTS-V1.4-UZ.md` fayllarini ko‘chirish mumkin. **Mavjud `.env` faylini ASLO almashtirmang.** `data/`, `storage/`, `backups/` papkalarini ham almashtirmang.
4. Terminalda:

```powershell
npm.cmd install
npm.cmd test
npm.cmd start
```

Server ishga tushganda eski `.env` faylingizga faqat yangi `FEE_WAIVER_HMAC_SECRET` qo‘shiladi (agar mavjud bo‘lmasa). Uning qiymatini hech kimga yubormang. Keyingi ishga tushirishlarda uni yangilamang.

## C. GEST ichida sinash

1. Super Admin hisobida `http://localhost:3000/admin/fees` manzilini oching.
2. Narx: **890 000 UZS — faqat taklif/sandbox**. Sinov maktabini qo‘shing, masalan `GEST Demo School`.
3. 1 ta 100% voucher kodi yarating va shu sahifadan o‘zingizda xavfsiz saqlang. Bir marta ko‘rsatiladi.
4. Demo nomzod sifatida yangi imtihon sessiyasini bron qiling. `Demo payment checkout` oynasi ochiladi.
5. Vaucherni kiriting: `0 UZS`, `waived` va booking `paid` bo‘lishi kerak.
6. Ikkinchi demo bron bilan 25% kodni sinang. `890000 → 667500 UZS` bo‘ladi. `Simulate DECLINED` ni bosing, keyin `Try again`, keyin `Simulate SUCCESS`. Hech qanday real pul yechilmasligi kerak.
7. Ishlatilgan kodni boshqa bron uchun sinang: qabul qilinmasligi kerak. Oldingi test markazining bu bronni ko‘rishi ham mumkin bo‘lmasligi kerak.
8. Markaz administratori `Registrants` ro‘yxatida sandbox to‘lov holatini ko‘radi; bunda qo‘lda `paid` almashtirish ko‘rsatilmaydi.

## D. Ishga tushirishdan oldin

- Firma/MChJ va provider shartnomalari, HTTPS, haqiqiy to‘lov gateway webhook verifikatsiyasi, refund/tax/accounting, audit, xavfsizlik monitoringi shart.
- `NODE_ENV=production` da bu sandbox **avtomatik o‘chadi**. Real to‘lov ulangan deb hisoblamang.
- Eski skrinshotlarda `.env` maxfiy qiymatlari ko‘rinib qolgan. Saytni ommaga chiqarishdan avval maxfiy kalit va parollarni xavfsiz aylantirish/revocation rejasi kerak; shunchaki identity/document yoki coupon kalitini almashtirish mavjud ma’lumotlarni yaroqsiz qilib qo‘yishi mumkin.
