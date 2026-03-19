"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email, password,
    });

    if (authErr) {
      setError(authErr.message);
      setIsLoading(false);
      return;
    }

    const { data: rep } = await supabase
      .from("salesmen")
      .select("id")
      .eq("email", email.toLowerCase())
      .single();

    if (rep) {
      router.push("/field"); // Salesman
    } else {
      router.push("/dashboard"); // Admin
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#0a0a0a] border border-gray-800 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-[50px] rounded-full"></div>
        <div className="mb-10 text-center relative z-10">
          <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase">CONQRETE</h1>
          <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-[0.3em] mt-2">Secure Operations Terminal</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6 relative z-10">
          {error && <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl text-xs font-bold uppercase text-center">{error}</div>}
          <div>
            <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black">Authorized Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-[#111] border border-gray-800 p-4 rounded-xl text-white text-sm outline-none focus:border-cyan-400" />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black">Passcode</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-[#111] border border-gray-800 p-4 rounded-xl text-white text-sm outline-none focus:border-cyan-400 tracking-widest" />
          </div>
          <button type="submit" disabled={isLoading} className="w-full bg-white text-black py-4 rounded-xl font-black uppercase text-xs active:scale-95 mt-4">
            {isLoading ? "Authenticating..." : "Access Terminal"}
          </button>
        </form>
      </div>
    </div>
  );
}