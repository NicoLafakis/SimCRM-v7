import React from 'react'

export default function PrivacyPolicy({ onBack, playPlunk }) {
  const handleBack = () => {
    playPlunk?.()
    onBack?.()
  }

  return (
    <div className="legal-page">
      <div className="legal-container">
        <button className="hs-back-btn" onClick={handleBack}>← Back</button>

        <h1 className="legal-title">Privacy Policy</h1>
        <p className="legal-updated">Last Updated: October 26, 2025</p>

        <div className="legal-content">
          <section>
            <h2>1. Introduction</h2>
            <p>
              Black Maige ("we", "us", "our") operates SimCRM (the "Service"). This Privacy Policy explains
              how we collect, use, disclose, and safeguard your information when you use our Service.
            </p>
            <p>
              <strong>Please read this privacy policy carefully. If you do not agree with the terms of this
              privacy policy, please do not access the Service.</strong>
            </p>
          </section>

          <section>
            <h2>2. Information We Collect</h2>

            <h3>2.1 Personal Information</h3>
            <p>We collect the following personal information when you register:</p>
            <ul>
              <li><strong>Player Name:</strong> Your chosen username for the Service</li>
              <li><strong>Email Address:</strong> Used for account identification and communication</li>
              <li><strong>Company Name:</strong> Your organization name</li>
              <li><strong>Password:</strong> Stored using scrypt hashing (we never store plain-text passwords)</li>
            </ul>

            <h3>2.2 HubSpot Integration Data</h3>
            <ul>
              <li><strong>HubSpot Private App Tokens:</strong> Encrypted using AES-256 encryption with a server-side secret</li>
              <li><strong>Pipeline IDs:</strong> Selected HubSpot pipelines for simulations</li>
              <li><strong>Owner IDs:</strong> Selected HubSpot user IDs for record assignment</li>
            </ul>

            <h3>2.3 Simulation Data</h3>
            <ul>
              <li><strong>Simulation Configurations:</strong> Scenario parameters, distribution methods, timing settings</li>
              <li><strong>Job History:</strong> Records of simulations run, including status and completion data</li>
              <li><strong>Queue Metadata:</strong> Redis-based job queue data for active simulations</li>
            </ul>

            <h3>2.4 Technical Information</h3>
            <ul>
              <li><strong>IP Addresses:</strong> For security and fraud prevention</li>
              <li><strong>Browser Information:</strong> User agent, device type for compatibility</li>
              <li><strong>Session Data:</strong> JWT tokens for authentication (stored in browser localStorage)</li>
            </ul>
          </section>

          <section>
            <h2>3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide, operate, and maintain the Service</li>
              <li>Authenticate your identity and manage your account</li>
              <li>Execute simulations in your connected HubSpot portal</li>
              <li>Monitor and analyze usage patterns to improve the Service</li>
              <li>Respond to your comments, questions, and support requests</li>
              <li>Send you technical notices, updates, and security alerts</li>
              <li>Detect, prevent, and address technical issues and security threats</li>
            </ul>
          </section>

          <section>
            <h2>4. Data Security</h2>
            <p>We implement multiple security layers to protect your information:</p>

            <h3>4.1 Encryption</h3>
            <ul>
              <li><strong>Passwords:</strong> Hashed using scrypt with salt</li>
              <li><strong>HubSpot Tokens:</strong> Encrypted using AES-256-GCM</li>
              <li><strong>Transit:</strong> All connections use HTTPS/TLS</li>
            </ul>

            <h3>4.2 Authentication</h3>
            <ul>
              <li><strong>JWT Tokens:</strong> 6-hour expiration with secure secret</li>
              <li><strong>Password Requirements:</strong> Minimum 8 characters, uppercase, lowercase, number/special character</li>
              <li><strong>Verification:</strong> Tetris mini-game verification for new accounts</li>
            </ul>

            <h3>4.3 Access Controls</h3>
            <ul>
              <li><strong>Role-Based Access:</strong> Player and Boss (admin) roles with different permissions</li>
              <li><strong>User Isolation:</strong> Users can only access their own simulations and data</li>
            </ul>

            <p className="security-notice">
              <strong>Note:</strong> No method of transmission over the Internet or electronic storage is 100%
              secure. While we strive to use commercially acceptable means to protect your personal information,
              we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2>5. Data Sharing and Disclosure</h2>
            <p>
              <strong>We do not sell, trade, or rent your personal information to third parties.</strong>
            </p>
            <p>We may disclose your information only in the following circumstances:</p>
            <ul>
              <li><strong>With Your Consent:</strong> When you explicitly authorize us to share information</li>
              <li><strong>HubSpot API:</strong> Your encrypted token is used to make API calls to HubSpot on your behalf</li>
              <li><strong>Legal Requirements:</strong> If required by law, regulation, or legal process</li>
              <li><strong>Service Protection:</strong> To enforce our Terms of Service or protect our rights, property, or safety</li>
            </ul>
          </section>

          <section>
            <h2>6. Data Retention</h2>
            <p>We retain your information for as long as your account is active or as needed to provide the Service:</p>
            <ul>
              <li><strong>Account Data:</strong> Retained until account deletion</li>
              <li><strong>Simulation History:</strong> Retained until you manually delete it via cleanup scripts</li>
              <li><strong>Queue Data:</strong> Redis data expires automatically after job completion</li>
              <li><strong>Logs:</strong> System logs may be retained for up to 90 days for debugging and security purposes</li>
            </ul>
          </section>

          <section>
            <h2>7. Your Privacy Rights</h2>
            <p>You have the following rights regarding your personal information:</p>

            <h3>7.1 Access and Portability</h3>
            <p>You can access your account information through the Profile page.</p>

            <h3>7.2 Correction</h3>
            <p>You can update your player name, email, and company name through your Profile settings.</p>

            <h3>7.3 Deletion</h3>
            <p>You can request account deletion by contacting us at support@simcrm.app. We will delete your
            personal information within 30 days, except where retention is required by law.</p>

            <h3>7.4 Data Export</h3>
            <p>You can request a copy of your simulation data by contacting us.</p>

            <h3>7.5 Opt-Out</h3>
            <p>You can opt out of non-essential communications through your Profile settings.</p>
          </section>

          <section>
            <h2>8. Cookies and Tracking</h2>
            <p>We use the following browser storage mechanisms:</p>
            <ul>
              <li><strong>localStorage:</strong> Stores JWT authentication tokens and UI preferences (plunk volume)</li>
              <li><strong>Session Data:</strong> Temporary session information cleared when you close your browser</li>
            </ul>
            <p>We do not use third-party tracking cookies or analytics services.</p>
          </section>

          <section>
            <h2>9. Third-Party Services</h2>
            <p>The Service integrates with:</p>
            <ul>
              <li><strong>HubSpot:</strong> CRM platform where simulations are executed. Review HubSpot's privacy
              policy at https://legal.hubspot.com/privacy-policy</li>
              <li><strong>Redis:</strong> Self-hosted job queue (no data leaves our infrastructure)</li>
              <li><strong>MySQL:</strong> Self-hosted database (no data leaves our infrastructure)</li>
            </ul>
          </section>

          <section>
            <h2>10. Children's Privacy</h2>
            <p>
              The Service is not intended for children under 13 years of age. We do not knowingly collect
              personal information from children under 13. If you become aware that a child has provided
              us with personal information, please contact us immediately.
            </p>
          </section>

          <section>
            <h2>11. International Data Transfers</h2>
            <p>
              Your information may be transferred to and maintained on servers located outside of your state,
              province, country, or other governmental jurisdiction where data protection laws may differ.
              By using the Service, you consent to this transfer.
            </p>
          </section>

          <section>
            <h2>12. Changes to This Privacy Policy</h2>
            <p>
              We may update our Privacy Policy from time to time. We will notify you of any changes by updating
              the "Last Updated" date at the top of this Privacy Policy. You are advised to review this Privacy
              Policy periodically for any changes.
            </p>
          </section>

          <section>
            <h2>13. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, please contact us:
            </p>
            <p className="legal-contact">
              <strong>Black Maige</strong><br />
              Email: support@simcrm.app<br />
              Website: https://simcrm.app<br />
              Privacy Inquiries: privacy@simcrm.app
            </p>
          </section>

          <div className="legal-acknowledgment">
            <p>
              <strong>By using SimCRM, you acknowledge that you have read and understood this Privacy Policy
              and agree to its terms.</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
