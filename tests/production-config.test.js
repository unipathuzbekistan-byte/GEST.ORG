const {test}=require('node:test'),assert=require('node:assert/strict');
const {checkProductionConfig}=require('../src/production-config');
const key='a'.repeat(64);
const valid={NODE_ENV:'production',SESSION_SECRET:key,VERIFICATION_HMAC_SECRET:key,TOKEN_HASH_SECRET:key,FEE_WAIVER_HMAC_SECRET:key,IDENTITY_ENCRYPTION_KEY:key,BASE_URL:'https://gest.test-domain.uz',TRUST_PROXY:'true',SMTP_HOST:'smtp.provider.uz',SMTP_FROM:'GEST <mail@gest.test-domain.uz>',SUPER_ADMIN_EMAIL:'admin@gest.test-domain.uz',CENTRE_ADMIN_EMAIL:'centre@gest.test-domain.uz',SUPER_ADMIN_PASSWORD:'strong_test_password_12345',CENTRE_ADMIN_PASSWORD:'strong_test_password_54321',PAYMENT_MODE:'manual'};
test('production rejects missing secrets',()=>assert.throws(()=>checkProductionConfig({NODE_ENV:'production'}),/SESSION_SECRET/));
test('production accepts well-formed configuration',()=>assert.equal(checkProductionConfig(valid),true));
test('production rejects HTTP domain',()=>assert.throws(()=>checkProductionConfig({...valid,BASE_URL:'http://gest.test-domain.uz'}),/BASE_URL/));
test('production rejects sandbox payments',()=>assert.throws(()=>checkProductionConfig({...valid,PAYMENT_MODE:'sandbox'}),/PAYMENT_MODE/));
test('developer mode keeps local workflow',()=>assert.equal(checkProductionConfig({NODE_ENV:'development'}),true));
