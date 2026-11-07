"use client";

import { LogIn, LogOut } from "lucide-react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMe, useSignIn, useSignOut } from "@/hooks/use-me";
import ja from "@/messages/ja.json";

const HEADER_BUTTON_CLASS =
  "text-masthead-foreground hover:bg-white/10 hover:text-masthead-foreground";

/** ヘッダー右上のログイン導線。ログイン機能が未設定のときは何も出さない */
export function UserMenu() {
  const pathname = usePathname();
  const { data } = useMe();
  const signIn = useSignIn();
  const signOut = useSignOut();

  if (!data?.loginEnabled) return null;

  if (!data.user) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={signIn.isPending}
        onClick={() => signIn.mutate(pathname)}
        className={HEADER_BUTTON_CLASS}
      >
        <LogIn />
        {signIn.isError ? ja.auth.signInError : ja.auth.signIn}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={HEADER_BUTTON_CLASS}>
          <span className="max-w-32 truncate">{data.user.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={signOut.isPending} onSelect={() => signOut.mutate()}>
          <LogOut />
          {ja.auth.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
