// api/routes/analytics.js
const express = require('express');
const router = express.Router();

// Attach q() from parent app
router.use((req, _res, next) => {
  if (!req.app.locals?.q) return next(new Error('q() missing on app.locals'));
  router.q = req.app.locals.q;
  next();
});
const q = (...args) => router.q(...args);

// PAGEVIEWS (performance table: one row per page load)
// GET /api/analytics/pageviews?since=YYYY-MM-DD&groupBy=day|hour
router.get('/pageviews', async (req, res) => {
  const since = req.query.since || new Date(Date.now() - 14 * 86400e3).toISOString().slice(0,10);
  const groupBy = (req.query.groupBy || 'day').toLowerCase();
  const bucketSql = (groupBy === 'hour')
    ? "DATE_FORMAT(FROM_UNIXTIME(ts/1000), '%Y-%m-%d %H:00:00')"
    : "DATE(FROM_UNIXTIME(ts/1000))";
  const rows = await q(
    `SELECT ${bucketSql} AS bucket, COUNT(*) AS cnt
       FROM performance
      WHERE FROM_UNIXTIME(ts/1000) >= ?
   GROUP BY bucket
   ORDER BY bucket`, [since]
  );
  res.json({
    points: rows.map(r => ({
      date: (groupBy === 'day') ? String(r.bucket).slice(0,10) : undefined,
      ts: r.bucket,
      count: Number(r.cnt)
    }))
  });
});

// TOP ROUTES (most loaded pages)
// GET /api/analytics/top-routes?since=YYYY-MM-DD&limit=10
router.get('/top-routes', async (req, res) => {
  const since = req.query.since || new Date(Date.now() - 7 * 86400e3).toISOString().slice(0,10);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || '10', 10)));
  const rows = await q(
    `SELECT page AS route, COUNT(*) AS hits
       FROM performance
      WHERE FROM_UNIXTIME(ts/1000) >= ?
   GROUP BY page
   ORDER BY hits DESC
      LIMIT ?`, [since, limit]
  );
  res.json({ routes: rows.map(r => ({ route: r.route || '(unknown)', hits: Number(r.hits) })) });
});

// ERRORS (activity.kind='error')
// GET /api/analytics/errors?since=YYYY-MM-DD
router.get('/errors', async (req, res) => {
  const since = req.query.since || new Date(Date.now() - 1 * 86400e3).toISOString().slice(0,10);
  const flat = await q(
    `SELECT page AS endpoint,
            COUNT(*) AS cnt,
            MAX(FROM_UNIXTIME(ts/1000)) AS lastSeen
       FROM activity
      WHERE kind='error' AND FROM_UNIXTIME(ts/1000) >= ?
   GROUP BY endpoint
   ORDER BY cnt DESC`, [since]
  );
  const agg = await q(
    `SELECT page AS endpoint,
            COUNT(*) AS totalErrors,
            MAX(FROM_UNIXTIME(ts/1000)) AS lastSeen
       FROM activity
      WHERE kind='error' AND FROM_UNIXTIME(ts/1000) >= ?
   GROUP BY endpoint
   ORDER BY totalErrors DESC`, [since]
  );
  res.json({
    errors: flat.map(r => ({
      endpoint: r.endpoint || '(unknown)',
      status: '—',
      count: Number(r.cnt),
      lastSeen: r.lastSeen
    })),
    rows: agg.map(r => ({
      endpoint: r.endpoint || '(unknown)',
      '4xx': 0, '5xx': 0,
      totalErrors: Number(r.totalErrors),
      lastSeen: r.lastSeen
    }))
  });
});

// ERROR RATE (errors/hour ÷ pageviews/hour)
// GET /api/analytics/error-rate?since=YYYY-MM-DD&groupBy=hour|day
router.get('/error-rate', async (req, res) => {
  const since = req.query.since || new Date(Date.now() - 7 * 86400e3).toISOString().slice(0,10);
  const groupBy = (req.query.groupBy || 'hour').toLowerCase();
  const bucketFmt = (groupBy === 'day') ? '%Y-%m-%d 00:00:00' : '%Y-%m-%d %H:00:00';

  const views = await q(
    `SELECT DATE_FORMAT(FROM_UNIXTIME(ts/1000), ?) AS bucket, COUNT(*) AS total
       FROM performance
      WHERE FROM_UNIXTIME(ts/1000) >= ?
   GROUP BY bucket
   ORDER BY bucket`, [bucketFmt, since]
  );

  const errs = await q(
    `SELECT DATE_FORMAT(FROM_UNIXTIME(ts/1000), ?) AS bucket, COUNT(*) AS errors
       FROM activity
      WHERE kind='error' AND FROM_UNIXTIME(ts/1000) >= ?
   GROUP BY bucket
   ORDER BY bucket`, [bucketFmt, since]
  );

  const map = new Map();
  for (const v of views) map.set(v.bucket, { ts: v.bucket, total: Number(v.total), errors: 0 });
  for (const e of errs) {
    const row = map.get(e.bucket) || { ts: e.bucket, total: 0, errors: 0 };
    row.errors += Number(e.errors);
    map.set(e.bucket, row);
  }
  res.json({ points: Array.from(map.values()) });
});

module.exports = router;

