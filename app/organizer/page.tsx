import EventOrganizerDashboard from "@/components/EventOrganizerDashboard";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Organizer Dashboard | Validus NFT Ticketing",
  description:
    "Deploy on-chain event tickets, enforce anti-scalping 1.5x price caps, track sales analytics, and earn 5% royalties.",
};

export default function OrganizerPage() {
  return <EventOrganizerDashboard />;
}
