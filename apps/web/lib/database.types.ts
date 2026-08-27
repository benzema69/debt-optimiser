export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.17" };
  public: {
    Tables: {
      ledger_events: {
        Row: {
          amount: number;
          created_at: string;
          event_date: string;
          event_type: string;
          id: string;
          note: string | null;
          obligation_id: string | null;
          reversal_of: string | null;
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          event_date: string;
          event_type: string;
          id?: string;
          note?: string | null;
          obligation_id?: string | null;
          reversal_of?: string | null;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          event_date?: string;
          event_type?: string;
          id?: string;
          note?: string | null;
          obligation_id?: string | null;
          reversal_of?: string | null;
          user_id?: string;
        };
        Relationships: [
          { foreignKeyName: "ledger_events_obligation_id_fkey"; columns: ["obligation_id"]; isOneToOne: false; referencedRelation: "obligations"; referencedColumns: ["id"] },
          { foreignKeyName: "ledger_events_reversal_of_fkey"; columns: ["reversal_of"]; isOneToOne: false; referencedRelation: "ledger_events"; referencedColumns: ["id"] }
        ];
      };
      obligations: {
        Row: {
          active: boolean;
          composite_id: string;
          created_at: string;
          entity: string;
          id: string;
          mt: number;
          native_end_month: string;
          policy: string;
          raw_code: string;
          start_month: string;
          unit_amount: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          composite_id: string;
          created_at?: string;
          entity: string;
          id?: string;
          mt: number;
          native_end_month: string;
          policy: string;
          raw_code: string;
          start_month: string;
          unit_amount: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active?: boolean;
          composite_id?: string;
          created_at?: string;
          entity?: string;
          id?: string;
          mt?: number;
          native_end_month?: string;
          policy?: string;
          raw_code?: string;
          start_month?: string;
          unit_amount?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      optimization_allocations: {
        Row: {
          amount: number;
          composite_id: string;
          fixed_amount: number;
          id: string;
          irregular_amount: number;
          month: string;
          obligation_id: string | null;
          regular_units: number;
          run_id: string;
        };
        Insert: {
          amount: number;
          composite_id: string;
          fixed_amount?: number;
          id?: string;
          irregular_amount?: number;
          month: string;
          obligation_id?: string | null;
          regular_units?: number;
          run_id: string;
        };
        Update: {
          amount?: number;
          composite_id?: string;
          fixed_amount?: number;
          id?: string;
          irregular_amount?: number;
          month?: string;
          obligation_id?: string | null;
          regular_units?: number;
          run_id?: string;
        };
        Relationships: [
          { foreignKeyName: "optimization_allocations_obligation_id_fkey"; columns: ["obligation_id"]; isOneToOne: false; referencedRelation: "obligations"; referencedColumns: ["id"] },
          { foreignKeyName: "optimization_allocations_run_id_fkey"; columns: ["run_id"]; isOneToOne: false; referencedRelation: "optimization_runs"; referencedColumns: ["id"] }
        ];
      };
      optimization_runs: {
        Row: {
          config: Json;
          created_at: string;
          id: string;
          input_checksum: string;
          metrics: Json | null;
          solver: string;
          status: string;
          user_id: string;
        };
        Insert: {
          config: Json;
          created_at?: string;
          id?: string;
          input_checksum: string;
          metrics?: Json | null;
          solver: string;
          status: string;
          user_id: string;
        };
        Update: {
          config?: Json;
          created_at?: string;
          id?: string;
          input_checksum?: string;
          metrics?: Json | null;
          solver?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type ObligationRow = Database["public"]["Tables"]["obligations"]["Row"];
export type LedgerEventRow = Omit<Database["public"]["Tables"]["ledger_events"]["Row"], "event_type"> & {
  event_type: "INCOME" | "PAYMENT" | "ADJUSTMENT" | "REVERSAL";
};
