// SaaS application catalog for selection page
export const SaaSCategories = [
  { id: 'crm', label: 'CRM' },
  { id: 'marketing', label: 'MARKETING AUTOMATION' },
  { id: 'pm', label: 'PROJECT MANAGEMENT' },
]

export const SaaSApps = [
  // CRM
  { id: 'hubspot', name: 'HUBSPOT', category: 'crm' },
  { id: 'salesforce', name: 'SALESFORCE', category: 'crm' },
  { id: 'zoho', name: 'ZOHO', category: 'crm' },
  { id: 'pipedrive', name: 'PIPEDRIVE', category: 'crm' },
  // Marketing Automation
  { id: 'marketo', name: 'MARKETO', category: 'marketing' },
  { id: 'mailchimp', name: 'MAILCHIMP', category: 'marketing' },
  { id: 'active-campaign', name: 'ACTIVE CAMPAIGN', category: 'marketing' },
  { id: 'klaviyo', name: 'KLAVIYO', category: 'marketing' },
  // Project Management
  { id: 'monday', name: 'MONDAY.COM', category: 'pm' },
  { id: 'asana', name: 'ASANA', category: 'pm' },
  { id: 'trello', name: 'TRELLO', category: 'pm' },
  { id: 'notion', name: 'NOTION', category: 'pm' },
]

export function getAppsByCategory(categoryId) {
  return SaaSApps.filter(a => a.category === categoryId)
}