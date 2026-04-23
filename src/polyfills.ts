// Promise.withResolvers is ES2024 — polyfill for browsers that don't yet support it
// (Chrome < 119, Firefox < 121, Safari < 17).
if (!('withResolvers' in Promise)) {
    Object.defineProperty(Promise, 'withResolvers', {
        configurable: true,
        writable: true,
        value: function withResolvers<T>() {
            let resolve!: (value: T | PromiseLike<T>) => void;
            let reject!: (reason?: unknown) => void;
            const promise = new Promise<T>((res, rej) => {
                resolve = res;
                reject = rej;
            });
            return { promise, resolve, reject };
        }
    });
}
