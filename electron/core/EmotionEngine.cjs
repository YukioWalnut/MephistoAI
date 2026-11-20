'use strict';

// Layered, deterministic affect simulation. Values are intensities (0..100), not
// claims of sentience. The legacy keys are retained for Avatar/UI compatibility.
const defaults = Object.freeze({
  happiness:35, sadness:0, anger:0, fear:0, anxiety:5, disgust:0, contempt:0,
  surprise:5, curiosity:60, excitement:20, affection:20, longing:0, jealousy:0,
  loneliness:10, trust:15, pride:35, embarrassment:5, guilt:0, gratitude:8,
  hope:25, frustration:0, annoyance:0, calmness:50, confidence:45,
  insecurity:8, empathy:35, boredom:0, determination:30, relief:5,
  admiration:10, shame:0, envy:0, awe:8,
  // Slowly changing affective climate and appraisal dimensions.
  moodValence:52, moodArousal:38, moodDominance:55, emotionalIntensity:0,
  needConnection:45, needAutonomy:60, needSafety:65, needCompetence:55,
  needNovelty:55, needRest:30
});
const clamp = n => Math.max(0, Math.min(100, Number.isFinite(Number(n)) ? Number(n) : 0));
const lerp = (a,b,t) => a + (b-a)*t;
const decay = Object.freeze({
  happiness:.91,sadness:.94,anger:.82,fear:.91,anxiety:.94,disgust:.88,contempt:.90,
  surprise:.70,curiosity:.96,excitement:.88,affection:.992,longing:.97,jealousy:.94,
  loneliness:.97,trust:.999,pride:.995,embarrassment:.84,guilt:.94,gratitude:.985,
  hope:.985,frustration:.84,annoyance:.82,calmness:.95,confidence:.995,
  insecurity:.97,empathy:.99,boredom:.95,determination:.99,relief:.90,
  admiration:.99,shame:.95,envy:.94,awe:.94,
  moodValence:.985,moodArousal:.96,moodDominance:.985,emotionalIntensity:.86,
  needConnection:.998,needAutonomy:.998,needSafety:.998,needCompetence:.998,needNovelty:.998,needRest:.998
});

function normalize(text='') {
  return String(text).toLowerCase()
    .replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[ۀة]/g,'ه')
    .replace(/[\u064B-\u065F\u0670]/g,'').replace(/[\u200c\u200f\u200e]/g,' ')
    .replace(/ـ+/g,'').replace(/\s+/g,' ').trim();
}

