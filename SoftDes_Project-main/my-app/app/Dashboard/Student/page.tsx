"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type RoomStatus = "avail" | "unavail" | "vacant";

interface Room {
  id: number;
  room: string;
  section: string;
  subject: string;
  professor: string;
  status: RoomStatus;
  time: string;
  startRaw: string; 
}

const EVENT_DAYS: number[] = [3, 8, 15, 21];
const API_BASE = "http://localhost:8080/api/private/v1";

function formatTime(t: string): string {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${suffix}`;
}

function mapApiRow(row: any): Room {
  const startRaw = row.start_time?.slice(0, 5) ?? ""; // "08:00"
  const end = formatTime(row.end_time);

  return {
    id: row.id,
    room: row.room,
    section: row.class_section ?? "—",
    subject: row.subject_code ?? "—",
    professor: row.professor ?? "—",
    status:
      row.status?.toLowerCase() === "vacant"
        ? "vacant"
        : row.status?.toLowerCase() === "occupied"
        ? "unavail"
        : "avail",

    time: startRaw && end ? `${formatTime(row.start_time)} – ${end}` : "—",
    startRaw, // ✅ keep raw for filtering
  };
}

function getAuth() {
  if (typeof window === "undefined" || !window.localStorage) {
    return { token: "", userName: "", role: "" };
  }
  return {
    token:    localStorage.getItem("token") ?? "",
    userName: localStorage.getItem("user_name") ?? "Student",
    role:     localStorage.getItem("user_role") ?? "",
  };
}

export default function StudentDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSchoolDay, setIsSchoolDay] = useState(true);
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [search, setSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [userName, setUserName] = useState("Student");
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [newName, setNewName] = useState("");
  const [calDate, setCalDate]   = useState(new Date());
  const [startTimeFilter, setStartTimeFilter] = useState("all");

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    const { token, userName: name } = getAuth();
    if (!token) {
      router.replace("/login");
      return;
    }
    setUserName(name || "Student");
  }, [router]);

  // ensure logout modal is closed on mount (avoid stale HMR state showing modal)
  useEffect(() => {
    setIsLogoutOpen(false);
  }, []);

  // ── Load schedule ──────────────────────────────────────────────────────────
  const loadSchedule = useCallback(async () => {
    const { token } = getAuth();
    const dow = new Date().getDay();
    if (dow === 0 || dow === 5 || dow === 6) {
      setIsSchoolDay(false);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/dashboard/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      setAllRooms((data?.data ?? []).map(mapApiRow));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedule();
    const interval = setInterval(() => void loadSchedule(), 30_000);
    return () => clearInterval(interval);
  }, [loadSchedule]);

  const filteredRooms = useMemo(() => {
  return allRooms.filter((r) => {
    const q = search.toLowerCase();

    const matchSearch =
      r.room.toLowerCase().includes(q) ||
      r.subject.toLowerCase().includes(q) ||
      r.professor.toLowerCase().includes(q) ||
      r.section.toLowerCase().includes(q);

    const matchStatus =
      statusFilter === "all" || r.status === statusFilter;

    const matchTime =
  startTimeFilter === "all" ||
  r.startRaw === startTimeFilter;

    return matchSearch && matchStatus && matchTime;
  });
}, [allRooms, search, statusFilter, startTimeFilter]);

  const initials = useMemo(() => {
    return userName
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, [userName]);

  // ── DETAIL MODAL ──────────────────────────────────────────────────────────
  function openDetail(room: Room) {
    if (room.status === "vacant") return;
    setSelectedRoom(room);
    setIsDetailOpen(true);
  }

  const handleLogout = () => {
    localStorage.clear();
    router.replace("/login");
  };

  const handleUpdateName = async () => {
    if (!newName.trim()) return;
    const { token } = getAuth();
    try {
      const res = await fetch(`${API_BASE}/profile/update-name`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to update name");

      localStorage.setItem("user_name", newName.trim());
      setUserName(newName.trim());
      setIsProfileOpen(false);
      setNewName("");
    } catch (err) {
      console.error("Update name failed:", err);
      alert("Failed to update profile name.");
    }
  };

  // ── CALENDAR ──────────────────────────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const today = new Date();
    const year  = calDate.getFullYear();
    const month = calDate.getMonth();
    const firstDow    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays    = new Date(year, month, 0).getDate();

    const days = [];
    for (let i = firstDow - 1; i >= 0; i--) {
      days.push({ d: prevDays - i, type: "other" });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
      days.push({ d, type: isToday ? "today" : "current", event: EVENT_DAYS.includes(d) });
    }
    const remaining = 42 - firstDow - daysInMonth;
    for (let d = 1; d <= remaining; d++) {
      days.push({ d, type: "other" });
    }
    return days;
  }, [calDate]);

  // ── HELPERS ───────────────────────────────────────────────────────────────
  const todayLabel = new Date().toLocaleDateString("en-PH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Exo+2:wght@300;400;500;600&display=swap');

        :root {
          --bg: #0a0a12;
          --sidebar: #141418;
          --card-solid: #1c1c22;
          --card-border: #2a2a35;
          --accent: #f97316;
          --accent2: #fb923c;
          --accent-dim: rgba(249,115,22,.12);
          --accent-grad: linear-gradient(135deg,#ea580c,#f97316);
          --text: #e2e8f0;
          --muted: #64748b;
          --avail: #22c55e;
          --avail-dim: rgba(34,197,94,.12);
          --unavail: #ef4444;
          --unavail-dim: rgba(239,68,68,.12);
          --vacant: #94a3b8;
          --vacant-dim: rgba(148,163,184,.10);
          --glow: rgba(59,130,246,.2);
        }

        *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
        html, body, #__next { height:100%; width:100%; overflow:hidden; }
        body { font-family:'Exo 2',sans-serif; background:var(--bg); color:var(--text); }

        .s-root { display:flex; width:100vw; height:100vh; overflow:hidden; }

        /* ── SIDEBAR ── */
        .s-sidebar {
          width:200px; min-width:200px; height:100vh; background:var(--sidebar);
          border-right:1px solid var(--card-border); display:flex; flex-direction:column;
          align-items:center; padding:24px 0 20px; flex-shrink:0; position:relative; z-index:10;
        }
        .s-sidebar::after {
          content:''; position:absolute; top:0; right:0; bottom:0; width:1px;
          background:linear-gradient(to bottom,transparent,rgba(59,130,246,.4),transparent);
        }
        .s-logo {
          width:72px; height:72px; border-radius:50%; background:var(--accent-grad);
          display:flex; align-items:center; justify-content:center;
          font-family:'Rajdhani',sans-serif; font-size:20px; font-weight:700; color:#fff;
          box-shadow:0 0 28px var(--glow); margin-bottom:28px; letter-spacing:1px; flex-shrink:0;
        }
        .s-nav { width:100%; padding:0 12px; flex:1; }
        .s-nav a {
          display:flex; align-items:center; gap:10px; padding:11px 14px; border-radius:8px;
          color:var(--muted); font-family:'Rajdhani',sans-serif; font-size:14px; font-weight:600;
          letter-spacing:1.5px; text-transform:uppercase; text-decoration:none;
          transition:all .2s; margin-bottom:3px; cursor:pointer;
        }
        .s-nav a:hover, .s-nav a.active {
          background:rgba(59,130,246,.12); color:var(--text); box-shadow:inset 3px 0 0 var(--accent);
        }
        .user-name-display-side {
          padding: 12px 16px;
          margin-bottom: 10px;
          font-family: 'Rajdhani', sans-serif;
          font-weight: 700;
          font-size: 15px;
          color: white;
          border-bottom: 1px solid var(--card-border);
          letter-spacing: 1px;
          width: 100%;
          text-align: center;
        }
        .s-nav a svg { width:17px; height:17px; opacity:.7; flex-shrink:0; }
        .s-bottom { width:100%; padding:16px 12px 0; border-top:1px solid var(--card-border); flex-shrink:0; }
        .s-user-badge {
          display:flex; align-items:center; gap:10px; padding:10px 12px;
          background:var(--card-solid); border-radius:8px; border:1px solid var(--card-border);
          margin-bottom:10px;
        }
        .s-avatar {
          width:32px; height:32px; border-radius:50%; background:var(--accent-grad);
          display:flex; align-items:center; justify-content:center;
          font-weight:700; font-size:12px; color:#fff; flex-shrink:0;
        }
        .s-user-info { font-size:12px; }
        .s-user-info strong { display:block; font-family:'Rajdhani',sans-serif; font-size:13px; }
        .s-user-info span { color:var(--muted); font-size:11px; }
        .s-logout {
          width:100%; display:flex; align-items:center; gap:10px; padding:11px 14px;
          border-radius:8px; color:#ef4444; font-family:'Rajdhani',sans-serif; font-size:14px;
          font-weight:600; letter-spacing:1.5px; text-transform:uppercase; cursor:pointer;
          background:none; border:none; transition:all .2s;
        }
        .s-logout:hover { background:rgba(239,68,68,.12); color:#f87171; }
        .s-logout svg { width:17px; height:17px; opacity:.8; flex-shrink:0; }

        /* ── MAIN ── */
        .s-main { flex:1; display:flex; flex-direction:column; height:100vh; overflow:hidden; min-width:0; }
        .s-topbar {
          height:60px; min-height:60px; background:var(--sidebar);
          border-bottom:1px solid var(--card-border);
          display:flex; align-items:center; justify-content:space-between;
          padding:0 24px; flex-shrink:0;
        }
        .s-page-title {
          font-family:'Rajdhani',sans-serif; font-size:18px; font-weight:700;
          letter-spacing:3px; text-transform:uppercase;
          background:var(--accent-grad); -webkit-background-clip:text;
          -webkit-text-fill-color:transparent; background-clip:text; white-space:nowrap;
        }
        .s-topbar-right { display:flex; align-items:center; gap:10px; flex-shrink:0; }
        .search-bar {
          background:var(--card-solid); border:1px solid var(--card-border);
          border-radius:8px; padding:7px 13px; color:var(--text);
          font-family:'Exo 2',sans-serif; font-size:13px; outline:none; width:190px; transition:border-color .2s;
        }
        .search-bar:focus { border-color:var(--accent); }
        .search-bar::placeholder { color:var(--muted); }
        .filter-btn {
          background:var(--card-solid); color:var(--text);
          border:1px solid var(--card-border);
          border-radius:8px; padding:7px 13px; appearance:none;
          font-family:'Rajdhani',sans-serif; font-size:13px; font-weight:600;
          letter-spacing:.5px; cursor:pointer; transition:all .2s;
        }
        .filter-btn:hover { border-color:var(--accent); }
        .filter-btn option {
          background:var(--card-solid);
          color:var(--text);
        }

        /* ── CONTENT ── */
        .s-content { flex:1; display:flex; overflow:hidden; min-height:0; }
        .s-rooms { flex:1; padding:20px 24px; overflow-y:auto; min-width:0; }
        .s-section-header {
          display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;
        }
        .s-section-label {
          font-family:'Rajdhani',sans-serif; font-size:12px; font-weight:600;
          letter-spacing:3px; text-transform:uppercase; color:var(--muted);
        }
        .s-room-count {
          background:rgba(59,130,246,.15); border:1px solid rgba(59,130,246,.35);
          border-radius:20px; padding:3px 12px;
          font-size:11px; font-family:'Rajdhani',sans-serif; font-weight:600; color:var(--accent2);
        }
        .s-date-sub {
          font-size:12px; color:var(--muted); margin-bottom:16px;
        }
        .s-rooms-grid {
          display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:14px;
        }

        /* ── NO SCHOOL DAY ── */
        .no-school {
          flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;
          gap:16px; padding:40px; text-align:center;
        }
        .no-school-icon {
          width:80px; height:80px; border-radius:50%;
          background:rgba(59,130,246,.08); border:1px solid rgba(59,130,246,.2);
          display:flex; align-items:center; justify-content:center;
        }
        .no-school-icon svg { width:36px; height:36px; stroke:var(--muted); }
        .no-school-title {
          font-family:'Rajdhani',sans-serif; font-size:22px; font-weight:700;
          letter-spacing:1px; color:var(--text);
        }
        .no-school-desc { font-size:13px; color:var(--muted); line-height:1.6; max-width:280px; }

        /* ── LOADING ── */
        .loading-grid {
          display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:14px;
        }
        .skeleton-card {
          background:var(--card-solid); border:1px solid var(--card-border);
          border-radius:12px; padding:18px; height:220px;
          display:flex; flex-direction:column; gap:12px;
        }
        .skeleton {
          background:linear-gradient(90deg,#1c1c22 25%,#252530 50%,#1c1c22 75%);
          background-size:200% 100%; animation:shimmer 1.4s infinite; border-radius:6px;
        }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

        /* ── ROOM CARD ── */
        .room-card {
          background:var(--card-solid); border:1px solid var(--card-border);
          border-radius:12px; padding:18px; display:flex; flex-direction:column; gap:10px;
          transition:transform .2s, box-shadow .2s, border-color .2s;
          position:relative; overflow:hidden; animation:fadeUp .4s ease both; cursor:pointer;
        }
        .room-card::before {
          content:''; position:absolute; top:0; left:0; right:0; height:2px; opacity:0; transition:opacity .2s;
        }
        .room-card.avail::before   { background:linear-gradient(90deg,var(--avail),#4ade80); }
        .room-card.unavail::before { background:linear-gradient(90deg,var(--unavail),#f87171); }
        .room-card.vacant::before  { background:linear-gradient(90deg,var(--vacant),#cbd5e1); }
        .room-card:hover { transform:translateY(-3px); border-color:rgba(59,130,246,.4); box-shadow:0 10px 28px rgba(0,0,0,.4); }
        .room-card:hover::before { opacity:1; }
        .room-card.vacant { opacity:.75; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .room-card:nth-child(1){animation-delay:.04s} .room-card:nth-child(2){animation-delay:.08s}
        .room-card:nth-child(3){animation-delay:.12s} .room-card:nth-child(4){animation-delay:.16s}
        .room-card:nth-child(5){animation-delay:.2s}  .room-card:nth-child(6){animation-delay:.24s}

        .rc-top { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }
        .rc-name { font-family:'Rajdhani',sans-serif; font-size:17px; font-weight:700; letter-spacing:1px; }
        .rc-type { font-size:11px; color:var(--muted); margin-top:2px; }
        .rc-badge {
          display:inline-flex; align-items:center; gap:5px; padding:3px 9px; border-radius:20px;
          font-size:10px; font-weight:700; font-family:'Rajdhani',sans-serif;
          letter-spacing:1px; text-transform:uppercase; flex-shrink:0; white-space:nowrap;
        }
        .rc-badge.avail   { background:var(--avail-dim);   color:var(--avail);   border:1px solid rgba(34,197,94,.3); }
        .rc-badge.unavail { background:var(--unavail-dim); color:var(--unavail); border:1px solid rgba(239,68,68,.3); }
        .rc-badge.vacant  { background:var(--vacant-dim);  color:var(--vacant);  border:1px solid rgba(148,163,184,.25); }
        .badge-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
        .rc-badge.avail   .badge-dot { background:var(--avail); }
        .rc-badge.unavail .badge-dot { background:var(--unavail); }
        .rc-badge.vacant  .badge-dot { background:var(--vacant); }
        .rc-subject { font-size:14px; font-weight:600; color:var(--text); border-left:2px solid var(--accent); padding-left:10px; line-height:1.3; }
        .rc-subject.vacant-subject { color:var(--muted); border-left-color:var(--vacant); font-style:italic; font-weight:400; }
        .rc-details { display:flex; flex-direction:column; gap:5px; }
        .rc-detail-row { display:flex; align-items:center; gap:7px; font-size:12px; color:var(--muted); }
        .rc-detail-row svg { width:12px; height:12px; flex-shrink:0; opacity:.7; }
        .rc-detail-row span { color:#94a3b8; }
        .view-btn {
          width:100%; padding:9px; background:transparent; border:1px solid rgba(59,130,246,.4);
          border-radius:8px; color:var(--accent2); font-family:'Rajdhani',sans-serif; font-size:12px;
          font-weight:700; letter-spacing:2px; text-transform:uppercase; cursor:pointer; transition:all .2s; margin-top:2px;
        }
        .view-btn:hover { background:var(--accent-dim); border-color:var(--accent); }

        /* ── RIGHT PANEL ── */
        .s-right-panel {
          width:252px; min-width:252px; border-left:1px solid var(--card-border);
          display:flex; flex-direction:column; overflow-y:auto; background:var(--sidebar); flex-shrink:0;
        }
        .panel-block { padding:18px; border-bottom:1px solid var(--card-border); flex-shrink:0; }
        .panel-title {
          font-family:'Rajdhani',sans-serif; font-size:12px; font-weight:600;
          letter-spacing:3px; text-transform:uppercase; color:var(--muted);
          margin-bottom:13px; display:flex; align-items:center; gap:7px;
        }
        .panel-title svg { width:14px; height:14px; }

        /* ── CALENDAR ── */
        .cal-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
        .cal-month  { font-family:'Rajdhani',sans-serif; font-size:14px; font-weight:700; letter-spacing:1px; }
        .cal-nav    { display:flex; gap:4px; }
        .cal-nav button {
          background:var(--card-solid); border:1px solid var(--card-border); color:var(--text);
          border-radius:6px; width:24px; height:24px; display:flex; align-items:center;
          justify-content:center; cursor:pointer; font-size:13px; transition:all .15s;
        }
        .cal-nav button:hover { border-color:var(--accent); color:var(--accent); }
        .cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
        .cal-day-label {
          text-align:center; font-size:9px; color:var(--muted);
          font-family:'Rajdhani',sans-serif; font-weight:600; letter-spacing:1px; padding-bottom:3px;
        }
        .cal-day {
          aspect-ratio:1; display:flex; align-items:center; justify-content:center;
          font-size:11px; border-radius:6px; cursor:pointer; transition:all .15s;
          font-family:'Rajdhani',sans-serif; font-weight:500;
        }
        .cal-day:hover { background:rgba(59,130,246,.2); }
        .cal-day.other-month { color:var(--muted); opacity:.35; }
        .cal-day.today { background:var(--accent-grad); color:#fff; font-weight:700; box-shadow:0 2px 8px var(--glow); }
        .cal-day.has-event { position:relative; }
        .cal-day.has-event::after {
          content:''; position:absolute; bottom:2px; left:50%; transform:translateX(-50%);
          width:3px; height:3px; border-radius:50%; background:var(--accent2);
        }

        /* ── UPCOMING ── */
        .upcoming-item {
          display:flex; gap:12px; align-items:flex-start;
          padding:9px 0; border-bottom:1px solid rgba(37,37,56,.7);
        }
        .upcoming-item:last-child { border-bottom:none; }
        .upcoming-time { font-family:'Rajdhani',sans-serif; font-size:13px; font-weight:700; color:var(--accent2); flex-shrink:0; min-width:44px; }
        .upcoming-info strong { display:block; font-size:13px; font-weight:600; margin-bottom:2px; color:var(--text); }
        .upcoming-info span   { font-size:11px; color:var(--muted); }

        /* ── DETAIL MODAL ── */
        .detail-overlay {
          position:fixed; inset:0; background:rgba(0,0,0,.75); backdrop-filter:blur(6px);
          display:flex; align-items:center; justify-content:center;
          z-index:100; opacity:0; pointer-events:none; transition:opacity .25s;
        }
        .detail-overlay.open { opacity:1; pointer-events:all; }
        .detail-modal {
          background:var(--card-solid); border:1px solid var(--card-border);
          border-radius:16px; width:400px; max-width:92vw;
          transform:translateY(20px); transition:transform .25s; overflow:hidden; position:relative;
        }
        .detail-overlay.open .detail-modal { transform:translateY(0); }
        .detail-close {
          position:absolute; top:12px; right:14px; background:none; border:none;
          color:var(--muted); font-size:18px; cursor:pointer; transition:color .2s; z-index:2;
        }
        .detail-close:hover { color:var(--text); }
        .detail-hero {
          padding:24px 24px 18px; display:flex; align-items:flex-start; justify-content:space-between;
          border-bottom:1px solid var(--card-border); position:relative;
        }
        .detail-hero::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; }
        .detail-hero.avail::before   { background:linear-gradient(90deg,var(--avail),#4ade80); }
        .detail-hero.unavail::before { background:linear-gradient(90deg,var(--unavail),#f87171); }
        .detail-room-name { font-family:'Rajdhani',sans-serif; font-size:24px; font-weight:700; letter-spacing:1px; }
        .detail-badge {
          display:inline-flex; align-items:center; gap:5px; padding:4px 12px; border-radius:20px;
          font-size:11px; font-weight:700; font-family:'Rajdhani',sans-serif;
          letter-spacing:1px; text-transform:uppercase; flex-shrink:0;
        }
        .detail-badge.avail   { background:var(--avail-dim);   color:var(--avail);   border:1px solid rgba(34,197,94,.3); }
        .detail-badge.unavail { background:var(--unavail-dim); color:var(--unavail); border:1px solid rgba(239,68,68,.3); }
        .detail-badge .badge-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
        .detail-badge.avail   .badge-dot { background:var(--avail); }
        .detail-badge.unavail .badge-dot { background:var(--unavail); }
        .detail-subject {
          padding:14px 24px; font-size:16px; font-weight:600; color:var(--text);
          border-bottom:1px solid var(--card-border); border-left:3px solid var(--accent);
          background:rgba(59,130,246,.05);
        }
        .detail-grid { display:grid; grid-template-columns:1fr 1fr; }
        .detail-item { padding:14px 20px; border-bottom:1px solid var(--card-border); border-right:1px solid var(--card-border); }
        .detail-item:nth-child(even) { border-right:none; }
        .detail-item:nth-last-child(-n+2) { border-bottom:none; }
        .detail-label { font-size:10px; color:var(--muted); font-family:'Rajdhani',sans-serif; font-weight:600; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:4px; }
        .detail-value { font-size:14px; font-weight:600; color:var(--text); }

        /* ── PROFILE MODAL ── */
        .modal-overlay {
          position:fixed; inset:0; background:rgba(0,0,0,.75); backdrop-filter:blur(6px);
          display:flex; align-items:center; justify-content:center;
          z-index:200; opacity:0; pointer-events:none; transition:opacity .25s;
        }
        .modal-overlay.open { opacity:1; pointer-events:all; }
        .modal-content {
          background:var(--card-solid); border:1px solid var(--card-border);
          border-radius:16px; width:400px; max-width:92vw; padding:28px 28px 24px;
          transform:translateY(20px); transition:transform .25s; text-align:center;
        }
        .modal-overlay.open .modal-content { transform:translateY(0); }
        .modal-content h3 {
          font-family:'Rajdhani',sans-serif; font-size:22px; font-weight:700; letter-spacing:1px; margin-bottom:8px;
        }
        .modal-content p {
          font-size:13px; color:var(--muted); margin-bottom:20px; line-height:1.5;
        }
        .modal-input {
          width:100%; padding:12px 14px; border-radius:10px; border:1px solid var(--card-border);
          background:var(--bg); color:var(--text); font-family:'Exo 2',sans-serif; font-size:14px; margin-bottom:16px;
        }
        .modal-input:focus { border-color:var(--accent); outline:none; }
        .reserve-btn,
        .cancel-btn {
          flex:1; padding:12px; border-radius:10px; font-family:'Rajdhani',sans-serif;
          font-size:13px; font-weight:700; letter-spacing:1px; text-transform:uppercase; cursor:pointer;
          border:1px solid transparent;
        }
        .reserve-btn { background:var(--accent); color:#fff; }
        .reserve-btn:hover { background:var(--accent2); }
        .cancel-btn { background:transparent; border-color:var(--card-border); color:var(--text); }
        .cancel-btn:hover { border-color:var(--muted); }

        /* ── LOGOUT MODAL ── */
        .logout-overlay {
          position:fixed; inset:0; background:rgba(0,0,0,.75); backdrop-filter:blur(6px);
          display:flex; align-items:center; justify-content:center;
          z-index:200; opacity:0; pointer-events:none; transition:opacity .25s;
        }
        .logout-overlay.open { opacity:1; pointer-events:all; }
        .logout-modal {
          background:var(--card-solid); border:1px solid var(--card-border);
          border-radius:16px; width:360px; max-width:92vw; padding:28px 28px 24px;
          transform:translateY(20px); transition:transform .25s; text-align:center;
        }
        .logout-overlay.open .logout-modal { transform:translateY(0); }
        .logout-icon {
          width:56px; height:56px; border-radius:50%;
          background:rgba(239,68,68,.12); border:1px solid rgba(239,68,68,.3);
          display:flex; align-items:center; justify-content:center; margin:0 auto 16px;
        }
        .logout-icon svg { width:26px; height:26px; stroke:#ef4444; }
        .logout-title { font-family:'Rajdhani',sans-serif; font-size:22px; font-weight:700; letter-spacing:1px; margin-bottom:8px; }
        .logout-desc  { font-size:13px; color:var(--muted); margin-bottom:24px; line-height:1.5; }
        .logout-btns  { display:flex; gap:10px; }
        .btn-cancel {
          flex:1; padding:11px; background:transparent; border:1px solid var(--card-border);
          border-radius:8px; color:var(--text); font-family:'Rajdhani',sans-serif; font-size:13px;
          font-weight:700; letter-spacing:1.5px; text-transform:uppercase; cursor:pointer; transition:all .2s;
        }
        .btn-cancel:hover { border-color:var(--muted); }
        .btn-confirm {
          flex:1; padding:11px; background:rgba(239,68,68,.15); border:1px solid rgba(239,68,68,.4);
          border-radius:8px; color:#f87171; font-family:'Rajdhani',sans-serif; font-size:13px;
          font-weight:700; letter-spacing:1.5px; text-transform:uppercase; cursor:pointer; transition:all .2s;
        }
        .btn-confirm:hover { background:rgba(239,68,68,.25); border-color:#ef4444; }

        /* ── SCROLLBAR ── */
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:var(--card-border); border-radius:4px; }
        ::-webkit-scrollbar-thumb:hover { background:var(--accent); }
      `}</style>

      <div className="s-root">
        {/* ── SIDEBAR ── */}
        <aside className="s-sidebar">
          <div className="s-logo">CCSE</div>
          <nav className="s-nav">
            <div className="user-name-display-side">{userName}</div>
            <a onClick={() => setIsProfileOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              Profile
            </a>
          </nav>
          <div className="s-bottom">
            <div className="s-user-badge">
              <div className="s-avatar">{initials}</div>
              <div className="s-user-info">
                <strong>{userName}</strong>
                <span>Student</span>
              </div>
            </div>
            <button className="s-logout" onClick={() => setIsLogoutOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Logout
            </button>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <div className="s-main">
          <div className="s-topbar">
            <div className="s-page-title">Classroom</div>
            <div className="s-topbar-right">
              {isSchoolDay && !loading && (
                <>
                  <input 
                    className="search-bar" 
                    type="text" 
                    placeholder="Search rooms…" 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <select className="filter-btn" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="all">All Rooms</option>
                    <option value="unavail">Occupied</option>
                    <option value="vacant">Vacant</option>
                  </select>
                  <select
  className="filter-btn"
  value={startTimeFilter}
  onChange={(e) => setStartTimeFilter(e.target.value)}
>
  <option value="all">All Times</option>
  <option value="08:00">8:00 AM</option>
  <option value="09:30">9:30 AM</option>
  <option value="11:00">11:00 AM</option>
  <option value="12:30">12:30 PM</option>
  <option value="14:00">2:00 PM</option>
  <option value="15:30">3:30 PM</option>
  <option value="17:00">5:00 PM</option>
  <option value="18:30">6:30 PM</option>
</select>
                </>
              )}
            </div>
          </div>

          <div className="s-content">
            {/* Rooms area */}
            <div className="s-rooms">
              {loading ? (
                <>
                  <div className="s-section-header" style={{ marginBottom: 16 }}>
                    <span className="s-section-label">Loading Rooms…</span>
                  </div>
                  <div className="loading-grid">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="skeleton-card">
                        <div className="skeleton" style={{ height: 20, width: "60%" }} />
                        <div className="skeleton" style={{ height: 14, width: "40%" }} />
                        <div className="skeleton" style={{ height: 18, width: "80%", marginTop: 4 }} />
                        <div className="skeleton" style={{ height: 12, width: "55%" }} />
                        <div className="skeleton" style={{ height: 12, width: "65%" }} />
                        <div className="skeleton" style={{ height: 12, width: "50%" }} />
                        <div className="skeleton" style={{ height: 34, marginTop: "auto" }} />
                      </div>
                    ))}
                  </div>
                </>
              ) : !isSchoolDay ? (
                <div className="no-school">
                  <div className="no-school-icon">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </div>
                  <div className="no-school-title">No Classes Today</div>
                  <div className="no-school-desc">
                    Classes run Monday to Thursday. Enjoy your day off — see you next school day!
                  </div>
                </div>
              ) : (
                <>
                  <div className="s-section-header">
                    <span className="s-section-label">Today's Rooms</span>
                    <span className="s-room-count" id="roomCount">
  {filteredRooms.length} Rooms
</span>
                     </div>
                  <div className="s-date-sub">{todayLabel}</div>
                  <div className="s-rooms-grid">
                    {filteredRooms.map((room) => {
                      const isVacant = room.status === "vacant";
                      return (
                        <div key={room.id} className={`room-card ${room.status}`} onClick={() => openDetail(room)}>
                          <div className="rc-top">
                            <div className="rc-left">
                              <div className="rc-name">{room.room}</div>
                            </div>
                            <div className={`rc-badge ${room.status}`}>
                              <span className="badge-dot"></span>
                              {room.status === "avail" ? "Available" : room.status === "unavail" ? "Occupied" : "Vacant"}
                            </div>
                          </div>
                          <div className={`rc-subject ${isVacant ? "vacant-subject" : ""}`}>
                            {isVacant ? "No class scheduled" : room.subject}
                          </div>
                          <div className="rc-details">
                            <div className="rc-detail-row">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                              <span>{room.professor}</span>
                            </div>
                            <div className="rc-detail-row">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                              <span>{room.time}</span>
                            </div>
                            <div className="rc-detail-row">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>
                              <span>{room.section}</span>
                            </div>
                          </div>
                          {!isVacant && <button className="view-btn">View Details</button>}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Right Panel */}
            <div className="s-right-panel">
              <div className="panel-block">
                <div className="panel-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  Calendar
                </div>
                <div className="cal-header">
                  <span className="cal-month">
                    {calDate.toLocaleString("default", { month: "long", year: "numeric" })}
                  </span>
                  <div className="cal-nav">
                    <button onClick={() => setCalDate(new Date(calDate.setMonth(calDate.getMonth() - 1)))}>‹</button>
                    <button onClick={() => setCalDate(new Date(calDate.setMonth(calDate.getMonth() + 1)))}>›</button>
                  </div>
                </div>
                <div className="cal-grid">
                  {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => <div key={d} className="cal-day-label">{d}</div>)}
                  {calendarDays.map((day, i) => (
                    <div 
                      key={i} 
                      className={`cal-day ${day.type === 'other' ? 'other-month' : ''} ${day.type === 'today' ? 'today' : ''} ${day.event ? 'has-event' : ''}`}
                    >
                      {day.d}
                    </div>
                  ))}
                </div>
              </div>

             
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <div className={`detail-overlay ${isDetailOpen ? 'open' : ''}`} onClick={() => setIsDetailOpen(false)}>
        <div className="detail-modal">
          <button className="detail-close" onClick={() => setIsDetailOpen(false)}>✕</button>
          {selectedRoom && (
            <>
              <div className={`detail-hero ${selectedRoom.status}`}>
                <div className="detail-room-name">{selectedRoom.room}</div>
                <div className={`detail-badge ${selectedRoom.status}`}>
                  <span className="badge-dot"></span> {selectedRoom.status === "avail" ? "Available" : "Occupied"}
                </div>
              </div>
              <div className="detail-subject">{selectedRoom.subject}</div>
              <div className="detail-grid">
                <div className="detail-item"><div className="detail-label">Professor</div><div className="detail-value">{selectedRoom.professor}</div></div>
                <div className="detail-item"><div className="detail-label">Section</div><div className="detail-value">{selectedRoom.section}</div></div>
                <div className="detail-item"><div className="detail-label">Time Slot</div><div className="detail-value">{selectedRoom.time}</div></div>
                <div className="detail-item"><div className="detail-label">Status</div><div className="detail-value">{selectedRoom.status}</div></div>
              </div>
            </>
          )}
        </div>
      </div>

      {isProfileOpen && (
        <div className={`modal-overlay ${isProfileOpen ? 'open' : ''}`} onClick={() => setIsProfileOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Profile</h3>
            <input
              className="modal-input"
              placeholder="New name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="reserve-btn" onClick={handleUpdateName} style={{ flex: 1 }}>Save</button>
              <button className="cancel-btn" onClick={() => setIsProfileOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Modal */}
      <div className={`logout-overlay ${isLogoutOpen ? 'open' : ''}`} onClick={() => setIsLogoutOpen(false)}>
        <div className="logout-modal">
          <div className="logout-icon">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </div>
          <div className="logout-title">Log Out?</div>
          <div className="logout-desc">You'll be redirected to the login page. Any unsaved changes will be lost.</div>
          <div className="logout-btns">
            <button className="btn-cancel" onClick={() => setIsLogoutOpen(false)}>Cancel</button>
            <button className="btn-confirm" onClick={handleLogout}>Log Out</button>
          </div>
        </div>
      </div>
    </>
  );
}