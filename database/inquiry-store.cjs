// Website requests stay separate from customer qualification and fictional CRM data.
const {DatabaseSync}=require('node:sqlite');
const {randomBytes,createHash}=require('node:crypto');
const {fail}=require('./customer-input.cjs');

const fields=new Set(['requestId','name','email','organization','buyerType','useCase','timeline','message','website']);
const buyerTypes=['direct','military'];
const useCases=['Infrastructure inspection','Mapping & surveying','Government evaluation','Other'];
const timelines=['Exploring','Within 3 months','3–6 months','6+ months'];
function text(value,label,max,required=true){
  if(value===undefined&&!required)return '';
  if(typeof value!=='string')fail(label+' must be text.');
  const result=value.trim();
  if(required&&!result)fail(label+' is required.');
  if(result.length>max)fail(label+' is too long.');
  return result;
}
function choice(value,values,label){if(!values.includes(value))fail('Choose a valid '+label+'.');return value;}
function validate(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))fail('Send a valid inquiry object.');
  if(Object.keys(payload).some(key=>!fields.has(key)))fail('The inquiry contains an unsupported field.');
  if(text(payload.website,'Website',200,false))fail('The inquiry could not be submitted.');
  const requestId=text(payload.requestId,'Request ID',36);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))fail('A valid request ID is required.');
  const email=text(payload.email,'Email address',254);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('Enter a valid email address.');
  return {requestId:requestId.toLowerCase(),inquiry:{
    name:text(payload.name,'Name',100),email,
    organization:text(payload.organization,'Organization',160),
    buyerType:choice(payload.buyerType,buyerTypes,'buyer type'),
    useCase:choice(payload.useCase,useCases,'use case'),
    timeline:choice(payload.timeline,timelines,'timeline'),
    message:text(payload.message,'Message',2000,false)
  }};
}
function openInquiryStore(filename){
  const db=new DatabaseSync(filename);
  db.exec(`PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS website_inquiries (
      id INTEGER PRIMARY KEY, reference TEXT NOT NULL UNIQUE,
      requestId TEXT NOT NULL UNIQUE, fingerprint TEXT NOT NULL,
      createdAt TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL,
      organization TEXT NOT NULL, buyerType TEXT NOT NULL,
      useCase TEXT NOT NULL, timeline TEXT NOT NULL, message TEXT NOT NULL
    );`);
  return {
    save(payload){
      const {requestId,inquiry}=validate(payload);
      const fingerprint=createHash('sha256').update(JSON.stringify(inquiry)).digest('hex');
      db.exec('BEGIN IMMEDIATE');
      try{
        const existing=db.prepare('SELECT reference,fingerprint FROM website_inquiries WHERE requestId=?').get(requestId);
        if(existing){
          if(existing.fingerprint!==fingerprint)fail('This request ID was already used for a different inquiry.',409);
          db.exec('COMMIT');return {ok:true,reference:existing.reference};
        }
        const reference='FP-'+randomBytes(6).toString('hex').toUpperCase();
        const values={reference,requestId,fingerprint,createdAt:new Date().toISOString(),...inquiry};
        const keys=Object.keys(values);
        db.prepare(`INSERT INTO website_inquiries (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).run(...Object.values(values));
        db.exec('COMMIT');return {ok:true,reference};
      }catch(error){db.exec('ROLLBACK');throw error;}
    },
    read(){return db.prepare('SELECT id,reference,createdAt,name,email,organization,buyerType,useCase,timeline,message FROM website_inquiries ORDER BY createdAt DESC,id DESC').all();},
    close(){db.close();}
  };
}
module.exports={openInquiryStore};
