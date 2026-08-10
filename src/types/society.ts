/** Shared society catalog row shape (public registration + authenticated admin context). */
export type SocietyListItem = {
  id: string;
  name: string;
  code?: string | null;
  city?: string | null;
  is_active?: boolean;
};
