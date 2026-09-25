const express=require("express");
const session=require("express-session");
const bcrypt=require("bcryptjs");
const Database=require("better-sqlite3");
const multer=require("multer");
const fs=require("fs");
const path=require("path");

const app=express();
const PORT=process.env.PORT||3000;
const DATA=path.join(__dirname,"data");
const UPLOADS=path.join(DATA,"uploads");
fs.mkdirSync(UPLOADS,{recursive:true});

const db=new Database(path.join(DATA,"somethingcool.db"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS files(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,name TEXT NOT NULL,stored_name TEXT NOT NULL,size INTEGER NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
`);

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(session({
  secret:process.env.SESSION_SECRET||"change-this-session-secret",
  resave:false,
  saveUninitialized:false,
  cookie:{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:1000*60*60*24*7}
}));
app.use(express.static(path.join(__dirname,"public")));

function auth(req,res,next){if(!req.session.userId)return res.status(401).json({error:"Not signed in"});next();}
function safeName(name){return path.basename(name).replace(/[^a-zA-Z0-9._ -]/g,"_").slice(0,120)||"file";}
const storage=multer.diskStorage({destination:UPLOADS,filename:(req,file,cb)=>cb(null,Date.now()+"-"+Math.random().toString(36).slice(2)+path.extname(file.originalname))});
const upload=multer({storage,limits:{fileSize:50*1024*1024}});

app.post("/api/register",async(req,res)=>{
  const email=String(req.body.email||"").trim().toLowerCase(),password=String(req.body.password||"");
  if(!email||!email.includes("@")||password.length<8)return res.status(400).json({error:"Use a valid email and a password with at least 8 characters."});
  try{
    const hash=await bcrypt.hash(password,12);
    const info=db.prepare("INSERT INTO users(email,password_hash) VALUES(?,?)").run(email,hash);
    req.session.userId=info.lastInsertRowid;
    res.json({ok:true,email});
  }catch(e){res.status(409).json({error:"That email is already registered."});}
});
app.post("/api/login",async(req,res)=>{
  const email=String(req.body.email||"").trim().toLowerCase(),password=String(req.body.password||"");
  const user=db.prepare("SELECT * FROM users WHERE email=?").get(email);
  if(!user||!(await bcrypt.compare(password,user.password_hash)))return res.status(401).json({error:"Invalid email or password."});
  req.session.userId=user.id;res.json({ok:true,email:user.email});
});
app.post("/api/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get("/api/me",auth,(req,res)=>{
  const user=db.prepare("SELECT id,email FROM users WHERE id=?").get(req.session.userId);
  const files=db.prepare("SELECT id,name,size,created_at FROM files WHERE user_id=? ORDER BY id DESC").all(req.session.userId);
  res.json({user,files});
});
app.post("/api/upload",auth,upload.single("file"),(req,res)=>{
  if(!req.file)return res.status(400).json({error:"Choose a file."});
  const name=safeName(req.file.originalname);
  db.prepare("INSERT INTO files(user_id,name,stored_name,size) VALUES(?,?,?,?)").run(req.session.userId,name,req.file.filename,req.file.size);
  res.json({ok:true});
});
app.get("/api/download/:id",auth,(req,res)=>{
  const file=db.prepare("SELECT * FROM files WHERE id=? AND user_id=?").get(req.params.id,req.session.userId);
  if(!file)return res.status(404).json({error:"File not found."});
  const full=path.join(UPLOADS,file.stored_name);
  if(!fs.existsSync(full))return res.status(404).json({error:"File is missing."});
  res.download(full,file.name);
});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log("somethingcool running on port "+PORT));
