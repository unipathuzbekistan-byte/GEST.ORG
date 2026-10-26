const path=require('path'),fs=require('fs'),express=require('express'),helmet=require('helmet'),session=require('express-session'),ejs=require('ejs');
require('dotenv').config({path:path.join(__dirname,'..','.env'),quiet:true});
const {db}=require('./db'),{SQLiteSessionStore}=require('./session-store'),{csrf,handleErrors}=require('./middleware'),{translate}=require('./i18n');
if(process.env.NODE_ENV==='production'&&(!process.env.SESSION_SECRET||!process.env.VERIFICATION_HMAC_SECRET||!process.env.TOKEN_HASH_SECRET||!/^([a-fA-F0-9]{64})$/.test(process.env.IDENTITY_ENCRYPTION_KEY||'')))throw Error('Production secrets including ID-document encryption key are required');
const app=express();app.disable('x-powered-by');if(process.env.TRUST_PROXY==='true')app.set('trust proxy',1);
app.use(helmet({referrerPolicy:{policy:'no-referrer'},contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","https://fonts.googleapis.com"],fontSrc:["'self'","https://fonts.gstatic.com"],imgSrc:["'self'","data:","blob:"],connectSrc:["'self'"],objectSrc:["'none'"],frameAncestors:["'none'"],baseUri:["'self'"],formAction:["'self'"]}}}));
app.use(express.static(path.join(__dirname,'..','public'),{maxAge:'1d'}));app.use(express.urlencoded({extended:false,limit:'25kb'}));app.use(express.json({limit:'25kb'}));
// Only readiness information, no candidate or system data.
app.get('/health',(req,res)=>res.set('Cache-Control','no-store').json({status:'ok'}));
app.use(session({name:'gest.sid',store:new SQLiteSessionStore(db),secret:process.env.SESSION_SECRET||'unsafe-development-only-session-secret',resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:1000*60*60*12}}));
app.set('view engine','ejs');app.set('views',path.join(__dirname,'..','views'));
app.use((req,res,next)=>{
 // Forget language cookies from earlier multilingual versions.
 if (/(?:^|;\s*)gest_lang=/.test(req.headers.cookie||'')) res.clearCookie('gest_lang',{path:'/'});
 res.locals.pilotMode=process.env.NODE_ENV==='production'&&process.env.GEST_PUBLIC_PILOT_MODE!=='false';res.locals.locale='en';res.locals.t=key=>translate('en',key);res.locals.hasLogo=fs.existsSync(path.join(__dirname,'..','public','img','logo.png'));
 res.locals.user=req.session.userId?db.prepare('SELECT id,email,role,centre_id,verified,disabled FROM users WHERE id=?').get(req.session.userId):null;
 res.locals.flash=req.session.flash;delete req.session.flash;
 res.page=(view,data={})=>{const locals={...res.locals,csrf:typeof req.csrfToken==='function'?req.csrfToken():(req.session.csrf||''),...data};ejs.renderFile(path.join(__dirname,'..','views',view+'.ejs'),locals,(err,body)=>{if(err)return next(err);res.render('shell',{...locals,body});});};
 next();
});
// CSRF synchronizer token: always required for authenticated and anonymous state-changing requests.
const multer=require('multer');
// Multer must parse multipart fields before the synchronizer CSRF check. Authorize
// identity uploads before buffering, and validate actual content in the route.
const {auth,role}=require('./middleware');
const identityUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1,fields:4}});
const cameraUpload=multer({storage:multer.memoryStorage(),limits:{fileSize:3*1024*1024,files:1,fields:6},fileFilter:(req,f,cb)=>['image/jpeg','image/png'].includes(f.mimetype)?cb(null,true):cb(Error('Camera photo must be JPEG or PNG.'))});
const sensitiveUploadGate=(req,res,next)=>process.env.NODE_ENV==='production'&&process.env.SENSITIVE_UPLOADS_ENABLED!=='true'?res.status(503).send('Sensitive document collection is not yet enabled. Contact GEST headquarters.'):next();
app.post('/candidate/identity-document',auth,role('candidate'),sensitiveUploadGate,identityUpload.single('document'));
app.post('/centre/booking/:id/identity/verify',auth,role('centre_admin'),sensitiveUploadGate,cameraUpload.single('official_photo'));
// Strictly authorize centre signature uploads before buffering multipart content.
const {upload:signatureUpload}=require('./signatures');
app.post('/admin/centres/:id/signature',auth,role('super_admin'),signatureUpload.single('signature'));
app.use(csrf);
// Old bookmarks remain harmless: drop stale language preference and open English homepage.
app.get('/lang/:lang',(req,res)=>{res.clearCookie('gest_lang',{path:'/'});res.redirect(302,'/');});
app.use(require('./routes/public'));app.use(require('./routes/auth'));app.use('/candidate',require('./routes/candidate'));app.use('/centre',require('./routes/centre'));app.use('/admin/fees',require('./routes/fees'));app.use('/admin',require('./routes/admin'));
app.use((req,res)=>res.status(404).page('message',{title:'Page not found',message:'The requested page could not be found.'}));app.use(handleErrors);
if(require.main===module){const port=Number(process.env.PORT||3000);app.listen(port,'0.0.0.0',()=>console.log(`GEST ready: http://localhost:${port}`));}
module.exports=app;
