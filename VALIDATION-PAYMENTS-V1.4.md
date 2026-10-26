# GEST v1.4 validation

Checked offline in artifact-building environment:
- JavaScript syntax across src/, scripts/, tests/.
- 5 pure payment/coupon test cases passed: price/discount, invalid values, 1500 safe coupon IDs, deterministic HMAC, invalid secrets.
- SQLite migration tested twice against a populated v1.3 database while retaining its centre, user, session and booking records.
- Full npm test and HTTP/browser flows not executed here: npm registry was unreachable. Tests/payment-service.test.js provides expanded service checks when npm dependencies are installed locally.
- This code has not had an independent security review and is NOT production payment software.
