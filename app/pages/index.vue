<script setup lang="ts">
import initHero from "~/landing/hero";
import initTheme from "~/landing/theme";
import initRemote from "~/landing/remote";
import initSync from "~/landing/sync";
import initPlans from "~/landing/plans";
import initFaq from "~/landing/faq";
import initJoin from "~/landing/join";

// Landing styles are a standalone file attached only here: Nuxt bundles page CSS into a shared chunk,
// and the landing's global class names (.ph, .card, .wrap…) would otherwise leak into the app.
useHead({
  title: "tilwprompter",
  htmlAttrs: { lang: "ar", dir: "rtl" },
  link: [{ rel: "stylesheet", href: "/landing/landing.css", key: "landing-css" }],
});

// The landing page is driven by imperative scripts ported from the v4 artifact;
// they query the DOM by id, so they run once after mount.
const services = useServices();

// Release 2 (US4, R2-13): the plans poster reads prices and limits from the service, with build-time fallback.
const { plans } = usePublicPlans();
const proOnSale = computed(() => plans.value.some(p => p.key === "pro"));
const period = ref<"monthly" | "yearly">("yearly");
// Signed out, the route guard sends this through sign-in and back to the upgrade sheet.
const getPro = () => navigateTo("/app/settings/plan?upgrade=1");
// Feature 006 (owner decision): while sign-up is open, the join section offers "Create account" instead of the
// waitlist form. The prerendered page shows the waitlist (invite-only default) and swaps after the settings load.
const { signupOpen } = usePublicSettings();

onMounted(() => {
  initHero();
  initTheme();
  initRemote();
  initSync();
  initPlans();
  initFaq();
  initJoin({ join: (email: string) => services.waitlist.join({ email }) });
});
</script>

