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

      // Bouncer Logic 1: Kick salesmen out of everything except /field
      const { data: rep } = await supabase
        .from("salesmen")
        .select("id")
        .eq("email", userEmail)
        .maybeSingle();

      if (rep && !pathname.startsWith("/field")) {
        router.push("/field");
        return;
      }

      // Bouncer Logic 2: Kick warehouse workers out of everything except /warehouse
      const { data: warehouse } = await supabase
        .from("warehouse_workers")
        .select("id")
        .eq("email", userEmail)
        .maybeSingle();

      if (warehouse && !pathname.startsWith("/warehouse")) {
        router.push("/warehouse");
        return;
      }

      // If they pass the checks (either they are an Admin, or they are a worker on their correct page)
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
      <div className="h-screen w-screen bg-black flex flex-col justify-center items-center">
        <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-cyan-400 font-mono text-xs uppercase tracking-[0.3em] animate-pulse">Verifying Security Clearance...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;
  return <>{children}</>;
}