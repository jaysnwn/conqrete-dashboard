import Sidebar from "../../component/sidebar/sidebar"; 
import AuthGuard from "../../component/AuthGuard"; 

export default function AdminLayout({ children }) {
  return (
    <AuthGuard> 
      <div 
        className="flex flex-col md:flex-row h-screen overflow-hidden bg-[#0a0a0a] text-[#e0e0e0]" 
        style={{ fontFamily: 'Inter, "Segoe UI", sans-serif' }}
      >

        <Sidebar />

        {/* UPDATED: Hid the scrollbar on the main page area too! */}
        <main 
          className="flex-1 overflow-y-auto relative pt-16 md:pt-0 [&::-webkit-scrollbar]:hidden" 
          style={{ 
            background: "radial-gradient(circle at 20% 20%, #111 0%, #0a0a0a 100%)",
            scrollbarWidth: "none",
            msOverflowStyle: "none"
          }}
        >
          
          <div className="p-4 md:p-10 max-w-[1200px] mx-auto">
            
            <header className="hidden md:flex" style={{
              marginBottom: "40px",
              paddingBottom: "15px",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div style={{ fontSize: "0.75rem", color: "#555", letterSpacing: "1px" }}>
                TERMINAL / <span style={{ color: "#aaa" }}>MAIN_DASHBOARD</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                
                {/* UPDATED: Added "animate-pulse" to this div to make it glow and breathe */}
                <div className="animate-pulse" style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#00ff88", boxShadow: "0 0 10px #00ff88" }}></div>
                
                <span style={{ fontSize: "0.85rem", color: "#aaa" }}>ADMIN_SESSION</span>
              </div>
            </header>

            {children}
          </div>

        </main>
      </div>
    </AuthGuard>
  );
}