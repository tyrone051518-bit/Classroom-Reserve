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
  startTime: string;
  endTime: string;
  teacherId?: number;
}

type MoveState =
  | { phase: "idle" }
  | { phase: "source-selected"; sourceId: number }
  | { phase: "target-selected"; targetId: number };

const EVENT_DAYS: number[] = [3, 8, 15, 21];
const API_BASE = process.env.NEXT_PUBLIC_API_BASE
  ? `${process.env.NEXT_PUBLIC_API_BASE}/api/private/v1`
  : "http://localhost:8080/api/private/v1";

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
  const start = formatTime(row.start_time);
  const end   = formatTime(row.end_time);
  return {
    id:        row.id,
    room:      row.room,
    section:   row.class_section ?? "—",
    subject:   row.subject_code  ?? "—",
    professor: row.professor     ?? "—",
    status:    row.status?.toLowerCase() === "vacant" ? "vacant" : (row.status?.toLowerCase() === "occupied" ? "unavail" : "avail"),
    time:      start && end ? `${start} – ${end}` : "—",
    startTime: row.start_time ?? "",
    endTime:   row.end_time   ?? "",
    teacherId: row.teacher_id != null ? Number(row.teacher_id) : undefined,
  };
}

function toMinutes(t: string): number {
  if (!t) return -1;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function getCurrentMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

// Strict overlap: used for room occupancy (back-to-back is fine)
function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const as = toMinutes(aStart);
  const ae = toMinutes(aEnd);
  const bs = toMinutes(bStart);
  const be = toMinutes(bEnd);
  if (as < 0 || ae < 0 || bs < 0 || be < 0) return false;
  return as < be && ae > bs;
}

// Inclusive overlap: used for teacher's own classes (back-to-back counts as conflict
// because a teacher cannot be in two rooms at the same time)
function timesOverlapInclusive(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const as = toMinutes(aStart);
  const ae = toMinutes(aEnd);
  const bs = toMinutes(bStart);
  const be = toMinutes(bEnd);
  if (as < 0 || ae < 0 || bs < 0 || be < 0) return false;
  return as < be && ae >= bs;
}

function getAuth() {
  if (typeof window === "undefined" || !window.localStorage) {
    return { token: "", teacherId: null, role: "", userName: "" };
  }
  return {
    token:     window.localStorage.getItem("token") ?? "",
    teacherId: window.localStorage.getItem("user_id"),
    role:      window.localStorage.getItem("user_role") ?? "",
    userName:  window.localStorage.getItem("user_name") ?? "User",
  };
}

