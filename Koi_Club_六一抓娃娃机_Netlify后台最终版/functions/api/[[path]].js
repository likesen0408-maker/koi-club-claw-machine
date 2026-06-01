const DEFAULT_DB = {
  dolls: [
    {
      id: 1,
      name: "爱心包包羊",
      reward: "自选摸金图1局",
      icon: "📖",
      image: "/assets/doll1.png",
      x: 18,
      y: 56,
      size: 92,
      stock: 999999,
      initialStock: 999999,
      unlimited: true
    },
    {
      id: 2,
      name: "奶茶杯羊",
      reward: "单局带出60w",
      icon: "61",
      image: "/assets/doll2.png",
      x: 39,
      y: 50,
      size: 88,
      stock: 999999,
      initialStock: 999999,
      unlimited: true
    },
    {
      id: 3,
      name: "大蝴蝶结羊",
      reward: "单局带出2大金",
      icon: "✨",
      image: "/assets/doll3.png",
      x: 61,
      y: 56,
      size: 92,
      stock: 999999,
      initialStock: 999999,
      unlimited: true
    },
    {
      id: 4,
      name: "蓝帽兔兔羊",
      reward: "古城3局",
      icon: "🏰",
      image: "/assets/doll4.png",
      x: 81,
      y: 51,
      size: 88,
      stock: 999999,
      initialStock: 999999,
      unlimited: true
    },
    {
      id: 5,
      name: "星星奶昔羊",
      reward: "本单累计带出100w",
      icon: "🎁",
      image: "/assets/doll5.png",
      x: 22,
      y: 75,
      size: 94,
      stock: 999999,
      initialStock: 999999,
      unlimited: true
    },
    {
      id: 6,
      name: "勋章羊",
      reward: "大剑（100w）",
      icon: "⚔️",
      image: "/assets/doll6.png",
      x: 43,
      y: 72,
      size: 86,
      stock: 999999,
      initialStock: 999999,
      unlimited: true
    },
    {
      id: 7,
      name: "牛奶盒羊",
      reward: "噩梦2局",
      icon: "👾",
      image: "/assets/doll7.png",
      x: 64,
      y: 76,
      size: 90,
      stock: 999999,
      initialStock: 999999,
      unlimited: true
    },
    {
      id: 8,
      name: "公主底座羊",
      reward: "圣杯（150w）",
      icon: "🏆",
      image: "/assets/doll8.png",
      x: 82,
      y: 73,
      size: 94,
      stock: 999999,
      initialStock: 999999,
      unlimited: true
    },
    {
      id: 9,
      name: "马克杯羊",
      reward: "吞金兽（100w）",
      icon: "🐉",
      image: "/assets/doll9.png",
      x: 34,
      y: 89,
      size: 84,
      stock: 999999,
      initialStock: 999999,
      unlimited: true
    },
    {
      id: 10,
      name: "云朵公主羊",
      reward: "炼狱1局",
      icon: "🔥",
      image: "/assets/doll10.png",
      x: 70,
      y: 88,
      size: 84,
      stock: 999999,
      initialStock: 999999,
      unlimited: true
    }
  ],
  codes: [],
  records: []
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}

