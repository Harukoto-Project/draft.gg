import type { Metadata } from "next";

import { ProfilesScreen } from "@/components/profile/ProfilesScreen";
import ja from "@/messages/ja.json";

export const metadata: Metadata = {
  title: ja.profiles.title,
};

export default function ProfilesPage() {
  return <ProfilesScreen />;
}
