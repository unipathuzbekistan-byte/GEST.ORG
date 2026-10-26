const nodemailer=require('nodemailer');
let transport;
async function sendEmail(to,subject,text){
 const host=process.env.SMTP_HOST;
 if(!host){if(process.env.NODE_ENV==='production')throw Error('SMTP_HOST must be configured in production');console.log('\n[DEVELOPMENT EMAIL]',JSON.stringify({to,subject,text},null,2),'\n');return;}
 if(!transport)transport=nodemailer.createTransport({host,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}:undefined});
 await transport.sendMail({from:process.env.SMTP_FROM||'GEST <no-reply@gest.local>',to,subject,text});
}
module.exports={sendEmail};
