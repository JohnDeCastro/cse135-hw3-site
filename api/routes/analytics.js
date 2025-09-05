// api/routes/analytics.js
const express = require('express');
const router = express.Router();

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function q(sql, params) {
  return pool.query(sql, params).then(r => r.rows);
}

// /api/analytics/pageviews?since=YYYY-MM-DD&groupBy=day
router.get('/pageviews', async (req, res) => {
  const since = req.query.since || new Date(Date.now()-14*86400e3).toISOString().slice(0,10);
  const groupBy = req.query.groupBy || 'day';
  let dateExpr = "DATE(ts)";
  if (groupBy === 'hour') dateExpr = "DATE_TRUNC('hour', ts)";
  if (groupBy === 'day')  dateExpr = "DATE(ts)";

  const rows = await q(
    `SELECT ${dateExpr} AS bucket, COUNT(*)::int AS count
       FROM events
      WHERE ts >= $1
   GROUP BY 1
   ORDER BY 1`,
    [since]
  );
  res.json({ points: rows.map(r => ({
    date: (groupBy==='day') ? String(r.bucket).slice(0,10) : r.bucket,
    ts: r.bucket, count: r.count
  }))});
});

// /api/analytics/top-routes?since=YYYY-MM-DD&limit=10
router.get('/top-routes', async (req, res) => {
  const since = req.query.since || new Date(Date.now()-7*86400e3).toISOString().slice(0,10);
  const limit = parseInt(req.query.limit||'10',10);
  const rows = await q(
    `SELECT path AS route, COUNT(*)::int AS hits
       FROM events
      WHERE ts >= $1
   GROUP BY path
   ORDER BY hits DESC
      LIMIT $2`,
    [since, limit]
  );
  res.json({ routes: rows });
});

// /api/analytics/errors?since=YYYY-MM-DD
// return either a flat list for dashboard grid or aggregated by endpoint for report
router.get('/errors', async (req, res) => {
  const since = req.query.since || new Date(Date.now()-1*86400e3).toISOString().slice(0,10);

  // for dashboard grid recent errors list
  const flat = await q(
    `SELECT path AS endpoint,
            status::int AS status,
            COUNT(*)::int AS count,
            MAX(ts) AS lastSeen
       FROM events
      WHERE ts >= $1 AND status >= 400
   GROUP BY endpoint, status
   ORDER BY count DESC`,
    [since]
  );

  // for report table 7-day breakdown 4xx vs 5xx
  const agg = await q(
    `SELECT path AS endpoint,
            COUNT(*) FILTER (WHERE status BETWEEN 400 AND 499)::int AS "4xx",
            COUNT(*) FILTER (WHERE status >= 500)::int AS "5xx",
            COUNT(*)::int AS totalErrors,
            MAX(ts) AS lastSeen
       FROM events
      WHERE ts >= $1 AND status >= 400
   GROUP BY endpoint
   ORDER BY totalErrors DESC`,
    [since]
  );

  res.json({ errors: flat, rows: agg });
});

// /api/analytics/error-rate?since=YYYY-MM-DD&groupBy=hour
router.get('/error-rate', async (req, res) => {
  const since = req.query.since || new Date(Date.now()-7*86400e3).toISOString().slice(0,10);
  const groupBy = req.query.groupBy || 'hour';
  let bucketExpr = "DATE_TRUNC('hour', ts)";
  if (groupBy === 'day') bucketExpr = "DATE(ts)";

  const rows = await q(
    `WITH buckets AS (
        SELECT ${bucketExpr} AS bucket,
               COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE status >= 400)::int AS errors
          FROM events
         WHERE ts >= $1
      GROUP BY 1
    )
    SELECT bucket, total, errors FROM buckets ORDER BY bucket`,
    [since]
  );
  res.json({ points: rows.map(r => ({ ts: r.bucket, total: r.total, errors: r.errors })) });
});

module.exports = router;
