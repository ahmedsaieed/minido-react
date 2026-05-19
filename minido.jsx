import { useState, useRef, useEffect, useCallback } from "react";

const BG     = "#3a3830";
const BG2    = "#322f28";
const BG3    = "#2a2822";
const CREAM  = "#e8e2d4";
const CREAM2 = "#c8c0b0";
const CREAM3 = "#7a7468";
const ACCENT = "#d4c9a8";
const BORDER = "#4a4640";
const BORDER2= "#3e3b34";

const DEFAULT_CATEGORIES = [
  { code:"GEN", color:"#9a9080", title:"General"  },
  { code:"GV",  color:"#c8b89a", title:"GV"       },
  { code:"WRK", color:"#7eb8c9", title:"Work"      },
  { code:"PRS", color:"#a8c99a", title:"Personal"  },
];

const PRESETS = ["#c8b89a","#7eb8c9","#a8c99a","#c99a9a","#b89ac9","#c9c97e","#7ec9b8","#c9a87e","#9a9080","#aab8c8"];

function todayISO() { return new Date().toISOString().split("T")[0]; }

function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function formatDateLabel(iso) {
  const d   = new Date(iso + "T00:00:00");
  const wd  = d.toLocaleDateString("en-US", { weekday:"short" }).toUpperCase();
  const day = d.getDate();
  const mon = d.toLocaleDateString("en-US", { month:"short" }).toUpperCase();
  const yy  = String(d.getFullYear()).slice(2);
  return `${wd} ${day} ${mon} '${yy}`;
}

const INITIAL_TASKS = [
  { id:1,  iso:"2026-05-03", text:"Buy microwave plate",                 cat:"GEN", done:false },
  { id:2,  iso:"2026-05-04", text:"Try minido",                          cat:"GEN", done:false },
  { id:3,  iso:"2026-05-04", text:"Portfolio site",                      cat:"GV",  done:false },
  { id:4,  iso:"2026-05-04", text:"Grunkopf: Website",                   cat:"WRK", done:false },
  { id:5,  iso:"2026-05-04", text:"Dubai GV Apply legalization",         cat:"GV",  done:false },
  { id:6,  iso:"2026-05-04", text:"Follow-up two invoices Talan",        cat:"WRK", done:false },
  { id:7,  iso:"2026-05-04", text:"Send filled up PoA",                  cat:"WRK", done:false },
  { id:8,  iso:"2026-05-04", text:"New Biztalk migration PBI for Abiba", cat:"WRK", done:false },
  { id:9,  iso:"2026-05-04", text:"Return microwave plate",              cat:"PRS", done:false },
  { id:10, iso:"2026-05-04", text:"Cowork AI",                           cat:"GEN", done:false },
];