export default function Dashboard() {
  const router = useRouter();
  const [rooms, setRooms]                 = useState<Room[]>([]);
  const [teacherId, setTeacherId]         = useState<number | null>(null);
  const [userName, setUserName]           = useState("User");
  const [moveState, setMoveState]         = useState<MoveState>({ phase: "idle" });
  const [search, setSearch]               = useState("");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [newName, setNewName]             = useState("");
  const [statusFilter, setStatusFilter]   = useState<"all" | RoomStatus>("all");
  const [toast, setToast]                 = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [loading, setLoading]             = useState(false);
  const [currentMinute, setCurrentMinute] = useState<number>(() => getCurrentMinutes());
  const [calDate, setCalDate]             = useState(() => new Date());
  const [isLogoutOpen, setIsLogoutOpen]   = useState(false);
  const [startTimeFilter, setStartTimeFilter] = useState<string>("all");

  useEffect(() => {
    const updateCurrentMinute = () => setCurrentMinute(getCurrentMinutes());
    updateCurrentMinute();
    const interval = setInterval(updateCurrentMinute, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const { token, userName: name } = getAuth();
    if (!token) {
      router.replace("/login");
      return;
    }
    setUserName(name || "Teacher");
    setTeacherId(Number(window.localStorage.getItem("user_id")));
  }, [router]);

  const showToast = (msg: string, kind: "ok" | "err") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3000);
  };

  const loadRooms = useCallback(async () => {
    setLoading(true);
    const { token } = getAuth();
    try {
      const res = await fetch(`${API_BASE}/dashboard/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      setRooms((data?.data ?? []).map(mapApiRow));
    } catch (err) {
      showToast("Failed to load rooms", "err");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRooms();
    const interval = setInterval(() => void loadRooms(), 30000);
    return () => clearInterval(interval);
  }, [loadRooms]);

  const selectSource = (id: number) => setMoveState({ phase: "source-selected", sourceId: id });
  const selectTarget = (id: number) => setMoveState({ phase: "target-selected", targetId: id });
  const cancelMove   = () => setMoveState({ phase: "idle" });

  const reserveRoom = async (sourceId: number, targetId: number) => {
    setLoading(true);
    const { token } = getAuth();
    try {
      const res = await fetch(`${API_BASE}/dashboard/replace`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          source_schedule_id: sourceId,
          target_schedule_id: targetId,
        }),
      });
      if (!res.ok) throw new Error("Move failed");
      showToast("Room reserved successfully!", "ok");
      setMoveState({ phase: "idle" });
      loadRooms();
    } catch (err) {
      showToast("Failed to reserve room", "err");
    } finally {
      setLoading(false);
    }
  };

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
      if (!res.ok) throw new Error("Update failed");
      localStorage.setItem("user_name", newName.trim());
      setUserName(newName.trim());
      setIsProfileOpen(false);
      setNewName("");
      showToast("Profile updated", "ok");
    } catch (err) {
      showToast("Failed to update name", "err");
    }
  };

  const prevMonth = () =>
    setCalDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () =>
    setCalDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const filteredRooms = useMemo(
    () =>
      rooms.filter((r) => {
        const q = search.toLowerCase();
        const matchSearch =
          r.room.toLowerCase().includes(q) ||
          r.subject.toLowerCase().includes(q) ||
          r.professor.toLowerCase().includes(q);
        const matchStatus = statusFilter === "all" || r.status === statusFilter;
        const roomEnd = toMinutes(r.endTime);
        const matchActive = roomEnd < 0 || roomEnd > currentMinute;
        let matchStartTime = true;
        if (startTimeFilter !== "all") {
          const filterMinutes = toMinutes(startTimeFilter);
          const roomStart = toMinutes(r.startTime);
          matchStartTime = roomStart === filterMinutes;
        }
        return matchSearch && matchStatus && matchActive && matchStartTime;
      }),
    [rooms, search, statusFilter, startTimeFilter, currentMinute]
  );

  const calendarDays = useMemo(() => {
    const today = new Date();
    const year  = calDate.getFullYear();
    const month = calDate.getMonth();
    const firstDow    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays    = new Date(year, month, 0).getDate();
    const days: { d: number; type: "other" | "current" | "today"; event?: boolean }[] = [];
    for (let i = firstDow - 1; i >= 0; i--) {
      days.push({ d: prevDays - i, type: "other" });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday =
        d === today.getDate() &&
        month === today.getMonth() &&
        year === today.getFullYear();
      days.push({ d, type: isToday ? "today" : "current", event: EVENT_DAYS.includes(d) });
    }
    const remaining = 42 - firstDow - daysInMonth;
    for (let d = 1; d <= remaining; d++) {
      days.push({ d, type: "other" });
    }
    return days;
  }, [calDate]);

  const initials = useMemo(() => {
    return userName
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, [userName]);

  const todayLabel = new Date().toLocaleDateString("en-PH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

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
          --move: #f59e0b;
          --move-dim: rgba(245,158,11,.12);
        }

        *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
        html, body, #__next { height:100%; width:100%; overflow:hidden; }
        body { font-family:'Exo 2',sans-serif; background:var(--bg); color:var(--text); }

        .s-root { display:flex; width:100vw; height:100vh; overflow:hidden; }

        .s-sidebar {
          width:200px; min-width:200px; height:100vh; background:var(--sidebar);
          border-right:1px solid var(--card-border); display:flex; flex-direction:column;
          align-items:center; padding:24px 0 20px; flex-shrink:0; position:relative; z-index:10;
        }
        .s-sidebar::after {
          content:''; position:absolute; top:0; right:0; bottom:0; width:1px;
          background:linear-gradient(to bottom,transparent,rgba(249,115,22,.4),transparent);
        }
        .s-logo {
          width:72px; height:72px; border-radius:50%; background:var(--accent-grad);
          display:flex; align-items:center; justify-content:center;
          font-family:'Rajdhani',sans-serif; font-size:20px; font-weight:700; color:#fff;
          box-shadow:0 0 28px rgba(249,115,22,.3); margin-bottom:28px; letter-spacing:1px; flex-shrink:0;
        }
        .s-nav { width:100%; padding:0 12px; flex:1; }
        .user-name-display-side {
          padding:12px 16px; margin-bottom:10px;
          font-family:'Rajdhani',sans-serif; font-weight:700; font-size:15px;
          color:white; border-bottom:1px solid var(--card-border);
          letter-spacing:1px; width:100%; text-align:center;
        }
        .s-nav a {
          display:flex; align-items:center; gap:10px; padding:11px 14px; border-radius:8px;
          color:var(--muted); font-family:'Rajdhani',sans-serif; font-size:14px; font-weight:600;
          letter-spacing:1.5px; text-transform:uppercase; text-decoration:none;
          transition:all .2s; margin-bottom:3px; cursor:pointer; background:none; border:none; width:100%;
        }
        .s-nav a:hover, .s-nav a.active {
          background:var(--accent-dim); color:var(--text); box-shadow:inset 3px 0 0 var(--accent);
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
        .filter-btn option { background:var(--card-solid); color:var(--text); }

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
        .s-date-sub { font-size:12px; color:var(--muted); margin-bottom:16px; }

        .hint-bar {
          display:flex; align-items:center; gap:10px; font-size:12px; color:var(--move);
          background:var(--move-dim); border:1px solid rgba(245,158,11,.25);
          border-radius:8px; padding:7px 13px; margin-bottom:12px;
          animation:fadeIn .2s ease;
        }
        .hint-bar span { flex:1; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:none} }
        .cancel-btn {
          background:transparent; border:1px solid var(--card-border);
          border-radius:6px; padding:5px 12px; color:var(--muted);
          font-family:'Rajdhani',sans-serif; font-size:12px; font-weight:600;
          letter-spacing:1px; text-transform:uppercase; cursor:pointer; transition:all .2s; flex-shrink:0;
        }
        .cancel-btn:hover { border-color:var(--muted); color:var(--text); }

        .s-rooms-grid {
          display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:14px;
        }

        .room-card {
          background:var(--card-solid); border:1px solid var(--card-border);
          border-radius:12px; padding:18px; display:flex; flex-direction:column; gap:10px;
          transition:transform .2s, box-shadow .2s, border-color .2s;
          position:relative; overflow:hidden; animation:fadeUp .4s ease both;
        }
        .room-card::before {
          content:''; position:absolute; top:0; left:0; right:0; height:2px; opacity:0; transition:opacity .2s;
        }
        .room-card.avail::before   { background:linear-gradient(90deg,var(--avail),#4ade80); }
        .room-card.unavail::before { background:linear-gradient(90deg,var(--unavail),#f87171); }
        .room-card.vacant::before  { background:linear-gradient(90deg,var(--vacant),#cbd5e1); }
        .room-card.is-source       { border-color:var(--move); box-shadow:0 0 0 1px var(--move); }
        .room-card.is-source::before { background:linear-gradient(90deg,var(--move),#fbbf24); opacity:1; }
        .room-card.is-target       { border-color:var(--avail); box-shadow:0 0 0 1px var(--avail); }
        .room-card.is-target::before { background:linear-gradient(90deg,var(--avail),#4ade80); opacity:1; }
        .room-card.is-blocked      { border-color:rgba(239,68,68,.35) !important; }
        .room-card.is-blocked::before { background:linear-gradient(90deg,var(--unavail),#f87171); opacity:1; }
        .room-card:hover { transform:translateY(-3px); border-color:rgba(59,130,246,.4); box-shadow:0 10px 28px rgba(0,0,0,.4); }
        .room-card.is-source:hover { border-color:var(--move); }
        .room-card:hover::before { opacity:1; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .room-card:nth-child(1){animation-delay:.04s} .room-card:nth-child(2){animation-delay:.08s}
        .room-card:nth-child(3){animation-delay:.12s} .room-card:nth-child(4){animation-delay:.16s}
        .room-card:nth-child(5){animation-delay:.20s} .room-card:nth-child(6){animation-delay:.24s}

        .rc-top { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }
        .rc-name { font-family:'Rajdhani',sans-serif; font-size:17px; font-weight:700; letter-spacing:1px; }
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

        .action-btn {
          width:100%; padding:9px; border:none; border-radius:8px;
          font-family:'Rajdhani',sans-serif; font-size:12px; font-weight:700;
          letter-spacing:2px; text-transform:uppercase; cursor:pointer; transition:all .2s; margin-top:2px;
        }
        .action-btn.reserve {
          background:transparent; border:1px solid rgba(34,197,94,.4); color:var(--avail);
        }
        .action-btn.reserve:hover { background:var(--avail-dim); border-color:var(--avail); }
        .action-btn.target {
          background:var(--avail-dim); border:1px solid rgba(34,197,94,.5); color:var(--avail);
          animation:pulse-green .8s infinite alternate;
        }
        @keyframes pulse-green { from{box-shadow:none} to{box-shadow:0 0 10px rgba(34,197,94,.3)} }
        .action-btn.move {
          background:var(--move-dim); border:1px solid rgba(245,158,11,.4); color:var(--move);
        }
        .action-btn.move:hover { background:rgba(245,158,11,.2); border-color:var(--move); }
        .action-btn.selected {
          background:rgba(245,158,11,.08); border:1px solid rgba(245,158,11,.3); color:rgba(245,158,11,.6);
          cursor:default;
        }
        .action-btn.unavailable {
          background:transparent; border:1px solid var(--card-border); color:var(--muted);
          cursor:default; opacity:.5;
        }
        .action-btn.conflict {
          background:rgba(239,68,68,.08); border:1px solid rgba(239,68,68,.3); color:#f87171;
          cursor:not-allowed; opacity:.8;
        }
        .action-btn:disabled { opacity:.5; cursor:default; }

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
        .cal-day:hover { background:rgba(249,115,22,.15); }
        .cal-day.other-month { color:var(--muted); opacity:.35; }
        .cal-day.today { background:var(--accent-grad); color:#fff; font-weight:700; box-shadow:0 2px 8px rgba(249,115,22,.3); }
        .cal-day.has-event { position:relative; }
        .cal-day.has-event::after {
          content:''; position:absolute; bottom:2px; left:50%; transform:translateX(-50%);
          width:3px; height:3px; border-radius:50%; background:var(--accent2);
        }

        .toast {
          position:fixed; left:50%; bottom:24px; transform:translateX(-50%);
          padding:11px 22px; border-radius:999px; font-size:13px; font-weight:600;
          pointer-events:none; animation:slideUp .25s ease; z-index:9999;
          font-family:'Rajdhani',sans-serif; letter-spacing:1px;
        }
        .toast.ok  { background:#0d1f16; color:var(--avail);   border:1px solid rgba(34,197,94,.3); }
        .toast.err { background:#1f0d0d; color:var(--unavail); border:1px solid rgba(239,68,68,.3); }
        @keyframes slideUp {
          from{opacity:0;transform:translate(-50%,10px)} to{opacity:1;transform:translate(-50%,0)}
        }

        .modal-overlay {
          position:fixed; inset:0; background:rgba(0,0,0,.75); backdrop-filter:blur(6px);
          display:flex; align-items:center; justify-content:center;
          z-index:200; opacity:0; pointer-events:none; transition:opacity .25s;
        }
        .modal-overlay.open { opacity:1; pointer-events:all; }
        .modal-content {
          background:var(--card-solid); border:1px solid var(--card-border);
          border-radius:16px; width:400px; max-width:92vw; padding:28px 28px 24px;
          transform:translateY(20px); transition:transform .25s;
        }
        .modal-overlay.open .modal-content { transform:translateY(0); }
        .modal-content h3 {
          font-family:'Rajdhani',sans-serif; font-size:22px; font-weight:700;
          letter-spacing:1px; margin-bottom:16px;
        }
        .modal-input {
          width:100%; padding:12px 14px; border-radius:10px; border:1px solid var(--card-border);
          background:var(--bg); color:var(--text); font-family:'Exo 2',sans-serif;
          font-size:14px; margin-bottom:16px; outline:none;
        }
        .modal-input:focus { border-color:var(--accent); }
        .modal-btns { display:flex; gap:10px; }
        .modal-save {
          flex:1; padding:11px; background:var(--accent-grad); border:none;
          border-radius:8px; color:#fff; font-family:'Rajdhani',sans-serif; font-size:13px;
          font-weight:700; letter-spacing:1.5px; text-transform:uppercase; cursor:pointer; transition:opacity .2s;
        }
        .modal-save:hover { opacity:.88; }
        .modal-cancel {
          flex:1; padding:11px; background:transparent; border:1px solid var(--card-border);
          border-radius:8px; color:var(--text); font-family:'Rajdhani',sans-serif; font-size:13px;
          font-weight:700; letter-spacing:1.5px; text-transform:uppercase; cursor:pointer; transition:all .2s;
        }
        .modal-cancel:hover { border-color:var(--muted); }

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

        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:var(--card-border); border-radius:4px; }
        ::-webkit-scrollbar-thumb:hover { background:var(--accent); }
      `}</style>

      <div className="s-root">
        <aside className="s-sidebar">
          <div className="s-logo">CCSE</div>
          <nav className="s-nav">
            <div className="user-name-display-side">{userName}</div>
            <button className="s-nav a" role="button" onClick={() => setIsProfileOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              Profile
            </button>
          </nav>
          <div className="s-bottom">
            <div className="s-user-badge">
              <div className="s-avatar">{initials}</div>
              <div className="s-user-info">
                <strong>{userName}</strong>
                <span>Teacher</span>
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

        <div className="s-main">
          <div className="s-topbar">
            <div className="s-page-title">Teacher Dashboard</div>
            <div className="s-topbar-right">
              <input
                className="search-bar"
                placeholder="Search rooms…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="filter-btn"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="all">All Rooms</option>
                <option value="avail">Available</option>
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
            </div>
          </div>

          <div className="s-content">
            <div className="s-rooms">
              <div className="s-section-header">
                <div>
                  <div className="s-section-label">Today's Schedule</div>
                </div>
                <span className="s-room-count">{filteredRooms.length} Rooms</span>
              </div>

              {moveState.phase !== "idle" && (
                <div className="hint-bar">
                  <span>
                    {moveState.phase === "source-selected"
                      ? "Now click any available room to move your class there."
                      : "Now click one of your classes to assign it to that room."}
                  </span>
                  <button className="cancel-btn" onClick={cancelMove}>Cancel</button>
                </div>
              )}

              <div className="s-date-sub">{todayLabel}</div>

              <div className="s-rooms-grid">
                {filteredRooms.map((room) => {
                  const isAvail   = room.status === "avail";
                  const isVacant  = room.status === "vacant";
                  const isOwnClass =
                    room.teacherId != null &&
                    teacherId      != null &&
                    Number(room.teacherId) === Number(teacherId);

                  const isSource =
                    moveState.phase === "source-selected" &&
                    moveState.sourceId === room.id;

                  // ── hasOverlap: fires when teacher picks a source class and we
                  //    evaluate each avail/vacant card as a potential target room.
                  let hasOverlap = false;
                  if (moveState.phase === "source-selected" && (isAvail || isVacant)) {
                    const sourceRoom = rooms.find((r) => r.id === moveState.sourceId);
                    if (sourceRoom) {
                      // 1. Is the target room already occupied at the source's time?
                      hasOverlap = rooms.some((r) => {
                        if (r.id === room.id) return false;
                        if (r.room !== room.room) return false;
                        if (r.status !== "unavail") return false;
                        return timesOverlap(
                          sourceRoom.startTime,
                          sourceRoom.endTime,
                          r.startTime,
                          r.endTime,
                        );
                      });

                      // 2. Would moving the class cause the teacher to be in two
                      //    places at once? Use inclusive overlap so back-to-back
                      //    classes (e.g. 11:00-12:30 then 12:30-14:00) are blocked
                      //    — the teacher physically cannot travel between rooms in 0 min.
                      if (!hasOverlap) {
                        hasOverlap = rooms.some((r) => {
                          if (r.id === moveState.sourceId) return false; // skip the class being moved
                          if (r.teacherId == null) return false;
                          if (Number(r.teacherId) !== Number(teacherId)) return false; // only MY classes
                          if (!r.startTime || !r.endTime) return false;
                          return timesOverlapInclusive(
                            sourceRoom.startTime,
                            sourceRoom.endTime,
                            r.startTime,
                            r.endTime,
                          );
                        });
                      }
                    }
                  }

                  // ── hasOverlapAsSource: fires when teacher picks a target room first
                  //    and we evaluate each occupied card as a potential class to assign.
                  let hasOverlapAsSource = false;
                  if (moveState.phase === "target-selected" && isOwnClass) {
                    const targetRoom = rooms.find((r) => r.id === moveState.targetId);
                    if (targetRoom) {
                      // 1. Is the target room already occupied at this class's time?
                      hasOverlapAsSource = rooms.some((r) => {
                        if (r.id === targetRoom.id) return false;
                        if (r.room !== targetRoom.room) return false;
                        if (r.status !== "unavail") return false;
                        if (r.id === room.id) return false;
                        if (!room.startTime || !room.endTime || !r.startTime || !r.endTime) return false;
                        return timesOverlap(room.startTime, room.endTime, r.startTime, r.endTime);
                      });

                      // 2. Would assigning this class put the teacher in two rooms at once?
                      if (!hasOverlapAsSource) {
                        hasOverlapAsSource = rooms.some((r) => {
                          if (r.id === room.id) return false;            // skip the class being assigned
                          if (r.id === moveState.targetId) return false; // skip the target slot itself
                          if (r.teacherId == null) return false;
                          if (Number(r.teacherId) !== Number(teacherId)) return false;
                          if (!room.startTime || !room.endTime || !r.startTime || !r.endTime) return false;
                          return timesOverlapInclusive(
                            room.startTime,
                            room.endTime,
                            r.startTime,
                            r.endTime,
                          );
                        });
                      }
                    }
                  }

                  const isBlocked = hasOverlap || hasOverlapAsSource;

                  const isTargetLocked =
                    moveState.phase === "target-selected" &&
                    moveState.targetId === room.id;

                  let btnLabel: string;
                  let btnClass: string;
                  let btnDisabled = false;

                  if (isSource) {
                    btnLabel    = "✓ Selected — pick a room";
                    btnClass    = "action-btn selected";
                    btnDisabled = true;
                  } else if (isTargetLocked) {
                    btnLabel    = "✓ Target room — pick your class";
                    btnClass    = "action-btn selected";
                    btnDisabled = true;
                  } else if ((isAvail || isVacant) && moveState.phase === "source-selected" && isBlocked) {
                    btnLabel    = "Time conflict — room busy";
                    btnClass    = "action-btn conflict";
                    btnDisabled = true;
                  } else if ((isAvail || isVacant) && moveState.phase === "source-selected") {
                    btnLabel = "Move class here";
                    btnClass = "action-btn target";
                  } else if ((isAvail || isVacant) && moveState.phase === "idle") {
                    btnLabel = "Reserve this room";
                    btnClass = "action-btn reserve";
                  } else if (isOwnClass && moveState.phase === "target-selected" && isBlocked) {
                    btnLabel    = "Time conflict — class busy";
                    btnClass    = "action-btn conflict";
                    btnDisabled = true;
                  } else if (isOwnClass && moveState.phase === "target-selected") {
                    btnLabel = "Assign this class here";
                    btnClass = "action-btn target";
                  } else if (isOwnClass && moveState.phase === "idle") {
                    btnLabel = "Move this class";
                    btnClass = "action-btn move";
                  } else {
                    btnLabel    = "Unavailable";
                    btnClass    = "action-btn unavailable";
                    btnDisabled = true;
                  }

                  function handleClick() {
                    if (isBlocked || btnDisabled) return;
                    if (moveState.phase === "idle") {
                      if (isAvail || isVacant) {
                        selectTarget(room.id);
                      } else if (isOwnClass) {
                        selectSource(room.id);
                      }
                    } else if (moveState.phase === "source-selected") {
                      if (isAvail || isVacant) {
                        void reserveRoom(moveState.sourceId, room.id);
                      }
                    } else if (moveState.phase === "target-selected") {
                      if (isOwnClass) {
                        void reserveRoom(room.id, moveState.targetId);
                      }
                    }
                  }

                  return (
                    <div
                      key={room.id}
                      className={`room-card ${room.status}${isSource ? " is-source" : ""}${isTargetLocked ? " is-target" : ""}${isBlocked ? " is-blocked" : ""}`}
                    >
                      <div className="rc-top">
                        <div className="rc-name">{room.room}</div>
                        <div className={`rc-badge ${room.status}`}>
                          <span className="badge-dot" />
                          {room.status === "avail" ? "Available" : room.status === "unavail" ? "Occupied" : "Vacant"}
                        </div>
                      </div>

                      <div className={`rc-subject${isVacant ? " vacant-subject" : ""}`}>
                        {isVacant ? "No class scheduled" : room.subject}
                      </div>

                      <div className="rc-details">
                        <div className="rc-detail-row">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                          </svg>
                          <span>{room.professor}</span>
                        </div>
                        <div className="rc-detail-row">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                          </svg>
                          <span>{room.time}</span>
                        </div>
                        <div className="rc-detail-row">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                          </svg>
                          <span>{room.section}</span>
                        </div>
                      </div>

                      <button
                        className={btnClass}
                        disabled={btnDisabled || loading}
                        onClick={handleClick}
                      >
                        {btnLabel}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

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
                    <button onClick={prevMonth}>‹</button>
                    <button onClick={nextMonth}>›</button>
                  </div>
                </div>
                <div className="cal-grid">
                  {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
                    <div key={d} className="cal-day-label">{d}</div>
                  ))}
                  {calendarDays.map((day, i) => (
                    <div
                      key={i}
                      className={[
                        "cal-day",
                        day.type === "other"   ? "other-month" : "",
                        day.type === "today"   ? "today"       : "",
                        day.event              ? "has-event"   : "",
                      ].filter(Boolean).join(" ")}
                    >
                      {day.d}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14, fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
                  {todayLabel}
                </div>
              </div>

              <div className="panel-block">
                <div className="panel-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  Move Guide
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    { step: "1", label: "Find your class", desc: "Click 'Move this class' on a room you own." },
                    { step: "2", label: "Pick a target", desc: "Click 'Move class here' on any available room." },
                    { step: "3", label: "Done!", desc: "The class is relocated and the grid refreshes." },
                  ].map(({ step, label, desc }) => (
                    <div key={step} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%",
                        background: "var(--accent-grad)", color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, flexShrink: 0,
                      }}>{step}</div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`modal-overlay ${isProfileOpen ? "open" : ""}`}
        onClick={() => setIsProfileOpen(false)}
      >
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <h3>Edit Profile</h3>
          <input
            className="modal-input"
            placeholder="New display name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <div className="modal-btns">
            <button className="modal-save" onClick={handleUpdateName}>Save</button>
            <button className="modal-cancel" onClick={() => setIsProfileOpen(false)}>Cancel</button>
          </div>
        </div>
      </div>

      <div
        className={`logout-overlay ${isLogoutOpen ? "open" : ""}`}
        onClick={() => setIsLogoutOpen(false)}
      >
        <div className="logout-modal" onClick={(e) => e.stopPropagation()}>
          <div className="logout-icon">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </div>
          <div className="logout-title">Log Out?</div>
          <div className="logout-desc">
            You'll be redirected to the login page. Any unsaved changes will be lost.
          </div>
          <div className="logout-btns">
            <button className="btn-cancel" onClick={() => setIsLogoutOpen(false)}>Cancel</button>
            <button className="btn-confirm" onClick={handleLogout}>Log Out</button>
          </div>
        </div>
      </div>

      {toast && <div className={`toast ${toast.kind}`}>{toast.msg}</div>}
    </>
  );
}