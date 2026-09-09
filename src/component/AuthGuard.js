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
          setIsAuthenticated(true);
          setIsLoading(false);
          return;
        }

        if (userRole === "warehouse" || userRole === "warehouse_worker") {
          if (!pathname.startsWith("/warehouse")) {
            router.push("/warehouse");
          }
          setIsAuthenticated(true);
          setIsLoading(false);
          return;
        }
      }

      // Admin or any unrecognized role â€” allow through
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
      <div style={{
        height: "100vh", width: "100vw",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: "16px",
        backgroundColor: "#F8F9FA",
        fontFamily: "Inter, -apple-system, sans-serif"
      }}>
        <div style={{
          width: "32px", height: "32px", borderRadius: "50%",
          border: "2px solid #E5E7EB", borderTopColor: "#0EA5E9",
          animation: "spin 0.8s linear infinite"
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: "#6B7280", fontSize: "13px", fontWeight: 500, margin: 0 }}>
          Verifying session...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) return null;
  return <>{children}</>;
}
