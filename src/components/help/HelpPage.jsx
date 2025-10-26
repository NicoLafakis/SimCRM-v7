import React, { useState } from 'react'

export default function HelpPage({ onBack, playPlunk }) {
  const [activeSection, setActiveSection] = useState('getting-started')

  const handleBack = () => {
    playPlunk?.()
    onBack?.()
  }

  const scrollToSection = (sectionId) => {
    playPlunk?.()
    setActiveSection(sectionId)
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="help-page">
      <div className="help-container">
        <button className="hs-back-btn" onClick={handleBack}>← Back</button>

        <h1 className="help-title">SimCRM Help Center</h1>
        <p className="help-subtitle">Your complete guide to mastering SimCRM v7</p>

        <nav className="help-nav">
          <button
            className={activeSection === 'getting-started' ? 'active' : ''}
            onClick={() => scrollToSection('getting-started')}
          >
            Getting Started
          </button>
          <button
            className={activeSection === 'features' ? 'active' : ''}
            onClick={() => scrollToSection('features')}
          >
            Features
          </button>
          <button
            className={activeSection === 'scenarios' ? 'active' : ''}
            onClick={() => scrollToSection('scenarios')}
          >
            Scenarios
          </button>
          <button
            className={activeSection === 'distributions' ? 'active' : ''}
            onClick={() => scrollToSection('distributions')}
          >
            Distributions
          </button>
          <button
            className={activeSection === 'troubleshooting' ? 'active' : ''}
            onClick={() => scrollToSection('troubleshooting')}
          >
            Troubleshooting
          </button>
        </nav>

        <div className="help-content">
          {/* Getting Started */}
          <section id="getting-started" className="help-section">
            <h2>Getting Started</h2>

            <h3>What is SimCRM?</h3>
            <p>
              SimCRM v7 is a HubSpot CRM simulation platform that generates realistic test data for development,
              testing, and demonstration purposes. Create contacts, companies, deals, and activities with
              configurable timing and distribution patterns.
            </p>

            <h3>Quick Start Guide</h3>
            <ol className="help-steps">
              <li>
                <strong>Create Your Account</strong>
                <p>Sign up with your player name, email, company name, and a secure password.</p>
              </li>
              <li>
                <strong>Complete Verification</strong>
                <p>Play the Tetris mini-game to verify your account (reach 1000 points or survive 90 seconds).</p>
              </li>
              <li>
                <strong>Connect HubSpot</strong>
                <p>
                  Provide your HubSpot Private App token. Your token is encrypted and stored securely.
                  <br />
                  <a href="https://knowledge.hubspot.com/integrations/how-do-i-get-my-hubspot-api-key#create-a-private-app-and-api-key" target="_blank" rel="noopener noreferrer">
                    → How to create a HubSpot Private App
                  </a>
                </p>
              </li>
              <li>
                <strong>Configure Your Simulation</strong>
                <p>Select scenario, distribution method, timing parameters, and HubSpot settings.</p>
              </li>
              <li>
                <strong>Run Simulation</strong>
                <p>Review your configuration and start the simulation. Monitor progress in real-time.</p>
              </li>
              <li>
                <strong>Cleanup</strong>
                <p>When finished, use cleanup scripts to remove simulation data from HubSpot.</p>
              </li>
            </ol>

            <h3>Required HubSpot Scopes</h3>
            <p>Your HubSpot Private App must have these scopes:</p>
            <ul className="help-list">
              <li><code>crm.objects.contacts.write</code> - Create and manage contacts</li>
              <li><code>crm.objects.companies.write</code> - Create and manage companies</li>
              <li><code>crm.objects.deals.write</code> - Create and manage deals</li>
              <li><code>crm.schemas.deals.read</code> - Read pipeline and stage information</li>
            </ul>
          </section>

          {/* Features */}
          <section id="features" className="help-section">
            <h2>Features</h2>

            <h3>Scenario-Based Simulations</h3>
            <p>
              Choose from pre-configured scenarios that determine record volume, deal win rates, and
              interaction patterns:
            </p>
            <ul className="help-list">
              <li><strong>B2B Enterprise:</strong> Low volume, high-value deals, long sales cycles</li>
              <li><strong>B2B Mid-Market:</strong> Moderate volume, balanced win rates</li>
              <li><strong>B2C E-Commerce:</strong> High volume, lower deal values, fast conversions</li>
              <li><strong>SaaS Startup:</strong> Mixed patterns with growth trajectory</li>
            </ul>

            <h3>Distribution Methods</h3>
            <p>Control when records are created over the simulation duration:</p>
            <ul className="help-list">
              <li><strong>Linear:</strong> Constant rate throughout duration</li>
              <li><strong>Bell Curve:</strong> Peak activity in the middle</li>
              <li><strong>Front-Loaded:</strong> Heavy activity at start, tapering off</li>
              <li><strong>Back-Loaded:</strong> Light start, heavy finish</li>
              <li><strong>Trickle:</strong> Slow, consistent inflow</li>
              <li><strong>Random Bursts:</strong> Irregular clusters of activity</li>
              <li><strong>Daily Spike:</strong> Repeating daily peaks (24-hour cycle)</li>
              <li><strong>Weekend Surge:</strong> Higher activity on weekends</li>
            </ul>

            <h3>Timing Configuration</h3>
            <ul className="help-list">
              <li><strong>Total Records:</strong> 1-10,000 primary records</li>
              <li><strong>Duration:</strong> 0 days to 30 days</li>
              <li><strong>Start Delay:</strong> Delay before simulation begins (0-3600 seconds)</li>
              <li><strong>Jitter:</strong> Random variance in timing (0-50%)</li>
              <li><strong>Concurrency:</strong> Parallel job processing (1-10 workers)</li>
            </ul>

            <h3>HubSpot Configuration</h3>
            <ul className="help-list">
              <li><strong>Pipeline Selection:</strong> Choose which deal pipeline to use</li>
              <li><strong>Owner Assignment:</strong> Distribute records across selected owners</li>
              <li><strong>Deterministic RNG:</strong> Consistent owner selection using seeded random numbers</li>
            </ul>

            <h3>Record Creation</h3>
            <p>Each simulation creates:</p>
            <ul className="help-list">
              <li><strong>Contacts:</strong> With realistic names, emails, lifecycle stages</li>
              <li><strong>Companies:</strong> Associated with each contact</li>
              <li><strong>Deals:</strong> Probabilistic based on scenario win rate</li>
              <li><strong>Activities:</strong> Notes, calls, tasks (coming in future phases)</li>
            </ul>
          </section>

          {/* Scenarios */}
          <section id="scenarios" className="help-section">
            <h2>Understanding Scenarios</h2>

            <h3>What Are Scenarios?</h3>
            <p>
              Scenarios are pre-configured parameter sets that simulate different business models and customer
              behavior patterns. Each scenario adjusts record volume, deal probability, and interaction timing.
            </p>

            <h3>Scenario Types</h3>

            <div className="help-scenario">
              <h4>B2B Enterprise</h4>
              <p><strong>Best For:</strong> Testing enterprise sales processes</p>
              <ul>
                <li>Volume Multiplier: 0.5x (fewer, high-quality leads)</li>
                <li>Deal Win Rate: 60-70%</li>
                <li>Deal Value: $25,000 - $150,000</li>
                <li>Sales Cycle: Long (60-120 days typical)</li>
              </ul>
            </div>

            <div className="help-scenario">
              <h4>B2B Mid-Market</h4>
              <p><strong>Best For:</strong> General B2B workflows</p>
              <ul>
                <li>Volume Multiplier: 1x (baseline)</li>
                <li>Deal Win Rate: 40-50%</li>
                <li>Deal Value: $10,000 - $50,000</li>
                <li>Sales Cycle: Medium (30-60 days)</li>
              </ul>
            </div>

            <div className="help-scenario">
              <h4>B2C E-Commerce</h4>
              <p><strong>Best For:</strong> High-volume consumer businesses</p>
              <ul>
                <li>Volume Multiplier: 3x (high lead volume)</li>
                <li>Deal Win Rate: 15-25%</li>
                <li>Deal Value: $50 - $500</li>
                <li>Sales Cycle: Very short (same day)</li>
              </ul>
            </div>

            <div className="help-scenario">
              <h4>SaaS Startup</h4>
              <p><strong>Best For:</strong> Testing growth patterns</p>
              <ul>
                <li>Volume Multiplier: 1.5x (growth mode)</li>
                <li>Deal Win Rate: 30-40%</li>
                <li>Deal Value: $500 - $5,000 MRR</li>
                <li>Sales Cycle: Short-Medium (7-21 days)</li>
              </ul>
            </div>
          </section>

          {/* Distributions */}
          <section id="distributions" className="help-section">
            <h2>Distribution Methods Explained</h2>

            <h3>Choosing the Right Distribution</h3>
            <p>
              Distribution methods control the timing pattern of record creation. Choose based on what
              you want to simulate:
            </p>

            <div className="help-dist">
              <h4>Linear</h4>
              <p>
                <strong>Use When:</strong> Testing consistent, steady inflow<br />
                <strong>Pattern:</strong> Even spacing throughout duration<br />
                <strong>Example:</strong> Steady marketing campaign with consistent ad spend
              </p>
            </div>

            <div className="help-dist">
              <h4>Bell Curve</h4>
              <p>
                <strong>Use When:</strong> Simulating event-based campaigns<br />
                <strong>Pattern:</strong> Low at start, peak in middle, taper at end<br />
                <strong>Example:</strong> Conference lead generation, product launch
              </p>
            </div>

            <div className="help-dist">
              <h4>Front-Loaded</h4>
              <p>
                <strong>Use When:</strong> Testing initial surge scenarios<br />
                <strong>Pattern:</strong> Heavy activity early, declining over time<br />
                <strong>Example:</strong> Black Friday sale, new feature announcement
              </p>
            </div>

            <div className="help-dist">
              <h4>Random Bursts</h4>
              <p>
                <strong>Use When:</strong> Simulating unpredictable traffic<br />
                <strong>Pattern:</strong> 3-7 random clusters of activity<br />
                <strong>Example:</strong> Viral social media posts, PR coverage
              </p>
            </div>

            <div className="help-dist">
              <h4>Daily Spike</h4>
              <p>
                <strong>Use When:</strong> Testing time-of-day patterns<br />
                <strong>Pattern:</strong> Repeating 24-hour peaks<br />
                <strong>Example:</strong> Business hours activity, daily webinars
              </p>
            </div>

            <div className="help-dist">
              <h4>Weekend Surge</h4>
              <p>
                <strong>Use When:</strong> Simulating B2C weekend traffic<br />
                <strong>Pattern:</strong> 30% higher volume on Saturdays/Sundays<br />
                <strong>Example:</strong> Retail websites, leisure products
              </p>
            </div>
          </section>

          {/* Troubleshooting */}
          <section id="troubleshooting" className="help-section">
            <h2>Troubleshooting</h2>

            <h3>Common Issues</h3>

            <div className="help-trouble">
              <h4>Simulation Not Starting</h4>
              <ul>
                <li>Verify your HubSpot token is valid and has required scopes</li>
                <li>Check that Redis and worker services are running</li>
                <li>Look for errors in the simulation progress view</li>
              </ul>
            </div>

            <div className="help-trouble">
              <h4>Records Not Appearing in HubSpot</h4>
              <ul>
                <li>Confirm SIM_REAL_MODE=1 in server environment (.env file)</li>
                <li>Check HubSpot API rate limits haven't been exceeded</li>
                <li>Verify selected pipeline exists and is active</li>
                <li>Check that selected owners have appropriate permissions</li>
              </ul>
            </div>

            <div className="help-trouble">
              <h4>Simulation Running Slowly</h4>
              <ul>
                <li>HubSpot rate limiting may be in effect (automatic retries will occur)</li>
                <li>Increase concurrency setting for faster processing</li>
                <li>Check network connectivity between server and HubSpot</li>
              </ul>
            </div>

            <div className="help-trouble">
              <h4>Token Encryption Errors</h4>
              <ul>
                <li>Ensure TOKEN_ENC_SECRET is set in server .env file</li>
                <li>Secret must be at least 32 characters for AES-256</li>
                <li>Re-enter HubSpot token if secret was changed</li>
              </ul>
            </div>

            <h3>Cleanup Process</h3>
            <p>To remove simulation data from HubSpot:</p>
            <ol className="help-steps">
              <li>
                <strong>Dry Run First</strong>
                <pre><code>node scripts/cleanup-hubspot.js --simulation-id=YOUR_SIM_ID --dry-run</code></pre>
              </li>
              <li>
                <strong>Execute Cleanup</strong>
                <pre><code>node scripts/cleanup-hubspot.js --simulation-id=YOUR_SIM_ID</code></pre>
              </li>
              <li>
                <strong>Verify Deletion</strong>
                <p>Check HubSpot portal to confirm records are removed</p>
              </li>
            </ol>

            <h3>Getting Support</h3>
            <p>
              If you need additional help:
            </p>
            <ul className="help-list">
              <li><strong>Email:</strong> support@simcrm.app</li>
              <li><strong>Documentation:</strong> Check the FAQ page for common questions</li>
              <li><strong>GitHub:</strong> Report bugs or request features</li>
            </ul>
          </section>

          <div className="help-footer">
            <p>
              Need more help? <a href="#" onClick={(e) => { e.preventDefault(); scrollToSection('getting-started') }}>
                Return to Getting Started
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
