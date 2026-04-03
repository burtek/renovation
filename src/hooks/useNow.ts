import { useEffect, useState } from 'react';


const REFRESH_INTERVAL_MS = 60_000; // 1 minute

/**
 * Returns the current timestamp (ms since epoch).
 * Refreshes automatically every minute and whenever the browser tab regains focus.
 */
export function useNow(): number {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const refresh = () => {
            setNow(Date.now());
        };

        const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
        document.addEventListener('visibilitychange', refresh);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, []);

    return now;
}
