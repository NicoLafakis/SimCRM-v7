import React, { useState } from 'react'

export default function FAQPage({ onBack, playPlunk }) {
  const [openFAQ, setOpenFAQ] = useState(null)

  const handleBack = () => {
    playPlunk?.()
    onBack?.()
  }

  const toggleFAQ = (id) => {
    playPlunk?.()
    setOpenFAQ(openFAQ === id ? null : id)
  }

  const faqs = [
    {
      id: 'what-is-simcrm',
      category: 'General',
      question: 'What is SimCRM and why would I use it?',
      answer: `SimCRM is a HubSpot simulation platform that creates realistic test data in your CRM. Use it for:

• Testing workflows and automation before going live
• Creating demo environments for sales presentations
• Training new team members with realistic data
• Developing and testing HubSpot integrations
• Load testing your HubSpot portal configuration`
    },
    {
      id: 'safe-to-use',
      category: 'General',
      question: 'Is it safe to use SimCRM with my production HubSpot portal?',
      answer: `SimCRM is designed for TEST environments. While it uses HubSpot's official APIs and implements rate limiting, we recommend:

• Use a dedicated test/sandbox HubSpot portal
• Start with small simulations (10-50 records) to verify behavior
• Always run cleanup scripts after testing
• Monitor your HubSpot API usage limits

If you must use it in production, start with minimal records and verify the cleanup process works correctly.`
    },
    {
      id: 'cost',
      category: 'General',
      question: 'Does SimCRM cost money? Will it use my HubSpot API limits?',
      answer: `SimCRM itself is free to use. However:

• HubSpot API calls count toward your portal's limits
• Creating records uses your HubSpot storage allocation
• Large simulations may trigger HubSpot rate limits (automatic retries will occur)

We recommend checking your HubSpot subscription's API limits before running large simulations.`
    },
    {
      id: 'how-many-records',
      category: 'Usage',
      question: 'How many records should I create in my first simulation?',
      answer: `Start small! We recommend:

• First simulation: 5-10 records (test the full flow)
• Second simulation: 50-100 records (verify timing and distribution)
• Production-scale: 500-1000+ records (once confident)

Remember: 1 primary record = 1 contact + 1 company + (probabilistic) 1 deal. A 100-record simulation might create 200-300 total objects in HubSpot.`
    },
    {
      id: 'duration-zero',
      category: 'Usage',
      question: 'What happens if I set duration to 0 days?',
      answer: `Zero duration means all records are created immediately (or as fast as HubSpot's rate limits allow).

This is useful for:
• Quickly populating a test environment
• Creating baseline data for testing
• One-time demo setups

For realistic time-based simulations, use 1+ hours to see distribution patterns in action.`
    },
    {
      id: 'distributions',
      category: 'Usage',
      question: 'Which distribution method should I choose?',
      answer: `Choose based on what you're simulating:

• Linear: Steady marketing campaigns
• Bell Curve: Event-based campaigns (conferences, webinars)
• Front-Loaded: Product launches, major promotions
• Back-Loaded: End-of-quarter sales pushes
• Random Bursts: Viral campaigns, PR spikes
• Daily Spike: Business-hours activity patterns
• Weekend Surge: B2C weekend traffic

For general testing, Linear is a safe default.`
    },
    {
      id: 'scenarios',
      category: 'Usage',
      question: 'What's the difference between B2B and B2C scenarios?',
      answer: `Scenarios adjust record volumes and deal characteristics:

B2B (Enterprise/Mid-Market):
• Lower volume, higher quality leads
• Higher deal values ($10k-$150k+)
• Higher win rates (40-70%)
• Longer sales cycles

B2C (E-Commerce):
• High lead volume (3x baseline)
• Lower deal values ($50-$500)
• Lower win rates (15-25%)
• Very short sales cycles

Choose the scenario that matches your actual business model for realistic test data.`
    },
    {
      id: 'pipeline-owners',
      category: 'HubSpot',
      question: 'Do I need to select a pipeline and owners?',
      answer: `Not required, but recommended:

• Pipeline: If not selected, deals use your portal's default pipeline
• Owners: If not selected, records won't have an assigned owner

Selecting owners is important if you're testing:
• Lead distribution rules
• Owner-based workflows
• Team performance dashboards
• Round-robin assignment

SimCRM uses deterministic random selection to distribute records evenly across selected owners.`
    },
    {
      id: 'token-security',
      category: 'Security',
      question: 'How secure is my HubSpot token?',
      answer: `Your token is protected with multiple security layers:

• Encrypted with AES-256-GCM before storage
• Server-side encryption secret (not in your browser)
• Never transmitted in plain text
• Used only for API calls to HubSpot on your behalf
• Not shared with any third parties

We recommend creating a dedicated Private App token with minimal scopes for SimCRM rather than using a personal API key.`
    },
    {
      id: 'password-requirements',
      category: 'Security',
      question: 'Why are password requirements so strict?',
      answer: `Security is critical since SimCRM has access to your HubSpot portal. Required:

• Minimum 8 characters
• At least one uppercase letter
• At least one lowercase letter
• At least one number or special character

Passwords are hashed using scrypt (industry-standard) before storage. We never store passwords in plain text.`
    },
    {
      id: 'cleanup',
      category: 'Cleanup',
      question: 'How do I remove simulation data from HubSpot?',
      answer: `Use the cleanup scripts from your server:

1. Dry run first (preview what will be deleted):
   node scripts/cleanup-hubspot.js --simulation-id=YOUR_ID --dry-run

2. Execute cleanup:
   node scripts/cleanup-hubspot.js --simulation-id=YOUR_ID

3. Verify in HubSpot that records are gone

You can also cleanup by age:
   node scripts/cleanup-hubspot.js --older-than=7 --dry-run

Always dry-run first to avoid accidental deletions!`
    },
    {
      id: 'cleanup-database',
      category: 'Cleanup',
      question: 'How do I clean up old simulations from the database?',
      answer: `Use the database cleanup script:

Keep only recent simulations:
   node scripts/cleanup-database.js --keep-recent=10 --dry-run

Delete simulations older than X days:
   node scripts/cleanup-database.js --older-than=30 --dry-run

Delete by status:
   node scripts/cleanup-database.js --status=COMPLETED --dry-run

Remove dry-run flag to execute. Database cleanup doesn't affect HubSpot records.`
    },
    {
      id: 'simulation-stuck',
      category: 'Troubleshooting',
      question: 'My simulation is stuck at "RUNNING". What should I do?',
      answer: `Check these common causes:

1. Worker not running:
   • Start the worker: node server/worker.js

2. Redis not running:
   • Check Redis: redis-cli ping
   • Should respond with "PONG"

3. HubSpot rate limiting:
   • Check simulation logs for rate limit errors
   • Circuit breaker will pause and retry automatically

4. Invalid HubSpot token:
   • Re-enter your token in HubSpot Setup
   • Verify token has required scopes

5. Server errors:
   • Check server logs: tail -f server.log
   • Look for error messages

If stuck, you can mark it failed in the database and start a new simulation.`
    },
    {
      id: 'records-missing',
      category: 'Troubleshooting',
      question: 'Records show as created but don't appear in HubSpot. Why?',
      answer: `Most common cause: SIM_REAL_MODE not enabled

Check your server .env file:
   SIM_REAL_MODE=1

If it's set to 0 or missing, the system runs in test mode (no actual HubSpot writes).

Other causes:
• Wrong HubSpot portal connected (check your token)
• Records created but in a different pipeline
• HubSpot sync delay (wait 30-60 seconds)
• Records created then immediately deleted by workflows

Check the worker logs for "SIMULATING" vs "REAL MODE" messages.`
    },
    {
      id: 'tetris-verification',
      category: 'Account',
      question: 'I can't pass the Tetris verification. Help!',
      answer: `Verification requires either:
• Score 1000+ points, OR
• Survive 90 seconds

Tips:
• Use LEFT/RIGHT arrow keys to move
• DOWN arrow to drop faster
• UP arrow to rotate
• Complete rows to clear them and score points
• Speed increases over time
• Focus on survival over high scores

If you continue having issues, contact support@simcrm.app - we can manually verify your account.`
    },
    {
      id: 'forgot-password',
      category: 'Account',
      question: 'I forgot my password. How do I reset it?',
      answer: `Password reset functionality is coming soon!

For now, contact support@simcrm.app with:
• Your player name or email
• Verification of account ownership

We'll help you regain access. We apologize for the inconvenience and are working to add self-service password reset.`
    },
    {
      id: 'multiple-simulations',
      category: 'Usage',
      question: 'Can I run multiple simulations at once?',
      answer: `Yes! You can run multiple simulations simultaneously:

• Each simulation gets its own job queue segment
• Worker processes jobs from all active simulations
• Concurrency setting controls parallel processing within each simulation

Keep in mind:
• Multiple simulations share HubSpot API limits
• Worker processes all jobs in order (first-come, first-served)
• Large concurrent simulations may run slower due to rate limiting

For best performance, run one simulation at a time or use longer durations to spread load.`
    },
    {
      id: 'boss-role',
      category: 'Advanced',
      question: 'What is the "Boss" role and how do I get it?',
      answer: `Boss is an admin role with access to:
• Dead Letter Queue (DLQ) management
• Thinning events monitoring
• Prometheus metrics
• HubSpot readiness checks
• System diagnostics

Boss role is typically assigned to:
• System administrators
• DevOps engineers
• Technical team leads

To get Boss role, the "admin" user gets it automatically, or contact your system administrator to update the users.role field in the database.`
    },
    {
      id: 'api-limits',
      category: 'Advanced',
      question: 'How does SimCRM handle HubSpot API rate limits?',
      answer: `SimCRM implements a sophisticated rate limiting system:

• Token Bucket: Allows bursts while respecting average limits
• Circuit Breaker: Pauses when rate limits detected
• Exponential Backoff: Automatic retries with increasing delays
• DLQ (Dead Letter Queue): Failed jobs go to DLQ for replay

When rate limited:
• Jobs pause automatically
• Circuit breaker waits for cooldown period
• Jobs resume when limits reset
• No data loss - all jobs eventually process

You can monitor rate limiting in the Boss Dashboard (if you have Boss role).`
    },
    {
      id: 'custom-scenarios',
      category: 'Advanced',
      question: 'Can I create custom scenarios with my own parameters?',
      answer: `Custom scenarios coming in future version!

Currently, you can:
• Choose from pre-built scenarios (B2B, B2C, SaaS, etc.)
• Adjust timing parameters (duration, jitter, concurrency)
• Select distribution methods

Future capabilities planned:
• Custom deal win rates
• Custom deal value ranges
• Custom interaction frequencies
• Custom lifecycle stage progressions
• Import your own data templates

For now, choose the pre-built scenario closest to your needs and adjust timing/distribution to get desired results.`
    }
  ]

  const categories = ['General', 'Usage', 'HubSpot', 'Security', 'Cleanup', 'Troubleshooting', 'Account', 'Advanced']

  return (
    <div className="faq-page">
      <div className="faq-container">
        <button className="hs-back-btn" onClick={handleBack}>← Back</button>

        <h1 className="faq-title">Frequently Asked Questions</h1>
        <p className="faq-subtitle">Quick answers to common questions about SimCRM</p>

        <div className="faq-content">
          {categories.map(category => {
            const categoryFaqs = faqs.filter(faq => faq.category === category)
            if (categoryFaqs.length === 0) return null

            return (
              <div key={category} className="faq-category">
                <h2 className="faq-category-title">{category}</h2>
                {categoryFaqs.map(faq => (
                  <div key={faq.id} className={`faq-item ${openFAQ === faq.id ? 'open' : ''}`}>
                    <button
                      className="faq-question"
                      onClick={() => toggleFAQ(faq.id)}
                      aria-expanded={openFAQ === faq.id}
                    >
                      <span>{faq.question}</span>
                      <span className="faq-toggle">{openFAQ === faq.id ? '−' : '+'}</span>
                    </button>
                    {openFAQ === faq.id && (
                      <div className="faq-answer">
                        {faq.answer.split('\n').map((line, i) => (
                          <p key={i}>{line}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        <div className="faq-footer">
          <h3>Still have questions?</h3>
          <p>
            Contact us at <a href="mailto:support@simcrm.app">support@simcrm.app</a> or check the{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); handleBack() }}>Help Page</a> for detailed documentation.
          </p>
        </div>
      </div>
    </div>
  )
}
