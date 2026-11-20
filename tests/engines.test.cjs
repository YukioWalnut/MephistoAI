const test=require("node:test");
const assert=require("node:assert/strict");
const Emotion=require("../electron/core/EmotionEngine.cjs");
const Memory=require("../electron/core/MemoryEngine.cjs");
const Relationship=require("../electron/core/RelationshipEngine.cjs");
const Personality=require("../electron/core/PersonalityEngine.cjs");

test("emotion values remain bounded and decay toward baseline",()=>{
 const next=Emotion.update({anger:100,curiosity:90},"سلام");
 assert.ok(next.anger<100 && next.anger>=0);
 for(const value of Object.values(next))assert.ok(value>=0&&value<=100);
});
test("memory retrieval ranks relevant content",()=>{
 const list=[{content:"علاقه به موسیقی کلاسیک",importance:3},{content:"ترجیح غذای ایتالیایی",importance:5}];
 assert.match(Memory.retrieve(list,"موسیقی کلاسیک")[0].content,/موسیقی/);
});
test("relationship dimensions remain independent and bounded",()=>{
 const next=Relationship.update({trust:20,affection:70,familiarity:5,respect:10,comfort:10,emotionalCloseness:3},"ممنون");
 assert.ok(next.respect>10);assert.equal(next.affection,70);assert.ok(next.trust>=0&&next.trust<=100);
});
test("personality prompt refuses fabricated memory",()=>{
 const prompt=Personality.build({memories:[]});
 assert.match(prompt,/Never fabricate memories/);
});
const Goal=require('../electron/core/GoalEngine.cjs');
const Decision=require('../electron/core/DecisionEngine.cjs');
const Autonomy=require('../electron/core/AutonomyEngine.cjs');
const Reflection=require('../electron/core/ReflectionEngine.cjs');
const Speech=require('../electron/core/SpeechEngine.cjs');
const Permissions=require('../electron/security/PermissionManager.cjs');

