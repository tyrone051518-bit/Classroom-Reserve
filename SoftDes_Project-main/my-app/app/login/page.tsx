"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [pwdVisible, setPwdVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const loginBtnRef = useRef<HTMLButtonElement>(null);

  // Restore saved ID on mount
  useEffect(() => {
    const savedId = localStorage.getItem("ccse_saved_id");
    if (savedId) {
      setLogin(savedId);
      setRememberMe(true);
    }
  }, []);

  // Enter key submits
  useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}, [login, password]);

  const createRipple = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = loginBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
    btn.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  };

  const handleLogin = async (e?: React.MouseEvent<HTMLButtonElement>) => {
  if (e) createRipple(e);

  const id = login.trim();
  const pwd = password.trim();

  if (!id || !pwd) {
    setMessage("Please fill in both fields.");
    setIsError(true);
    return;
  }

  setLoading(true);
  setMessage("");
  setIsError(false);

  // Remember Me
  if (rememberMe) {
    localStorage.setItem("ccse_saved_id", id);
  } else {
    localStorage.removeItem("ccse_saved_id");
  }

  try {
    const res = await fetch(
      "http://localhost:8080/api/public/v1/authentication/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          login: id,
          password: pwd,
        }),
      }
    );

    const raw = await res.json();

    // Handle failed login
    if (!res.ok) {
      setMessage(
        raw?.message ||
          "Invalid ID Number or Password. Please try again."
      );
      setIsError(true);
      return;
    }

    // Some backends return { data: {...} }
    // Some return direct object
    const data = raw?.data || raw;
    console.log("DEBUG - Full Data Object:", data);

    // Normalize name and role (handling the ALL CAPS varchar from DB)
    const roleField = data?.account_role || data?.account_roles;
    const userRole = roleField ? roleField.toString().toUpperCase() : "";
    const fullName = data?.name || "User";

    // CRITICAL: If backend didn't send a role, don't guess.
    if (!userRole) {
      setMessage("Error: Backend did not provide a user role.");
      setIsError(true);
      return;
    }

    // Save token if exists
    if (data?.token) {
      localStorage.setItem("token", data.token);
    }

    // Save optional user info
    if (data?.id) {
      localStorage.setItem("user_id", data.id);
    }

    localStorage.setItem("user_name", fullName);
    
    if (data?.login) {
      localStorage.setItem("user_login", data.login);
    }

    localStorage.setItem("user_role", userRole);

    setMessage("Login successful! Redirecting...");
    setIsError(false);

    // Decide redirect based on role
    const isStudent = userRole.includes("STUDENT");
    const dest = isStudent ? "/Dashboard/Student" : "/Dashboard/Teacher";

    setTimeout(() => {
      router.push(dest);
    }, 500);

  } catch (error) {
    console.error(error);

    setMessage("Server error. Check backend.");
    setIsError(true);
  } finally {
    setLoading(false);
  }
};

  const eyeOpenPath = (
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </>
  );

  const eyeClosedPath = (
    <>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --dark: #3b0a10;
          --mid: #7c2215;
          --accent: #c45a28;
          --light: #e08040;
          --glass-bg: rgba(255,255,255,0.08);
          --glass-border: rgba(255,255,255,0.18);
          --input-bg: rgba(255,255,255,0.92);
          --input-text: #3b0a10;
          --btn-bg: rgba(160,70,35,0.85);
          --btn-hover: rgba(190,90,40,1);
          --text-light: rgba(255,255,255,0.9);
          --text-muted: rgba(255,255,255,0.55);
        }

        html, body { height: 100%; font-family: 'DM Sans', sans-serif; }

        .login-body {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: radial-gradient(ellipse at 70% 30%, #c44c1a 0%, #7c1e10 35%, #3b0a10 65%, #1e0508 100%);
          overflow: hidden;
          position: relative;
          font-family: 'DM Sans', sans-serif;
        }

        .login-body::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
          pointer-events: none;
          opacity: 0.35;
          z-index: 0;
        }

        .orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          z-index: 0;
        }
        .orb-1 { width: 500px; height: 500px; background: rgba(196,90,40,0.25); top: -150px; right: -100px; }
        .orb-2 { width: 350px; height: 350px; background: rgba(100,20,10,0.4); bottom: -80px; left: -80px; }

        .wrapper {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
          width: 100%;
          max-width: 680px;
          padding: 0 24px;
          animation: fadeUp 0.8s cubic-bezier(0.22,1,0.36,1) both;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .logo-wrap {
          position: relative;
          z-index: 2;
          margin-bottom: -28px;
        }

        .logo-wrap img {
          width: 160px;
          height: 160px;
          object-fit: contain;
          border-radius: 50%;
          box-shadow: 0 0 0 6px rgba(255,255,255,0.12), 0 8px 40px rgba(0,0,0,0.5);
          transition: transform 0.3s ease;
        }

        .logo-wrap img:hover { transform: scale(1.04) rotate(1deg); }

        .logo-fallback {
          width: 160px;
          height: 160px;
          border-radius: 50%;
          background: rgba(255,255,255,0.12);
          border: 2px solid rgba(255,255,255,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 2rem;
          color: #fff;
          letter-spacing: 0.1em;
        }

        .card {
          width: 100%;
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: 24px;
          backdrop-filter: blur(20px) saturate(1.4);
          -webkit-backdrop-filter: blur(20px) saturate(1.4);
          padding: 68px 60px 44px;
          box-shadow: 0 24px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.15);
        }

        .field {
          position: relative;
          margin-bottom: 22px;
        }

        .field input {
          width: 100%;
          padding: 18px 22px;
          background: var(--input-bg);
          border: 2px solid transparent;
          border-radius: 12px;
          font-family: 'DM Sans', sans-serif;
          font-size: 1rem;
          font-weight: 500;
          color: var(--input-text);
          outline: none;
          transition: border-color 0.25s, box-shadow 0.25s, transform 0.2s;
          box-shadow: 0 2px 12px rgba(0,0,0,0.2);
        }

        .field input::placeholder {
          color: #88503a;
          font-weight: 600;
          letter-spacing: 0.02em;
        }

        .field input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 4px rgba(196,90,40,0.25), 0 2px 12px rgba(0,0,0,0.2);
          transform: translateY(-1px);
        }

        .eye-btn {
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #88503a;
          padding: 4px;
          display: flex;
          align-items: center;
          transition: color 0.2s;
        }
        .eye-btn:hover { color: var(--accent); }

        .remember {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 28px;
          margin-top: 4px;
          padding-left: 2px;
        }

        .remember input[type="checkbox"] {
          width: 16px;
          height: 16px;
          accent-color: var(--accent);
          cursor: pointer;
        }

        .remember label {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 0.05em;
          text-transform: uppercase;
          cursor: pointer;
          user-select: none;
        }

        .btn-login {
          width: 100%;
          padding: 18px;
          background: var(--btn-bg);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 12px;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 1.35rem;
          letter-spacing: 0.12em;
          color: #fff;
          cursor: pointer;
          transition: background 0.25s, transform 0.2s, box-shadow 0.25s;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15);
          position: relative;
          overflow: hidden;
        }

        .btn-login::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%);
          pointer-events: none;
        }

        .btn-login:hover:not(:disabled) {
          background: var(--btn-hover);
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(0,0,0,0.4);
        }

        .btn-login:active { transform: translateY(0); }

        .btn-login:disabled,
        .btn-login.loading {
          pointer-events: none;
          opacity: 0.75;
        }

        .divider {
          display: flex;
          align-items: center;
          gap: 16px;
          margin: 28px 0 20px;
        }

        .divider hr {
          flex: 1;
          border: none;
          border-top: 1px solid rgba(255,255,255,0.15);
        }

        .divider span {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text-muted);
          letter-spacing: 0.06em;
          white-space: nowrap;
        }

        .register-link {
          text-align: center;
          font-size: 0.85rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        .register-link a {
          color: #fff;
          font-weight: 700;
          text-decoration: none;
          letter-spacing: 0.04em;
          border-bottom: 1px solid rgba(255,255,255,0.3);
          padding-bottom: 1px;
          transition: border-color 0.2s, color 0.2s;
        }

        .register-link a:hover {
          color: var(--light);
          border-color: var(--light);
        }

        .error-msg {
          background: rgba(220,50,50,0.15);
          border: 1px solid rgba(220,50,50,0.4);
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 0.82rem;
          color: #ffaaaa;
          margin-bottom: 18px;
        }

        .success-msg {
          background: rgba(50,180,80,0.15);
          border: 1px solid rgba(50,180,80,0.4);
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 0.82rem;
          color: #aaffbb;
          margin-bottom: 18px;
        }

        .ripple {
          position: absolute;
          border-radius: 50%;
          transform: scale(0);
          animation: ripple-anim 0.5s linear;
          background: rgba(255,255,255,0.25);
          pointer-events: none;
        }

        @keyframes ripple-anim {
          to { transform: scale(4); opacity: 0; }
        }

        @media (max-width: 520px) {
          .card { padding: 60px 28px 36px; }
          .logo-wrap img { width: 130px; height: 130px; }
        }
      `}</style>

      <div className="login-body">
        <div className="orb orb-1" />
        <div className="orb orb-2" />

        <div className="wrapper">

          {/* Logo */}
          <div className="logo-wrap">
            {logoError ? (
              <div className="logo-fallback">CCSE</div>
            ) : (
              <img
                src="/logoshit.png"
                alt="CCSE Logo"
                onError={() => setLogoError(true)}
              />
            )}
          </div>

          {/* Card */}
          <div className="card">

            {message && (
              <div className={isError ? "error-msg" : "success-msg"}>
                {message}
              </div>
            )}

            {/* ID Number */}
            <div className="field">
              <input
                type="text"
                placeholder="ID Number"
                autoComplete="username"
                spellCheck={false}
                value={login}
                onChange={(e) => {
                  setLogin(e.target.value);
                  setMessage("");
                }}
              />
            </div>

            {/* Password */}
            <div className="field">
              <input
                type={pwdVisible ? "text" : "password"}
                placeholder="Password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setMessage("");
                }}
                style={{ paddingRight: "48px" }}
              />
              <button
                className="eye-btn"
                type="button"
                aria-label="Toggle password visibility"
                onClick={() => setPwdVisible((v) => !v)}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {pwdVisible ? eyeClosedPath : eyeOpenPath}
                </svg>
              </button>
            </div>

            {/* Remember Me */}
            <div className="remember">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="rememberMe">Remember</label>
            </div>

            {/* Login Button */}
            <button
              ref={loginBtnRef}
              className={`btn-login${loading ? " loading" : ""}`}
              type="button"
              disabled={loading}
              onClick={handleLogin}
            >
              {loading ? "Logging in…" : "Log in"}
            </button>

            {/* Divider */}
            <div className="divider">
              <hr />
              <span>don&apos;t have an account?</span>
              <hr />
            </div>

            {/* Register Link */}
            <div className="register-link">
              <Link href="/register">Register</Link>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}