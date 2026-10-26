const z=require('zod');
const email=z.email().max(254).transform(x=>x.toLowerCase());const password=z.string().min(12).max(128).refine(s=>Buffer.byteLength(s,'utf8')<=72,'Passwords must be 72 UTF-8 bytes or fewer.');
const register=z.object({email,password,consent:z.literal('on')});
const profile=z.object({family_name:z.string().trim().min(1).max(100),first_name:z.string().trim().min(1).max(100),dob:z.iso.date(),sex:z.enum(['Female','Male','Other','Prefer not to say']),country_origin:z.string().trim().min(2).max(100),nationality:z.string().trim().min(2).max(100),first_language:z.string().trim().min(2).max(100),id_document:z.string().trim().min(3).max(80),phone:z.string().trim().min(5).max(32),consent:z.literal('on')});
const centre=z.object({code:z.string().regex(/^[A-Z]{2}[0-9]{3}$/),name:z.string().trim().min(2).max(160),country:z.string().trim().min(2).max(100),city:z.string().trim().min(2).max(100),address:z.string().trim().min(5).max(255),active:z.enum(['0','1']).default('1')});
const session=z.object({test_date:z.iso.date(),start_time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),capacity:z.coerce.number().int().min(1).max(10000),notes:z.string().trim().max(2000).default(''),status:z.enum(['open','closed']).default('open')});
const scores=z.object({listening:z.coerce.number().int().min(0).max(100),reading:z.coerce.number().int().min(0).max(100),writing:z.coerce.number().int().min(0).max(100),speaking:z.coerce.number().int().min(0).max(100),comments:z.string().trim().max(2000).default('')});
module.exports={z,email,password,register,profile,centre,session,scores};