<template>
<div>
<div dir="rtl" lang="ar">
<header class="hero" id="hero">
  <div class="nav"><div class="in">
    <a href="#hero" aria-label="tilwprompter"><span class="sig" style="--sw:clamp(140px,12vw,210px)"><img class="s1" src="/assets/logo-symbol-stage.svg" width="23" height="21" alt=""><img class="s2" src="/assets/logo-tilw-stage.svg" width="33" height="13" alt=""><img class="s3" src="/assets/logo-prompter-stage.svg" width="78" height="16" alt=""></span></a>
    <nav aria-label="الرئيسية"><a href="#features">المزايا</a><a href="#how">كيف يعمل</a></nav>
    <div class="side"><a class="lang" href="#" style="padding-inline:8px">English</a><a class="ghost" href="/signin" style="text-decoration:none">دخول</a></div>
  </div></div>

  <div class="copy">
    <h1>هاتفك يتحكم.<br><em>وأنت تتحدث.</em></h1>
    <p class="lede">ضع النص قرب العدسة، وتحكّم بالقراءة من مكانك. جهاز التحكم مشمول مجاناً.</p>
    <div class="acts">
      <a class="btn btn-cta" href="/waitlist">جرّب الملقّن مجاناً <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
      <a class="lnk" href="#features">كل المزايا</a>
    </div>
    <div class="now" aria-live="polite">
      <div class="lbl"><small id="nowN">01 / 06</small><b id="nowT">اكتب نصك وحدد التأكيد</b><div class="segs" id="segs"></div></div>
      <button type="button" class="pp" id="pp" aria-label="إيقاف العرض"></button>
    </div>
  </div>

  <div class="stage" id="stage" role="img" aria-label="حاسوب على مكتب خشبي وهاتف قابل للطي في اليد يعرضان ملقّن tilwprompter أثناء العمل">
    
    <div class="clipL">
      <div class="scr glare lap" id="lap">
        <section class="ls ed" data-k="0">
          <div class="tbar"><span class="ttl">افتتاحية الحلقة</span><span class="chipx">محرر النص</span></div>
          <div class="body">
            <p class="ln"><mark>كل حكاية</mark> تبدأ بسؤال صغير.<span class="ps">/ وقفة</span></p>
            <p class="ln">قبل أن أفتح <mark>الكاميرا</mark>،</p>
            <p class="ln">ماذا أريد أن يبقى معكم؟</p>
          </div>
          <div class="tools"><span id="tEmph">تأكيد</span><span id="tPause">وقفة</span><span>ملاحظة</span></div>
        </section>
        <section class="ls rd" data-k="1" id="rd">
          <div class="tbar"><span class="ttl">تدريب</span><span class="chipx"><span id="rdW" class="lat" style="font-family:var(--f-lat)">120</span> كلمة/د</span></div>
          <div class="win"><div class="cue"></div><div class="flip"><div class="col" id="col"></div></div></div>
          <span class="tag" id="rdTag">Aa +</span>
        </section>
        <section class="ls cd" data-k="3">
          <span class="cap">يبدأ التسجيل بعد</span>
          <div class="ring"><svg viewBox="0 0 300 300" width="300" height="300"><circle cx="150" cy="150" r="144" fill="#223540" stroke="rgba(242,178,139,.2)" stroke-width="8"/><circle id="arc" cx="150" cy="150" r="144" fill="none" stroke="#f2b28b" stroke-width="8" stroke-dasharray="904.8" stroke-dashoffset="0" transform="rotate(-90 150 150)" style="transition:stroke-dashoffset .45s linear"/></svg><span class="num" id="cdN">3</span></div>
          <span class="cap" style="color:var(--stage-text)">كل حكاية تبدأ بسؤال صغير.</span>
        </section>
        <section class="ls rc" data-k="4">
          <div class="top"><span class="recb"><i></i><span id="rcT" style="font-family:var(--f-lat)">00:00</span> REC</span><span class="ttl" style="font-size:30px;font-weight:600">افتتاحية الحلقة</span></div>
          <img class="por" src="/assets/portrait.png" alt="">
          <div class="lines"><p class="cur" id="rcC">كل حكاية تبدأ بسؤال صغير.</p><p class="nx" id="rcN">قبل أن أفتح الكاميرا،</p></div>
          <div class="bot"><span class="stop"><b></b>إيقاف وحفظ</span><span class="lv" id="lv"></span></div>
        </section>
        <section class="ls rv" data-k="5">
          <div class="tbar"><span class="ttl">المحاولة 2</span><span class="chipx" style="background:#e9e4db;color:#955239">مراجعة</span></div>
          <div class="player"><div class="wv" id="wv"></div><div class="tl"><span id="tl"></span></div></div>
          <div class="side">
            <h4>محفوظ في هذا المتصفح.</h4>
            <div class="boxes"><div>المدة<b>00:42</b></div><div>الصيغة<b>WebM</b></div></div>
            <span class="dl" id="dl">تنزيل الملف الأصلي</span>
            <span class="again">تسجيل محاولة أخرى</span>
          </div>
        </section>
      </div>
    </div>
    
    <div class="scr glare ph" id="ph">
      <div class="hd"><span class="sig" style="--sw:190px"><img class="s1" src="/assets/logo-symbol-stage.svg" width="23" height="21" alt=""><img class="s2" src="/assets/logo-tilw-stage.svg" width="33" height="13" alt=""><img class="s3" src="/assets/logo-prompter-stage.svg" width="78" height="16" alt=""></span></div>
      <div class="ps" data-k="0"><span class="conn"><i></i>متصل بالحاسوب</span><div class="pcard"><span class="cur">كل حكاية تبدأ بسؤال صغير.</span><span class="nx">قبل أن أفتح الكاميرا،</span></div><div class="prow">النص<b style="font-family:var(--f-ar)">افتتاحية الحلقة</b></div></div>
      <div class="ps" data-k="1">
        <div class="pcard"><span class="cur" id="pCur">كل حكاية تبدأ بسؤال صغير.</span><span class="nx" id="pNx">قبل أن أفتح الكاميرا،</span></div>
        <div class="pctl"><svg class="sk" viewBox="0 0 24 24"><path d="M6 5v14h2V5zM10 12l10 7V5z"/></svg><span class="pb" id="pPlay"><svg viewBox="0 0 24 24" id="pIcon"><path d="M17 5 6 12l11 7z"/></svg><span id="pTx">تشغيل</span></span><svg class="sk" viewBox="0 0 24 24"><path d="M18 5v14h-2V5zM14 12 4 19V5z"/></svg></div>
        <div class="prow" id="pSpd">السرعة<b><span id="pW">120</span> كلمة/د</b></div>
      </div>
      <div class="ps" data-k="2">
        <div class="pcard"><span class="cur">ماذا أريد أن يبقى معكم؟</span></div>
        <div class="prow" id="pSize">حجم الخط<b id="pSz">M</b></div>
        <div class="prow" id="pMir">وضع المرآة<span class="sw" id="pSw"></span></div>
      </div>
      <div class="ps" data-k="3"><div class="pcard" style="text-align:center">يبدأ التسجيل بعد</div><div class="bign" id="pN">3</div></div>
      <div class="ps" data-k="4"><div class="recbig"><span class="t" id="pT">00:00</span><span class="sb"><b></b></span><span>اضغط للإيقاف والحفظ</span></div></div>
      <div class="ps" data-k="5"><div class="saved"><span class="ok"><svg viewBox="0 0 24 24" fill="none" stroke="#f7f2e9" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><b>تم حفظ المحاولة</b><span>take-02.webm · 00:42</span></div></div>
    </div>
    <img class="cut" src="/assets/hero-cut@2x.webp" alt="">
  </div>
