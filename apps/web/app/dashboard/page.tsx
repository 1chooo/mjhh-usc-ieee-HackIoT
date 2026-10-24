import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminDashboard } from "../../components/admin-dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Admin view for each room: sensors, hot or cold votes, and the hour against a fixed setpoint.",
};

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="note">Loading the rooms…</p>}>
      <AdminDashboard />
    </Suspense>
  );
}
