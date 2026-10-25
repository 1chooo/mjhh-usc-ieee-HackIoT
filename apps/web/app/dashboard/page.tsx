import type { Metadata } from "next";
import { AdminDashboard } from "../../components/admin-dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Live room: temperature, people, votes since the last reading, the model's setpoint, and dollars saved.",
};

export default function DashboardPage() {
  return <AdminDashboard />;
}
