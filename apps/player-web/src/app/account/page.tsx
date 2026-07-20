import type { Metadata } from "next";
import { AccountCenter } from "@/components/account-center";

export const metadata: Metadata = { title: "Account & Cloud Save" };

export default function AccountPage() { return <AccountCenter />; }
