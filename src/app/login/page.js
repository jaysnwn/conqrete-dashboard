"use client";

import { useState, useEffect } from "react";
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

  useEffect(() => {
    setIsBooted(true);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsScanning(true);
    setError(null);

    const scrambleInterval = setInterval(() => {
      setDecryptText(Math.random().toString(16).substr(2, 10).toUpperCase());
    }, 50);

    try {
      const [authResponse] = await Promise.all([
        supabase.auth.signInWithPassword({ email, password }),
        new Promise((resolve) => setTimeout(resolve, 2500))
      ]);

      clearInterval(scrambleInterval);

      if (authResponse.error) {
        setIsScanning(false);
        setError("AUTH_FAILED: " + authResponse.error.message);
        return;
      }

      setDecryptText("ACCESS GRANTED");

      setTimeout(async () => {
        const userEmail = email.toLowerCase();
        
        const { data: rep } = await supabase.from("salesmen").select("id").eq("email", userEmail).maybeSingle();
        if (rep) { router.push("/field"); return; }

        const { data: warehouse } = await supabase.from("warehouse_workers").select("id").eq("email", userEmail).maybeSingle();
        if (warehouse) { router.push("/warehouse"); return; }

        router.push("/dashboard"); 
      }, 800);

    } catch (err) {
      clearInterval(scrambleInterval);
      setIsScanning(false);
      setError("SYSTEM CRITICAL FAILURE");
    }
  };

  return (
    <>
      <style jsx>{`
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
        .animate-scan { animation: scanline 8s linear infinite; }
        .animate-laser { animation: laser 1.5s ease-in-out infinite; }
      `}</style>

      <div className="min-h-screen bg-[#030303] flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-cyan-500 selection:text-black">
        
        {/* Background Scanline & Grid */}
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden opacity-30">
          <div className="w-full h-2 bg-cyan-400/50 shadow-[0_0_20px_#22d3ee] animate-scan"></div>
        </div>
        <div className="absolute inset-0 z-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#22d3ee 1px, transparent 1px), linear-gradient(90deg, #22d3ee 1px, transparent 1px)', backgroundSize: '40px 40px', backgroundPosition: 'center center' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-600/10 blur-[120px] rounded-full z-0 pointer-events-none animate-pulse" style={{ animationDuration: '4s' }}></div>

        {/* Main Terminal Window */}
        <div className={`w-full max-w-md relative z-10 transition-all duration-1000 ease-out ${isBooted ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}`}>
          
          <div className="flex justify-between items-end mb-2 px-2">
            <div className="w-12 h-1 bg-cyan-500 shadow-[0_0_10px_#22d3ee]"></div>
            <div className="text-[8px] font-mono text-cyan-500/70 tracking-[0.3em] uppercase">Sys.Auth.v2.4</div>
          </div>

          <div className="bg-black/80 backdrop-blur-xl border border-cyan-500/20 p-8 sm:p-10 shadow-[0_0_40px_rgba(0,0,0,0.8)] relative group min-h-[450px] flex flex-col justify-center">
            
            {/* Brackets */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400 transition-all duration-500 group-hover:w-6 group-hover:h-6"></div>
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400 transition-all duration-500 group-hover:w-6 group-hover:h-6"></div>
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400 transition-all duration-500 group-hover:w-6 group-hover:h-6"></div>
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400 transition-all duration-500 group-hover:w-6 group-hover:h-6"></div>

            {/* Header */}
            <div className={`text-center relative transition-all duration-500 ${isScanning ? 'mb-4 scale-75 opacity-50' : 'mb-10 scale-100 opacity-100'}`}>
              <h1 className="text-4xl sm:text-5xl font-black italic tracking-tighter text-white uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">CONQRETE</h1>
              <div className="flex items-center justify-center gap-2 mt-3">
                <span className="w-2 h-2 bg-red-500 animate-pulse rounded-full shadow-[0_0_8px_#ef4444]"></span>
                <p className="text-[9px] text-cyan-400 font-mono uppercase tracking-[0.5em]">Restricted Access</p>
              </div>
            </div>

            {isScanning ? (
              <div className="flex flex-col items-center justify-center py-6 animate-in fade-in duration-500">
                <div className="relative w-32 h-32 border border-cyan-500/20 mb-8 bg-[#050505]">
                  <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400"></div>
                  <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400"></div>
                  <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400"></div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400"></div>
                  <div className="absolute left-0 right-0 h-[2px] bg-cyan-400 shadow-[0_0_15px_#22d3ee] animate-laser z-10"></div>
                  <div className="absolute inset-2 border border-cyan-500/10 rounded-full flex items-center justify-center opacity-50">
                    <div className="w-16 h-16 border border-cyan-500/20 rounded-full animate-ping" style={{ animationDuration: '2s' }}></div>
                    <div className="absolute w-[1px] h-full bg-cyan-500/20"></div>
                    <div className="absolute w-full h-[1px] bg-cyan-500/20"></div>
                  </div>
                </div>
                <p className={`font-mono text-xs tracking-widest uppercase ${decryptText === "ACCESS GRANTED" ? "text-emerald-400 drop-shadow-[0_0_8px_#34d399]" : "text-cyan-400 animate-pulse"}`}>
                  {decryptText === "ACCESS GRANTED" ? "Identity Verified" : "Biometric Analysis"}
                </p>
                <p className={`font-mono text-[10px] tracking-[0.5em] mt-2 ${decryptText === "ACCESS GRANTED" ? "text-emerald-500/50" : "text-cyan-500/50"}`}>
                  {decryptText}
                </p>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="space-y-6 animate-in fade-in duration-500">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 text-[10px] font-mono uppercase tracking-widest text-center animate-pulse">
                    {error}
                  </div>
                )}
                
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] text-cyan-500/70 uppercase font-mono tracking-widest">
                    <span className="w-1.5 h-1.5 bg-cyan-500/50"></span> Identity Tag
                  </label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-[#050505] border border-cyan-900/40 p-4 text-cyan-50 font-mono text-sm outline-none focus:border-cyan-400 focus:bg-[#0a0a0a] transition-all focus:shadow-[0_0_15px_rgba(34,211,238,0.1)]" placeholder="USER.EMAIL@CONQRETE.IN"/>
                </div>
                
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[10px] text-cyan-500/70 uppercase font-mono tracking-widest mt-6">
                    <span className="w-1.5 h-1.5 bg-cyan-500/50"></span> Decryption Key
                  </label>
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-[#050505] border border-cyan-900/40 p-4 text-cyan-50 font-mono text-lg outline-none focus:border-cyan-400 focus:bg-[#0a0a0a] tracking-[0.3em] transition-all focus:shadow-[0_0_15px_rgba(34,211,238,0.1)]" placeholder="••••••••"/>
                </div>

                {/* THE FIXED BUTTON */}
                <button 
                  type="submit" 
                  className="w-full mt-8 bg-transparent border border-cyan-500 py-4 font-mono font-bold uppercase text-xs tracking-[0.3em] text-cyan-400 transition-all duration-300 hover:bg-cyan-500 hover:text-black hover:shadow-[0_0_20px_rgba(34,211,238,0.5)]"
                >
                  Authenticate
                </button>
              </form>
            )}

          </div>

          <div className="flex justify-between items-start mt-2 px-2">
            <div className="text-[8px] font-mono text-cyan-500/40 tracking-widest uppercase">ERP_NODE_01</div>
            <div className="w-16 h-[2px] bg-cyan-500/30"></div>
          </div>

        </div>
      </div>
    </>
  );
}