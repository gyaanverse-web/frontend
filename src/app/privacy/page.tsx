import type { Metadata } from "next";
import { LegalPage, Section, Todo } from "@/components/marketing/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — Gyaanverse",
  description:
    "How Gyaanverse collects, uses, shares and protects personal data, including students' data and children's data under India's DPDP Act, 2023.",
};

export default function PrivacyPolicy() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      intro="This policy explains what personal data Gyaanverse handles, why we handle it, who we share it with, and the rights you have over it. It is written to meet the notice requirements of India's Digital Personal Data Protection Act, 2023."
      updated={<Todo>publication date</Todo>}
    >
      <Section heading="1. Who we are">
        <p>
          Gyaanverse is a platform that coaching institutes use to run batches,
          conduct online tests, evaluate answer sheets with AI assistance, and
          manage fee collection.
        </p>
        <ul>
          <li>
            <strong>Legal entity:</strong>{" "}
            <Todo>
              registered name and entity type — private limited, LLP or
              proprietorship
            </Todo>
          </li>
          <li>
            <strong>Registered address:</strong>{" "}
            <Todo>full registered address with PIN code</Todo>
          </li>
          <li>
            <strong>Registration number:</strong>{" "}
            <Todo>CIN / LLPIN / GSTIN, as applicable</Todo>
          </li>
          <li>
            <strong>Contact:</strong> <Todo>support email address</Todo>
          </li>
        </ul>
      </Section>

      <Section heading="2. Two different roles we play">
        <p>
          This distinction decides who is accountable for what, so please read it
          before the rest.
        </p>
        <ul>
          <li>
            <strong>For institute accounts</strong> — when an institute owner or
            a teacher signs up, we decide how their account data is handled. We
            are the <strong>Data Fiduciary</strong> for that data.
          </li>
          <li>
            <strong>For student records</strong> — when an institute enrols
            students, uploads answer sheets, or records fees, the institute
            decides what to collect and why. We process that data on the
            institute&apos;s instructions as a <strong>Data Processor</strong>.
            The institute is the Data Fiduciary, and is responsible for having a
            lawful basis, for issuing its own privacy notice to students and
            parents, and for obtaining parental consent where required.
          </li>
        </ul>
        <p>
          If you are a student or a parent and want a record corrected or
          deleted, contact your coaching institute first — they control that
          record. We will support them in acting on your request, and you can
          also escalate to our Grievance Officer in section 10.
        </p>
      </Section>

      <Section heading="3. What data we handle">
        <h3>Account data</h3>
        <ul>
          <li>
            Name, email address, password (stored only as a salted hash), and
            role — owner, teacher or student.
          </li>
          <li>Email verification status and session records.</li>
          <li>
            Institute name, subdomain, and the signup intent that distinguishes a
            student account from a coaching-owner account.
          </li>
        </ul>

        <h3>Academic data entered by an institute</h3>
        <ul>
          <li>Student enrolment records and batch membership.</li>
          <li>
            Question banks, exam papers and exam schedules created by teachers.
          </li>
          <li>
            Exam attempts, responses, uploaded or scanned answer sheets, marks,
            AI evaluation output, and teacher overrides.
          </li>
          <li>Performance reports derived from the above.</li>
        </ul>

        <h3>Fee and payment data</h3>
        <ul>
          <li>
            Fee structures, invoices, receipts, payment allocations, concessions
            and adjustments recorded by the institute.
          </li>
          <li>
            Guardian contact details, where an institute records them for fee
            correspondence.
          </li>
          <li>
            Payment transaction references returned by our payment gateway.{" "}
            <strong>
              We never receive or store card numbers, CVVs, UPI PINs or
              net-banking credentials
            </strong>{" "}
            — those go directly to the gateway.
          </li>
        </ul>

        <h3>Technical data</h3>
        <ul>
          <li>
            Server logs containing IP address, timestamp, requested route and
            error traces, used for security and debugging.
          </li>
          <li>
            A session cookie required to keep you signed in. We do not use
            advertising or cross-site tracking cookies.
          </li>
        </ul>
      </Section>

      <Section heading="4. Children's data and parental consent">
        <p>
          Many students on this platform are under 18. The DPDP Act treats
          children&apos;s data as a heightened-risk category, and we follow those
          rules strictly.
        </p>
        <ul>
          <li>
            <strong>Verifiable parental consent is required</strong> before a
            child&apos;s data is processed. The institute that enrols the student
            is responsible for obtaining and holding that consent, and warrants
            to us that it has done so.
          </li>
          <li>
            <strong>We do not run behavioural advertising</strong> of any kind,
            to any user, and we do not direct targeted advertising at children.
          </li>
          <li>
            <strong>We do not track or profile children</strong> for any purpose
            beyond delivering and reporting on their own coursework to their own
            institute, and to a parent or guardian the institute has linked to
            them.
          </li>
          <li>
            We do not knowingly allow a child to create a direct account outside
            an institute or a guardian-supervised signup. If you believe a child
            has registered without parental consent, contact our Grievance
            Officer and we will act on it.
          </li>
        </ul>
        <p>
          <Todo>
            Confirm the exact parental-consent mechanism you will require of
            institutes — a signed admission-form clause, an in-app guardian
            confirmation, or both — and describe it here. This is the most
            heavily penalised area of the DPDP Act, so this paragraph should
            describe what you actually do, not an intention.
          </Todo>
        </p>
      </Section>

      <Section heading="5. Why we handle it">
        <ul>
          <li>
            <strong>To provide the service</strong> — authenticating users,
            running exams, evaluating answers, producing reports, generating
            invoices and receipts.
          </li>
          <li>
            <strong>To keep the service working</strong> — monitoring, debugging,
            backups, and investigating abuse or security incidents.
          </li>
          <li>
            <strong>To bill institutes</strong> — managing subscription plans and
            processing payments.
          </li>
          <li>
            <strong>To communicate</strong> — transactional email such as email
            verification, password reset, invitations, exam notifications and fee
            reminders. We do not send marketing email to students.
          </li>
          <li>
            <strong>To meet legal obligations</strong> — tax, accounting, and
            lawful requests from authorities.
          </li>
        </ul>
        <p>
          Processing rests on the consent obtained at signup (and parental
          consent for children), on performing our contract with the institute,
          and on our legal obligations.
        </p>
      </Section>

      <Section heading="6. Who we share it with">
        <p>
          We do not sell personal data, and we never share it for advertising. We
          share it only with the service providers needed to run the platform:
        </p>
        <ul>
          <li>
            <strong>Railway</strong> — application hosting, database and
            background job processing.
          </li>
          <li>
            <strong>Vercel</strong> — hosting for the web interface.
          </li>
          <li>
            <strong>Cloudinary</strong> — storage of uploaded files, including
            scanned answer sheets.
          </li>
          <li>
            <strong>Resend</strong> — delivery of transactional email.
          </li>
          <li>
            <strong>Razorpay</strong> — payment processing for subscriptions and
            fees.
          </li>
          <li>
            <strong>Google (Gemini)</strong> — the AI model that evaluates
            submitted answers. See section 7.
          </li>
        </ul>
        <p>
          We also disclose data where the law requires it, and to professional
          advisers under a duty of confidentiality.
        </p>
        <p>
          <strong>Cross-border transfer:</strong> some of these providers process
          data outside India.{" "}
          <Todo>
            Confirm the hosting region of each provider above and state it here,
            so the transfer disclosure is accurate rather than generic.
          </Todo>
        </p>
      </Section>

      <Section heading="7. How AI evaluation works">
        <p>
          When an answer is submitted for AI evaluation, the content of that
          answer — including the image of a handwritten or scanned answer sheet,
          and the associated question — is sent to Google&apos;s Gemini model so
          it can identify the step where a mistake occurs and generate feedback.
        </p>
        <ul>
          <li>
            We send the academic content of the submission and the question. We
            do not send the student&apos;s name, email address, contact details
            or fee records to the model.
          </li>
          <li>
            AI output is <strong>assistive, not final</strong>. It can be wrong.
            A teacher can review and override any AI-generated mark or comment,
            and answers the system is not confident about are held for human
            review before results are published.
          </li>
          <li>
            We do not use your submissions to train our own models, and we do not
            permit the model provider to use them to train theirs beyond what is
            needed to return a result.
          </li>
        </ul>
      </Section>

      <Section heading="8. How long we keep it">
        <ul>
          <li>
            <strong>Account data:</strong>{" "}
            <Todo>retention period after account closure</Todo>
          </li>
          <li>
            <strong>Exam attempts, answer sheets and results:</strong>{" "}
            <Todo>
              retention period — institutes typically need these for at least a
              full academic year
            </Todo>
          </li>
          <li>
            <strong>Fee records, invoices and receipts:</strong>{" "}
            <Todo>
              retention period — Indian tax and accounting law requires books of
              account to be kept for 8 years, which will likely set this number
            </Todo>
          </li>
          <li>
            <strong>Server logs:</strong>{" "}
            <Todo>retention period, typically 30 to 90 days</Todo>
          </li>
        </ul>
        <p>
          When an institute closes its account, we delete or return its data in
          accordance with the terms agreed with that institute, except where we
          must retain records to meet a legal obligation.
        </p>
      </Section>

      <Section heading="9. Your rights">
        <p>Under the DPDP Act you may:</p>
        <ul>
          <li>
            Ask for access to a summary of the personal data we hold about you
            and how it is processed.
          </li>
          <li>
            Ask for correction of inaccurate or incomplete data, and for it to be
            completed or updated.
          </li>
          <li>
            Ask for erasure of your data where we no longer need it for the
            purpose it was collected for, or where you withdraw consent.
          </li>
          <li>
            Withdraw consent you previously gave, with the same ease as giving
            it. Withdrawing consent that the service depends on may mean the
            account can no longer be used.
          </li>
          <li>
            Nominate another person to exercise your rights in the event of death
            or incapacity.
          </li>
          <li>
            Raise a grievance with us, and escalate to the Data Protection Board
            of India if our response does not satisfy you.
          </li>
        </ul>
        <p>
          To exercise any of these, write to our Grievance Officer below. If your
          data was entered by a coaching institute, we will route the request to
          that institute, since they control the record.
        </p>
      </Section>

      <Section heading="10. Grievance Officer">
        <p>
          A named grievance contact is mandatory under the DPDP Act and the IT
          (Intermediary Guidelines) Rules. Ours is:
        </p>
        <ul>
          <li>
            <strong>Name:</strong>{" "}
            <Todo>full name of the designated officer</Todo>
          </li>
          <li>
            <strong>Designation:</strong>{" "}
            <Todo>Grievance Officer, or Data Protection Officer</Todo>
          </li>
          <li>
            <strong>Email:</strong>{" "}
            <Todo>a monitored address, for example grievance@gyaanverse.com</Todo>
          </li>
          <li>
            <strong>Postal address:</strong>{" "}
            <Todo>address for written complaints</Todo>
          </li>
          <li>
            <strong>Response time:</strong> we acknowledge complaints within 24
            hours and aim to resolve them within 15 days.
          </li>
        </ul>
        <p>
          If we do not resolve your grievance satisfactorily, you may escalate to
          the Data Protection Board of India.
        </p>
      </Section>

      <Section heading="11. How we protect data">
        <ul>
          <li>Traffic is encrypted in transit with TLS.</li>
          <li>
            Passwords are stored only as salted hashes, never in readable form.
          </li>
          <li>
            Every institute&apos;s data is isolated by tenant, and requests are
            checked against the tenant they belong to.
          </li>
          <li>
            Access to production systems is limited to the people who need it.
          </li>
          <li>We take regular database backups.</li>
        </ul>
        <p>
          No system is perfectly secure. If a breach affects your personal data,
          we will notify you and the Data Protection Board as the DPDP Act
          requires.
        </p>
      </Section>

      <Section heading="12. Changes to this policy">
        <p>
          If we change this policy, we will update the date at the top of this
          page and, where the change materially affects you, notify account
          holders by email.
        </p>
      </Section>
    </LegalPage>
  );
}
