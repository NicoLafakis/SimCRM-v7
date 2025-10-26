import React from 'react'

export default function TermsOfService({ onBack, playPlunk }) {
  const handleBack = () => {
    playPlunk?.()
    onBack?.()
  }

  return (
    <div className="legal-page">
      <div className="legal-container">
        <button className="hs-back-btn" onClick={handleBack}>← Back</button>

        <h1 className="legal-title">Terms of Service</h1>
        <p className="legal-updated">Last Updated: October 26, 2025</p>

        <div className="legal-content">
          <section>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing and using SimCRM ("the Service"), you accept and agree to be bound by the terms
              and provisions of this agreement. If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section>
            <h2>2. Description of Service</h2>
            <p>
              SimCRM is a simulation platform that generates realistic test data in HubSpot CRM for development,
              testing, and demonstration purposes. The Service creates contacts, companies, deals, and related
              activities based on user-configured scenarios and distributions.
            </p>
          </section>

          <section>
            <h2>3. User Accounts and Registration</h2>
            <p>
              <strong>3.1 Account Creation:</strong> To use SimCRM, you must create an account by providing
              a player name, email address, company name, and password that meets our security requirements.
            </p>
            <p>
              <strong>3.2 Account Security:</strong> You are responsible for maintaining the confidentiality
              of your account credentials. You agree to notify us immediately of any unauthorized access to
              your account.
            </p>
            <p>
              <strong>3.3 Verification:</strong> New accounts must complete a verification process (Tetris
              mini-game) before accessing the full Service.
            </p>
          </section>

          <section>
            <h2>4. HubSpot Integration</h2>
            <p>
              <strong>4.1 Private App Tokens:</strong> You must provide a valid HubSpot Private App token
              to use the Service. Tokens are encrypted and stored securely using AES-256 encryption.
            </p>
            <p>
              <strong>4.2 Data Creation:</strong> The Service creates records in your HubSpot portal. You
              are responsible for understanding the impact of these operations on your HubSpot account,
              including any costs associated with record creation and API usage.
            </p>
            <p>
              <strong>4.3 Cleanup:</strong> You are responsible for cleaning up simulation data from your
              HubSpot portal. We provide cleanup scripts, but you must execute them.
            </p>
          </section>

          <section>
            <h2>5. Acceptable Use</h2>
            <p>You agree NOT to:</p>
            <ul>
              <li>Use the Service to create spam or unwanted communications</li>
              <li>Generate excessive API calls that violate HubSpot's rate limits</li>
              <li>Share your account credentials with unauthorized parties</li>
              <li>Attempt to reverse engineer or exploit the Service</li>
              <li>Use the Service for any illegal purposes</li>
              <li>Create simulations in production HubSpot portals without proper safeguards</li>
            </ul>
          </section>

          <section>
            <h2>6. Data and Privacy</h2>
            <p>
              <strong>6.1 Data Collection:</strong> We collect and store your player name, email, company name,
              encrypted HubSpot tokens, and simulation configurations. See our Privacy Policy for details.
            </p>
            <p>
              <strong>6.2 Data Security:</strong> We implement industry-standard security measures including
              password hashing (scrypt), token encryption (AES-256), and JWT-based authentication.
            </p>
            <p>
              <strong>6.3 Data Retention:</strong> Simulation data is retained until you delete it using
              our cleanup tools or by deleting your account.
            </p>
          </section>

          <section>
            <h2>7. Service Availability</h2>
            <p>
              <strong>7.1 Uptime:</strong> We strive to maintain high availability but do not guarantee
              uninterrupted access. The Service may be temporarily unavailable for maintenance or updates.
            </p>
            <p>
              <strong>7.2 Modifications:</strong> We reserve the right to modify, suspend, or discontinue
              the Service at any time without notice.
            </p>
          </section>

          <section>
            <h2>8. Limitations of Liability</h2>
            <p>
              <strong>8.1 No Warranty:</strong> The Service is provided "AS IS" without warranties of any kind,
              either express or implied. We do not guarantee that the Service will meet your requirements or
              be error-free.
            </p>
            <p>
              <strong>8.2 Liability Cap:</strong> To the maximum extent permitted by law, Black Maige shall
              not be liable for any indirect, incidental, special, consequential, or punitive damages resulting
              from your use of the Service.
            </p>
            <p>
              <strong>8.3 HubSpot Impact:</strong> You acknowledge that simulation data may impact your HubSpot
              portal's performance, storage limits, and API quotas. We are not responsible for any costs or
              issues arising from simulations you create.
            </p>
          </section>

          <section>
            <h2>9. Intellectual Property</h2>
            <p>
              The Service, including its original content, features, and functionality, is owned by Black Maige
              and is protected by international copyright, trademark, and other intellectual property laws.
            </p>
          </section>

          <section>
            <h2>10. Termination</h2>
            <p>
              <strong>10.1 By You:</strong> You may terminate your account at any time by contacting us or
              using the account deletion feature (when available).
            </p>
            <p>
              <strong>10.2 By Us:</strong> We reserve the right to terminate or suspend your account immediately,
              without prior notice, if you violate these Terms or engage in fraudulent or illegal activity.
            </p>
            <p>
              <strong>10.3 Effect of Termination:</strong> Upon termination, your right to use the Service
              will immediately cease. We may delete your account data in accordance with our data retention policy.
            </p>
          </section>

          <section>
            <h2>11. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify users of material changes
              by updating the "Last Updated" date at the top of this document. Your continued use of the Service
              after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2>12. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws applicable in your
              jurisdiction, without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2>13. Contact Information</h2>
            <p>
              If you have any questions about these Terms, please contact us at:
            </p>
            <p className="legal-contact">
              <strong>Black Maige</strong><br />
              Email: support@simcrm.app<br />
              Website: https://simcrm.app
            </p>
          </section>

          <section>
            <h2>14. Entire Agreement</h2>
            <p>
              These Terms, together with our Privacy Policy, constitute the entire agreement between you and
              Black Maige regarding the use of the Service and supersede any prior agreements.
            </p>
          </section>

          <div className="legal-acknowledgment">
            <p>
              <strong>By using SimCRM, you acknowledge that you have read, understood, and agree to be bound
              by these Terms of Service.</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
