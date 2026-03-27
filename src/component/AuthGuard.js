"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthGuard({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push("/login");
        return;
      }

      const userEmail = session.user.email?.toLowerCase();

      // Look up the user in the single 'employees' table
      // IMPORTANT: Change "role" to whatever your actual column name is (e.g., "job_title", "department")
      const { data: employee, error } = await supabase
        .from("employees")
        .select("role") 
        .eq("email", userEmail)
        .maybeSingle();

      if (error) {
        console.error("AuthGuard Error fetching employee:", error);
      }

      // If the employee exists in the table, check their role
      if (employee) {
        const userRole = employee.role?.toLowerCase();

        // Bouncer Logic 1: Salesmen go to /field
        // Change 'salesman' to match whatever exact text is in your database
        if (userRole === 'salesman' || userRole === 'sales') {
          if (!pathname.startsWith("/field")) {
            router.push("/field");
            return;
          }
        }
        
        // Bouncer Logic 2: Warehouse workers go to /warehouse
        // Change 'warehouse' to match whatever exact text is in your database
        else if (userRole === 'warehouse' || userRole === 'warehouse_worker') {
          if (!pathname.startsWith("/warehouse")) {
            router.push("/warehouse");
            return;
          }
        }
        
        // If they are an Admin (or any other role), they bypass the redirects 
        // and go straight to whatever page they clicked (like /dashboard)
      }

      setIsAuthenticated(true);
      setIsLoading(false);
    };

    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) router.push("/login");
    });

    return () => authListener.subscription.unsubscribe();
  }, [router, pathname]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-[#050505] flex flex-col justify-center items-center">
        <div className="w-12 h-12 border-4 border-[#00f2ff] border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_#00f2ff]"></div>
        <p className="text-[#00f2ff] font-mono text-xs uppercase tracking-[0.3em] animate-pulse">Verifying Security Clearance...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;
  return <>{children}</>;
}