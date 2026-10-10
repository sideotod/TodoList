export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type CalendarItemRow = {
  user_id: string;
  item_id: string;
  item_data: Json;
  revision: number;
  updated_at: string;
  deleted_at: string | null;
  last_mutation_id: string;
  last_mutation_digest: string;
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: '12' };
  public: {
    Tables: {
      calendar_items: {
        Row: CalendarItemRow;
        Insert: Omit<CalendarItemRow, 'updated_at' | 'deleted_at'> & { updated_at?: string; deleted_at?: string | null };
        Update: Partial<CalendarItemRow>;
        Relationships: [];
      };
      mutation_receipts: {
        Row: { user_id: string; operation_id: string; item_id: string; payload_digest: string; result_revision: number; created_at: string };
        Insert: { user_id: string; operation_id: string; item_id: string; payload_digest: string; result_revision: number; created_at?: string };
        Update: Partial<{ item_id: string; payload_digest: string; result_revision: number; created_at: string }>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      apply_calendar_item_mutation: {
        Args: {
          p_item_id: string;
          p_operation_id: string;
          p_payload_digest: string;
          p_base_revision: number | null;
          p_mutation_kind: string;
          p_proposed_snapshot: Json;
        };
        Returns: Json;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
