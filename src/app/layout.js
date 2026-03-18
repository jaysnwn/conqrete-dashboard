"use client";

import "./globals.css";
import { usePathname } from "next/navigation";
import Sidebar from "../sidebar"; // This tells it to look at your smart sidebar file!

export default function RootLayout({ children }) {
  const pathname = usePathname();
  
  // THE LOCKDOWN LOGIC: Check if we are on the salesmen field page
  const isFieldRoute = pathname && pathname.startsWith("/field");

  return (
    <html lang="en">
      <body style={{ 
        margin: 0, 
        backgroundColor: "#0a0a0a", 
        color: "#e0e0e0", 
        fontFamily: 'Inter, "Segoe UI", sans-serif' 
      }}>
        <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>

          {/* This imports your actual sidebar.js file. 
              Since your sidebar.js already has logic to hide itself on /field, it will vanish! */}
          <Sidebar />

          {/* Main Content Area */}
          <main style={{ 
            flex: 1, 
            padding: "40px", 
            overflowY: "auto",
            background: "radial-gradient(circle at 20% 20%, #111 0%, #0a0a0a 100%)"
          }}>
            
            {/* We only show the "ADMIN_SESSION" header if we are NOT on the field page */}
            {!isFieldRoute && (
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
            )}

            <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
              {children}
            </div>
          </main>

        </div>
      </body>
    </html>
  );
}