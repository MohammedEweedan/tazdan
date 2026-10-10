/** People the customer has exchanged money with (GET /contacts). */
import { api } from '@/lib/api';

export interface Contact {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  verified: boolean;
  memberSince: string;
  lastAt?: string;
  count?: number;
}

export interface ContactPayment {
  id: string;
  direction: 'SENT' | 'RECEIVED';
  amount: string;
  currency: string;
  note: string | null;
  reference: string | null;
  via: 'transfer' | 'chat' | 'link';
  createdAt: string;
}

export interface ContactDetail {
  contact: Contact;
  summary: { count: number; firstAt: string | null; lastAt: string | null; byCurrency: Array<{ currency: string; sent: string; received: string }> };
  items: ContactPayment[];
}

export const contactsService = {
  list: async (): Promise<Contact[]> => (await api.get<{ contacts: Contact[] }>('/contacts')).data.contacts,
  detail: async (id: string): Promise<ContactDetail> => (await api.get<ContactDetail>(`/contacts/${id}`)).data,
};