</header>


<section class="features" id="features">
  <div class="wrap">
    <div class="sec-head">
      <h2>كل ما تحتاجه أمام العدسة.</h2>
      <p>من كتابة النص إلى ملف التسجيل، كل أداة مصممة لتبقى عيناك على الكاميرا.</p>
    </div>
    <div class="bento">
      <article class="card a-remote">
        <div class="rk-vis">
          <div class="rk-mon"><div class="rk-gl">
            <div class="rk-hud"><span class="rk-state" id="rk-state"><i></i><span id="rk-stx">متوقف</span></span><span class="rk-w" id="rk-w">120 WPM</span></div>
            <div class="rk-cue" id="rk-cue"></div>
            <div class="rk-ls" id="rk-ls"></div>
            <div class="rk-paused" id="rk-pz">متوقف مؤقتاً</div>
          </div></div>
          <div class="rk-beam"></div><span class="rk-dot" id="rk-dot"></span>
          <span class="rk-lat">~0.1s</span><span class="rk-evt" id="rk-evt"></span>
          <div class="rk-desk"><div class="rk-ph"><div class="rk-sc">
            <div class="rk-tiles">
              <button type="button" class="rk-tl" id="rk-next" aria-label="السطر التالي"><svg viewBox="0 0 24 24"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg>التالي</button>
              <button type="button" class="rk-tl rk-play" id="rk-play" aria-label="تشغيل"><svg viewBox="0 0 24 24" id="rk-pi"><path d="M8 5v14l11-7z"/></svg><span id="rk-pt">تشغيل</span></button>
              <button type="button" class="rk-tl" id="rk-prev" aria-label="السطر السابق"><svg viewBox="0 0 24 24"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg>السابق</button>
            </div>
            <div class="rk-st"><span>السرعة</span><button type="button" id="rk-dec" aria-label="أبطأ">−</button><b id="rk-sv">120</b><button type="button" id="rk-inc" aria-label="أسرع">+</button></div>
          </div></div></div>
        </div>
        <h3>هاتفك هو جهاز التحكم</h3>
        <p>شغّل، أوقف، وارجع سطراً من هاتفك بينما يعرض الحاسوب النص قرب العدسة. لا تطبيق إضافي، فقط امسح الرمز.</p>
      </article>
      <article class="card a-speed">
        <div class="vis"><div class="spd">
          <div class="lanes" id="lanes"></div>
          <div class="dial"><span class="num" id="spdNum">120</span><small>كلمة في الدقيقة</small>
            <input type="range" id="spdR" min="60" max="200" step="10" value="120" aria-label="السرعة"></div>
        </div></div>
        <h3>سرعة تناسب إيقاعك</h3>
        <p>ثلاث إعدادات جاهزة، أو اضبطها بدقة من 60 إلى 220 كلمة في الدقيقة أثناء القراءة.</p>
      </article>
      <article class="card a-emph">
        <div class="vis"><p class="emph">كل <span class="w k">فكرة</span> تستحق<span class="pz">/ 2s</span>أن <span class="w k k2">تصل</span>، <span class="w k k3">بطريقتك</span> أنت.</p></div>
        <h3>كلمات التأكيد والوقفات</h3>
        <p>حدد الكلمات المهمة وأماكن التوقف، فتظهر لك واضحة أثناء القراءة.</p>
      </article>
      <article class="card a-rec">
        <div class="vis"><span class="viewfinder"></span><div class="recv">
          <div class="tm"><i></i><span id="recT">00:00:00</span></div>
          <div class="bars" id="bars"></div>
          <span class="mono" style="color:var(--muted);font-size:10px">1080p · 30fps</span>
        </div></div>
        <h3>سجّل من المتصفح</h3>
        <p>الكاميرا والملقّن في نافذة واحدة. لا برامج تثبيت.</p>
      </article>
      <article class="card a-sync">
        <div class="sk-vis" id="sk-vis">
          <svg class="sk-beams" aria-hidden="true"><path id="sk-beam" class="sk-beam"/></svg>
          <span class="sk-chip"><i>ل</i>حساب واحد · جهازان</span>
          <div class="sk-dev sk-lap" id="sk-lap"><div class="sk-bz"><div class="sk-gl" style="height:112px"><div class="sk-hd"><span>نصوصي</span><span>متزامن<i></i></span></div><div class="sk-it sel" id="sk-L0"><span>افتتاحية الحلقة</span><b>3 د</b></div><div class="sk-it" id="sk-L1"><span>وراء الكواليس</span><b>5 د</b></div><div class="sk-it" id="sk-L2"><span>رسالة إلى المستمع</span><b>2 د</b></div><div class="sk-spd" id="sk-Ls"><span>السرعة</span><b>120</b></div></div></div><div class="sk-base"></div></div>
          <div class="sk-dev sk-phn" id="sk-phn"><div class="sk-bz"><div class="sk-gl" style="height:166px"><div class="sk-hd"><span>نصوصي</span><span>متزامن<i></i></span></div><div class="sk-it sel" id="sk-P0"><span>افتتاحية الحلقة</span><b>3 د</b></div><div class="sk-it" id="sk-P1"><span>وراء الكواليس</span><b>5 د</b></div><div class="sk-it" id="sk-P2"><span>رسالة إلى المستمع</span><b>2 د</b></div><div class="sk-spd" id="sk-Ps"><span>السرعة</span><b>120</b></div></div></div></div>
          <span class="sk-evt" id="sk-ev"></span>
        </div>
        <h3>حساب واحد، كل الأجهزة</h3>
        <p>نصوصك وإعداداتك محفوظة وتظهر فوراً على الحاسوب والهاتف.</p>
      </article>
      <article class="card a-mirror">
        <div class="vis"><div class="mir"><span class="src">بطريقتك أنت.</span><span class="gl"></span><span class="ref">بطريقتك أنت.</span></div></div>
        <h3>وضع المرآة</h3>
        <p>اقلب النص بضغطة ليعمل مع زجاج الملقّن الاحترافي.</p>
      </article>
      <article class="card a-dl">
        <div class="vis"><div class="takes">
          <div class="take"><svg class="star off" viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg><span class="st">المحاولة 1 · 02:14</span><span class="nm">take-01.webm</span></div>
          <div class="take keep"><svg class="star" viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg><span class="st">المحاولة 2 · محفوظة · جارٍ التنزيل</span><span class="nm">take-02.webm · 48 MB</span><div class="prog"><i></i></div></div>
        </div></div>
        <h3>احتفظ بالمحاولة التي تعجبك</h3>
        <p>راجع محاولاتك، علّم الأفضل، ونزّل الملف بصيغته الأصلية دون ضغط.</p>
      </article>
    </div>
  </div>
