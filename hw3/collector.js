(() => {
    const ENDPOINT = '/json/events';
    const sessionId = crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + Math.random());
    const page = location.pathname + location.search + location.hash;

    const pushEvt = (type, payload) => {
        fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, type, ts: Date.now(), page, payload})
        });
    };

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