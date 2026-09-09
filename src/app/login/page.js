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
    <div
      className={`min-h-screen flex items-center justify-center p-4 transition-opacity duration-1000 ${isBooted ? "opacity-100" : "opacity-0"}`}
      style={{ background: "#F8F9FA", fontFamily: "Inter, -apple-system, sans-serif" }}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-[#E5E7EB]"
        style={{ transform: isBooted ? "translateY(0)" : "translateY(20px)", transition: "transform 1s cubic-bezier(0.2, 0.8, 0.2, 1)" }}
      >
        <div className="p-8 text-center border-b border-[#E5E7EB]">
          <div className="mx-auto w-12 h-12 bg-[#0EA5E9] rounded-xl flex items-center justify-center mb-4">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
             </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#111827]">CONQRETE</h1>
          <p className="text-sm font-medium text-[#6B7280] mt-1">Enterprise Resource Planning</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Work Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isScanning}
                className="w-full px-4 py-3 rounded-lg border border-[#D1D5DB] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] transition-all disabled:opacity-50"
                placeholder="name@conqrete.com"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isScanning}
                className="w-full px-4 py-3 rounded-lg border border-[#D1D5DB] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] transition-all disabled:opacity-50"
                placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-sm font-medium text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isScanning}
              className="w-full py-3 px-4 bg-[#0EA5E9] hover:bg-[#0284C7] text-white rounded-lg font-semibold transition-colors disabled:opacity-80 flex items-center justify-center gap-3 relative overflow-hidden"
            >
              {isScanning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="font-mono">{decryptText}</span>
                </>
              ) : (
                "Authenticate"
              )}
            </button>
          </form>
        </div>

        <div className="p-4 bg-[#F9FAFB] border-t border-[#E5E7EB] text-center">
          <p className="text-xs text-[#9CA3AF] font-medium">CONQRETE System Core v4.0.2</p>
        </div>
      </div>
    </div>
  );
}
