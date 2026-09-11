const KEY="drappy_v2";
const defaults={name:"",interval:21,notifications:false,bg:"#07111f",sheet:"#ffffff",lastChanged:null,snoozeUntil:null,history:[]};
let state=load();

function load(){
  try{
    const old=JSON.parse(localStorage.getItem(KEY)||"null");
    if(old)return {...defaults,...old};
    const legacy=JSON.parse(localStorage.getItem("drappy_v1")||"{}");
    return {...defaults,...legacy};
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
  document.getElementById("bgSwatch").style.background=state.bg;
  document.getElementById("sheetSwatch").style.background=state.sheet;
}
function render(){
  document.documentElement.style.setProperty("--bg",state.bg);
  document.documentElement.style.setProperty("--sheet",state.sheet);
  document.getElementById("welcome").textContent=state.name?`Bienvenue sur Drappy, ${state.name}`:"Bienvenue sur Drappy";

  const elapsed=state.lastChanged?daysAgo(state.lastChanged):0;
  const pct=state.lastChanged?Math.min(100,Math.max(0,elapsed/Number(state.interval)*100)):0;
  document.getElementById("bedFill").style.height=`${pct}%`;

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
    ?state.history.slice(0,8).map(x=>`<div class="history-item"><span>Draps changés</span><span>${fmt(x)}</span></div>`).join("")
    :`<div class="history-item"><span>Aucun changement enregistré</span><span>—</span></div>`;

  document.getElementById("nameInput").value=state.name;
  document.getElementById("intervalInput").value=state.interval;
  document.getElementById("notifInput").checked=state.notifications;
  document.getElementById("bgInput").value=state.bg;
  document.getElementById("sheetInput").value=state.sheet;
  updateSwatches();
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
  updateSwatches();
});
document.getElementById("sheetInput").addEventListener("input",e=>{
  state.sheet=e.target.value;
  document.documentElement.style.setProperty("--sheet",state.sheet);
  updateSwatches();
});

document.getElementById("saveSettings").onclick=async()=>{
  state.name=document.getElementById("nameInput").value.trim();
  state.interval=Math.max(1,Math.min(365,Number(document.getElementById("intervalInput").value)||21));
  state.bg=document.getElementById("bgInput").value;
  state.sheet=document.getElementById("sheetInput").value;
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
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
render();
