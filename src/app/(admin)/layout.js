"use client"; // Required for usePathname to handle dynamic routing

import Sidebar from "../../component/sidebar/sidebar"; 
import AuthGuard from "../../component/AuthGuard"; 
import { usePathname } from "next/navigation";

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  
  // Magically formats the current URL path into a clean, uppercase breadcrumb
  // (e.g., "/inventory" becomes "INVENTORY", "/" becomes "DASHBOARD")
  const currentPage = pathname && pathname !== "/" 
    ? pathname.replace('/', '').toUpperCase() 
    : "DASHBOARD";

  return (
    <AuthGuard> 
      {/* Global Font Styles for the Header */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Manrope:wght@200;300;400;500;600;700;800&display=swap');
      `}</style>

      <div 
        className="flex flex-col md:flex-row h-screen overflow-hidden bg-[#0c0e10] text-[#e0e0e0]" 
        style={{ fontFamily: 'Inter, "Segoe UI", sans-serif' }}
      >
        <Sidebar />

        <main 
          className="flex-1 overflow-y-auto relative pt-16 md:pt-0 [&::-webkit-scrollbar]:hidden" 
          style={{ 
            background: "radial-gradient(circle at 20% 20%, #111 0%, #0a0a0a 100%)",
            scrollbarWidth: "none",
            msOverflowStyle: "none"
          }}
        >
          
          {/* --- GLOBAL STICKY NAVBAR --- */}
          <header className="w-full h-24 sticky top-0 z-40 bg-[#0c0e10]/80 backdrop-blur-md border-b border-[#a1faff]/5 flex justify-between items-center px-6 md:px-12">
            
            {/* Dynamic Breadcrumbs */}
            <div className="flex items-center gap-4">
              <nav className="flex text-xs uppercase tracking-widest gap-3" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700 }}>
                <span className="text-slate-500">CONQRETE</span>
                <span className="text-slate-700">/</span>
                <span className="text-[#a1faff] border-b border-[#a1faff]/50 pb-1">{currentPage}</span>
              </nav>
            </div>

            {/* Utility & Admin Profile */}
            <div className="flex items-center gap-8">
              <button className="text-slate-400 hover:text-[#a1faff] transition-colors hidden md:block">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              </button>
              
              <div className="flex items-center gap-4 pl-0 md:pl-8 md:border-l border-white/10">
                <div className="text-right hidden md:block">
                  <p className="text-[11px] font-bold text-white leading-none" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Administrator</p>
                  <p className="text-[9px] text-slate-400 tracking-widest mt-1 uppercase" style={{ fontFamily: 'Manrope, sans-serif' }}>NEXUS PRIME</p>
                </div>
                <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center bg-transparent text-[#a1faff]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                </div>
              </div>
            </div>
          </header>
          {/* --- END GLOBAL NAVBAR --- */}

          {/* PAGE CONTENT CONTAINER */}
          <div className="p-4 md:p-10 max-w-[1920px] mx-auto">
            {children}
          </div>

        </main>
      </div>
    </AuthGuard>
  );
}