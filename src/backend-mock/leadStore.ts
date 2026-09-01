import { LEADS_KEY } from '@/src/config/game';

export type MockLead = {
  phone: string;
  codeSent: boolean;
  verified: boolean;
  createdAt: string;
  verifiedAt?: string;
  source: 'traffic-rush-demo';
};

function readLeads(): MockLead[] {
  try {
    return JSON.parse(window.localStorage.getItem(LEADS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function upsertMockLead(phone: string, verified = false): MockLead {
  const leads = readLeads();
  const existing = leads.find((lead) => lead.phone === phone);
  const lead: MockLead = existing || {
    phone,
    codeSent: true,
    verified: false,
    createdAt: new Date().toISOString(),
    source: 'traffic-rush-demo',
  };
  lead.codeSent = true;
  if (verified) {
    lead.verified = true;
    lead.verifiedAt = new Date().toISOString();
  }
  const next = leads.filter((item) => item.phone !== phone);
  next.push(lead);
  window.localStorage.setItem(LEADS_KEY, JSON.stringify(next));
  return lead;
}
