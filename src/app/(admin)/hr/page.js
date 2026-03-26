"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function HumanResources() {
  const [activeTab, setActiveTab] = useState("registry");
  const [employees, setEmployees] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- WIZARD & EDIT STATE ---
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const initialFormState = {
    id: null, full_name: "", phone_number: "", personal_email: "", dob: "", gender: "",
    employee_id: `CQ-${Math.floor(1000 + Math.random() * 9000)}`, role: "Salesman", department: "", joining_date: "", employment_type: "Full-time", reporting_manager: "", work_location: "",
    commission_rate: 0, incentive_structure: "", shift_timing: "", primary_responsibility: "",
    base_salary: 0, payment_cycle: "Monthly", bank_account_no: "", bank_ifsc: "", upi_id: "",
    work_email: "", password: "", status: "Active"
  };

  const [formData, setFormData] = useState(initialFormState);

  // --- CALENDAR & LEAVE STATE ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveData, setLeaveData] = useState({ employee_id: "", start_date: "", end_date: "", leave_type: "Paid Leave" });

  useEffect(() => {
    fetchHRData();
  }, []);

  const fetchHRData = async () => {
    setIsLoading(true);
    const [empRes, leaveRes] = await Promise.all([
      supabase.from("employees").select("*").order("created_at", { ascending: false }),
      supabase.from("leave_requests").select("*")
    ]);
    
    setEmployees(empRes.data || []);
    setLeaves(leaveRes.data || []);
    setIsLoading(false);
  };

  // ==========================================
  // 1. ONBOARDING & EDIT WIZARD LOGIC
  // ==========================================
  const handleNext = () => setStep(prev => Math.min(prev + 1, 4));
  const handleBack = () => setStep(prev => Math.max(prev - 1, 1));

  const closeModal = () => {
    setIsWizardOpen(false);
    setTimeout(() => {
      setStep(1);
      setFormData(initialFormState);
      setIsEditing(false);
    }, 300);
  };

  const handleEditClick = (emp) => {
    setFormData({ ...emp, password: "" }); 
    setIsEditing(true);
    setStep(1);
    setIsWizardOpen(true);
  };

  const handleOnboardOrUpdate = async (e) => {
    e.preventDefault();
    
    if (step !== 4) return handleNext(); 
    
    setIsSubmitting(true);
    try {
      if (isEditing) {
        // UPDATE EXISTING RECORD
        const { error: dbError } = await supabase.from("employees").update({
          full_name: formData.full_name, phone_number: formData.phone_number, personal_email: formData.personal_email, dob: formData.dob || null, gender: formData.gender,
          role: formData.role, department: formData.department, joining_date: formData.joining_date || null, employment_type: formData.employment_type, reporting_manager: formData.reporting_manager, work_location: formData.work_location,
          base_salary: formData.base_salary, payment_cycle: formData.payment_cycle, bank_account_no: formData.bank_account_no, bank_ifsc: formData.bank_ifsc, upi_id: formData.upi_id,
          commission_rate: formData.commission_rate, incentive_structure: formData.incentive_structure, shift_timing: formData.shift_timing, primary_responsibility: formData.primary_responsibility,
          work_email: formData.work_email, status: formData.status
        }).eq('id', formData.id);

        if (dbError) throw dbError;
        alert(`✅ ${formData.full_name}'s profile updated successfully!`);
      } else {
        // CREATE NEW RECORD
        if (formData.password.length < 6) throw new Error("Passcode must be at least 6 characters.");

        const { error: authError } = await supabase.auth.signUp({
          email: formData.work_email,
          password: formData.password,
        });
        if (authError) throw authError;

        const { error: dbError } = await supabase.from("employees").insert([{
          full_name: formData.full_name, phone_number: formData.phone_number, personal_email: formData.personal_email, dob: formData.dob || null, gender: formData.gender,
          employee_id: formData.employee_id, role: formData.role, department: formData.department, joining_date: formData.joining_date || null, employment_type: formData.employment_type, reporting_manager: formData.reporting_manager, work_location: formData.work_location,
          base_salary: formData.base_salary, payment_cycle: formData.payment_cycle, bank_account_no: formData.bank_account_no, bank_ifsc: formData.bank_ifsc, upi_id: formData.upi_id,
          commission_rate: formData.commission_rate, incentive_structure: formData.incentive_structure, shift_timing: formData.shift_timing, primary_responsibility: formData.primary_responsibility,
          work_email: formData.work_email, status: formData.status
        }]);

        if (dbError) throw dbError;
        alert(`✅ ${formData.full_name} successfully provisioned!`);
      }

      closeModal();
      fetchHRData();
    } catch (err) {
      alert("Action Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTerminate = async (id, name) => {
    if (!window.confirm(`CRITICAL WARNING: Terminate ${name}? This will remove their profile.`)) return;
    await supabase.from("employees").delete().eq("id", id);
    fetchHRData();
  };

  // ==========================================
  // 2. CALENDAR & LEAVE LOGIC
  // ==========================================
  const handleLogLeave = async (e) => {
    e.preventDefault();
    if(!leaveData.employee_id) return alert("Select an employee");
    
    const emp = employees.find(e => e.id === leaveData.employee_id);
    
    try {
      const { error } = await supabase.from("leave_requests").insert([{
        employee_id: emp.id,
        employee_name: emp.full_name,
        start_date: leaveData.start_date,
        end_date: leaveData.end_date,
        leave_type: leaveData.leave_type,
        status: "Approved" 
      }]);

      if (error) throw error;
      
      alert(`Leave logged for ${emp.full_name}`);
      setIsLeaveModalOpen(false);
      setLeaveData({ employee_id: "", start_date: "", end_date: "", leave_type: "Paid Leave" });
      fetchHRData();
    } catch (err) {
      alert("Error logging leave: " + err.message);
    }
  };

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));

  // Calendar Day Renderer
  const renderCalendarDays = () => {
    const blanks = Array.from({ length: firstDay }, (_, i) => <div key={`blank-${i}`} className="p-4 border border-gray-900/50 bg-[#030303]/50 min-h-[100px] sm:min-h-[120px]"></div>);
    
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = cellDateStr === new Date().toISOString().split('T')[0];
      const dayLeaves = leaves.filter(l => cellDateStr >= l.start_date && cellDateStr <= l.end_date);

      return (
        <div key={day} className={`p-2 sm:p-3 border border-gray-800 min-h-[100px] sm:min-h-[120px] bg-[#0a0a0a] hover:bg-[#111] transition-colors group relative ${isToday ? 'border-cyan-500/50 shadow-[inset_0_0_20px_rgba(34,211,238,0.1)]' : ''}`}>
          <p className={`text-xs font-mono font-black mb-2 ${isToday ? 'text-cyan-400' : 'text-gray-500 group-hover:text-white'}`}>{day}</p>
          <div className="space-y-1 overflow-hidden">
            {dayLeaves.map((leave, idx) => (
              <div key={idx} className={`text-[9px] uppercase font-black tracking-widest px-2 py-1 rounded truncate shadow-sm ${
                leave.leave_type === 'Sick Leave' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 
                leave.leave_type === 'Unpaid Leave' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
                {leave.employee_name.split(' ')[0]} 
              </div>
            ))}
          </div>
        </div>
      );
    });
    return [...blanks, ...days];
  };

  const admins = employees.filter(e => e.role === "Admin");
  const salesmen = employees.filter(e => e.role === "Salesman");
  const warehouse = employees.filter(e => e.role === "Warehouse");

  return (
    <div className="p-6 md:p-8 pt-28 md:pt-8 pb-32 md:pb-20 text-white min-h-screen bg-[#030303] selection:bg-cyan-500 selection:text-black">
      
      {/* HEADER & TABS */}
      <div className="mb-8 border-b border-gray-800 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">HUMAN RESOURCES</h1>
          
          <div className="flex bg-[#111] border border-gray-800 rounded-xl p-1 mt-6 w-full md:w-auto shadow-lg">
            <button 
              onClick={() => setActiveTab("registry")} 
              className={`flex-1 md:flex-none px-8 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === "registry" ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(34,211,238,0.1)]" : "text-gray-500 hover:text-white"}`}
            >
              Master Registry
            </button>
            <button 
              onClick={() => setActiveTab("calendar")} 
              className={`flex-1 md:flex-none px-8 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === "calendar" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(52,211,153,0.1)]" : "text-gray-500 hover:text-white"}`}
            >
              Company Calendar
            </button>
          </div>
        </div>
        
        {activeTab === "registry" && (
          <div className="flex items-center gap-8 w-full md:w-auto">
            <div className="text-right hidden sm:block">
              <p className="text-3xl font-mono font-black text-cyan-400">{employees.length}</p>
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Total Headcount</p>
            </div>
            <button 
              onClick={() => { setIsEditing(false); setFormData(initialFormState); setIsWizardOpen(true); }}
              className="w-full md:w-auto bg-transparent border border-cyan-500 text-cyan-400 px-6 py-4 font-mono font-bold uppercase text-xs tracking-widest hover:bg-cyan-500 hover:text-black hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all duration-300 active:scale-95"
            >
              + Provision Personnel
            </button>
          </div>
        )}

        {activeTab === "calendar" && (
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
            <button 
              onClick={() => setIsLeaveModalOpen(true)}
              className="bg-transparent border border-orange-500 text-orange-400 px-4 py-2 rounded-lg font-mono font-bold uppercase text-[10px] tracking-widest hover:bg-orange-500 hover:text-black transition-all"
            >
              + Log Leave
            </button>
            <div className="flex items-center bg-[#0a0a0a] border border-gray-800 rounded-xl p-2 w-full md:w-auto justify-between">
              <button onClick={prevMonth} className="px-4 py-2 text-gray-500 hover:text-emerald-400 transition-colors">◀</button>
              <span className="text-sm font-black text-white uppercase tracking-widest px-4 w-40 text-center">
                {monthNames[month]} {year}
              </span>
              <button onClick={nextMonth} className="px-4 py-2 text-gray-500 hover:text-emerald-400 transition-colors">▶</button>
            </div>
          </div>
        )}
      </div>

      {/* --- TAB 1: MASTER REGISTRY --- */}
      {activeTab === "registry" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {isLoading ? (
            <div className="text-center py-32 text-cyan-400 font-mono text-xs tracking-widest uppercase animate-pulse">Loading Registry Data...</div>
          ) : employees.length === 0 ? (
            <div className="text-center py-32 bg-[#0a0a0a] border border-gray-800 rounded-3xl shadow-2xl">
              <p className="text-gray-500 font-mono text-xs tracking-widest uppercase">Master Database Empty.</p>
              <p className="text-cyan-500 font-bold text-[10px] uppercase mt-2">Click '+ Provision Personnel' to begin.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8">
              {admins.length > 0 && (
                <div className="bg-[#0a0a0a] border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
                  <div className="p-6 border-b border-gray-800 bg-[#050505] flex justify-between items-center">
                    <h3 className="text-base font-black italic text-cyan-400 uppercase tracking-widest">System Administrators</h3>
                  </div>
                  <div className="divide-y divide-gray-900">
                    {admins.map(user => (
                      <div key={user.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 hover:bg-white/[0.02] group transition-colors gap-4">
                        <div className="flex-1">
                          <p className="font-bold text-white uppercase text-base">{user.full_name} <span className="text-[10px] text-gray-500 ml-2 border border-gray-800 px-2 py-0.5 rounded bg-[#111]">{user.employee_id}</span></p>
                          <p className="text-xs text-cyan-500/70 font-mono mt-1">{user.work_email}</p>
                        </div>
                        <div className="flex-1 text-left sm:text-center">
                          <span className={`text-[10px] border px-4 py-1.5 rounded-full uppercase tracking-widest font-black ${user.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>{user.status}</span>
                        </div>
                        <div className="flex-1 text-left sm:text-right w-full sm:w-auto flex gap-2 justify-end">
                          <button onClick={() => handleEditClick(user)} className="text-[10px] text-cyan-500 font-bold uppercase tracking-widest border border-cyan-500/20 bg-cyan-500/10 hover:bg-cyan-500 hover:text-black px-4 py-2 rounded-lg transition-all">Edit</button>
                          <button onClick={() => handleTerminate(user.id, user.full_name)} className="text-[10px] text-gray-500 font-bold uppercase tracking-widest sm:opacity-0 group-hover:opacity-100 transition-all border border-gray-800 hover:border-red-500/50 bg-[#111] hover:bg-red-500/10 hover:text-red-400 px-4 py-2 rounded-lg">Terminate</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {salesmen.length > 0 && (
                <div className="bg-[#0a0a0a] border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
                  <div className="p-6 border-b border-gray-800 bg-[#050505] flex justify-between items-center">
                    <h3 className="text-base font-black italic text-emerald-400 uppercase tracking-widest">Field Sales Force</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 p-4 gap-4 bg-[#030303]">
                    {salesmen.map(user => (
                      <div key={user.id} className="bg-[#0a0a0a] border border-gray-800 p-5 rounded-2xl relative group hover:border-emerald-900/50 transition-colors">
                        <div className="absolute top-4 right-4 flex gap-3">
                          <button onClick={() => handleEditClick(user)} className="text-xs text-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity">✏️</button>
                          <button onClick={() => handleTerminate(user.id, user.full_name)} className="text-xs text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">🗑️</button>
                        </div>
                        <p className="font-bold text-white uppercase text-base pr-16 tracking-tight">{user.full_name}</p>
                        <p className="text-[10px] text-gray-500 font-mono mt-1">{user.employee_id}</p>
                        <div className="mt-4 pt-4 border-t border-gray-800/50 grid grid-cols-2 gap-2">
                          <div><p className="text-[8px] text-gray-500 uppercase font-black tracking-widest">Territory</p><p className="text-xs text-emerald-400 font-bold uppercase mt-0.5">{user.work_location || 'Field'}</p></div>
                          <div><p className="text-[8px] text-gray-500 uppercase font-black tracking-widest">Commission</p><p className="text-xs text-white font-mono mt-0.5">{user.commission_rate}%</p></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {warehouse.length > 0 && (
                <div className="bg-[#0a0a0a] border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
                  <div className="p-6 border-b border-gray-800 bg-[#050505] flex justify-between items-center">
                    <h3 className="text-base font-black italic text-orange-400 uppercase tracking-widest">Warehouse & Logistics</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 p-4 gap-4 bg-[#030303]">
                    {warehouse.map(user => (
                      <div key={user.id} className="bg-[#0a0a0a] border border-gray-800 p-5 rounded-2xl relative group hover:border-orange-900/50 transition-colors">
                        <div className="absolute top-4 right-4 flex gap-3">
                          <button onClick={() => handleEditClick(user)} className="text-xs text-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity">✏️</button>
                          <button onClick={() => handleTerminate(user.id, user.full_name)} className="text-xs text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">🗑️</button>
                        </div>
                        <p className="font-bold text-white uppercase text-base pr-16 tracking-tight">{user.full_name}</p>
                        <p className="text-[10px] text-gray-500 font-mono mt-1">{user.employee_id}</p>
                        <div className="mt-4 pt-4 border-t border-gray-800/50 grid grid-cols-2 gap-2">
                          <div><p className="text-[8px] text-gray-500 uppercase font-black tracking-widest">Duty</p><p className="text-xs text-orange-400 font-bold uppercase mt-0.5">{user.primary_responsibility || 'General Staff'}</p></div>
                          <div><p className="text-[8px] text-gray-500 uppercase font-black tracking-widest">Shift</p><p className="text-xs text-white font-mono mt-0.5">{user.shift_timing || 'Standard'}</p></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 2: COMPANY CALENDAR --- */}
      {activeTab === "calendar" && (
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-7 border-b border-gray-800 bg-[#050505]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-4 text-center text-[10px] font-black uppercase tracking-widest text-emerald-400/50">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 bg-[#111] gap-px">
            {renderCalendarDays()}
          </div>
        </div>
      )}

      {/* --- LEAVE LOGGING MODAL --- */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 bg-black/95 z-[70] flex items-center justify-center p-4 backdrop-blur-xl">
          <div className="bg-[#0a0a0a] border border-gray-800 p-8 rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-300 relative">
            <button onClick={() => setIsLeaveModalOpen(false)} className="absolute top-6 right-6 text-gray-600 hover:text-white text-2xl leading-none">×</button>
            <h2 className="text-xl font-black italic text-orange-400 uppercase tracking-tighter mb-6">Log Absence</h2>
            
            <form onSubmit={handleLogLeave} className="space-y-4">
              <div>
                <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Employee</label>
                <select required value={leaveData.employee_id} onChange={e => setLeaveData({...leaveData, employee_id: e.target.value})} className="w-full bg-[#050505] border border-gray-800 p-4 rounded-xl text-white text-sm outline-none focus:border-orange-400">
                  <option value="">Select personnel...</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.role})</option>)}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Start Date</label>
                  <input required type="date" value={leaveData.start_date} onChange={e => setLeaveData({...leaveData, start_date: e.target.value})} className="w-full bg-[#050505] border border-gray-800 p-4 rounded-xl text-white text-sm outline-none focus:border-orange-400 [&::-webkit-calendar-picker-indicator]:invert" />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">End Date</label>
                  <input required type="date" value={leaveData.end_date} onChange={e => setLeaveData({...leaveData, end_date: e.target.value})} className="w-full bg-[#050505] border border-gray-800 p-4 rounded-xl text-white text-sm outline-none focus:border-orange-400 [&::-webkit-calendar-picker-indicator]:invert" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Leave Classification</label>
                <select value={leaveData.leave_type} onChange={e => setLeaveData({...leaveData, leave_type: e.target.value})} className="w-full bg-[#050505] border border-gray-800 p-4 rounded-xl text-white text-sm outline-none focus:border-orange-400">
                  <option value="Paid Leave">Paid Leave</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Unpaid Leave">Unpaid Leave (LWP)</option>
                </select>
              </div>

              <button type="submit" className="w-full mt-6 bg-orange-500 text-black py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-orange-400 active:scale-95 transition-transform shadow-[0_0_15px_rgba(249,115,22,0.3)]">
                Register Leave
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- ONBOARDING / EDIT WIZARD MODAL --- */}
      {isWizardOpen && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4 backdrop-blur-xl overflow-y-auto">
          <div className="bg-[#0a0a0a] border border-gray-800 p-8 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] w-full max-w-2xl relative my-8 animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 blur-[80px] rounded-full pointer-events-none"></div>
            <button onClick={closeModal} className="absolute top-6 right-6 text-gray-600 hover:text-white text-3xl leading-none z-20 transition-colors">×</button>

            <div className="mb-8 relative z-10">
              <div className="flex justify-between items-end mb-4 pr-8">
                <h2 className="text-2xl font-black italic text-cyan-400 uppercase tracking-tighter">{isEditing ? "Modify Personnel" : "Onboarding Terminal"}</h2>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/30 px-3 py-1 rounded-full border border-cyan-500/20 tracking-widest">PHASE {step} / 4</span>
              </div>
              <div className="w-full bg-[#111] h-1.5 rounded-full overflow-hidden flex gap-1">
                <div className={`h-full transition-all duration-500 rounded-full ${step >= 1 ? 'bg-cyan-400 w-1/4 shadow-[0_0_8px_#22d3ee]' : 'bg-transparent w-0'}`}></div>
                <div className={`h-full transition-all duration-500 rounded-full ${step >= 2 ? 'bg-cyan-400 w-1/4 shadow-[0_0_8px_#22d3ee]' : 'bg-transparent w-0'}`}></div>
                <div className={`h-full transition-all duration-500 rounded-full ${step >= 3 ? 'bg-cyan-400 w-1/4 shadow-[0_0_8px_#22d3ee]' : 'bg-transparent w-0'}`}></div>
                <div className={`h-full transition-all duration-500 rounded-full ${step >= 4 ? 'bg-emerald-400 w-1/4 shadow-[0_0_10px_#34d399]' : 'bg-transparent w-0'}`}></div>
              </div>
            </div>

            <form onSubmit={handleOnboardOrUpdate} className="relative z-10 min-h-[420px] flex flex-col justify-between">
              
              {step === 1 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
                  <p className="text-xs text-white font-black uppercase tracking-widest border-b border-gray-800 pb-2 mb-6">1. Core Identity</p>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Full Legal Name</label>
                    <input required autoFocus type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full bg-[#050505] border border-gray-800 p-4 rounded-xl text-white text-sm outline-none focus:border-cyan-400 transition-colors" />
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Phone Number</label>
                      <input required type="text" value={formData.phone_number} onChange={e => setFormData({...formData, phone_number: e.target.value})} className="w-full bg-[#050505] border border-gray-800 p-4 rounded-xl text-white font-mono text-sm outline-none focus:border-cyan-400 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Personal Email</label>
                      <input type="email" value={formData.personal_email} onChange={e => setFormData({...formData, personal_email: e.target.value})} className="w-full bg-[#050505] border border-gray-800 p-4 rounded-xl text-white text-sm outline-none focus:border-cyan-400 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Date of Birth</label>
                      <input type="date" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} className="w-full bg-[#050505] border border-gray-800 p-4 rounded-xl text-gray-400 text-sm outline-none focus:border-cyan-400 [&::-webkit-calendar-picker-indicator]:invert transition-colors" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Gender</label>
                      <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-full bg-[#050505] border border-gray-800 p-4 rounded-xl text-gray-400 text-sm outline-none focus:border-cyan-400 transition-colors">
                        <option value="">Select...</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
                  <p className="text-xs text-white font-black uppercase tracking-widest border-b border-gray-800 pb-2 mb-6">2. Employment & Role</p>
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Employee ID</label>
                      <input readOnly type="text" value={formData.employee_id} className="w-full bg-[#111] border border-gray-800 p-4 rounded-xl text-cyan-400 font-mono font-bold text-sm outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-cyan-500 mb-2 uppercase font-black tracking-widest">System Role</label>
                      <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full bg-[#050505] border border-cyan-900/50 p-4 rounded-xl text-cyan-400 font-bold text-sm outline-none focus:border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.1)]">
                        <option value="Admin">Admin</option>
                        <option value="Salesman">Salesman</option>
                        <option value="Warehouse">Warehouse</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Department</label>
                      <input type="text" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} className="w-full bg-[#050505] border border-gray-800 p-4 rounded-xl text-white text-sm outline-none focus:border-cyan-400 transition-colors" placeholder="e.g. Sales, Logistics" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Employment Type</label>
                      <select value={formData.employment_type} onChange={e => setFormData({...formData, employment_type: e.target.value})} className="w-full bg-[#050505] border border-gray-800 p-4 rounded-xl text-white text-sm outline-none focus:border-cyan-400 transition-colors">
                        <option value="Full-time">Full-time</option>
                        <option value="Contract">Contract</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Reporting Manager</label>
                      <input type="text" value={formData.reporting_manager} onChange={e => setFormData({...formData, reporting_manager: e.target.value})} className="w-full bg-[#050505] border border-gray-800 p-4 rounded-xl text-white text-sm outline-none focus:border-cyan-400 transition-colors" placeholder="Manager Name" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Work Location</label>
                      <input type="text" value={formData.work_location} onChange={e => setFormData({...formData, work_location: e.target.value})} className="w-full bg-[#050505] border border-gray-800 p-4 rounded-xl text-white text-sm outline-none focus:border-cyan-400 transition-colors" placeholder="HQ / Territory" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Joining Date</label>
                      <input type="date" value={formData.joining_date} onChange={e => setFormData({...formData, joining_date: e.target.value})} className="w-full bg-[#050505] border border-gray-800 p-4 rounded-xl text-gray-400 text-sm outline-none focus:border-cyan-400 [&::-webkit-calendar-picker-indicator]:invert transition-colors" />
                    </div>
                  </div>

                  {formData.role === "Salesman" && (
                    <div className="p-5 bg-cyan-950/20 border border-cyan-900/50 rounded-2xl mt-4 animate-in fade-in duration-300">
                      <p className="text-[10px] text-cyan-500 font-black uppercase tracking-widest mb-4">Field Sales Specs</p>
                      <div className="grid grid-cols-2 gap-5">
                        <div>
                          <label className="block text-[9px] text-gray-400 mb-2 uppercase tracking-widest font-bold">Commission %</label>
                          <input type="number" step="0.1" value={formData.commission_rate} onChange={e => setFormData({...formData, commission_rate: e.target.value})} className="w-full bg-[#050505] border border-gray-800 p-3 rounded-xl text-emerald-400 font-mono text-sm outline-none focus:border-emerald-400" />
                        </div>
                        <div>
                          <label className="block text-[9px] text-gray-400 mb-2 uppercase tracking-widest font-bold">Incentive Tier</label>
                          <input type="text" value={formData.incentive_structure} onChange={e => setFormData({...formData, incentive_structure: e.target.value})} className="w-full bg-[#050505] border border-gray-800 p-3 rounded-xl text-white text-sm outline-none focus:border-cyan-400" placeholder="e.g. Tier 1" />
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.role === "Warehouse" && (
                    <div className="p-5 bg-orange-950/20 border border-orange-900/50 rounded-2xl mt-4 animate-in fade-in duration-300">
                      <p className="text-[10px] text-orange-500 font-black uppercase tracking-widest mb-4">Warehouse Specs</p>
                      <div className="grid grid-cols-2 gap-5">
                        <div>
                          <label className="block text-[9px] text-gray-400 mb-2 uppercase tracking-widest font-bold">Shift Timing</label>
                          <input type="text" value={formData.shift_timing} onChange={e => setFormData({...formData, shift_timing: e.target.value})} className="w-full bg-[#050505] border border-gray-800 p-3 rounded-xl text-white text-sm outline-none focus:border-orange-400" placeholder="e.g. 9 AM - 6 PM" />
                        </div>
                        <div>
                          <label className="block text-[9px] text-gray-400 mb-2 uppercase tracking-widest font-bold">Responsibility</label>
                          <select value={formData.primary_responsibility} onChange={e => setFormData({...formData, primary_responsibility: e.target.value})} className="w-full bg-[#050505] border border-gray-800 p-3 rounded-xl text-white text-sm outline-none focus:border-orange-400">
                            <option value="">Select Duty...</option>
                            <option value="Packing">Packing</option>
                            <option value="Inventory">Inventory</option>
                            <option value="Scanning">Scanning</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
                  <p className="text-xs text-white font-black uppercase tracking-widest border-b border-gray-800 pb-2 mb-6">3. Financials & Payroll</p>
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Base Salary (₹)</label>
                      <input required type="number" value={formData.base_salary} onChange={e => setFormData({...formData, base_salary: e.target.value})} className="w-full bg-[#050505] border border-gray-800 p-4 rounded-xl text-white font-mono text-sm outline-none focus:border-cyan-400 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Payment Cycle</label>
                      <select value={formData.payment_cycle} onChange={e => setFormData({...formData, payment_cycle: e.target.value})} className="w-full bg-[#050505] border border-gray-800 p-4 rounded-xl text-white text-sm outline-none focus:border-cyan-400 transition-colors">
                        <option value="Weekly">Weekly</option>
                        <option value="Monthly">Monthly</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Bank Account Number</label>
                      <input type="text" value={formData.bank_account_no} onChange={e => setFormData({...formData, bank_account_no: e.target.value})} className="w-full bg-[#050505] border border-gray-800 p-4 rounded-xl text-white font-mono tracking-widest text-sm outline-none focus:border-cyan-400 transition-colors" placeholder="0000 0000 0000" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">IFSC Code</label>
                      <input type="text" value={formData.bank_ifsc} onChange={e => setFormData({...formData, bank_ifsc: e.target.value.toUpperCase()})} className="w-full bg-[#050505] border border-gray-800 p-4 rounded-xl text-white font-mono text-sm outline-none focus:border-cyan-400 transition-colors" placeholder="SBIN0001234" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">UPI ID (Optional)</label>
                      <input type="text" value={formData.upi_id} onChange={e => setFormData({...formData, upi_id: e.target.value})} className="w-full bg-[#050505] border border-gray-800 p-4 rounded-xl text-white font-mono text-sm outline-none focus:border-cyan-400 transition-colors" placeholder="name@bank" />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4 */}
              {step === 4 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
                  <p className="text-xs text-emerald-400 font-black uppercase tracking-widest border-b border-emerald-900/50 pb-2 mb-6 drop-shadow-[0_0_8px_#34d399]">4. System Access</p>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Work Email (Login ID)</label>
                    <input required type="email" value={formData.work_email} onChange={e => setFormData({...formData, work_email: e.target.value})} className="w-full bg-[#050505] border border-emerald-900/50 p-4 rounded-xl text-white font-mono text-sm outline-none focus:border-emerald-400 focus:bg-emerald-950/10 transition-colors" placeholder="name@conqrete.in" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black tracking-widest">Assign Secure Passcode</label>
                    <input required={!isEditing} type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-[#050505] border border-emerald-900/50 p-4 rounded-xl text-emerald-400 font-mono tracking-widest text-sm outline-none focus:border-emerald-400 focus:bg-emerald-950/10 transition-colors" placeholder={isEditing ? "Leave blank to keep current passcode" : "Min 6 characters"} />
                  </div>
                  
                  <div className="bg-[#111] p-5 rounded-xl border border-gray-800 mt-6 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Account Status</p>
                      <p className="text-xs text-white font-black uppercase mt-1">{formData.status}</p>
                    </div>
                    <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="bg-[#050505] border border-gray-700 text-xs font-bold uppercase tracking-widest text-white p-3 rounded-lg outline-none cursor-pointer hover:border-cyan-500 transition-colors">
                      <option value="Active">Active</option>
                      <option value="On Leave">On Leave</option>
                      {isEditing && <option value="Suspended">Suspended</option>}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-8 mt-8 border-t border-gray-800">
                {step > 1 && (
                  <button type="button" onClick={handleBack} className="w-1/4 bg-[#111] border border-gray-800 py-4 rounded-xl font-bold uppercase text-xs tracking-widest text-gray-400 hover:text-white hover:border-gray-600 transition-all active:scale-95">Back</button>
                )}
                <button type="submit" disabled={isSubmitting} className={`flex-1 py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-xl active:scale-95 disabled:opacity-50 ${step === 4 ? 'bg-emerald-500 text-black hover:bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.3)]' : 'bg-transparent border border-cyan-500 text-cyan-400 hover:bg-cyan-500 hover:text-black'}`}>
                  {isSubmitting ? "Processing..." : step === 4 ? (isEditing ? "Save Changes" : "Deploy Personnel") : "Next Step"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}