import { useEffect, useState } from 'react';


export function useColorScheme(): 'light' | 'dark' {
    const [scheme, setScheme] = useState<'light' | 'dark'>(() => {
        if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    });

    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => {
            setScheme(e.matches ? 'dark' : 'light');
        };
        mq.addEventListener('change', handler);
        return () => {
            mq.removeEventListener('change', handler);
        };
    }, []);

    return scheme;
}
