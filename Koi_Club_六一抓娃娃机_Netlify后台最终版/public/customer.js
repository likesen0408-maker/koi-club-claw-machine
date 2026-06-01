let dolls = [];
let activeCode = "";
let remainingTimes = 0;
let busy = false;
let clawX = 50;

const $ = id => document.getElementById(id);

const loginBox = $("loginBox");
const userbar = $("userbar");
const userInfo = $("userInfo");
const chanceInfo = $("chanceInfo");

const redeemCode = $("redeemCode");
const verifyBtn = $("verifyBtn");
const logoutBtn = $("logoutBtn");

const claw = $("claw");
const wire = $("wire");
const held = $("held");
const dollLayer = $("dollLayer");
const statusEl = $("status");
const miniState = $("miniState");

const joy = $("joy");
const knob = $("knob");
const catchBtn = $("catchBtn");
const rewardList = $("rewardList");

const modal = $("modal");
const modalIcon = $("modalIcon");
const modalTitle = $("modalTitle");
const modalSub = $("modalSub");
const modalReward = $("modalReward");
const closeModal = $("closeModal");
const againBtn = $("againBtn");

function setStatus(text) {
  statusEl.textContent = text;
  miniState.textContent = text;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function normalizeInputCode(input) {
  const clean = String(input || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  const match = clean.match(/KOI([0-9A-F]{6})/);

  if (!match) return clean;

  return "KOI-" + match[1];
}

function hasAvailableDoll() {
  return dolls.some(d => d.unlimited || Number(d.stock) > 0);
}

function canCatch() {
  return Boolean(activeCode) && Number(remainingTimes) > 0 && !busy && hasAvailableDoll();
}

function updateButtons() {
  catchBtn.disabled = !canCatch();

  if (!activeCode) {
    catchBtn.textContent = "请先验证兑换码";
  } else if (busy) {
    catchBtn.textContent = "抓取中...";
  } else if (Number(remainingTimes) <= 0) {
    catchBtn.textContent = "次数已用完";
  } else {
    catchBtn.textContent = "开始抓取";
  }
}

function updateUser() {
  if (activeCode) {
    loginBox.classList.add("hidden");
    userbar.classList.add("show");
    userInfo.textContent = `兑换码：${activeCode}`;
    chanceInfo.textContent = `剩余次数：${remainingTimes}`;
  } else {
    loginBox.classList.remove("hidden");
    userbar.classList.remove("show");
    userInfo.textContent = "";
    chanceInfo.textContent = "";
  }

  updateButtons();
}

function updateClaw(top = 64, wireH = 64, closed = false) {
  claw.style.left = clawX + "%";
  claw.style.top = top + "px";
  wire.style.height = wireH + "px";
  claw.classList.toggle("closed", closed);
}

function renderDolls() {
  dollLayer.innerHTML = "";

  dolls.forEach((d, i) => {
    const isAvailable = d.unlimited || Number(d.stock) > 0;

    const el = document.createElement("div");
    el.className = "doll" + (!isAvailable ? " empty" : "");
    el.style.left = d.x + "%";
    el.style.top = d.y + "%";
    el.style.width = d.size + "px";
    el.style.height = d.size + "px";
    el.style.animationDelay = (i * 0.14) + "s";

    el.innerHTML = `
      <img src="${d.image}" alt="${d.name}">
    `;

    dollLayer.appendChild(el);
  });
}

function renderRewards() {
  rewardList.innerHTML = dolls.map(d => `
    <div class="reward">
      <div class="ri">${d.icon}</div>
      <div class="rt">${d.reward}</div>
    </div>
  `).join("");
}

async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    const data = await res.json();

    dolls = data.dolls || [];

    renderDolls();
    renderRewards();
    updateClaw();
    updateButtons();
  } catch (e) {
    setStatus("加载失败，请刷新页面");
  }
}

verifyBtn.onclick = async () => {
  const code = normalizeInputCode(redeemCode.value);

  if (!code) {
    return alert("请输入兑换码");
  }

  verifyBtn.disabled = true;

  try {
    const res = await fetch("/api/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ code })
    });

    const data = await res.json();

    if (!data.ok) {
      activeCode = "";
      remainingTimes = 0;
      updateUser();
      return alert(data.error || "验证失败");
    }

    const left = Number(data.remaining || 0);

    if (left <= 0) {
      activeCode = "";
      remainingTimes = 0;
      updateUser();
      return alert("兑换码次数已用完");
    }

    activeCode = data.code;
    remainingTimes = left;

    setStatus("兑换成功，拖动摇杆选择娃娃");
    updateUser();
  } finally {
    verifyBtn.disabled = false;
  }
};

logoutBtn.onclick = () => {
  activeCode = "";
  remainingTimes = 0;

  setStatus("验证兑换码后开始抓娃娃");
  updateUser();
};

