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
    <div className="p-6 md:p-8 pt-28 md:pt-8 min-h-screen bg-[#F8F9FA] text-[#111827]">
      
      {/* HEADER & TABS */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Payroll & Finance</h1>
          
          <div className="flex bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-1 mt-6 w-full md:w-auto shadow-sm">
            <button 
              onClick={() => setActiveTab("run_payroll")} 
              className={`flex-1 md:flex-none px-6 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === "run_payroll" ? "bg-white text-[#0EA5E9] border border-[#E5E7EB] shadow-sm" : "text-[#6B7280] hover:text-[#111827]"}`}
            >
              Run Payroll
            </button>
            <button 
              onClick={() => setActiveTab("expenses")} 
              className={`flex-1 md:flex-none px-6 py-2 text-sm font-semibold rounded-md transition-all relative ${activeTab === "expenses" ? "bg-white text-[#0EA5E9] border border-[#E5E7EB] shadow-sm" : "text-[#6B7280] hover:text-[#111827]"}`}
            >
              Expense Claims
              {pendingExpenses.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-[#FEE2E2] text-[#991B1B] text-[10px] w-5 h-5 flex items-center justify-center rounded-full border border-[#FECACA]">{pendingExpenses.length}</span>
              )}
            </button>
          </div>
        </div>

        {activeTab === "run_payroll" && (
          <div className="flex gap-4 items-center w-full md:w-auto">
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none font-semibold">
              {monthNames.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="px-4 py-2 bg-white border border-[#D1D5DB] rounded-md text-[#111827] focus:ring-2 focus:ring-[#0EA5E9]/50 focus:border-[#0EA5E9] outline-none font-semibold">
              {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-32 text-[#6B7280] text-sm font-semibold animate-pulse">Calculating Financials...</div>
      ) : (
        <>
          {/* --- TAB 1: EXPENSE CLAIMS --- */}
          {activeTab === "expenses" && (
            <div className="space-y-8">
              <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm overflow-hidden">
                <div className="p-6 border-b border-[#E5E7EB] bg-[#F9FAFB] flex justify-between items-center">
                  <h3 className="text-base font-semibold text-[#111827]">Pending Reimbursements</h3>
                </div>
                
                {pendingExpenses.length === 0 ? (
                  <div className="text-center py-20"><p className="text-[#6B7280] text-sm">No pending claims.</p></div>
                ) : (
                  <div className="divide-y divide-[#E5E7EB]">
                    {pendingExpenses.map(exp => (
                      <div key={exp.id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-[#F9FAFB] transition-colors">
                        <div>
                          <p className="font-semibold text-[#111827]">{exp.employee_name}</p>
                          <p className="text-xs text-[#6B7280] mt-1">{new Date(exp.date).toDateString()}</p>
                        </div>
                        <div className="flex gap-4 items-center">
                          <span className="text-xs bg-[#F3F4F6] border border-[#E5E7EB] text-[#4B5563] px-2 py-1 rounded-md font-medium">{exp.category}</span>
                          <span className="text-lg font-bold text-[#111827]">₹{Number(exp.amount).toLocaleString()}</span>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                          <button onClick={() => handleExpenseAction(exp.id, 'Approved')} className="flex-1 md:flex-none bg-[#0EA5E9] text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-[#0284C7] transition-colors shadow-sm">Approve</button>
                          <button onClick={() => handleExpenseAction(exp.id, 'Rejected')} className="flex-1 md:flex-none bg-white text-[#EF4444] border border-[#EF4444] px-4 py-2 rounded-md text-sm font-semibold hover:bg-[#FEF2F2] transition-colors">Reject</button>
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
            <div className="space-y-8">
              
              {/* Top Dashboard */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-[#E5E7EB] p-6 rounded-lg shadow-sm">
                  <p className="text-xs text-[#6B7280] font-semibold uppercase tracking-wider mb-2">Total Liability ({monthNames[selectedMonth-1]})</p>
                  <p className="text-3xl font-bold text-[#111827]">₹{Math.round(totalPayrollLiability).toLocaleString()}</p>
                </div>
                <div className="md:col-span-2 bg-white border border-[#E5E7EB] p-6 rounded-lg shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-[#111827]">Finalize Month</h3>
                    <p className="text-sm text-[#6B7280] mt-1">Locking payroll generates immutable payslips.</p>
                  </div>
                  <button onClick={lockPayroll} className="bg-[#0EA5E9] text-white px-6 py-3 rounded-md font-semibold text-sm shadow-sm hover:bg-[#0284C7] transition-colors">
                    Lock & Generate
                  </button>
                </div>
              </div>

              {/* The Master Grid */}
              <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-sm overflow-hidden overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                      <th className="p-4">Employee</th>
                      <th className="p-4 text-right">Base</th>
                      <th className="p-4 text-right">Comm.</th>
                      <th className="p-4 text-right">Allow.</th>
                      <th className="p-4 text-right">LWP</th>
                      <th className="p-4 text-right">Net Payout</th>
                      <th className="p-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {payrollData.map(emp => (
                      <tr key={emp.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="p-4">
                          <p className="font-semibold text-[#111827] text-sm whitespace-nowrap">{emp.full_name}</p>
                          <p className="text-xs text-[#6B7280] mt-1">{emp.role}</p>
                        </td>
                        <td className="p-4 text-right text-sm text-[#4B5563]">₹{Math.round(emp.payroll.base).toLocaleString()}</td>
                        <td className="p-4 text-right text-sm text-[#059669]">{emp.payroll.commissions > 0 ? `+₹${Math.round(emp.payroll.commissions).toLocaleString()}` : '-'}</td>
                        <td className="p-4 text-right text-sm text-[#D97706]">{emp.payroll.allowances > 0 ? `+₹${Math.round(emp.payroll.allowances).toLocaleString()}` : '-'}</td>
                        <td className="p-4 text-right">
                          <p className="text-sm text-[#DC2626]">{emp.payroll.deductions > 0 ? `-₹${Math.round(emp.payroll.deductions).toLocaleString()}` : '-'}</p>
                          {emp.payroll.unpaidDays > 0 && <p className="text-[10px] text-[#EF4444] mt-1">({emp.payroll.unpaidDays} Days)</p>}
                        </td>
                        <td className="p-4 text-right">
                          <p className="text-base font-bold text-[#111827]">₹{Math.round(emp.payroll.net).toLocaleString()}</p>
                        </td>
                        <td className="p-4 align-middle">
                          <div className="flex flex-col gap-2 items-center justify-center">
                            {emp.isLocked ? (
                              <>
                                <span className="text-[10px] bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0] px-2 py-1 rounded-md font-semibold">Locked</span>
                                <div className="flex flex-col gap-2 w-full mt-1">
                                  <button 
                                    onClick={() => downloadPayslip(emp)}
                                    className="w-full text-[10px] bg-white text-[#374151] border border-[#D1D5DB] px-2 py-1.5 rounded-md font-semibold hover:bg-[#F3F4F6] transition-colors shadow-sm"
                                  >
                                    Download
                                  </button>
                                  <button 
                                    onClick={() => sendPayslipEmail(emp)}
                                    disabled={isSendingId === emp.id}
                                    className="w-full text-[10px] bg-[#0EA5E9] text-white px-2 py-1.5 rounded-md font-semibold hover:bg-[#0284C7] transition-colors shadow-sm disabled:opacity-50"
                                  >
                                    {isSendingId === emp.id ? "Sending..." : "Email PDF"}
                                  </button>
                                </div>
                              </>
                            ) : (
                              <span className="text-[10px] bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] px-2 py-1 rounded-md font-semibold">Live Math</span>
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