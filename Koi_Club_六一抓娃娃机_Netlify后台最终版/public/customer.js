
let dolls = [];
let activeCode = "";
let remainingTimes = 0;
let busy = false;
let clawX = 50;
const $ = id => document.getElementById(id);

const loginBox=$("loginBox"), userbar=$("userbar"), userInfo=$("userInfo"), chanceInfo=$("chanceInfo");
const redeemCode=$("redeemCode"), verifyBtn=$("verifyBtn"), logoutBtn=$("logoutBtn");
const claw=$("claw"), wire=$("wire"), held=$("held"), dollLayer=$("dollLayer"), statusEl=$("status"), miniState=$("miniState");
const joy=$("joy"), knob=$("knob"), catchBtn=$("catchBtn"), rewardList=$("rewardList");
const modal=$("modal"), modalIcon=$("modalIcon"), modalTitle=$("modalTitle"), modalSub=$("modalSub"), modalReward=$("modalReward"), closeModal=$("closeModal"), againBtn=$("againBtn");

function setStatus(text){statusEl.textContent=text; miniState.textContent=text;}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function wait(ms){return new Promise(r=>setTimeout(r,ms))}
function canCatch(){return activeCode && remainingTimes > 0 && !busy && dolls.some(d => d.unlimited || d.stock > 0)}
function updateButtons(){catchBtn.disabled = !canCatch();}
function updateUser(){
  if(activeCode){
    loginBox.classList.add("hidden"); userbar.classList.add("show");
    userInfo.textContent = `兑换码：${activeCode}`;
    chanceInfo.textContent = `剩余次数：${remainingTimes}`;
  } else {
    loginBox.classList.remove("hidden"); userbar.classList.remove("show");
  }
}
function updateClaw(top=64, wireH=64, closed=false){
  claw.style.left=clawX+"%"; claw.style.top=top+"px"; wire.style.height=wireH+"px"; claw.classList.toggle("closed", closed);
}
function renderDolls(){
  dollLayer.innerHTML="";
  dolls.forEach((d,i)=>{
    const el=document.createElement("div");
    el.className="doll"+(d.stock<=0?" empty":"");
    el.style.left=d.x+"%"; el.style.top=d.y+"%"; el.style.width=d.size+"px"; el.style.height=d.size+"px"; el.style.animationDelay=(i*.14)+"s";
    el.innerHTML=`<img src="${d.image}" alt="${d.name}"><div class="stock">${d.unlimited ? "库存∞" : (d.stock>0?"库存"+d.stock:"已抓完")}</div>`;
    dollLayer.appendChild(el);
  });
}
function renderRewards(){
  rewardList.innerHTML=dolls.map(d=>`<div class="reward${(!d.unlimited && d.stock<=0)?" empty":""}"><div class="ri">${d.icon}</div><div class="rt">${d.reward}</div><div class="rs">${d.unlimited ? "∞" : d.stock}</div></div>`).join("");
}
async function loadConfig(){
  const res = await fetch("/api/config");
  const data = await res.json();
  dolls = data.dolls || [];
  renderDolls(); renderRewards(); updateClaw(); updateButtons();
}
verifyBtn.onclick = async () => {
  const code = redeemCode.value.trim().toUpperCase();
  if(!code) return alert("请输入兑换码");
  const res = await fetch("/api/verify", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({code})});
  const data = await res.json();
  if(!data.ok) return alert(data.error || "验证失败");
  activeCode = data.code; remainingTimes = data.remaining;
  setStatus("兑换成功，拖动摇杆选择娃娃");
  updateUser(); updateButtons();
};
logoutBtn.onclick = () => { activeCode=""; remainingTimes=0; setStatus("验证兑换码后开始抓娃娃"); updateUser(); updateButtons(); };

function moveClawByDelta(dx){
  if(!activeCode || busy) return;
  clawX = clamp(50 + dx * .72, 10, 90);
  updateClaw();
}
let joyActive=false;
function setKnob(clientX){
  const rect=joy.getBoundingClientRect();
  const cx=rect.left+rect.width/2;
  const dx=clamp(clientX-cx,-45,45);
  knob.style.left = `calc(50% + ${dx}px)`;
  moveClawByDelta(dx);
}
joy.addEventListener("pointerdown",e=>{joyActive=true;joy.setPointerCapture(e.pointerId);setKnob(e.clientX)});
joy.addEventListener("pointermove",e=>{if(joyActive)setKnob(e.clientX)});
joy.addEventListener("pointerup",()=>{joyActive=false;knob.style.left="50%"});
joy.addEventListener("pointercancel",()=>{joyActive=false;knob.style.left="50%"});

function getCandidateLocal(){
  const available=dolls.filter(d=>d.unlimited || d.stock>0);
  if(!available.length) return null;
  return available.map(d=>({...d,gap:Math.abs(clawX-d.x)})).sort((a,b)=>a.gap-b.gap)[0];
}
async function startCatch(){
  if(!canCatch()) return;
  busy=true; updateButtons();
  const candidate = getCandidateLocal();
  if(!candidate){busy=false; showModal({type:"empty",icon:"🎁",reward:"奖励库存已抓完，请联系 Koi Club"}); return;}

  clawX=candidate.x; updateClaw(64,64,false); await wait(360);
  setStatus("抓钩下降中..."); updateClaw(220,210,false); await wait(760);
  setStatus("抓取判定中..."); claw.classList.add("closed","shake"); await wait(420); claw.classList.remove("shake");
  held.innerHTML=`<img src="${candidate.image}" alt="${candidate.name}">`;
  setStatus("抓钩上升中..."); updateClaw(64,64,true); await wait(760);
  setStatus("正在送往出货口..."); clawX=13; updateClaw(64,64,true); await wait(700);
  held.innerHTML=""; claw.classList.remove("closed");

  const res = await fetch("/api/catch", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({code: activeCode, clawX: candidate.x})});
  const data = await res.json();
  busy=false;
  if(!data.ok){ updateButtons(); return showModal({type:"empty",icon:"🎁",reward:data.error || "抓取失败"}); }
  dolls = data.dolls;
  remainingTimes = data.remaining;
  renderDolls(); renderRewards(); updateUser();
  setStatus(remainingTimes > 0 ? "还有剩余次数，可继续抓取" : "本次兑换码次数已用完");
  updateButtons();
  showModal({type:"win", ...data.result});
}
catchBtn.onclick=startCatch;
function showModal(r){
  modal.classList.add("show");
  modalIcon.textContent=r.icon||"🎁";
  modalTitle.textContent = r.type==="win" ? "恭喜抓中！" : "提示";
  modalSub.textContent = r.type==="win" ? `你抓到了【${r.doll}】` : "当前不可继续抓取";
  modalReward.textContent = r.reward;
  againBtn.disabled = !(remainingTimes > 0 && dolls.some(d=>d.stock>0));
}
function hideModal(){ modal.classList.remove("show");}
closeModal.onclick=hideModal;
againBtn.onclick=()=>{hideModal(); updateButtons();}
modal.addEventListener("click",e=>{if(e.target===modal)hideModal()});
window.addEventListener("keydown",e=>{
  if(e.key==="ArrowLeft"||e.key.toLowerCase()==="a"){clawX=clamp(clawX-5,10,90);updateClaw()}
  if(e.key==="ArrowRight"||e.key.toLowerCase()==="d"){clawX=clamp(clawX+5,10,90);updateClaw()}
  if(e.code==="Space"){e.preventDefault();startCatch()}
});
setStatus("验证兑换码后开始抓娃娃");
loadConfig();
