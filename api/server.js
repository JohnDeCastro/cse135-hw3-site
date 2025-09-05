const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const app = express();
app.use(cors());
app.use(express.json());

// Load environment variables: prefer /etc/hw3-api.env on server,
// fall back to local .env when running in dev (VSCode)
const candidates = [
  '/etc/hw3-api.env',
  path.join(__dirname, '.env'),
];

for (const p of candidates) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p, override: true });
    console.log(`Loaded environment from ${p}`);
    break;
  }
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,          // DO host
  port: process.env.DB_PORT || 25060, // DO port
  user: process.env.DB_USER,          // doadmin
  password: process.env.DB_PASS,      // from DO
  database: process.env.DB_NAME,      // cse135_hw3
  connectionLimit: 5,
  ssl: {
    ca: fs.readFileSync(__dirname + '/ca-certificate.crt'),
    rejectUnauthorized: true
  }
});

async function q(sql, params=[]) {
    const [rows] = await pool.query(sql, params);
    return rows;
}

// make q() available to routers
app.locals.q = q;

// mount analytics router
const analyticsRouter = require('./routes/analytics');
app.use('/api/analytics', analyticsRouter);
app.use('/analytics', analyticsRouter); 

// static
app.get('/static', async (req,res)=> {
    res.json(await q('SELECT * FROM static ORDER BY id DESC LIMIT 500'));
});
app.get('/static/:id', async (req,res)=> {
    const rows = await q('SELECT * FROM static WHERE id=?',[req.params.id]);
    if (!rows.length) return res.status(404).json({error:'not found'});
    res.json(rows[0]);
});
app.post('/static', async (req,res)=> {
    const b = req.body||{};
    const result = await q(
        `INSERT INTO static (sessionId,ua,lang,cookies,jsEnabled,cssEnabled,imagesEnabled,screenW,screenH,windowW,windowH,connection,page,ts)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [b.sessionId,b.ua,b.lang,!!b.cookies,!!b.jsEnabled,!!b.cssEnabled,!!b.imagesEnabled,
        b.screen?.w||null,b.screen?.h||null,b.window?.w||null,b.window?.h||null,
        b.connection||null,b.page||null,b.ts||Date.now()]
    );
    res.status(201).json({id: result.insertId});
});
app.put('/static/:id', async (req,res)=> {
    const b = req.body||{};
    await q(`UPDATE static SET page=?, ts=? WHERE id=?`, [b.page||null, b.ts||Date.now(), req.params.id]);
    res.json({ok:true});
});
app.delete('/static/:id', async (req,res)=> {
    await q(`DELETE FROM static WHERE id=?`, [req.params.id]);
    res.json({ok:true});
});

// performance
app.get('/perf', async (req,res)=> {
    res.json(await q('SELECT * FROM performance ORDER BY id DESC LIMIT 500'));
});
app.post('/perf', async (req,res)=> {
    const b = req.body||{};
    const result = await q(
        `INSERT INTO performance (sessionId,page,start_ms,end_ms,total_ms,raw,ts)
        VALUES (?,?,?,?,?,?,?)`,
        [b.sessionId,b.page,b.start,b.end,b.total,JSON.stringify(b.timing||{}),b.ts||Date.now()]
    );
    res.status(201).json({id: result.insertId});
});

// activity
app.get('/activity', async (req,res)=> {
  res.json(await q('SELECT * FROM activity ORDER BY id DESC LIMIT 1000'));
});

app.post('/activity', async (req,res)=> {
  const b = req.body || {};

  // map button if string like 'left'
  let btn = null;
  if (typeof b.button === 'number') {
    btn = b.button;
  } else if (typeof b.button === 'string') {
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

app.post('/json/events', async (req, res) => {
  try {
    const b = req.body || {};
    const type = b.type;

    if (!type) return res.status(400).json({ error: 'missing type' });

    if (type === 'static') {
      // payload from collector.js 'static' pushes
      const p = b.payload || {};
      const result = await q(
        `INSERT INTO static (sessionId, ua, lang, cookies, jsEnabled, cssEnabled, imagesEnabled, screenW, screenH, windowW, windowH, connection, page, ts)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          b.sessionId, p.ua, p.lang, !!p.cookies, !!p.jsEnabled, !!p.cssEnabled, !!p.imagesEnabled,
          p.screen?.w ?? null, p.screen?.h ?? null, p.window?.w ?? null, p.window?.h ?? null,
          p.connection ?? null, b.page ?? null, b.ts || Date.now()
        ]
      );
      return res.status(201).json({ id: result.insertId, ok: true });
    }

    if (type === 'perf') {
      const p = b.payload || {};
      const result = await q(
        `INSERT INTO performance (sessionId, page, start_ms, end_ms, total_ms, raw, ts)
         VALUES (?,?,?,?,?,?,?)`,
        [
          b.sessionId, b.page,
          p.start ?? null, p.end ?? null, p.total ?? null,
          JSON.stringify(p.timing || {}),
          b.ts || Date.now()
        ]
      );
      return res.status(201).json({ id: result.insertId, ok: true });
    }

    if (type === 'activity') {
      const p = b.payload || {};
      // normalize button
      let btn = null;
      if (typeof p.button === 'number') btn = p.button;
      else if (typeof p.button === 'string') {
        const map = { left: 0, middle: 1, right: 2 };
        btn = map[p.button.toLowerCase()] ?? null;
      }
      const result = await q(
        `INSERT INTO activity (sessionId, page, kind, subtype, x, y, button, scrollX, scrollY, keyText, idleDurationMs, msg, stack, ts)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          b.sessionId,
          b.page,
          p.kind ?? null,
          (p.type ?? p.subtype ?? null),
          (p.x ?? null),
          (p.y ?? null),
          btn,
          (p.x ?? p.scrollX ?? null),
          (p.y ?? p.scrollY ?? null),
          (p.key ?? p.keyText ?? null),
          (p.durationMs ?? p.idleDurationMs ?? null),
          (p.msg ?? null),
          (p.stack ?? null),
          b.ts || Date.now()
        ]
      );
      return res.status(201).json({ id: result.insertId, ok: true });
    }

    // unknown type
    return res.status(400).json({ error: 'unknown event type' });
  } catch (e) {
    console.error('ingest error', e);
    return res.status(500).json({ error: 'server error' });
  }
});

app.get('/health', (_,res)=> res.json({ok:true}));
const PORT = process.env.PORT || 4000;
app.listen(PORT, ()=> console.log('API listening on :' + PORT));