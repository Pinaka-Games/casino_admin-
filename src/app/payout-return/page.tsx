import { Suspense } from "react";
import PayoutReturn from "./PayoutReturn";

/**
 * Where Coinflow's hosted withdraw tab lands after an agent adds a bank
 * account, debit card or wallet. Deliberately outside `(main)`: this renders in
 * a tab that is about to close, so it must not pull in the panel shell.
 */
export default function PayoutReturnPage() {
  return (
    <Suspense fallback={null}>
      <PayoutReturn />
    </Suspense>
  );
}
