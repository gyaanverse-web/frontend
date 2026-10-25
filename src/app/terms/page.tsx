import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Section, Todo } from "@/components/marketing/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service — Gyaanverse",
  description:
    "The terms governing use of the Gyaanverse platform by coaching institutes, teachers and students.",
};

export default function TermsOfService() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      intro="These terms govern your use of Gyaanverse. They cover who may use the platform, what each party is responsible for, how AI evaluation may and may not be relied on, and the limits of our liability."
      updated={<Todo>publication date</Todo>}
    >
      <Section heading="1. Agreement to these terms">
        <p>
          These terms form a binding agreement between you and{" "}
          <Todo>registered legal entity name</Todo> (&ldquo;Gyaanverse&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account or using
          the platform, you accept them. If you do not accept them, do not use
          the platform.
        </p>
        <p>
          If you are accepting these terms on behalf of a coaching institute, you
          confirm you are authorised to bind that institute, and &ldquo;you&rdquo;
          means both you and the institute.
        </p>
      </Section>

      <Section heading="2. Accounts, roles and eligibility">
        <ul>
          <li>
            The platform has three roles: <strong>institute owner</strong>,{" "}
            <strong>teacher</strong> and <strong>student</strong>. Each role sees
            and can do different things, and roles are assigned by the platform,
            never chosen by the account holder.
          </li>
          <li>
            You must give accurate signup information and keep it current. You
            are responsible for everything done under your account, and for
            keeping your password confidential. Tell us promptly if you suspect
            unauthorised access.
          </li>
          <li>
            A user under 18 may use the platform only through an institute that
            has obtained verifiable parental consent, or under guardian
            supervision. See our{" "}
            <Link href="/privacy">Privacy Policy</Link> for how children&apos;s data is
            handled.
          </li>
          <li>
            One person may not hold both an authoring role and an owner role over
            the same content where the platform separates them. Those separations
            are a feature, not an obstacle to work around.
          </li>
        </ul>
      </Section>

      <Section heading="3. What an institute is responsible for">
        <p>
          When an institute uses Gyaanverse to hold student data, the institute —
          not us — decides what to collect and why. The institute therefore
          warrants that it:
        </p>
        <ul>
          <li>
            has a lawful basis for every student record it enters, and has given
            its students and their parents its own privacy notice;
          </li>
          <li>
            has obtained verifiable parental consent for every student under 18
            before entering their data;
          </li>
          <li>
            holds the rights to any question bank, paper, image or other material
            it uploads, and is not infringing anyone&apos;s copyright by
            uploading it;
          </li>
          <li>
            keeps its student, batch and fee records accurate, and corrects them
            when a student asks;
          </li>
          <li>
            uses the fee module in a way that complies with its own tax and
            invoicing obligations. We provide the records; we are not your
            accountant.
          </li>
        </ul>
      </Section>

      <Section heading="4. Acceptable use">
        <p>You agree not to:</p>
        <ul>
          <li>
            attempt to access another institute&apos;s data, or any account that
            is not yours;
          </li>
          <li>
            probe, scan, overload or interfere with the platform, or bypass any
            rate limit, access control or tenant boundary;
          </li>
          <li>
            upload malware, or content that is unlawful, obscene, defamatory, or
            harmful to a child;
          </li>
          <li>
            scrape, resell or redistribute the platform or another
            institute&apos;s content;
          </li>
          <li>
            use the platform to cheat in, or to facilitate cheating in, any
            examination it is not intended for;
          </li>
          <li>reverse engineer the platform or its AI evaluation.</li>
        </ul>
      </Section>

      <Section heading="5. Content and intellectual property">
        <ul>
          <li>
            <strong>Your content stays yours.</strong> Question banks, papers and
            records an institute creates remain the institute&apos;s property.
          </li>
          <li>
            You grant us a limited licence to host, store, process, transmit and
            display that content strictly as needed to operate the platform for
            you — including sending answer content to our AI evaluation provider
            as described in the Privacy Policy. That licence ends when you delete
            the content or close your account, subject to backups and any legal
            retention requirement.
          </li>
          <li>
            <strong>Platform content stays ours.</strong> The software, design,
            and any question pool we supply as platform content remain ours. If
            you publish a mock test to the public catalogue, you grant us a
            licence to display and distribute it there for as long as it is
            listed.
          </li>
        </ul>
      </Section>

      <Section heading="6. AI evaluation — what it is and is not">
        <p>
          This section is important. Please do not skip it.
        </p>
        <ul>
          <li>
            AI evaluation is an <strong>assistive tool for teachers</strong>. It
            is not a substitute for a teacher&apos;s judgement, and it is not an
            authoritative or certified assessment.
          </li>
          <li>
            <strong>It can be wrong.</strong> It can misread handwriting, miss a
            valid alternative method, misjudge a step, or produce feedback that
            does not apply. We make no warranty that any AI-generated mark,
            mistake identification or explanation is accurate or complete.
          </li>
          <li>
            A teacher can review and override any AI-generated result, and
            submissions the system is not confident about are held for human
            review before results are published. Publishing a result is an act
            by the institute, and the institute is responsible for the result it
            publishes to its students.
          </li>
          <li>
            Do not use AI evaluation as the sole basis for a decision with
            serious consequences for a student — admission, scholarship,
            promotion, or removal from a batch — without a teacher reviewing it.
          </li>
        </ul>
      </Section>

      <Section heading="7. Plans, charges and taxes">
        <ul>
          <li>
            Plan tiers and prices are shown on our <Link href="/#pricing">pricing section</Link>.
            Prices are in Indian rupees and{" "}
            <Todo>state whether listed prices include or exclude GST</Todo>.
          </li>
          <li>
            <strong>Billing period and renewal:</strong>{" "}
            <Todo>
              monthly or annual, whether it auto-renews, and how much notice is
              given before a renewal charge
            </Todo>
          </li>
          <li>
            <strong>Price changes:</strong>{" "}
            <Todo>
              how much notice you will give before changing the price of an
              existing subscription
            </Todo>
          </li>
          <li>
            Refunds and cancellation are covered in our{" "}
            <Link href="/refunds">Refund &amp; Cancellation Policy</Link>.
          </li>
          <li>
            Plan limits — students, teachers, batches, mocks and AI evaluations —
            are enforced by the platform. Exceeding a limit may block an action
            until you upgrade.
          </li>
          <li>
            Fees that an institute collects from its own students through the
            platform are between the institute and the student. We provide the
            collection and record-keeping tools; we are not a party to that
            transaction and we do not act as the institute&apos;s agent for it.
          </li>
        </ul>
      </Section>

      <Section heading="8. Availability and support">
        <ul>
          <li>
            We work to keep the platform available, but we do not promise
            uninterrupted service and we do not currently offer a contractual
            uptime guarantee. Maintenance, provider outages and faults will cause
            downtime from time to time.
          </li>
          <li>
            We may change, add or remove features. Where a change materially
            reduces a feature you rely on, we will give notice to account
            holders.
          </li>
          <li>
            <strong>Support:</strong>{" "}
            <Todo>
              support channel and the response time you are willing to commit to
              per plan — or state plainly that support is best-effort
            </Todo>
          </li>
        </ul>
      </Section>

      <Section heading="9. Suspension, termination and your data">
        <ul>
          <li>
            You may stop using the platform and close your account at any time.
          </li>
          <li>
            We may suspend or terminate an account that breaches these terms,
            that is used unlawfully, or that puts other users&apos; data at risk.
            Where it is safe and lawful to do so, we will warn you first and give
            you a chance to fix the problem.
          </li>
          <li>
            We may suspend an account for non-payment after giving notice.
          </li>
          <li>
            On termination, you may ask us to export your institute&apos;s data.{" "}
            <Todo>
              state the window during which an export can be requested after
              closure, and the format it is provided in
            </Todo>
          </li>
        </ul>
      </Section>

      <Section heading="10. Disclaimers and limits on liability">
        <p>
          The platform is provided on an &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo; basis. To the fullest extent the law allows, we
          exclude all implied warranties, including fitness for a particular
          purpose and accuracy of AI-generated output.
        </p>
        <p>
          We are not liable for indirect, incidental, special or consequential
          loss, nor for lost profits, lost admissions, loss of goodwill, or loss
          of data where you have not kept your own records.
        </p>
        <p>
          <strong>Our total aggregate liability</strong> arising out of or in
          connection with these terms is limited to{" "}
          <Todo>
            the cap you are willing to accept — commonly the amount you paid us
            in the 12 months before the claim
          </Todo>
          .
        </p>
        <p>
          Nothing here excludes liability that cannot be excluded under Indian
          law, including liability for fraud or for death or personal injury
          caused by negligence.
        </p>
      </Section>

      <Section heading="11. Indemnity">
        <p>
          You will indemnify us against claims, losses and reasonable costs
          arising from your breach of these terms, from content you upload, or
          from your failure to obtain the consents described in section 3 —
          including any claim by a student or parent about data you entered.
        </p>
      </Section>

      <Section heading="12. Governing law and disputes">
        <p>
          These terms are governed by the laws of India. The courts at{" "}
          <Todo>city of jurisdiction</Todo> have exclusive jurisdiction over any
          dispute.
        </p>
        <p>
          Before starting proceedings, please write to us so we can try to
          resolve the matter directly.
        </p>
      </Section>

      <Section heading="13. Changes to these terms">
        <p>
          We may update these terms. We will update the date at the top of this
          page, and where a change materially affects your rights we will notify
          account holders by email before it takes effect. Continuing to use the
          platform after that means you accept the updated terms.
        </p>
      </Section>

      <Section heading="14. Contact">
        <ul>
          <li>
            <strong>Entity:</strong> <Todo>registered legal entity name</Todo>
          </li>
          <li>
            <strong>Address:</strong>{" "}
            <Todo>full registered address with PIN code</Todo>
          </li>
          <li>
            <strong>Email:</strong> <Todo>contact email address</Todo>
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
