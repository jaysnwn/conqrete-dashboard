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
      <div className="md:hidden fixed top-0 left-0 w-full z-40 flex justify-between items-center p-4" style={{ background: "#050505", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
        <h2 style={{ fontSize: "1.2rem", letterSpacing: "3px", fontWeight: "800", color: "#fff", margin: 0 }}>
          CONQRETE<span style={{ color: "#00f2ff" }}>_</span>
        </h2>
        <button onClick={() => setIsMobileOpen(!isMobileOpen)} className="text-[#00f2ff] text-2xl focus:outline-none">
          {isMobileOpen ? "✕" : "☰"}
        </button>
      </div>

      {isMobileOpen && (
        <div onClick={() => setIsMobileOpen(false)} className="md:hidden fixed inset-0 bg-black/80 z-40 backdrop-blur-sm"></div>
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-[260px] transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{
          background: "linear-gradient(180deg, #111111 0%, #050505 100%)",
          borderRight: "1px solid rgba(255, 255, 255, 0.08)",
          display: "flex",
          flexDirection: "column",
          padding: "24px",
          boxShadow: "10px 0 30px rgba(0,0,0,0.5)"
        }}
      >
        <div className="hidden md:block" style={{ marginBottom: "40px" }}>
          <h2 style={{ fontSize: "1.2rem", letterSpacing: "3px", fontWeight: "800", color: "#fff", margin: 0, textTransform: "uppercase" }}>
            CONQRETE<span style={{ color: "#00f2ff", marginLeft: "4px" }}>_</span>
          </h2>
          <p style={{ fontSize: "0.7rem", color: "#666", marginTop: "4px" }}>
            OPERATIONAL INTELLIGENCE
          </p>
        </div>

        {/* UPDATED: Added CSS tricks to hide the scrollbar while keeping scroll functionality */}
        <nav 
          className="mt-12 md:mt-0 [&::-webkit-scrollbar]:hidden" 
          style={{ 
            display: "flex", 
            flexDirection: "column", 
            gap: "8px", 
            overflowY: "auto", 
            flex: 1,
            scrollbarWidth: "none", // For Firefox
            msOverflowStyle: "none"  // For IE/Edge
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
                  borderRadius: "4px",
                  color: isHighlighted ? "#00f2ff" : "#999",
                  textDecoration: "none",
                  fontSize: "0.9rem",
                  transition: "all 0.2s ease",
                  borderLeft: isHighlighted ? "2px solid #00f2ff" : "2px solid transparent",
                  background: isHighlighted ? "rgba(0, 242, 255, 0.05)" : "rgba(255,255,255,0.02)"
                }}
              >
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <button 
            onClick={handleLogOut} 
            style={{ padding: "12px", background: "rgba(255,0,0,0.05)", color: "#ff4444", border: "1px solid rgba(255,0,0,0.1)", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px" }}
          >
            Log Out
          </button>
          <div style={{ fontSize: "0.7rem", color: "#444", textAlign: "center" }}>
            v1.0.4-STABLE
          </div>
        </div>
      </aside>
    </>
  );
}