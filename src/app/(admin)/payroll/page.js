"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { jsPDF } from "jspdf";

export default function PayrollEngine() {
  const [activeTab, setActiveTab] = useState("run_payroll");
  const [isLoading, setIsLoading] = useState(true);

  // Data States
  const [employees, setEmployees] = useState([]);
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [lockedPayslips, setLockedPayslips] = useState([]);

  // Filter State
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchPayrollData();
  }, [selectedMonth, selectedYear]);

  const fetchPayrollData = async () => {
    setIsLoading(true);
    
    // Calculate start and end dates for the selected month
    const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
    const nextMonth = selectedMonth === 12 ? 1 : selectedMonth + 1;
    const nextYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const [empRes, ordRes, expRes, leaveRes, slipRes] = await Promise.all([
      supabase.from("employees").select("*"),
      supabase.from("orders").select("*").gte("created_at", startDate).lt("created_at", endDate).neq("status", "Cancelled"),
      supabase.from("expense_claims").select("*"), 
      supabase.from("leave_requests").select("*").gte("start_date", startDate).lt("start_date", endDate).eq("leave_type", "Unpaid Leave"),
      supabase.from("payslips").select("*").eq("month", String(selectedMonth)).eq("year", String(selectedYear))
    ]);

    setEmployees(empRes.data || []);
    setOrders(ordRes.data || []);
    setExpenses(expRes.data || []);
    setLeaves(leaveRes.data || []);
    setLockedPayslips(slipRes.data || []);
    setIsLoading(false);
  };

  // ==========================================
  // 1. EXPENSE APPROVAL LOGIC
  // ==========================================
  const handleExpenseAction = async (id, action) => {
    const { error } = await supabase.from("expense_claims").update({ status: action }).eq("id", id);
    if (error) return alert("Error updating expense: " + error.message);
    fetchPayrollData();
  };

  const pendingExpenses = expenses.filter(e => e.status === "Pending");

  // ==========================================
  // 2. THE PAYROLL CALCULATOR ENGINE
  // ==========================================
  const payrollData = useMemo(() => {
    return employees.map(emp => {
      const existingSlip = lockedPayslips.find(s => s.employee_id === emp.id);
      if (existingSlip) return { ...emp, payroll: existingSlip, isLocked: true };

      const base = Number(emp.base_salary || 0);

      const empOrders = orders.filter(o => o.sales_rep === emp.full_name);
      const totalSold = empOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
      const commissions = totalSold * (Number(emp.commission_rate || 0) / 100);

      const empExpenses = expenses.filter(e => 
        e.employee_id === emp.id && 
        e.status === "Approved" && 
        new Date(e.date).getMonth() + 1 === selectedMonth
      );
      const allowances = empExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

      const empLeaves = leaves.filter(l => l.employee_id === emp.id);
      let unpaidDays = 0;
      empLeaves.forEach(l => {
        const start = new Date(l.start_date);
        const end = new Date(l.end_date);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        unpaidDays += days;
      });
      
      const perDayWage = base / 30;
      const deductions = unpaidDays * perDayWage;

      const net = (base + commissions + allowances) - deductions;

      return {
        ...emp,
        isLocked: false,
        payroll: { base, commissions, allowances, deductions, net, unpaidDays }
      };
    }).sort((a, b) => b.payroll.net - a.payroll.net);
  }, [employees, orders, expenses, leaves, lockedPayslips, selectedMonth]);

  const totalPayrollLiability = payrollData.reduce((sum, emp) => sum + Number(emp.payroll.net), 0);

  // ==========================================
  // 3. LOCK PAYROLL LOGIC
  // ==========================================
  const lockPayroll = async () => {
    if(!window.confirm("WARNING: This will lock in the current math for all unlocked employees and generate their official payslips. Proceed?")) return;

    const slipsToInsert = payrollData.filter(emp => !emp.isLocked).map(emp => ({
      employee_id: emp.id,
      month: String(selectedMonth),
      year: String(selectedYear),
      base_pay: emp.payroll.base,
      commissions_earned: emp.payroll.commissions,
      allowances_approved: emp.payroll.allowances,
      leave_deductions: emp.payroll.deductions,
      net_payout: emp.payroll.net,
      status: "Draft"
    }));

    if(slipsToInsert.length === 0) return alert("All payslips for this month are already locked.");

    const { error } = await supabase.from("payslips").insert(slipsToInsert);
    if(error) return alert("Error locking payroll: " + error.message);
    
    alert("✅ Payroll locked successfully!");
    fetchPayrollData();
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // ==========================================
  // 4. GENERATE PDF HELPER (Used by Email & Download)
  // ==========================================
  const generatePDF = (emp) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text("CONQRETE", 105, 20, null, null, "center");
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Official Salary Slip", 105, 30, null, null, "center");
    doc.text(`Month: ${monthNames[selectedMonth-1]} ${selectedYear}`, 105, 38, null, null, "center");

    // Employee Details
    doc.setLineWidth(0.5);
    doc.line(20, 45, 190, 45);
    doc.setFont("helvetica", "bold");
    doc.text("Employee Name:", 20, 55);
    doc.setFont("helvetica", "normal");
    doc.text(emp.full_name, 60, 55);
    
    doc.setFont("helvetica", "bold");
    doc.text("Employee ID:", 120, 55);
    doc.setFont("helvetica", "normal");
    doc.text(emp.employee_id || "N/A", 160, 55);

    doc.setFont("helvetica", "bold");
    doc.text("Role:", 20, 65);
    doc.setFont("helvetica", "normal");
    doc.text(emp.role, 60, 65);

    doc.line(20, 75, 190, 75);

    // Earnings & Deductions
    doc.setFont("helvetica", "bold");
    doc.text("Earnings", 20, 85);
    doc.text("Amount (INR)", 160, 85);
    
    doc.setFont("helvetica", "normal");
    doc.text("Base Salary", 20, 95);
    doc.text(String(Math.round(emp.payroll.base)), 160, 95);
    
    doc.text("Earned Commissions", 20, 105);
    doc.text(String(Math.round(emp.payroll.commissions)), 160, 105);

    doc.text("Approved Allowances", 20, 115);
    doc.text(String(Math.round(emp.payroll.allowances)), 160, 115);

    doc.setTextColor(220, 53, 69); // Red text for deductions
    doc.text(`Leave Deductions (${emp.payroll.unpaidDays || 0} Days LWP)`, 20, 125);
    doc.text(`- ${String(Math.round(emp.payroll.deductions))}`, 160, 125);

    doc.setTextColor(0, 0, 0); // Back to black
    doc.line(20, 135, 190, 135);

    // Net Total
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Net Payable", 20, 145);
    doc.text(`Rs. ${String(Math.round(emp.payroll.net))}`, 160, 145);

    // Footer Note
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text("This is a system-generated document and does not require a physical signature.", 105, 280, null, null, "center");

    return doc;
  };

  // ==========================================
  // 5. DOWNLOAD & EMAIL FUNCTIONS
  // ==========================================
  const downloadPayslip = (emp) => {
    const doc = generatePDF(emp);
    doc.save(`CONQRETE_Payslip_${emp.full_name.replace(/\s+/g, '_')}_${monthNames[selectedMonth-1]}_${selectedYear}.pdf`);
  };

  const [isSendingId, setIsSendingId] = useState(null);

  const sendPayslipEmail = async (emp) => {
    setIsSendingId(emp.id);
    try {
      const doc = generatePDF(emp);
      const pdfBase64 = doc.output('datauristring');

      const response = await fetch('/api/send-payslip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emp.work_email || emp.personal_email,
          name: emp.full_name,
          monthName: monthNames[selectedMonth-1],
          year: selectedYear,
          pdfBase64: pdfBase64
        })
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);
      
      alert(`✅ Payslip successfully emailed to ${emp.full_name}!`);
    } catch (err) {
      alert("Error sending email: " + err.message);
    } finally {
      setIsSendingId(null);
    }
  };

  return (
    <div className="p-6 md:p-8 pt-28 md:pt-8 pb-32 md:pb-20 text-white min-h-screen bg-[#030303] selection:bg-cyan-500 selection:text-black">
      
      {/* HEADER & TABS */}
      <div className="mb-8 border-b border-gray-800 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">PAYROLL & FINANCE</h1>
          
          <div className="flex bg-[#111] border border-gray-800 rounded-xl p-1 mt-6 w-full md:w-auto shadow-lg">
            <button 
              onClick={() => setActiveTab("run_payroll")} 
              className={`flex-1 md:flex-none px-8 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === "run_payroll" ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(34,211,238,0.1)]" : "text-gray-500 hover:text-white"}`}
            >
              Run Payroll
            </button>
            <button 
              onClick={() => setActiveTab("expenses")} 
              className={`flex-1 md:flex-none px-8 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all relative ${activeTab === "expenses" ? "bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.1)]" : "text-gray-500 hover:text-white"}`}
            >
              Expense Claims
              {pendingExpenses.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] w-5 h-5 flex items-center justify-center rounded-full animate-bounce">{pendingExpenses.length}</span>
              )}
            </button>
          </div>
        </div>

        {activeTab === "run_payroll" && (
          <div className="flex gap-4 items-center w-full md:w-auto">
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="bg-[#0a0a0a] border border-gray-800 text-cyan-400 font-bold p-3 rounded-xl outline-none">
              {monthNames.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-[#0a0a0a] border border-gray-800 text-cyan-400 font-bold p-3 rounded-xl outline-none">
              {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-32 text-cyan-400 font-mono text-xs tracking-widest uppercase animate-pulse">Calculating Financials...</div>
      ) : (
        <>
          {/* --- TAB 1: EXPENSE CLAIMS --- */}
          {activeTab === "expenses" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
              <div className="bg-[#0a0a0a] border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-gray-800 bg-[#050505] flex justify-between items-center">
                  <h3 className="text-base font-black italic text-orange-400 uppercase tracking-widest">Pending Reimbursements</h3>
                </div>
                
                {pendingExpenses.length === 0 ? (
                  <div className="text-center py-20"><p className="text-gray-500 font-mono text-xs tracking-widest uppercase">No pending claims.</p></div>
                ) : (
                  <div className="divide-y divide-gray-900">
                    {pendingExpenses.map(exp => (
                      <div key={exp.id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-white/[0.02] transition-colors">
                        <div>
                          <p className="font-bold text-white uppercase">{exp.employee_name}</p>
                          <p className="text-[10px] text-gray-500 font-mono mt-1">{new Date(exp.date).toDateString()}</p>
                        </div>
                        <div className="flex gap-4 items-center">
                          <span className="text-[10px] bg-[#111] border border-gray-800 text-gray-400 px-3 py-1 rounded uppercase tracking-widest">{exp.category}</span>
                          <span className="text-xl font-mono font-black text-orange-400">₹{Number(exp.amount).toLocaleString()}</span>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                          <button onClick={() => handleExpenseAction(exp.id, 'Approved')} className="flex-1 md:flex-none bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-6 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-black transition-all">Approve</button>
                          <button onClick={() => handleExpenseAction(exp.id, 'Rejected')} className="flex-1 md:flex-none bg-red-500/10 text-red-400 border border-red-500/20 px-6 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- TAB 2: RUN PAYROLL --- */}
          {activeTab === "run_payroll" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
              
              {/* Top Dashboard */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#0a0a0a] border border-gray-800 p-6 rounded-2xl shadow-xl">
                  <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">Total Liability ({monthNames[selectedMonth-1]})</p>
                  <p className="text-4xl font-mono text-white font-black">₹{Math.round(totalPayrollLiability).toLocaleString()}</p>
                </div>
                <div className="md:col-span-2 bg-[#111] border border-cyan-900/30 p-6 rounded-2xl shadow-xl flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-cyan-400 uppercase tracking-widest">Finalize Month</h3>
                    <p className="text-xs text-gray-500 mt-1">Locking payroll generates immutable payslips.</p>
                  </div>
                  <button onClick={lockPayroll} className="bg-cyan-500 text-black px-8 py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.3)] active:scale-95 transition-transform">
                    Lock & Generate
                  </button>
                </div>
              </div>

              {/* The Master Grid (Compact & Scrollbar-Free) */}
              <div className="bg-[#0a0a0a] border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#050505] border-b border-gray-800 text-[9px] lg:text-[10px] font-black uppercase tracking-widest text-gray-500">
                      <th className="p-4 lg:p-5">Employee</th>
                      <th className="p-4 lg:p-5 text-right">Base</th>
                      <th className="p-4 lg:p-5 text-right text-cyan-400">Comm.</th>
                      <th className="p-4 lg:p-5 text-right text-orange-400">Allow.</th>
                      <th className="p-4 lg:p-5 text-right text-red-400">LWP</th>
                      <th className="p-4 lg:p-5 text-right text-emerald-400">Net Payout</th>
                      <th className="p-4 lg:p-5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-900">
                    {payrollData.map(emp => (
                      <tr key={emp.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="p-4 lg:p-5">
                          <p className="font-bold text-white uppercase text-xs lg:text-sm whitespace-nowrap">{emp.full_name}</p>
                          <p className="text-[9px] text-gray-500 font-mono mt-1">{emp.role}</p>
                        </td>
                        <td className="p-4 lg:p-5 text-right font-mono text-xs lg:text-sm text-gray-300">₹{Math.round(emp.payroll.base).toLocaleString()}</td>
                        <td className="p-4 lg:p-5 text-right font-mono text-xs lg:text-sm text-cyan-400">{emp.payroll.commissions > 0 ? `+₹${Math.round(emp.payroll.commissions).toLocaleString()}` : '-'}</td>
                        <td className="p-4 lg:p-5 text-right font-mono text-xs lg:text-sm text-orange-400">{emp.payroll.allowances > 0 ? `+₹${Math.round(emp.payroll.allowances).toLocaleString()}` : '-'}</td>
                        <td className="p-4 lg:p-5 text-right">
                          <p className="font-mono text-xs lg:text-sm text-red-400">{emp.payroll.deductions > 0 ? `-₹${Math.round(emp.payroll.deductions).toLocaleString()}` : '-'}</p>
                          {emp.payroll.unpaidDays > 0 && <p className="text-[8px] lg:text-[9px] text-red-500/70 uppercase mt-1">({emp.payroll.unpaidDays} Days)</p>}
                        </td>
                        <td className="p-4 lg:p-5 text-right">
                          <p className="text-sm lg:text-lg font-mono font-black text-emerald-400">₹{Math.round(emp.payroll.net).toLocaleString()}</p>
                        </td>
                        <td className="p-4 lg:p-5 align-middle">
                          <div className="flex flex-col gap-2 items-center justify-center">
                            {emp.isLocked ? (
                              <>
                                <span className="text-[8px] lg:text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full uppercase tracking-widest font-black">Locked</span>
                                {/* Buttons are now stacked vertically (flex-col) to save horizontal space */}
                                <div className="flex flex-col gap-1.5 w-full mt-1">
                                  <button 
                                    onClick={() => downloadPayslip(emp)}
                                    className="w-full text-[8px] lg:text-[9px] bg-[#111] text-gray-400 border border-gray-700 px-2 py-1.5 rounded uppercase tracking-widest font-black hover:bg-gray-800 hover:text-white transition-colors"
                                  >
                                    Download
                                  </button>
                                  <button 
                                    onClick={() => sendPayslipEmail(emp)}
                                    disabled={isSendingId === emp.id}
                                    className="w-full text-[8px] lg:text-[9px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-1.5 rounded uppercase tracking-widest font-black hover:bg-cyan-500 hover:text-black transition-colors disabled:opacity-50"
                                  >
                                    {isSendingId === emp.id ? "Sending..." : "Email PDF"}
                                  </button>
                                </div>
                              </>
                            ) : (
                              <span className="text-[8px] lg:text-[9px] bg-gray-900 text-gray-400 border border-gray-700 px-3 py-1 rounded-full uppercase tracking-widest font-black">Live Math</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}