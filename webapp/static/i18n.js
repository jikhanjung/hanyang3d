// Client side of webapp/i18n.py: the same Korean → English dictionary, embedded in the page as #i18n, and the
// language the server chose (<html lang>). t() returns the Korean key itself when no English entry exists, so
// server messages (which are Korean keys too) translate as well.
const dict=(()=>{try{return JSON.parse(document.getElementById('i18n')?.textContent||'{}')}catch{return {}}})();
export const lang=document.documentElement.lang==='en'?'en':'ko';
export function t(text,values){
 let out=lang==='en'?(dict[text]??text):text;
 if(values)out=out.replace(/\{(\w+)\}/g,(_,k)=>values[k]??'');
 return out;
}
// The KO | EN switch reloads with ?lang=…; the server remembers the choice in a cookie and re-renders everything.
export function setLang(next){
 if(next===lang)return;
 const url=new URL(location.href);url.searchParams.set('lang',next);location.href=url.href;
}