test('goal proposals are conservative and ranked by priority',()=>{
 assert.equal(Goal.propose({text:'سلام'}),null);
 const p=Goal.propose({text:'می‌خوام زبان ژاپنی یاد بگیرم و هر روز تمرین کنم'});
 assert.ok(p);assert.equal(p.status,'Pending');
 assert.equal(Goal.rank([{title:'a',priority:2},{title:'b',priority:5}])[0].title,'b');
});
test('decision engine prioritizes factual response for sensitive contexts',()=>{
 const d=Decision.decide({text:'در شرایط اورژانس چه کار کنم؟'});assert.equal(d.selected,'answer_directly');assert.equal(d.serious,true);
});
test('autonomy is disabled by default and respects quiet hours and limits',()=>{
 assert.equal(Autonomy.canInitiate({},{}).allowed,false);
 const c={enabled:true,allowProactiveMessages:true,quietStart:'23:00',quietEnd:'08:00',maxMessagesPerDay:1,minIntervalMinutes:60};
 assert.equal(Autonomy.canInitiate(c,{today:1},new Date('2026-11-17T12:00:00')).reason,'daily_limit');
 assert.equal(Autonomy.inQuietHours(new Date('2026-11-17T02:00:00'),'23:00','08:00'),true);
});
test('reflection detects canned language and memory hallucination risk',()=>{
 const r=Reflection.evaluate({reply:'به خاطر دارم آن روز باران می‌بارید. آیا سؤال دیگری دارید؟'});
 assert.ok(r.issues.includes('canned_phrase'));assert.ok(r.issues.includes('memory_claim_without_retrieval'));
});
test('speech layer strips forbidden canned phrases',()=>{
 assert.equal(Speech.validate('سلام. آیا سؤال دیگری دارید؟'),'سلام.');
});
test('external provider permission is explicit and defaults off',()=>{
 assert.throws(()=>Permissions.requirePermission({},'externalProviderPermission'),/Permission denied/);
 assert.equal(Permissions.requirePermission({externalProviderPermission:true},'externalProviderPermission'),true);
});
const scenarios=require('./personality-scenarios.json');
test('at least 100 documented personality conversation scenarios exist',()=>{
 assert.ok(scenarios.length>=100);
 assert.equal(new Set(scenarios.map(s=>s.id)).size,scenarios.length);
 for(const scenario of scenarios){assert.ok(scenario.input.length>0);assert.ok(scenario.checks.includes('no_fabricated_memory'));}
});
test('memory retrieval does not surface unrelated memories as relevant',()=>{
 const list=[{content:'علاقه به موسیقی کلاسیک',importance:5},{content:'ترجیح غذای ایتالیایی',importance:5}];
 assert.equal(Memory.retrieve(list,'موضوع کاملاً متفاوت درباره برنامه نویسی').length,0);
});
test('personality traits can be overridden without mutating the stable defaults',()=>{
 const prompt=Personality.build({traits:{pride:20}});assert.match(prompt,/"pride":20/);assert.equal(Personality.traits.pride,85);
});
test('decision engine selects dark layer for serious contexts and intimate layer for close bonds',()=>{
 assert.equal(Decision.decide({text:'این وضعیت اورژانسی است'}).activeLayer,'darkPersona');
 assert.equal(Decision.decide({text:'یه حرفی دارم',relationship:{emotionalCloseness:80}}).activeLayer,'intimatePersona');
});
const VectorMemory=require('../electron/core/VectorMemoryEngine.cjs');
const AdaptivePersonality=require('../electron/core/AdaptivePersonalityEngine.cjs');
const ExternalServices=require('../electron/services/ExternalServiceManager.cjs');
test('vector similarity ranks semantically nearest vectors',()=>{
 assert.equal(VectorMemory.cosine([1,0],[1,0]),1);
 assert.equal(VectorMemory.cosine([1,0],[0,1]),0);
 const items=[{id:1,content:'موضوع الف'},{id:2,content:'موضوع ب'}];
 const ranked=VectorMemory.hybridSearch(items,'عبارت نامرتبط',[1,0],new Map([[1,[0,1]],[2,[1,0]]]),2);
 assert.equal(ranked[0].id,2);
});
test('adaptive personality requires repeated explicit feedback and stays bounded',()=>{
 const first=AdaptivePersonality.observe({text:'کمتر شوخی کن',adaptive:{},evidence:{}});
 assert.equal(first.applied,false);
 const second=AdaptivePersonality.observe({text:'کمتر شوخی کن',adaptive:first.adaptive,evidence:first.evidence});
 assert.equal(second.applied,true);assert.equal(second.adaptive.humor,-2);
 let current=second;for(let i=0;i<10;i++)current=AdaptivePersonality.observe({text:'کمتر شوخی کن',adaptive:current.adaptive,evidence:current.evidence});
 assert.equal(current.adaptive.humor,-10);
});
test('external service scopes only permit read and write',()=>{
 assert.deepEqual(ExternalServices.safeScopes(['read','admin','write','read']),['read','write']);
});

test('reflection findings adapt style only after repeated evidence',()=>{
 const reflection={issues:['possibly_overlong']};
 const first=AdaptivePersonality.observe({reflection,adaptive:{},style:{},evidence:{}});
 assert.equal(first.applied,false);
 const second=AdaptivePersonality.observe({reflection,adaptive:first.adaptive,style:first.style,evidence:first.evidence});
 assert.equal(second.applied,true);assert.equal(second.style.conciseness,2);
});

test('personality prompt consumes adaptive reflection style directives',()=>{
 const prompt=Personality.build({adaptiveStyle:{conciseness:4,naturalness:2}});
 assert.match(prompt,/conciseness/);assert.match(prompt,/naturalness/);
});

test('relationship score grows from ordinary conversation and does not count initial trust as earned bond',()=>{
 const initial={trust:15,familiarity:0,affection:0,respect:0,comfort:0,emotionalCloseness:0};
 assert.equal(Relationship.score(initial),0);
 let current=initial;
 for(let i=0;i<25;i++)current=Relationship.update(current,'امروز درباره پروژه‌ام می‌خواستم باهات صحبت کنم.');
 assert.ok(Relationship.score(current)>0);
 assert.ok(Relationship.score(current)>=5);
 assert.equal(Relationship.stage(current),'Acquaintance');
});

