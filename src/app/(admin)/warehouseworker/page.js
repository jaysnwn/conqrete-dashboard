"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function WarehouseWorkerAdmin() {
  const [workers, setWorkers] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); // NEW: Added password state
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("warehouse_workers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setWorkers(data || []);
    } catch (err) {
      console.error("Error fetching workers:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddWorker = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // 1. Create the user in Supabase Auth with their password
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters long.");
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: password,
      });

      if (authError) throw authError;

      // 2. Insert the new worker into your database table
      const { data, error } = await supabase
        .from("warehouse_workers")
        .insert([{ name, email }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error("This email is already registered to a worker.");
        }
        throw error;
      }

      // 3. Update the UI and reset the form
      setWorkers([data, ...workers]);
      setName("");
      setEmail("");
      setPassword(""); // Clear password field
      alert(`✅ ${data.name} has been added! They can now log in using their email and password.`);

    } catch (err) {
      console.error("Failed to add worker:", err);
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeAccess = async (workerId, workerName) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to revoke ${workerName}'s access? They will be immediately locked out of the warehouse dashboard.`
    );

    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from("warehouse_workers")
        .delete()
        .eq("id", workerId);

      if (error) throw error;

      // Remove from the UI
      setWorkers(workers.filter((w) => w.id !== workerId));
      
    } catch (err) {
      console.error("Failed to delete worker:", err);
      alert("Could not revoke access.");
    }
  };

  return (
    <div className="p-8 text-white min-h-screen bg-black">
      <div className="mb-12">
        <h1 className="text-4xl font-black italic tracking-tighter uppercase text-white">TEAM MANAGEMENT</h1>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] mt-1">Warehouse & Fulfillment Staff</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* ADD NEW WORKER FORM */}
        <div className="lg:col-span-1">
          <div className="bg-[#0a0a0a] border border-gray-800 p-8 rounded-3xl shadow-2xl sticky top-8">
            <h2 className="text-xl font-black italic text-cyan-400 uppercase tracking-tighter mb-6 border-b border-gray-800 pb-4">
              Authorize New Hire
            </h2>

            <form onSubmit={handleAddWorker} className="space-y-6">
              <div>
                <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full bg-[#111] border border-gray-800 p-4 rounded-xl text-white text-sm outline-none focus:border-cyan-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Work Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@conqrete.in"
                  className="w-full bg-[#111] border border-gray-800 p-4 rounded-xl text-white text-sm outline-none focus:border-cyan-400 transition-colors"
                />
              </div>

              {/* NEW: Password Field Added Here */}
              <div>
                <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Assign Passcode</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full bg-[#111] border border-gray-800 p-4 rounded-xl text-white text-sm outline-none focus:border-cyan-400 tracking-widest transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-white text-black py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-gray-200 active:scale-95 transition-all disabled:opacity-50"
              >
                {isSubmitting ? "Authorizing..." : "+ Add Worker"}
              </button>
            </form>
          </div>
        </div>

        {/* ACTIVE WORKERS ROSTER */}
        <div className="lg:col-span-2">
          <div className="bg-[#0a0a0a] border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-gray-800 flex justify-between items-center bg-[#050505]">
              <h2 className="text-xl font-black italic text-white uppercase tracking-tighter">Active Roster</h2>
              <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase">
                {workers.length} Personnel
              </span>
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#111] text-[10px] text-gray-500 uppercase font-black tracking-widest border-b border-gray-800">
                  <th className="p-6">Worker Details</th>
                  <th className="p-6">System Access</th>
                  <th className="p-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {isLoading ? (
                  <tr>
                    <td colSpan="3" className="p-12 text-center text-gray-500 uppercase tracking-widest text-xs font-bold">
                      Loading Roster...
                    </td>
                  </tr>
                ) : workers.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="p-12 text-center text-gray-500 uppercase tracking-widest text-xs font-bold">
                      No warehouse workers authorized yet.
                    </td>
                  </tr>
                ) : (
                  workers.map((worker) => (
                    <tr key={worker.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="p-6">
                        <p className="text-sm font-bold text-gray-200 uppercase tracking-tight">{worker.name}</p>
                        <p className="text-[10px] text-gray-600 mt-1 uppercase font-mono">{worker.email}</p>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Granted</span>
                        </div>
                        <p className="text-[8px] text-gray-600 mt-1 uppercase">
                          Added: {new Date(worker.created_at).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="p-6 text-center">
                        <button
                          onClick={() => handleRevokeAccess(worker.id, worker.name)}
                          className="text-[9px] border border-gray-700 px-4 py-2 rounded-full text-gray-500 hover:text-white hover:border-red-500 hover:bg-red-500/10 transition-all font-black uppercase tracking-widest"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}