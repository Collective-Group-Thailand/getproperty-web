import { redirect } from "next/navigation";

/**
 * Staff invitations link to the staff host (`PUBLIC_STAFF_APP_URL/join?code=…`, D-180): continue to the
 * staff sign-in with the code, which `otp/verify` turns into the membership (D-145).
 */
export default async function StaffJoin({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const invitation = code?.trim().slice(0, 64);
  redirect(invitation ? `/login?invitation=${encodeURIComponent(invitation)}` : "/login");
}
