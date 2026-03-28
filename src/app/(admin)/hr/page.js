"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function HumanResources() {
  const [activeTab, setActiveTab] = useState("registry");
  const [employees, setEmployees] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState("");

  // --- WIZARD & EDIT STATE ---
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const initialFormState = {
    id: null,
    full_name: "",
    phone_number: "",
    personal_email: "",
    dob: "",
    gender: "",
    employee_id: `CQ-${Math.floor(1000 + Math.random() * 9000)}`,
    role: "salesman",
    department: "",
    joining_date: "",
    employment_type: "Full-time",
    reporting_manager: "",
    work_location: "",
    commission_rate: 0,
    incentive_structure: "",
    shift_timing: "",
    primary_responsibility: "",
    base_salary: 0,
    payment_cycle: "Monthly",
    bank_account_no: "",
    bank_ifsc: "",
    upi_id: "",
    work_email: "",
    password: "",
    status: "Active"
  };

  const [formData, setFormData] = useState(initialFormState);

  // --- CALENDAR & LEAVE STATE ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState({ start: null, end: null });
  const [leavesOnSelectedDate, setLeavesOnSelectedDate] = useState([]);
  const [leaveData, setLeaveData] = useState({ 
    employee_id: "", 
    start_date: "", 
    end_date: "", 
    leave_type: "Paid Leave" 
  });
  const [dateRangeMode, setDateRangeMode] = useState(false);

  useEffect(() => {
    fetchHRData();
  }, []);

  const fetchHRData = async () => {
    setIsLoading(true);
    setError(null);
    setDebugInfo("Fetching data...");
    try {
      console.log("🔍 Starting fetch...");
      
      const [empRes, leaveRes] = await Promise.all([
        supabase.from("employees").select("*").order("created_at", { ascending: false }),
        supabase.from("leave_requests").select("*")
      ]);
      
      console.log("📊 Employee Response:", empRes);
      console.log("📅 Leave Response:", leaveRes);

      if (empRes.error) {
        console.error("❌ Employee Error:", empRes.error);
        throw empRes.error;
      }
      if (leaveRes.error) {
        console.error("❌ Leave Error:", leaveRes.error);
        throw leaveRes.error;
      }

      const empData = empRes.data || [];
      const leaveDataRes = leaveRes.data || [];

      console.log(`✅ Fetched ${empData.length} employees`);
      console.log(`✅ Fetched ${leaveDataRes.length} leave records`);

      setDebugInfo(`Loaded ${empData.length} employees`);
      setEmployees(empData);
      setLeaves(leaveDataRes);
    } catch (err) {
      console.error("❌ HR Data Error:", err);
      setError(err.message);
      setDebugInfo(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ FIX: Filter by LOWERCASE roles
  const admins = (employees || []).filter(e => e.role === "admin");
  const salesmen = (employees || []).filter(e => e.role === "salesman");
  const warehouse = (employees || []).filter(e => e.role === "warehouse");

  console.log("📈 Employee Breakdown:", { 
    total: employees.length, 
    admins: admins.length, 
    salesmen: salesmen.length, 
    warehouse: warehouse.length 
  });

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
        const { error: dbError } = await supabase.from("employees").update({
          full_name: formData.full_name,
          phone_number: formData.phone_number,
          personal_email: formData.personal_email,
          dob: formData.dob || null,
          gender: formData.gender,
          role: formData.role,
          department: formData.department,
          joining_date: formData.joining_date || null,
          employment_type: formData.employment_type,
          reporting_manager: formData.reporting_manager,
          work_location: formData.work_location,
          base_salary: formData.base_salary,
          payment_cycle: formData.payment_cycle,
          bank_account_no: formData.bank_account_no,
          bank_ifsc: formData.bank_ifsc,
          upi_id: formData.upi_id,
          commission_rate: formData.commission_rate,
          incentive_structure: formData.incentive_structure,
          shift_timing: formData.shift_timing,
          primary_responsibility: formData.primary_responsibility,
          work_email: formData.work_email,
          status: formData.status
        }).eq('id', formData.id);

        if (dbError) throw dbError;
        alert(`✅ ${formData.full_name}'s profile updated successfully!`);
      } else {
        if (formData.password.length < 6) throw new Error("Password must be at least 6 characters.");

        const { error: authError } = await supabase.auth.signUp({
          email: formData.work_email,
          password: formData.password,
        });
        if (authError) throw authError;

        const { error: dbError } = await supabase.from("employees").insert([{
          full_name: formData.full_name,
          phone_number: formData.phone_number,
          personal_email: formData.personal_email,
          dob: formData.dob || null,
          gender: formData.gender,
          employee_id: formData.employee_id,
          role: formData.role,
          department: formData.department,
          joining_date: formData.joining_date || null,
          employment_type: formData.employment_type,
          reporting_manager: formData.reporting_manager,
          work_location: formData.work_location,
          base_salary: formData.base_salary,
          payment_cycle: formData.payment_cycle,
          bank_account_no: formData.bank_account_no,
          bank_ifsc: formData.bank_ifsc,
          upi_id: formData.upi_id,
          commission_rate: formData.commission_rate,
          incentive_structure: formData.incentive_structure,
          shift_timing: formData.shift_timing,
          primary_responsibility: formData.primary_responsibility,
          work_email: formData.work_email,
          status: formData.status
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
    try {
      await supabase.from("employees").delete().eq("id", id);
      fetchHRData();
      alert(`✅ ${name} has been terminated.`);
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  // ==========================================
  // 2. CALENDAR & LEAVE LOGIC
  // ==========================================

  // Handle date click in calendar
  const handleDateClick = (day) => {
    const clickedDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    if (dateRangeMode && selectedDateRange.start && !selectedDateRange.end) {
      // Complete the range
      if (clickedDate < selectedDateRange.start) {
        setSelectedDateRange({ start: clickedDate, end: selectedDateRange.start });
      } else {
        setSelectedDateRange({ start: selectedDateRange.start, end: clickedDate });
      }
      setDateRangeMode(false);
    } else {
      // Start new range
      setSelectedDateRange({ start: clickedDate, end: null });
      setDateRangeMode(true);
    }

    // Get leaves on this date
    const leavesOnDate = leaves.filter(l => clickedDate >= l.start_date && clickedDate <= l.end_date);
    setLeavesOnSelectedDate(leavesOnDate);
    
    // Pre-fill leave form
    setLeaveData({
      employee_id: "",
      start_date: clickedDate,
      end_date: selectedDateRange.end || clickedDate,
      leave_type: "Paid Leave"
    });
    
    setIsLeaveModalOpen(true);
  };

  // Calculate days between two dates
  const calculateDaysBetween = (start, end) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

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
      
      alert(`Leave logged for ${emp.full_name} (${calculateDaysBetween(leaveData.start_date, leaveData.end_date)} days)`);
      setIsLeaveModalOpen(false);
      setLeaveData({ employee_id: "", start_date: "", end_date: "", leave_type: "Paid Leave" });
      setSelectedDateRange({ start: null, end: null });
      fetchHRData();
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  // ✅ UPDATED: handleCancelLeave with profit reversal
  const handleCancelLeave = async (leaveId, leave) => {
    if (!window.confirm(`Cancel leave for ${leave.employee_name} (${leave.start_date} to ${leave.end_date})?`)) return;
    
    try {
      const emp = employees.find(e => e.id === leave.employee_id);
      const daysOnLeave = calculateDaysBetween(leave.start_date, leave.end_date);
      
      // Calculate daily salary for reversal
      const dailySalary = emp.base_salary / 30; // Assuming 30 working days per month
      const deductedAmount = dailySalary * daysOnLeave;
      
      // Step 1: Delete the leave record
      const { error: deleteError } = await supabase
        .from("leave_requests")
        .delete()
        .eq("id", leaveId);
      
      if (deleteError) throw deleteError;

      // Step 2: Create reversal transaction in profit_engine
      const { error: transactionError } = await supabase
        .from("profit_engine")
        .insert([{
          employee_id: emp.id,
          employee_name: emp.full_name,
          transaction_type: "LEAVE_REVERSAL",
          amount: deductedAmount,
          date: new Date().toISOString().split('T')[0],
          description: `Leave cancelled: ${leave.leave_type} (${daysOnLeave} days)`,
          leave_id: leaveId,
          status: "Completed"
        }]);

      if (transactionError) {
        console.warn("⚠️ Profit engine table not found, skipping reversal entry");
      }

      console.log(`✅ Leave cancelled for ${emp.full_name}`);
      console.log(`💰 Reversing ₹${deductedAmount.toFixed(2)} deduction`);
      
      fetchHRData();
      alert(`✅ Leave cancelled\n💰 ₹${deductedAmount.toFixed(2)} reversed to profit engine`);
      
      // Refresh leaves on selected date
      if (selectedDateRange.start) {
        const leavesOnDate = leaves.filter(l => selectedDateRange.start >= l.start_date && selectedDateRange.start <= l.end_date);
        setLeavesOnSelectedDate(leavesOnDate);
      }
    } catch (err) {
      console.error("Error cancelling leave:", err);
      alert("Error: " + err.message);
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

  // Check if date has leaves and return info
  const getDateLeaveInfo = (day) => {
    const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayLeaves = leaves.filter(l => cellDateStr >= l.start_date && cellDateStr <= l.end_date);
    return { hasLeaves: dayLeaves.length > 0, count: dayLeaves.length, leaves: dayLeaves };
  };

  // Check for conflicts
  const hasConflict = (day) => {
    const { count } = getDateLeaveInfo(day);
    return count >= employees.length * 0.3; // 30% threshold
  };

  const renderCalendarDays = () => {
    const blanks = Array.from({ length: firstDay }, (_, i) => (
      <div key={`blank-${i}`} style={{ 
        padding: "0.75rem", 
        borderBottom: "1px solid rgba(161, 250, 255, 0.1)", 
        minHeight: "100px",
        background: "transparent"
      }} />
    ));
    
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = cellDateStr === new Date().toISOString().split('T')[0];
      const dayLeaves = leaves.filter(l => cellDateStr >= l.start_date && cellDateStr <= l.end_date);
      const isInRange = selectedDateRange.start && selectedDateRange.end && 
        cellDateStr >= selectedDateRange.start && cellDateStr <= selectedDateRange.end;
      const isRangeStart = selectedDateRange.start === cellDateStr;
      const conflict = hasConflict(day);

      return (
        <div
          key={day}
          onClick={() => handleDateClick(day)}
          style={{
            padding: "0.75rem",
            borderBottom: "1px solid rgba(161, 250, 255, 0.1)",
            minHeight: "100px",
            background: isToday ? "rgba(161, 250, 255, 0.08)" : isInRange ? "rgba(34, 197, 94, 0.1)" : "transparent",
            borderLeft: isToday ? "3px solid rgba(161, 250, 255, 0.3)" : isRangeStart ? "3px solid rgba(34, 197, 94, 0.5)" : "none",
            cursor: "pointer",
            transition: "all 0.2s ease",
            position: "relative",
            overflow: "hidden"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = conflict ? "rgba(255, 113, 108, 0.15)" : "rgba(161, 250, 255, 0.05)";
          }}
          onMouseLeave={(e) => {
            if (isToday) e.currentTarget.style.background = "rgba(161, 250, 255, 0.08)";
            else if (isInRange) e.currentTarget.style.background = "rgba(34, 197, 94, 0.1)";
            else e.currentTarget.style.background = "transparent";
          }}
          title={dayLeaves.map(l => `${l.employee_name} (${l.leave_type})`).join("\n")}
        >
          <p style={{ 
            fontSize: "0.875rem", 
            fontWeight: 700, 
            color: isToday ? "#a1faff" : conflict ? "#ff716c" : "#aaabad", 
            margin: "0 0 0.5rem 0" 
          }}>
            {day}
          </p>

          {/* Leave indicators */}
          <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
            {dayLeaves.slice(0, 3).map((leave, idx) => (
              <div
                key={idx}
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: leave.leave_type === "Sick Leave" ? "#f97316" : leave.leave_type === "Unpaid Leave" ? "#ef4444" : "#34d399",
                  opacity: 0.8
                }}
                title={leave.employee_name}
              />
            ))}
            {dayLeaves.length > 3 && (
              <span style={{ fontSize: "0.65rem", color: "#aaabad" }}>+{dayLeaves.length - 3}</span>
            )}
          </div>

          {/* Conflict warning */}
          {conflict && (
            <div style={{
              fontSize: "0.65rem",
              color: "#ff716c",
              fontWeight: 700,
              textTransform: "uppercase",
              background: "rgba(255, 113, 108, 0.1)",
              padding: "0.25rem",
              borderRadius: "0.2rem"
            }}>
              ⚠️ {dayLeaves.length} leaves
            </div>
          )}

          {/* Employee names tooltip */}
          {dayLeaves.length > 0 && (
            <div style={{
              fontSize: "0.6rem",
              color: "#a1faff",
              marginTop: "0.5rem",
              maxHeight: "60px",
              overflow: "hidden",
              opacity: 0.8
            }}>
              {dayLeaves.slice(0, 2).map((l, i) => (
                <div key={i}>{l.employee_name.split(' ')[0]}</div>
              ))}
            </div>
          )}
        </div>
      );
    });
    return [...blanks, ...days];
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
        
        .font-headline { font-family: 'Space Grotesk', sans-serif; }
        
        .glass-card {
          background: rgba(23, 26, 28, 0.5);
          backdrop-filter: blur(32px);
          -webkit-backdrop-filter: blur(32px);
          border: 1px solid rgba(161, 250, 255, 0.1);
        }
        
        .glass-card:hover {
          border-color: rgba(161, 250, 255, 0.2);
          background: rgba(23, 26, 28, 0.6);
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInFromRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .animate-fade-in {
          animation: fadeInUp 0.5s ease-out;
        }

        .animate-slide-in {
          animation: slideInFromRight 0.4s ease-out;
        }

        @media (max-width: 768px) {
          .employee-grid {
            grid-template-columns: 1fr !important;
          }
          .admin-list {
            grid-template-columns: 1fr !important;
          }
          .header-container {
            flex-direction: column !important;
          }
        }
      `}</style>

      <main style={{
        background: "#0c0e10",
        color: "#eeeef0",
        minHeight: "100vh",
        padding: "1rem"
      }}>
        
        {/* HEADER */}
        <div style={{ marginBottom: "2rem" }}>
          <h1 className="font-headline" style={{
            fontSize: "clamp(1.75rem, 5vw, 2.75rem)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "#a1faff",
            margin: 0,
            marginBottom: "0.75rem"
          }}>
            HUMAN RESOURCES
          </h1>
          <p style={{ 
            fontSize: "clamp(0.8rem, 2vw, 0.95rem)", 
            color: "#aaabad", 
            margin: 0,
            fontWeight: 300
          }}>
            Workforce management, onboarding & leave calendar
          </p>
          <p style={{ 
            fontSize: "0.75rem", 
            color: "#06b6d4", 
            margin: "0.75rem 0 0 0",
            fontFamily: "monospace"
          }}>
            🔍 {debugInfo}
          </p>
        </div>

        {/* TABS & CONTROLS */}
        <div style={{ 
          display: "flex", 
          gap: "1.5rem", 
          marginBottom: "2rem", 
          flexWrap: "wrap", 
          alignItems: "center",
          justifyContent: "space-between"
        }} className="header-container">
          <div className="glass-card" style={{ 
            display: "flex", 
            gap: "0.5rem", 
            padding: "0.5rem", 
            borderRadius: "0.75rem" 
          }}>
            <button
              onClick={() => setActiveTab("registry")}
              style={{
                padding: "0.75rem 1.5rem",
                fontSize: "0.75rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                border: activeTab === "registry" ? "1px solid #06b6d4" : "1px solid transparent",
                background: activeTab === "registry" ? "rgba(6, 182, 212, 0.1)" : "transparent",
                color: activeTab === "registry" ? "#06b6d4" : "#aaabad",
                borderRadius: "0.5rem",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => { 
                if (activeTab !== "registry") {
                  e.currentTarget.style.color = "#a1faff";
                }
              }}
              onMouseLeave={(e) => { 
                if (activeTab !== "registry") {
                  e.currentTarget.style.color = "#aaabad";
                }
              }}
            >
              Master Registry
            </button>
            <button
              onClick={() => setActiveTab("calendar")}
              style={{
                padding: "0.75rem 1.5rem",
                fontSize: "0.75rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                border: activeTab === "calendar" ? "1px solid #10b981" : "1px solid transparent",
                background: activeTab === "calendar" ? "rgba(16, 185, 129, 0.1)" : "transparent",
                color: activeTab === "calendar" ? "#10b981" : "#aaabad",
                borderRadius: "0.5rem",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => { 
                if (activeTab !== "calendar") {
                  e.currentTarget.style.color = "#a1faff";
                }
              }}
              onMouseLeave={(e) => { 
                if (activeTab !== "calendar") {
                  e.currentTarget.style.color = "#aaabad";
                }
              }}
            >
              Leave Calendar
            </button>
          </div>

          {/* STATS & BUTTON */}
          <div style={{
            display: "flex",
            gap: "clamp(1.5rem, 3vw, 2.5rem)",
            alignItems: "center",
            flexWrap: "wrap"
          }}>
            <div style={{ display: "flex", gap: "2rem" }}>
              <div>
                <p style={{ 
                  fontSize: "clamp(1.5rem, 3vw, 2rem)", 
                  fontFamily: "'Space Grotesk', monospace", 
                  fontWeight: 700, 
                  color: "#a1faff", 
                  margin: 0 
                }}>
                  {employees.length}
                </p>
                <p style={{ fontSize: "0.7rem", color: "#aaabad", margin: "0.25rem 0 0 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Total Staff
                </p>
              </div>
              <div style={{ width: "1px", background: "rgba(161, 250, 255, 0.1)" }} />
              <div>
                <p style={{ 
                  fontSize: "clamp(1rem, 2.5vw, 1.5rem)", 
                  fontFamily: "'Space Grotesk', monospace", 
                  fontWeight: 700, 
                  color: "#06b6d4", 
                  margin: 0 
                }}>
                  {admins.length + salesmen.length + warehouse.length}
                </p>
                <p style={{ fontSize: "0.7rem", color: "#aaabad", margin: "0.25rem 0 0 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Active
                </p>
              </div>
            </div>

            <button
              onClick={() => { setIsEditing(false); setFormData(initialFormState); setIsWizardOpen(true); }}
              style={{
                background: "transparent",
                border: "1px solid #06b6d4",
                color: "#06b6d4",
                padding: "clamp(0.6rem, 1.5vw, 0.9rem) clamp(1rem, 2vw, 1.5rem)",
                fontSize: "clamp(0.7rem, 1.5vw, 0.85rem)",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                borderRadius: "0.5rem",
                cursor: "pointer",
                transition: "all 0.2s ease",
                whiteSpace: "nowrap"
              }}
              onMouseEnter={(e) => { 
                e.currentTarget.style.background = "#06b6d4"; 
                e.currentTarget.style.color = "#0c0e10";
                e.currentTarget.style.boxShadow = "0 0 20px rgba(6, 182, 212, 0.3)";
              }}
              onMouseLeave={(e) => { 
                e.currentTarget.style.background = "transparent"; 
                e.currentTarget.style.color = "#06b6d4";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              + Onboard
            </button>
          </div>
        </div>

        {/* ERROR STATE */}
        {error && (
          <div style={{
            background: "rgba(255, 113, 108, 0.1)",
            border: "1px solid rgba(255, 113, 108, 0.3)",
            borderRadius: "0.75rem",
            padding: "1rem 1.5rem",
            marginBottom: "1.5rem",
            color: "#ff716c",
            animation: "fadeInUp 0.3s ease-out"
          }}>
            <p style={{ fontSize: "0.875rem", margin: 0, fontWeight: 600 }}>
              ⚠️ Error: {error}
            </p>
            <button 
              onClick={() => fetchHRData()} 
              style={{
                marginTop: "0.75rem",
                background: "#ff716c",
                color: "white",
                border: "none",
                padding: "0.5rem 1rem",
                borderRadius: "0.4rem",
                fontSize: "0.75rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
              onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
            >
              Retry
            </button>
          </div>
        )}

        {/* LOADING STATE */}
        {isLoading && (
          <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#a1faff" }}>
            <div style={{
              display: "inline-block",
              width: "2.5rem",
              height: "2.5rem",
              borderRadius: "50%",
              border: "3px solid rgba(161, 250, 255, 0.15)",
              borderTopColor: "#a1faff",
              borderRightColor: "#06b6d4",
              animation: "spin 0.8s linear infinite",
              marginBottom: "1.5rem"
            }} />
            <p style={{ 
              fontSize: "0.8rem", 
              fontWeight: 700, 
              textTransform: "uppercase", 
              letterSpacing: "0.12em",
              margin: 0,
              color: "#aaabad"
            }}>
              Syncing Workforce Data...
            </p>
          </div>
        )}

        {/* REGISTRY TAB */}
        {activeTab === "registry" && !isLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }} className="animate-fade-in">
            {employees.length === 0 ? (
              <div className="glass-card" style={{
                textAlign: "center",
                padding: "3rem 1.5rem",
                borderRadius: "1rem",
                border: "2px dashed rgba(161, 250, 255, 0.2)",
                background: "rgba(6, 182, 212, 0.05)"
              }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>📭</div>
                <p style={{ fontSize: "1rem", color: "white", margin: 0, fontWeight: 600, marginBottom: "0.5rem" }}>
                  No employees recorded yet
                </p>
                <p style={{ fontSize: "0.8rem", color: "#a1faff", margin: 0 }}>
                  Click "+ Onboard" to add your first team member
                </p>
              </div>
            ) : (
              <>
                {/* ADMINS */}
                {admins.length > 0 && (
                  <div className="glass-card animate-slide-in" style={{ borderRadius: "1rem", overflow: "hidden" }}>
                    <div style={{
                      padding: "1.25rem",
                      background: "rgba(6, 182, 212, 0.1)",
                      borderBottom: "1px solid rgba(6, 182, 212, 0.2)",
                      fontWeight: 700,
                      color: "#06b6d4",
                      fontSize: "clamp(0.9rem, 2vw, 1rem)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em"
                    }}>
                      👥 System Administrators ({admins.length})
                    </div>
                    <div className="admin-list" style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                      gap: "1.25rem",
                      padding: "1.25rem"
                    }}>
                      {admins.map((emp, idx) => (
                        <div 
                          key={emp.id} 
                          style={{
                            background: "rgba(23, 26, 28, 0.5)",
                            border: "1px solid rgba(6, 182, 212, 0.2)",
                            borderRadius: "0.75rem",
                            padding: "1.25rem",
                            transition: "all 0.2s ease",
                            animation: `fadeInUp 0.5s ease-out ${idx * 0.1}s both`
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "rgba(6, 182, 212, 0.4)";
                            e.currentTarget.style.background = "rgba(23, 26, 28, 0.7)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "rgba(6, 182, 212, 0.2)";
                            e.currentTarget.style.background = "rgba(23, 26, 28, 0.5)";
                          }}
                        >
                          <div style={{ marginBottom: "0.75rem" }}>
                            <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "white", margin: 0, marginBottom: "0.25rem" }}>
                              {emp.full_name}
                            </p>
                            <p style={{ fontSize: "0.75rem", color: "#aaabad", margin: 0, fontFamily: "monospace", letterSpacing: "0.05em" }}>
                              {emp.employee_id}
                            </p>
                          </div>
                          
                          <p style={{ fontSize: "0.8rem", color: "#06b6d4", margin: "0.75rem 0", fontFamily: "monospace" }}>
                            {emp.work_email}
                          </p>

                          {emp.reporting_manager && (
                            <p style={{ fontSize: "0.75rem", color: "#aaabad", margin: "0.5rem 0" }}>
                              👔 Manager: {emp.reporting_manager}
                            </p>
                          )}

                          {emp.department && (
                            <p style={{ fontSize: "0.75rem", color: "#aaabad", margin: "0.5rem 0" }}>
                              📁 {emp.department}
                            </p>
                          )}

                          <div style={{
                            display: "flex",
                            gap: "0.75rem",
                            marginTop: "1rem",
                            paddingTop: "1rem",
                            borderTop: "1px solid rgba(161, 250, 255, 0.1)"
                          }}>
                            <button 
                              onClick={() => handleEditClick(emp)} 
                              style={{
                                flex: 1,
                                padding: "0.65rem",
                                background: "rgba(6, 182, 212, 0.1)",
                                border: "1px solid rgba(6, 182, 212, 0.3)",
                                color: "#06b6d4",
                                borderRadius: "0.5rem",
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                letterSpacing: "0.05em"
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#06b6d4";
                                e.currentTarget.style.color = "#0c0e10";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgba(6, 182, 212, 0.1)";
                                e.currentTarget.style.color = "#06b6d4";
                              }}
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => handleTerminate(emp.id, emp.full_name)} 
                              style={{
                                flex: 1,
                                padding: "0.65rem",
                                background: "rgba(239, 68, 68, 0.1)",
                                border: "1px solid rgba(239, 68, 68, 0.3)",
                                color: "#ef4444",
                                borderRadius: "0.5rem",
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                letterSpacing: "0.05em"
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#ef4444";
                                e.currentTarget.style.color = "white";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                                e.currentTarget.style.color = "#ef4444";
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SALESMEN */}
                {salesmen.length > 0 && (
                  <div className="glass-card animate-slide-in" style={{ borderRadius: "1rem", overflow: "hidden", animationDelay: "0.1s" }}>
                    <div style={{
                      padding: "1.25rem",
                      background: "rgba(34, 197, 94, 0.1)",
                      borderBottom: "1px solid rgba(34, 197, 94, 0.2)",
                      fontWeight: 700,
                      color: "#22c55e",
                      fontSize: "clamp(0.9rem, 2vw, 1rem)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em"
                    }}>
                      🚀 Sales Force ({salesmen.length})
                    </div>
                    <div className="employee-grid" style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                      gap: "1.25rem",
                      padding: "1.25rem"
                    }}>
                      {salesmen.map((emp, idx) => (
                        <div 
                          key={emp.id} 
                          style={{
                            background: "rgba(23, 26, 28, 0.5)",
                            border: "1px solid rgba(34, 197, 94, 0.2)",
                            borderRadius: "0.75rem",
                            padding: "1.25rem",
                            transition: "all 0.2s ease",
                            animation: `fadeInUp 0.5s ease-out ${idx * 0.1}s both`
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "rgba(34, 197, 94, 0.4)";
                            e.currentTarget.style.background = "rgba(23, 26, 28, 0.7)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "rgba(34, 197, 94, 0.2)";
                            e.currentTarget.style.background = "rgba(23, 26, 28, 0.5)";
                          }}
                        >
                          <div style={{ marginBottom: "0.75rem" }}>
                            <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "white", margin: 0, marginBottom: "0.25rem" }}>
                              {emp.full_name}
                            </p>
                            <p style={{ fontSize: "0.75rem", color: "#aaabad", margin: 0, fontFamily: "monospace", letterSpacing: "0.05em" }}>
                              {emp.employee_id}
                            </p>
                          </div>
                          
                          <div style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "0.75rem",
                            marginBottom: "1rem",
                            paddingBottom: "1rem",
                            borderBottom: "1px solid rgba(161, 250, 255, 0.1)"
                          }}>
                            <div>
                              <p style={{ fontSize: "0.65rem", color: "#aaabad", textTransform: "uppercase", fontWeight: 700, margin: 0, marginBottom: "0.25rem", letterSpacing: "0.05em" }}>
                                Territory
                              </p>
                              <p style={{ fontSize: "0.9rem", color: "#22c55e", fontWeight: 700, margin: 0 }}>
                                {emp.work_location || 'Field'}
                              </p>
                            </div>
                            <div>
                              <p style={{ fontSize: "0.65rem", color: "#aaabad", textTransform: "uppercase", fontWeight: 700, margin: 0, marginBottom: "0.25rem", letterSpacing: "0.05em" }}>
                                Commission
                              </p>
                              <p style={{ fontSize: "0.9rem", color: "#a1faff", fontFamily: "monospace", fontWeight: 700, margin: 0 }}>
                                {emp.commission_rate || 0}%
                              </p>
                            </div>
                          </div>

                          {emp.reporting_manager && (
                            <p style={{ fontSize: "0.75rem", color: "#aaabad", margin: "0.5rem 0" }}>
                              👔 {emp.reporting_manager}
                            </p>
                          )}

                          <div style={{ display: "flex", gap: "0.75rem" }}>
                            <button 
                              onClick={() => handleEditClick(emp)} 
                              style={{
                                flex: 1,
                                padding: "0.65rem",
                                background: "rgba(34, 197, 94, 0.1)",
                                border: "1px solid rgba(34, 197, 94, 0.3)",
                                color: "#22c55e",
                                borderRadius: "0.5rem",
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                letterSpacing: "0.05em"
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#22c55e";
                                e.currentTarget.style.color = "#0c0e10";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgba(34, 197, 94, 0.1)";
                                e.currentTarget.style.color = "#22c55e";
                              }}
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => handleTerminate(emp.id, emp.full_name)} 
                              style={{
                                flex: 1,
                                padding: "0.65rem",
                                background: "rgba(239, 68, 68, 0.1)",
                                border: "1px solid rgba(239, 68, 68, 0.3)",
                                color: "#ef4444",
                                borderRadius: "0.5rem",
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                letterSpacing: "0.05em"
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#ef4444";
                                e.currentTarget.style.color = "white";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                                e.currentTarget.style.color = "#ef4444";
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* WAREHOUSE */}
                {warehouse.length > 0 && (
                  <div className="glass-card animate-slide-in" style={{ borderRadius: "1rem", overflow: "hidden", animationDelay: "0.2s" }}>
                    <div style={{
                      padding: "1.25rem",
                      background: "rgba(249, 115, 22, 0.1)",
                      borderBottom: "1px solid rgba(249, 115, 22, 0.2)",
                      fontWeight: 700,
                      color: "#f97316",
                      fontSize: "clamp(0.9rem, 2vw, 1rem)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em"
                    }}>
                      📦 Warehouse & Logistics ({warehouse.length})
                    </div>
                    <div className="employee-grid" style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                      gap: "1.25rem",
                      padding: "1.25rem"
                    }}>
                      {warehouse.map((emp, idx) => (
                        <div 
                          key={emp.id} 
                          style={{
                            background: "rgba(23, 26, 28, 0.5)",
                            border: "1px solid rgba(249, 115, 22, 0.2)",
                            borderRadius: "0.75rem",
                            padding: "1.25rem",
                            transition: "all 0.2s ease",
                            animation: `fadeInUp 0.5s ease-out ${idx * 0.1}s both`
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "rgba(249, 115, 22, 0.4)";
                            e.currentTarget.style.background = "rgba(23, 26, 28, 0.7)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "rgba(249, 115, 22, 0.2)";
                            e.currentTarget.style.background = "rgba(23, 26, 28, 0.5)";
                          }}
                        >
                          <div style={{ marginBottom: "0.75rem" }}>
                            <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "white", margin: 0, marginBottom: "0.25rem" }}>
                              {emp.full_name}
                            </p>
                            <p style={{ fontSize: "0.75rem", color: "#aaabad", margin: 0, fontFamily: "monospace", letterSpacing: "0.05em" }}>
                              {emp.employee_id}
                            </p>
                          </div>

                          <div style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "0.75rem",
                            marginBottom: "1rem",
                            paddingBottom: "1rem",
                            borderBottom: "1px solid rgba(161, 250, 255, 0.1)"
                          }}>
                            <div>
                              <p style={{ fontSize: "0.65rem", color: "#aaabad", textTransform: "uppercase", fontWeight: 700, margin: 0, marginBottom: "0.25rem", letterSpacing: "0.05em" }}>
                                Duty
                              </p>
                              <p style={{ fontSize: "0.9rem", color: "#f97316", fontWeight: 700, margin: 0 }}>
                                {emp.primary_responsibility || 'General'}
                              </p>
                            </div>
                            <div>
                              <p style={{ fontSize: "0.65rem", color: "#aaabad", textTransform: "uppercase", fontWeight: 700, margin: 0, marginBottom: "0.25rem", letterSpacing: "0.05em" }}>
                                Shift
                              </p>
                              <p style={{ fontSize: "0.9rem", color: "#a1faff", fontFamily: "monospace", fontWeight: 700, margin: 0 }}>
                                {emp.shift_timing || 'Standard'}
                              </p>
                            </div>
                          </div>

                          {emp.reporting_manager && (
                            <p style={{ fontSize: "0.75rem", color: "#aaabad", margin: "0.5rem 0" }}>
                              👔 {emp.reporting_manager}
                            </p>
                          )}

                          <div style={{ display: "flex", gap: "0.75rem" }}>
                            <button 
                              onClick={() => handleEditClick(emp)} 
                              style={{
                                flex: 1,
                                padding: "0.65rem",
                                background: "rgba(249, 115, 22, 0.1)",
                                border: "1px solid rgba(249, 115, 22, 0.3)",
                                color: "#f97316",
                                borderRadius: "0.5rem",
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                letterSpacing: "0.05em"
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#f97316";
                                e.currentTarget.style.color = "#0c0e10";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgba(249, 115, 22, 0.1)";
                                e.currentTarget.style.color = "#f97316";
                              }}
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => handleTerminate(emp.id, emp.full_name)} 
                              style={{
                                flex: 1,
                                padding: "0.65rem",
                                background: "rgba(239, 68, 68, 0.1)",
                                border: "1px solid rgba(239, 68, 68, 0.3)",
                                color: "#ef4444",
                                borderRadius: "0.5rem",
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                letterSpacing: "0.05em"
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#ef4444";
                                e.currentTarget.style.color = "white";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                                e.currentTarget.style.color = "#ef4444";
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* CALENDAR TAB */}
        {activeTab === "calendar" && !isLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }} className="animate-fade-in">
            <button 
              onClick={() => {
                setLeaveData({ employee_id: "", start_date: "", end_date: "", leave_type: "Paid Leave" });
                setSelectedDateRange({ start: null, end: null });
                setLeavesOnSelectedDate([]);
                setIsLeaveModalOpen(true);
              }}
              style={{
                alignSelf: "flex-start",
                background: "transparent",
                border: "1px solid #f97316",
                color: "#f97316",
                padding: "0.75rem 1.5rem",
                fontSize: "0.75rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                borderRadius: "0.5rem",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f97316";
                e.currentTarget.style.color = "#0c0e10";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#f97316";
              }}
            >
              + Log Leave
            </button>

            <div className="glass-card" style={{ borderRadius: "1rem", overflow: "hidden" }}>
              {/* Month Navigation */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "1rem",
                background: "rgba(23, 26, 28, 0.8)",
                borderBottom: "1px solid rgba(161, 250, 255, 0.1)"
              }}>
                <button 
                  onClick={prevMonth}
                  style={{
                    background: "rgba(6, 182, 212, 0.1)",
                    border: "1px solid rgba(6, 182, 212, 0.3)",
                    color: "#06b6d4",
                    padding: "0.5rem 1rem",
                    borderRadius: "0.4rem",
                    cursor: "pointer",
                    fontWeight: 700,
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#06b6d4"; e.currentTarget.style.color = "#0c0e10"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(6, 182, 212, 0.1)"; e.currentTarget.style.color = "#06b6d4"; }}
                >
                  ◀ Previous
                </button>
                <span style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "white",
                  minWidth: "200px",
                  textAlign: "center",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em"
                }}>
                  {monthNames[month]} {year}
                </span>
                <button 
                  onClick={nextMonth}
                  style={{
                    background: "rgba(6, 182, 212, 0.1)",
                    border: "1px solid rgba(6, 182, 212, 0.3)",
                    color: "#06b6d4",
                    padding: "0.5rem 1rem",
                    borderRadius: "0.4rem",
                    cursor: "pointer",
                    fontWeight: 700,
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#06b6d4"; e.currentTarget.style.color = "#0c0e10"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(6, 182, 212, 0.1)"; e.currentTarget.style.color = "#06b6d4"; }}
                >
                  Next ▶
                </button>
              </div>

              {/* Day Headers */}
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(7, 1fr)", 
                background: "rgba(23, 26, 28, 0.8)", 
                borderBottom: "1px solid rgba(161, 250, 255, 0.1)" 
              }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div 
                    key={day} 
                    style={{ 
                      padding: "0.75rem", 
                      textAlign: "center", 
                      fontSize: "0.7rem", 
                      fontWeight: 700, 
                      textTransform: "uppercase", 
                      color: "#aaabad",
                      letterSpacing: "0.05em"
                    }}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                {renderCalendarDays()}
              </div>
            </div>

            {/* Legend */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem"
            }}>
              <div style={{ fontSize: "0.75rem", color: "#aaabad" }}>
                <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#34d399", marginRight: "0.5rem" }} />
                Paid Leave
              </div>
              <div style={{ fontSize: "0.75rem", color: "#aaabad" }}>
                <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#f97316", marginRight: "0.5rem" }} />
                Sick Leave
              </div>
              <div style={{ fontSize: "0.75rem", color: "#aaabad" }}>
                <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444", marginRight: "0.5rem" }} />
                Unpaid Leave
              </div>
              <div style={{ fontSize: "0.75rem", color: "#aaabad" }}>
                <div style={{ background: "rgba(255, 113, 108, 0.15)", padding: "0.25rem", borderRadius: "0.2rem" }}>
                  ⚠️ Conflict Detection
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LEAVE MODAL - Enhanced with existing leaves display */}
        {isLeaveModalOpen && (
          <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.95)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
            padding: "1rem",
            overflow: "auto",
            backdropFilter: "blur(4px)"
          }}>
            <div className="glass-card" style={{
              borderRadius: "1rem",
              padding: "2.5rem",
              maxWidth: "700px",
              width: "100%",
              position: "relative",
              animation: "fadeInUp 0.3s ease-out"
            }}>
              <button
                onClick={() => setIsLeaveModalOpen(false)}
                style={{
                  position: "fixed",
                  top: "2rem",
                  right: "1rem",
                  background: "rgba(239, 68, 68, 0.2)",
                  border: "1px solid rgba(239, 68, 68, 0.5)",
                  fontSize: "2.5rem",
                  color: "#ef4444",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  zIndex: 70,
                  borderRadius: "0.5rem",
                  width: "3rem",
                  height: "3rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#ef4444"; e.currentTarget.style.color = "white"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)"; e.currentTarget.style.color = "#ef4444"; }}
              >
                ✕
              </button>

              <h2 className="font-headline" style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                color: "#f97316",
                marginBottom: "1.5rem",
                marginRight: "2rem",
                letterSpacing: "-0.01em"
              }}>
                {selectedDateRange.start ? `${selectedDateRange.start}${selectedDateRange.end ? ` → ${selectedDateRange.end}` : ''}` : 'Log Absence'}
              </h2>

              {/* Show existing leaves on selected date */}
              {leavesOnSelectedDate.length > 0 && (
                <div style={{
                  background: "rgba(34, 197, 94, 0.1)",
                  border: "1px solid rgba(34, 197, 94, 0.2)",
                  borderRadius: "0.75rem",
                  padding: "1rem",
                  marginBottom: "1.5rem"
                }}>
                  <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#34d399", textTransform: "uppercase", margin: "0 0 0.75rem 0" }}>
                    📅 Existing Leaves
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {leavesOnSelectedDate.map((leave, idx) => (
                      <div key={idx} style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.75rem",
                        background: "rgba(23, 26, 28, 0.5)",
                        border: "1px solid rgba(161, 250, 255, 0.1)",
                        borderRadius: "0.5rem"
                      }}>
                        <div>
                          <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "white", margin: 0 }}>
                            {leave.employee_name}
                          </p>
                          <p style={{ fontSize: "0.75rem", color: "#aaabad", margin: "0.25rem 0 0 0" }}>
                            {leave.leave_type} • {leave.start_date} to {leave.end_date}
                          </p>
                        </div>
                        <button
                          onClick={() => handleCancelLeave(leave.id, leave)}
                          style={{
                            background: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            color: "#ef4444",
                            padding: "0.5rem 1rem",
                            borderRadius: "0.4rem",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            cursor: "pointer",
                            transition: "all 0.2s ease"
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "#ef4444"; e.currentTarget.style.color = "white"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"; e.currentTarget.style.color = "#ef4444"; }}
                        >
                          Cancel Leave
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleLogLeave} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div>
                  <label style={{ fontSize: "0.7rem", color: "#aaabad", fontWeight: 700, display: "block", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Employee *</label>
                  <select
                    required
                    value={leaveData.employee_id}
                    onChange={(e) => setLeaveData({...leaveData, employee_id: e.target.value})}
                    style={{
                      width: "100%",
                      background: "rgba(23, 26, 28, 0.5)",
                      border: "1px solid rgba(161, 250, 255, 0.1)",
                      color: "white",
                      padding: "0.9rem",
                      borderRadius: "0.5rem",
                      fontSize: "0.9rem",
                      outline: "none",
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                    onFocus={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.3)"}
                    onBlur={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.1)"}
                  >
                    <option value="">Select Employee</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.department || emp.role})</option>)}
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ fontSize: "0.7rem", color: "#aaabad", fontWeight: 700, display: "block", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Start Date *</label>
                    <input
                      required
                      type="date"
                      value={leaveData.start_date}
                      onChange={(e) => setLeaveData({...leaveData, start_date: e.target.value})}
                      style={{
                        width: "100%",
                        background: "rgba(23, 26, 28, 0.5)",
                        border: "1px solid rgba(161, 250, 255, 0.1)",
                        color: "white",
                        padding: "0.9rem",
                        borderRadius: "0.5rem",
                        fontSize: "0.9rem",
                        outline: "none",
                        transition: "all 0.2s ease"
                      }}
                      onFocus={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.3)"}
                      onBlur={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.1)"}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.7rem", color: "#aaabad", fontWeight: 700, display: "block", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>End Date *</label>
                    <input
                      required
                      type="date"
                      value={leaveData.end_date}
                      onChange={(e) => setLeaveData({...leaveData, end_date: e.target.value})}
                      style={{
                        width: "100%",
                        background: "rgba(23, 26, 28, 0.5)",
                        border: "1px solid rgba(161, 250, 255, 0.1)",
                        color: "white",
                        padding: "0.9rem",
                        borderRadius: "0.5rem",
                        fontSize: "0.9rem",
                        outline: "none",
                        transition: "all 0.2s ease"
                      }}
                      onFocus={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.3)"}
                      onBlur={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.1)"}
                    />
                  </div>
                </div>

                {/* Duration display */}
                {leaveData.start_date && leaveData.end_date && (
                  <div style={{
                    background: "rgba(6, 182, 212, 0.1)",
                    border: "1px solid rgba(6, 182, 212, 0.2)",
                    borderRadius: "0.5rem",
                    padding: "0.75rem",
                    textAlign: "center"
                  }}>
                    <p style={{ fontSize: "0.75rem", color: "#06b6d4", fontWeight: 700, margin: 0 }}>
                      📊 Duration: {calculateDaysBetween(leaveData.start_date, leaveData.end_date)} days
                    </p>
                  </div>
                )}

                <div>
                  <label style={{ fontSize: "0.7rem", color: "#aaabad", fontWeight: 700, display: "block", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Leave Type *</label>
                  <select
                    value={leaveData.leave_type}
                    onChange={(e) => setLeaveData({...leaveData, leave_type: e.target.value})}
                    style={{
                      width: "100%",
                      background: "rgba(23, 26, 28, 0.5)",
                      border: "1px solid rgba(161, 250, 255, 0.1)",
                      color: "white",
                      padding: "0.9rem",
                      borderRadius: "0.5rem",
                      fontSize: "0.9rem",
                      outline: "none",
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                    onFocus={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.3)"}
                    onBlur={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.1)"}
                  >
                    <option value="Paid Leave">Paid Leave</option>
                    <option value="Sick Leave">Sick Leave</option>
                    <option value="Unpaid Leave">Unpaid Leave (LWP)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  style={{
                    width: "100%",
                    padding: "1rem",
                    background: "#f97316",
                    color: "#0c0e10",
                    border: "none",
                    borderRadius: "0.6rem",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    marginTop: "1rem",
                    letterSpacing: "0.05em"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = "0.85"}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                >
                  Register Leave
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ONBOARDING WIZARD MODAL */}
        {isWizardOpen && (
          <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.95)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
            padding: "1rem",
            overflow: "auto",
            backdropFilter: "blur(4px)"
          }}>
            <div className="glass-card" style={{
              borderRadius: "1rem",
              padding: "2.5rem",
              maxWidth: "700px",
              width: "100%",
              margin: "2rem auto",
              position: "relative",
              animation: "fadeInUp 0.3s ease-out"
            }}>
              <button
                onClick={closeModal}
                style={{
                  position: "fixed",
                  top: "2rem",
                  right: "1rem",
                  background: "rgba(239, 68, 68, 0.2)",
                  border: "1px solid rgba(239, 68, 68, 0.5)",
                  fontSize: "2.5rem",
                  color: "#ef4444",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  zIndex: 70,
                  borderRadius: "0.5rem",
                  width: "3rem",
                  height: "3rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#ef4444"; e.currentTarget.style.color = "white"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)"; e.currentTarget.style.color = "#ef4444"; }}
              >
                ✕
              </button>

              <h2 className="font-headline" style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                color: "#a1faff",
                marginBottom: "1.5rem",
                marginRight: "2rem",
                letterSpacing: "-0.01em"
              }}>
                {isEditing ? "Edit Employee" : "Onboard Personnel"}
              </h2>

              {/* Progress Bar */}
              <div style={{ marginBottom: "2rem" }}>
                <div style={{ display: "flex", gap: "0.5rem", height: "4px", background: "rgba(161, 250, 255, 0.1)", borderRadius: "2px", overflow: "hidden" }}>
                  {[1, 2, 3, 4].map(s => (
                    <div key={s} style={{
                      flex: 1,
                      background: s <= step ? "#a1faff" : "transparent",
                      transition: "all 0.3s ease",
                      borderRadius: "1px"
                    }} />
                  ))}
                </div>
                <p style={{ fontSize: "0.7rem", color: "#aaabad", textTransform: "uppercase", marginTop: "0.75rem", margin: 0, letterSpacing: "0.05em", fontWeight: 700 }}>
                  Step {step} of 4
                </p>
              </div>

              <form onSubmit={handleOnboardOrUpdate} style={{ minHeight: "350px", display: "flex", flexDirection: "column" }}>
                {/* STEP 1: Core Identity */}
                {step === 1 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", flex: 1, animation: "slideInFromRight 0.3s ease-out" }}>
                    <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#a1faff", textTransform: "uppercase", margin: 0, letterSpacing: "0.05em", paddingBottom: "0.75rem", borderBottom: "1px solid rgba(161, 250, 255, 0.1)" }}>
                      1. Core Identity
                    </p>
                    <input
                      required
                      autoFocus
                      type="text"
                      placeholder="Full Legal Name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                      style={{
                        background: "rgba(23, 26, 28, 0.5)",
                        border: "1px solid rgba(161, 250, 255, 0.1)",
                        color: "white",
                        padding: "0.9rem",
                        borderRadius: "0.5rem",
                        fontSize: "0.9rem",
                        outline: "none",
                        transition: "all 0.2s ease"
                      }}
                      onFocus={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.3)"}
                      onBlur={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.1)"}
                    />
                    <input
                      type="text"
                      placeholder="Phone Number"
                      value={formData.phone_number}
                      onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                      style={{
                        background: "rgba(23, 26, 28, 0.5)",
                        border: "1px solid rgba(161, 250, 255, 0.1)",
                        color: "white",
                        padding: "0.9rem",
                        borderRadius: "0.5rem",
                        fontSize: "0.9rem",
                        outline: "none",
                        transition: "all 0.2s ease"
                      }}
                      onFocus={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.3)"}
                      onBlur={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.1)"}
                    />
                    <input
                      type="email"
                      placeholder="Personal Email"
                      value={formData.personal_email}
                      onChange={(e) => setFormData({...formData, personal_email: e.target.value})}
                      style={{
                        background: "rgba(23, 26, 28, 0.5)",
                        border: "1px solid rgba(161, 250, 255, 0.1)",
                        color: "white",
                        padding: "0.9rem",
                        borderRadius: "0.5rem",
                        fontSize: "0.9rem",
                        outline: "none",
                        transition: "all 0.2s ease"
                      }}
                      onFocus={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.3)"}
                      onBlur={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.1)"}
                    />
                    <input
                      type="date"
                      value={formData.dob}
                      onChange={(e) => setFormData({...formData, dob: e.target.value})}
                      style={{
                        background: "rgba(23, 26, 28, 0.5)",
                        border: "1px solid rgba(161, 250, 255, 0.1)",
                        color: "white",
                        padding: "0.9rem",
                        borderRadius: "0.5rem",
                        fontSize: "0.9rem",
                        outline: "none",
                        transition: "all 0.2s ease"
                      }}
                      onFocus={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.3)"}
                      onBlur={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.1)"}
                    />
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({...formData, gender: e.target.value})}
                      style={{
                        background: "rgba(23, 26, 28, 0.5)",
                        border: "1px solid rgba(161, 250, 255, 0.1)",
                        color: "white",
                        padding: "0.9rem",
                        borderRadius: "0.5rem",
                        fontSize: "0.9rem",
                        outline: "none",
                        transition: "all 0.2s ease",
                        cursor: "pointer"
                      }}
                      onFocus={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.3)"}
                      onBlur={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.1)"}
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                )}

                {/* STEP 2: Employment & Role */}
                {step === 2 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", flex: 1, animation: "slideInFromRight 0.3s ease-out" }}>
                    <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#a1faff", textTransform: "uppercase", margin: 0, letterSpacing: "0.05em", paddingBottom: "0.75rem", borderBottom: "1px solid rgba(161, 250, 255, 0.1)" }}>
                      2. Employment & Role
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      <div>
                        <label style={{ fontSize: "0.7rem", color: "#aaabad", fontWeight: 700, display: "block", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Employee ID</label>
                        <input
                          readOnly
                          type="text"
                          value={formData.employee_id}
                          style={{
                            width: "100%",
                            background: "rgba(23, 26, 28, 0.8)",
                            border: "1px solid rgba(6, 182, 212, 0.3)",
                            color: "#06b6d4",
                            padding: "0.9rem",
                            borderRadius: "0.5rem",
                            fontSize: "0.9rem",
                            outline: "none",
                            fontFamily: "monospace",
                            fontWeight: 700
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "0.7rem", color: "#aaabad", fontWeight: 700, display: "block", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>System Role *</label>
                        <select
                          required
                          value={formData.role}
                          onChange={(e) => setFormData({...formData, role: e.target.value})}
                          style={{
                            width: "100%",
                            background: "rgba(6, 182, 212, 0.1)",
                            border: "1px solid rgba(6, 182, 212, 0.3)",
                            color: "#06b6d4",
                            padding: "0.9rem",
                            borderRadius: "0.5rem",
                            fontSize: "0.9rem",
                            outline: "none",
                            cursor: "pointer",
                            fontWeight: 700
                          }}
                          onFocus={(e) => e.target.style.borderColor = "rgba(6, 182, 212, 0.5)"}
                          onBlur={(e) => e.target.style.borderColor = "rgba(6, 182, 212, 0.3)"}
                        >
                          <option value="">Select Role</option>
                          <option value="admin">Admin</option>
                          <option value="salesman">Salesman</option>
                          <option value="warehouse">Warehouse</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      <div>
                        <label style={{ fontSize: "0.7rem", color: "#aaabad", fontWeight: 700, display: "block", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Department</label>
                        <input
                          type="text"
                          placeholder="e.g. Sales, Operations"
                          value={formData.department}
                          onChange={(e) => setFormData({...formData, department: e.target.value})}
                          style={{
                            width: "100%",
                            background: "rgba(23, 26, 28, 0.5)",
                            border: "1px solid rgba(161, 250, 255, 0.1)",
                            color: "white",
                            padding: "0.9rem",
                            borderRadius: "0.5rem",
                            fontSize: "0.9rem",
                            outline: "none",
                            transition: "all 0.2s ease"
                          }}
                          onFocus={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.3)"}
                          onBlur={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.1)"}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "0.7rem", color: "#aaabad", fontWeight: 700, display: "block", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Reporting Manager</label>
                        <input
                          type="text"
                          placeholder="Manager Name"
                          value={formData.reporting_manager}
                          onChange={(e) => setFormData({...formData, reporting_manager: e.target.value})}
                          style={{
                            width: "100%",
                            background: "rgba(23, 26, 28, 0.5)",
                            border: "1px solid rgba(161, 250, 255, 0.1)",
                            color: "white",
                            padding: "0.9rem",
                            borderRadius: "0.5rem",
                            fontSize: "0.9rem",
                            outline: "none",
                            transition: "all 0.2s ease"
                          }}
                          onFocus={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.3)"}
                          onBlur={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.1)"}
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      <div>
                        <label style={{ fontSize: "0.7rem", color: "#aaabad", fontWeight: 700, display: "block", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Work Location</label>
                        <input
                          type="text"
                          placeholder="HQ / Territory"
                          value={formData.work_location}
                          onChange={(e) => setFormData({...formData, work_location: e.target.value})}
                          style={{
                            width: "100%",
                            background: "rgba(23, 26, 28, 0.5)",
                            border: "1px solid rgba(161, 250, 255, 0.1)",
                            color: "white",
                            padding: "0.9rem",
                            borderRadius: "0.5rem",
                            fontSize: "0.9rem",
                            outline: "none",
                            transition: "all 0.2s ease"
                          }}
                          onFocus={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.3)"}
                          onBlur={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.1)"}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "0.7rem", color: "#aaabad", fontWeight: 700, display: "block", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Employment Type</label>
                        <select
                          value={formData.employment_type}
                          onChange={(e) => setFormData({...formData, employment_type: e.target.value})}
                          style={{
                            width: "100%",
                            background: "rgba(23, 26, 28, 0.5)",
                            border: "1px solid rgba(161, 250, 255, 0.1)",
                            color: "white",
                            padding: "0.9rem",
                            borderRadius: "0.5rem",
                            fontSize: "0.9rem",
                            outline: "none",
                            cursor: "pointer",
                            transition: "all 0.2s ease"
                          }}
                          onFocus={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.3)"}
                          onBlur={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.1)"}
                        >
                          <option value="Full-time">Full-time</option>
                          <option value="Contract">Contract</option>
                          <option value="Part-time">Part-time</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: "0.7rem", color: "#aaabad", fontWeight: 700, display: "block", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Joining Date</label>
                      <input
                        type="date"
                        value={formData.joining_date}
                        onChange={(e) => setFormData({...formData, joining_date: e.target.value})}
                        style={{
                          width: "100%",
                          background: "rgba(23, 26, 28, 0.5)",
                          border: "1px solid rgba(161, 250, 255, 0.1)",
                          color: "white",
                          padding: "0.9rem",
                          borderRadius: "0.5rem",
                          fontSize: "0.9rem",
                          outline: "none",
                          transition: "all 0.2s ease"
                        }}
                        onFocus={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.3)"}
                        onBlur={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.1)"}
                      />
                    </div>

                    {/* CONDITIONAL: Salesman Specs */}
                    {formData.role === "salesman" && (
                      <div style={{
                        padding: "1.25rem",
                        background: "rgba(6, 182, 212, 0.1)",
                        border: "1px solid rgba(6, 182, 212, 0.2)",
                        borderRadius: "0.75rem",
                        animation: "fadeInUp 0.3s ease-out"
                      }}>
                        <p style={{ fontSize: "0.75rem", color: "#06b6d4", fontWeight: 700, textTransform: "uppercase", margin: "0 0 1rem 0", letterSpacing: "0.05em" }}>📊 Field Sales Configuration</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                          <div>
                            <label style={{ fontSize: "0.7rem", color: "#aaabad", fontWeight: 700, display: "block", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Commission Rate (%)</label>
                            <input
                              type="number"
                              step="0.1"
                              value={formData.commission_rate}
                              onChange={(e) => setFormData({...formData, commission_rate: e.target.value})}
                              style={{
                                width: "100%",
                                background: "rgba(23, 26, 28, 0.5)",
                                border: "1px solid rgba(161, 250, 255, 0.1)",
                                color: "white",
                                padding: "0.9rem",
                                borderRadius: "0.5rem",
                                fontSize: "0.9rem",
                                outline: "none",
                                transition: "all 0.2s ease"
                              }}
                              onFocus={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.3)"}
                              onBlur={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.1)"}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: "0.7rem", color: "#aaabad", fontWeight: 700, display: "block", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Incentive Tier</label>
                            <input
                              type="text"
                              placeholder="e.g. Tier 1, Standard"
                              value={formData.incentive_structure}
                              onChange={(e) => setFormData({...formData, incentive_structure: e.target.value})}
                              style={{
                                width: "100%",
                                background: "rgba(23, 26, 28, 0.5)",
                                border: "1px solid rgba(161, 250, 255, 0.1)",
                                color: "white",
                                padding: "0.9rem",
                                borderRadius: "0.5rem",
                                fontSize: "0.9rem",
                                outline: "none",
                                transition: "all 0.2s ease"
                              }}
                              onFocus={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.3)"}
                              onBlur={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.1)"}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CONDITIONAL: Warehouse Specs */}
                    {formData.role === "warehouse" && (
                      <div style={{
                        padding: "1.25rem",
                        background: "rgba(249, 115, 22, 0.1)",
                        border: "1px solid rgba(249, 115, 22, 0.2)",
                        borderRadius: "0.75rem",
                        animation: "fadeInUp 0.3s ease-out"
                      }}>
                        <p style={{ fontSize: "0.75rem", color: "#f97316", fontWeight: 700, textTransform: "uppercase", margin: "0 0 1rem 0", letterSpacing: "0.05em" }}>📦 Warehouse Configuration</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                          <div>
                            <label style={{ fontSize: "0.7rem", color: "#aaabad", fontWeight: 700, display: "block", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Shift Timing</label>
                            <input
                              type="text"
                              placeholder="e.g. 9 AM - 6 PM"
                              value={formData.shift_timing}
                              onChange={(e) => setFormData({...formData, shift_timing: e.target.value})}
                              style={{
                                width: "100%",
                                background: "rgba(23, 26, 28, 0.5)",
                                border: "1px solid rgba(161, 250, 255, 0.1)",
                                color: "white",
                                padding: "0.9rem",
                                borderRadius: "0.5rem",
                                fontSize: "0.9rem",
                                outline: "none",
                                transition: "all 0.2s ease"
                              }}
                              onFocus={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.3)"}
                              onBlur={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.1)"}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: "0.7rem", color: "#aaabad", fontWeight: 700, display: "block", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Primary Responsibility</label>
                            <select
                              value={formData.primary_responsibility}
                              onChange={(e) => setFormData({...formData, primary_responsibility: e.target.value})}
                              style={{
                                width: "100%",
                                background: "rgba(23, 26, 28, 0.5)",
                                border: "1px solid rgba(161, 250, 255, 0.1)",
                                color: "white",
                                padding: "0.9rem",
                                borderRadius: "0.5rem",
                                fontSize: "0.9rem",
                                outline: "none",
                                cursor: "pointer",
                                transition: "all 0.2s ease"
                              }}
                              onFocus={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.3)"}
                              onBlur={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.1)"}
                            >
                              <option value="">Select Duty</option>
                              <option value="Packing">Packing</option>
                              <option value="Inventory">Inventory</option>
                              <option value="Scanning">Scanning</option>
                              <option value="Loading">Loading/Unloading</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 3: Financials & Payroll */}
                {step === 3 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", flex: 1, animation: "slideInFromRight 0.3s ease-out" }}>
                    <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#a1faff", textTransform: "uppercase", margin: 0, letterSpacing: "0.05em", paddingBottom: "0.75rem", borderBottom: "1px solid rgba(161, 250, 255, 0.1)" }}>
                      3. Financials & Payroll
                    </p>
                    <input
                      required
                      type="number"
                      placeholder="Base Salary (₹)"
                      value={formData.base_salary}
                      onChange={(e) => setFormData({...formData, base_salary: e.target.value})}
                      style={{
                        background: "rgba(23, 26, 28, 0.5)",
                        border: "1px solid rgba(161, 250, 255, 0.1)",
                        color: "white",
                        padding: "0.9rem",
                        borderRadius: "0.5rem",
                        fontSize: "0.9rem",
                        outline: "none",
                        transition: "all 0.2s ease"
                      }}
                      onFocus={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.3)"}
                      onBlur={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.1)"}
                    />
                    <select
                      value={formData.payment_cycle}
                      onChange={(e) => setFormData({...formData, payment_cycle: e.target.value})}
                      style={{
                        background: "rgba(23, 26, 28, 0.5)",
                        border: "1px solid rgba(161, 250, 255, 0.1)",
                        color: "white",
                        padding: "0.9rem",
                        borderRadius: "0.5rem",
                        fontSize: "0.9rem",
                        outline: "none",
                        cursor: "pointer",
                        transition: "all 0.2s ease"
                      }}
                      onFocus={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.3)"}
                      onBlur={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.1)"}
                    >
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Monthly</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Bank Account Number"
                      value={formData.bank_account_no}
                      onChange={(e) => setFormData({...formData, bank_account_no: e.target.value})}
                      style={{
                        background: "rgba(23, 26, 28, 0.5)",
                        border: "1px solid rgba(161, 250, 255, 0.1)",
                        color: "white",
                        padding: "0.9rem",
                        borderRadius: "0.5rem",
                        fontSize: "0.9rem",
                        outline: "none",
                        transition: "all 0.2s ease",
                        fontFamily: "monospace"
                      }}
                      onFocus={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.3)"}
                      onBlur={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.1)"}
                    />
                    <input
                      type="text"
                      placeholder="IFSC Code"
                      value={formData.bank_ifsc}
                      onChange={(e) => setFormData({...formData, bank_ifsc: e.target.value.toUpperCase()})}
                      style={{
                        background: "rgba(23, 26, 28, 0.5)",
                        border: "1px solid rgba(161, 250, 255, 0.1)",
                        color: "white",
                        padding: "0.9rem",
                        borderRadius: "0.5rem",
                        fontSize: "0.9rem",
                        outline: "none",
                        transition: "all 0.2s ease",
                        fontFamily: "monospace"
                      }}
                      onFocus={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.3)"}
                      onBlur={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.1)"}
                    />
                    <input
                      type="text"
                      placeholder="UPI ID (Optional)"
                      value={formData.upi_id}
                      onChange={(e) => setFormData({...formData, upi_id: e.target.value})}
                      style={{
                        background: "rgba(23, 26, 28, 0.5)",
                        border: "1px solid rgba(161, 250, 255, 0.1)",
                        color: "white",
                        padding: "0.9rem",
                        borderRadius: "0.5rem",
                        fontSize: "0.9rem",
                        outline: "none",
                        transition: "all 0.2s ease",
                        fontFamily: "monospace"
                      }}
                      onFocus={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.3)"}
                      onBlur={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.1)"}
                    />
                  </div>
                )}

                {/* STEP 4: System Access */}
                {step === 4 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", flex: 1, animation: "slideInFromRight 0.3s ease-out" }}>
                    <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#34d399", textTransform: "uppercase", margin: 0, letterSpacing: "0.05em", paddingBottom: "0.75rem", borderBottom: "1px solid rgba(52, 211, 153, 0.2)" }}>
                      4. System Access
                    </p>
                    <input
                      required
                      type="email"
                      placeholder="Work Email"
                      value={formData.work_email}
                      onChange={(e) => setFormData({...formData, work_email: e.target.value})}
                      style={{
                        background: "rgba(23, 26, 28, 0.5)",
                        border: "1px solid rgba(161, 250, 255, 0.1)",
                        color: "white",
                        padding: "0.9rem",
                        borderRadius: "0.5rem",
                        fontSize: "0.9rem",
                        outline: "none",
                        transition: "all 0.2s ease",
                        fontFamily: "monospace"
                      }}
                      onFocus={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.3)"}
                      onBlur={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.1)"}
                    />
                    <input
                      required={!isEditing}
                      type="password"
                      placeholder={isEditing ? "Leave blank for current password" : "Password (min 6 characters)"}
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      style={{
                        background: "rgba(23, 26, 28, 0.5)",
                        border: "1px solid rgba(161, 250, 255, 0.1)",
                        color: "white",
                        padding: "0.9rem",
                        borderRadius: "0.5rem",
                        fontSize: "0.9rem",
                        outline: "none",
                        transition: "all 0.2s ease",
                        fontFamily: "monospace"
                      }}
                      onFocus={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.3)"}
                      onBlur={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.1)"}
                    />
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      style={{
                        background: "rgba(23, 26, 28, 0.5)",
                        border: "1px solid rgba(161, 250, 255, 0.1)",
                        color: "white",
                        padding: "0.9rem",
                        borderRadius: "0.5rem",
                        fontSize: "0.9rem",
                        outline: "none",
                        cursor: "pointer",
                        transition: "all 0.2s ease"
                      }}
                      onFocus={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.3)"}
                      onBlur={(e) => e.target.style.borderColor = "rgba(161, 250, 255, 0.1)"}
                    >
                      <option value="Active">Active</option>
                      <option value="On Leave">On Leave</option>
                      <option value="Suspended">Suspended</option>
                    </select>
                  </div>
                )}

                {/* BUTTONS */}
                <div style={{
                  display: "flex",
                  gap: "1rem",
                  marginTop: "2.5rem",
                  paddingTop: "1.5rem",
                  borderTop: "1px solid rgba(161, 250, 255, 0.1)"
                }}>
                  {step > 1 && (
                    <button
                      type="button"
                      onClick={handleBack}
                      style={{
                        flex: 1,
                        padding: "1rem",
                        background: "rgba(23, 26, 28, 0.5)",
                        border: "1px solid rgba(161, 250, 255, 0.1)",
                        color: "#aaabad",
                        borderRadius: "0.6rem",
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        letterSpacing: "0.05em"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(161, 250, 255, 0.1)";
                        e.currentTarget.style.color = "#a1faff";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(23, 26, 28, 0.5)";
                        e.currentTarget.style.color = "#aaabad";
                      }}
                    >
                      ← Back
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                      flex: 1,
                      padding: "1rem",
                      background: step === 4 ? "#34d399" : "#06b6d4",
                      color: "#0c0e10",
                      border: "none",
                      borderRadius: "0.6rem",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      cursor: isSubmitting ? "not-allowed" : "pointer",
                      opacity: isSubmitting ? 0.6 : 1,
                      transition: "all 0.2s ease",
                      letterSpacing: "0.05em"
                    }}
                    onMouseEnter={(e) => !isSubmitting && (e.currentTarget.style.opacity = "0.85")}
                    onMouseLeave={(e) => !isSubmitting && (e.currentTarget.style.opacity = "1")}
                  >
                    {isSubmitting ? "Processing..." : step === 4 ? (isEditing ? "Save Changes" : "Deploy Personnel") : "Next Step →"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}