const $ = (id) => document.getElementById(id);
let api = sessionStorage.getItem("dc_api") || "";
let jwt = sessionStorage.getItem("dc_jwt") || "";
$("apiUrl").value = api;
const cleanApi = () => $("apiUrl").value.trim().replace(/\/+$/,"");
async function call(path, options={}) {
  const res = await fetch(cleanApi()+path, { ...options, headers: {
    "content-type":"application/json", ...(jwt ? {authorization:"Bearer "+jwt}:{}), ...(options.headers||{})
  }});
  const data = await res.json().catch(()=>({error:"Unexpected server response"}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
function msg(id, text, error=false){$(id).textContent=text;$(id).classList.toggle("error",error)}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function showDashboard(){ $("loginCard").hidden=true; $("dashboard").hidden=false; loadDevices(); }
function showLogin(){ $("loginCard").hidden=false; $("dashboard").hidden=true; }
$("loginBtn").addEventListener("click", async()=>{
  api=cleanApi(); if(!/^https:\/\/[^/]+/.test(api)){msg("loginMessage","Enter your deployed HTTPS Worker URL.",true);return}
  $("loginBtn").disabled=true;
  try {const r=await call("/admin/login",{method:"POST",headers:{},body:JSON.stringify({password:$("password").value})});
    jwt=r.token;sessionStorage.setItem("dc_api",api);sessionStorage.setItem("dc_jwt",jwt);showDashboard();msg("loginMessage","");}
  catch(e){msg("loginMessage",e.message,true)} finally{$("loginBtn").disabled=false}
});
$("logoutBtn").addEventListener("click",()=>{jwt="";sessionStorage.removeItem("dc_jwt");showLogin()});
$("registerBtn").addEventListener("click",async()=>{
  $("registerBtn").disabled=true;
  try {const r=await call("/admin/devices",{method:"POST",body:JSON.stringify({label:$("deviceLabel").value.trim()||"Android phone"})});
    $("tokenReveal").hidden=false;
    $("tokenReveal").innerHTML=`<strong>Copy these into the Android app now</strong><p>Device ID</p><code>${esc(r.deviceId)}</code><button class="copy" data-copy="${esc(r.deviceId)}">Copy ID</button><p>Device token (shown once)</p><code>${esc(r.deviceToken)}</code><button class="copy" data-copy="${esc(r.deviceToken)}">Copy token</button>`;
    $("tokenReveal").querySelectorAll(".copy").forEach(b=>b.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(b.dataset.copy);b.textContent="Copied"}catch{alert("Select and copy the value manually.")}}));
    msg("dashboardMessage","Device registered. Copy its token before leaving this page.");await loadDevices();
  } catch(e){msg("dashboardMessage",e.message,true)} finally{$("registerBtn").disabled=false}
});
async function loadDevices(){
  try {const r=await call("/admin/devices");const wrap=$("devices");wrap.innerHTML="";
    if(!r.devices.length){wrap.innerHTML='<div class="panel muted">No devices registered yet.</div>';return}
    for(const d of r.devices){
      const card=document.createElement("article");card.className="device";
      card.innerHTML=`<div class="device-head"><div><h3>${esc(d.label||"Android phone")}</h3><div class="status">${esc(d.deviceId)} · Registered ${esc((d.createdAt||"").slice(0,10))}</div></div><button class="secondary refresh">Refresh status</button></div><div class="status result">Status not loaded</div><div class="actions"><button data-type="ring">Ring</button><button data-type="vibrate">Vibrate</button><button data-type="lock" class="lock">Lock phone</button><button data-type="screenshot" class="screenshot">Request screenshot</button></div>`;
      card.querySelector(".refresh").addEventListener("click",()=>loadStatus(d.deviceId,card));
      card.querySelectorAll("[data-type]").forEach(b=>b.addEventListener("click",()=>sendCommand(d.deviceId,b.dataset.type,b)));
      wrap.append(card);loadStatus(d.deviceId,card);
    }
  } catch(e){msg("dashboardMessage",e.message,true)}
}
async function loadStatus(id,card){try{const r=await call("/admin/status?deviceId="+encodeURIComponent(id));const s=r.status;
 card.querySelector(".result").textContent=s?`${s.online?"Recently connected":"No recent connection"} · Last seen: ${s.lastSeen||"never"}${s.lastCommand?` · Last command: ${s.lastCommand.status} ${s.lastCommand.message||""}`:""}`:"No status yet";
 }catch(e){card.querySelector(".result").textContent=e.message}}
async function sendCommand(deviceId,type,button){
 const labels={ring:"Ring this phone?",vibrate:"Vibrate this phone?",lock:"Lock this phone? This requires Device Admin already enabled on the phone.",screenshot:"Request a screenshot? The phone must be opened and the Android capture prompt approved."};
 if(!confirm(labels[type]))return;
 button.disabled=true;
 try{const r=await call("/admin/commands",{method:"POST",body:JSON.stringify({deviceId,type})});msg("dashboardMessage",`${type} request queued (${r.command.id}).`);setTimeout(()=>loadDevices(),1200)}
 catch(e){msg("dashboardMessage",e.message,true)}finally{button.disabled=false}
}
if(jwt&&api){$("apiUrl").value=api;showDashboard()}else showLogin();
