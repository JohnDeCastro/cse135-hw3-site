// ---------- core deps ----------
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

// ---------- app setup ----------
const app = express();
app.use(cors());
app.use(express.json());

// ---------- deterministic env loading ----------
const ENV_CANDIDATES = [
  '/etc/hw3-api.env',                // server override (not in git)
  path.join(__dirname, '.env'),      // local copy (copied from /etc if you did that)
];

let loadedFrom = null;
for (const p of ENV_CANDIDATES) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p, override: true });
    loadedFrom = p;
    console.log(`Loaded environment from ${p}`);
    break;
  }
}
if (!loadedFrom) {
  console.warn('WARN: No env file found; relying on process env only');
}

// ---------- single pool config (so we can log exactly what we dial) ----------
const poolConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 25060),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  connectionLimit: 5,
  ssl: {
    ca: fs.readFileSync(path.join(__dirname, 'ca-certificate.crt')),
    rejectUnauthorized: true
  }
};
console.log('MySQL pool config (redacted):', {
  host: poolConfig.host,
  port: poolConfig.port,
  user: poolConfig.user,
  database: poolConfig.database,
  hasPass: !!poolConfig.password
});

// ---------- pool + query helper ----------
const pool = mysql.createPool(poolConfig);
async function q(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

// make q() available to routers
app.locals.q = q;

// ---------- diagnostics ----------
app.get('/debug/db', async (req, res) => {
  try {
    const rows = await q('SELECT 1 AS ok');
    res.json({
      env: {
        loadedFrom,
        host: poolConfig.host,
        port: poolConfig.port,
        user: poolConfig.user,
        name: poolConfig.database,
        hasPass: !!poolConfig.password
      },
      test: rows
    });
  } catch (e) {
    res.status(500).json({
      env: {
        loadedFrom,
        host: poolConfig.host,
        port: poolConfig.port,
        user: poolConfig.user,
        name: poolConfig.database,
        hasPass: !!poolConfig.password
      },
      error: e.message || String(e),
      code: e.code,
      address: e.address,
      port: e.port,
      stack: e.stack
    });
  }
});

// ---------- analytics router (MySQL version) ----------
const analyticsRouter = require('./routes/analytics'); // your current MySQL-based router
app.use('/api/analytics', analyticsRouter);
app.use('/analytics', analyticsRouter);

// ---------- CRUD endpoints already used by collector ----------
app.get('/static', async (_req, res) => {
  res.json(await q('SELECT * FROM static ORDER BY id DESC LIMIT 500'));
});
app.get('/static/:id', async (req, res) => {
  const rows = await q('SELECT * FROM static WHERE id=?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});
app.post('/static', async (req, res) => {
  const b = req.body || {};
  const result = await q(
    `INSERT INTO static (sessionId,ua,lang,cookies,jsEnabled,cssEnabled,imagesEnabled,screenW,screenH,windowW,windowH,connection,page,ts)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      b.sessionId, b.ua, b.lang, !!b.cookies, !!b.jsEnabled, !!b.cssEnabled, !!b.imagesEnabled,
      b.screen?.w ?? null, b.screen?.h ?? null, b.window?.w ?? null, b.window?.h ?? null,
      b.connection ?? null, b.page ?? null, b.ts ?? Date.now()
    ]
  );
  res.status(201).json({ id: result.insertId });
});
app.put('/static/:id', async (req, res) => {
  const b = req.body || {};
  await q(
    `UPDATE static SET page=?, ts=? WHERE id=?`,
    [b.page ?? null, b.ts ?? Date.now(), req.params.id]
  );
  res.json({ ok: true });
});
app.delete('/static/:id', async (req, res) => {
  await q(`DELETE FROM static WHERE id=?`, [req.params.id]);
  res.json({ ok: true });
});

// performance
app.get('/perf', async (_req, res) => {
  res.json(await q('SELECT * FROM performance ORDER BY id DESC LIMIT 500'));
});
app.post('/perf', async (req, res) => {
  const b = req.body || {};
  const result = await q(
    `INSERT INTO performance (sessionId,page,start_ms,end_ms,total_ms,raw,ts)
     VALUES (?,?,?,?,?,?,?)`,
    [b.sessionId, b.page, b.start, b.end, b.total, JSON.stringify(b.timing || {}), b.ts ?? Date.now()]
  );
  res.status(201).json({ id: result.insertId });
});

// activity
app.get('/activity', async (_req, res) => {
  res.json(await q('SELECT * FROM activity ORDER BY id DESC LIMIT 1000'));
});
app.post('/activity', async (req, res) => {
  const b = req.body || {};
  let btn = null;
  if (typeof b.button === 'number') btn = b.button;
  else if (typeof b.button === 'string') {
    const map = { left: 0, middle: 1, right: 2 };
    btn = map[b.button.toLowerCase()] ?? null;
  }
  const result = await q(
    `INSERT INTO activity (sessionId,page,kind,subtype,x,y,button,scrollX,scrollY,keyText,idleDurationMs,msg,stack,ts)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      b.sessionId, b.page, b.kind, (b.type || b.subtype || null),
      (b.x ?? null), (b.y ?? null), btn,
      (b.scrollX ?? null), (b.scrollY ?? null),
      (b.key || b.keyText || null),
      (b.durationMs ?? b.idleDurationMs ?? null),
      (b.msg ?? null), (b.stack ?? null),
      (b.ts || Date.now())
    ]
  );
  res.status(201).json({ id: result.insertId });
});

// unified ingest for collector (/json/events)
app.post('/json/events', async (req, res) => {
  try {
    const b = req.body || {};
    const type = b.type;
    if (!type) return res.status(400).json({ error: 'missing type' });

    if (type === 'static') {
      const p = b.payload || {};
      const r = await q(
        `INSERT INTO static (sessionId,ua,lang,cookies,jsEnabled,cssEnabled,imagesEnabled,screenW,screenH,windowW,windowH,connection,page,ts)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          b.sessionId, p.ua, p.lang, !!p.cookies, !!p.jsEnabled, !!p.cssEnabled, !!p.imagesEnabled,
          p.screen?.w ?? null, p.screen?.h ?? null, p.window?.w ?? null, p.window?.h ?? null,
          p.connection ?? null, b.page ?? null, b.ts ?? Date.now()
        ]
      );
      return res.status(201).json({ id: r.insertId, ok: true });
    }

    if (type === 'perf') {
      const p = b.payload || {};
      const r = await q(
        `INSERT INTO performance (sessionId,page,start_ms,end_ms,total_ms,raw,ts)
         VALUES (?,?,?,?,?,?,?)`,
        [b.sessionId, b.page, p.start ?? null, p.end ?? null, p.total ?? null, JSON.stringify(p.timing || {}), b.ts ?? Date.now()]
      );
      return res.status(201).json({ id: r.insertId, ok: true });
    }

    if (type === 'activity') {
      const p = b.payload || {};
      let btn = null;
      if (typeof p.button === 'number') btn = p.button;
      else if (typeof p.button === 'string') {
        const map = { left: 0, middle: 1, right: 2 };
        btn = map[p.button.toLowerCase()] ?? null;
      }
      const r = await q(
        `INSERT INTO activity (sessionId,page,kind,subtype,x,y,button,scrollX,scrollY,keyText,idleDurationMs,msg,stack,ts)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          b.sessionId,
          b.page,
          p.kind ?? null,
          (p.type ?? p.subtype ?? null),
          (p.x ?? null),
          (p.y ?? null),
          btn,
          (p.scrollX ?? null),
          (p.scrollY ?? null),
          (p.key ?? p.keyText ?? null),
          (p.durationMs ?? p.idleDurationMs ?? null),
          (p.msg ?? null),
          (p.stack ?? null),
          b.ts ?? Date.now()
        ]
      );
      return res.status(201).json({ id: r.insertId, ok: true });
    }

    return res.status(400).json({ error: 'unknown event type' });
  } catch (e) {
    console.error('ingest error', e);
    return res.status(500).json({ error: 'server error' });
  }
});

// ---------- health ----------
app.get('/health', (_req, res) => res.json({ ok: true }));

// ---------- listen ----------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log('API listening on :' + PORT));
