// Ported from the tilwprompter v4 artifact (faq script).
export default function initFaq() {

const $=id=>document.getElementById(id);if(!$('fq-cards'))return;
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const PLUS='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const FAQ=[
 ["هل أحتاج إلى حساب؟","يمكنك تجربة النص الموجود هنا دون حساب. لحفظ نصوصك واستخدام التدريب والتسجيل، تحتاج إلى حساب. نفتح التسجيل بالدعوة حالياً."],
 ["هل يدعم العربية والنصوص المختلطة؟","نعم. تتوفر الواجهة بالعربية والإنجليزية، ويمكنك اختيار اتجاه النص في المحرر والملقن."],
 ["هل أحتاج إلى تشغيل الكاميرا للتدرب؟","لا. يمكنك القراءة والتدرب مع بقاء الكاميرا والميكروفون متوقفين."],
 ["أين تحفظ تسجيلاتي؟","في المتصفح الذي سجلت منه. لا ترفع إلى حسابك. نزل النسخة الأصلية للاحتفاظ بها، خصوصاً قبل مسح بيانات المتصفح."],
 ["هل يكتب الذكاء الاصطناعي نصاً بدلاً مني؟","مساعدة بلس تقترح مواضع لبدء أسطر جديدة مع الحفاظ على كلماتك. ترى الاقتراح وتراجعه قبل تطبيقه."]];
$('fq-faq').innerHTML=FAQ.map(([q,a],i)=>`<details${i===0?' open':''}><summary><span class="fq-pm">${PLUS}</span><span>${q}</span></summary><p class="fq-ans">${a}</p></details>`).join('');
const BB=t=>`<span class="fq-bb">${t}</span>`;
const DEV=[
 {k:'lap',name:'الكمبيوتر',tag:BB('Chrome')+' '+BB('Edge'),steps:[`افتح تِلو في ${BB('Chrome')} أو ${BB('Edge')}.`,'استخدم رمز التثبيت في شريط العنوان،','أو خيار تثبيت التطبيق من قائمة المتصفح، إن ظهر.'],max:3},
 {k:'ios',name:'iPhone أو iPad',tag:BB('Safari'),steps:[`افتح تِلو في ${BB('Safari')}.`,'اضغط مشاركة واختر إضافة إلى الشاشة الرئيسية.','سجل الدخول إلى حسابك عند فتحه.'],max:4},
 {k:'and',name:'Android',tag:BB('Chrome'),steps:[`افتح تِلو في ${BB('Chrome')}.`,'ثم افتح قائمة المتصفح','واختر تثبيت التطبيق أو إضافة إلى الشاشة الرئيسية، بحسب الخيار المتاح.'],max:4}];
const SYM='<img src="/assets/logo-symbol-stage.svg" width="23" height="21" alt="">';
const PAGE=`<div class="fq-pg"><span class="fq-mini">${SYM}</span><span class="fq-ln fq-cue"></span><span class="fq-ln" style="width:80%"></span><span class="fq-ln" style="width:60%"></span></div>`;
const HOME=`<div class="fq-home">${'<i></i>'.repeat(4)}<i class="fq-app">${SYM}</i>${'<i></i>'.repeat(4)}</div>`;
const URL='<span class="fq-typed">app.tilwprompter.com</span>';
function ill(k){
  if(k==='lap')return `<div class="fq-ill fq-lap" data-s="1"><div class="fq-bz"><div class="fq-scr">
    <div class="fq-bbar"><span class="fq-d3"><i></i><i></i><i></i></span><span class="fq-url">${URL}<span class="fq-inst"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 7v6M9 10l3 3 3-3"/></svg><span class="fq-ring fq-keep" style="inset:-3px"></span></span></span><span class="fq-kebab">⋮</span></div>
    ${PAGE}<div class="fq-pop"><b>تثبيت التطبيق؟</b>tilwprompter<div class="fq-row"><span class="fq-go">تثبيت</span><span>إلغاء</span></div></div>
    <div class="fq-dock"><i></i><i></i><i class="fq-app">${SYM}</i><i></i></div></div></div><div class="fq-base"></div></div>`;
  if(k==='ios')return `<div class="fq-ill fq-ios" data-s="1"><div class="fq-ph"><div class="fq-sc">${PAGE}
    <div class="fq-ub">${URL}</div>
    <div class="fq-tb"><i></i><i></i><span class="fq-share"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4M5 12v8h14v-8"/></svg><span class="fq-ring" style="inset:-4px"></span></span><i></i><i></i></div>
    <div class="fq-sheet"><span>نسخ</span><span class="fq-go">إضافة إلى الشاشة الرئيسية <b>+</b></span><span>إضافة إشارة مرجعية</span></div>${HOME}</div></div></div>`;
  return `<div class="fq-ill fq-and" data-s="1"><div class="fq-ph"><div class="fq-sc">
    <div class="fq-atop"><span class="fq-url">${URL}</span><span class="fq-kebab">⋮<span class="fq-ring" style="inset:-5px -3px"></span></span></div>${PAGE}
    <div class="fq-menu"><span>علامة تبويب جديدة</span><span class="fq-go">تثبيت التطبيق</span><span>الإعدادات</span></div>${HOME}</div></div></div>`;
}
$('fq-cards').innerHTML=DEV.map(d=>`<article class="fq-card"><div class="fq-art">${ill(d.k)}</div><div class="fq-txt"><h4>${d.name} ${d.tag}</h4><ol class="fq-steps">${d.steps.map(s=>`<li><span>${s}</span></li>`).join('')}</ol></div></article>`).join('');
const els=[...$('fq-cards').querySelectorAll('.fq-ill')];
function setS(el,s){el.dataset.s=s;if(s===1)el.querySelectorAll('.fq-typed').forEach(t=>{t.style.animation='none';void t.offsetWidth;t.style.animation='';});}
let vis=true;new IntersectionObserver(e=>{vis=e[0].isIntersecting}).observe($('fq-cards'));
els.forEach((el,i)=>{let s=RM?DEV[i].max:1;setS(el,s);if(RM)return;
  setTimeout(()=>setInterval(()=>{if(document.hidden||!vis)return;s=s>=DEV[i].max?1:s+1;setS(el,s)},1500),i*450);});

}
