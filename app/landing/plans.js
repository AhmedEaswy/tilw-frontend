// Ported from the tilwprompter v4 artifact (plans script).
export default function initPlans() {

const $=id=>document.getElementById(id);const root=$('pl-ai');if(!root)return;
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches,wait=ms=>new Promise(r=>setTimeout(r,ms));
if(!RM)$('pl-dots').innerHTML=Array.from({length:18},(_,i)=>`<i style="left:${(i*53)%100}%;--s:${3+(i*7)%5}px;--t:${6+(i*13)%7}s;--d:${-(i*1.3)%8}s"></i>`).join('');
const W=["كل","فكرة","تستحق","أن","تصل","بطريقتك","أنت."];
const box=root.querySelector('.pl-words');box.innerHTML=W.map((w,i)=>`<span class="${i>4?'l2':''}">${w}</span>`).join('');
const spans=[...box.querySelectorAll('span')],br=document.createElement('i');br.className='br';
const apply=root.querySelector('.pl-apply'),scan=root.querySelector('.pl-scan');
function flip(mut){const a=spans.map(s=>s.getBoundingClientRect());mut();const b=spans.map(s=>s.getBoundingClientRect());
  spans.forEach((s,i)=>{s.style.transition='none';s.style.transform=`translate(${a[i].left-b[i].left}px,${a[i].top-b[i].top}px)`;});
  void box.offsetWidth;spans.forEach((s,i)=>{s.style.transition=`transform .55s cubic-bezier(.3,.8,.2,1) ${i*35}ms`;s.style.transform='none';});}
const split=()=>flip(()=>{box.insertBefore(br,spans[5]);box.classList.add('split')}),join=()=>flip(()=>{br.remove();box.classList.remove('split')});
if(RM){split();return;}
let on=true;new IntersectionObserver(e=>{on=e[0].isIntersecting}).observe(root);
(async function loop(){for(;;){if(!on||document.hidden){await wait(500);continue;}
  apply.classList.remove('done');apply.textContent='تطبيق';await wait(900);
  scan.classList.remove('go');void scan.offsetWidth;scan.classList.add('go');await wait(700);split();await wait(1200);
  apply.classList.add('down');await wait(140);apply.classList.remove('down');apply.classList.add('done');apply.textContent='تم التطبيق';
  await wait(2600);join();await wait(900);}})();

}
