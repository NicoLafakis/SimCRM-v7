// Whitelist of writable HubSpot properties per object type.
// Seeded from docs/record-creation-rules.md — keep in sync with that doc.
module.exports = {
  contacts: [
    'firstname','lastname','email','phone','mobilephone','jobtitle','salutation','website',
    'address','city','state','zip','country',
    'lifecyclestage','hs_lead_status','hs_marketable_status','hs_content_membership_status','lead_source'
  ],
  companies: [
    'name','domain','phone','description','address','city','state','zip','country','industry','numberofemployees','annualrevenue','founded_year','lifecyclestage','hubspot_owner_id','is_public','linkedin_company_page'
  ],
  deals: [
    'dealname','pipeline','dealstage','amount','closedate','dealtype','hubspot_owner_id','description','closed_lost_reason','closed_won_reason'
  ],
  tickets: [
    'subject','content','hs_pipeline','hs_pipeline_stage','hubspot_owner_id','hs_ticket_priority','hs_ticket_category','source_thread_id'
  ],
  invoices: [
    'hs_title','hs_amount','hs_status','hs_invoice_number'
  ],
  engagements: {
    note: ['hs_timestamp','hs_note_body','hubspot_owner_id','hs_attachment_ids'],
    call: ['hs_timestamp','hs_call_body','hs_call_duration','hs_call_from_number','hs_call_to_number','hs_call_status','hs_call_title','hubspot_owner_id'],
    task: ['hs_timestamp','hs_task_subject','hs_task_body','hs_task_status','hs_task_priority','hubspot_owner_id']
  }
}
