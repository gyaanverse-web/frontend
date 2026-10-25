import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Section, Todo } from "@/components/marketing/LegalPage";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy — Gyaanverse",
  description:
    "How Gyaanverse handles subscription cancellations, refunds, failed payments and duplicate charges.",
};

export default function RefundPolicy() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Refund & Cancellation Policy"
      intro="This policy covers payments made to Gyaanverse for a platform subscription: how to cancel, when a refund is available, and how long one takes. Payment gateways require this policy to be published before live payments can be activated."
      updated={<Todo>publication date</Todo>}
    >
      <Section heading="1. What this policy covers">
        <ul>
          <li>
            <strong>In scope:</strong> subscription payments made by a coaching
            institute to Gyaanverse for a plan tier.
          </li>
          <li>
            <strong>Not in scope:</strong> fees a student pays to their coaching
            institute. That money belongs to the institute, not to us. Those
            refunds are governed by the institute&apos;s own fee policy, and a
            student should raise them with their institute. Section 7 explains
            what we can and cannot do there.
          </li>
        </ul>
      </Section>

      <Section heading="2. Free plan">
        <p>
          The Free plan costs nothing, so there is nothing to refund. You can
          evaluate the platform on it for as long as you like, and stop using it
          at any time without notice or charge.
        </p>
      </Section>

      <Section heading="3. Cancelling a paid plan">
        <ul>
          <li>
            You can cancel from your account settings, or by writing to{" "}
            <Todo>billing email address</Todo>.
          </li>
          <li>
            <strong>What happens on cancellation:</strong>{" "}
            <Todo>
              choose one and state it plainly — either access continues until the
              end of the paid period, or access ends immediately with a pro-rata
              refund. Do not leave this ambiguous.
            </Todo>
          </li>
          <li>
            <strong>Auto-renewal:</strong>{" "}
            <Todo>
              how far before a renewal date a cancellation must be made to avoid
              the next charge
            </Todo>
          </li>
          <li>
            Your institute&apos;s data is retained after cancellation as
            described in the <Link href="/privacy">Privacy Policy</Link>, so you can
            export it or resume later.
          </li>
        </ul>
      </Section>

      <Section heading="4. When you can get a refund">
        <ul>
          <li>
            <strong>Cooling-off window:</strong>{" "}
            <Todo>
              number of days after a first subscription payment within which a
              full refund is given — 7 days is the common Indian SaaS norm, and a
              gateway review expects to see a number here
            </Todo>
          </li>
          <li>
            <strong>Duplicate or failed payments:</strong> if you were charged
            twice for the same period, or charged for a payment that failed, we
            refund it in full. This is never time-barred — tell us whenever you
            notice it.
          </li>
          <li>
            <strong>Our fault:</strong> if a defect on our side made the platform
            substantially unusable for a sustained period and we could not fix
            it, we will refund the affected period on request.
          </li>
          <li>
            <strong>Billing error:</strong> if we charged the wrong amount or the
            wrong plan, we refund the difference.
          </li>
        </ul>
      </Section>

      <Section heading="5. When a refund is not available">
        <ul>
          <li>
            Part-used billing periods outside the cooling-off window, except as
            stated in section 4.
          </li>
          <li>
            Dissatisfaction with AI evaluation accuracy. AI output is assistive
            and is not warranted to be accurate — this is stated in section 6 of
            our <Link href="/terms">Terms of Service</Link> and on this page, before
            purchase.
          </li>
          <li>
            Accounts terminated for breaching the Terms of Service.
          </li>
          <li>
            Downgrades mid-period.{" "}
            <Todo>
              state whether a downgrade is credited, refunded pro-rata, or
              applies only from the next period
            </Todo>
          </li>
        </ul>
      </Section>

      <Section heading="6. How to request a refund, and how long it takes">
        <ul>
          <li>
            Write to <Todo>billing email address</Todo> with the registered
            institute name, the payment date, and the transaction reference from
            your receipt.
          </li>
          <li>
            We will acknowledge within <strong>2 working days</strong> and tell
            you whether the request is approved.
          </li>
          <li>
            Approved refunds are initiated within{" "}
            <strong>5 working days</strong> of approval, to the original payment
            method. We cannot refund to a different account or instrument.
          </li>
          <li>
            Once initiated, the money typically reaches you in{" "}
            <strong>5 to 7 working days</strong>, depending on your bank or card
            issuer. That part is outside our control.
          </li>
          <li>
            Refunds are made in Indian rupees for the amount charged. Any bank or
            currency-conversion charge your own bank applies is not something we
            can reimburse.
          </li>
        </ul>
      </Section>

      <Section heading="7. Student fee payments">
        <p>
          If you are a student or a parent who paid a fee to a coaching institute
          through this platform:
        </p>
        <ul>
          <li>
            That payment is between you and the institute. Ask the institute for
            a refund under its own fee policy.
          </li>
          <li>
            We can confirm what was recorded — the invoice, the receipt and the
            payment reference — and we will help the institute process a refund
            it has approved.
          </li>
          <li>
            <strong>We cannot refund an institute&apos;s fee on our own
            initiative</strong>, because the money is not ours to return.
          </li>
          <li>
            <Todo>
              Decide and state who bears the gateway charge on a student fee
              refund — the institute or the student — before you turn on fee
              collection. This is the single most common fee-refund dispute.
            </Todo>
          </li>
        </ul>
      </Section>

      <Section heading="8. Chargebacks">
        <p>
          If you believe a charge is wrong, please contact us before raising a
          chargeback with your bank. A chargeback freezes the amount for weeks
          and we usually cannot resolve it as quickly as we can resolve a direct
          request. We may suspend an account with an unresolved chargeback until
          it is settled.
        </p>
      </Section>

      <Section heading="9. Contact">
        <ul>
          <li>
            <strong>Entity:</strong> <Todo>registered legal entity name</Todo>
          </li>
          <li>
            <strong>Billing email:</strong>{" "}
            <Todo>billing email address</Todo>
          </li>
          <li>
            <strong>Address:</strong>{" "}
            <Todo>full registered address with PIN code</Todo>
          </li>
          <li>
            <strong>Grievance Officer:</strong> named in our{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </li>
        </ul>
      </Section>
    </LegalPage>
  );
}
