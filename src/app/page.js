import { redirect } from "next/navigation";

export default function Home() {
  // Instantly routes anyone visiting the root URL straight to the dashboard
  redirect("/dashboard"); 
}