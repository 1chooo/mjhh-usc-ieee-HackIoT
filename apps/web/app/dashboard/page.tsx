import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminDashboard } from "../../components/admin-dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Admin view of this hour: energy against a fixed setpoint, people, calls, and each room.",
};

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="note">Loading the rooms…</p>}>
      <AdminDashboard />
    </Suspense>
  );
}
