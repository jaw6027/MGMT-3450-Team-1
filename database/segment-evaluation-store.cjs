const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs');
const path=require('node:path');
const {fail}=require('./customer-input.cjs');
const keys=['fit','pain','access','pilot','commercial'];
function text(value,label,max=1200){if(typeof value!=='string'||value.length>max)fail(label+' must be text of at most '+max+' characters.');return value.trim();}
function validate(input,resolve){
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Send a valid review.');
  if(!Number.isSafeInteger(input.revision)||input.revision<0)fail('Review revision is required.');
  if(!['Brandon','Josh'].includes(input.reviewer))fail('Choose Brandon or Josh as reviewer.');
  const key=text(input.key,'Prospect key',160),prospect=resolve(key);if(!prospect)fail('This prospect is no longer available. Refresh the page.',404);
  if(!['Unknown','Compatible','Incompatible'].includes(input.compatibility))fail('Choose a compatibility status.');
  const compatibilityNote=text(input.compatibilityNote,'Compatibility evidence');
  if(input.compatibility!=='Unknown'&&!compatibilityNote)fail('Explain the compatibility decision.');
  if(typeof input.nominated!=='boolean')fail('Nomination must be true or false.');
  const reason=text(input.reason,'Nomination reason'),nextStep=text(input.nextStep,'Next step');
  if(input.nominated&&(!reason||!nextStep))fail('A nomination needs a reason and a next step.');
  if(input.nominated&&input.compatibility==='Incompatible')fail('An incompatible prospect cannot be nominated. Keep the assessment to explain the blocker.');
  const criteria={};
  for(const key of keys){
    const c=input.criteria?.[key];if(!c||typeof c!=='object')fail('All five criteria must be supplied.');
    const rating=c.rating;if(rating!==null&&(!Number.isInteger(rating)||rating<1||rating>5))fail('Ratings must be blank or whole numbers from 1 to 5.');
    const evidence=text(c.evidence,'Criterion evidence');
    if(!['Unverified','Public source','Customer conversation','Classroom scenario'].includes(c.kind))fail('Choose an evidence type.');
    if(rating!==null&&(!evidence||c.kind==='Unverified'))fail('Each rating needs evidence and its type; leave unknown ratings blank.');
    const url=text(c.url,'Evidence URL',1000);
    if(url){let parsed;try{parsed=new URL(url);}catch{fail('Use a valid HTTP or HTTPS evidence link.');}if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)fail('Use an HTTP or HTTPS evidence link without credentials.');}
    if(rating!==null&&c.kind==='Public source'&&!url)fail('Public-source ratings need a source link.');
    if(prospect.source.startsWith('CRM workspace')&&c.kind==='Customer conversation')fail('Classroom CRM records cannot be presented as confirmed customer conversations. Use Classroom scenario.');
    criteria[key]={rating,evidence,kind:c.kind,url};
  }
  return {prospect,reviewer:input.reviewer,compatibility:input.compatibility,compatibilityNote,nominated:input.nominated,reason,nextStep,criteria};
}
function openEvaluationStore(filename){
  if(filename!==':memory:')fs.mkdirSync(path.dirname(filename),{recursive:true});
  const db=new DatabaseSync(filename);db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS evaluation_meta (id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL); INSERT OR IGNORE INTO evaluation_meta VALUES (1,0); CREATE TABLE IF NOT EXISTS prospect_reviews (prospectKey TEXT NOT NULL,reviewer TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(prospectKey,reviewer));');
  const revision=()=>db.prepare('SELECT revision FROM evaluation_meta WHERE id=1').get().revision;
  const read=()=>({revision:revision(),reviews:db.prepare('SELECT payload FROM prospect_reviews ORDER BY prospectKey,reviewer').all().map(r=>JSON.parse(r.payload))});
  function save(input,resolve){
    const review=validate(input,resolve);
    db.exec('BEGIN IMMEDIATE');try{
      if(input.revision!==revision())fail('Another reviewer saved changes. Refresh team reviews, then save your form again.',409);
      review.updatedAt=new Date().toISOString();
      db.prepare('INSERT INTO prospect_reviews VALUES (?,?,?) ON CONFLICT(prospectKey,reviewer) DO UPDATE SET payload=excluded.payload').run(review.prospect.key,review.reviewer,JSON.stringify(review));
      db.prepare('UPDATE evaluation_meta SET revision=revision+1 WHERE id=1').run();db.exec('COMMIT');return read();
    }catch(error){db.exec('ROLLBACK');throw error;}
  }
  return {read,save,close:()=>db.close()};
}
module.exports={openEvaluationStore,validate};

