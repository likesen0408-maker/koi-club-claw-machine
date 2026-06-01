const { getStore, connectLambda } = require("@netlify/blobs");
const crypto = require("crypto");
const DEFAULT_DB = require("./default-db.json");

const ADMIN_KEY = process.env.ADMIN_KEY || "koi061";

function response(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers
    },
    body: JSON.stringify(body)
  };
}

function csvResponse(csv) {
  return {
    statusCode: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=koi-claw-records.csv"
    },
    body: "\ufeff" + csv
  };
}

function now() {
  return new Date().toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).replace(/\//g, "-");
}

function normalizeCode(input) {
  const raw = String(input || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

  const match = raw.match(/KOI-[0-9A-F]{6}/) || raw.match(/KOI[0-9A-F]{6}/);

  if (!match) return raw;

  const code = match[0];

  return code.startsWith("KOI-") ? code : "KOI-" + code.slice(3);
}

function cloneDefaultDb() {
  return JSON.parse(JSON.stringify(DEFAULT_DB));
}

function forceUnlimitedStock(db) {
  if (!db || !Array.isArray(db.dolls)) return db;

  db.dolls = db.dolls.map(d => ({
    ...d,
    unlimited: true,
    stock: 999999,
    initialStock: 999999
  }));

  return db;
}

async function getDb() {
  const store = getStore("koi-claw-db");
  let db = await store.get("db", { type: "json" });

  if (!db) {
    db = cloneDefaultDb();
    await store.setJSON("db", db);
  }

  db.codes = Array.isArray(db.codes) ? db.codes : [];
  db.records = Array.isArray(db.records) ? db.records : [];
  db.dolls = Array.isArray(db.dolls) ? db.dolls : [];

  db = forceUnlimitedStock(db);

  await store.setJSON("db", db);

  return { store, db };
}

async function saveDb(store, db) {
  await store.setJSON("db", db);
}

function remaining(code) {
  return Math.max(0, Number(code.total || 0) - Number(code.used || 0));
}

function syncCodeUsageFromRecords(db, code) {
  if (!db || !code || !Array.isArray(db.records)) return code;

  const recordCount = db.records.filter(r => {
    return String(r.code || "").toUpperCase() === String(code.code || "").toUpperCase();
  }).length;

  code.used = Math.max(Number(code.used || 0), recordCount);

  return code;
}

function makeCode() {
  return "KOI-" + crypto.randomBytes(3).toString("hex").toUpperCase();
}

function publicDoll(d) {
  return {
    id: d.id,
    name: d.name,
    reward: d.reward,
    icon: d.icon,
    image: d.image,
    x: d.x,
    y: d.y,
    size: d.size,
    stock: d.stock,
    unlimited: !!d.unlimited
  };
}

function adminOnly(event) {
  return true;
}

function getRoute(event) {
  const p = event.path || "";

  if (p.includes("/api/")) {
    return p.split("/api/")[1].replace(/^\/+/, "");
  }

  if (p.includes("/.netlify/functions/api/")) {
    return p.split("/.netlify/functions/api/")[1].replace(/^\/+/, "");
  }

  return "";
}

exports.handler = async event => {
  try {
    connectLambda(event);

    const method = event.httpMethod || "GET";
    const route = getRoute(event);
    const { store, db } = await getDb();

    if (method === "GET" && route === "config") {
      return response(200, {
        ok: true,
        dolls: db.dolls.map(publicDoll)
      });
    }

    if (method === "POST" && route === "verify") {
      const body = JSON.parse(event.body || "{}");
      const codeText = normalizeCode(body.code);

      const found = db.codes.find(c => {
        return String(c.code || "").toUpperCase() === codeText;
      });

      if (!found) {
        return response(404, {
          ok: false,
          error: "兑换码不存在"
        });
      }

      syncCodeUsageFromRecords(db, found);
      await saveDb(store, db);

      if (remaining(found) <= 0) {
        return response(400, {
          ok: false,
          error: "兑换码次数已用完"
        });
      }

      return response(200, {
        ok: true,
        code: found.code,
        remaining: remaining(found)
      });
    }

    if (method === "POST" && route === "catch") {
      const body = JSON.parse(event.body || "{}");
      const codeText = normalizeCode(body.code);
      const clawX = Math.max(10, Math.min(90, Number(body.clawX || 50)));

      const code = db.codes.find(c => {
        return String(c.code || "").toUpperCase() === codeText;
      });

      if (!code) {
        return response(404, {
          ok: false,
          error: "兑换码不存在"
        });
      }

      syncCodeUsageFromRecords(db, code);

      if (remaining(code) <= 0) {
        await saveDb(store, db);

        return response(400, {
          ok: false,
          error: "兑换码次数已用完"
        });
      }

      const nowMs = Date.now();

      if (Number(code.lockedUntil || 0) > nowMs) {
        return response(429, {
          ok: false,
          error: "正在抓取中，请不要重复点击"
        });
      }

      code.lockedUntil = nowMs + 15000;
      await saveDb(store, db);

      const available = db.dolls.filter(d => d.unlimited || Number(d.stock) > 0);

      if (!available.length) {
        code.lockedUntil = 0;
        await saveDb(store, db);

        return response(400, {
          ok: false,
          error: "奖励库存已抓完"
        });
      }

      available.sort((a, b) => {
        return Math.abs(Number(a.x) - clawX) - Math.abs(Number(b.x) - clawX);
      });

      const doll = available[0];
      const original = db.dolls.find(d => d.id === doll.id);

      if (!original) {
        code.lockedUntil = 0;
        await saveDb(store, db);

        return response(400, {
          ok: false,
          error: "娃娃数据异常"
        });
      }

      if (!original.unlimited) {
        original.stock = Math.max(0, Number(original.stock || 0) - 1);
      }

      code.used = Number(code.used || 0) + 1;
      code.lockedUntil = 0;

      const record = {
        id: crypto.randomUUID(),
        time: now(),
        code: code.code,
        doll: doll.name,
        reward: doll.reward,
        icon: doll.icon,
        status: "未发放"
      };

      db.records.unshift(record);

      await saveDb(store, db);

      return response(200, {
        ok: true,
        result: record,
        remaining: remaining(code),
        dolls: db.dolls.map(publicDoll)
      });
    }

    if (!adminOnly(event)) {
      return response(401, {
        ok: false,
        error: "后台密码错误"
      });
    }

    if (method === "GET" && route === "admin/codes") {
      db.codes.forEach(c => syncCodeUsageFromRecords(db, c));
      await saveDb(store, db);

      return response(200, {
        ok: true,
        codes: db.codes.map(c => ({
          ...c,
          remaining: remaining(c)
        }))
      });
    }

    if (method === "POST" && route === "admin/codes") {
      const body = JSON.parse(event.body || "{}");

      const count = Math.max(1, Math.min(100, Number(body.count || 1)));
      const total = Math.max(1, Math.min(99, Number(body.total || 1)));
      const pay = String(body.pay || "6.1");

      const made = [];

      for (let i = 0; i < count; i++) {
        let code = makeCode();

        while (db.codes.some(c => c.code === code)) {
          code = makeCode();
        }

        const item = {
          code,
          total,
          used: 0,
          pay,
          lockedUntil: 0,
          createdAt: now()
        };

        db.codes.unshift(item);

        made.push({
          ...item,
          remaining: total
        });
      }

      await saveDb(store, db);

      return response(200, {
        ok: true,
        codes: made
      });
    }

    if (method === "GET" && route === "admin/records") {
      return response(200, {
        ok: true,
        records: db.records
      });
    }

    const markMatch = route.match(/^admin\/records\/(.+)\/status$/);

    if (method === "POST" && markMatch) {
      const record = db.records.find(r => r.id === markMatch[1]);

      if (!record) {
        return response(404, {
          ok: false,
          error: "记录不存在"
        });
      }

      const body = JSON.parse(event.body || "{}");
      record.status = String(body.status || "已发放");

      await saveDb(store, db);

      return response(200, {
        ok: true,
        record
      });
    }

    if (method === "GET" && route === "admin/export") {
      const rows = [
        ["时间", "兑换码", "抓中娃娃", "对应奖励", "状态"],
        ...db.records.map(r => [r.time, r.code, r.doll, r.reward, r.status])
      ];

      const csv = rows
        .map(row => row.map(v => `"${String(v || "").replace(/"/g, '""')}"`).join(","))
        .join("\n");

      return csvResponse(csv);
    }

    if (method === "GET" && route === "admin/dolls") {
      return response(200, {
        ok: true,
        dolls: db.dolls
      });
    }

    const stockMatch = route.match(/^admin\/dolls\/(.+)\/stock$/);

    if (method === "POST" && stockMatch) {
      const body = JSON.parse(event.body || "{}");
      const doll = db.dolls.find(d => String(d.id) === String(stockMatch[1]));

      if (!doll) {
        return response(404, {
          ok: false,
          error: "娃娃不存在"
        });
      }

      doll.stock = Math.max(0, Number(body.stock || 0));

      await saveDb(store, db);

      return response(200, {
        ok: true,
        doll
      });
    }

    if (method === "POST" && route === "admin/reset-stock") {
      db.dolls = db.dolls.map(d => ({
        ...d,
        unlimited: true,
        stock: 999999,
        initialStock: 999999
      }));

      await saveDb(store, db);

      return response(200, {
        ok: true,
        dolls: db.dolls
      });
    }

    return response(404, {
      ok: false,
      error: "接口不存在",
      route
    });
  } catch (error) {
    return response(500, {
      ok: false,
      error: error.message || "服务器错误"
    });
  }
};
