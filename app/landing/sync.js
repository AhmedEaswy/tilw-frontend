// Ported from the tilwprompter v4 artifact (sync script).
export default function initSync() {

const $=id=>document.getElementById(id);if(!$('sk-vis'))return;
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches,V=$('sk-vis'),B=$('sk-beam');
/* draw the beam between the laptop's left edge and the phone's right edge, whatever the card width */
function layout(){const v=V.getBoundingClientRect(),l=$('sk-lap').getBoundingClientRect(),p=$('sk-phn').getBoundingClientRect();
  const x1=l.left-v.left+2,y1=l.top-v.top+l.height*.45,x2=p.right-v.left-2,y2=p.top-v.top+p.height*.45,mx=(x1+x2)/2,dy=Math.min(26,(x1-x2)*.25);
  B.setAttribute('d',`M${x1} ${y1} C ${mx+(x1-x2)*.15} ${y1-dy}, ${mx-(x1-x2)*.15} ${y2-dy}, ${x2} ${y2}`);}
new ResizeObserver(layout).observe(V);layout();
function send(rev,ms=700){return new Promise(res=>{const L=B.getTotalLength(),svg=B.ownerSVGElement,c=document.createElementNS('http://www.w3.org/2000/svg','circle');
  c.setAttribute('r','4');c.setAttribute('class','sk-sig');svg.appendChild(c);B.classList.add('live');const t0=performance.now();
  (function f(t){const k=Math.min(1,(t-t0)/ms),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2,pt=B.getPointAtLength(L*(rev?1-e:e));c.setAttribute('cx',pt.x);c.setAttribute('cy',pt.y);
    if(k<1)requestAnimationFrame(f);else{c.remove();B.classList.remove('live');res();}})(t0);});}
function evt(t){const e=$('sk-ev');e.textContent=t;e.classList.remove('go');void e.offsetWidth;e.classList.add('go');}
function flash(el){el.classList.remove('sk-flash');void el.offsetWidth;el.classList.add('sk-flash');}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function cross(fromLap,label,apply){evt(label);await send(!fromLap);apply();}
const steps=[
 async()=>{const el=$('sk-L1').firstChild;el.classList.add('sk-typing');await wait(700);el.textContent='وراء الكواليس ٢';el.classList.remove('sk-typing');flash($('sk-L1'));
   await cross(true,'النص ← الهاتف',()=>{$('sk-P1').firstChild.textContent='وراء الكواليس ٢';flash($('sk-P1'))});},
 async()=>{const s=$('sk-Ps');s.classList.add('hot');s.querySelector('b').textContent='140';await wait(300);
   await cross(false,'الهاتف ← السرعة 140',()=>{const t=$('sk-Ls');t.classList.add('hot');t.querySelector('b').textContent='140';setTimeout(()=>{t.classList.remove('hot');s.classList.remove('hot')},700)});},
 async()=>{['L','P'].forEach(d=>$('sk-'+d+'0').classList.remove('sel'));$('sk-P2').classList.add('sel');flash($('sk-P2'));await wait(300);
   await cross(false,'فتح نص على الهاتف',()=>{$('sk-L2').classList.add('sel');flash($('sk-L2'))});},
 async()=>{await wait(300);['L','P'].forEach(d=>{$('sk-'+d+'1').firstChild.textContent='وراء الكواليس';$('sk-'+d+'2').classList.remove('sel');$('sk-'+d+'0').classList.add('sel');$('sk-'+d+'s').querySelector('b').textContent='120'});}
];
let vis=true,k=0;new IntersectionObserver(e=>{vis=e[0].isIntersecting}).observe(V);
(async function loop(){if(RM)return;for(;;){if(vis&&!document.hidden){await steps[k%steps.length]();k++;await wait(900);}else await wait(400);}})();

}