function csvResponse(csv) {
  return new Response("\ufeff" + csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=koi-claw-records.csv"
    }
  });
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
  const clean = String(input || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  const match = clean.match(/KOI([0-9A-F]{6})/);

  if (!match) return clean;

  return "KOI-" + match[1];
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

async function getDb(env) {
  if (!env.KOI_CLAW_DB) {
    throw new Error("KV 未绑定：KOI_CLAW_DB");
  }

  let db = await env.KOI_CLAW_DB.get("db", { type: "json" });

  if (!db) {
    db = cloneDefaultDb();
    await env.KOI_CLAW_DB.put("db", JSON.stringify(db));
  }

  db.codes = Array.isArray(db.codes) ? db.codes : [];
  db.records = Array.isArray(db.records) ? db.records : [];
  db.dolls = Array.isArray(db.dolls) ? db.dolls : cloneDefaultDb().dolls;

  db = forceUnlimitedStock(db);

  await env.KOI_CLAW_DB.put("db", JSON.stringify(db));

  return db;
}

async function saveDb(env, db) {
  await env.KOI_CLAW_DB.put("db", JSON.stringify(db));
}

function remaining(code) {
  return Math.max(0, Number(code.total || 0) - Number(code.used || 0));
}

function makeCode() {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);

  const hex = [...bytes]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

  return "KOI-" + hex;
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

async function readBody(request) {
  try {
    return await request.json();
  } catch (e) {
    return {};
  }
}

function getRoute(request) {
  const url = new URL(request.url);
  return url.pathname.replace(/^\/api\/?/, "").replace(/^\/+/, "");
}

export async function onRequest(context) {
  const { request, env } = context;

  try {
    const method = request.method;
    const route = getRoute(request);
    const db = await getDb(env);

    if (method === "GET" && route === "config") {
      return json(200, {
        ok: true,
        dolls: db.dolls.map(publicDoll)
      });
    }

    if (method === "POST" && route === "verify") {
      const body = await readBody(request);
      const codeText = normalizeCode(body.code);

      const found = db.codes.find(c => normalizeCode(c.code) === codeText);

      if (!found) {
        return json(404, {
          ok: false,
          error: "兑换码不存在"
        });
      }

      if (remaining(found) <= 0) {
        return json(400, {
          ok: false,
          error: "兑换码次数已用完"
        });
      }

      return json(200, {
        ok: true,
        code: found.code,
        remaining: remaining(found)
      });
    }

    if (method === "POST" && route === "catch") {
      const body = await readBody(request);
      const codeText = normalizeCode(body.code);
      const clawX = Math.max(10, Math.min(90, Number(body.clawX || 50)));

      const code = db.codes.find(c => normalizeCode(c.code) === codeText);

      if (!code) {
        return json(404, {
          ok: false,
          error: "兑换码不存在"
        });
      }

      if (remaining(code) <= 0) {
        return json(400, {
          ok: false,
          error: "兑换码次数已用完"
        });
      }

      const nowMs = Date.now();

      if (Number(code.lockedUntil || 0) > nowMs) {
        return json(429, {
          ok: false,
          error: "正在抓取中，请不要重复点击"
        });
      }

      code.lockedUntil = nowMs + 15000;
      await saveDb(env, db);

      const available = db.dolls.filter(d => d.unlimited || Number(d.stock) > 0);

      if (!available.length) {
        code.lockedUntil = 0;
        await saveDb(env, db);

        return json(400, {
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
        await saveDb(env, db);

        return json(400, {
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

      await saveDb(env, db);

      return json(200, {
        ok: true,
        result: record,
        remaining: remaining(code),
        dolls: db.dolls.map(publicDoll)
      });
    }

    if (method === "GET" && route === "admin/codes") {
      return json(200, {
        ok: true,
        codes: db.codes.map(c => ({
          ...c,
          remaining: remaining(c)
        }))
      });
    }

    if (method === "POST" && route === "admin/codes") {
      const body = await readBody(request);

      const count = Math.max(1, Math.min(100, Number(body.count || 1)));
      const total = Math.max(1, Math.min(99, Number(body.total || 1)));
      const pay = String(body.pay || "6.1");

      const made = [];

      for (let i = 0; i < count; i++) {
        let code = makeCode();

        while (db.codes.some(c => normalizeCode(c.code) === normalizeCode(code))) {
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

      await saveDb(env, db);

      return json(200, {
        ok: true,
        codes: made
      });
    }

    if (method === "GET" && route === "admin/records") {
      return json(200, {
        ok: true,
        records: db.records
      });
    }

    const markMatch = route.match(/^admin\/records\/(.+)\/status$/);

    if (method === "POST" && markMatch) {
      const body = await readBody(request);
      const record = db.records.find(r => r.id === markMatch[1]);

      if (!record) {
        return json(404, {
          ok: false,
          error: "记录不存在"
        });
      }

      record.status = String(body.status || "已发放");

      await saveDb(env, db);

      return json(200, {
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
      return json(200, {
        ok: true,
        dolls: db.dolls
      });
    }

    if (method === "POST" && route === "admin/reset-stock") {
      db.dolls = db.dolls.map(d => ({
        ...d,
        unlimited: true,
        stock: 999999,
        initialStock: 999999
      }));

      await saveDb(env, db);

      return json(200, {
        ok: true,
        dolls: db.dolls
      });
    }

    return json(404, {
      ok: false,
      error: "接口不存在",
      route
    });
  } catch (error) {
    return json(500, {
      ok: false,
      error: error.message || "服务器错误"
    });
  }
}
