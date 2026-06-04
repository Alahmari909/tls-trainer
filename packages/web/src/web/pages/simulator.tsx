import { useState, useEffect, useRef } from "react";

// ── Real TLS Specs (from PDF) ──────────────────────────────────────────────
const LOC_COURSE_RANGE  = 25;
const LOC_COURSE_ANGLE  = 10;
const LOC_CLEAR_RANGE   = 17;
const LOC_CLEAR_ANGLE   = 35;
const GS_RANGE          = 12;
const GS_AZIMUTH        = 8;
const GLIDE_ANGLE       = 3.0;
const RUNWAY_HEADING    = 310;
const APPROACH_DIR      = (RUNWAY_HEADING + 180) % 360; // 130°
const NM_TO_PX          = 8;
const RADAR_RINGS       = [10, 20, 30, 40, 50, 60, 70];
const SWEEP_SPEED       = 0.55;

const ILS_CHANNELS = [
  { id: "TLS XXXXX 1 A 00", freq: "108.70 MHz", morse: "TLS1", gtuStatus: "OK" },
];

const toRad = d => (d * Math.PI) / 180;
const toDeg = r => (r * 180) / Math.PI;

function polarToCart(range, bearing, scale) {
  const r = toRad(bearing - 90);
  return { x: Math.cos(r) * range * scale, y: Math.sin(r) * range * scale };
}

function bearingDiff(a, b) {
  let d = ((a - b) + 360) % 360;
  if (d > 180) d -= 360;
  return Math.abs(d);
}

function getCoverageStatus(range, bearing) {
  const diff = bearingDiff(bearing, APPROACH_DIR);
  const inLocCourse = diff <= LOC_COURSE_ANGLE && range <= LOC_COURSE_RANGE;
  const inGS        = diff <= GS_AZIMUTH       && range <= GS_RANGE;
  if (inLocCourse && inGS) return "TRACKING";
  if (inLocCourse)          return "TRACKING LOC ONLY";
  return null;
}

function gsTargetAlt(rangeNm) {
  return rangeNm * Math.tan(toRad(GLIDE_ANGLE)) * 6076;
}

let _sq = 1000;
const genSquawk = () => String(++_sq % 9999).padStart(4, "0");

// Planes spread around the approach corridor (APPROACH_DIR=130°)
// They head toward 310° (RWY 31) from various positions
const INIT_AC = [
  { id:"AC1", squawk:"5535", range:38, bearing:135, alt:8000,  speed:200, heading:310 }, // on approach centerline
  { id:"AC2", squawk:"0522", range:42, bearing:110, alt:9500,  speed:210, heading:315 }, // slightly left of approach
  { id:"AC3", squawk:"5752", range:30, bearing:155, alt:6500,  speed:190, heading:305 }, // slightly right
  { id:"AC4", squawk:"7167", range:55, bearing:130, alt:12000, speed:250, heading:310 }, // far out on centerline
  { id:"AC5", squawk:"4534", range:22, bearing:125, alt:3800,  speed:175, heading:310 }, // close in
  { id:"AC6", squawk:"0763", range:48, bearing:160, alt:10000, speed:230, heading:300 }, // wide right
];

// ── Trail component ────────────────────────────────────────────────────────
function Trail({ trail, scale }) {
  if (!trail || trail.length < 2) return null;
  const pts = trail.slice(-10);
  return (
    <g>
      {pts.map((pt, i) => {
        if (i === 0) return null;
        const prev = pts[i - 1];
        const p1 = polarToCart(prev.range, prev.bearing, scale);
        const p2 = polarToCart(pt.range,  pt.bearing,  scale);
        return (
          <line key={i}
            x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
            stroke="#f5a623" strokeWidth={1.2 * (i / pts.length)}
            opacity={0.55 * (i / pts.length)}
          />
        );
      })}
    </g>
  );
}

