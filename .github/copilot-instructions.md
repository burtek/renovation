NEVER modify yarn.lock, unless dependencies are updated/added.
ALWAYS use `yarn` rather than `npm` when performing tasks and NEVER allow `npmjs` repo ULRS to sneak into yarn.lock.

After each change, verify the `lint`, `build` and `test` jobs run without error.
Make sure you install dependencies first, so that you don't lose time figuring out why the commands don't work.

ALWAYS name PRs and commits according to conventional commits rules.
