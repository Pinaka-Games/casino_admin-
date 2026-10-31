import { redirect } from "next/navigation";

/**
 * Withdraw Logs and Withdrawal Listing rendered the same component against the
 * same data — this file was literally `export { default } from
 * "../withdrawal-listing/page"`. The menu entry is gone; the route stays and
 * redirects so existing bookmarks, dashboard KPI links and any saved deep link
 * still land somewhere useful instead of 404ing.
 */
export default function WithdrawLogsRedirect() {
  redirect("/wallet/withdrawal-listing");
}
