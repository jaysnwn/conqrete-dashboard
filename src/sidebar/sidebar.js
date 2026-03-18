"use client"; // This is the magic line

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation"; // ADDED: To track what page we are on

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

export default function Sidebar() {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const pathname = usePathname(); // ADDED: Get the current URL

  // ADDED: THE LOCKDOWN LOGIC
  // If the URL starts with "/field", do not render the sidebar at all.
  if (pathname && pathname.startsWith("/field")) {
    return null;
  }

  return (
    <aside style={{
      width: "260px",
      background: "linear-gradient(180deg, #111111 0%, #050505 100%)",
      borderRight: "1px solid rgba(255, 255, 255, 0.08)",
      display: "flex",
      flexDirection: "column",
      padding: "24px",
      boxShadow: "10px 0 30px rgba(0,0,0,0.5)"
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
        <p style={{ fontSize: "0.7rem", color: "#666", marginTop: "4px" }}>OPERATIONAL INTELLIGENCE</p>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {navItems.map((item, index) => (
          <Link 
            key={item.name} 
            href={item.path}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            style={{
              padding: "12px 16px",
              borderRadius: "4px",
              color: hoveredIndex === index ? "#00f2ff" : "#999",
              textDecoration: "none",
              fontSize: "0.9rem",
              transition: "all 0.2s ease",
              borderLeft: hoveredIndex === index ? "2px solid #00f2ff" : "2px solid transparent",
              background: hoveredIndex === index ? "rgba(0, 242, 255, 0.05)" : "rgba(255,255,255,0.02)"
            }}
          >
            {item.name}
          </Link>
        ))}
      </nav>

      <div style={{ marginTop: "auto", fontSize: "0.7rem", color: "#444" }}>
        v1.0.4-STABLE
      </div>
    </aside>
  );
}