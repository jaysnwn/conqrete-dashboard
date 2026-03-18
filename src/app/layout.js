"use client"; // This allows the hover effects (onMouseEnter/onMouseLeave) to work

import "./globals.css";
import Link from "next/link";
import { useState } from "react";

export default function RootLayout({ children }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const navItems = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Products", path: "/products" },
    { name: "Inventory", path: "/inventory" },
    { name: "Orders", path: "/orders" },
    { name: "Shipments", path: "/shipments" },
    { name: "Retailers", path: "/retailers" },
    { name: "Salesmen", path: "/salesmen" },
    { name: "Reports", path: "/reports" },
  ];

  return (
    <html lang="en">
      <body style={{ 
        margin: 0, 
        backgroundColor: "#0a0a0a", 
        color: "#e0e0e0", 
        fontFamily: 'Inter, "Segoe UI", sans-serif' 
      }}>
        <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>

          {/* Sidebar: CONQRETE Industrial HUD Style */}
          <aside style={{
            width: "260px",
            background: "linear-gradient(180deg, #111 0%, #050505 100%)",
            borderRight: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            flexDirection: "column",
            padding: "24px",
            boxShadow: "10px 0 30px rgba(0,0,0,0.5)",
            zIndex: 10
          }}>
            <div style={{ marginBottom: "40px" }}>
              <h2 style={{ 
                fontSize: "1.2rem", 
                letterSpacing: "3px", 
                fontWeight: "800", 
                color: "#fff",
                margin: 0,
                textTransform: "uppercase"
              }}>
                CONQRETE<span style={{ color: "#00f2ff", marginLeft: "4px" }}>_</span>
              </h2>
              <p style={{ fontSize: "0.65rem", color: "#555", marginTop: "4px", letterSpacing: "1px" }}>
                CORE ERP SYSTEM
              </p>
            </div>

            <nav style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {navItems.map((item, index) => (
                <Link 
                  key={item.name} 
                  href={item.path}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  style={{
                    padding: "12px 16px",
                    borderRadius: "4px",
                    color: hoveredIndex === index ? "#00f2ff" : "#888",
                    textDecoration: "none",
                    fontSize: "0.85rem",
                    fontWeight: "500",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    borderLeft: hoveredIndex === index ? "3px solid #00f2ff" : "3px solid transparent",
                    background: hoveredIndex === index ? "rgba(0, 242, 255, 0.04)" : "transparent",
                    transform: hoveredIndex === index ? "translateX(4px)" : "translateX(0)"
                  }}
                >
                  {item.name}
                </Link>
              ))}
            </nav>

            <div style={{ marginTop: "auto", fontSize: "0.65rem", color: "#333", borderTop: "1px solid #222", paddingTop: "15px" }}>
              SYSTEM STATUS: <span style={{ color: "#00ff88" }}>OPTIMAL</span>
            </div>
          </aside>

          {/* Main Content Area */}
          <main style={{ 
            flex: 1, 
            padding: "40px", 
            overflowY: "auto",
            background: "radial-gradient(circle at 20% 20%, #111 0%, #0a0a0a 100%)"
          }}>
            {/* Minimalist Top Bar */}
            <header style={{
              marginBottom: "40px",
              paddingBottom: "15px",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div style={{ fontSize: "0.75rem", color: "#555", letterSpacing: "1px" }}>
                TERMINAL / <span style={{ color: "#aaa" }}>MAIN_DASHBOARD</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#00ff88", boxShadow: "0 0 10px #00ff88" }}></div>
                <span style={{ fontSize: "0.85rem", color: "#aaa" }}>ADMIN_SESSION</span>
              </div>
            </header>

            <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
              {children}
            </div>
          </main>

        </div>
      </body>
    </html>
  );
}