// Each lexicon maps conversational evidence to an appraisal, not just a word count.
const lexicon = {
  happiness:[/خوشحال(?:م|م که| شدم| بودم)?/gu,/ذوق(?: دارم| کردم| زده)?/gu,/حال(?:م|مون) خوبه/gu,/لذت بردم/gu,/چه خوب/gu,/عالی(?:ه| بود| شد)?/gu,/باحال(?:ه| بود)?/gu,/خندم گرفت/gu,/😊|😄|😁|🥳|❤️/gu,/\b(?:happy|glad|joyful|great|awesome)\b/giu],
  sadness:[/غمگین(?:م| شدم)?/gu,/ناراحت(?:م| شدم)?/gu,/دلم گرفته/gu,/اشکم دراومد/gu,/گریه(?:م| کردم)?/gu,/شکست(?: خوردم| خوردم که)/gu,/ناامید(?:م| شدم)?/gu,/😢|😭|💔/gu,/\b(?:sad|heartbroken|depressed|upset)\b/giu],
  anger:[/عصبانی(?:م| شدم)?/gu,/خشمگین(?:م| شدم)?/gu,/از دستت عصبانیم/gu,/حرصم(?:و| دراومد)?/gu,/اعصابم خورد/gu,/خفه شو/gu,/لعنتی/gu,/🤬|😡/gu,/\b(?:angry|furious|rage)\b/giu],
  fear:[/می ?ترسم/gu,/ترسیدم/gu,/وحشت(?: دارم| کردم|ناک)?/gu,/خطر(?:ناکه|ناک)/gu,/می ?ترسوندم/gu,/😨|😱/gu,/\b(?:afraid|scared|terrified)\b/giu],
  anxiety:[/نگران(?:م| شدم)?/gu,/استرس دارم/gu,/مضطرب(?:م| شدم)?/gu,/دلشوره/gu,/آرام و قرار ندارم/gu,/فکرم درگیره/gu,/\b(?:anxious|worried|stress(?:ed)?)\b/giu],
  disgust:[/حالم به هم خورد/gu,/چندش(?:ه|م شد)?/gu,/متنفرم/gu,/بدم میاد/gu,/تهوع آور/gu,/🤢/gu,/\b(?:disgusted|gross|revolting)\b/giu],
  contempt:[/مسخره(?:ست| است| کردی)/gu,/چه احمقانه/gu,/ارزش(?:ش)?و نداره/gu,/بی عرضه/gu,/\b(?:pathetic|ridiculous|contempt)\b/giu],
  surprise:[/باورم نمی ?شه/gu,/جدی(?:؟| میگی| می‌گی)?/gu,/واقعاً\?/gu,/غافلگیر(?: شدم| کننده)?/gu,/شوکه(?: شدم)?/gu,/عجب/gu,/وای/gu,/😮|😲|😳/gu,/\b(?:wow|surprised|unbelievable)\b/giu],
  curiosity:[/کنجکاو(?:م| شدم)/gu,/چرا/gu,/چطور/gu,/چه جوری/gu,/بیشتر توضیح بده/gu,/بیشتر بگو/gu,/جالبه/gu,/نظرت چیه/gu,/چه فکری می کنی/gu,/می خوام بدونم/gu,/\b(?:curious|wonder|why|how)\b/giu],
  excitement:[/هیجان(?: دارم| زده ام| زده شدم)?/gu,/بی صبرانه منتظرم/gu,/نمی تونم صبر کنم/gu,/فوق العاده/gu,/ترکوندی/gu,/🔥|🤩|⚡/gu,/\b(?:excited|can't wait|thrilled)\b/giu],
  affection:[/دوستت دارم/gu,/عاشقتم/gu,/عزیزی/gu,/برام مهمی/gu,/بهت علاقه دارم/gu,/قربونت/gu,/دلم برات/gu,/❤️|🥰|😘/gu,/\b(?:love you|care about you)\b/giu],
  longing:[/دلم برات تنگ/gu,/دلم می خواست پیشم بودی/gu,/کاش اینجا بودی/gu,/منتظرت بودم/gu,/دلتنگ(?:م| شدم)?/gu,/\b(?:miss you|longing)\b/giu],
  jealousy:[/حسود(?:م|یم شد)?/gu,/بهش حسودیم شد/gu,/چرا با اونا/gu,/منو با .* مقایسه/gu,/\b(?:jealous|envy)\b/giu],
  loneliness:[/تنها(?:م| هستم| موندم)/gu,/کسی رو ندارم/gu,/هیچکس کنارم نیست/gu,/احساس تنهایی/gu,/بی کس/gu,/\b(?:lonely|alone)\b/giu],
  trust:[/بهت اعتماد دارم/gu,/به تو اعتماد دارم/gu,/ازت مطمئنم/gu,/می تونم بهت تکیه کنم/gu,/حرفتو باور دارم/gu,/\b(?:trust you|rely on you)\b/giu],
  pride:[/به خودم افتخار/gu,/از پسش بر اومدم/gu,/انجامش دادم/gu,/موفق شدم/gu,/بالاخره تونستم/gu,/\b(?:proud|nailed it|accomplished)\b/giu],
  embarrassment:[/خجالت(?: می کشم| کشیدم| زده)?/gu,/شرمنده(?:م| شدم)?/gu,/معذب(?:م| شدم)?/gu,/سوتی دادم/gu,/آبروم رفت/gu,/😅|🫣/gu,/\b(?:embarrassed|awkward)\b/giu],
  guilt:[/تقصیر من بود/gu,/اشتباه از من بود/gu,/عذاب وجدان/gu,/نباید این کارو می کردم/gu,/باید عذرخواهی کنم/gu,/\b(?:guilty|my fault)\b/giu],
  gratitude:[/ممنون(?:م)?/gu,/مرسی/gu,/متشکرم/gu,/قدردان(?:م)?/gu,/دمت گرم/gu,/لطف کردی/gu,/سپاس/gu,/🙏/gu,/\b(?:thanks|thank you|grateful)\b/giu],
  hope:[/امیدوارم/gu,/امید دارم/gu,/شاید درست بشه/gu,/بالاخره بهتر میشه/gu,/به آینده امیدوار/gu,/\b(?:hopeful|hope)\b/giu],
  frustration:[/کلافه(?:م| شدم)?/gu,/بازم خراب شد/gu,/کار نمی کنه/gu,/جواب نمی ده/gu,/درست پیش نمی ره/gu,/خسته شدم از/gu,/اعصاب خوردکن/gu,/🤦/gu,/\b(?:frustrated|doesn't work|broken again)\b/giu],
  annoyance:[/رو مخمه/gu,/حوصله ندارم/gu,/اعصابم رو خرد/gu,/چقدر تکراری/gu,/بس کن دیگه/gu,/کلافه کننده/gu,/\b(?:annoyed|irritated)\b/giu],
  calmness:[/آروم(?:م| شدم)?/gu,/خیالم راحت/gu,/نگران نیستم/gu,/همه چی مرتبه/gu,/نفس راحت/gu,/🧘|😌/gu,/\b(?:calm|relaxed|at ease)\b/giu],
  confidence:[/مطمئن(?:م|م که)/gu,/از عهده اش برمیام/gu,/بلدم/gu,/می تونم انجامش بدم/gu,/شک ندارم/gu,/\b(?:confident|certain|capable)\b/giu],
  insecurity:[/به اندازه کافی خوب نیستم/gu,/از خودم مطمئن نیستم/gu,/شک دارم به خودم/gu,/نکنه نتونم/gu,/می ترسم خراب کنم/gu,/\b(?:insecure|not good enough|self doubt)\b/giu],
  empathy:[/درکت می کنم/gu,/می فهمم چه حسی داری/gu,/حق داری این حسو داشته باشی/gu,/نگرانتم/gu,/متأسفم که اینو تجربه کردی/gu,/\b(?:I understand|that sounds hard|I'm sorry)\b/giu],
  boredom:[/حوصله م سر رفت/gu,/کسل کننده/gu,/خسته کننده/gu,/تکراریه/gu,/دیگه جذاب نیست/gu,/😴/gu,/\b(?:bored|boring)\b/giu],
  determination:[/ول کن نیستم/gu,/ادامه می دم/gu,/تسلیم نمی شم/gu,/تا آخرش می رم/gu,/مصمم(?:م)?/gu,/از نو شروع می کنم/gu,/\b(?:determined|keep going|won't give up)\b/giu],
  relief:[/خیالم راحت شد/gu,/چه نفس راحتی/gu,/خداروشکر حل شد/gu,/بالاخره تموم شد/gu,/از نگرانی دراومدم/gu,/😮‍💨/gu,/\b(?:relieved|what a relief)\b/giu],
  admiration:[/تحسینت می کنم/gu,/قابل تحسینه/gu,/چه با استعداد/gu,/آفرین/gu,/دمتون گرم/gu,/\b(?:admire|impressive|well done)\b/giu],
  shame:[/از خودم خجالت می کشم/gu,/شرم آوره/gu,/مایه خجالته/gu,/احساس شرم/gu,/\b(?:ashamed|shameful)\b/giu],
  envy:[/کاش منم مثل اون/gu,/خوش به حالش/gu,/منم همچین چیزی می خوام/gu,/\b(?:envious|wish I had)\b/giu],
  awe:[/شگفت انگیز/gu,/حیرت انگیز/gu,/چه عظمت(?:ی)?/gu,/مبهوت شدم/gu,/فوق تصور/gu,/🤯|✨/gu,/\b(?:awe|magnificent|astonishing)\b/giu]
};

const negation = /(?:نه|نمی|نمی ?خوام|اصلا|ابدا|هرگز|بدون اینکه|نه اینکه)\s*(?:خیلی\s*)?$/u;
const postNegation = /^\s*(?:نیستم|نیست|نبودم|نبود|نمی شم|نمی شوم|نمی مونم|نمی مانم|نخواهم بود)/u;
const intensifiers = /(خیلی|واقعاً|شدیداً|بشدت|فوق العاده|اصلاً|با تمام وجود|به شدت|واقعی)/gu;
const soften = /(یه کم|کمی|تا حدی|شاید|انگار|تقریباً)/gu;
function countMatches(text, patterns) { let count=0; for(const p of patterns){p.lastIndex=0; count += [...text.matchAll(p)].length;} return count; }
function analyze(text='', context={}) {
  const t=normalize(text), signals={};
  for(const [name,patterns] of Object.entries(lexicon)) {
    const hits=countMatches(t,patterns);
    if(hits) signals[name]=Math.min(1.8,hits*.72);
  }
  // Negation weakens nearby lexical cues; it does not simply invert them.
  for(const [name,patterns] of Object.entries(lexicon)) {
    for(const p of patterns){p.lastIndex=0; let m; while((m=p.exec(t))){const before=t.slice(Math.max(0,m.index-22),m.index);const after=t.slice(m.index+m[0].length,m.index+m[0].length+18);if(negation.test(before)||postNegation.test(after)){signals[name]=0;break;}}}
  }
  const strong=countMatches(t,[intensifiers]), soft=countMatches(t,[soften]);
  const punctuation=(String(text).match(/[!?؟]{2,}/gu)||[]).length;
  const emojiBoost=(String(text).match(/[😀-🙏🌀-🫿]/gu)||[]).length*.08;
  const intensity=clamp(35+strong*18-soft*10+punctuation*7+emojiBoost*20+Math.min(12,String(text).length/30));
  const modifier=clamp(intensity/65,.45,1.65);
  for(const key of Object.keys(signals)) signals[key]=clamp(signals[key]*modifier/1.65)/1.0;
  // Contextual appraisals: a correction, apology, praise or boundary changes the meaning.
  const appraisals={};
  if(/ببخش|معذرت|متاسفم|اشتباه کردم|حق با تو بود|sorry/iu.test(t))appraisals.repair=1;
  if(/دروغ گفتی|قول دادی|یادت رفت|فراموش کردی|اشتباه کردی/iu.test(t))appraisals.betrayal=.8;
  if(/ممنون|مرسی|لطف کردی|کمکم کردی/iu.test(t))appraisals.receivedCare=.7;
  if(/نمی خوام|نمیخوام|بس کن|ادامه نده|حریم خصوصی|این موضوع رو ادامه نده|نه،? ممنون/iu.test(t))appraisals.boundary=.8;
  if(/موفق شدم|بالاخره تونستم|حل شد|تمومش کردم/iu.test(t))appraisals.achievement=.8;
  if(/شکست خوردم|خراب شد|نتونستم|از دست رفت/iu.test(t))appraisals.loss=.7;
  if(/تنها|دلتنگ|کسی نیست|دلم گرفته/iu.test(t))appraisals.separation=.7;
  if(/تهدید|خطر|آسیب|می ترسم|وحشت/iu.test(t))appraisals.threat=.8;
  if(/جالبه|چرا|چطور|بیشتر بگو|چه میشه اگر/iu.test(t))appraisals.novelty=.55;
  if(/عالی|آفرین|تحسین|موفقیت/iu.test(t))appraisals.validation=.55;
  const directReproach=/(?:از دستت ناراحتم|تو باعث شدی|تو همیشه|باز خراب کردی|به من بی احترامی کردی|حرفمو نفهمیدی)/iu.test(t);
  const selfDisclosure=/(?:من |حالم|احساس می کنم|احساس میکنم|دلم|برای من|ناراحتم|خوشحالم|می ترسم|نگرانم|تنها(?:م| هستم))/iu.test(t);
  const userDistress=!directReproach && selfDisclosure && ['sadness','fear','anxiety','loneliness','frustration'].some(k=>signals[k]>0);
  if(userDistress){
    for(const key of ['sadness','fear','anxiety','loneliness','frustration'])if(signals[key])signals[key]*=.22;
    signals.empathy=Math.max(signals.empathy||0,.72);
    appraisals.userDistress=.85;
  }
  if(directReproach)appraisals.reproach=.85;
  const previousTurns=Array.isArray(context.history)?context.history.slice(-6):[];
  if(previousTurns.length && /ولی|اما|با این حال|در عوض/u.test(t)) appraisals.reappraisal=.35;
  return {signals,appraisals,intensity,textLength:String(text).length};
}

function update(previous={}, text='', context={}) {
  const e={};
  for(const [key,base] of Object.entries(defaults)) {
    const old=Number(previous[key]);
    const safe=Number.isFinite(old)?clamp(old):base;
    e[key]=clamp(base+(safe-base)*(decay[key]??.96));
  }
  const a=analyze(text,context), s=a.signals, p=a.appraisals;
  const add=(key,amount)=>{e[key]=clamp(e[key]+amount);};
  const set=(key,value)=>{e[key]=clamp(value);};
  const signal=(key)=>Number(s[key]||0);
  const weighted=(key,amount)=>amount*signal(key);

  for(const key of Object.keys(s)) if(key in e) add(key,weighted(key,12));
  // Cross-emotion effects create blended, non-binary responses.
  add('calmness',-signal('anger')*4-signal('fear')*3-signal('anxiety')*3+signal('relief')*5);
  add('happiness',-signal('sadness')*2.2-signal('anger')*1.2+signal('relief')*2);
  add('sadness',signal('loneliness')*2+signal('loss')*0);
  add('anxiety',signal('fear')*2.4+signal('insecurity')*1.5);
  add('affection',signal('gratitude')*1.2+signal('empathy')*.7);
  add('curiosity',signal('surprise')*1.8+signal('awe')*1.3);
  add('determination',signal('frustration')*1.1+signal('pride')*.6);
  add('annoyance',signal('frustration')*2.5);
  add('sadness',signal('frustration')*.8);
  add('calmness',-signal('frustration')*2);
  add('emotionalIntensity',a.intensity*.24);

  if(p.repair){add('anger',-9);add('annoyance',-8);add('trust',1.2);add('relief',2.5);add('calmness',3);add('guilt',-2);}
  if(p.betrayal){add('trust',-3.5);add('sadness',2.5);add('anger',3);add('insecurity',1.5);}
  if(p.receivedCare){add('gratitude',4);add('affection',1.5);add('trust',.7);add('happiness',1.5);}
  if(p.boundary){add('needAutonomy',-2);add('calmness',1);add('trust',.25);}
  if(p.achievement){add('pride',5);add('confidence',3);add('hope',2);add('relief',2);add('happiness',2);add('needCompetence',-3);}
  if(p.loss){add('sadness',3.5);add('frustration',3);add('confidence',-1.5);add('needCompetence',4);}
  if(p.separation){add('longing',3);add('loneliness',2.5);add('needConnection',5);}
  if(p.threat){add('fear',4);add('anxiety',3);add('needSafety',6);add('calmness',-2);}
  if(p.novelty){add('curiosity',3);add('needNovelty',-3);}
  if(p.validation){add('pride',1.5);add('confidence',1.2);}
  if(p.userDistress){add('empathy',5);add('affection',.8);add('hope',1.2);add('needConnection',1.4);}
  if(p.reproach){add('guilt',3.2);add('empathy',2.5);add('sadness',1.8);add('frustration',1.2);add('needCompetence',1.2);}

  // The current conversation is an event, while mood is a slower running average.
  const valence=clamp(50 + (e.happiness+e.hope+e.affection+e.gratitude+e.relief+e.pride - e.sadness-e.anger-e.fear-e.anxiety-e.frustration-e.loneliness)/8);
  const arousal=clamp(22 + (e.excitement+e.anger+e.fear+e.surprise+e.anxiety+e.curiosity+e.frustration)/7);
  const dominance=clamp(50 + (e.confidence+e.determination+e.pride-e.fear-e.insecurity-e.shame)/5);
  set('moodValence',lerp(e.moodValence,valence,.12));
  set('moodArousal',lerp(e.moodArousal,arousal,.16));
  set('moodDominance',lerp(e.moodDominance,dominance,.10));
  // Needs are slow variables. Events can satisfy or frustrate them, but never hit zero instantly.
  add('needConnection',signal('loneliness')*1.8-signal('affection')*1.2-signal('gratitude')*.5);
  add('needAutonomy',signal('annoyance')*.8+signal('anger')*.4);
  add('needSafety',signal('fear')*1.4+signal('anxiety')*1.2-signal('calmness')*.5);
  add('needCompetence',signal('frustration')*1.1-signal('pride')*.8-signal('determination')*.4);
  add('needNovelty',signal('boredom')*1.3-signal('curiosity')*.8);
  add('needRest',Math.max(0,a.intensity-65)*.08+signal('anxiety')*.5+signal('excitement')*.25);

  // Contextual continuity: short acknowledgements inherit a little of the last user turn's tone.
  const history=Array.isArray(context.history)?context.history:[];
  if(String(text).trim().length<14 && history.length){
    const last=normalize(history[history.length-1]?.content||'');
    if(/غمگین|ناراحت|دلم گرفته|تنها/u.test(last))add('empathy',1.1);
    if(/موفق|عالی|خوشحال|حل شد/u.test(last))add('happiness',.7);
  }
  for(const key of Object.keys(e))e[key]=clamp(e[key]);
  return e;
}

function dominant(state={}) {
  const keys=Object.keys(defaults).filter(k=>!k.startsWith('mood')&&!k.startsWith('need')&&k!=='emotionalIntensity');
  return keys.map(key=>({key,value:clamp(state[key]??defaults[key])})).sort((a,b)=>b.value-a.value).slice(0,3);
}
function summary(state={}) {
  const top=dominant(state).filter(x=>x.value>=22);
  const mood=Number(state.moodValence??defaults.moodValence);
  const energy=Number(state.moodArousal??defaults.moodArousal);
  const moodLabel=mood>=65?'رو به مثبت':mood<=38?'سنگین و منفی':'متعادل';
  const energyLabel=energy>=68?'پرانرژی':energy<=30?'کم‌انرژی':'باانرژی متوسط';
  return `حالت‌های برجسته: ${top.map(x=>`${x.key} ${Math.round(x.value)}/100`).join('، ')||'هیجان برجسته‌ای ندارد'}؛ خلق پایدار: ${moodLabel}؛ برانگیختگی: ${energyLabel}؛ نیازها: ارتباط ${Math.round(state.needConnection??45)}، استقلال ${Math.round(state.needAutonomy??60)}، امنیت ${Math.round(state.needSafety??65)}، استراحت ${Math.round(state.needRest??30)}.`;
}
module.exports={defaults,decay,lexicon,normalize,analyze,update,dominant,summary,clamp};
