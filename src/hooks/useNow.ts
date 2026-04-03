import { useCallback, useEffect, useState } from 'react';


const REFRESH_INTERVAL_MS = 60_000; // 1 minute

/**
 * Returns the current timestamp (ms since epoch).
 * Refreshes automatically every minute and whenever the browser tab regains focus.
 */
export function useNow(): number {
    const [now, setNow] = useState(() => Date.now());

    const refresh = useCallback(() => {
        setNow(Date.now());
    }, []);

    useEffect(() => {
        const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                refresh();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [refresh]);

    return now;
}
