const KEY="drappy_v2";
const defaults={name:"",interval:21,notifications:false,bg:"#07111f",lastChanged:null,snoozeUntil:null,history:[]};
let state=load();

function load(){
  try{
    const old=JSON.parse(localStorage.getItem(KEY)||"null");
    if(old){ const cleaned={...defaults,...old}; delete cleaned.sheet; return cleaned; }
    const legacy=JSON.parse(localStorage.getItem("drappy_v1")||"{}");
    const cleaned={...defaults,...legacy}; delete cleaned.sheet; return cleaned;
  }catch{return {...defaults}}
}
function save(){localStorage.setItem(KEY,JSON.stringify(state));render()}
function daysAgo(date){return date?Math.max(0,Math.floor((Date.now()-new Date(date).getTime())/86400000)):0}
function fmt(date){return date?new Intl.DateTimeFormat("fr-FR",{day:"numeric",month:"long",year:"numeric"}).format(new Date(date)):"—"}
function deadline(){
  if(!state.lastChanged)return null;
  const d=new Date(state.lastChanged);
  d.setDate(d.getDate()+Number(state.interval));
  return d;
}
function due(){
  const d=deadline(), snooze=state.snoozeUntil?new Date(state.snoozeUntil):null;
  return d && Date.now()>=d.getTime() && (!snooze || Date.now()>=snooze.getTime());
}
function daysUntil(){
  const d=deadline();
  return d?Math.ceil((d-Date.now())/86400000):null;
}
function updateSwatches(){
}
function hexToRgb(hex){
  const h=String(hex||"").replace("#","");
  if(!/^[0-9a-fA-F]{6}$/.test(h))return {r:7,g:17,b:31};
  return {r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16)};
}
function mix(a,b,t){return Math.round(a+(b-a)*t)}
function rgbString(r,g,b){return `rgb(${r} ${g} ${b})`}
function harmonizeTheme(hex){
  const {r,g,b}=hexToRgb(hex);
  const luminance=(0.2126*r+0.7152*g+0.0722*b)/255;
  const cardFactor=luminance>0.55?0.78:1.55;
  const lineFactor=luminance>0.55?0.62:1.9;
  const cr=Math.min(255,Math.round(r*cardFactor));
  const cg=Math.min(255,Math.round(g*cardFactor));
  const cb=Math.min(255,Math.round(b*cardFactor));
  const lr=Math.min(255,Math.round(r*lineFactor));
  const lg=Math.min(255,Math.round(g*lineFactor));
  const lb=Math.min(255,Math.round(b*lineFactor));
  const sr=mix(r,255,0.10), sg=mix(g,255,0.10), sb=mix(b,255,0.10);
  const ar=mix(r,255,0.82), ag=mix(g,255,0.82), ab=mix(b,255,0.82);
  document.documentElement.style.setProperty("--card",rgbString(cr,cg,cb));
  document.documentElement.style.setProperty("--line",rgbString(lr,lg,lb));
  document.documentElement.style.setProperty("--soft",rgbString(sr,sg,sb));
  document.documentElement.style.setProperty("--accent",rgbString(ar,ag,ab));
  document.documentElement.style.setProperty("--accentText", luminance>0.55 ? "#07111f" : "#07111f");
}
function render(){
  document.documentElement.style.setProperty("--bg",state.bg);
  harmonizeTheme(state.bg);
  document.getElementById("welcome").textContent=state.name?`Bienvenue sur Drappy, ${state.name}`:"Bienvenue sur Drappy";

  const elapsed=state.lastChanged?daysAgo(state.lastChanged):0;
  const pct=state.lastChanged?Math.min(100,Math.max(0,elapsed/Number(state.interval)*100)):0;
  document.getElementById("bedFill").style.height=`${pct}%`;
  const contour=0.06+(pct/100)*0.12;
  const inner=0.035+(pct/100)*0.06;
  document.documentElement.style.setProperty("--bed-line",`rgba(255,255,255,${contour})`);
  document.documentElement.style.setProperty("--bed-inner",`rgba(255,255,255,${inner})`);

  const pill=document.getElementById("statusPill"), title=document.getElementById("statusTitle");
  const st=document.getElementById("statusText"), nx=document.getElementById("nextText");
  st.textContent=state.lastChanged?`Dernier changement : ${fmt(state.lastChanged)}`:"Dernier changement : pas encore enregistré";
  const remaining=daysUntil();

  if(due()){
    pill.textContent="À faire";
    title.textContent="Il est temps de changer les draps";
    nx.textContent=`Le cycle de ${state.interval} jours est arrivé à échéance.`;
    document.getElementById("reminderCard").classList.remove("hidden");
  }else{
    document.getElementById("reminderCard").classList.add("hidden");
    if(!state.lastChanged){
      pill.textContent="Prêt";
      title.textContent="Commence ton premier cycle";
      nx.textContent="Appuie sur « Draps changés » après ton prochain changement.";
    }else if(remaining<=0){
      pill.textContent="Reporté";
      title.textContent="Rappel repoussé";
      nx.textContent=`Nouveau rappel : ${fmt(state.snoozeUntil)}`;
    }else{
      pill.textContent="À jour";
      title.textContent="Tes draps sont encore frais";
      nx.textContent=`Prochain changement : ${remaining} jour${remaining>1?"s":""}`;
    }
  }

  document.getElementById("historyList").innerHTML=state.history.length
    ?state.history.slice(0,8).map((x,i)=>`<div class="history-item">
        <span>Draps changés</span>
        <span class="history-date"><span>${fmt(x)}</span>
          <button class="delete-history" data-history="${i}" aria-label="Supprimer ce changement" title="Supprimer">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>
          </button>
        </span>
      </div>`).join("")
    :`<div class="history-item"><span>Aucun changement enregistré</span><span>—</span></div>`;

  document.querySelectorAll("[data-history]").forEach(btn=>btn.onclick=()=>{
    const index=Number(btn.dataset.history);
    if(!Number.isInteger(index)||!state.history[index])return;
    const removed=state.history[index];
    state.history.splice(index,1);
    if(index===0){
      state.lastChanged=state.history[0]||null;
      state.snoozeUntil=null;
    }
    save();
    toast("Changement supprimé");
  });

  document.getElementById("nameInput").value=state.name;
  document.getElementById("intervalInput").value=state.interval;
  document.getElementById("notifInput").checked=state.notifications;
  document.getElementById("bgInput").value=state.bg;

}
function markDone(){
  const now=new Date().toISOString();
  state.lastChanged=now;
  state.snoozeUntil=null;
  state.history=[now,...(state.history||[])];
  save();
  toast("Draps enregistrés");
}
async function enableNotifications(){
  if(!("Notification" in window)){toast("Notifications non disponibles ici");return false}
  const p=await Notification.requestPermission();
  state.notifications=p==="granted";
  return state.notifications;
}
function scheduleLocalHint(){
  if(state.notifications && "Notification" in window && Notification.permission==="granted" && due())
    new Notification("Drappy",{body:"C’est le moment de changer tes draps."});
}
function toast(t){
  const el=document.getElementById("toast");
  el.textContent=t;
  el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"),2200);
}

