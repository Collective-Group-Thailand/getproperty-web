import { expect, test, type Page } from "@playwright/test";

import { HOSTS, MOCK_API } from "../playwright.config";
import { signInWithOtp } from "./support/auth";
import { gotoOwner, hydrated, received, signInOwner, W } from "./support/owner";
import { expectAxeClean } from "./support/staff";

/**
 * GW6 / G9 — verified reviews, the AI listing assistant and energy insight (D-301; O-035, O-036, O-009). Owner
 * reviews: public and hidden (with the moderators' reason), reply screened by the API (a phone number is refused on
 * the field), report — and no hide / delete anywhere. The public listing page shows the building's reviews with the
 * owner's reply. "Draft with AI": quota, drafts copied into the Thai field (nothing saved), the monthly limit as a
 * designed state. Energy: score, metrics and penalties; opt-in only after ticking the consent (never pre-ticked);
 * opt-out; too little data.
 */

test.describe.configure({ mode: "serial" });

const LANDLORD_PHONE = "0810000006";
const LISTING = "8d4b2c1a-0000-4000-8000-00000000a001";
const reset = () => fetch(`${MOCK_API}/__mock/owner/reset?part=insight`, { method: "POST" });

async function signInLandlord(page: Page) {
  await signInWithOtp(page, HOSTS.owner, LANDLORD_PHONE);
  await hydrated(page);
}

test.beforeAll(reset);
test.afterAll(reset);

test("reviews: reply (screened), report, hidden with the reason — never hide or delete", async ({ page }) => {
  await signInLandlord(page);
  await gotoOwner(page, "/listings");
  await page.getByTestId("listing-reviews").click();
  await hydrated(page);
  const rows = page.getByTestId("review-row");
  await expect(rows).toHaveCount(4);
  await expect(
    page.locator('[data-testid="review-row"][data-state="hidden"]').getByTestId("review-moderation-reason"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /ซ่อน|ลบ|Hide|Delete/ })).toHaveCount(0);
  await expectAxeClean(page);

  const unanswered = rows
    .filter({ hasNot: page.getByTestId("review-owner-reply") })
    .filter({ has: page.getByTestId("review-reply") })
    .first();
  await unanswered.getByTestId("review-reply").click();
  await page.getByTestId("review-reply-input").fill("ขอบคุณค่ะ ติดต่อ 081-234-5678 ได้เลย");
  await page.getByRole("dialog").getByTestId("form-submit").click();
  await expect(page.getByRole("dialog").getByTestId("problem-notice")).toHaveAttribute(
    "data-code",
    "review.personal_data",
  );
  await page.getByTestId("review-reply-input").fill("ขอบคุณสำหรับคำติชมค่ะ เราปรับปรุงที่จอดรถแล้ว");
  await page.getByRole("dialog").getByTestId("form-submit").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("review-owner-reply")).toHaveCount(2);

  await rows.first().getByTestId("review-report").click();
  await page.getByTestId("review-report-reason").fill("มีข้อมูลไม่ตรงกับความจริง");
  await page.getByRole("dialog").getByTestId("form-submit").click();
  await expect(page.getByTestId("review-reported")).toHaveCount(1);

  // The public listing page shows the published reviews and the owner's reply.
  await page.goto(`${HOSTS.owner}/rent/condo-ari-1br-sunlit`);
  const block = page.getByTestId("listing-reviews");
  await expect(block.getByTestId("listing-review")).toHaveCount(3);
  await expect(block).toContainText("ผู้เช่ายืนยันแล้ว");
  await expect(block).toContainText("ขอบคุณมากค่ะ");
  await expectAxeClean(page);
});

test("Draft with AI: drafts go into the Thai fields, nothing is saved; the monthly limit is a designed state", async ({
  page,
}) => {
  await signInLandlord(page);
  await gotoOwner(page, `/listings/${LISTING}`);
  const assistant = page.getByTestId("listing-assistant");
  await expect(assistant.getByTestId("assistant-quota")).toContainText("27");
  const before = await page.getByTestId("listing-title-th").inputValue();
  await assistant.getByTestId("assistant-generate").click();
  await expect(assistant.getByTestId("assistant-draft")).toHaveCount(2);
  await expect(assistant.getByTestId("assistant-disclaimer")).toBeVisible();
  await assistant.getByTestId("assistant-use-th").click();
  await expect(page.getByTestId("listing-title-th")).not.toHaveValue(before);
  expect(await received("owner.listings.update")).toHaveLength(0);
  const [call] = await received("owner.listings.assistant");
  expect(call?.idempotencyKey).toBeTruthy();
  await expectAxeClean(page);

  await fetch(`${MOCK_API}/__mock/owner/insight/assistant?fail=limit`, { method: "POST" });
  await assistant.getByTestId("assistant-generate").click();
  await expect(assistant.getByTestId("assistant-problem")).toHaveAttribute("data-code", "assistant.limit_reached");
});

test("energy insight: score and penalties; opt in only after ticking the consent; opt out; too little data", async ({
  page,
}) => {
  await signInOwner(page);
  await gotoOwner(page, `/buildings/${W.buildingA}`);
  const card = page.getByTestId("energy-insight");
  await expect(card.getByTestId("energy-score")).toHaveAttribute("data-score", "74");
  await expect(card.getByTestId("energy-penalties").getByRole("listitem")).toHaveCount(3);
  await expect(card.getByTestId("energy-consent")).toBeVisible();
  await expect(card.getByTestId("energy-agree")).not.toBeChecked();
  await expect(card.getByTestId("energy-opt-in-submit")).toBeDisabled();
  await expectAxeClean(page);

  await card.getByTestId("energy-agree").click();
  await card.getByTestId("energy-opt-in-submit").click();
  await expect(card.getByTestId("energy-opted-in")).toBeVisible();
  const [optIn] = await received("owner.buildings.energyInsightOptIn");
  expect(optIn?.body.consentVersion).toBe(1);
  expect(optIn?.idempotencyKey).toBeTruthy();

  await card.getByTestId("energy-opt-out").click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /หยุดแบ่งปัน|Stop sharing/ })
    .click();
  await expect(card.getByTestId("energy-opted-out")).toBeVisible();

  await gotoOwner(page, `/buildings/${W.buildingB}`);
  await expect(page.getByTestId("energy-insufficient")).toBeVisible();
});