</section>

<section class="how" id="how">
  <div class="wrap grid">
    <div>
      <h2>مساحة واحدة، من النص إلى التسجيل.</h2>
      <p class="intro">ابدأ بما تريد قوله. جهّز النص، جرّب إيقاعك، ثم احتفظ بالمحاولة التي تعجبك.</p>
      <ul class="steps" role="tablist" aria-label="الخطوات">
        <li><button type="button" role="tab" aria-selected="true"><span class="n">1</span><h3>جهّز كلماتك للإلقاء.</h3><p>اكتب أو استورد نصك. نسّق الأسطر، وحدد كلمات التأكيد والوقفات وملاحظاتك.</p></button></li>
        <li><button type="button" role="tab" aria-selected="false"><span class="n">2</span><h3>اختر الإيقاع الذي يشبهك.</h3><p>3 إعدادات للقراءة، مع تحكم بالسرعة وحجم الخط. تدرّب والكاميرا متوقفة.</p></button></li>
        <li><button type="button" role="tab" aria-selected="false"><span class="n">3</span><h3>سجّل. راجع. واحتفظ بالأصل.</h3><p>جهّز الكاميرا عندما تكون مستعداً، راجع محاولتك، ثم نزّل الملف بصيغته الأصلية.</p></button></li>
      </ul>
    </div>
    <div class="mock" id="mock" role="tabpanel" aria-live="polite"></div>
  </div>
</section>

<section class="pl-sec" id="plans"><div class="wrap">
  <div class="pl-head"><h2>الأساس معك مجاناً.</h2><p>الكتابة، التدريب، التسجيل، وجهاز التحكم.<template v-if="proOnSale"> تضيف Pro مدة تسجيل أطول، ونسخاً تلقائياً إلى Google Drive، وسجلاً أطول لنصوصك.</template></p></div>
  <PlansPoster v-model:period="period" :plans="plans" mode="landing" @cta="getPro" />
</div></section>

