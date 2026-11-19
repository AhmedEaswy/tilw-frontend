// Ported from the tilwprompter v4 artifact (hero script).
export default function initHero() {

const $=id=>document.getElementById(id);
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---- map the virtual screens onto the desk image's white screens (image is 1376×768) ---- */
/* screen holes are cut out of hero-cut@2x.webp; the films sit underneath, a few px larger, so the bezel frames them */
const QL=[[104,178],[506,139],[535,427],[139,489]];
const QP=[[113,501],[256,501],[256,705],[113,705]];
function homography(w,h,q){
  const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]=q;
  const dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3,dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3;
  const den=dx1*dy2-dx2*dy1,g=(dx3*dy2-dx2*dy3)/den,hh=(dx1*dy3-dx3*dy1)/den;
  const a=x1-x0+g*x1,b=x3-x0+hh*x3,d=y1-y0+g*y1,e=y3-y0+hh*y3;
  return `matrix3d(${a/w},${d/w},0,${g/w},${b/h},${e/h},0,${hh/h},0,0,1,0,${x0},${y0},0,1)`;
}
const stage=$('stage');
function place(){const k=stage.clientWidth/1376;const sc=q=>q.map(([x,y])=>[x*k,y*k]);
  $('lap').style.transform=homography(1280,800,sc(QL));$('ph').style.transform=homography(420,620,sc(QP));}
new ResizeObserver(place).observe(stage);place();

/* ---- film content ---- */
const SCRIPT=["كل حكاية تبدأ بسؤال صغير.","قبل أن أفتح الكاميرا،","ماذا أريد أن يبقى معكم؟","بعد أن تنتهي الحلقة.","سؤال واحد يكفي","لنبدأ منه معاً."];
$('col').innerHTML=SCRIPT.concat(SCRIPT).map(s=>`<p>${s}</p>`).join('');
const colP=[...$('col').children];
function readTo(i){const lh=$('rd').classList.contains('big')?205:180;$('col').style.setProperty('--lh',lh+'px');
  $('col').style.transform=`translateY(${300-lh/2-i*lh}px)`;colP.forEach((p,j)=>p.classList.toggle('cur',j===i));
  $('pCur').textContent=SCRIPT[i%6];$('pNx').textContent=SCRIPT[(i+1)%6];}
$('lv').innerHTML='<i></i>'.repeat(16);const lvs=[...$('lv').children];
function levels(n){lvs.forEach((x,i)=>{x.className=i<n-2?'g':i<n?'c':''})}
const WH=[17,28,43,24,59,47,71,38,29,57,76,49,28,40,66,51,25,17,51,37,68,46,30,54,71,32,21,49,55,67,40,28,35,57,77,46,24,21,47,63,40,19,29,50,57,28,47,33];
$('wv').innerHTML=WH.map(h=>`<i style="height:${h*1.9}px"></i>`).join('');const wvs=[...$('wv').children];

