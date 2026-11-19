// Ported from the tilwprompter v4 artifact (theme script).
export default function initTheme() {

  const root=document.documentElement,btns=[...document.querySelectorAll('.theme-fab button')];
  const apply=t=>{if(t==='auto')root.removeAttribute('data-theme');else root.setAttribute('data-theme',t);btns.forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===t));};
  let saved=null;try{saved=localStorage.getItem('tp-theme')}catch(e){}
  if(saved==='light'||saved==='dark')apply(saved);
  btns.forEach(b=>b.onclick=()=>{apply(b.dataset.t);try{localStorage.setItem('tp-theme',b.dataset.t)}catch(e){}});

}
