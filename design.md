# TLS Trainer — Design System

## Identity
- **App:** Transponder Landing System Training Portal
- **Audience:** RSAF Ground Radar Technicians
- **Vibe:** Military-grade, dark, cinematic, radar/tech aesthetic

## Colors
```
--bg-primary:     #050a12       /* deep navy black */
--bg-card:        #0b1220       /* dark card surface */
--bg-elevated:    #0f1a2e       /* slightly lighter surface */
--accent-blue:    #1e90ff       /* electric blue - primary accent */
--accent-cyan:    #00d4ff       /* cyan glow */
--accent-glow:    #0057b8       /* darker blue for borders */
--text-primary:   #e8f4fd       /* near-white */
--text-secondary: #7a9bb8       /* muted blue-grey */
--text-muted:     #3d5a73       /* dimmed text */
--danger:         #ff3b3b
--success:        #00ff88
--warning:        #ffaa00
```

## Typography
- **Font:** `'Orbitron', 'Rajdhani', sans-serif` — techy, military feel
- Display: Orbitron Bold
- Body: Rajdhani Medium
- Fallback: system-ui

## Layout
- Mobile-first, full-bleed dark backgrounds
- Bottom nav bar (5 tabs)
- Card surfaces with subtle blue-glow borders
- Radar grid CSS overlay on hero sections
- Animated scan-line on hero

## Effects
- `box-shadow: 0 0 20px rgba(30,144,255,0.3)` — blue glow on active elements
- Radar grid: repeating CSS lines at 40px
- Scan line: animated top-to-bottom opacity sweep
- Glassmorphism cards: `background: rgba(11,18,32,0.8); backdrop-filter: blur(10px)`

## Pages
1. **/** — Home: hero with TLS device bg, profile card (avatar + name + contact), stats strip, quick access
2. **/modules** — Training modules grid
3. **/achievements** — Badges & progress
4. **/chat** — Private message channel to instructor
5. **/card** — Full profile/ID card page

## User Info
- Name: Ayidh A. Alahmari
- Role: RSAF Ground Radar Systems Technician | ANPC Certified
- Email: ksa2030@inbox.ru
- Phone: +966594566660
- Location: Saudi Arabia — Jeddah
