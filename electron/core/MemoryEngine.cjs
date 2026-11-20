function terms(value){return String(value||'').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(x=>x.length>2);}
function overlapCount(memory,query){const words=terms(query);if(!words.length)return 0;const content=String(memory.content||'').toLowerCase();return new Set(words.filter(w=>content.includes(w))).size;}
function score(memory,query){const overlap=overlapCount(memory,query);return overlap*4+(Number(memory.importance)||1)*.08+(Number(memory.confidence)||.7)*.1;}
function retrieve(memories,query,limit=12){return [...(memories||[])].filter(m=>overlapCount(m,query)>0).sort((a,b)=>score(b,query)-score(a,query)).slice(0,limit);}
function candidate(text){const t=String(text).trim();const patterns=[/من (?:معمولاً|معمولا|همیشه|اغلب|ترجیح می‌دهم|ترجیح میدم|دوست دارم|علاقه دارم).{5,180}/u,/my (?:favorite|usual|preferred|name|job).{3,160}/i,/من [^.!؟?]{5,120} هستم/u];const found=patterns.map(p=>t.match(p)).find(Boolean);return found?.[0]||null;}
module.exports={terms,overlapCount,score,retrieve,candidate};