// ── SwipeRow: tracks swipe + fires animation feedback ──────────────────────
function SwipeRow({ children, onSwipeRight, onSwipeLeft, className, style, ...rest }) {
  const startX   = useRef(null);
  const startY   = useRef(null);
  const moved    = useRef(false);
  const [swipeAnim, setSwipeAnim] = useState(null); // "right" | "left" | null
  const [tx, setTx] = useState(0); // live translateX during drag

  const handleStart = (x, y) => {
    startX.current = x; startY.current = y; moved.current = false; setTx(0);
  };
  const handleMove = (x, y) => {
    if (startX.current === null) return;
    const dx = x - startX.current;
    const dy = Math.abs(y - startY.current);
    if (!moved.current && (Math.abs(dx) > 4 || dy > 4)) moved.current = true;
    if (dy < Math.abs(dx)) setTx(Math.sign(dx) * Math.min(Math.abs(dx) * 0.45, 60));
  };
  const handleEnd = (x) => {
    if (startX.current === null) return;
    const dx = x - startX.current;
    if (Math.abs(dx) > 52 && moved.current) {
      const dir = dx > 0 ? "right" : "left";
      setSwipeAnim(dir);
      setTx(0);
      setTimeout(() => {
        setSwipeAnim(null);
        if (dir === "right") onSwipeRight?.();
        else                 onSwipeLeft?.();
      }, 280);
    } else {
      setTx(0);
    }
    startX.current = null; startY.current = null; moved.current = false;
  };

  const animStyle = swipeAnim === "right"
    ? { animation: "swipeFlyRight 0.28s ease forwards" }
    : swipeAnim === "left"
    ? { animation: "swipeFlyLeft 0.28s ease forwards" }
    : { transform: `translateX(${tx}px)`, transition: tx === 0 ? "transform 0.15s ease" : "none" };

  return (
    <div
      className={className}
      style={{ ...style, ...animStyle }}
      onMouseDown ={e => handleStart(e.clientX, e.clientY)}
      onMouseMove ={e => handleMove(e.clientX, e.clientY)}
      onMouseUp   ={e => handleEnd(e.clientX)}
      onMouseLeave={e => { if (startX.current !== null) { setTx(0); startX.current = null; } }}
      onTouchStart={e => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchMove ={e => { e.stopPropagation(); handleMove(e.touches[0].clientX, e.touches[0].clientY); }}
      onTouchEnd  ={e => handleEnd(e.changedTouches[0].clientX)}
      {...rest}
    >
      {/* Swipe hint overlay */}
      {(tx !== 0 || swipeAnim) && (
        <div style={{
          position:"absolute", inset:0, borderRadius:4, pointerEvents:"none",
          background: tx > 0 || swipeAnim === "right"
            ? `linear-gradient(90deg, rgba(168,200,154,0.18) 0%, transparent 60%)`
            : `linear-gradient(270deg, rgba(122,180,200,0.18) 0%, transparent 60%)`,
          display:"flex", alignItems:"center",
          justifyContent: tx > 0 || swipeAnim === "right" ? "flex-start" : "flex-end",
          padding:"0 10px",
          opacity: Math.min(Math.abs(tx) / 30, 1),
          transition:"opacity 0.1s",
          zIndex:1,
        }}>
          <span style={{ fontSize:9, letterSpacing:"0.1em", color: tx > 0 || swipeAnim === "right" ? "#a8c99a" : "#7eb8c9", fontFamily:"inherit" }}>
            {tx > 0 || swipeAnim === "right" ? "+1 DAY ›" : "‹ +2 DAYS"}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}

// ── Express entry line at bottom of each day ───────────────────────────────
function ExpressEntry({ iso, defaultCat, categories, onCommit }) {
  const [text,    setText]    = useState("");
  const [cat,     setCat]     = useState(defaultCat);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  // Sync cat when defaultCat changes externally
  useEffect(() => { if (!focused) setCat(defaultCat); }, [defaultCat, focused]);

  const getCat = (code) => categories.find(c => c.code === code) || { code, color: CREAM3, title: code };
  const catObj = getCat(cat);

  const commit = () => {
    if (!text.trim()) return;
    onCommit(text.trim(), cat);
    setText("");
    // keep same cat for next entry — focus stays
    setTimeout(() => inputRef.current?.focus(), 20);
  };

  return (
    <div style={{
      display:"flex", alignItems:"center", gap:8, padding:"5px 4px",
      opacity: focused || text ? 1 : 0.35,
      transition:"opacity 0.15s",
    }}>
      {/* spacer matching drag-handle + checkbox width */}
      <span style={{ width:20, flexShrink:0 }} />
      <div style={{ width:15, height:15, border:`1px dashed ${BORDER}`, borderRadius:2, flexShrink:0 }} />

      {/* cat selector — tiny inline */}
      <select
        value={cat}
        onChange={e => setCat(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          background:"transparent", border:"none", outline:"none",
          color: catObj.color, fontFamily:"'DM Mono',monospace",
          fontSize:9, letterSpacing:"0.07em", cursor:"pointer",
          padding:"1px 0", appearance:"none", WebkitAppearance:"none",
          flexShrink:0, fontWeight:500,
        }}
      >
        {categories.map(c => <option key={c.code} value={c.code} style={{ background:BG2 }}>{c.code}</option>)}
      </select>

      <input
        ref={inputRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setText(""); inputRef.current?.blur(); } }}
        placeholder="add task…"
        style={{
          flex:1, background:"transparent", border:"none", outline:"none",
          color:CREAM2, fontFamily:"'DM Mono',monospace", fontSize:12,
          lineHeight:1.5, padding:0,
        }}
      />
      {text && (
        <span style={{ fontSize:9, color:CREAM3, letterSpacing:"0.08em", flexShrink:0, cursor:"pointer" }}
          onMouseDown={e => { e.preventDefault(); commit(); }}>
          ↵
        </span>
      )}
    </div>
  );
}

export default function Minido() {
  const [categories,    setCategories]    = useState(DEFAULT_CATEGORIES);
  const [tasks,         setTasks]         = useState(INITIAL_TASKS);
  const [filter,        setFilter]        = useState("all");
  const [catFilter,     setCatFilter]     = useState(null);
  const [futureDays,    setFutureDays]    = useState(8); // days ahead to show (grows by 7 on "show more")

  const [showAdd,       setShowAdd]       = useState(false);
  const [newText,       setNewText]       = useState("");
  const [newCat,        setNewCat]        = useState("GEN");
  const [newIso,        setNewIso]        = useState(todayISO());
  const addTextRef = useRef(null);

  const [editingId,     setEditingId]     = useState(null);
  const [editText,      setEditText]      = useState("");
  const [editCatId,     setEditCatId]     = useState(null);

  const [showCreateCat, setShowCreateCat] = useState(false);
  const [newCatCode,    setNewCatCode]    = useState("");
  const [newCatColor,   setNewCatColor]   = useState(PRESETS[0]);
  const [newCatTitle,   setNewCatTitle]   = useState("");
  const [catError,      setCatError]      = useState("");

  const dragId      = useRef(null);
  const dragOverId  = useRef(null);
  const dragOverIso = useRef(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [draggingId, setDraggingId] = useState(null);

  const today = todayISO();

  useEffect(() => { if (showAdd && addTextRef.current) addTextRef.current.focus(); }, [showAdd]);

  const getCat = (code) => categories.find(c => c.code === code) || { code, color:CREAM3, title:code };

  const toggle = (id) => setTasks(ts => ts.map(t => t.id === id ? { ...t, done:!t.done } : t));
  const remove = (id) => setTasks(ts => ts.filter(t => t.id !== id));

  const moveToday   = (id)       => setTasks(ts => ts.map(t => t.id === id ? { ...t, iso: today }          : t));
  const moveNextDay = (id, iso)  => setTasks(ts => ts.map(t => t.id === id ? { ...t, iso: addDays(iso, 1) } : t));
  const moveTwoDays = (id, iso)  => setTasks(ts => ts.map(t => t.id === id ? { ...t, iso: addDays(iso, 2) } : t));

  const changeTaskCat = (id, code) => { setTasks(ts => ts.map(t => t.id === id ? { ...t, cat: code } : t)); setEditCatId(null); };

  const addTask = () => {
    if (!newText.trim()) return;
    setTasks(ts => [...ts, { id:Date.now(), iso:newIso, text:newText.trim(), cat:newCat, done:false }]);
    setNewText(""); setShowAdd(false);
  };

  // Express entry commit — appends to that day
  const expressCommit = (iso, text, cat) => {
    setTasks(ts => [...ts, { id:Date.now(), iso, text, cat, done:false }]);
  };

  const saveEdit = (id) => {
    if (!editText.trim()) remove(id);
    else setTasks(ts => ts.map(t => t.id === id ? { ...t, text:editText.trim() } : t));
    setEditingId(null);
  };

  const createCategory = () => {
    const code = newCatCode.trim().toUpperCase();
    if (code.length < 1 || code.length > 3) { setCatError("Code must be 1–3 characters"); return; }
    if (categories.find(c => c.code === code)) { setCatError("Code already exists"); return; }
    if (!newCatTitle.trim()) { setCatError("Title is required"); return; }
    setCategories(cs => [...cs, { code, color:newCatColor, title:newCatTitle.trim() }]);
    setNewCat(code); setNewCatCode(""); setNewCatTitle(""); setNewCatColor(PRESETS[0]); setCatError("");
    setShowCreateCat(false);
  };

  const onDragStart    = useCallback((e, id) => { dragId.current = id; setDraggingId(id); e.dataTransfer.effectAllowed = "move"; }, []);
  const onDragOverTask = useCallback((e, id, iso) => { e.preventDefault(); e.stopPropagation(); dragOverId.current = id; dragOverIso.current = iso; setDropTarget(id); }, []);
  const onDragOverDate = useCallback((e, iso) => { e.preventDefault(); dragOverId.current = null; dragOverIso.current = iso; setDropTarget("DATE_" + iso); }, []);
  const onDragEnd      = useCallback(() => { dragId.current = null; dragOverId.current = null; dragOverIso.current = null; setDraggingId(null); setDropTarget(null); }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const srcId = dragId.current, dstId = dragOverId.current, dstIso = dragOverIso.current;
    if (srcId == null || dstIso == null || srcId === dstId) { onDragEnd(); return; }
    setTasks(ts => {
      const copy = [...ts];
      const srcIdx = copy.findIndex(t => t.id === srcId);
      if (srcIdx === -1) return ts;
      const [item] = copy.splice(srcIdx, 1);
      item.iso = dstIso;
      if (dstId != null) { const di = copy.findIndex(t => t.id === dstId); copy.splice(di >= 0 ? di : copy.length, 0, item); }
      else { const last = copy.map((t,i) => t.iso === dstIso ? i : -1).filter(i => i >= 0).pop(); copy.splice(last != null ? last+1 : copy.length, 0, item); }
      return copy;
    });
    onDragEnd();
  }, [onDragEnd]);

  // Build date list: past task dates + today through futureDays
  // Cap at 20 future dates only for the initial 8-day window; uncapped after "show more"
  const dates = (() => {
    const set = new Set(tasks.map(t => t.iso));
    for (let i = 0; i < futureDays; i++) set.add(addDays(today, i));
    const past   = [...set].filter(d => d <  today).sort();
    const future = [...set].filter(d => d >= today).sort();
    return [...past, ...(futureDays <= 8 ? future.slice(0, 20) : future)];
  })();

  const visibleTasks = (iso) => tasks.filter(t =>
    t.iso === iso &&
    (filter === "all" ? true : filter === "done" ? t.done : !t.done) &&
    (catFilter ? t.cat === catFilter : true)
  );

  // Default cat for express entry: last task in that day's cat, or GEN
  const defaultExpressCat = (iso) => {
    const dayTasks = tasks.filter(t => t.iso === iso);
    return dayTasks.length ? dayTasks[dayTasks.length - 1].cat : "GEN";
  };

  const totalDone = tasks.filter(t => t.done).length;
  const total     = tasks.length;

  return (
    <div
      style={{ minHeight:"100vh", background:BG, color:CREAM, fontFamily:"'DM Mono',monospace", paddingBottom:120 }}
      onDrop={onDrop} onDragOver={e => e.preventDefault()}
      onClick={() => setEditCatId(null)}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::selection{background:rgba(212,201,168,0.18)}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:${BORDER}}

        .task-row{display:flex;align-items:flex-start;gap:9px;padding:8px 4px;border-radius:4px;border-left:2px solid transparent;transition:background 0.1s,border-color 0.1s;user-select:none;position:relative;overflow:hidden}
        .task-row:hover{background:rgba(255,255,255,0.025)}
        .task-row:hover .del-btn{opacity:1}
        .task-row:hover .move-today-btn{opacity:1}
        .task-row.drop-over{background:rgba(212,201,168,0.07);border-left-color:${ACCENT}}
        .task-row.is-dragging{opacity:0.3}

        @keyframes swipeFlyRight{0%{transform:translateX(0);opacity:1}60%{transform:translateX(42px);opacity:0.6}100%{transform:translateX(0);opacity:1}}
        @keyframes swipeFlyLeft{0%{transform:translateX(0);opacity:1}60%{transform:translateX(-42px);opacity:0.6}100%{transform:translateX(0);opacity:1}}

        .drag-handle{color:${BORDER};cursor:grab;flex-shrink:0;font-size:12px;line-height:1.2;padding:2px 3px;margin-top:1px;transition:color 0.12s;position:relative;z-index:2}
        .task-row:hover .drag-handle{color:${CREAM3}}

        .del-btn{opacity:0;background:none;border:none;color:${CREAM3};cursor:pointer;font-size:16px;line-height:1;padding:0 3px;transition:color 0.12s,opacity 0.12s;flex-shrink:0;position:relative;z-index:2}
        .del-btn:hover{color:#d48a8a}

        .move-today-btn{opacity:0;background:none;border:none;color:${CREAM3};cursor:pointer;line-height:1;padding:0 3px;transition:color 0.12s,opacity 0.12s;flex-shrink:0;display:flex;align-items:center;justify-content:center;position:relative;z-index:2}
        .move-today-btn:hover{color:${ACCENT}}

        .check-box{width:15px;height:15px;border:1px solid ${BORDER};border-radius:2px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;margin-top:2px;transition:all 0.15s;position:relative;z-index:2}
        .check-box:hover{border-color:${CREAM2}}
        .check-box.done{border-color:transparent}

        .cat-badge{font-size:9px;letter-spacing:0.07em;font-weight:500;padding:2px 5px;border-radius:2px;flex-shrink:0;margin-top:1px;cursor:pointer;transition:opacity 0.12s;position:relative;z-index:2}
        .cat-badge:hover{opacity:0.75}

        .cat-inline-picker{position:absolute;z-index:80;background:${BG2};border:1px solid ${BORDER};border-radius:5px;padding:4px;display:flex;flex-direction:column;gap:2px;min-width:130px;box-shadow:0 6px 24px rgba(0,0,0,0.4)}
        .cat-inline-option{display:flex;align-items:center;gap:7px;padding:5px 8px;border-radius:3px;cursor:pointer;font-size:10px;transition:background 0.1s;white-space:nowrap}
        .cat-inline-option:hover{background:rgba(255,255,255,0.06)}
        .cat-inline-divider{height:1px;background:${BORDER2};margin:2px 0}

        .pill{background:none;border:1px solid ${BORDER2};color:${CREAM3};font-family:inherit;font-size:9px;letter-spacing:0.1em;padding:3px 9px;border-radius:20px;cursor:pointer;transition:all 0.15s;white-space:nowrap}
        .pill.active{border-color:${ACCENT};color:${ACCENT};background:rgba(212,201,168,0.07)}
        .pill:hover:not(.active){border-color:${BORDER};color:${CREAM2}}

        .cat-chip{display:inline-flex;align-items:center;gap:5px;background:none;border:1px solid ${BORDER2};border-radius:3px;color:${CREAM3};font-family:inherit;font-size:9px;letter-spacing:0.07em;padding:2px 6px;cursor:pointer;transition:all 0.12s;white-space:nowrap}
        .cat-chip.active{color:${CREAM};border-color:${BORDER}}
        .cat-chip:hover:not(.active){border-color:${BORDER}}

        .field-label{font-size:9px;letter-spacing:0.12em;color:${CREAM3};display:block;margin-bottom:5px;text-transform:uppercase}
        .t-input{background:${BG3};border:1px solid ${BORDER};border-radius:4px;color:${CREAM};font-family:inherit;font-size:12px;padding:8px 10px;outline:none;transition:border-color 0.15s;width:100%}
        .t-input:focus{border-color:rgba(212,201,168,0.35)}
        .t-input::placeholder{color:${CREAM3}}
        .t-input option{background:${BG2}}
        select.t-input{cursor:pointer;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%237a7468'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;padding-right:28px}
        input[type="date"].t-input{color-scheme:dark}
        input[type="date"].t-input::-webkit-calendar-picker-indicator{filter:invert(0.55);cursor:pointer}

        .add-panel{position:fixed;bottom:0;left:0;right:0;background:${BG2};border-top:1px solid ${BORDER};padding:16px 18px 22px;z-index:50;animation:slideUp 0.16s ease}
        @keyframes slideUp{from{transform:translateY(14px);opacity:0}to{transform:translateY(0);opacity:1}}

        .btn-primary{background:${ACCENT};border:none;color:${BG3};font-family:inherit;font-size:10px;letter-spacing:0.12em;padding:9px 20px;border-radius:4px;cursor:pointer;font-weight:500;transition:opacity 0.15s;white-space:nowrap}
        .btn-primary:hover{opacity:0.85}
        .btn-ghost{background:none;border:1px solid ${BORDER};color:${CREAM3};font-family:inherit;font-size:10px;letter-spacing:0.12em;padding:9px 18px;border-radius:4px;cursor:pointer;transition:all 0.15s}
        .btn-ghost:hover{border-color:${BORDER2};color:${CREAM2}}

        .fab{position:fixed;bottom:22px;right:20px;width:44px;height:44px;border-radius:50%;background:${ACCENT};border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,0.4);z-index:60;transition:transform 0.15s,background 0.15s}
        .fab:hover{transform:scale(1.08)}
        .fab.open{background:${BORDER};transform:rotate(45deg)}

        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.62);display:flex;align-items:center;justify-content:center;z-index:100;padding:20px}
        .modal{background:${BG2};border:1px solid ${BORDER};border-radius:8px;padding:24px;width:100%;max-width:340px}

        .color-dot{width:22px;height:22px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:all 0.12s;flex-shrink:0}
        .color-dot.sel{border-color:${CREAM};transform:scale(1.18)}
        .color-dot:hover:not(.sel){transform:scale(1.1)}

        .error-msg{color:#d48a8a;font-size:10px;margin-top:6px}
        .date-section{margin-top:20px}
        .date-hdr{display:flex;align-items:center;padding-bottom:6px;border-bottom:1px solid ${BORDER2};margin-bottom:2px;transition:border-color 0.12s}
        .date-hdr.drop-over-date{border-bottom-color:${ACCENT}}
        .date-label{font-size:9px;letter-spacing:0.2em;color:${ACCENT}}
        .progress-track{height:2px;background:${BORDER2};border-radius:1px;overflow:hidden}
        .progress-fill{height:100%;border-radius:1px;background:linear-gradient(90deg,${ACCENT},#a89070);transition:width 0.4s ease}

        .show-more-btn{display:block;width:100%;background:none;border:1px dashed ${BORDER2};color:${CREAM3};font-family:inherit;font-size:9px;letter-spacing:0.15em;padding:10px;border-radius:4px;cursor:pointer;margin-top:24px;transition:all 0.15s}
        .show-more-btn:hover{border-color:${BORDER};color:${CREAM2}}

        .express-sep{height:1px;background:${BORDER2};margin:2px 4px;opacity:0.5}
      `}</style>

      {/* ── HEADER: logo + filters on one line ── */}
      <div style={{ padding:"16px 18px 14px", borderBottom:`1px solid ${BORDER2}`, position:"sticky", top:0, background:BG, zIndex:30 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>

          {/* Logo — recreated SVG matching the shared image: thin geometric caps, O as pure circle */}
          <svg viewBox="0 0 130 22" width="104" height="18" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink:0 }}>
            {/* M */}
            <path d="M2 18V4l7 8 7-8v14" stroke={CREAM} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            {/* I */}
            <line x1="22" y1="4" x2="22" y2="18" stroke={CREAM} strokeWidth="1.1" strokeLinecap="round"/>
            {/* N */}
            <path d="M28 18V4l8 14V4" stroke={CREAM} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            {/* I */}
            <line x1="42" y1="4" x2="42" y2="18" stroke={CREAM} strokeWidth="1.1" strokeLinecap="round"/>
            {/* D — flat back, open right with serif top/bottom */}
            <path d="M48 4h5a7 7 0 0 1 0 14h-5V4z" stroke={CREAM} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            {/* O — pure circle */}
            <circle cx="73" cy="11" r="7" stroke={CREAM} strokeWidth="1.1" fill="none"/>
          </svg>

          {/* Thin separator */}
          <div style={{ width:1, height:14, background:BORDER, flexShrink:0 }} />

          {/* Progress track */}
          <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
            <div className="progress-track" style={{ width:36 }}>
              <div className="progress-fill" style={{ width:`${total ? (totalDone/total)*100 : 0}%` }} />
            </div>
          </div>

          <div style={{ width:1, height:14, background:BORDER2, flexShrink:0 }} />

          {/* Status pills */}
          <div style={{ display:"flex", gap:4, alignItems:"center", flexWrap:"wrap" }}>
            {["all","todo","done"].map(f => (
              <button key={f} className={`pill ${filter===f?"active":""}`} onClick={() => setFilter(f)}>
                {f.toUpperCase()}
              </button>
            ))}
          </div>

          <div style={{ width:1, height:14, background:BORDER2, flexShrink:0 }} />

          {/* Category chips */}
          <div style={{ display:"flex", gap:4, alignItems:"center", flexWrap:"wrap" }}>
            {categories.map(cat => (
              <button key={cat.code} className={`cat-chip ${catFilter===cat.code?"active":""}`}
                onClick={() => setCatFilter(catFilter===cat.code ? null : cat.code)}
                style={{ borderColor: catFilter===cat.code ? cat.color+"88" : undefined }}>
                <span style={{ width:5, height:5, borderRadius:"50%", background:cat.color, flexShrink:0 }} />
                {cat.code}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── TASK LIST ── */}
      <div style={{ padding:"0 18px" }}>
        {dates.map(iso => {
          const items  = visibleTasks(iso);
          const isPast = iso < today;
          if (items.length === 0 && filter !== "all") return null;

          return (
            <div key={iso} className="date-section">
              <div
                className={`date-hdr ${dropTarget==="DATE_"+iso ? "drop-over-date" : ""}`}
                onDragOver={e => onDragOverDate(e, iso)}
              >
                <span className="date-label" style={{ color: isPast ? CREAM3 : iso === today ? CREAM : ACCENT }}>
                  {isPast && "↑ "}{formatDateLabel(iso)}{iso === today && " · TODAY"}
                </span>
              </div>

              {items.map(task => {
                const cat        = getCat(task.cat);
                const isDragging = draggingId === task.id;
                const isDropOver = dropTarget === task.id;

                return (
                  <SwipeRow
                    key={task.id}
                    className={`task-row${isDragging?" is-dragging":""}${isDropOver?" drop-over":""}`}
                    style={{ opacity: task.done && !isDragging ? 0.45 : undefined }}
                    onSwipeRight={() => moveNextDay(task.id, iso)}
                    onSwipeLeft ={() => moveTwoDays(task.id, iso)}
                    draggable
                    onDragStart={e => onDragStart(e, task.id)}
                    onDragOver ={e => onDragOverTask(e, task.id, iso)}
                    onDragEnd  ={onDragEnd}
                  >
                    <span className="drag-handle" style={{ position:"relative", zIndex:2 }}>⠿</span>

                    <div className={`check-box ${task.done?"done":""}`}
                      onClick={() => toggle(task.id)}
                      style={{ borderColor: task.done ? cat.color : undefined, background: task.done ? cat.color+"20" : undefined }}>
                      {task.done && (
                        <svg width="8" height="7" viewBox="0 0 8 7" fill="none">
                          <path d="M1 3.5L3 5.5L7 1" stroke={cat.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>

                    {/* Category badge — click to change */}
                    <div style={{ position:"relative", flexShrink:0, zIndex:2 }}>
                      <span className="cat-badge"
                        style={{ background:cat.color+"1a", color:cat.color, display:"block" }}
                        onClick={e => { e.stopPropagation(); setEditCatId(editCatId===task.id ? null : task.id); }}
                        title="Click to change category">
                        {cat.code}
                      </span>
                      {editCatId === task.id && (
                        <div className="cat-inline-picker" onClick={e => e.stopPropagation()}>
                          {categories.map(c => (
                            <div key={c.code} className="cat-inline-option" onClick={() => changeTaskCat(task.id, c.code)}>
                              <span style={{ width:8, height:8, borderRadius:"50%", background:c.color, flexShrink:0 }} />
                              <span style={{ color:c.color, fontFamily:"inherit", letterSpacing:"0.05em" }}>{c.code}</span>
                              <span style={{ color:CREAM3, fontSize:9 }}>{c.title}</span>
                              {task.cat === c.code && <span style={{ color:ACCENT, marginLeft:"auto", fontSize:9 }}>✓</span>}
                            </div>
                          ))}
                          <div className="cat-inline-divider" />
                          <div className="cat-inline-option"
                            onClick={() => { setEditCatId(null); setShowCreateCat(true); }}
                            style={{ color:CREAM3, fontSize:9, letterSpacing:"0.08em" }}>
                            ＋ Create new…
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Task text */}
                    {editingId === task.id ? (
                      <input className="t-input" style={{ flex:1, fontSize:12, padding:"2px 6px", position:"relative", zIndex:2 }}
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        onBlur={() => saveEdit(task.id)}
                        onKeyDown={e => { if(e.key==="Enter") saveEdit(task.id); if(e.key==="Escape") setEditingId(null); }}
                        onClick={e => e.stopPropagation()}
                        autoFocus
                      />
                    ) : (
                      <span style={{
                        flex:1, fontSize:12, lineHeight:1.5, cursor:"text",
                        textDecoration: task.done ? "line-through" : "none",
                        color: task.done ? CREAM3 : CREAM2,
                        position:"relative", zIndex:2,
                      }}
                        onDoubleClick={() => { setEditingId(task.id); setEditText(task.text); }}
                      >{task.text}</span>
                    )}

                    {isPast && (
                      <button className="move-today-btn" title="Move to today" onClick={() => moveToday(task.id)}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <rect x="1" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                          <path d="M4 1v3M10 1v3M1 6.5h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                          <path d="M7 9.5V8M7 8l-1.5 1.5M7 8l1.5 1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    )}

                    <button className="del-btn" onClick={() => remove(task.id)}>×</button>
                  </SwipeRow>
                );
              })}

              {/* Express entry — always at bottom of each day (when filter is "all") */}
              {filter === "all" && !catFilter && (
                <>
                  {items.length > 0 && <div className="express-sep" />}
                  <ExpressEntry
                    key={`expr-${iso}`}
                    iso={iso}
                    defaultCat={defaultExpressCat(iso)}
                    categories={categories}
                    onCommit={(text, cat) => expressCommit(iso, text, cat)}
                  />
                </>
              )}
            </div>
          );
        })}

        {/* Show more */}
        <button className="show-more-btn" onClick={() => setFutureDays(d => d + 7)}>
          + 7 MORE DAYS
        </button>
      </div>

      {/* ── FAB ── */}
      <button className={`fab ${showAdd?"open":""}`} onClick={() => setShowAdd(v => !v)}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1v12M1 7h12" stroke={showAdd ? CREAM3 : BG3} strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>

      {/* ── ADD PANEL ── */}
      {showAdd && (
        <div className="add-panel">
          <div style={{ display:"flex", gap:8, marginBottom:10, alignItems:"flex-end" }}>
            <div style={{ flexShrink:0, width:136 }}>
              <label className="field-label">Category</label>
              <select className="t-input" value={newCat}
                onChange={e => { if(e.target.value==="__new__") { setShowCreateCat(true); } else setNewCat(e.target.value); }}>
                {categories.map(c => <option key={c.code} value={c.code}>{c.code} — {c.title}</option>)}
                <option value="__new__">＋ Create new…</option>
              </select>
            </div>
            <div style={{ flex:1 }}>
              <label className="field-label">Task</label>
              <input ref={addTextRef} className="t-input" placeholder="What needs doing…"
                value={newText} onChange={e => setNewText(e.target.value)}
                onKeyDown={e => { if(e.key==="Enter") addTask(); if(e.key==="Escape") setShowAdd(false); }}
              />
            </div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
            <div style={{ flex:1 }}>
              <label className="field-label">Date</label>
              <input type="date" className="t-input" value={newIso} min={today} onChange={e => setNewIso(e.target.value)} />
            </div>
            <button className="btn-primary" style={{ flexShrink:0 }} onClick={addTask}>ADD</button>
          </div>
        </div>
      )}

      {/* ── CREATE CATEGORY MODAL ── */}
      {showCreateCat && (
        <div className="modal-overlay" onClick={e => { if(e.target===e.currentTarget) { setShowCreateCat(false); setCatError(""); } }}>
          <div className="modal">
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
              <span style={{ fontSize:9, letterSpacing:"0.2em", color:ACCENT }}>NEW CATEGORY</span>
              <button onClick={() => { setShowCreateCat(false); setCatError(""); }}
                style={{ background:"none", border:"none", color:CREAM3, cursor:"pointer", fontSize:18, lineHeight:1, padding:"0 2px" }}
                onMouseEnter={e => e.target.style.color=CREAM} onMouseLeave={e => e.target.style.color=CREAM3}>×</button>
            </div>

            <div style={{ display:"flex", gap:8, marginBottom:14, alignItems:"flex-end" }}>
              <div style={{ width:90 }}>
                <label className="field-label">Code (1–3)</label>
                <input className="t-input" maxLength={3} placeholder="MKT"
                  style={{ letterSpacing:"0.2em", textTransform:"uppercase", textAlign:"center" }}
                  value={newCatCode}
                  onChange={e => { setNewCatCode(e.target.value.toUpperCase()); setCatError(""); }}
                />
              </div>
              <div style={{ flex:1 }}>
                <label className="field-label">Short Title</label>
                <input className="t-input" placeholder="e.g. Marketing"
                  value={newCatTitle}
                  onChange={e => { setNewCatTitle(e.target.value); setCatError(""); }}
                  onKeyDown={e => e.key==="Enter" && createCategory()}
                />
              </div>
            </div>

            <div style={{ marginBottom:14 }}>
              <label className="field-label">Color</label>
              <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:6 }}>
                {PRESETS.map(c => (
                  <div key={c} className={`color-dot ${newCatColor===c?"sel":""}`} style={{ background:c }} onClick={() => setNewCatColor(c)} />
                ))}
                <label style={{ position:"relative", cursor:"pointer", margin:0 }}>
                  <div className={`color-dot ${!PRESETS.includes(newCatColor)?"sel":""}`}
                    style={{ background:newCatColor, border:`2px dashed ${CREAM3}` }} />
                  <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)}
                    style={{ position:"absolute", opacity:0, width:0, height:0 }} />
                </label>
              </div>
            </div>

            {newCatCode.length >= 1 && newCatTitle && (
              <div style={{ marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:9, color:CREAM3, letterSpacing:"0.1em" }}>PREVIEW</span>
                <span className="cat-badge" style={{ background:newCatColor+"1a", color:newCatColor, fontSize:11, padding:"3px 8px", cursor:"default" }}>
                  {newCatCode}
                </span>
                <span style={{ fontSize:11, color:CREAM2 }}>{newCatTitle}</span>
              </div>
            )}

            {catError && <div className="error-msg">{catError}</div>}

            <div style={{ display:"flex", gap:8, marginTop:18, justifyContent:"flex-end" }}>
              <button className="btn-ghost" onClick={() => { setShowCreateCat(false); setCatError(""); }}>CANCEL</button>
              <button className="btn-primary" onClick={createCategory}>CREATE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
