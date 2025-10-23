export const Scenarios = [
  {
    id: 'b2b',
    name: 'B2B',
    description: 'Business-to-Business: longer sales cycles, multi-stakeholder deals, emphasis on lead qualification.',
  },
  {
    id: 'b2c',
    name: 'B2C',
    description: 'Business-to-Consumer: higher volume, shorter cycles, emphasis on engagement and conversion speed.',
  },
]

export function getScenario(id) { return Scenarios.find(s => s.id === id) }
