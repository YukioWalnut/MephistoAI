const dims=['trust','familiarity','affection','respect','comfort','emotionalCloseness'];
const clamp=n=>Math.max(0,Math.min(100,Number(n)||0));
const patterns={
 gratitude:/ممنون|مرسی|متشکرم|سپاس|قدردان|thank(?:s| you)/iu,
 affection:/دوستت دارم|عاشقتم|دلم برات تنگ|عزیزی|برام مهمی|love you|miss you/iu,
 hostility:/احمق|خفه شو|متنفرم|از دستت عصبانیم|دروغ گفتی|hate you|shut up/iu,
 apology:/ببخش|معذرت|متاسفم|اشتباه کردم|حق با تو بود|sorry/iu,
 boundary:/حریم خصوصی|بدون اجازه|نه، نمی‌خوام|نمی‌خوام درباره|این موضوع رو ادامه نده/iu,
 trust:/بهت اعتماد دارم|به تو اعتماد دارم|می‌تونم بهت اعتماد کنم|ازت مطمئنم/iu,
 personal:/یه چیزی درباره خودم|می‌خوام برات تعریف کنم|این رو به کسی نگفتم|موضوع شخصی/iu,
 shared:/یادته|مثل دفعه قبل|دوباره اومدم|برگشتم|باز اومدم/iu
};
function update(state={},text=''){
 const s=Object.fromEntries(dims.map(k=>[k,clamp(state[k]??(k==='trust'?15:0))]));
 const t=String(text).trim();
 // Every genuine turn adds a small amount of familiarity; meaningful signals affect separate dimensions.
 if(t.length>=2){s.familiarity=clamp(s.familiarity+(t.length>35?.72:.42));s.comfort=clamp(s.comfort+.10);s.trust=clamp(s.trust+.06);}
 if(patterns.gratitude.test(t)){s.respect=clamp(s.respect+1.1);s.comfort=clamp(s.comfort+.65);s.trust=clamp(s.trust+.35);}
 if(patterns.affection.test(t)){s.affection=clamp(s.affection+1.8);s.trust=clamp(s.trust+.8);s.emotionalCloseness=clamp(s.emotionalCloseness+1.1);}
 if(patterns.hostility.test(t)){s.trust=clamp(s.trust-2.4);s.comfort=clamp(s.comfort-1.5);s.respect=clamp(s.respect-.9);s.emotionalCloseness=clamp(s.emotionalCloseness-.6);}
 if(patterns.apology.test(t)){s.comfort=clamp(s.comfort+.7);s.trust=clamp(s.trust+.5);s.respect=clamp(s.respect+.25);}
 if(patterns.boundary.test(t)){s.respect=clamp(s.respect+1.1);s.trust=clamp(s.trust+.45);}
 if(patterns.trust.test(t)){s.trust=clamp(s.trust+1.4);s.emotionalCloseness=clamp(s.emotionalCloseness+.7);}
 if(patterns.personal.test(t)){s.comfort=clamp(s.comfort+.6);s.emotionalCloseness=clamp(s.emotionalCloseness+.8);s.trust=clamp(s.trust+.35);}
 if(patterns.shared.test(t)){s.familiarity=clamp(s.familiarity+.45);s.emotionalCloseness=clamp(s.emotionalCloseness+.25);}
 return s;
}
// Baseline trust (15) is not counted as earned closeness. A weighted score avoids six-way averaging hiding progress.
function score(s={}){
 const trustEarned=clamp((Number(s.trust||0)-15)/85*100);
 return Math.round(clamp(Number(s.familiarity||0))*.30+trustEarned*.20+clamp(s.respect)*.12+clamp(s.comfort)*.13+clamp(s.affection)*.10+clamp(s.emotionalCloseness)*.15);
}
function stage(s={}){const v=score(s);return v<5?'Stranger':v<18?'Acquaintance':v<40?'Familiar':v<68?'Trusted Companion':'Close Bond';}
module.exports={dims,update,stage,score,clamp,patterns};
