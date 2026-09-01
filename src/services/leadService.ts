import { upsertMockLead } from '@/src/backend-mock/leadStore';

const MOCK_CODE = '1234';

export const leadService = {
  async requestCode(phone: string) {
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    upsertMockLead(phone);
    return { ok: true, devCode: MOCK_CODE };
  },

  async verifyCode(phone: string, code: string) {
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    const ok = code === MOCK_CODE;
    if (ok) upsertMockLead(phone, true);
    return { ok };
  },
};
