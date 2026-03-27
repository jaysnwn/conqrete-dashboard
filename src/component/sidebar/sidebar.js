"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation"; 
import { supabase } from "@/lib/supabase"; 

const navItems = [
  { name: "Dashboard", path: "/dashboard" },
  { name: "Products", path: "/products" },
  { name: "Inventory", path: "/inventory" },
  { name: "Orders", path: "/orders" },
  { name: "Finance", path: "/finance" },
  { name: "Shipments", path: "/shipments" },
  { name: "Retailers", path: "/retailers" },
  { name: "Salesmen", path: "/salesmen" },
  { name: "Warehouse Monitor", path: "/warehouseworker" },
  { name: "Human Resources", path: "/hr" },
  { name: "Payroll Engine", path: "/payroll" },
  { name: "Profit-Engine", path: "/profit-engine" },
  { name: "Operating Expenses", path: "/expenseledger" },
];

export default function Sidebar() {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false); 
  const pathname = usePathname(); 

  const handleLogOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <>
      {/* GLOBAL STYLES FOR THE SIDEBAR FONTS */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Manrope:wght@200;300;400;500;600;700;800&display=swap');
        .font-headline { font-family: 'Space Grotesk', sans-serif; }
        .font-label { font-family: 'Manrope', sans-serif; }
      `}</style>

      {/* MOBILE TOP BAR */}
      <div className="md:hidden fixed top-0 left-0 w-full z-50 flex justify-between items-center p-4" style={{ background: "#050505", borderBottom: "1px solid rgba(161, 250, 255, 0.08)" }}>
        <h2 className="text-xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-[#a1faff] font-headline m-0">
          CONQRETE CORE
        </h2>
        <button onClick={() => setIsMobileOpen(!isMobileOpen)} className="text-[#a1faff] text-2xl focus:outline-none">
          {isMobileOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* MOBILE BACKDROP */}
      {isMobileOpen && (
        <div onClick={() => setIsMobileOpen(false)} className="md:hidden fixed inset-0 bg-black/80 z-40 backdrop-blur-sm"></div>
      )}

      {/* SIDEBAR (Locked Width, Sticky Position) */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-[260px] flex-shrink-0 transform transition-transform duration-300 ease-in-out md:sticky md:top-0 md:translate-x-0 ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{
          background: "linear-gradient(180deg, #0c0e10 0%, #050505 100%)",
          borderRight: "1px solid rgba(161, 250, 255, 0.05)",
          display: "flex",
          flexDirection: "column",
          padding: "24px",
          height: "100vh",
          boxShadow: "10px 0 30px rgba(0,0,0,0.5)",
          boxSizing: "border-box"
        }}
      >
        {/* DESKTOP HEADER */}
        <div className="hidden md:block" style={{ marginBottom: "40px", marginTop: "8px" }}>
          <h1 className="text-2xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-[#a1faff] font-headline m-0 uppercase">
            CONQRETE CORE
          </h1>
          <p className="text-[10px] font-label uppercase tracking-widest text-[#aaabad]/60 mt-1 m-0">
            ROOT_ACCESS
          </p>
        </div>

        {/* NAVIGATION LINKS */}
        <nav 
          className="mt-16 md:mt-0 [&::-webkit-scrollbar]:hidden font-label" 
          style={{ 
            display: "flex", 
            flexDirection: "column", 
            gap: "8px", 
            overflowY: "auto", 
            flex: 1,
            scrollbarWidth: "none", 
            msOverflowStyle: "none",
            paddingRight: "4px"
          }} 
        >
          {navItems.map((item, index) => {
            const isActive = pathname === item.path; 
            const isHovered = hoveredIndex === index;
            const isHighlighted = isActive || isHovered; 

            return (
              <Link 
                key={item.name} 
                href={item.path}
                onClick={() => setIsMobileOpen(false)} 
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  padding: "12px 16px",
                  borderRadius: "8px",
                  color: isHighlighted ? "#a1faff" : "#747578",
                  textDecoration: "none",
                  fontSize: "0.85rem",
                  fontWeight: isHighlighted ? "600" : "500",
                  letterSpacing: "0.05em",
                  transition: "all 0.2s ease",
                  borderRight: isHighlighted ? "2px solid #a1faff" : "2px solid transparent",
                  background: isHighlighted ? "linear-gradient(90deg, rgba(161,250,255,0.05) 0%, transparent 100%)" : "transparent"
                }}
              >
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* BOTTOM CONTROLS */}
        <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div className="flex items-center gap-3 px-2 mb-4 text-[#a1faff]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#a1faff] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00f4fe]"></span>
            </span>
            <span className="text-[9px] font-label font-bold tracking-widest uppercase">System Active</span>
          </div>

          <button 
            onClick={handleLogOut} 
            style={{ 
              padding: "12px", 
              background: "rgba(255,113,108,0.05)", 
              color: "#ff716c", 
              border: "1px solid rgba(255,113,108,0.2)", 
              borderRadius: "8px", 
              cursor: "pointer", 
              fontSize: "0.75rem", 
              fontWeight: "bold", 
              textTransform: "uppercase", 
              letterSpacing: "0.1em",
              fontFamily: "'Space Grotesk', sans-serif",
              transition: "all 0.2s ease"
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,113,108,0.1)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,113,108,0.05)"}
          >
            Log Out
          </button>
          <div className="font-label" style={{ fontSize: "0.65rem", color: "#535557", textAlign: "center", letterSpacing: "0.1em" }}>
            v4.0.2-NEXUS
          </div>
        </div>
      </aside>
    </>
  );
}