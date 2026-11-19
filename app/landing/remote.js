// Ported from the tilwprompter v4 artifact (remote script).
export default function initRemote() {

const $=id=>document.getElementById(id);if(!$('rk-ls'))return;
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const S=["كل حكاية تبدأ بسؤال صغير.","قبل أن أفتح الكاميرا،","ماذا أريد أن يبقى معكم؟","بعد أن تنتهي الحلقة.","سؤال واحد يكفي","لنبدأ منه معاً."];
$('rk-ls').innerHTML=S.map(s=>`<p>${s}</p>`).join('');const lp=[...$('rk-ls').children];
let i=0,playing=false,wpm=120,rd=null,auto=!RM,k=0,vis=true;
function line(n){i=(n+S.length)%S.length;$('rk-ls').style.transform=`translateY(${44-i*44}px)`;lp.forEach((p,j)=>p.classList.toggle('on',j===i));}
function sched(){clearInterval(rd);if(playing)rd=setInterval(()=>{if(vis)line(i+1)},Math.round(1400*120/wpm));}
function send(btn,label,apply){btn.classList.add('down');setTimeout(()=>btn.classList.remove('down'),140);
  if(btn.classList.contains('rk-tl')){btn.classList.remove('ring');void btn.offsetWidth;btn.classList.add('ring');}
  const d=$('rk-dot');d.classList.remove('go');void d.offsetWidth;d.classList.add('go');
  const e=$('rk-evt');e.textContent=label;e.classList.remove('go');void e.offsetWidth;e.classList.add('go');
  setTimeout(()=>{apply();const c=$('rk-cue');c.classList.add('flash');setTimeout(()=>c.classList.remove('flash'),260)},420);}
function setPlay(p){playing=p;$('rk-pi').innerHTML=p?'<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>':'<path d="M8 5v14l11-7z"/>';$('rk-pt').textContent=p?'إيقاف':'تشغيل';
  $('rk-state').classList.toggle('run',p);$('rk-stx').textContent=p?'يقرأ':'متوقف';$('rk-pz').classList.toggle('on',!p);sched();}
function setW(v){wpm=Math.max(80,Math.min(200,v));$('rk-sv').textContent=wpm;$('rk-w').textContent=wpm+' WPM';$('rk-w').classList.add('hot');setTimeout(()=>$('rk-w').classList.remove('hot'),500);sched();}
const A={play:()=>send($('rk-play'),playing?'إيقاف':'تشغيل',()=>setPlay(!playing)),next:()=>send($('rk-next'),'التالي',()=>line(i+1)),prev:()=>send($('rk-prev'),'السابق',()=>line(i-1)),
  inc:()=>send($('rk-inc'),'أسرع',()=>setW(wpm+20)),dec:()=>send($('rk-dec'),'أبطأ',()=>setW(wpm-20))};
Object.keys(A).forEach(id=>$('rk-'+id).onclick=()=>{auto=false;A[id]()});
line(0);setPlay(false);$('rk-pz').classList.remove('on');
new IntersectionObserver(e=>{vis=e[0].isIntersecting}).observe($('rk-ls').closest('.rk-vis'));
const loop=['play','inc','next','inc','prev','dec','dec','play'];
setInterval(()=>{if(!auto||!vis||document.hidden)return;A[loop[k%loop.length]]();k++},1600);

}
