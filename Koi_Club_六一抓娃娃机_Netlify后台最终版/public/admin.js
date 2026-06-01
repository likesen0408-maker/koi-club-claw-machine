const $ = id => document.getElementById(id);

const codesBox = $("codesBox");
const recordsBox = $("recordsBox");
const dollsBox = $("dollsBox");

function headers() {
  return {
    "Content-Type": "application/json"
  };
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      ...headers(),
      ...(opts.headers || {})
    }
  });

  const data = await res.json().catch(() => ({
    ok: false,
    error: "请求失败"
  }));

  if (!res.ok || !data.ok) {
    throw new Error(data.error || "请求失败");
  }

  return data;
}

async function copyText(text, successText = "已复制") {
  try {
    await navigator.clipboard.writeText(text);
    alert(successText);
  } catch (error) {
    const input = document.createElement("textarea");
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
    alert(successText);
  }
}

window.copyCode = async code => {
  await copyText(code, "已复制兑换码：" + code);
};

async function loadCodes() {
  const data = await api("/api/admin/codes");

  codesBox.innerHTML = data.codes.length
    ? data.codes.map(c => `
      <div class="rec">
        <div>
          <strong style="font-size:18px;color:#e84f91;">${c.code}</strong>
          <button class="btn btn-soft" onclick="copyCode('${c.code}')">
            一键复制兑换码
          </button>
        </div>

        <div style="margin-top:6px;">
          ${c.used}/${c.total} 次｜剩余 ${c.remaining}｜${c.pay || "6.1"}r
        </div>

        <div style="margin-top:4px;color:${c.remaining > 0 ? "#38a169" : "#999"};">
          ${c.remaining > 0 ? "可用" : "已用完"}
        </div>
      </div>
    `).join("")
    : `<div class="rec">暂无兑换码</div>`;
}

async function loadRecords() {
  const data = await api("/api/admin/records");

  recordsBox.innerHTML = data.records.length
    ? data.records.map(r => `
      <div class="rec">
        <div><strong>${r.time}</strong></div>

        <div style="margin-top:6px;">
          兑换码：${r.code}
          <button class="btn btn-soft" onclick="copyCode('${r.code}')">
            一键复制兑换码
          </button>
        </div>

        <div style="margin-top:6px;">抓中：${r.doll}</div>
        <div>奖励：${r.reward}</div>
        <div style="margin-top:6px;">状态：${r.status}</div>

        <button class="btn btn-main" onclick="markSent('${r.id}')">
          标记已发放
        </button>
      </div>
    `).join("")
    : `<div class="rec">暂无抓取记录</div>`;
}

async function loadDolls() {
  const data = await api("/api/admin/dolls");

  dollsBox.innerHTML = data.dolls.map(d => `
    <div class="rec">
      <div style="font-size:26px;">${d.icon}</div>
      <div style="font-weight:900;margin-top:6px;">${d.reward}</div>
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
      count: Number($("count").value || 1)
    };

    const data = await api("/api/admin/codes", {
      method: "POST",
      body: JSON.stringify(body)
    });

    const firstCode = data.codes[0]?.code || "";

    const newCodesHtml = `
      <div class="rec" style="border:2px solid #ff9dcc;background:#fff7fb;">
        <div style="font-size:18px;font-weight:900;color:#e84f91;">
          新生成兑换码
        </div>

        ${data.codes.map(c => `
          <div style="margin-top:10px;padding:10px;border-radius:14px;background:#fff;border:1px solid #ffd0e5;">
            <strong style="font-size:18px;color:#e84f91;">${c.code}</strong>

            <button class="btn btn-soft" onclick="copyCode('${c.code}')">
              一键复制兑换码
            </button>

            <div style="font-size:13px;margin-top:5px;">
              可抓 ${c.total} 次｜${c.pay || "6.1"}r
            </div>
          </div>
        `).join("")}
      </div>
    `;

    codesBox.innerHTML = newCodesHtml + codesBox.innerHTML;

    if (firstCode) {
      try {
        await navigator.clipboard.writeText(firstCode);
        alert("已生成，并自动复制兑换码：" + firstCode);
      } catch (e) {
        alert("已生成兑换码，请点击旁边的一键复制兑换码按钮");
      }
    }
  } catch (e) {
    alert(e.message);
  }
};

window.markSent = async id => {
  try {
    await api(`/api/admin/records/${id}/status`, {
      method: "POST",
      body: JSON.stringify({
        status: "已发放"
      })
    });

    await loadRecords();
  } catch (e) {
    alert(e.message);
  }
};

$("refreshBtn").onclick = loadAll;

$("exportBtn").onclick = async () => {
  try {
    const data = await api("/api/admin/records");

    const text = data.records.length
      ? data.records
          .map(r => `${r.time}\t${r.code}\t${r.doll}\t${r.reward}\t${r.status}`)
          .join("\n")
      : "暂无记录";

    await copyText(text, "抓取记录已复制");
  } catch (e) {
    alert(e.message);
  }
};

$("resetStockBtn").onclick = async () => {
  if (confirm("确定重置全部库存？")) {
    await api("/api/admin/reset-stock", {
      method: "POST",
      body: "{}"
    });

    await loadDolls();
    alert("库存已重置");
  }
};

loadAll();