function moveClawByDelta(dx) {
  if (!activeCode || busy) return;

  clawX = clamp(50 + dx * 0.72, 10, 90);
  updateClaw();
}

let joyActive = false;

function setKnob(clientX) {
  const rect = joy.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const dx = clamp(clientX - cx, -45, 45);

  knob.style.left = `calc(50% + ${dx}px)`;
  moveClawByDelta(dx);
}

joy.addEventListener("pointerdown", e => {
  joyActive = true;
  joy.setPointerCapture(e.pointerId);
  setKnob(e.clientX);
});

joy.addEventListener("pointermove", e => {
  if (joyActive) setKnob(e.clientX);
});

joy.addEventListener("pointerup", () => {
  joyActive = false;
  knob.style.left = "50%";
});

joy.addEventListener("pointercancel", () => {
  joyActive = false;
  knob.style.left = "50%";
});

function getCandidateLocal() {
  const available = dolls.filter(d => d.unlimited || Number(d.stock) > 0);

  if (!available.length) return null;

  return available
    .map(d => ({
      ...d,
      gap: Math.abs(clawX - d.x)
    }))
    .sort((a, b) => a.gap - b.gap)[0];
}

async function startCatch() {
  if (busy) return;

  if (!activeCode) {
    return alert("请先输入兑换码");
  }

  if (Number(remainingTimes) <= 0) {
    updateButtons();

    return showModal({
      type: "empty",
      icon: "",
      reward: "兑换码次数已用完"
    });
  }

  if (!hasAvailableDoll()) {
    updateButtons();

    return showModal({
      type: "empty",
      icon: "",
      reward: "奖励库存已抓完，请联系 Koi Club"
    });
  }

  // 关键：抓取一开始就锁定当前兑换码，防止动画过程中状态被清空
  const catchCode = activeCode;

  busy = true;
  updateButtons();

  try {
    const candidate = getCandidateLocal();

    if (!candidate) {
      return showModal({
        type: "empty",
        icon: "",
        reward: "奖励库存已抓完，请联系 Koi Club"
      });
    }

    clawX = candidate.x;
    updateClaw(64, 64, false);
    await wait(360);

    setStatus("抓钩下降中...");
    updateClaw(220, 210, false);
    await wait(760);

    setStatus("抓取判定中...");
    claw.classList.add("closed", "shake");
    await wait(420);
    claw.classList.remove("shake");

    held.innerHTML = `<img src="${candidate.image}" alt="${candidate.name}">`;

    setStatus("抓钩上升中...");
    updateClaw(64, 64, true);
    await wait(760);

    setStatus("正在送往出货口...");
    clawX = 13;
    updateClaw(64, 64, true);
    await wait(700);

    held.innerHTML = "";
    claw.classList.remove("closed");

    const res = await fetch("/api/catch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        code: catchCode,
        clawX: candidate.x
      })
    });

    const data = await res.json();

    if (!data.ok) {
      if (data.error && data.error.includes("次数已用完")) {
        remainingTimes = 0;
      }

      updateUser();

      return showModal({
        type: "empty",
        icon: "",
        reward: data.error || "抓取失败"
      });
    }

    dolls = data.dolls || dolls;
    remainingTimes = Number(data.remaining || 0);

    renderDolls();
    renderRewards();

    // 关键：先弹中奖结果，不要先弹无效/用完
    showModal({
      type: "win",
      ...data.result
    });

    if (remainingTimes <= 0) {
      setStatus("本次兑换码次数已用完");
    } else {
      setStatus("还有剩余次数，可继续抓取");
    }

    updateUser();
  } finally {
    busy = false;
    updateButtons();
  }
}

catchBtn.onclick = startCatch;

function showModal(r) {
  modal.classList.add("show");

  modalIcon.textContent = r.icon || "";
  modalTitle.textContent = r.type === "win" ? "恭喜抓中！" : "提示";
  modalSub.textContent = r.type === "win" ? `你抓到了〖${r.doll}〗` : "当前不可继续抓取";
  modalReward.textContent = r.reward || "";

  againBtn.disabled = !(Number(remainingTimes) > 0 && hasAvailableDoll());
}

function hideModal() {
  modal.classList.remove("show");
}

closeModal.onclick = hideModal;

againBtn.onclick = () => {
  hideModal();
  updateButtons();
};

modal.addEventListener("click", e => {
  if (e.target === modal) hideModal();
});

window.addEventListener("keydown", e => {
  if (!activeCode || busy) return;

  if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
    clawX = clamp(clawX - 5, 10, 90);
    updateClaw();
  }

  if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
    clawX = clamp(clawX + 5, 10, 90);
    updateClaw();
  }

  if (e.code === "Space") {
    e.preventDefault();
    startCatch();
  }
});

setStatus("验证兑换码后开始抓娃娃");
loadConfig();