// ── Radar Plan View ────────────────────────────────────────────────────────
function RadarPlanView({ aircraft, sweepAngle, selectedAc, onSelectAc, zoom, showTracks, showCoverage }) {
  const scale = NM_TO_PX * zoom;
  const S = 700, cx = S / 2, cy = S / 2, maxR = 75;

  const appRad  = toRad(APPROACH_DIR - 90);
  const perpRad = appRad + Math.PI / 2;

  // Service Volume box (LOC course: 25NM ±10°)
  const svLen  = LOC_COURSE_RANGE * scale;
  const svHalf = LOC_COURSE_RANGE * Math.sin(toRad(LOC_COURSE_ANGLE)) * scale;
  const svTip  = { x: cx + Math.cos(appRad)*svLen, y: cy + Math.sin(appRad)*svLen };
  const svCorners = [
    { x: cx      + Math.cos(perpRad)*svHalf, y: cy      + Math.sin(perpRad)*svHalf },
    { x: svTip.x + Math.cos(perpRad)*svHalf, y: svTip.y + Math.sin(perpRad)*svHalf },
    { x: svTip.x - Math.cos(perpRad)*svHalf, y: svTip.y - Math.sin(perpRad)*svHalf },
    { x: cx      - Math.cos(perpRad)*svHalf, y: cy      - Math.sin(perpRad)*svHalf },
  ];
  const svPath = svCorners.map((p,i) => `${i===0?"M":"L"} ${p.x} ${p.y}`).join(" ") + " Z";

  // GS triangle — blue narrow (12NM ±8°) — straight lines (no arc)
  const gsR  = GS_RANGE * scale;
  const gsA1 = toRad(APPROACH_DIR - GS_AZIMUTH - 90);
  const gsA2 = toRad(APPROACH_DIR + GS_AZIMUTH - 90);
  const gsPath = `M ${cx} ${cy} L ${cx+Math.cos(gsA1)*gsR} ${cy+Math.sin(gsA1)*gsR} L ${cx+Math.cos(gsA2)*gsR} ${cy+Math.sin(gsA2)*gsR} Z`;

  // LOC triangle — red wide (25NM ±10° course + 35° clearance combined = ±35°) — straight lines
  const lcR  = LOC_COURSE_RANGE * scale;
  const lcA1 = toRad(APPROACH_DIR - LOC_CLEAR_ANGLE - 90);
  const lcA2 = toRad(APPROACH_DIR + LOC_CLEAR_ANGLE - 90);
  const lcPath = `M ${cx} ${cy} L ${cx+Math.cos(lcA1)*lcR} ${cy+Math.sin(lcA1)*lcR} L ${cx+Math.cos(lcA2)*lcR} ${cy+Math.sin(lcA2)*lcR} Z`;

  // Sweep
  const swA1 = toRad(sweepAngle - 18 - 90);
  const swA2 = toRad(sweepAngle - 90);
  const swR  = maxR * scale;
  const swPath = `M ${cx} ${cy} L ${cx+Math.cos(swA1)*swR} ${cy+Math.sin(swA1)*swR} A ${swR} ${swR} 0 0 1 ${cx+Math.cos(swA2)*swR} ${cy+Math.sin(swA2)*swR} Z`;

  // ILS centerline
  const ilsEnd  = { x: cx+Math.cos(appRad)*svLen, y: cy+Math.sin(appRad)*svLen };
  const ilsHalf = LOC_COURSE_RANGE * Math.sin(toRad(3)) * scale;

  // Coastline
  const coast = [[73,310],[65,300],[60,285],[62,270],[68,258],[72,245],[68,235],
    [60,225],[55,215],[52,200],[50,190],[53,178],[58,168],[55,155],[50,148],[46,138],
    [44,125],[48,112],[55,100],[62,92],[70,88],[78,85],[85,90]];
  const coastPts = coast.map(([r,b])=>{ const p=polarToCart(r,b,scale); return {x:cx+p.x,y:cy+p.y}; });
  const coastPath = coastPts.map((p,i)=>`${i===0?"M":"L"} ${p.x} ${p.y}`).join(" ");

  // Hold circles
  const holds = [[22,60,3.5],[15,285,2.5],[42,150,4],[55,95,3]];

  return (
    <svg width={S} height={S} style={{background:"#000",display:"block"}}>
      <defs>
        <radialGradient id="swGrad" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse"
          gradientTransform={`translate(${cx},${cy}) scale(${swR})`}>
          <stop offset="0%"   stopColor="#00ff41" stopOpacity="0.0"/>
          <stop offset="100%" stopColor="#00ff41" stopOpacity="0.38"/>
        </radialGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="2.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="sg"><feGaussianBlur stdDeviation="1" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="rg"><feGaussianBlur stdDeviation="2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>

      {/* Grid */}
      {[-60,-40,-20,0,20,40,60].map(v=>(
        <g key={v}>
          <line x1={cx+v*scale} y1={0} x2={cx+v*scale} y2={S} stroke="#0d160d" strokeWidth={0.4}/>
          <line x1={0} y1={cy+v*scale} x2={S} y2={cy+v*scale} stroke="#0d160d" strokeWidth={0.4}/>
        </g>
      ))}

      {/* Range rings */}
      {RADAR_RINGS.map(r=>(
        <g key={r}>
          <circle cx={cx} cy={cy} r={r*scale} fill="none"
            stroke={r===10?"#1e3a1e":r===20?"#162816":"#0f1a0f"}
            strokeWidth={r===20||r===40?1.2:0.7}/>
          <text x={cx+4} y={cy-r*scale+11} fill="#2a5c2a" fontSize="9" fontFamily="monospace">{r}</text>
        </g>
      ))}
      <circle cx={cx} cy={cy} r={maxR*scale} fill="none" stroke="#2a5a2a" strokeWidth={1}/>

      {/* Coastline */}
      <path d={coastPath} fill="none" stroke="#00ccaa" strokeWidth={1.2} opacity={0.35}/>

      {/* Blue hold circles */}
      {holds.map(([r,b,cr],i)=>{
        const p = polarToCart(r,b,scale);
        return <circle key={i} cx={cx+p.x} cy={cy+p.y} r={cr*scale}
          fill="none" stroke="#4488ff" strokeWidth={1} opacity={0.45}/>;
      })}

      {/* Coverage zones — LOC red triangle, GS blue triangle */}
      {showCoverage && <>
        <path d={lcPath} fill="rgba(255,40,0,0.06)" stroke="#ff3300" strokeWidth={1.8} opacity={0.85}/>
        <path d={gsPath} fill="rgba(0,100,255,0.10)" stroke="#2255ff" strokeWidth={1.5} opacity={0.90}/>
      </>}

      {/* Service Volume centerline axis */}
      <line x1={cx} y1={cy} x2={svTip.x} y2={svTip.y}
        stroke="#ffffff" strokeWidth={1} opacity={0.3} strokeDasharray="6,4"/>

      {/* ILS approach lines — WHITE centerline + green edges */}
      <line x1={cx} y1={cy} x2={ilsEnd.x} y2={ilsEnd.y}
        stroke="#ffffff" strokeWidth={0.9} opacity={0.45} strokeDasharray="5,4"/>
      {[-1,1].map(s=>(
        <line key={s}
          x1={cx + Math.cos(perpRad)*ilsHalf*s}
          y1={cy + Math.sin(perpRad)*ilsHalf*s}
          x2={ilsEnd.x + Math.cos(perpRad)*ilsHalf*s}
          y2={ilsEnd.y + Math.sin(perpRad)*ilsHalf*s}
          stroke="#00ff88" strokeWidth={0.7} opacity={0.35}/>
      ))}

      {/* Sweep */}
      <path d={swPath} fill="url(#swGrad)"/>
      <line x1={cx} y1={cy} x2={cx+Math.cos(swA2)*swR} y2={cy+Math.sin(swA2)*swR}
        stroke="#00ff41" strokeWidth={1.5} opacity={0.75}/>

      {/* Bearing labels + ticks */}
      {[0,30,60,90,120,150,180,210,240,270,300,330].map(deg=>{
        const lr  = toRad(deg-90);
        const lr2 = maxR*scale+15;
        return <text key={deg} x={cx+Math.cos(lr)*lr2} y={cy+Math.sin(lr)*lr2+4}
          fill="#3a7a3a" fontSize="10" fontFamily="monospace" textAnchor="middle">
          {String(deg).padStart(3,"0")}
        </text>;
      })}
      {Array.from({length:72},(_,i)=>i*5).map(deg=>{
        const tr=toRad(deg-90), r1=maxR*scale, r2=r1+(deg%30===0?8:4);
        return <line key={deg} x1={cx+Math.cos(tr)*r1} y1={cy+Math.sin(tr)*r1}
          x2={cx+Math.cos(tr)*r2} y2={cy+Math.sin(tr)*r2}
          stroke="#2a5a2a" strokeWidth={deg%30===0?1.5:0.7}/>;
      })}

      {/* Aircraft */}
      {aircraft.map(ac=>{
        if(ac.range > maxR) return null;
        const pos = polarToCart(ac.range, ac.bearing, scale);
        const ax = cx+pos.x, ay = cy+pos.y;
        const isSel = selectedAc?.id === ac.id;
        const status = getCoverageStatus(ac.range, ac.bearing);
        const isTracking  = ac.acquired && status === "TRACKING";
        const isLocOnly   = ac.acquired && status === "TRACKING LOC ONLY";
        const color = isTracking ? "#ff69ff" : isLocOnly ? "#00ffff" : "#00ff41";
        const hr = toRad(ac.heading-90);

        return (
          <g key={ac.id} onClick={()=>onSelectAc(ac)} style={{cursor:"pointer"}}>
            {showTracks && <Trail trail={ac.trail} scale={scale}/>}
            <line x1={ax} y1={ay} x2={ax+Math.cos(hr)*16} y2={ay+Math.sin(hr)*16}
              stroke={color} strokeWidth={1.5} opacity={0.85}/>
            {isSel && <circle cx={ax} cy={ay} r={10} fill="none" stroke={color} strokeWidth={1.5}/>}
            <line x1={ax-5} y1={ay} x2={ax+5} y2={ay} stroke={color} strokeWidth={1.5}/>
            <line x1={ax} y1={ay-5} x2={ax} y2={ay+5} stroke={color} strokeWidth={1.5}/>
            <g transform={`translate(${ax+8},${ay-12})`}>
              <text fill={color} fontSize="10" fontFamily="monospace" fontWeight="bold">
                {ac.squawk}
              </text>
              <text fill={color} fontSize="9" fontFamily="monospace" y={12}>
                {String(Math.round(ac.bearing)).padStart(3,"0")} {Math.round(ac.alt/100)*100}
              </text>
              {isTracking && <text fill="#ff69ff" fontSize="9" fontFamily="monospace" y={23}>I</text>}
              {isLocOnly  && <text fill="#00ffff" fontSize="9" fontFamily="monospace" y={23}>L</text>}
            </g>
          </g>
        );
      })}

      {/* Legend */}
      {showCoverage && (
        <g transform={`translate(6,${S-72})`}>
          <rect x={0} y={0} width={155} height={68} fill="#000000dd" stroke="#1a3a1a"/>
          <line x1={4} y1={14} x2={22} y2={14} stroke="#ff2200" strokeWidth={1.5}/>
          <text x={26} y={17} fill="#888" fontSize="9" fontFamily="monospace">Service Vol.</text>
          <line x1={4} y1={29} x2={22} y2={29} stroke="#0055ff" strokeWidth={1} strokeDasharray="3,2"/>
          <text x={26} y={32} fill="#888" fontSize="9" fontFamily="monospace">LOC Course</text>
          <line x1={4} y1={44} x2={22} y2={44} stroke="#00aaff" strokeWidth={1} strokeDasharray="3,2"/>
          <text x={26} y={47} fill="#888" fontSize="9" fontFamily="monospace">GS</text>
          <line x1={4} y1={59} x2={10} y2={59} stroke="#ff69ff" strokeWidth={2}/>
          <text x={14} y={59} fill="#888" fontSize="9" fontFamily="monospace">TRACKING</text>
          <line x1={82} y1={59} x2={88} y2={59} stroke="#00ffff" strokeWidth={2}/>
          <text x={92} y={59} fill="#888" fontSize="9" fontFamily="monospace">LOC</text>
        </g>
      )}

      {/* Center dot */}
      <circle cx={cx} cy={cy} r={3} fill="#00ff41" filter="url(#glow)"/>
      <text x={cx} y={13} fill="#3a7a3a" fontSize="10" fontFamily="monospace" textAnchor="middle">
        RCUx 3 — TLS27_RSAF — RWY 31
      </text>
    </svg>
  );
}

