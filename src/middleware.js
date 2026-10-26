const crypto=require('crypto');const {db}=require('./db');
const {ZodError}=require('zod');
function csrf(req,res,next){if(!req.session.csrf)req.session.csrf=crypto.randomBytes(32).toString('hex');req.csrfToken=()=>req.session.csrf;if(['POST','PUT','PATCH','DELETE'].includes(req.method)){
  const actual=String(req.body?._csrf||req.get('x-csrf-token')||''),expected=req.session.csrf;
  if(actual.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))return res.status(403).page('message',{title:'Request rejected',message:'Security token missing or expired. Reload the page and try again.'});
 }next();}
function auth(req,res,next){if(!req.session.userId)return res.redirect('/login?next='+encodeURIComponent(req.originalUrl));const user=db.prepare('SELECT id,email,role,centre_id,verified,disabled FROM users WHERE id=?').get(req.session.userId);if(!user||user.disabled){req.session.destroy(()=>{});return res.redirect('/login');}req.user=user;next();}
function role(...roles){return (req,res,next)=>roles.includes(req.user?.role)?next():res.status(403).page('message',{title:'Access denied',message:'You do not have permission to access this page.'});}
function handleErrors(err,req,res,next){if(err instanceof ZodError)return res.status(400).page('message',{title:'Invalid input',message:err.issues.map(i=>i.path.join('.')+': '+i.message).join('; ')});if(err.code==='LIMIT_FILE_SIZE')return res.status(400).page('message',{title:'Upload rejected',message:'File too large (ID documents: 5 MB; centre camera photos: 3 MB; signatures: 1 MB).'});if(err.code==='SQLITE_CONSTRAINT_UNIQUE')return res.status(409).page('message',{title:'Already exists',message:'This record already exists.'});console.error(err);res.status(500).page('message',{title:'Something went wrong',message:process.env.NODE_ENV==='production'?'Please try again or contact support.':err.message});}
function flash(req,type,msg){req.session.flash={type,msg};}
module.exports={csrf,auth,role,handleErrors,flash};