test('emotion engine responds to varied Persian conversational signals',()=>{
 const base={...Emotion.defaults};
 const frustrated=Emotion.update(base,'این برنامه باز هم کار نمی‌کنه و واقعاً کلافه شدم');
 const curious=Emotion.update(base,'عجیبه، چرا این اتفاق افتاد؟ بیشتر توضیح بده');
 assert.ok(frustrated.annoyance>base.annoyance);
 assert.ok(frustrated.sadness>base.sadness);
 assert.ok(curious.curiosity>base.curiosity);
});

test('repeated feedback that Mephisto sounds robotic improves naturalness style offset',()=>{
 const first=AdaptivePersonality.observe({text:'مثل ربات حرف نزن، خودمونی‌تر باش',adaptive:{},style:{},evidence:{}});
 assert.equal(first.applied,false);
 const second=AdaptivePersonality.observe({text:'مثل ربات حرف نزن، خودمونی‌تر باش',adaptive:first.adaptive,style:first.style,evidence:first.evidence});
 assert.equal(second.applied,true);
 assert.equal(second.style.naturalness,2);
});


test('layered emotion engine exposes broad affect, mood, appraisal and needs',()=>{
 const result=Emotion.update({...Emotion.defaults},'خیلی هیجان دارم، بالاخره موفق شدم!');
 for(const key of ['awe','anxiety','gratitude','moodValence','moodArousal','needConnection','needAutonomy','needSafety','needRest'])assert.ok(key in result);
 assert.ok(result.excitement>Emotion.defaults.excitement);
 assert.ok(result.pride>Emotion.defaults.pride);
 assert.ok(result.emotionalIntensity>Emotion.defaults.emotionalIntensity);
});

test('emotion engine recognizes negation rather than treating it as positive sentiment',()=>{
 const result=Emotion.update({...Emotion.defaults},'من اصلاً خوشحال نیستم و آرام هم نیستم');
 assert.ok(result.happiness<=Emotion.defaults.happiness+0.5);
 assert.ok(result.calmness<=Emotion.defaults.calmness+0.5);
});

test('emotion engine models mixed affect instead of forcing one emotion',()=>{
 const result=Emotion.update({...Emotion.defaults},'هم خوشحالم که موفق شدم، هم از نتیجه کمی می ترسم');
 assert.ok(result.happiness>Emotion.defaults.happiness);
 assert.ok(result.fear>Emotion.defaults.fear);
 assert.ok(result.anxiety>Emotion.defaults.anxiety);
});

test('mood changes more slowly than momentary emotion and emotion summary is usable',()=>{
 const result=Emotion.update({...Emotion.defaults},'خیلی عصبانی و کلافه ام!!!');
 assert.ok(result.anger>Emotion.defaults.anger);
 assert.ok(Math.abs(result.moodValence-Emotion.defaults.moodValence)<20);
 assert.match(Emotion.summary(result),/خلق پایدار/);
});

test('emotional continuity can use recent conversation context',()=>{
 const result=Emotion.update({...Emotion.defaults},'آره', {history:[{role:'user',content:'از شکست خیلی ناراحتم و تنها موندم'}]});
 assert.ok(result.empathy>Emotion.defaults.empathy);
});


test('emotion engine responds empathetically to user self-disclosure instead of copying distress literally',()=>{
 const result=Emotion.update({...Emotion.defaults},'من خیلی ناراحتم و احساس تنهایی می کنم');
 assert.ok(result.empathy>Emotion.defaults.empathy);
 assert.ok(result.sadness<Emotion.defaults.sadness+2);
});

test('emotion engine distinguishes direct reproach from general negative mood',()=>{
 const result=Emotion.update({...Emotion.defaults},'از دستت ناراحتم؛ تو باعث شدی کارم خراب شود');
 assert.ok(result.guilt>Emotion.defaults.guilt);
 assert.ok(result.empathy>Emotion.defaults.empathy);
});
