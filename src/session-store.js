const session=require('express-session');
class SQLiteSessionStore extends session.Store{
 constructor(db){super();this.db=db;
  db.exec('CREATE TABLE IF NOT EXISTS web_sessions (sid TEXT PRIMARY KEY, payload TEXT NOT NULL, expires_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS idx_web_sessions_expiry ON web_sessions(expires_at)');
  this.getStmt=db.prepare('SELECT payload,expires_at FROM web_sessions WHERE sid=?');
  this.putStmt=db.prepare('INSERT INTO web_sessions(sid,payload,expires_at) VALUES(?,?,?) ON CONFLICT(sid) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at');
  this.delStmt=db.prepare('DELETE FROM web_sessions WHERE sid=?');
  this.cleanup=setInterval(()=>{try{db.prepare('DELETE FROM web_sessions WHERE expires_at<=?').run(Date.now());}catch(e){this.emit('error',e);}},900000);this.cleanup.unref();
 }
 get(sid,cb){try{const data=this.getStmt.get(sid);if(!data||data.expires_at<=Date.now()){if(data)this.delStmt.run(sid);return cb(null,null);}cb(null,JSON.parse(data.payload));}catch(e){cb(e);}}
 set(sid,value,cb){try{const exp=value.cookie?.expires?new Date(value.cookie.expires).getTime():Date.now()+43200000;this.putStmt.run(sid,JSON.stringify(value),exp);cb?.(null);}catch(e){cb?.(e);}}
 destroy(sid,cb){try{this.delStmt.run(sid);cb?.(null);}catch(e){cb?.(e);}}
 touch(sid,value,cb){try{const exp=value.cookie?.expires?new Date(value.cookie.expires).getTime():Date.now()+43200000;this.db.prepare('UPDATE web_sessions SET expires_at=? WHERE sid=?').run(exp,sid);cb?.(null);}catch(e){cb?.(e);}}
 close(){clearInterval(this.cleanup);}
}
module.exports={SQLiteSessionStore};