const BEATS=[
 ['اكتب نصك وحدد التأكيد',2600,at=>{
   const ls=[...document.querySelectorAll('.ed .ln')],mk=[...document.querySelectorAll('.ed mark')],pz=document.querySelector('.ed .ps');
   ls.forEach(l=>l.classList.remove('in'));mk.forEach(m=>m.classList.remove('hl'));pz.classList.remove('in');$('tEmph').classList.remove('on');$('tPause').classList.remove('on');
   at(80,()=>ls[0].classList.add('in'));at(560,()=>ls[1].classList.add('in'));at(1040,()=>ls[2].classList.add('in'));
   at(1350,()=>{$('tEmph').classList.add('on');mk[0].classList.add('hl')});at(1650,()=>mk[1].classList.add('hl'));
   at(1950,()=>{$('tEmph').classList.remove('on');$('tPause').classList.add('on');pz.classList.add('in')});}],
 ['هاتفك يتحكم بالقراءة والسرعة',2800,at=>{
   const rd=$('rd');rd.classList.remove('big','mirror');$('rdTag').classList.remove('on');$('rdW').textContent=120;$('pW').textContent=120;$('pSpd').classList.remove('hot');
   setPlay(false);readTo(0);
   at(300,()=>{press($('pPlay'));setPlay(true)});
   at(650,()=>readTo(1));at(1150,()=>readTo(2));
   at(1500,()=>{$('pSpd').classList.add('hot');tick(120,160,$('pW'));tick(120,160,$('rdW'))});
   at(1800,()=>readTo(3));at(2300,()=>readTo(4));}],
 ['حجم الخط ووضع المرآة',2600,at=>{
   const rd=$('rd');$('pSize').classList.remove('hot');$('pMir').classList.remove('hot');$('pSw').classList.remove('on');$('pSz').textContent='M';
   at(200,()=>{$('pSize').classList.add('hot');$('pSz').textContent='L';rd.classList.add('big');$('rdTag').textContent='Aa +';$('rdTag').classList.add('on');readTo(5)});
   at(1100,()=>{$('pSize').classList.remove('hot');$('pMir').classList.add('hot');$('pSw').classList.add('on');rd.classList.add('mirror');$('rdTag').textContent='مرآة'});
   at(2000,()=>{rd.classList.remove('mirror');$('pSw').classList.remove('on');$('rdTag').classList.remove('on')});}, 1],
 ['عدّ تنازلي ثم تسجيل',1500,at=>{
   const set=n=>{$('cdN').textContent=n;$('pN').textContent=n;$('cdN').classList.remove('pop');void $('cdN').offsetWidth;$('cdN').classList.add('pop');$('arc').style.strokeDashoffset=904.8*(1-n/3)};
   $('arc').style.transition='none';set(3);void $('arc').offsetWidth;$('arc').style.transition='';
   at(480,()=>set(2));at(960,()=>set(1));}],
 ['سجّل من المتصفح',2700,at=>{
   let s=0;$('rcT').textContent=$('pT').textContent='00:00';$('rcC').textContent=SCRIPT[0];$('rcN').textContent=SCRIPT[1];
   for(let k=1;k<=13;k++)at(k*200,()=>levels(5+Math.floor(Math.random()*10)));
   for(let k=1;k<=5;k++)at(k*500,()=>{s+=1;const t='00:0'+s;$('rcT').textContent=t;$('pT').textContent=t});
   at(900,()=>{swap($('rcC'),SCRIPT[1]);swap($('rcN'),SCRIPT[2])});at(1800,()=>{swap($('rcC'),SCRIPT[2]);swap($('rcN'),SCRIPT[3])});}],
 ['راجع ونزّل الملف الأصلي',2700,at=>{
   const dl=$('dl');dl.classList.remove('done','press');dl.textContent='تنزيل الملف الأصلي';$('tl').style.width='0';wvs.forEach(w=>w.classList.remove('p'));
   for(let k=1;k<=16;k++)at(k*100,()=>{const p=k/16;$('tl').style.width=(p*100)+'%';wvs.forEach((w,i)=>w.classList.toggle('p',i/wvs.length<p))});
   at(1800,()=>dl.classList.add('press'));at(2000,()=>{dl.classList.remove('press');dl.classList.add('done');dl.textContent='تم التنزيل · take-02.webm'});}]
];
function press(el){el.classList.add('press');setTimeout(()=>el.classList.remove('press'),180)}
function setPlay(on){$('pIcon').innerHTML=on?'<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>':'<path d="M17 5 6 12l11 7z"/>';$('pTx').textContent=on?'إيقاف':'تشغيل'}
function tick(a,b,el){let v=a;const iv=setInterval(()=>{v+=10;el.textContent=v;if(v>=b)clearInterval(iv)},60)}
function swap(el,t){el.style.transition='opacity .15s';el.style.opacity=0;setTimeout(()=>{el.textContent=t;el.style.opacity=1},150)}

/* scene ids: laptop scene for each beat (beat 2 reuses the reader) */
const LAP=[0,1,1,3,4,5];
const lapS=[...document.querySelectorAll('.ls')],phS=[...document.querySelectorAll('.ps')];
$('segs').innerHTML=BEATS.map(()=>'<i><span></span></i>').join('');const segs=[...$('segs').children];
let beat=0,timers=[],playing=!RM,next=null;
function run(i){
  timers.forEach(clearTimeout);timers=[];beat=i;
  const [title,ms,fn]=BEATS[i];
  lapS.forEach(s=>s.classList.toggle('on',+s.dataset.k===LAP[i]));
  phS.forEach(s=>s.classList.toggle('on',+s.dataset.k===i));
  $('nowT').textContent=title;$('nowN').textContent=`0${i+1} / 06`;
  segs.forEach((s,j)=>{s.classList.toggle('done',j<i);const sp=s.firstChild;sp.style.transition='none';sp.style.width=j<i?'100%':'0';});
  fn((t,f)=>timers.push(setTimeout(f,t)));
  if(playing){const sp=segs[i].firstChild;void sp.offsetWidth;sp.style.transition=`width ${ms}ms linear`;sp.style.width='100%';
    timers.push(setTimeout(()=>run((i+1)%BEATS.length),ms));}
  else{timers.forEach(clearTimeout);timers=[];BEATS[i][2]((t,f)=>f());}
}
const P='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',PL='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 5 6 12l11 7z"/></svg>';
function setPlaying(on){playing=on;$('pp').innerHTML=on?P:PL;$('pp').setAttribute('aria-label',on?'إيقاف العرض':'تشغيل العرض');run(beat);}
$('pp').onclick=()=>setPlaying(!playing);
segs.forEach((s,i)=>{s.style.cursor='pointer';s.onclick=()=>run(i)});
/* pause when the hero is off screen or the tab is hidden */
let vis=true;new IntersectionObserver(e=>{const v=e[0].isIntersecting;if(v===vis)return;vis=v;if(!vis)timers.forEach(clearTimeout);else if(playing)run(beat)}).observe(stage);
document.addEventListener('visibilitychange',()=>{if(document.hidden){timers.forEach(clearTimeout)}else if(playing&&vis)run(beat)});
$('pp').innerHTML=playing?P:PL;
run(RM?1:0);