<section class="fq-sec" id="faq"><div class="wrap fq-in">
  <div class="fq-top">
    <h2 class="fq-h2">افتح تِلو. وجهز ظهورك القادم.</h2>
    <p class="fq-lede">على الكمبيوتر أو الهاتف، من متصفحك مباشرة. ويمكنك إضافته إلى جهازك عندما يدعم المتصفح التثبيت.</p>
    <a class="fq-btn" href="/app">افتح تطبيق الويب</a>
    <p class="fq-meta">للحسابات الحالية. المستخدمون الجدد يمكنهم طلب دعوة أدناه.</p>
  </div>
  <div>
    <h3 class="fq-h3">أضفه إلى جهازك</h3>
    <div class="fq-cards" id="fq-cards"></div>
    <div class="fq-center"><span class="fq-store"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>المتاح حالياً هو تطبيق الويب. لم تُنشر نسخ على App Store أو Google Play بعد.</span></div>
  </div>
  <div class="fq-faqrow">
    <div class="fq-sticky"><h2 class="fq-h2">قبل أول محاولة.</h2></div>
    <div class="fq-faq" id="fq-faq"></div>
  </div>
</div></section>

<section class="jn-sec" id="join"><div class="wrap">
  <div class="jn-band" id="jn-band">
    <svg class="jn-beam" id="jn-beam" aria-hidden="true"><path id="jn-path"/></svg>
    <div class="jn-half jn-copy"><span class="jn-chip"><i></i>{{ signupOpen ? "التسجيل مفتوح" : "بالدعوة حالياً" }}</span><h2>افتتاحيتك القادمة تبدأ هنا<span class="jn-dot" id="jn-dot">.</span></h2><p v-if="signupOpen">التسجيل مفتوح الآن. أنشئ حسابك في دقيقة وابدأ على الخطة المجانية.</p><p v-else>التسجيل متاح بالدعوة حالياً. اترك بريدك لنخبرك عند فتح مكان لك.</p></div>
    <div class="jn-half">
      <div v-if="signupOpen" class="jn-card jn-open" data-testid="join-open" style="display:grid;gap:14px;justify-items:start"><a class="jn-go" href="/signup" style="display:inline-flex;align-items:center;justify-content:center;text-decoration:none">أنشئ حساباً</a><a href="/signin" style="color:inherit">لديك حساب؟ سجّل الدخول</a></div>
      <div v-show="!signupOpen" class="jn-card" id="jn-card">
        <form class="jn-form" id="jn-form" novalidate><label for="jn-email">بريدك الإلكتروني</label><input id="jn-email" type="email" placeholder="name@example.com" autocomplete="email"><button class="jn-go" id="jn-go" type="submit">اطلب دعوة</button><span class="jn-err" id="jn-err" aria-live="polite"></span></form>
        <p class="jn-done" role="status"><i><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></i>وصل طلبك. سنخبرك عند فتح مكان لك.</p>
      </div>
    </div>
  </div>
</div></section>
<footer class="jn-foot">
  <div class="wrap jn-cols">
    <div class="jn-brand"><span class="jn-sig"><img class="s1" src="/assets/logo-symbol-stage.svg" width="23" height="21" alt=""><img class="s2" src="/assets/logo-tilw-stage.svg" width="33" height="13" alt=""><img class="s3" src="/assets/logo-prompter-stage.svg" width="78" height="16" alt=""></span><p>هاتفك يتحكم. وأنت تتحدث.</p></div>
    <div><div class="jn-fh">الموقع</div><ul><li><a href="#features">المزايا</a></li><li><a href="#how">كيف يعمل</a></li><li><a href="#plans">الخطط</a></li><li><a href="#faq">الأسئلة الشائعة</a></li></ul></div>
    <div><div class="jn-fh">تِلو</div><ul><li><a href="/app">افتح تطبيق الويب</a></li><li><a href="/privacy">الخصوصية</a></li><li><a href="/terms">الشروط</a></li></ul></div>
  </div>
  <div class="jn-mark" aria-hidden="true"><b>tilw</b>prompter</div>
  <div class="wrap"><div class="jn-bottom"><span dir="ltr">© 2026 tilwprompter</span><a href="#">English</a></div></div>
</footer>

</div>





<div class="theme-fab" role="group" aria-label="المظهر">
  <button type="button" data-t="light" aria-pressed="false" title="فاتح"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg><span>فاتح</span></button>
  <button type="button" data-t="dark" aria-pressed="false" title="داكن"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg><span>داكن</span></button>
  <button type="button" data-t="auto" aria-pressed="true" title="تلقائي"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17A8.5 8.5 0 0 0 12 3.5z" fill="currentColor"/></svg><span>تلقائي</span></button>
</div>
</div>
</template>
