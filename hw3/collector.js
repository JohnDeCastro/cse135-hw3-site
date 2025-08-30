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

    window.addEventListener('load', () => {
        const nav = performance.getEntriesByType('navigation')[0];
        pushEvt('perf', {
            start: nav.startTime,
            end: nav.loadEventEnd,
            total: nav.duration,
            timing: nav.toJSON()
        });
    });
    
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
})();