/* ---- features ---- */
const lanesEl=$('lanes');const LW=[80,120,180];
lanesEl.innerHTML=LW.map(w=>`<div class="lane" data-w="${w}"><b>${w}</b><span style="--d:${(2400/w).toFixed(1)}s">${'كل فكرة تستحق أن تصل · بطريقتك أنت · '.repeat(4)}</span></div>`).join('');
function setSpd(w){$('spdNum').textContent=w;lanesEl.querySelectorAll('.lane').forEach(l=>{const lw=+l.dataset.w;l.classList.toggle('sel',Math.abs(lw-w)===Math.min(...LW.map(x=>Math.abs(x-w))));});
  lanesEl.querySelectorAll('.lane span').forEach(s=>s.style.setProperty('--d',(2400/(+s.parentElement.dataset.w)).toFixed(1)+'s'));const sel=lanesEl.querySelector('.lane.sel span');sel&&sel.style.setProperty('--d',(2400/w).toFixed(1)+'s');}
$('spdR').oninput=e=>setSpd(+e.target.value);setSpd(120);
$('bars').innerHTML=Array.from({length:22},(_,i)=>`<i style="animation-delay:${(i*137%900)/1000}s;animation-duration:${.6+(i*53%50)/100}s"></i>`).join('');
let rs=754;setInterval(()=>{rs++;$('recT').textContent=[rs/3600|0,(rs/60|0)%60,rs%60].map(n=>String(n).padStart(2,'0')).join(':')},1000);
document.querySelectorAll('[data-pause]').forEach(b=>b.onclick=()=>{const c=b.closest('.card');const p=c.classList.toggle('paused');b.textContent=p?'تشغيل الحركة':'إيقاف الحركة'});

/* ---- how it works ---- */
const views=[
 `<div class="bar"><span>نص الحلقة 04</span><span class="mono" style="font-size:11px">Editor</span></div><div class="doc"><p>منذ زمن طويل والإنسان يبحث عن طريقة أبسط للفهم. <span class="pz">/ وقفة</span></p><p><mark>كل فكرة تستحق أن تصل.</mark></p><p>ولهذا لم يعد المحتوى مجرد خيار إضافي، بل أصبح جزءاً أساسياً من <mark>طريقتك</mark> في التواصل.</p></div>`,
 `<div class="bar"><span>إعدادات القراءة</span><span class="mono" style="font-size:11px">Presets</span></div><div class="presets"><div class="preset"><span>هادئ</span><small>90 WPM · L</small></div><div class="preset on"><span>متوازن</span><small>120 WPM · M</small></div><div class="preset"><span>سريع</span><small>160 WPM · M</small></div></div><p style="color:var(--muted);font-size:14px">وضع التدريب: الكاميرا متوقفة.</p>`,
 `<div class="bar"><span>محاولاتك</span><span class="mono" style="font-size:11px">Takes</span></div><div class="mtake"><span class="nm">take-01.webm</span><span style="color:var(--muted);font-size:13px">02:14</span></div><div class="mtake" style="border-color:var(--accent)"><span class="nm">take-02.webm</span><button type="button">تنزيل الأصل</button></div><div class="mtake"><span class="nm">take-03.webm</span><span style="color:var(--muted);font-size:13px">01:58</span></div>`
];
const tabs=document.querySelectorAll('.steps [role=tab]');
function step(i){tabs.forEach((t,j)=>t.setAttribute('aria-selected',i===j));$('mock').innerHTML=views[i];}
tabs.forEach((t,i)=>t.onclick=()=>step(i));step(0);

}
