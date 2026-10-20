import { getTranslations } from "next-intl/server";

import { BOOKING_STATUS } from "@/domain/status/booking";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { param, section } from "@/features/shared/console/params";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { LinkTabs } from "@/ui/components/LinkTabs";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconCalendar } from "@/ui/icons/glyphs/calendar";
import { IconChevronLeft } from "@/ui/icons/glyphs/chevron-left";
import { IconChevronRight } from "@/ui/icons/glyphs/chevron-right";

import { ownerPath, withQuery } from "../shared/links";
import { focusedBuilding, ownerCan, readOnly, type OwnerContext } from "../shared/server";
import { CommunityNav } from "./CommunityNav";
import { BookingActions, EditFacility, NewFacility } from "./FacilityActions";
import { bangkokToday, currentTime } from "@/features/shared/console/time";

type SearchParams = Record<string, string | string[] | undefined>;
const DAY = 86_400_000;

/** A Bangkok date `YYYY-MM-DD` shifted by whole days. */
function shift(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

/**
 * Facilities and bookings (F2 2.7, D-212): the building's facilities with their booking policy, and one
 * facility's bookings for a week — approve / reject requests (when the facility needs approval), cancel a
 * confirmed booking, mark a no-show once it started. The API refuses overlaps and quotas itself.
 */
export async function FacilitiesView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.community.facilities");
  const bt = await getTranslations("owner.community.bookings");
  const { api, locale, me } = context;
  const building = focusedBuilding(context);
  const canManage = ownerCan(me, "community.manage") && !readOnly(me);
  if (!building) {
    return (
      <OwnerPage testId="facilities">
        <PageHeader title={t("title")} description={t("description")} crumbs={[{ label: t("title") }]} />
        <CommunityNav current="/community/facilities" locale={locale} />
        <Card>
          <EmptyState icon={IconCalendar} title={t("chooseBuilding")} />
        </Card>
      </OwnerPage>
    );
  }
  const facilities = await unwrap(
    api.GET("/v1/owner/facilities", { params: { query: { buildingId: building.id } } }),
  ).then((body) => body.data);
  const chosen = facilities.find((facility) => facility.id === param(searchParams.facility)) ?? facilities[0] ?? null;
  const today = bangkokToday();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(param(searchParams.from) ?? "") ? param(searchParams.from)! : today;
  const bookings = chosen
    ? await section(
        unwrap(
          api.GET("/v1/owner/facilities/{facilityId}/bookings", {
            params: {
              path: { facilityId: chosen.id },
              query: {
                from: new Date(`${from}T00:00:00+07:00`).toISOString(),
                to: new Date(`${shift(from, 7)}T00:00:00+07:00`).toISOString(),
              },
            },
          }),
        ),
      )
    : null;
  const now = new Date(currentTime()).toISOString();
  const base = ownerPath(locale, "/community/facilities");
  const week = (start: string) => withQuery(base, { facility: chosen?.id, from: start });

  return (
    <OwnerPage testId="facilities">
      <PageHeader
        title={t("title")}
        description={t("description")}
        crumbs={[{ label: t("title") }]}
        actions={canManage ? <NewFacility buildingId={building.id} /> : null}
      />
      <CommunityNav current="/community/facilities" locale={locale} />
      {facilities.length === 0 || !chosen ? (
        <Card>
          <EmptyState icon={IconCalendar} title={t("empty.title")} description={t("empty.body")} />
        </Card>
      ) : (
        <>
          <LinkTabs
            label={t("title")}
            current={withQuery(base, { facility: chosen.id })}
            tabs={facilities.map((facility) => ({
              href: withQuery(base, { facility: facility.id }),
              label: facility.name,
              testId: "facility-tab",
            }))}
          />
          <Card data-testid="facility-card">
            <CardHeader
              title={chosen.name}
              description={t("policyLine", {
                kind: t(`kinds.${chosen.kind}`),
                slot: chosen.bookingPolicy.slotMinutes ?? 60,
                from: chosen.bookingPolicy.openFrom ?? "08:00",
                to: chosen.bookingPolicy.openTo ?? "22:00",
                max: chosen.bookingPolicy.maxDurationMinutes ?? 120,
                days: chosen.bookingPolicy.maxAdvanceDays ?? 14,
                week: chosen.bookingPolicy.maxPerUnitPerWeek ?? 2,
              })}
              action={canManage ? <EditFacility facility={chosen} /> : null}
            />
            <div className="flex flex-wrap gap-2">
              {chosen.bookingPolicy.requiresApproval ? (
                <Badge tone="warning" size="sm">
                  {t("needsApproval")}
                </Badge>
              ) : (
                <Badge tone="neutral" size="sm">
                  {t("noApproval")}
                </Badge>
              )}
              {chosen.isActive ? null : (
                <Badge tone="neutral" size="sm">
                  {t("inactive")}
                </Badge>
              )}
            </div>
          </Card>
          <Card as="section" aria-labelledby="facility-bookings" data-testid="facility-bookings">
            <CardHeader
              title={
                <span id="facility-bookings">
                  {bt("title", { from: formatDate(from, locale), to: formatDate(shift(from, 6), locale) })}
                </span>
              }
              action={
                <span className="flex gap-1">
                  <Button asChild variant="ghost" size="sm" iconStart={IconChevronLeft}>
                    <a href={week(shift(from, -7))} data-testid="week-previous">
                      {bt("previous")}
                    </a>
                  </Button>
                  <Button asChild variant="ghost" size="sm" iconEnd={IconChevronRight}>
                    <a href={week(shift(from, 7))} data-testid="week-next">
                      {bt("next")}
                    </a>
                  </Button>
                </span>
              }
            />
            {bookings?.error ? (
              <SectionError error={bookings.error} />
            ) : bookings?.data && bookings.data.data.length ? (
              <SimpleTable
                caption={chosen.name}
                testId="booking-table"
                minWidth="44rem"
                columns={[
                  { key: "when", header: bt("when") },
                  { key: "unit", header: bt("unit") },
                  { key: "status", header: bt("status") },
                  { key: "actions", header: <span className="sr-only">{bt("actions")}</span> },
                ]}
                rows={bookings.data.data.map((booking) => ({
                  key: booking.id,
                  testId: "booking-row",
                  data: { status: booking.status },
                  cells: {
                    when: (
                      <span className="flex flex-col">
                        <span>
                          {formatDateTime(booking.startsAt, locale)} – {formatTime(booking.endsAt, locale)}
                        </span>
                        {booking.note ? <span className="text-muted text-xs">{booking.note}</span> : null}
                      </span>
                    ),
                    unit: <span className="font-mono">{booking.unitNo}</span>,
                    status: (
                      <span className="flex flex-col gap-1">
                        <StatusBadgeOf map={BOOKING_STATUS} value={booking.status} size="sm" />
                        {booking.cancelReason ? (
                          <span className="text-muted text-xs">{booking.cancelReason}</span>
                        ) : null}
                      </span>
                    ),
                    actions: canManage ? <BookingActions booking={booking} started={booking.startsAt <= now} /> : null,
                  },
                }))}
              />
            ) : (
              <p className="text-muted text-sm">{bt("none")}</p>
            )}
          </Card>
        </>
      )}
    </OwnerPage>
  );
}
