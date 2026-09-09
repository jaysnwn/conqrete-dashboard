"use client";

import Sidebar from "../../component/sidebar/sidebar";
import AuthGuard from "../../component/AuthGuard";
import { usePathname } from "next/navigation";

const PAGE_LABELS = {
  "/dashboard": "Dashboard",
  "/orders": "Orders",
  "/products": "Products",
  "/inventory": "Inventory",
  "/finance": "Finance",
  "/shipments": "Shipments",
  "/retailers": "Retailers",
  "/salesmen": "Salesmen",
  "/warehouseworker": "Warehouse Monitor",
  "/hr": "Human Resources",
  "/payroll": "Payroll Engine",
  "/profit-engine": "Profit Engine",
  "/expenseledger": "Operating Expenses",
};

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const currentPage = PAGE_LABELS[pathname] || (pathname !== "/" ? pathname.replace("/", "") : "Dashboard");

  return (
    <AuthGuard>
      <div
        className="flex h-screen overflow-hidden"
        style={{ background: "#F8F9FA", fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif" }}
      >
        <Sidebar />

        <main className="flex-1 overflow-y-auto flex flex-col min-w-0" style={{ scrollbarWidth: "thin" }}>
          {/* TOP BAR â€” hidden on mobile (sidebar handles mobile nav) */}
          <header
            className="hidden md:flex sticky top-0 z-40 items-center justify-between px-6"
            style={{ background: "#fff", borderBottom: "1px solid #E5E7EB", height: 56, flexShrink: 0 }}
          >
            {/* Breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500 }}>CONQRETE</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
              <span style={{ fontSize: 13, color: "#111827", fontWeight: 600 }}>{currentPage}</span>
            </div>

            {/* Right: user */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", display: "flex", alignItems: "center" }}
                onMouseEnter={e => e.currentTarget.style.color = "#374151"}
                onMouseLeave={e => e.currentTarget.style.color = "#9CA3AF"}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 16, borderLeft: "1px solid #E5E7EB" }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", lineHeight: 1 }}>Administrator</div>
                  <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>CONQRETE ERP</div>
                </div>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "#0EA5E9", display: "flex", alignItems: "center",
                  justifyContent: "center", color: "white", fontSize: 13, fontWeight: 700
                }}>
                  A
                </div>
              </div>
            </div>
          </header>

          {/* MOBILE SPACER for fixed sidebar top bar */}
          <div className="md:hidden" style={{ height: 52, flexShrink: 0 }} />

          {/* PAGE CONTENT */}
          <div style={{ flex: 1, padding: "24px" }}>
            {children}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