// ── PAR View (Two panels: Glide Slope + Localizer) ─────────────────────────
function PARView({ aircraft }) {
  const W=620, HT=195, HB=195, ML=50, MR=20;
  const IW = W-ML-MR;

  const ilsAc = aircraft.filter(ac => ac.acquired &&
    getCoverageStatus(ac.range*0.78, ac.bearing) !== null);

  const rx = r  => ML + ((GS_RANGE - r) / GS_RANGE) * IW;
  const gy = (alt,h) => { const mA=gsTargetAlt(GS_RANGE)*1.4; return h-15-(alt/mA)*(h-30); };

  const pts = (arr) => arr.map((p,i)=>`${i===0?"M":"L"} ${p.x} ${p.y}`).join(" ");

  const gsLine  = Array.from({length:80},(_,i)=>{ const r=(i/79)*GS_RANGE; return {x:rx(r),y:gy(gsTargetAlt(r),HT)}; });
  const gsUpper = gsLine.map(p=>({x:p.x,y:p.y-15}));
  const gsLower = gsLine.map(p=>({x:p.x,y:p.y+15}));

  return (
    <div style={{display:"flex",flexDirection:"column",gap:2}}>

      {/* ── Glide Slope panel ── */}
      <div style={{background:"#000",border:"1px solid #1a3a1a"}}>
        <div style={{color:"#3a7a3a",fontSize:9,fontFamily:"monospace",padding:"2px 6px",
          display:"flex",justifyContent:"space-between",borderBottom:"1px solid #0d1a0d"}}>
          <span>GLIDE SLOPE — {GLIDE_ANGLE}°  |  Coverage: {GS_RANGE} NM / ±{GS_AZIMUTH}°</span>
          <span style={{color:"#444"}}>GS: 329.00 MHz</span>
        </div>
        <svg width={W} height={HT} style={{display:"block"}}>
          {/* Distance grid */}
          {[1,2,3,4,5,6,7,8,9,10,11,12].map(r=>(
            <g key={r}>
              <line x1={rx(r)} y1={0} x2={rx(r)} y2={HT} stroke="#0a1a0a" strokeWidth={0.6}/>
              <text x={rx(r)} y={HT-3} fill="#2a5a2a" fontSize="8" fontFamily="monospace" textAnchor="middle">{r}</text>
            </g>
          ))}
          <text x={W-15} y={HT-3} fill="#2a5a2a" fontSize="8" fontFamily="monospace">0</text>
          <text x={ML-3} y={HT-3} fill="#2a5a2a" fontSize="8" fontFamily="monospace" textAnchor="end">{GS_RANGE}</text>
          {/* Center line */}
          <line x1={0} y1={HT/2} x2={W} y2={HT/2} stroke="#1a3a1a" strokeWidth={0.5}/>
          <text x={4} y={HT/2+4} fill="#3a6a3a" fontSize="8" fontFamily="monospace">0</text>
          {/* GS limit line */}
          <line x1={rx(GS_RANGE)} y1={0} x2={rx(GS_RANGE)} y2={HT} stroke="#00aaff" strokeWidth={0.8} strokeDasharray="4,3"/>
          <text x={rx(GS_RANGE)-2} y={12} fill="#00aaff" fontSize="7" fontFamily="monospace" textAnchor="end">GS</text>
          {/* LOC course limit */}
          <line x1={rx(Math.min(LOC_COURSE_RANGE,GS_RANGE))} y1={0}
            x2={rx(Math.min(LOC_COURSE_RANGE,GS_RANGE))} y2={HT}
            stroke="#ff4400" strokeWidth={0.8} strokeDasharray="1,6" opacity={0.35}/>
          {/* GS corridor */}
          <path d={pts(gsUpper)} fill="none" stroke="#006600" strokeWidth={0.8} strokeDasharray="4,3"/>
          <path d={pts(gsLower)} fill="none" stroke="#006600" strokeWidth={0.8} strokeDasharray="4,3"/>
          {/* GS ideal line */}
          <path d={pts(gsLine)} fill="none" stroke="#00aa00" strokeWidth={1.8}/>
          {/* LOC-only shaded zone */}
          <rect x={rx(GS_RANGE)} y={0}
            width={Math.max(0,rx(LOC_COURSE_RANGE)-rx(GS_RANGE))}
            fill="#ffffff" fillOpacity={0.02}/>

          {ilsAc.length===0 && (
            <text x={W/2} y={HT/2} fill="#2a4a2a" fontSize="11" fontFamily="monospace" textAnchor="middle">
              NO ILS TRAFFIC IN PAR RANGE
            </text>
          )}

          {ilsAc.map(ac=>{
            const r  = ac.range * 0.78;
            if(r > GS_RANGE + 1) return null;
            const rCl = Math.min(r, GS_RANGE);
            const x   = rx(rCl);
            const y   = gy(ac.alt, HT);
            const gsY = gy(gsTargetAlt(rCl), HT);
            const onGs= Math.abs(y-gsY) < 20;
            const col = onGs ? "#00ff41" : "#ff4444";
            const status = getCoverageStatus(ac.range, ac.bearing);
            return (
              <g key={ac.id}>
                {/* Approach trail lines */}
                <line x1={x-45} y1={gsY+7} x2={x}   y2={y}   stroke="#ff4444" strokeWidth={1}/>
                <line x1={x-90} y1={gsY+3} x2={x-45} y2={gsY+7} stroke="#ff4444" strokeWidth={0.7}/>
                {/* Cross marker */}
                <line x1={x-6} y1={y} x2={x+6} y2={y} stroke={col} strokeWidth={2}/>
                <line x1={x} y1={y-6} x2={x} y2={y+6} stroke={col} strokeWidth={2}/>
                <text x={x+8} y={y-5}  fill="#ffff00" fontSize="9" fontFamily="monospace">{ac.squawk}</text>
                <text x={x+8} y={y+6}  fill="#ffff00" fontSize="9" fontFamily="monospace">{Math.round(ac.alt)}ft</text>
                <text x={x+8} y={y+17} fill="#ff69ff" fontSize="9" fontFamily="monospace">{status==="TRACKING"?"I":""}</text>
                <text x={x+8} y={y+28} fill={onGs?"#00ff41":"#ff8800"} fontSize="9" fontFamily="monospace">
                  {onGs ? "ON G/S" : `${((y-gsY)/10).toFixed(1)}° DEV`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Localizer panel ── */}
      <div style={{background:"#000",border:"1px solid #1a3a1a"}}>
        <div style={{color:"#3a7a3a",fontSize:9,fontFamily:"monospace",padding:"2px 6px",
          display:"flex",justifyContent:"space-between",borderBottom:"1px solid #0d1a0d"}}>
          <span>LOCALIZER — Course: {LOC_COURSE_RANGE}NM/±{LOC_COURSE_ANGLE}°  |  Coverage: {LOC_COURSE_RANGE} NM</span>
          <span style={{color:"#444"}}>LOC: 108.70 MHz</span>
        </div>
        <svg width={W} height={HB} style={{display:"block"}}>
          {/* Distance grid */}
          {[1,2,3,4,5,6,7,8,9,10,11,12].map(r=>(
            <g key={r}>
              <line x1={rx(r)} y1={0} x2={rx(r)} y2={HB} stroke="#0a1a0a" strokeWidth={0.6}/>
            </g>
          ))}
          {/* LOC centerline */}
          <line x1={ML} y1={HB/2} x2={W-MR} y2={HB/2} stroke="#00aa00" strokeWidth={1.2}/>
          <line x1={ML} y1={HB/2-30} x2={W-MR} y2={HB/2-30} stroke="#006600" strokeWidth={0.6}/>
          <line x1={ML} y1={HB/2+30} x2={W-MR} y2={HB/2+30} stroke="#006600" strokeWidth={0.6}/>
          {/* Marker beacons */}
          {[{r:10.8,l:"OM"},{r:6.5,l:"MM"},{r:1.5,l:"IM"}].map(m=>(
            <g key={m.l}>
              <rect x={rx(m.r)-14} y={HB/2-42} width={28} height={84}
                fill="#1a2a3a" stroke="#334455" strokeWidth={0.5} opacity={0.45}/>
              <text x={rx(m.r)} y={HB/2-46} fill="#4488aa" fontSize="8" fontFamily="monospace" textAnchor="middle">{m.l}</text>
            </g>
          ))}
          {/* GS limit */}
          <line x1={rx(GS_RANGE)} y1={0} x2={rx(GS_RANGE)} y2={HB} stroke="#00aaff" strokeWidth={0.8} strokeDasharray="4,3"/>
          {/* LOC-only shading */}
          <rect x={rx(GS_RANGE)} y={0}
            width={Math.max(0,rx(LOC_COURSE_RANGE)-rx(GS_RANGE))}
            fill="#ffffff" fillOpacity={0.015}/>
          <text x={rx(GS_RANGE)+4} y={14} fill="#ffffff" fillOpacity={0.3} fontSize="7" fontFamily="monospace">LOC ONLY</text>

          {ilsAc.length===0 && (
            <text x={W/2} y={HB/2+4} fill="#2a4a2a" fontSize="11" fontFamily="monospace" textAnchor="middle">
              NO ILS TRAFFIC
            </text>
          )}

          {ilsAc.map(ac=>{
            const r   = ac.range * 0.78;
            if(r > GS_RANGE + 1) return null;
            const rCl = Math.min(r, GS_RANGE);
            const x   = rx(rCl);
            const lat = ac.locDev || 0;
            const y   = HB/2 - lat*24;
            const onLoc = Math.abs(lat) < 0.5;
            const col   = "#ff4444";
            return (
              <g key={ac.id}>
                <line x1={x-45} y1={HB/2} x2={x} y2={y} stroke="#ff4444" strokeWidth={1}/>
                <line x1={x-90} y1={HB/2+lat*3} x2={x-45} y2={HB/2} stroke="#ff4444" strokeWidth={0.7}/>
                <line x1={x-6} y1={y} x2={x+6} y2={y} stroke={col} strokeWidth={2}/>
                <line x1={x} y1={y-6} x2={x} y2={y+6} stroke={col} strokeWidth={2}/>
                <text x={x+8} y={y-4}  fill="#ffff00" fontSize="9" fontFamily="monospace">{ac.squawk}</text>
                <text x={x+8} y={y+7}  fill="#ff69ff" fontSize="9" fontFamily="monospace">{ac.squawk}</text>
                <text x={x+8} y={y+18} fill={onLoc?"#00ff41":"#ff8800"} fontSize="9" fontFamily="monospace">
                  {onLoc ? "ON LOC" : `${lat.toFixed(2)} dots`}
                </text>
              </g>
            );
          })}

          {/* Range labels */}
          {[0,2,4,6,8,10,12].map(r=>(
            <text key={r} x={rx(r)} y={HB-3} fill="#2a5a2a" fontSize="8" fontFamily="monospace" textAnchor="middle">{r}</text>
          ))}
          <text x={W-15} y={HB-3} fill="#2a5a2a" fontSize="8" fontFamily="monospace">0</text>
        </svg>
      </div>

      {/* CDI row */}
      {ilsAc.length > 0 && (
        <div style={{display:"flex",gap:8,padding:"4px 0"}}>
          {ilsAc.map(ac=><CDI key={ac.id} ac={ac}/>)}
        </div>
      )}
    </div>
  );
}

// ── CDI ────────────────────────────────────────────────────────────────────
function CDI({ ac }) {
  const gs  = Math.max(-2.5, Math.min(2.5, ac.gsDev  || 0));
  const loc = Math.max(-2.5, Math.min(2.5, ac.locDev || 0));
  const S=100, cx=50, cy=50, dot=14;
  const status = getCoverageStatus(ac.range, ac.bearing);
  return (
    <div style={{textAlign:"center"}}>
      <div style={{color:"#ff69ff",fontSize:9,fontFamily:"monospace",marginBottom:2}}>{ac.squawk}</div>
      <svg width={S} height={S} style={{background:"#040c04",border:"1px solid #1a3a1a"}}>
        <circle cx={cx} cy={cy} r={46} fill="none" stroke="#1a3a1a" strokeWidth={1}/>
        {[-2,-1,0,1,2].map(d=>(
          <g key={d}>
            {d!==0&&<circle cx={cx+d*dot} cy={cy} r={2.5} fill="#1a5a1a"/>}
            {d!==0&&<circle cx={cx} cy={cy+d*dot} r={2.5} fill="#1a5a1a"/>}
          </g>
        ))}
        <line x1={cx} y1={10} x2={cx} y2={S-10} stroke="#1a6a1a" strokeWidth={0.8}/>
        <line x1={10} y1={cy} x2={S-10} y2={cy} stroke="#1a6a1a" strokeWidth={0.8}/>
        {/* LOC bar */}
        {(status==="TRACKING"||status==="TRACKING LOC ONLY") && (
          <line x1={cx+loc*dot} y1={14} x2={cx+loc*dot} y2={S-14}
            stroke="#00ff41" strokeWidth={2.5}/>
        )}
        {/* GS bar */}
        {status==="TRACKING" && (
          <line x1={14} y1={cy+gs*dot} x2={S-14} y2={cy+gs*dot}
            stroke="#00ff41" strokeWidth={2.5}/>
        )}
        {status==="TRACKING LOC ONLY" && (
          <line x1={14} y1={cy} x2={S-14} y2={cy} stroke="#555" strokeWidth={1} strokeDasharray="3,3"/>
        )}
        <circle cx={cx} cy={cy} r={3} fill="none" stroke="#00ff41" strokeWidth={1}/>
      </svg>
      <div style={{color:"#555",fontSize:8,fontFamily:"monospace",marginTop:2}}>
        {status==="TRACKING"?"LOC+GS":"LOC ONLY"}
      </div>
    </div>
  );
}

// ── ILS Channel Box ────────────────────────────────────────────────────────
function ILSChannelBox({ channel, acquiredAc, onAcquire, onReset, transponderInput, onTransponderChange }) {
  const hasAc = !!acquiredAc;
  const status = hasAc ? getCoverageStatus(acquiredAc.range, acquiredAc.bearing) : null;
  const statusColor = status ? "#0055ff" : "#333";
  const statusText  = status === "TRACKING" ? "TRACKING"
    : status === "TRACKING LOC ONLY" ? "TRACKING LOC ONLY"
    : hasAc ? "ACQUIRED" : "READY";
  const statusBg = status ? "#0044cc" : hasAc ? "#004400" : "#222222";

  return (
    <div style={{border:"1px solid #2a3a2a",padding:"6px 8px",marginBottom:6,
      fontFamily:"monospace",fontSize:10,background:"#050d05"}}>
      {/* Channel ID */}
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
        <div style={{color:"#ccc",fontSize:10,fontWeight:"bold"}}>{channel.id}</div>
        <div style={{display:"flex",gap:4,marginLeft:"auto"}}>
          <div style={{width:10,height:10,borderRadius:"50%",
            background:hasAc?"#00aa00":"#333",border:"1px solid #444"}}/>
        </div>
      </div>
      {/* Display + Status */}
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
        <label style={{display:"flex",gap:3,alignItems:"center",color:"#666",fontSize:9}}>
          <input type="radio" checked={true} readOnly style={{accentColor:"#00ff41"}}/>
          Display
        </label>
        <div style={{flex:1,background:statusBg,color:"#fff",fontSize:9,
          padding:"2px 6px",textAlign:"center",border:"1px solid "+statusColor}}>
          {statusText}
        </div>
      </div>
      {/* Freq / Morse / GTU */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,marginBottom:5}}>
        <div>
          <div style={{color:"#555",fontSize:8}}>ILS Frequency</div>
          <div style={{background:"#111",border:"1px solid #333",
            color:"#ffffff",padding:"1px 4px",fontSize:9}}>{channel.freq}</div>
        </div>
        <div>
          <div style={{color:"#555",fontSize:8}}>Morse Code ID</div>
          <div style={{background:"#111",border:"1px solid #333",
            color:"#aaa",padding:"1px 4px",fontSize:9}}>{channel.morse}</div>
        </div>
        <div>
          <div style={{color:"#555",fontSize:8}}>GTU Status</div>
          <div style={{background:"#006600",color:"#000",padding:"1px 4px",
            fontSize:9,textAlign:"center",fontWeight:"bold"}}>{channel.gtuStatus}</div>
        </div>
      </div>
      {/* Transponder row */}
      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
        <span style={{color:"#555",fontSize:9}}>Transponder ID:</span>
        <input
          value={hasAc ? acquiredAc.squawk : transponderInput}
          onChange={e=>{ if(!hasAc) onTransponderChange(e.target.value); }}
          readOnly={hasAc}
          maxLength={4}
          placeholder="____"
          style={{width:60,background:"#0a0a0a",color:"#ffff00",border:"1px solid #333",
            fontFamily:"monospace",fontSize:11,padding:"1px 4px",textAlign:"center",
            outline:"none",cursor:hasAc?"default":"text"}}
        />
        <button onClick={()=>{ if(!hasAc) onAcquire(); }}
          style={{background:hasAc?"#1a1a1a":"#003300",
            color:hasAc?"#444":"#00ff41",
            border:"1px solid "+(hasAc?"#2a2a2a":"#005500"),
            padding:"2px 8px",fontFamily:"monospace",fontSize:9,
            cursor:hasAc?"default":"pointer"}}>
          ACQUIRE
        </button>
        <button onClick={onReset}
          style={{background:"#1a0000",color:"#ff4444",border:"1px solid #330000",
            padding:"2px 8px",fontFamily:"monospace",fontSize:9,cursor:"pointer"}}>
          RESET
        </button>
      </div>
    </div>
  );
}

// ── GCA Box ────────────────────────────────────────────────────────────────
function GCABox({ ilsInUse }) {
  return (
    <div style={{border:"1px solid #2a3a2a",padding:"6px 8px",fontFamily:"monospace",background:"#050d05"}}>
      <div style={{color:"#888",fontSize:10,marginBottom:5,borderBottom:"1px solid #1a2a1a",paddingBottom:3}}>GCA</div>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
        <span style={{color:"#555",fontSize:9}}>Status:</span>
        <div style={{flex:1,background:"#111",border:"1px solid #333",color:"#aaa",
          fontSize:9,padding:"2px 6px",textAlign:"center"}}>
          {ilsInUse ? "ILS IN USE" : ""}
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <span style={{color:"#555",fontSize:9}}>Transponder ID:</span>
        <div style={{width:60,background:"#0a0a0a",border:"1px solid #222",height:18}}/>
        <button style={{background:"#111",color:"#555",border:"1px solid #222",
          padding:"2px 8px",fontFamily:"monospace",fontSize:9,cursor:"default"}}>ACQUIRE GCA</button>
        <button style={{background:"#111",color:"#555",border:"1px solid #222",
          padding:"2px 8px",fontFamily:"monospace",fontSize:9,cursor:"default"}}>RESET</button>
      </div>
    </div>
  );
}

// ── Status Panel (LRU) ─────────────────────────────────────────────────────
function StatusPanel({ rackId }) {
  const lrus = [
    {n:"UPS-R",    c:"#00ff41", s:"478 Min"},
    {n:"RS",       c:"#00ff41", s:"Rack B"},
    {n:"Network",  c:"#00ff41", s:""},
    {n:"CPU1",     c:"#00ff41", s:"23.5 C"},
    {n:"CPU2",     c:"#00ff41", s:"23.5 C"},
    {n:"Interrog", c:"#00ff41", s:""},
    {n:"GTU3",     c:"#00ff41", s:"22.0 C"},
    {n:"Pressure", c:"#00ff41", s:"1007 hPa"},
    {n:"UPS-S",    c:"#00ff41", s:"139 Min"},
    {n:"ESA",      c:"#00ff41", s:""},
    {n:"ASA",      c:"#00ff41", s:""},
    {n:"ATA",      c:"#00ff41", s:""},
    {n:"LOCAL",    c:"#555",    s:""},
    {n:"RCU",      c:"#00ff41", s:"17.4 GB"},
  ];
  return (
    <div style={{background:"#040a04",border:"1px solid #1a3a1a",padding:5,
      display:"flex",flexDirection:"column",gap:3,width:90,fontFamily:"monospace"}}>
      <div style={{color:"#555",fontSize:9,textAlign:"center",borderBottom:"1px solid #1a2a1a",paddingBottom:2}}>
        RACK {rackId}
      </div>
      {lrus.map(({n,c,s})=>(
        <div key={n} style={{background:c+"18",border:`1px solid ${c}44`,
          borderLeft:`3px solid ${c}`,padding:"2px 4px"}}>
          <div style={{color:c,fontSize:9,fontWeight:"bold"}}>{n}</div>
          {s&&<div style={{color:c+"99",fontSize:8}}>{s}</div>}
        </div>
      ))}
    </div>
  );
}

// ── Right Info Panel ───────────────────────────────────────────────────────
function InfoPanel({ aircraft, selectedAc, channels, onAcquire, onReset,
  transponderInputs, onTransponderChange, systemMode, runwayId, currentView, onViewChange }) {
  const ilsInUse = aircraft.some(ac=>ac.acquired);
  return (
    <div style={{background:"#060e06",border:"1px solid #1a3a1a",padding:"8px",
      fontFamily:"monospace",width:280,overflowY:"auto",flexShrink:0}}>

      {/* Runway + Mode */}
      <div style={{textAlign:"center",marginBottom:8}}>
        <div style={{color:"#ccc",fontSize:14,letterSpacing:2}}>RUNWAY {runwayId}</div>
        <div style={{color:"#666",fontSize:9,marginTop:1}}>System Mode:</div>
        <div style={{background:"#00aa00",color:"#000",fontWeight:"bold",fontSize:11,
          padding:"2px 0",textAlign:"center",marginTop:2}}>{systemMode}</div>
      </div>

      {/* Integrity Monitor */}
      <div style={{border:"1px solid #1a3a1a",padding:"5px",marginBottom:6}}>
        <div style={{color:"#666",marginBottom:3,fontSize:9}}>Integrity Monitor</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:2}}>
          <div style={{gridColumn:"1/-1",color:"#666",textAlign:"center",fontSize:8}}>System</div>
          <div style={{gridColumn:"1/-1",background:"#006600",color:"#000",textAlign:"center",padding:2,fontSize:10,fontWeight:"bold"}}>OK</div>
          <div style={{color:"#555",fontSize:8}}>Surveillance</div>
          <div style={{gridColumn:"2/-1",color:"#555",fontSize:8}}>Guidance</div>
          <div style={{background:"#006600",color:"#000",textAlign:"center",padding:2,fontSize:9}}>OK</div>
          <div style={{background:"#006600",color:"#000",textAlign:"center",padding:2,fontSize:9,gridColumn:"2/-1"}}>OK</div>
        </div>
      </div>

      {/* View / Zoom / Approach */}
      <div style={{border:"1px solid #1a3a1a",padding:"5px",marginBottom:6}}>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:3}}>
          <span style={{color:"#555",fontSize:9}}>Zoom:</span>
          <label style={{color:"#555",fontSize:9}}>○ Auto</label>
          <label style={{color:"#00ff41",fontSize:9}}>● Manual</label>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:3}}>
          <span style={{color:"#555",fontSize:9}}>Approach:</span>
          <div style={{flex:1,background:"#0a0a0a",border:"1px solid #333",color:"#aaa",
            padding:"1px 4px",fontSize:9}}>TLS 3.0</div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:6}}>
          <span style={{color:"#555",fontSize:9}}>Altitude:</span>
          <input type="checkbox" readOnly checked={false} style={{accentColor:"#0f0"}}/>
          <span style={{color:"#555",fontSize:9}}>Limit to</span>
          <div style={{background:"#0a0a0a",border:"1px solid #333",color:"#aaa",
            padding:"1px 4px",fontSize:9,width:40}}>30000</div>
          <span style={{color:"#555",fontSize:9}}>feet</span>
        </div>
        {/* View selector — custom buttons تتحكم في العرض */}
        <div style={{display:"flex",flexDirection:"column",gap:4,fontSize:9}}>
          <div onClick={()=>onViewChange("plan")}
            style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",
              padding:"4px 6px",borderRadius:2,
              background:currentView==="plan"?"#003300":"transparent",
              border:`1px solid ${currentView==="plan"?"#005500":"#1a2a1a"}`}}>
            <div style={{width:14,height:14,borderRadius:"50%",flexShrink:0,
              border:`2px solid ${currentView==="plan"?"#00ff41":"#444"}`,
              background:currentView==="plan"?"#00ff41":"transparent",
              display:"flex",alignItems:"center",justifyContent:"center"}}>
              {currentView==="plan" && <div style={{width:6,height:6,borderRadius:"50%",background:"#000"}}/>}
            </div>
            <span style={{color:currentView==="plan"?"#00ff41":"#777"}}>Show surveillance tracks</span>
          </div>
          <div onClick={()=>onViewChange("par")}
            style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",
              padding:"4px 6px",borderRadius:2,
              background:currentView==="par"?"#003300":"transparent",
              border:`1px solid ${currentView==="par"?"#005500":"#1a2a1a"}`}}>
            <div style={{width:14,height:14,borderRadius:"50%",flexShrink:0,
              border:`2px solid ${currentView==="par"?"#00ff41":"#444"}`,
              background:currentView==="par"?"#00ff41":"transparent",
              display:"flex",alignItems:"center",justifyContent:"center"}}>
              {currentView==="par" && <div style={{width:6,height:6,borderRadius:"50%",background:"#000"}}/>}
            </div>
            <span style={{color:currentView==="par"?"#00ff41":"#777"}}>Enable PAR track filter</span>
          </div>
        </div>
      </div>

      {/* ILS Channel boxes */}
      {channels.map((ch,idx)=>{
        const acq = aircraft.find(ac=>ac.channelIdx===idx && ac.acquired);
        return (
          <ILSChannelBox
            key={ch.id}
            channel={ch}
            acquiredAc={acq||null}
            onAcquire={()=>onAcquire(idx)}
            onReset={()=>onReset(idx)}
            transponderInput={transponderInputs[idx]||""}
            onTransponderChange={v=>onTransponderChange(idx,v)}
          />
        );
      })}

      {/* GCA Box */}
      <GCABox ilsInUse={ilsInUse}/>

      {/* Selected AC quick info */}
      {selectedAc && (
        <div style={{border:"1px solid #3a5a3a",padding:6,marginTop:6,background:"#0a180a"}}>
          <div style={{color:"#00ff41",fontSize:11,marginBottom:4}}>▶ {selectedAc.squawk}</div>
          <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:"2px 8px",fontSize:9}}>
            <span style={{color:"#555"}}>Range:</span>  <span>{selectedAc.range.toFixed(1)} NM</span>
            <span style={{color:"#555"}}>Bearing:</span><span>{Math.round(selectedAc.bearing)}°</span>
            <span style={{color:"#555"}}>Alt:</span>    <span>{selectedAc.alt.toLocaleString()} ft</span>
            <span style={{color:"#555"}}>Speed:</span>  <span>{selectedAc.speed} kts</span>
            <span style={{color:"#555"}}>Status:</span>
            <span style={{color:selectedAc.acquired?"#00aaff":"#555"}}>
              {selectedAc.acquired
                ? (getCoverageStatus(selectedAc.range,selectedAc.bearing)||"ACQUIRED")
                : "SURVEILLANCE"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bottom Bar ─────────────────────────────────────────────────────────────
function BottomBar({ altimeter, ilsTracks, displayTracks, interrogations, rate, speed, range, timeRemaining }) {
  const cells = [
    ["ALTIMETER",    `${altimeter} hPa`],
    ["ILS TRACKS",   ilsTracks],
    ["DISPLAY TRACKS",displayTracks],
    ["INTERROGATION",interrogations.toLocaleString()],
    ["AGL",          "850"],
    ["SPEED",        `${speed} kts`],
    ["RANGE",        `${range} NM`],
    ["TRACK",        ""],
    ["RAM",          "esa_0224"],
    ["GCA TRACKS",   "0"],
    ["RECORDING",    "ON"],
    ["RATE",         `${rate} Hz`],
    ["MSL",          "1506 ft"],
    ["",             ""],
    ["TIME REMAINING",timeRemaining],
    ["",             ""],
  ];
  return (
    <div style={{background:"#030803",borderTop:"1px solid #111a11",
      display:"grid",gridTemplateColumns:"repeat(8,1fr)",fontSize:8,fontFamily:"monospace"}}>
      {cells.map(([label,val],i)=>(
        <div key={i} style={{padding:"2px 5px",borderRight:"1px solid #0d160d",
          borderBottom:i<8?"1px solid #0d160d":"none"}}>
          <div style={{color:"#3a3a3a"}}>{label}</div>
          <div style={{color:"#999",fontWeight:"bold"}}>{val}</div>
        </div>
      ))}
    </div>
  );
}

// ── Spawn Modal ────────────────────────────────────────────────────────────
function SpawnModal({ onSpawn, onClose }) {
  const [f, setF] = useState({bearing:130,range:22,alt:5000,speed:200,heading:310});
  const s = (k,v) => setF(p=>({...p,[k]:v}));
  return (
    <div style={{position:"fixed",inset:0,background:"#000000bb",display:"flex",
      alignItems:"center",justifyContent:"center",zIndex:300}}>
      <div style={{background:"#060e06",border:"2px solid #2a6a2a",padding:20,
        fontFamily:"monospace",minWidth:320}}>
        <div style={{color:"#00ff41",fontSize:12,marginBottom:10,borderBottom:"1px solid #1a3a1a",paddingBottom:6}}>
          SPAWN SURVEILLANCE TRACK
        </div>
        <div style={{color:"#555",fontSize:9,marginBottom:10,background:"#0a0a0a",
          border:"1px solid #1a2a1a",padding:"4px 8px"}}>
          After spawning: select aircraft → enter squawk in ILS channel → ACQUIRE
        </div>
        {[
          {k:"bearing",l:"Bearing (°)",min:0,  max:359},
          {k:"range",  l:"Range (NM)", min:1,  max:70},
          {k:"alt",    l:"Alt (ft)",   min:500,max:40000},
          {k:"speed",  l:"Speed (kts)",min:80, max:600},
          {k:"heading",l:"Heading (°)",min:0,  max:359},
        ].map(({k,l,min,max})=>(
          <div key={k} style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
            <span style={{color:"#888",width:130,fontSize:10}}>{l}</span>
            <input type="range" min={min} max={max} value={f[k]}
              onChange={e=>s(k,+e.target.value)} style={{flex:1}}/>
            <span style={{color:"#00ff41",width:50,textAlign:"right",fontSize:10}}>{f[k]}</span>
          </div>
        ))}
        <div style={{display:"flex",gap:8,marginTop:10}}>
          <button onClick={()=>{onSpawn(f);onClose();}}
            style={{flex:1,background:"#004400",color:"#fff",border:"none",
              padding:"7px",fontFamily:"monospace",cursor:"pointer"}}>SPAWN</button>
          <button onClick={onClose}
            style={{flex:1,background:"#220000",color:"#fff",border:"none",
              padding:"7px",fontFamily:"monospace",cursor:"pointer"}}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ───────────────────────────────────────────────────────────────
export default function TLSFlightSimulator() {
  const [aircraft,      setAircraft]     = useState(()=>INIT_AC.map(ac=>({
    ...ac,
    trail:    [{range:ac.range,bearing:ac.bearing}],
    locDev:   0,
    gsDev:    0,
    acquired: false,
    channelIdx: null,
  })));
  const [sweepAngle,    setSweepAngle]   = useState(0);
  const [selectedAc,    setSelectedAc]   = useState(null);
  const [zoom,          setZoom]         = useState(1);
  const [view,          setView]         = useState("plan");
  const [showTracks,    setShowTracks]   = useState(true);
  const [showCoverage,  setShowCoverage] = useState(true);
  const [showSpawn,     setShowSpawn]    = useState(false);
  const [interrogations,setInterrogations]=useState(105145);
  const [transponderInputs,setTpInputs] = useState([""]);
  const lastT = useRef(0);

  // Animation loop
  useEffect(()=>{
    let fid;
    const loop = time => {
      const dt = Math.min((time - lastT.current)/1000, 0.1);
      lastT.current = time;
      setSweepAngle(a=>(a + SWEEP_SPEED*360*dt)%360);
      setInterrogations(i=>i+Math.floor(Math.random()*3+1));
      setAircraft(prev=>prev.map(ac=>{
        const hr  = toRad(ac.heading);
        const spd = ac.speed/3600*dt*55;
        const dx  = Math.sin(hr)*spd, dy = -Math.cos(hr)*spd;
        const br  = toRad(ac.bearing-90);
        const nx  = Math.cos(br)*ac.range+dx, ny = Math.sin(br)*ac.range+dy;
        const newR = Math.sqrt(nx*nx+ny*ny);
        const newB = (toDeg(Math.atan2(ny,nx))+90+360)%360;
        let newAlt = ac.alt, newLoc = ac.locDev||0, newGs = ac.gsDev||0;
        if(ac.acquired){
          const st = getCoverageStatus(newR, newB);
          if(st==="TRACKING"){
            newAlt = Math.max(200, ac.alt - 18*dt*60);
            newLoc = newLoc*0.97 + (Math.random()-0.5)*0.05;
            newGs  = ((newAlt - gsTargetAlt(newR*0.78))/480) + (Math.random()-0.5)*0.04;
          } else if(st==="TRACKING LOC ONLY"){
            newLoc = newLoc*0.97 + (Math.random()-0.5)*0.04;
          }
        }
        const newTrail = [...(ac.trail||[]),{range:newR,bearing:newB}].slice(-14);
        let newHdg = ac.heading;
        if(newR > 73) newHdg = (ac.heading+180)%360;
        return {...ac,range:newR,bearing:newB,alt:newAlt,
          heading:newHdg,trail:newTrail,locDev:newLoc,gsDev:newGs};
      }));
      fid = requestAnimationFrame(loop);
    };
    fid = requestAnimationFrame(loop);
    return ()=>cancelAnimationFrame(fid);
  },[]);

  const handleAcquire = channelIdx => {
    const sq = transponderInputs[channelIdx]?.trim();
    if(!sq) return;
    setAircraft(prev=>prev.map(ac=>{
      if(ac.squawk===sq && !ac.acquired)
        return {...ac, acquired:true, channelIdx};
      return ac;
    }));
  };

  const handleReset = channelIdx => {
    setAircraft(prev=>prev.map(ac=>{
      if(ac.channelIdx===channelIdx)
        return {...ac, acquired:false, channelIdx:null, locDev:0, gsDev:0};
      return ac;
    }));
    setTpInputs(prev=>{const n=[...prev]; n[channelIdx]=""; return n;});
  };

  const handleTpChange = (idx, val) =>
    setTpInputs(prev=>{const n=[...prev]; n[idx]=val; return n;});

  const handleSpawn = f => {
    const sq = genSquawk();
    setAircraft(prev=>[...prev,{
      id:`AC${Date.now()}`, squawk:sq,
      range:f.range, bearing:f.bearing, alt:f.alt,
      speed:f.speed, heading:f.heading,
      acquired:false, channelIdx:null,
      trail:[{range:f.range,bearing:f.bearing}],
      locDev:0, gsDev:0,
    }]);
  };

  const ilsCount     = aircraft.filter(a=>a.acquired).length;
  const ilsAcRange   = aircraft.filter(a=>a.acquired && a.range < GS_RANGE*1.3);
  const nearestIls   = ilsAcRange[0];
  const speed        = nearestIls ? nearestIls.speed : 0;
  const range        = nearestIls ? nearestIls.range.toFixed(1) : "—";
  const timeRem      = nearestIls
    ? `${Math.floor(nearestIls.range/nearestIls.speed*3600/60)}:${String(Math.round(nearestIls.range/nearestIls.speed*3600%60)).padStart(2,"0")}`
    : "—";

  return (
    <div style={{background:"#020702",minHeight:"100vh",fontFamily:"monospace",
      color:"#aaa",display:"flex",flexDirection:"column",userSelect:"none"}}>

      {/* Title bar */}
      <div style={{background:"#030b03",borderBottom:"1px solid #1a3a1a",
        padding:"3px 10px",display:"flex",alignItems:"center",gap:14,fontSize:11}}>
        <span style={{color:"#00ff41",fontWeight:"bold",fontSize:11}}>
          RCUx 3 — TLS27_RSAF — Runway 31
        </span>
        {["Control","View","Options","Help"].map(m=>(
          <span key={m} style={{color:"#3a3a3a",cursor:"pointer"}}
            onMouseEnter={e=>e.target.style.color="#aaa"}
            onMouseLeave={e=>e.target.style.color="#3a3a3a"}>{m}</span>
        ))}
        {/* Squawk list */}
        <div style={{marginLeft:8,display:"flex",gap:3,fontSize:10,flexWrap:"wrap"}}>
          {aircraft.map(ac=>{
            const st  = getCoverageStatus(ac.range, ac.bearing);
            const col = ac.acquired
              ? (st==="TRACKING"?"#ff69ff":st==="TRACKING LOC ONLY"?"#00ffff":"#00cc33")
              : "#00cc33";
            return <span key={ac.id} style={{color:col,background:"#090909",
              padding:"0 4px",border:"1px solid #1a2a1a"}}>{ac.squawk}</span>;
          })}
        </div>
        <div style={{marginLeft:"auto",color:"#3a3a3a",fontSize:10}}>
          {new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false})}
        </div>
      </div>

      {/* Toolbar */}
      <div style={{background:"#030b03",borderBottom:"1px solid #1a3a1a",
        padding:"3px 10px",display:"flex",gap:8,alignItems:"center",fontSize:10}}>
        <span style={{color:"#444"}}>Zoom:</span>
        {[0.7,1,1.5,2].map(z=>(
          <button key={z} onClick={()=>setZoom(z)} style={{
            background:zoom===z?"#003300":"#080808",
            color:zoom===z?"#00ff41":"#444",
            border:`1px solid ${zoom===z?"#004400":"#1a1a1a"}`,
            padding:"1px 8px",cursor:"pointer",fontFamily:"monospace",fontSize:10,
          }}>{z}x</button>
        ))}
        <span style={{color:"#1a1a1a"}}>|</span>
        <button onClick={()=>setShowSpawn(true)} style={{
          background:"#001a00",color:"#00ff41",border:"1px solid #003300",
          padding:"2px 10px",cursor:"pointer",fontFamily:"monospace",fontSize:10,
        }}>+ SPAWN</button>
        <button onClick={()=>setAircraft(p=>p.length>1?p.slice(0,-1):p)} style={{
          background:"#110000",color:"#ff4444",border:"1px solid #220000",
          padding:"2px 8px",cursor:"pointer",fontFamily:"monospace",fontSize:10,
        }}>− REMOVE</button>
        <span style={{marginLeft:"auto",color:"#2a2a2a",fontSize:9}}>
          TRACKS:{aircraft.length} | ILS:{ilsCount} | INTERROG:{interrogations.toLocaleString()}
        </span>
      </div>

      {/* Main */}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{flex:1,overflow:"auto"}}>
            {view==="plan"
              ? <RadarPlanView aircraft={aircraft} sweepAngle={sweepAngle}
                  selectedAc={selectedAc} onSelectAc={setSelectedAc}
                  zoom={zoom} showTracks={showTracks} showCoverage={showCoverage}/>
              : <div style={{padding:8}}>
                  <PARView aircraft={aircraft}/>
                </div>
            }
          </div>
          <BottomBar altimeter={1016} ilsTracks={ilsCount}
            displayTracks={aircraft.length} interrogations={interrogations}
            rate={SWEEP_SPEED} speed={speed} range={range} timeRemaining={timeRem}/>
        </div>

        <div style={{display:"flex",flexShrink:0}}>
          <StatusPanel rackId="B"/>
          <InfoPanel
            aircraft={aircraft}
            selectedAc={selectedAc}
            channels={ILS_CHANNELS}
            onAcquire={handleAcquire}
            onReset={handleReset}
            transponderInputs={transponderInputs}
            onTransponderChange={handleTpChange}
            systemMode="TRACK"
            runwayId="31"
            currentView={view}
            onViewChange={setView}
          />
        </div>
      </div>

      {showSpawn && <SpawnModal onSpawn={handleSpawn} onClose={()=>setShowSpawn(false)}/>}
    </div>
  );
}
