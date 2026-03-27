"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  // Animation States
  const [isBooted, setIsBooted] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [decryptText, setDecryptText] = useState("AWAITING INPUT");

  const router = useRouter();
  const scrambleIntervalRef = useRef(null);

  useEffect(() => {
    setIsBooted(true);
    return () => {
      if (scrambleIntervalRef.current) clearInterval(scrambleIntervalRef.current);
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isScanning) return;

    setIsScanning(true);
    setError(null);
    setDecryptText("AWAITING INPUT");

    scrambleIntervalRef.current = setInterval(() => {
      setDecryptText(Math.random().toString(16).substring(2, 12).toUpperCase());
    }, 50);

    try {
      const [authResponse] = await Promise.all([
        supabase.auth.signInWithPassword({ email, password }),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);

      clearInterval(scrambleIntervalRef.current);

      if (authResponse.error) {
        setIsScanning(false);
        setDecryptText("AWAITING INPUT");
        setError("AUTH_FAILED: " + authResponse.error.message);
        return;
      }

      setDecryptText("ACCESS GRANTED");
      await new Promise((resolve) => setTimeout(resolve, 800));

      const userEmail = authResponse.data.session.user.email?.toLowerCase();
      const { data: employee } = await supabase
        .from("employees")
        .select("role")
        .eq("work_email", userEmail)
        .maybeSingle();

      const userRole = employee?.role?.toLowerCase();

      if (userRole === "salesman" || userRole === "sales") {
        router.push("/field");
      } else if (userRole === "warehouse" || userRole === "warehouse_worker") {
        router.push("/warehouse");
      } else {
        router.push("/dashboard");
      }

    } catch (err) {
      console.error("Login Route Error:", err);
      clearInterval(scrambleIntervalRef.current);
      setIsScanning(false);
      setDecryptText("AWAITING INPUT");
      setError("SYSTEM CRITICAL FAILURE");
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Manrope:wght@300;400;500;600;700&display=swap');

        /* STRICT SCROLL LOCK & NO ZOOM */
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          overflow: hidden !important;
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
          -webkit-touch-callout: none;
        }

        /* PREVENT MOBILE ZOOM ON INPUT FOCUS */
        input, textarea, select {
          font-size: 16px !important;
        }

        @keyframes scanline {
          0% { transform: translateY(-100vh); }
          100% { transform: translateY(100vh); }
        }
        @keyframes laser {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes dataStream {
          0% { transform: translateY(-100%); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        
        .animate-scan { animation: scanline 8s linear infinite; }
        .animate-laser { animation: laser 1.5s ease-in-out infinite; }
        .animate-data-stream { animation: dataStream 4s ease-in-out infinite; }

        .glass-panel {
          background: rgba(23, 26, 28, 0.6);
          backdrop-filter: blur(32px);
          -webkit-backdrop-filter: blur(32px);
          border-top: 1px solid rgba(161, 250, 255, 0.1);
          border-left: 1px solid rgba(161, 250, 255, 0.1);
        }
        .data-grid {
          background-image: radial-gradient(rgba(161, 250, 255, 0.05) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .input-field {
          background: rgba(17, 20, 22, 0.8);
          border: none;
          outline: none;
          transition: all 0.3s ease;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 16px !important;
        }
        .input-field:focus {
          background: rgba(35, 38, 41, 0.9);
          box-shadow: 0 0 0 1px rgba(161, 250, 255, 0.3), 0 0 20px rgba(0, 244, 254, 0.08);
        }
        .auth-button {
          background: linear-gradient(135deg, #a1faff 0%, #00f4fe 100%);
          transition: all 0.3s ease;
          font-family: 'Space Grotesk', sans-serif;
        }
        .auth-button:hover {
          box-shadow: 0 0 40px rgba(0, 244, 254, 0.35);
          transform: translateY(-1px);
        }
        .auth-button:active {
          transform: scale(0.98);
        }
        * { font-family: 'Manrope', sans-serif; }
        h1, .font-headline { font-family: 'Space Grotesk', sans-serif; }
      `}</style>

      {/* VIEWPORT LOCKED CONTAINER */}
      <div
        className="h-[100dvh] w-screen flex items-center justify-center p-4 md:p-8 relative overflow-hidden selection:bg-cyan-400/30"
        style={{ backgroundColor: "#0c0e10", color: "#eeeef0" }}
      >
        {/* Background Layer */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 data-grid opacity-30"></div>

          {/* Ambient Glows */}
          <div
            className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full"
            style={{ background: "rgba(161, 250, 255, 0.05)", filter: "blur(120px)" }}
          ></div>
          <div
            className="absolute bottom-[10%] -right-[5%] w-[40%] h-[40%] rounded-full"
            style={{ background: "rgba(159, 142, 255, 0.05)", filter: "blur(100px)" }}
          ></div>

          {/* Vertical Data Stream Line */}
          <div
            className="absolute top-0 h-full right-1/4 w-px"
            style={{ background: "linear-gradient(to bottom, transparent, rgba(0,244,254,0.2), transparent)", opacity: 0.5 }}
          ></div>
          <div
            className="absolute right-1/4 w-px h-[128px] bg-[#00f4fe] animate-data-stream"
            style={{ boxShadow: "0 0 15px rgba(0,244,254,0.8)" }}
          ></div>

          {/* Scanline */}
          <div
            className="absolute inset-x-0 h-2 animate-scan opacity-20 pointer-events-none"
            style={{ background: "rgba(34, 211, 238, 0.5)", boxShadow: "0 0 20px #22d3ee" }}
          ></div>
        </div>

        {/* Top Navigation Shell */}
        <header className="absolute top-0 w-full z-50 flex justify-between items-center px-6 md:px-12 py-6 bg-transparent">
          <div className="font-headline text-lg md:text-xl font-black tracking-widest uppercase text-[#a1faff]" style={{ letterSpacing: "0.2em" }}>
            CONQRETE
          </div>
          <div className="flex items-center gap-6">
            <span
              className="text-xs md:text-sm uppercase tracking-widest cursor-pointer transition-colors duration-300 text-[#747578] hover:text-[#a1faff]"
              style={{ fontFamily: "Space Grotesk, sans-serif" }}
            >
              Help
            </span>
            <div className="w-2 h-2 rounded-full animate-pulse bg-red-500 shadow-[0_0_8px_#ef4444]"></div>
          </div>
        </header>

        {/* LEFT Side Decoration (Copyright) */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 hidden md:flex flex-col items-center gap-8 pl-6 z-20 pointer-events-none">
          <div className="w-px h-16 lg:h-24" style={{ background: "linear-gradient(to bottom, transparent, rgba(70,72,74,0.5), transparent)" }}></div>
          <div
            className="origin-center whitespace-nowrap text-xs uppercase opacity-40 text-[#374151]"
            style={{ transform: "rotate(-90deg)", letterSpacing: "0.3em", fontFamily: "Space Grotesk, sans-serif", fontSize: "9px" }}
          >
            © 2026 CONQRETE. ENCRYPTED CONNECTION ACTIVE.
          </div>
          <div className="w-px h-16 lg:h-24" style={{ background: "linear-gradient(to bottom, transparent, rgba(70,72,74,0.5), transparent)" }}></div>
        </div>

        {/* RIGHT Side Decoration */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 hidden md:flex flex-col items-center gap-8 pr-6 z-20 pointer-events-none">
          <div className="w-px h-16 lg:h-24" style={{ background: "linear-gradient(to bottom, transparent, rgba(70,72,74,0.5), transparent)" }}></div>
          <div
            className="origin-center whitespace-nowrap text-xs uppercase opacity-40 text-[#4b5563]"
            style={{ transform: "rotate(90deg)", letterSpacing: "0.5em", fontFamily: "Space Grotesk, sans-serif", fontSize: "9px" }}
          >
            SECURE PORTAL : ERP_NODE_01
          </div>
          <div className="w-px h-16 lg:h-24" style={{ background: "linear-gradient(to bottom, transparent, rgba(70,72,74,0.5), transparent)" }}></div>
        </div>

        {/* Main Card - Scaled for tighter heights */}
        <div className={`w-full max-w-xl relative z-10 transition-all duration-1000 ease-out max-h-full flex flex-col justify-center ${isBooted ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"}`}>
          <div className="glass-panel p-6 sm:p-8 relative overflow-hidden shadow-2xl rounded-2xl w-full">
            {/* Inner Glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full pointer-events-none" style={{ background: "rgba(0, 244, 254, 0.1)", filter: "blur(48px)" }}></div>

            {/* Header */}
            <div className={`relative z-10 transition-all duration-500 ${isScanning ? "mb-3 scale-90 opacity-40" : "mb-5 sm:mb-6 scale-100 opacity-100"}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px w-6 sm:w-8 bg-[#a1faff]"></div>
                <span className="font-headline text-[10px] sm:text-xs uppercase font-bold text-[#a1faff]" style={{ letterSpacing: "0.4em", fontFamily: "Space Grotesk, sans-serif" }}>
                  Security Terminal
                </span>
              </div>
              <h1 className="font-headline font-bold mb-1 sm:mb-2 text-[#eeeef0]" style={{ fontSize: "clamp(1.4rem, 4vw, 2.4rem)", letterSpacing: "-0.02em", fontFamily: "Space Grotesk, sans-serif", lineHeight: 1.1 }}>
                System Access
              </h1>
              <p className="text-[#aaabad] opacity-70 font-medium text-xs sm:text-sm">
                Decrypt your identification module to enter the Nexus.
              </p>
            </div>

            {/* Scanning State */}
            {isScanning ? (
              <div className="flex flex-col items-center justify-center py-6 sm:py-8 animate-in fade-in duration-500">
                <div className="relative w-24 h-24 sm:w-32 sm:h-32 mb-6 sm:mb-8 bg-[#050505] rounded-lg border border-[#a1faff]/20">
                  <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#a1faff]"></div>
                  <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#a1faff]"></div>
                  <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#a1faff]"></div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#a1faff]"></div>
                  <div className="absolute left-0 right-0 h-px animate-laser z-10 bg-[#a1faff] shadow-[0_0_15px_#a1faff]"></div>
                  <div className="absolute inset-2 flex items-center justify-center opacity-40">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full animate-ping border border-[#a1faff]/30" style={{ animationDuration: "2s" }}></div>
                  </div>
                </div>
                <p
                  className={`text-[10px] sm:text-xs uppercase tracking-widest font-mono ${decryptText === "ACCESS GRANTED" ? "" : "animate-pulse"}`}
                  style={{
                    color: decryptText === "ACCESS GRANTED" ? "#34d399" : "#a1faff",
                    textShadow: decryptText === "ACCESS GRANTED" ? "0 0 8px #34d399" : "none",
                    fontFamily: "Space Grotesk, sans-serif",
                    letterSpacing: "0.3em",
                  }}
                >
                  {decryptText === "ACCESS GRANTED" ? "Identity Verified" : "Biometric Analysis"}
                </p>
                <p
                  className="text-[8px] sm:text-[10px] tracking-widest mt-2 font-mono"
                  style={{
                    color: decryptText === "ACCESS GRANTED" ? "rgba(52,211,153,0.5)" : "rgba(161,250,255,0.5)",
                    letterSpacing: "0.5em",
                  }}
                >
                  {decryptText}
                </p>
              </div>
            ) : (
              /* Form */
              <form onSubmit={handleLogin} className="space-y-4 relative z-10 animate-in fade-in duration-500">
                {error && (
                  <div className="p-2 sm:p-3 text-[10px] sm:text-xs uppercase tracking-widest text-center animate-pulse rounded-lg text-[#ff716c] bg-[#ff716c]/10 border border-[#ff716c]/40 font-headline">
                    {error}
                  </div>
                )}

                {/* Identity Tag */}
                <div className="space-y-2 sm:space-y-3">
                  <label className="block ml-3 sm:ml-4 uppercase font-bold text-[#aaabad] text-[9px] sm:text-[10px] font-headline tracking-[0.2em]">
                    Identity Tag
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-5 sm:left-6 flex items-center pointer-events-none">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#747578" strokeWidth="1.5" className="group-focus-within:stroke-cyan-300 transition-colors">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value.toLowerCase())}
                      className="input-field w-full pl-14 sm:pl-16 pr-4 sm:pr-6 py-3 sm:py-3.5 text-xs sm:text-sm tracking-widest text-[#eeeef0] rounded-xl font-headline"
                      placeholder="user.email@conqrete.in"
                    />
                  </div>
                </div>

                {/* Decryption Key */}
                <div className="space-y-2 sm:space-y-3">
                  <label className="block ml-3 sm:ml-4 uppercase font-bold text-[#aaabad] text-[9px] sm:text-[10px] font-headline tracking-[0.2em]">
                    Decryption Key
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-5 sm:left-6 flex items-center pointer-events-none">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#747578" strokeWidth="1.5" className="group-focus-within:stroke-cyan-300 transition-colors">
                        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                      </svg>
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-field w-full pl-14 sm:pl-16 pr-4 sm:pr-6 py-3 sm:py-3.5 text-sm sm:text-lg tracking-widest text-[#eeeef0] rounded-xl"
                      placeholder="••••••••••••••••"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button type="submit" className="auth-button w-full py-3.5 sm:py-4 font-bold uppercase text-[10px] sm:text-xs flex items-center justify-center gap-3 sm:gap-4 text-[#004346] rounded-full tracking-[0.3em]">
                    AUTHENTICATE
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#004346" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                {/* Footer Links */}
                <div className="flex justify-between items-center px-2 sm:px-4 pt-1">
                  <a href="#" className="text-[8px] sm:text-[10px] uppercase tracking-[0.3em] font-headline text-[#4b5563] hover:text-[#a1faff] transition-colors duration-300">
                    Request Access
                  </a>
                  <a href="#" className="text-[8px] sm:text-[10px] uppercase tracking-[0.3em] font-headline text-[#4b5563] hover:text-[#a1faff] transition-colors duration-300">
                    Override Protocol
                  </a>
                </div>
              </form>
            )}
          </div>

          {/* Bottom Tech Info */}
          <div className="mt-4 flex justify-between px-2 sm:px-4 items-center opacity-40">
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="flex flex-col">
                <span className="uppercase text-[#a1faff] text-[7px] sm:text-[8px] tracking-[0.1em] font-headline">Encryption</span>
                <span className="text-[#aaabad] text-[9px] sm:text-[10px]">AES-4096-QUANTUM</span>
              </div>
              <div className="flex flex-col">
                <span className="uppercase text-[#a1faff] text-[7px] sm:text-[8px] tracking-[0.1em] font-headline">Node Status</span>
                <span className="text-[#aaabad] text-[9px] sm:text-[10px]">OPTIMAL — 12ms</span>
              </div>
            </div>
            <div className="text-[8px] sm:text-[9px] uppercase tracking-[0.3em] font-headline text-[#374151]">
              ERP_NODE_01
            </div>
          </div>
        </div>

        {/* Footer - Only Links */}
        <footer className="absolute bottom-0 w-full flex justify-center md:justify-end items-center px-6 md:px-12 py-6 md:py-8 pointer-events-none">
          <div className="flex gap-6 md:gap-10 pointer-events-auto">
            {["Security Protocol", "Privacy Policy"].map((label) => (
              <a key={label} href="#" className="uppercase transition-colors duration-300 text-[#374151] hover:text-[#a1faff] text-[8px] md:text-[10px] tracking-[0.3em] font-headline opacity-80">
                {label}
              </a>
            ))}
          </div>
        </footer>
      </div>
    </>
  );
}