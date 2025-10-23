## Here is a comprehensive list of writable fields you can populate for each object type in your SimCRM app, with a special focus on sales, marketing, and analytics data.

---

### Contacts
#### Basic Information
* `firstname`: The contact's first name.
* `lastname`: The contact's last name.
* `email`: The contact's primary email address.
* `phone`: Primary phone number.
* `mobilephone`: Mobile phone number.
* `jobtitle`: The contact's job title.
* `salutation`: "Mr.", "Ms.", etc.
* `website`: The contact's personal or company website.
* `linkedin_company_page`: URL of their company's LinkedIn page.

#### Location
* `address`: Street address.
* `city`: City of residence.
* `state`: State or region.
* `zip`: Postal code.
* `country`: Country.

#### Marketing & Analytics
* `lifecyclestage`: The stage in the marketing/sales funnel (e.g., `subscriber`, `lead`, `marketingqualifiedlead`, `salesqualifiedlead`, `opportunity`, `customer`).
* `hs_lead_status`: The specific status of a lead (e.g., 'NEW', 'OPEN', 'IN_PROGRESS', 'UNQUALIFIED').
* `hs_marketable_status`: Can be set to `true` if the contact has opted in to marketing communications.
* `hs_content_membership_status`: Status for content memberships.
* `lead_source`: Custom property you can create to track where the lead came from (e.g., "Organic Search", "Paid Social").


### Companies
#### Basic Information
* `name`: The legal name of the company.
* `domain`: The company's website domain.
* `phone`: The company's main phone number.
* `description`: A short description of the company.

#### Location & Demographics
* `address`, `city`, `state`, `zip`, `country`: Company's physical address.
* `industry`: The company's industry (e.g., "Technology", "Healthcare").
* `numberofemployees`: The number of people the company employs.
* `annualrevenue`: The company's annual revenue.
* `founded_year`: The year the company was founded.

#### Sales & Marketing
* `lifecyclestage`: The company's stage in the funnel (often mirrors the primary contact's stage).
* `hubspot_owner_id`: The ID of the HubSpot user who owns the company record.
* `is_public`: A boolean indicating if the company is publicly traded.
* `linkedin_company_page`: The URL of the company's LinkedIn profile.


### Deals
#### Core Deal Information
* `dealname`: A descriptive name for the deal (e.g., "Q4 Enterprise Upgrade").
* `pipeline`: The ID of the sales pipeline this deal belongs to.
* `dealstage`: The ID of the current stage within the pipeline.
* `amount`: The potential or actual monetary value of the deal.
* `closedate`: The expected or actual date the deal will close.
* `dealtype`: The type of deal (e.g., `newbusiness` or `existingbusiness`).
* `hubspot_owner_id`: The ID of the sales rep who owns the deal.

#### Sales Activity & Context
* `description`: Detailed notes about the deal.
* `closed_lost_reason`: A text field to explain why a deal was lost.
* `closed_won_reason`: A text field to explain why a deal was won.


### Tickets
#### Core Ticket Information
* `subject`: The title or summary of the support ticket.
* `content`: A detailed description of the customer's issue or request.
* `hs_pipeline`: The ID of the support pipeline the ticket belongs to.
* `hs_pipeline_stage`: The ID of the ticket's current status in the pipeline (e.g., 'New', 'Waiting on us', 'Waiting on customer', 'Closed').
* `hubspot_owner_id`: The ID of the support agent assigned to the ticket.

#### Service Details
* `hs_ticket_priority`: The priority level of the ticket (e.g., `HIGH`, `MEDIUM`, `LOW`).
* `hs_ticket_category`: The category of the ticket (e.g., 'Billing', 'Technical Support').
* `source_thread_id`: ID for tracking the source of the ticket.


### Engagements (Notes, Calls, Tasks)
#### Notes
* `hs_timestamp`: **Required**. The UTC millisecond timestamp for when the note was created.
* `hs_note_body`: **Required**. The text content of the note.
* `hubspot_owner_id`: The user ID of the person who created the note.
* `hs_attachment_ids`: A semicolon-separated list of file IDs to attach to the note.

#### Calls
* `hs_timestamp`: **Required**. The UTC millisecond timestamp for when the call occurred.
* `hs_call_body`: Notes or a description of the call.
* `hs_call_duration`: The duration of the call in milliseconds.
* `hs_call_from_number`: The phone number the call was made from.
* `hs_call_to_number`: The phone number the call was made to.
* `hs_call_status`: The outcome of the call (e.g., `COMPLETED`, `BUSY`, `NO_ANSWER`).
* `hs_call_title`: A subject or title for the call.
* `hubspot_owner_id`: The owner of the call record.

#### Tasks
* `hs_timestamp`: **Required**. The UTC millisecond timestamp for when the task is due.
* `hs_task_subject`: **Required**. The name or title of the task.
* `hs_task_body`: A detailed description of the task.
* `hs_task_status`: The current status of the task (e.g., `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`).
* `hs_task_priority`: The priority of the task (e.g., `HIGH`, `MEDIUM`, `LOW`).
* `hubspot_owner_id`: The user the task is assigned to.

---

## **Attempting to set these properties will not cause a `404 Not Found` error, but the API will silently ignore them or may return a `400 Bad Request` if the data type is incorrect. Excluding them ensures you are only sending writable data.**

### Universal Read-Only Properties
These apply to Contacts, Companies, Deals, and Tickets.
* `hs_object_id`: The unique ID for the record.
* `createdate`: The timestamp of when the record was created.
* `lastmodifieddate`: The timestamp of the last modification.
* `hs_user_ids_of_all_owners`: A list of all owner IDs assigned to the record.
* `hs_created_by_user_id`: The ID of the user who created the record.
* `hs_merged_object_ids`: A list of record IDs that have been merged into this record.
* `hs_last_modified_by_user_id`: The ID of the user who last modified the record.


### Contacts
Do not include the universal properties listed above, plus these contact-specific ones:
* `hs_email_domain`: The domain of the contact's email address, automatically parsed.
* `hs_is_contact`: A boolean that is always `true` for contacts.
* Any analytics properties (e.g., `hs_analytics_first_touch_converting_campaign`, `hs_analytics_source`, etc.) as these are set by HubSpot's tracking code.


### Companies
Do not include the universal properties, plus these company-specific ones:
* `hs_is_company`: A boolean that is always `true` for companies.
* Any analytics properties.


### Deals
Do not include the universal properties, plus these deal-specific ones:
* `dealname`: While you set `dealname` during creation, you cannot set a read-only version of it.
* `days_to_close`: A calculated field.
* `hs_deal_stage_probability`: This is set by the deal stage, not directly.
* `hs_is_closed`: A boolean calculated based on the deal stage.
* `hs_is_closed_won`: A boolean calculated based on the deal stage.


### Tickets
Do not include the universal properties, plus these ticket-specific ones:
* `hs_ticket_id`: The unique ID for the ticket.
* `time_to_close`: A calculated property based on `createdate` and `closed_date`.
* `time_to_first_response`: A calculated property.


### Engagements (Notes, Calls, Tasks)
The `engagements.js` file uses the V1 Engagements endpoint, which has its own structure. When creating these, do **NOT** include these properties in the `engagement` or `metadata` objects:
* `id`: The unique ID for the engagement.
* `createdAt`: Timestamp of creation.
* `lastUpdated`: Timestamp of the last update.
* `createdBy`: The user ID of the creator.
* `modifiedBy`: The user ID of the last person to modify it.