document.getElementById("doneBtn").onclick=markDone;
document.getElementById("settingsBtn").onclick=()=>document.getElementById("settingsSheet").classList.remove("hidden");
document.getElementById("closeSettings").onclick=()=>document.getElementById("settingsSheet").classList.add("hidden");

document.getElementById("bgInput").addEventListener("input",e=>{
  state.bg=e.target.value;
  document.documentElement.style.setProperty("--bg",state.bg);
  harmonizeTheme(state.bg);
  
});

});

document.getElementById("saveSettings").onclick=async()=>{
  state.name=document.getElementById("nameInput").value.trim();
  state.interval=Math.max(1,Math.min(365,Number(document.getElementById("intervalInput").value)||21));
  state.bg=document.getElementById("bgInput").value;
  state.sheet=
const wants=document.getElementById("notifInput").checked;
  if(wants)await enableNotifications(); else state.notifications=false;
  save();
  document.getElementById("settingsSheet").classList.add("hidden");
  toast("Réglages enregistrés");
};

document.querySelectorAll("[data-snooze]").forEach(b=>b.onclick=()=>{
  const d=new Date();
  d.setDate(d.getDate()+Number(b.dataset.snooze));
  state.snoozeUntil=d.toISOString();
  save();
  toast(`Rappel repoussé de ${b.textContent}`);
});

window.addEventListener("load",()=>{
  render();
  setInterval(()=>{render();scheduleLocalHint()},60000);
});
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").then(reg => reg.update()).catch(() => {}).catch(()=>{});
render();
