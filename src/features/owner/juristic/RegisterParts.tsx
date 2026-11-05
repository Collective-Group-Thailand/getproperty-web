import { getTranslations } from "next-intl/server";

import type { Schemas } from "@/lib/api/types";
import { Icon } from "@/ui/icons";
import { IconChat } from "@/ui/icons/glyphs/chat";
import { IconLink } from "@/ui/icons/glyphs/link";
import { IconMail } from "@/ui/icons/glyphs/mail";
import { IconPhone } from "@/ui/icons/glyphs/phone";

type Row = Pick<Schemas["RegisterUnitDto"], "owners" | "billTo">;

/**
 * The owners of a unit as one line — the first owner's name and "+1" for the others — and the second line the office
 * reads most (J-DESIGN §3): who receives the bill when it is not the owner.
 */
export async function OwnerNames({ row }: { row: Row }) {
  const t = await getTranslations("owner.juristic.register");
  const [first, ...others] = row.owners;
  const billTo = row.billTo[0];
  return (
    <span className="flex min-w-0 flex-col">
      {first ? (
        <span className="truncate">
          {first.party.displayName}
          {others.length ? <span className="text-muted"> {t("moreOwners", { count: others.length })}</span> : null}
        </span>
      ) : (
        <span className="text-muted">{t("noOwner")}</span>
      )}
      {billTo ? (
        <span className="text-muted truncate text-sm">
          {t(billTo.kind === "agency" ? "billToAgency" : "billToNamed", { name: billTo.billToParty.displayName })}
        </span>
      ) : null}
    </span>
  );
}

/**
 * How the owners of a unit can be reached (D-307: LINE, e-mail, SMS, printed letter): an icon per channel with its word
 * for screen readers; "จดหมาย" when none is on file (the statement goes by post).
 */
export async function Channels({ row }: { row: Row }) {
  const t = await getTranslations("owner.juristic.channel");
  const parties = row.owners.map((owner) => owner.party);
  const channels = [
    { key: "line", on: parties.some((party) => party.lineLinked), icon: IconChat },
    { key: "app", on: parties.some((party) => party.residentLinked), icon: IconLink },
    { key: "email", on: parties.some((party) => party.email), icon: IconMail },
    { key: "phone", on: parties.some((party) => party.phoneMasked), icon: IconPhone },
  ] as const;
  const shown = channels.filter((channel) => channel.on);
  if (parties.length === 0) return null;
  if (shown.length === 0)
    return (
      <span className="text-muted text-sm" data-testid="channels">
        {t("letter")}
      </span>
    );
  return (
    <ul className="text-muted m-0 flex list-none items-center gap-2 p-0" data-testid="channels" aria-label={t("label")}>
      {shown.map((channel) => (
        <li key={channel.key} title={t(channel.key)} className="flex items-center">
          <Icon icon={channel.icon} />
          <span className="sr-only">{t(channel.key)}</span>
        </li>
      ))}
    </ul>
  );
}
