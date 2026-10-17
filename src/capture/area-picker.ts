export function pickArea(signal: AbortSignal): Promise<Element> {
    return new Promise((resolve, reject) => {
        const host = document.createElement('div');

        host.id = 'offshelf-area-picker';
        const shadow = host.attachShadow({ mode: 'closed' });
        const box = document.createElement('div');
        const hint = document.createElement('div');

        box.style.cssText = 'position:fixed;pointer-events:none;border:2px solid #426b54;background:rgba(66,107,84,.07);border-radius:5px;z-index:2147483646;';
        hint.style.cssText = 'position:fixed;top:18px;left:50%;transform:translateX(-50%);padding:13px 20px;background:#1f3027;color:white;border-radius:10px;font:14px/1.4 system-ui;box-shadow:0 4px 25px #0003;z-index:2147483647;pointer-events:none;';
        hint.textContent = 'Offshelf · Click the article area to save it · Esc to cancel';
        shadow.append(box, hint);
        document.documentElement.append(host);
        let target: Element | undefined;
        const move = (event: MouseEvent): void => {
            let element = event.target as Element | null;

            if (!element || element === host)
                return;

            if (['A', 'SPAN', 'STRONG', 'EM', 'CODE'].includes(element.tagName))
                element = element.parentElement ?? element;

            target = element;
            const rect = element.getBoundingClientRect();

            Object.assign(box.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
        };
        const finish = (error?: Error): void => {
            document.removeEventListener('mousemove', move, true);
            document.removeEventListener('click', click, true);
            document.removeEventListener('keydown', keydown, true);
            signal.removeEventListener('abort', abort);
            host.remove();

            if (error)
                reject(error);
            else if (target)
                resolve(target);
            else
                reject(new Error('No area selected.'));
        };
        const click = (event: MouseEvent): void => { event.preventDefault(); event.stopImmediatePropagation(); finish(); };
        const keydown = (event: KeyboardEvent): void => { if (event.key === 'Escape') {
            event.preventDefault();
            finish(new Error('Area selection cancelled.'));
        } };
        const abort = () => finish(new Error('Capture cancelled.'));

        document.addEventListener('mousemove', move, true);
        document.addEventListener('click', click, true);
        document.addEventListener('keydown', keydown, true);
        signal.addEventListener('abort', abort, { once: true });
    });
}
