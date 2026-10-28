import type { Metadata } from "next";
import BuyerDashboard from "@/components/BuyerDashboard";

export const metadata: Metadata = {
  title: "Buyer Dashboard | Validus NFT Ticketing",
  description: "Discover events, purchase NFT tickets, and manage your Validus ticket collection.",
};

export default function BuyerPage() {
  return <BuyerDashboard />;
}
