"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ─── Password validation rules ─────────────────────────────────────────────────
const RULES = [
  { id: "len",    label: "At least 8 characters",       test: (p: string) => p.length >= 8 },
  { id: "upper",  label: "One uppercase letter (A–Z)",   test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower",  label: "One lowercase letter (a–z)",   test: (p: string) => /[a-z]/.test(p) },
  { id: "number", label: "One number (0–9)",             test: (p: string) => /[0-9]/.test(p) },
  { id: "symbol", label: "One special character (!@#…)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

type Step = "form" | "sent";

export default function SignupPage() {
  const router = useRouter();
  // form fields
  const [email,           setEmail]           = useState("");
  const [idNumber,        setIdNumber]         = useState("");
  const [password,        setPassword]         = useState("");
  const [confirmPassword, setConfirmPassword]  = useState("");

  // UI state
  const [pwdVisible,  setPwdVisible]  = useState(false);
  const [cfmVisible,  setCfmVisible]  = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [message,     setMessage]     = useState("");
  const [isError,     setIsError]     = useState(false);
  const [pwdFocused,  setPwdFocused]  = useState(false);
  const [logoError,   setLogoError]   = useState(false);
  const [step,        setStep]        = useState<Step>("form");
  const [resendCooldown, setResendCooldown] = useState(0);

  const submitBtnRef = useRef<HTMLButtonElement>(null);
  const cooldownRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // password strength
  const strength      = RULES.filter((r) => r.test(password)).length;
  const strengthColor = ["#555","#e05050","#e09040","#e0c040","#80c040","#40d080"][strength];
  const strengthLabel = ["","Very Weak","Weak","Fair","Strong","Very Strong"][strength];

  // ── Ripple ────────────────────────────────────────────────────────────────────
  const createRipple = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = submitBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`;
    btn.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  };

  // ── Validate ─────────────────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!email.trim())    return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address.";
    if (!idNumber.trim()) return "ID Number is required.";
    if (strength < 5)     return "Password does not meet all requirements.";
    if (password !== confirmPassword) return "Passwords do not match.";
    return null;
  };

  // ── Start resend cooldown ─────────────────────────────────────────────────────
  const startCooldown = (seconds = 60) => {
    setResendCooldown(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  // ── Register: POST to backend, backend sends verification email ───────────────
  const handleRegister = async (e: React.MouseEvent<HTMLButtonElement>) => {
    createRipple(e);
    const err = validate();
    if (err) { setMessage(err); setIsError(true); return; }

    setLoading(true);
    setMessage("");
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
const res = await fetch(
  `${API_BASE}/api/public/v1/authentication/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, idNumber, password }),
        }
      );
      const data = await res.json();
      console.log("REGISTER RESPONSE:", data);
      if (!res.ok) {
        setMessage(data.message || "Registration failed. Please try again.");
        setIsError(true);
        return;
      }
      // success → show "check your email" screen
       setStep("sent");
      startCooldown(60);

      // auto redirect to login after 5 seconds
      setTimeout(() => {
        router.push("/login");
      }, 5000);
    } catch {
      setMessage("Server error. Check backend.");
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  // ── Resend verification email ─────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    setMessage("");
    try {
      // Line 2 - in handleResend
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";
const res = await fetch(
  `${API_BASE}/api/public/v1/authentication/resend-verification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        setMessage(data.message || "Failed to resend. Try again.");
        setIsError(true);
        return;
      }
      setMessage("Verification email resent!");
      setIsError(false);
      startCooldown(60);
    } catch {
      setMessage("Server error. Try again.");
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  // ── Eye SVGs ─────────────────────────────────────────────────────────────────
  const EyeOpen = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );
  const EyeClosed = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --accent: #c45a28; --light: #e08040;
          --glass-bg: rgba(255,255,255,0.08); --glass-border: rgba(255,255,255,0.18);
          --input-bg: rgba(255,255,255,0.92); --input-text: #3b0a10;
          --btn-bg: rgba(160,70,35,0.85); --btn-hover: rgba(190,90,40,1);
          --text-muted: rgba(255,255,255,0.55);
        }
        html, body { height: 100%; font-family: 'DM Sans', sans-serif; }

        .signup-body {
          min-height: 100vh; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          background: radial-gradient(ellipse at 70% 30%, #c44c1a 0%, #7c1e10 35%, #3b0a10 65%, #1e0508 100%);
          overflow: hidden; position: relative;
          font-family: 'DM Sans', sans-serif; padding: 40px 0;
        }
        .signup-body::before {
          content: ''; position: fixed; inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
          pointer-events: none; opacity: 0.35; z-index: 0;
        }
        .orb { position: fixed; border-radius: 50%; filter: blur(80px); pointer-events: none; z-index: 0; }
        .orb-1 { width:500px; height:500px; background:rgba(196,90,40,0.25); top:-150px; right:-100px; }
        .orb-2 { width:350px; height:350px; background:rgba(100,20,10,0.4); bottom:-80px; left:-80px; }

        .wrapper {
          position: relative; z-index: 1; display: flex; flex-direction: column;
          align-items: center; width: 100%; max-width: 680px; padding: 0 24px;
          animation: fadeUp 0.8s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(32px); }
          to   { opacity:1; transform:translateY(0); }
        }

        .logo-wrap { position:relative; z-index:2; margin-bottom:-28px; }
        .logo-wrap img {
          width:130px; height:130px; object-fit:contain; border-radius:50%;
          box-shadow: 0 0 0 6px rgba(255,255,255,0.12), 0 8px 40px rgba(0,0,0,0.5);
          transition: transform 0.3s ease;
        }
        .logo-wrap img:hover { transform: scale(1.04) rotate(1deg); }
        .logo-fallback {
          width:130px; height:130px; border-radius:50%;
          background:rgba(255,255,255,0.12); border:2px solid rgba(255,255,255,0.2);
          display:flex; align-items:center; justify-content:center;
          font-family:'Bebas Neue',sans-serif; font-size:1.8rem; color:#fff; letter-spacing:0.1em;
        }

        .card {
          width:100%; background:var(--glass-bg); border:1px solid var(--glass-border);
          border-radius:24px; backdrop-filter:blur(20px) saturate(1.4);
          -webkit-backdrop-filter:blur(20px) saturate(1.4);
          padding:60px 60px 44px;
          box-shadow:0 24px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.15);
        }
        .card-title {
          font-family:'Bebas Neue',sans-serif; font-size:1.9rem; letter-spacing:0.1em;
          color:#fff; margin-bottom:6px; text-align:center;
        }
        .card-subtitle {
          font-size:0.82rem; color:var(--text-muted); text-align:center;
          margin-bottom:28px; font-weight:500; letter-spacing:0.03em;
        }

        .field { position:relative; margin-bottom:18px; }
        .field input {
          width:100%; padding:16px 22px; background:var(--input-bg);
          border:2px solid transparent; border-radius:12px;
          font-family:'DM Sans',sans-serif; font-size:0.97rem; font-weight:500;
          color:var(--input-text); outline:none;
          transition:border-color 0.25s, box-shadow 0.25s, transform 0.2s;
          box-shadow:0 2px 12px rgba(0,0,0,0.2);
        }
        .field input::placeholder { color:#88503a; font-weight:600; letter-spacing:0.02em; }
        .field input:focus {
          border-color:var(--accent);
          box-shadow:0 0 0 4px rgba(196,90,40,0.25), 0 2px 12px rgba(0,0,0,0.2);
          transform:translateY(-1px);
        }
        .field input.invalid { border-color:rgba(220,80,80,0.7); }
        .field input.valid   { border-color:rgba(80,200,100,0.7); }

        .eye-btn {
          position:absolute; right:14px; top:50%; transform:translateY(-50%);
          background:none; border:none; cursor:pointer;
          color:#88503a; padding:4px; display:flex; align-items:center; transition:color 0.2s;
        }
        .eye-btn:hover { color:var(--accent); }

        .strength-wrap { margin-top:-10px; margin-bottom:16px; }
        .strength-bars { display:flex; gap:4px; margin-bottom:6px; }
        .strength-bar { flex:1; height:4px; border-radius:2px; background:rgba(255,255,255,0.12); transition:background 0.3s; }
        .strength-label { font-size:0.74rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; transition:color 0.3s; }

        .rules-list {
          background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1);
          border-radius:10px; padding:12px 16px; margin-bottom:18px;
          display:flex; flex-direction:column; gap:6px; animation:fadeUp 0.3s ease;
        }
        .rule-item { display:flex; align-items:center; gap:8px; font-size:0.78rem; font-weight:600; letter-spacing:0.03em; transition:color 0.25s; }
        .rule-item.pass { color:#6ee07a; }
        .rule-item.fail { color:rgba(255,255,255,0.4); }
        .rule-icon { font-size:0.85rem; width:16px; text-align:center; }

        .btn-submit {
          width:100%; padding:17px; background:var(--btn-bg);
          border:1px solid rgba(255,255,255,0.15); border-radius:12px;
          font-family:'Bebas Neue',sans-serif; font-size:1.3rem; letter-spacing:0.12em;
          color:#fff; cursor:pointer;
          transition:background 0.25s, transform 0.2s, box-shadow 0.25s;
          box-shadow:0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15);
          position:relative; overflow:hidden; margin-bottom:24px;
        }
        .btn-submit::after {
          content:''; position:absolute; inset:0;
          background:linear-gradient(135deg,rgba(255,255,255,0.15) 0%,transparent 60%);
          pointer-events:none;
        }
        .btn-submit:hover { background:var(--btn-hover); transform:translateY(-2px); box-shadow:0 8px 30px rgba(0,0,0,0.4); }
        .btn-submit:active { transform:translateY(0); }
        .btn-submit.loading { pointer-events:none; opacity:0.75; }

        .error-msg {
          background:rgba(220,50,50,0.15); border:1px solid rgba(220,50,50,0.4);
          border-radius:8px; padding:10px 14px; font-size:0.82rem; color:#ffaaaa; margin-bottom:16px;
        }
        .success-msg {
          background:rgba(50,180,80,0.15); border:1px solid rgba(50,180,80,0.4);
          border-radius:8px; padding:10px 14px; font-size:0.82rem; color:#aaffbb; margin-bottom:16px;
        }

        .divider { display:flex; align-items:center; gap:16px; margin-bottom:18px; }
        .divider hr { flex:1; border:none; border-top:1px solid rgba(255,255,255,0.15); }
        .divider span { font-size:0.78rem; font-weight:600; color:var(--text-muted); letter-spacing:0.06em; white-space:nowrap; }

        .login-link { text-align:center; font-size:0.85rem; color:var(--text-muted); font-weight:500; }
        .login-link a {
          color:#fff; font-weight:700; text-decoration:none; letter-spacing:0.04em;
          border-bottom:1px solid rgba(255,255,255,0.3); padding-bottom:1px;
          transition:border-color 0.2s, color 0.2s;
        }
        .login-link a:hover { color:var(--light); border-color:var(--light); }

        /* ── Email sent screen ── */
        .sent-icon {
          width:72px; height:72px; margin:0 auto 20px;
          background:rgba(196,90,40,0.2); border:2px solid rgba(196,90,40,0.5);
          border-radius:50%; display:flex; align-items:center; justify-content:center;
        }
        .sent-email {
          display:inline-block; background:rgba(255,255,255,0.12);
          border:1px solid rgba(255,255,255,0.2); border-radius:8px;
          padding:4px 12px; font-size:0.88rem; font-weight:700;
          color:#fff; letter-spacing:0.02em; margin:4px 0 20px; word-break:break-all;
        }
        .sent-hint {
          font-size:0.80rem; color:var(--text-muted); line-height:1.6;
          margin-bottom:28px; text-align:center;
        }
        .resend-row { text-align:center; margin-bottom:24px; }
        .resend-btn {
          background:none; border:none; font-family:'DM Sans',sans-serif;
          font-size:0.84rem; font-weight:700; letter-spacing:0.04em;
          cursor:pointer; padding:0; transition:color 0.2s;
          text-decoration:underline; text-underline-offset:3px;
        }
        .resend-btn:disabled { cursor:default; text-decoration:none; }

        .back-btn {
          background:none; border:none; font-family:'DM Sans',sans-serif;
          font-size:0.82rem; font-weight:700; color:var(--text-muted);
          letter-spacing:0.04em; cursor:pointer;
          display:flex; align-items:center; gap:6px;
          margin-bottom:24px; padding:0; transition:color 0.2s;
        }
        .back-btn:hover { color:#fff; }

        .ripple {
          position:absolute; border-radius:50%; transform:scale(0);
          animation:ripple-anim 0.5s linear;
          background:rgba(255,255,255,0.25); pointer-events:none;
        }
        @keyframes ripple-anim { to { transform:scale(4); opacity:0; } }

        @media (max-width:520px) {
          .card { padding:56px 24px 36px; }
          .logo-wrap img { width:110px; height:110px; }
        }
      `}</style>

      <div className="signup-body">
        <div className="orb orb-1" />
        <div className="orb orb-2" />

        <div className="wrapper">
          {/* Logo */}
          <div className="logo-wrap">
            {logoError ? (
              <div className="logo-fallback">CCSE</div>
            ) : (
              <img src="/logoshit.png" alt="CCSE Logo" onError={() => setLogoError(true)} />
            )}
          </div>

          {/* Card */}
          <div className="card">

            {step === "form" ? (
              /* ══════════ FORM STEP ══════════ */
              <>
                <h2 className="card-title">Create Account</h2>
                <p className="card-subtitle">Join CCSE — fill in your details below</p>

                {message && <div className={isError ? "error-msg" : "success-msg"}>{message}</div>}

                {/* Email */}
                <div className="field">
                  <input
                    type="email" placeholder="Email Address" autoComplete="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setMessage(""); }}
                    className={email ? (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "valid" : "invalid") : ""}
                  />
                </div>

                {/* ID Number */}
                <div className="field">
                  <input
                    type="text" placeholder="ID Number" autoComplete="off" spellCheck={false}
                    value={idNumber}
                    onChange={(e) => { setIdNumber(e.target.value); setMessage(""); }}
                    className={idNumber ? "valid" : ""}
                  />
                </div>

                {/* Password */}
                <div className="field">
                  <input
                    type={pwdVisible ? "text" : "password"} placeholder="Password"
                    autoComplete="new-password" style={{ paddingRight: "48px" }}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setMessage(""); }}
                    onFocus={() => setPwdFocused(true)}
                    onBlur={() => setPwdFocused(false)}
                    className={password ? (strength === 5 ? "valid" : "invalid") : ""}
                  />
                  <button className="eye-btn" type="button" onClick={() => setPwdVisible(v => !v)} aria-label="Toggle password">
                    {pwdVisible ? <EyeClosed /> : <EyeOpen />}
                  </button>
                </div>

                {/* Strength bar */}
                {password && (
                  <div className="strength-wrap">
                    <div className="strength-bars">
                      {[1,2,3,4,5].map((n) => (
                        <div key={n} className="strength-bar"
                          style={{ background: n <= strength ? strengthColor : undefined }} />
                      ))}
                    </div>
                    <span className="strength-label" style={{ color: strengthColor }}>{strengthLabel}</span>
                  </div>
                )}

                {/* Rules checklist */}
                {(pwdFocused || (password && strength < 5)) && (
                  <div className="rules-list">
                    {RULES.map((r) => {
                      const pass = r.test(password);
                      return (
                        <div key={r.id} className={`rule-item ${pass ? "pass" : "fail"}`}>
                          <span className="rule-icon">{pass ? "✓" : "○"}</span>
                          {r.label}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Confirm Password */}
                <div className="field">
                  <input
                    type={cfmVisible ? "text" : "password"} placeholder="Confirm Password"
                    autoComplete="new-password" style={{ paddingRight: "48px" }}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setMessage(""); }}
                    className={confirmPassword ? (confirmPassword === password ? "valid" : "invalid") : ""}
                  />
                  <button className="eye-btn" type="button" onClick={() => setCfmVisible(v => !v)} aria-label="Toggle confirm password">
                    {cfmVisible ? <EyeClosed /> : <EyeOpen />}
                  </button>
                </div>

                {/* Submit */}
                <button
                  ref={submitBtnRef}
                  className={`btn-submit${loading ? " loading" : ""}`}
                  type="button"
                  onClick={handleRegister}
                >
                  {loading ? "Creating Account…" : "Create Account"}
                </button>

                <div className="divider"><hr /><span>already have an account?</span><hr /></div>
                <div className="login-link"><Link href="/login">Log in</Link></div>
              </>

            ) : (
              /* ══════════ EMAIL SENT STEP ══════════ */
              <>
                <button className="back-btn" type="button"
                  onClick={() => { setStep("form"); setMessage(""); }}>
                  ← Back
                </button>

                {/* Envelope icon */}
                <div className="sent-icon">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
                    stroke="rgba(224,128,64,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>

                <h2 className="card-title">Check Your Email</h2>

                <p style={{ textAlign:"center", color:"rgba(255,255,255,0.6)", fontSize:"0.85rem", marginBottom:"8px" }}>
                  We sent a verification link to
                </p>
                <div style={{ textAlign:"center" }}>
                  <span className="sent-email">{email}</span>
                </div>

                <p className="sent-hint">
                  Click the <strong style={{ color:"rgba(255,255,255,0.85)" }}>Verify Account</strong> button
                  in that email to activate your account. The link expires in <strong style={{ color:"rgba(255,255,255,0.85)" }}>24 hours</strong>.<br /><br />
                  Don&apos;t see it? Check your spam or junk folder.
                  <br /><br />
You will be redirected to the login page in 5 seconds.
                </p>

                {message && <div className={isError ? "error-msg" : "success-msg"}>{message}</div>}

                {/* Resend */}
                <div className="resend-row">
                  <button
                    className="resend-btn"
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0 || loading}
                    style={{ color: resendCooldown > 0 ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.7)" }}
                  >
                    {resendCooldown > 0
                      ? `Resend email in ${resendCooldown}s`
                      : loading ? "Sending…" : "Resend verification email"}
                  </button>
                </div>

                <div className="divider"><hr /><span>already verified?</span><hr /></div>
                <div className="login-link"><Link href="/login">Go to Login</Link></div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}