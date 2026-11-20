function decide({text='',emotion={},relationship={},goals=[],permissions={}}={}){
 const serious=/(اورژانس|خطر|خودکشی|آسیب|دارو|امنیت|رمز|پول|قانونی)/u.test(text);
 const options=['answer_directly','ask_clarification','deep_explanation','brief_reaction'];
 const selected=serious?'answer_directly':String(text).length<45?'brief_reaction':goals.length?'answer_with_goal_context':'answer_directly';
 const activeLayer=serious?'darkPersona':Number(relationship?.emotionalCloseness||0)>55?'intimatePersona':Number(emotion?.sadness||0)>55?'hiddenEmotions':'publicPersona';
 return {options,selected,activeLayer,reason:serious?'موضوع حساس؛ دقت و مسئولیت مقدم است':selected==='brief_reaction'?'پیام کوتاه است؛ واکنش طبیعی و مختصر مناسب‌تر است':'انتخاب بر اساس زمینه، اهداف و وضعیت شناختی',serious};
}
module.exports={decide};
