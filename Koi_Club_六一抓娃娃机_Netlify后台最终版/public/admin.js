const $ = id => document.getElementById(id);

const codesBox = $("codesBox");
const recordsBox = $("recordsBox");
const dollsBox = $("dollsBox");

function headers() {
  return { "Content-Type": "application/json" };
}

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { ...headers(), ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({ ok: false, error: "请求失败" }));
  if (!res.ok || !data.ok) throw new Error(data.error || "请求失败");
  return data;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    alert("已复制：" + text);
  } catch (error) {
    const input = document.createElement("textarea");
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
    alert("已复制：" + text);
  }
}

window.copyCode = async (code) => {
  await copyText(code);
};

async function loadCodes() {
  const data = await api("/api/admin/codes");
  codesBox.innerHTML = data.codes.length
    ? data.codes.map(c => `
      <div class="code-line">
        <div>
          <b>${c.code}</b><br>
          ${c.used}/${c.total} 次｜剩余 ${c.remaining}｜${c.pay || "6.1"}r
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <span class="status-pill">${c.remaining > 0 ? "可用" : "已用完"}</span>
          <button class="btn btn-soft" style="padding:6px 9px" onclick="copyCode('${c.code}')">复制</button>
        </div>
      </div>
    `).join("")
    : `<div class="empty-rec">暂无兑换码</div>`;
}

async function loadRecords() {
  const data = await api("/api/admin/records");
  recordsBox.innerHTML = data.records.length
    ? data.records.map(r => `
      <div class="rec">
        <strong>${r.time}</strong><br>
        兑换码：${r.code}
        <button class="btn btn-soft" style="margin-left:6px;padding:4px 8px" onclick="copyCode('${r.code}')">复制码</button><br>
        抓中：${r.doll}｜奖励：<strong>${r.reward}</strong><br>
        状态：${r.status}<br>
        <button class="btn btn-soft" style="margin-top:6px;padding:6px 9px" onclick="markSent('${r.id}')">标记已发放</button>
      </div>
    `).join("")
    : `<div class="empty-rec">暂无抓取记录</div>`;
}

async function loadDolls() {
  const data = await api("/api/admin/dolls");
  dollsBox.innerHTML = data.dolls.map(d => `
    <div class="reward${d.stock <= 0 ? " empty" : ""}">
      <div class="ri">${d.icon}</div>
      <div class="rt">${d.reward}</div>
      <div class="rs">${d.stock}</div>
    </div>
  `).join("");
}

async function loadAll() {
  try {
    await loadCodes();
    await loadRecords();
    await loadDolls();
  } catch (e) {
    alert(e.message);
  }
}

$("createBtn").onclick = async () => {
  try {
    const body = {
      pay: $("pay").value.trim() || "6.1",
      total: Number($("times").value || 1),
      count: Number($("count").value || 1),
    };
    const data = await api("/api/admin/codes", { method: "POST", body: JSON.stringify(body) });
    const codes = data.codes.map(c => c.code).join("\n");
    await copyText(codes);
    await loadCodes();
  } catch (e) {
    alert(e.message);
  }
};

window.markSent = async (id) => {
  try {
    await api(`/api/admin/records/${id}/status`, { method: "POST", body: JSON.stringify({ status: "已发放" }) });
    await loadRecords();
  } catch (e) {
    alert(e.message);
  }
};

$("refreshBtn").onclick = loadAll;

$("exportBtn").onclick = async () => {
  try {
    const data = await api("/api/admin/records");
    const text = data.records.map(r => `${r.time}\t${r.code}\t${r.doll}\t${r.reward}\t${r.status}`).join("\n");
    await copyText(text || "暂无记录");
  } catch (e) {
    alert(e.message);
  }
};

$("resetStockBtn").onclick = async () => {
  if (confirm("确定重置全部库存？")) {
    await api("/api/admin/reset-stock", { method: "POST", body: "{}" });
    await loadDolls();
  }
};

loadAll();
