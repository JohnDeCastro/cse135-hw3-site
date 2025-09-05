// api/routes/analytics.js (MySQL-optimized)
const express = require('express');
const router = express.Router();

// Attach q() from parent app (mysql2/promise)
router.use((req, _res, next) => {
  if (!req.app.locals?.q) return next(new Error('q() missing on app.locals'));
  router.q = req.app.locals.q;
  next();
});
const q = (...args) => router.q(...args);

// helper: YYYY-MM-DD -> unix millis bound
const sinceToMillis = (s) => `UNIX_TIMESTAMP(${router.q.escape(s)}) * 1000`;

// PAGEVIEWS — GET /api/analytics/pageviews?since=YYYY-MM-DD&groupBy=day|hour
router.get('/pageviews', async (req, res, next) => {
  try {
    const since = req.query.since || new Date(Date.now() - 14 * 86400e3).toISOString().slice(0, 10);
    const groupBy = (req.query.groupBy || 'day').toLowerCase();

    // Build once to avoid function-on-column in WHERE
    const rows = await q(
      groupBy === 'hour'
        ? `
          SELECT
            FROM_UNIXTIME(FLOOR(ts/1000/3600)*3600) AS bucket,
            COUNT(*) AS cnt
          FROM performance
          WHERE ts >= UNIX_TIMESTAMP(?) * 1000
          GROUP BY bucket
          ORDER BY bucket
          `
        : `
          SELECT
            DATE(FROM_UNIXTIME(ts/1000)) AS bucket,
            COUNT(*) AS cnt
          FROM performance
          WHERE ts >= UNIX_TIMESTAMP(?) * 1000
          GROUP BY bucket
          ORDER BY bucket
          `,
      [since]
    );

    res.json({
      points: rows.map(r => ({
        date: String(r.bucket).slice(0,10),
        ts: r.bucket,
        count: Number(r.cnt)
      }))
    });
  } catch (e) { next(e); }
});

// TOP ROUTES — GET /api/analytics/top-routes?since=YYYY-MM-DD&limit=10
router.get('/top-routes', async (req, res, next) => {
  try {
    const since = req.query.since || new Date(Date.now() - 7 * 86400e3).toISOString().slice(0, 10);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || '10', 10)));

    const rows = await q(
      `
      SELECT page AS route, COUNT(*) AS hits
      FROM performance
      WHERE ts >= UNIX_TIMESTAMP(?) * 1000
      GROUP BY page
      ORDER BY hits DESC
      LIMIT ?
      `,
      [since, limit]
    );

    res.json({ routes: rows.map(r => ({ route: r.route || '(unknown)', hits: Number(r.hits) })) });
  } catch (e) { next(e); }
});

// ERRORS (activity.kind='error') — GET /api/analytics/errors?since=YYYY-MM-DD
router.get('/errors', async (req, res, next) => {
  try {
    const since = req.query.since || new Date(Date.now() - 1 * 86400e3).toISOString().slice(0,10);

    const flat = await q(
      `
      SELECT page AS endpoint,
             COUNT(*) AS cnt,
             MAX(FROM_UNIXTIME(ts/1000)) AS lastSeen
      FROM activity
      WHERE kind='error' AND ts >= UNIX_TIMESTAMP(?) * 1000
      GROUP BY endpoint
      ORDER BY cnt DESC
      LIMIT 200
      `,
      [since]
    );

    const agg = await q(
      `
      SELECT page AS endpoint,
             COUNT(*) AS totalErrors,
             MAX(FROM_UNIXTIME(ts/1000)) AS lastSeen
      FROM activity
      WHERE kind='error' AND ts >= UNIX_TIMESTAMP(?) * 1000
      GROUP BY endpoint
      ORDER BY totalErrors DESC
      LIMIT 200
      `,
      [since]
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
  } catch (e) { next(e); }
});

// ERROR RATE — GET /api/analytics/error-rate?since=YYYY-MM-DD&groupBy=hour|day
router.get('/error-rate', async (req, res, next) => {
  try {
    const since = req.query.since || new Date(Date.now() - 7 * 86400e3).toISOString().slice(0,10);
    const groupBy = (req.query.groupBy || 'hour').toLowerCase();

    // Views buckets
    const views = await q(
      groupBy === 'day'
        ? `
          SELECT DATE(FROM_UNIXTIME(ts/1000)) AS bucket, COUNT(*) AS total
          FROM performance
          WHERE ts >= UNIX_TIMESTAMP(?) * 1000
          GROUP BY bucket
          ORDER BY bucket
          `
        : `
          SELECT FROM_UNIXTIME(FLOOR(ts/1000/3600)*3600) AS bucket, COUNT(*) AS total
          FROM performance
          WHERE ts >= UNIX_TIMESTAMP(?) * 1000
          GROUP BY bucket
          ORDER BY bucket
          `,
      [since]
    );

    // Error buckets
    const errs = await q(
      groupBy === 'day'
        ? `
          SELECT DATE(FROM_UNIXTIME(ts/1000)) AS bucket, COUNT(*) AS errors
          FROM activity
          WHERE kind='error' AND ts >= UNIX_TIMESTAMP(?) * 1000
          GROUP BY bucket
          ORDER BY bucket
          `
        : `
          SELECT FROM_UNIXTIME(FLOOR(ts/1000/3600)*3600) AS bucket, COUNT(*) AS errors
          FROM activity
          WHERE kind='error' AND ts >= UNIX_TIMESTAMP(?) * 1000
          GROUP BY bucket
          ORDER BY bucket
          `,
      [since]
    );

    const map = new Map();
    for (const v of views) map.set(String(v.bucket), { ts: v.bucket, total: Number(v.total), errors: 0 });
    for (const e of errs) {
      const key = String(e.bucket);
      const row = map.get(key) || { ts: e.bucket, total: 0, errors: 0 };
      row.errors += Number(e.errors);
      map.set(key, row);
    }
    res.json({ points: Array.from(map.values()) });
  } catch (e) { next(e); }
});

module.exports = router;