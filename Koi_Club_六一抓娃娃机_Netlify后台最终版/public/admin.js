
const $ = id => document.getElementById(id);
let adminKey = localStorage.getItem("koi_admin_key") || "";

const loginAdmin=$("loginAdmin"), adminContent=$("adminContent"), adminKeyInput=$("adminKey");
const codesBox=$("codesBox"), recordsBox=$("recordsBox"), dollsBox=$("dollsBox");

function headers(){ return {"Content-Type":"application/json","x-admin-key":adminKey}; }
function showAdmin(){ loginAdmin.classList.add("hidden"); adminContent.classList.remove("hidden"); loadAll(); }
function hideAdmin(){ loginAdmin.classList.remove("hidden"); adminContent.classList.add("hidden"); }
$("saveKeyBtn").onclick=()=>{ adminKey=adminKeyInput.value.trim(); localStorage.setItem("koi_admin_key", adminKey); showAdmin(); };
if(adminKey){ adminKeyInput.value = adminKey; showAdmin(); }

async function api(path, opts={}){
  const res = await fetch(path, { ...opts, headers: { ...headers(), ...(opts.headers||{}) } });
  const data = await res.json().catch(()=>({ok:false,error:"请求失败"}));
  if(!res.ok || !data.ok) throw new Error(data.error || "请求失败");
  return data;
}
async function loadCodes(){
  try{
    const data = await api("/api/admin/codes");
    codesBox.innerHTML = data.codes.length ? data.codes.map(c=>`<div class="code-line"><div><b>${c.code}</b><br>${c.used}/${c.total} 次｜剩余 ${c.remaining}｜${c.pay||"6.1"}r</div><span class="status-pill">${c.remaining>0?"可用":"已用完"}</span></div>`).join("") : `<div class="empty-rec">暂无兑换码</div>`;
  }catch(e){ alert(e.message); hideAdmin(); }
}
async function loadRecords(){
  const data = await api("/api/admin/records");
  recordsBox.innerHTML = data.records.length ? data.records.map(r=>`<div class="rec"><strong>${r.time}</strong><br>兑换码：${r.code}<br>抓中：${r.doll}｜奖励：<strong>${r.reward}</strong><br>状态：${r.status}<br><button class="btn btn-soft" style="margin-top:6px;padding:6px 9px" onclick="markSent('${r.id}')">标记已发放</button></div>`).join("") : `<div class="empty-rec">暂无抓取记录</div>`;
}
async function loadDolls(){
  const data = await api("/api/admin/dolls");
  dollsBox.innerHTML = data.dolls.map(d=>`<div class="reward${d.stock<=0?" empty":""}"><div class="ri">${d.icon}</div><div class="rt">${d.reward}</div><div class="rs">${d.stock}</div></div>`).join("");
}
async function loadAll(){ await loadCodes(); await loadRecords(); await loadDolls(); }
$("createBtn").onclick=async()=>{
  try{
    const body = { pay:$("pay").value.trim()||"6.1", total:Number($("times").value||1), count:Number($("count").value||1) };
    const data = await api("/api/admin/codes", {method:"POST", body:JSON.stringify(body)});
    alert("已生成：\n" + data.codes.map(c=>c.code).join("\n"));
    loadCodes();
  }catch(e){ alert(e.message); }
};
window.markSent=async(id)=>{
  try{ await api(`/api/admin/records/${id}/status`, {method:"POST", body:JSON.stringify({status:"已发放"})}); loadRecords(); }
  catch(e){ alert(e.message); }
};
$("refreshBtn").onclick=loadAll;
$("exportBtn").onclick=()=>{ window.open(`/api/admin/export?key=${encodeURIComponent(adminKey)}`, "_blank"); };
$("resetStockBtn").onclick=async()=>{ if(confirm("确定重置全部库存？")){ await api("/api/admin/reset-stock", {method:"POST", body:"{}"}); loadDolls(); } };
