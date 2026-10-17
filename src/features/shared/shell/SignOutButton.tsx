"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { signOut } from "@/lib/auth/actions";
import { Button } from "@/ui/components/Button";
import { IconLogOut } from "@/ui/icons/glyphs/log-out";

/** Ends the sign-in (refresh family revoked upstream, D-163) and returns to this zone's sign-in page. */
export function SignOutButton({ loginHref, size = "sm" }: { loginHref: string; size?: "sm" | "md" | "lg" }) {
  const t = useTranslations("auth");
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size={size}
      iconStart={IconLogOut}
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          await signOut();
          window.location.assign(loginHref);
        })
      }
    >
      {t("signOut")}
    </Button>
  );
}
