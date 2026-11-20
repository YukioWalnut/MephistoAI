const categories=['Personal','Knowledge','Social','Relationship','Entertainment','Practical','Creative'];
const statuses=['Pending','Active','Paused','Completed','Cancelled','Failed'];
const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Number(n)||0));
function normalize(goal){return {...goal,priority:clamp(goal.priority,1,5),progress:clamp(goal.progress),status:statuses.includes(goal.status)?goal.status:'Pending',category:categories.includes(goal.category)?goal.category:'Personal'};}
function rank(goals){return [...goals].map(normalize).filter(g=>!['Completed','Cancelled','Failed'].includes(g.status)).sort((a,b)=>b.priority-a.priority||b.progress-a.progress);}
function propose({text,existing=[]}){const t=String(text||'').trim();if(t.length<35||!/(می‌خوام|میخوام|هدفم|برنامه دارم|باید|یاد بگیرم|بسازم|تمرین کنم)/u.test(t))return null;const title=t.replace(/[.!؟?].*$/s,'').slice(0,100);if(existing.some(g=>g.title.toLowerCase()===title.toLowerCase()))return null;return {title,description:t,category:/یاد بگیرم|مطالعه|تحقیق/u.test(t)?'Knowledge':'Practical',priority:3,status:'Pending',progress:0};}
module.exports={categories,statuses,normalize,rank,propose,clamp};
