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

      const { data: employee, error } = await supabase
        .from("employees")
        .select("role")
        .eq("work_email", userEmail)
        .maybeSingle();

      if (error) {
        console.error("AuthGuard Error fetching employee:", error);
      }

      if (employee) {
        const userRole = employee.role?.toLowerCase();

        if (userRole === "salesman" || userRole === "sales") {
          if (!pathname.startsWith("/field")) {
            router.push("/field");
          }
          // ✅ FIXED: Always set loading false so the redirect completes
          setIsLoading(false);
          return;
        }

        if (userRole === "warehouse" || userRole === "warehouse_worker") {
          if (!pathname.startsWith("/warehouse")) {
            router.push("/warehouse");
          }
          // ✅ FIXED: Always set loading false so the redirect completes
          setIsLoading(false);
          return;
        }
      }

      // Admin or any unrecognized role — allow through
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