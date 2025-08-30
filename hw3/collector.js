(() => {
    // buffered sending with retry (per-event POSTs for json-server)
    const ENDPOINT = '/json/events';            
    const BUF_KEY  = 'analytics-buffer';

    // load/save queue
    const loadBuf  = () => JSON.parse(localStorage.getItem(BUF_KEY) || '[]');
    const saveBuf  = (arr) => localStorage.setItem(BUF_KEY, JSON.stringify(arr));

    // enqueue-only push
    function pushEvt(type, payload) {
        const evt = {
            sessionId: (window.__SESSION_ID ||= (sessionStorage.getItem('sid') || (()=>{
                const s = (crypto.randomUUID?.() || (Date.now()+'-'+Math.random().toString(16).slice(2)));
                try { sessionStorage.setItem('sid', s); } catch {}
                return s;
            })())),
            type,
            ts: Date.now(),
            page: location.pathname + location.search + location.hash,
            payload
        };
        const q = loadBuf(); q.push(evt); saveBuf(q);
    }

    // send 1 event (json-server expects single object)
    async function sendOne(event) {
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
        });
        return res.ok;
    }

    // flush in small chunks (posts individually)
    async function flush(limit = 25, useBeacon = false) {
        let q = loadBuf();
        if (!q.length) return;

        // If we can use sendBeacon (on hide/unload), send items individually
        if (useBeacon && navigator.sendBeacon) {
            const toSend = q.slice(0, limit);
            // optimistic remove
            saveBuf(q.slice(limit));
            let failed = [];
            for (const ev of toSend) {
                const ok = navigator.sendBeacon(ENDPOINT, new Blob([JSON.stringify(ev)], { type: 'application/json' }));
                if (!ok) failed.push(ev);
            }
            // re-queue failed
            if (failed.length) saveBuf(failed.concat(loadBuf()));
            return;
        }

        // normal flush with fetch
        const toSend = q.slice(0, limit);
        // optimistic remove
        saveBuf(q.slice(limit));
        let failed = [];
        for (const ev of toSend) {
            try {
                const ok = await sendOne(ev);
                if (!ok) failed.push(ev);
            } catch {
                failed.push(ev);
            }
        }
        if (failed.length) saveBuf(failed.concat(loadBuf()));
    }

    // periodic + lifecycle flushes
    setInterval(() => { flush(25, false); }, 5000);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush(50, true);
    });
    window.addEventListener('beforeunload', () => { flush(50, true); });

    // manual CSS and images detection
    (function() {
        // CSS: create element, style via JS, and esnure style application
        const el = document.createElement('div');
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        el.style.width = '10px';
        document.body.appendChild(el);
        const cssEnabled = getComputedStyle(el).width === '10px';
        document.body.removeChild(el);

        // Images: attemp to load tiny 1x1 data image
        const imgTest = new Image();
        let imagesEnabled = true;
        imgTest.onerror = () => { imagesEnabled = false; pushEvt('static', { featureProbe: 'images', imagesEnabled }); };
        imgTest.onload  = () => { imagesEnabled = true;  pushEvt('static', { featureProbe: 'images', imagesEnabled }); };
        imgTest.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='; // 1x1 gif

        // explicit JS flag (collector exists)
        const jsEnabled = true;

        // record snapshot
        pushEvt('static', { featureProbe: 'css/js', cssEnabled, jsEnabled });
    })();


    // static
    window.addEventListener('load', () => {
        pushEvt('static', {
            ua: navigator.userAgent,
            lang: navigator.language,
            cookies: navigator.cookieEnabled,
            jsEnabled: true,
            cssEnabled: true,
            imagesEnabled: true,
            screen: { w: screen.width, h: screen.height },
            window: { w: innerWidth, h: innerHeight},
            connection: navigator.connection ? navigator.connection.effectiveType : 'unknown'
        });
    });

    //performance
    window.addEventListener('load', () => {
        const nav = performance.getEntriesByType('navigation')[0];
        pushEvt('perf', {
            start: nav.startTime,
            end: nav.loadEventEnd,
            total: nav.duration,
            timing: nav.toJSON()
        });
    });
    
    //activity ie. mouse movements, clicks, scrolls, etc
    let __lastMove = 0;
    document.addEventListener('mousemove', (e) => {
        const now = Date.now();
        if (now - __lastMove > 200) { __lastMove = now;
            pushEvt('activity', { kind: 'mouse', type: 'move', x: e.clientX, y: e.clientY });
        }
    }, { passove: true });

    document.addEventListener('click', (e) => {
        pushEvt('activity', { kind: 'mouse', type: 'click', x: e.clientX, y: e.clientY, button: e.button });
    }, { passive: true });

    document.addEventListener('scroll', () => {
        pushEvt('activity', { kind: 'scroll', x: scrollX, y: scrollY });
    }, { passive: true });

    document.addEventListener('keydown', (e) => {
        pushEvt('activity', { kind: 'key', type: 'down', key: e.key });
    });

    document.addEventListener('keyup', (e) => {
        pushEvt('activity', { kind: 'key', type: 'up', key: e.key });
    });

    //page enter/leave
    pushEvt('activity', { kind: 'page-enter', href: location.href, referrer: document.referrer });
    window.addEventListener('beforeunload', () => {
        pushEvt('activity', { kind: 'page-leave', href: location.href });
    });

    //error logs
    window.onerror = (msg, src, line, col, err) => {
        pushEvt('activity', {
            kind: 'error', msg: String(msg), src, line, col,
            stack: err && err.stack
        });
    };

    //idle detection for 2s
    let __lastActive = Date.now();
    let __idleTimer = null;

    function __bump() {
        const now = Date.now();
        if (__idleTimer) clearTimeout(__idleTimer);
        if (now - __lastActive >= 2000) {
            //user active, record end of idle
            pushEvt('activity', { kind: 'idle-end', durationMs: now - __lastActive, endedAt: now });
        }
        __lastActive = now;
        __idleTimer = setTimeout(() => {
            // 2 sesc no activity, record start of idle
            pushEvt('activity', { kind: 'idle-start', startedAt: Date.now() });
        }, 2000);
    }
    ['mousemove','keydown','keyup','scroll','click','touchstart','touchend']
        .forEach(ev => document.addEventListener(ev, __bump, { passive: true }));
    __bump();

})();