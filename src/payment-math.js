'use strict';
// Pure financial calculations and non-reversible coupon token identifiers.
const crypto = require('node:crypto');
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // excludes 0/O/1/I/L
const KEY_FORMAT = /^GEST-([A-Z2-9]{4}-){3}[A-Z2-9]{4}$/;
function price(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<10000||n>50000000)throw Error('Exam price must be a whole number between 10000 and 50000000 UZS.');return n;}
function money(base,percent){
 const amount=price(base);
 const p=Number(percent);if(![25,50,100].includes(p))throw Error('Only 25%, 50%, 100% fee waivers are supported.');
 const discount=Math.floor((amount*p)/100);
 return {original:amount,discount,due:amount-discount,currency:'UZS'};
}
function createCode(){
 let raw='';for(let n=0;n<16;n++)raw+=ALPHABET[crypto.randomInt(ALPHABET.length)];
 return 'GEST-'+raw.match(/.{4}/g).join('-');
}
function normalizeCode(value){return String(value||'').trim().toUpperCase().replace(/\s+/g,'');}
function digest(code,secret){
 if(!secret||secret.length<32)throw Error('FEE_WAIVER_HMAC_SECRET must contain at least 32 characters.');
 return crypto.createHmac('sha256',secret).update('gest-fee-waiver:v1:'+normalizeCode(code)).digest('hex');
}
function validCode(code){const value=normalizeCode(code);return KEY_FORMAT.test(value)&&[...value.slice(5).replaceAll('-','')].every(c=>ALPHABET.includes(c));}

module.exports={ALPHABET,money,createCode,normalizeCode,digest,validCode,price};
