const TRAIT_RULES=[
 {trait:'humor',direction:-1,patterns:[/کمتر شوخی|شوخی نکن|شوخی(?:‌| )هات زیاده|جدی(?:‌| )تر باش/u]},
 {trait:'humor',direction:1,patterns:[/بیشتر شوخی|شوخ(?:‌| )طبع(?:‌| )تر|شوخی(?:‌| )هات خوبه/u]},
 {trait:'playfulness',direction:-1,patterns:[/کمتر بازیگوش|رفتارت بچگانه|کمتر شیطنت/u]},
 {trait:'playfulness',direction:1,patterns:[/بازیگوش(?:‌| )تر|شیطنت(?:‌| )بیشتر/u]},
 {trait:'curiosity',direction:-1,patterns:[/کمتر سؤال بپرس|سؤال(?:‌| )های کمتری بپرس/u]},
 {trait:'curiosity',direction:1,patterns:[/کنجکاو(?:‌| )تر باش|بیشتر سؤال بپرس/u]},
 {trait:'hiddenKindness',direction:1,patterns:[/مهربان(?:‌| )تر باش|کمی گرم(?:‌| )تر|خشک نباش/u]},
 {trait:'mystery',direction:-1,patterns:[/واضح(?:‌| )تر حرف بزن|کمتر مرموز|مستقیم(?:‌| )تر جواب بده/u]},
 {trait:'mystery',direction:1,patterns:[/مرموز(?:‌| )تر باش|رازآلود(?:‌| )تر/u]},
 {trait:'independence',direction:1,patterns:[/نظر خودت رو بگو|مستقل(?:‌| )تر باش|همیشه موافقت نکن/u]},
 {trait:'sensitivity',direction:-1,patterns:[/کمتر حساس باش|کمتر به خودت بگیر/u]},
 {trait:'sensitivity',direction:1,patterns:[/حساس(?:‌| )تر باش|احساسات رو بیشتر نشون بده|واکنش احساسی(?:‌| )تر/u]},
 {trait:'hiddenKindness',direction:-1,patterns:[/کمتر مهربان باش|اینقدر نرم نباش|کمتر احساساتی/u]},
 {trait:'independence',direction:-1,patterns:[/کمتر لجبازی کن|بیشتر باهام راه بیا|انعطاف(?:‌| )پذیرتر باش/u]}
];

const STYLE_RULES=[
 {key:'naturalness',direction:1,patterns:[/ربات نباش|مثل ربات حرف نزن|طبیعی(?:‌| )تر حرف بزن|خودمونی(?:‌| )تر باش|خشک و رسمی نباش|کلیشه(?:‌| )ای جواب نده/u]},
 {key:'naturalness',direction:-1,patterns:[/رسمی(?:‌| )تر حرف بزن|لحن حرفه(?:‌| )ای داشته باش/u]},
 {key:'conciseness',direction:1,patterns:[/خلاصه(?:‌| )تر بگو|کمتر توضیح بده|حاشیه نرو|کوتاه جواب بده/u]},
 {key:'conciseness',direction:-1,patterns:[/با جزئیات توضیح بده|بیشتر بازش کن|کامل(?:‌| )تر توضیح بده/u]}
];
const REFLECTION_RULES={
 memory_claim_without_retrieval:{target:'trait',key:'caution',direction:1,reason:'repeated-memory-claim-risk'},
 canned_phrase:{target:'style',key:'naturalness',direction:1,reason:'repeated-canned-language'},
 possibly_overlong:{target:'style',key:'conciseness',direction:1,reason:'repeated-overlong-responses'}
};
function detectFeedback(text=''){for(const rule of TRAIT_RULES)if(rule.patterns.some(p=>p.test(text)))return {trait:rule.trait,target:'trait',direction:rule.direction,source:'explicit-user-feedback'};for(const rule of STYLE_RULES)if(rule.patterns.some(p=>p.test(text)))return {trait:rule.key,target:'style',direction:rule.direction,source:'explicit-user-feedback'};return null;}
function observe({text='',adaptive={},style={},evidence={},reflection={}}={}){
 let nextAdaptive={...adaptive},nextStyle={...style},nextEvidence={...evidence};const events=[];
 const signal=detectFeedback(text);
 if(signal){const target=signal.target==='style'?nextStyle:nextAdaptive;const key=`feedback:${signal.target||'trait'}:${signal.trait}:${signal.direction}`;const count=(Number(nextEvidence[key])||0)+1;nextEvidence[key]=count;if(count>=2){const current=Number(target[signal.trait])||0;const next=Math.max(-10,Math.min(10,current+signal.direction*2));if(next!==current){target[signal.trait]=next;events.push({trait:signal.trait,target:signal.target||'trait',direction:signal.direction,delta:next-current,evidenceCount:count,reason:'repeated-explicit-feedback'});}}}
 for(const issue of [...new Set(reflection.issues||[])]){const rule=REFLECTION_RULES[issue];if(!rule)continue;const key=`reflection:${issue}`;const count=(Number(nextEvidence[key])||0)+1;nextEvidence[key]=count;if(count<2)continue;const target=rule.target==='trait'?nextAdaptive:nextStyle;const current=Number(target[rule.key])||0;const next=rule.direction>0?Math.min(10,current+2):Math.max(-10,current-2);if(next!==current){target[rule.key]=next;events.push({trait:rule.key,direction:rule.direction,delta:next-current,evidenceCount:count,reason:rule.reason});}}
 return {signal,adaptive:nextAdaptive,style:nextStyle,evidence:nextEvidence,events,applied:events.length>0};
}
function effectiveTraits(base={},adaptive={}){const out={...base};for(const [k,v] of Object.entries(adaptive))if(k in out)out[k]=Math.max(0,Math.min(100,(Number(out[k])||0)+(Number(v)||0)));return out;}
module.exports={detectFeedback,observe,effectiveTraits,REFLECTION_RULES};
