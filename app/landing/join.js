// Ported from the tilwprompter v4 artifact (join script).
export default function initJoin(opts = {}) {

const $=id=>document.getElementById(id);if(!$('jn-band'))return;
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const band=$('jn-band'),path=$('jn-path'),svg=$('jn-beam'),dot=$('jn-dot'),go=$('jn-go'),inp=$('jn-email'),card=$('jn-card');
/* the line starts at the heading's final "." and ends at the request button */
function lay(){
  if(card.classList.contains('sent')){path.removeAttribute('d');return;}
  const b=band.getBoundingClientRect(),d=dot.getBoundingClientRect(),g=go.getBoundingClientRect();
  const x1=d.left-b.left+d.width*.35,y1=d.bottom-b.top-d.height*.28;
  const stacked=g.top>d.bottom+20&&Math.abs(g.left-d.left)<b.width*.5;
  const x2=stacked?g.left-b.left+g.width*.8:g.right-b.left,y2=stacked?g.top-b.top:g.top-b.top+g.height/2;
  const c1=stacked?`${x1} ${y1+(y2-y1)*.5}`:`${x1-(x1-x2)*.35} ${y1}`,c2=stacked?`${x2} ${y2-(y2-y1)*.4}`:`${x2+(x1-x2)*.35} ${y2}`;
  path.setAttribute('d',`M${x1} ${y1} C ${c1}, ${c2}, ${x2} ${y2}`);}
new ResizeObserver(lay).observe(band);document.fonts&&document.fonts.ready.then(lay);lay();
let busy=false;
function send(){if(busy||RM||!path.getAttribute('d'))return;busy=true;const L=path.getTotalLength(),c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('r','4.5');svg.appendChild(c);const t0=performance.now();
  (function f(t){const k=Math.min(1,(t-t0)/900),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2,p=path.getPointAtLength(L*e);c.setAttribute('cx',p.x);c.setAttribute('cy',p.y);
    if(k<1)requestAnimationFrame(f);else{c.remove();busy=false;go.classList.add('hit');setTimeout(()=>go.classList.remove('hit'),280);}})(t0);}
let vis=true;new IntersectionObserver(e=>{vis=e[0].isIntersecting}).observe(band);
inp.addEventListener('input',()=>{inp.removeAttribute('aria-invalid');$('jn-err').textContent='';send();});
setInterval(()=>{if(vis&&!document.hidden)send()},3000);
/* Submits to the waitlist port (passed in by pages/index.vue); shows the done state only after it succeeds. */
const btn=$('jn-go');let submitting=false;
$('jn-form').addEventListener('submit',async e=>{e.preventDefault();if(submitting)return;const ok=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inp.value.trim());
  inp.setAttribute('aria-invalid',!ok);$('jn-err').textContent=ok?'':'اكتب بريداً إلكترونياً صحيحاً، مثل name@example.com';
  if(!ok)return;
  submitting=true;btn.setAttribute('aria-busy','true');btn.disabled=true;
  try{if(opts.join)await opts.join(inp.value.trim());card.classList.add('sent');lay();}
  catch(err){$('jn-err').textContent='تعذر إرسال طلبك. تحقق من الإنترنت ثم أعد المحاولة.';}
  finally{submitting=false;btn.removeAttribute('aria-busy');btn.disabled=false;}});

}
