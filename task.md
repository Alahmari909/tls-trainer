# TLS Trainer — production outage (502) + pending video fix

## Outage: ROOT CAUSE FOUND & FIXED
Railway service `@template/web` = **CRASHED** (not a hosting/billing problem; account is fine).

Production log:
```
TypeError: text.replace is not a function
  at row (/app/packages/web/src/api/telegram.ts)
  at buildMessage
  at sendTelegram
```

`esc(text: string)` in `packages/web/src/api/telegram.ts` was typed as string but
receives values straight off JSON request bodies (`/track`), which can be
null / undefined / number / object. The throw became an **unhandled promise
rejection** because nearly every caller is fire-and-forget
(`sendTelegram({...})` — no await, no .catch). There were **zero**
`process.on("unhandledRejection")` handlers in the repo, so Bun killed the
process → Railway 502.

### Fix (branch `fix/telegram-crash`, commit d37afda) — 3 layers
1. `esc()` coerces unknown runtime values; missing renders as em dash. `clip()` added for safe truncation.
2. `sendTelegram()` wraps `buildMessage` in try/catch — can never reject.
   Also fixed `quiz_finish` divide-by-zero and `status_change` `.toUpperCase()` on missing status.
3. `server.ts`: global `unhandledRejection` + `uncaughtException` guards —
   no single fire-and-forget bug can take the site down again.

### Proof captured
- `hero/repro_crash.ts` — before: 6/7 event shapes throw. after: 0/7.
- `hero/probe_fireforget.ts` — fire-and-forget, no await/catch:
  - on `main`: process DIES, exact prod stack `esc → row → buildMessage → sendTelegram`
  - on fix branch: `STILL ALIVE ... process survived`
- `hero/verify_msgs.ts` — all messages still render; MarkdownV2 escaping intact
  (`Test\_1 \(v2\.0\) \[x\] \-done\!`).
- `/tmp/guard_test.ts` — guard survives rogue rejection + sync throw; without guard the process dies.
- Gates: `cd packages/web && bunx tsc --noEmit` rc=0 · `bun run build:web` rc=0.
- Clean-checkout boot of `main` (`d123b2f`) ran fine locally → confirmed code builds/starts; crash is event-triggered at runtime.

## Video fix: DEPLOYED & VERIFIED ON LIVE (merge 08829a1)
Precision Approach autoplay fix merged to main and live in bundle
`main-7x9Nipyc.js`. Merge touched only `index.tsx`; telegram fix intact.

LIVE production proof (`hero/proof_live.log`), real autoplay policy:
- m390:  currentTime 7.06 -> 10.07 MOVING=True · 4/4 distinct pixel hashes ·
         src=tls-precision-720p.mp4 · mutedAttr/autoplayAttr=true ·
         controls=false · fit=contain · playBtn=false
- d1440: currentTime 7.02 -> 10.03 MOVING=True · 4/4 distinct pixel hashes ·
         src=tls-precision-1080p.mp4 · mutedAttr/autoplayAttr=true ·
         controls=false · fit=contain · playBtn=false
All 13 requirements satisfied.

## Notes
- Railway token in `.env.railway` AND the newly supplied one are both rejected
  (`Not Authorized` / `Project Token not found`) — no CLI access to logs from sandbox.
- `start.sh` runs `bun install` + `vite build` on every container start, with
  379MB `static/` + 46MB `public/`. Slow/risky boot; worth moving to build phase later.

## Status: COMPLETE
Site up (200, stable across 5 checks), DB healthy, video playing on live at
both breakpoints. Both fixes deployed.

Outstanding (non-urgent):
- Railway token still unusable from sandbox (`Not Authorized`) — needs a token
  scoped to the workspace owning this project for future log access.
- `start.sh` builds on every container boot (379MB static + 46MB public);
  worth moving to the build phase.
