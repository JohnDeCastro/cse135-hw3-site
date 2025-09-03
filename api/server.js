const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json());

require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: +process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  connectionLimit: 5,
  ssl: { minVersion: 'TLSv1.2' }
});



async function q(sql, params=[]) {
    const [rows] = await pool.query(sql, params);
    return rows;
}

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
    const b = req.body||{};
    const result = await q(
        `INSERT INTO activity (sessionId,page,kind,subtype,x,y,button,scrollX,scrollY,keyText,idleDurationMs,msg,stack,ts)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [b.sessionId,b.page,b.kind,b.type||b.subtype||null,
        b.x||null,b.y||null,b.button||null,b.x||null,b.y||null,
        b.key||null,b.durationMs||null,b.msg||null,b.stack||null,b.ts||Date.now()]
    );
    res.status(201).json({id: result.insertId});
});

app.get('/health', (_,res)=> res.json({ok:true}));
const PORT = process.env.PORT || 4000;
app.listen(PORT, ()=> console.log('API listening on :' + PORT));