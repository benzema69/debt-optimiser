export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      obligations: {
        Row: {
          id: string;
          user_id: string;
          composite_id: string;
          raw_code: string;
          entity: string;
          unit_amount: number;
          policy: string;
          mt: number;
          start_month: string;
          native_end_month: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          composite_id: string;
          raw_code: string;
          entity: string;
          unit_amount: number;
          policy: string;
          mt: number;
          start_month: string;
          native_end_month: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["obligations"]["Insert"]>;
      };
      ledger_events: {
        Row: {
          id: string;
          user_id: string;
          obligation_id: string | null;
          event_type: "INCOME" | "PAYMENT" | "ADJUSTMENT" | "REVERSAL";
          event_date: string;
          amount: number;
          note: string | null;
          reversal_of: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          obligation_id?: string | null;
          event_type: "INCOME" | "PAYMENT" | "ADJUSTMENT" | "REVERSAL";
          event_date: string;
          amount: number;
          note?: string | null;
          reversal_of?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ledger_events"]["Insert"]>;
      };
      optimization_runs: {
        Row: {
          id: string;
          user_id: string;
          input_checksum: string;
          solver: string;
          status: string;
          config: Json;
          metrics: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          input_checksum: string;
          solver: string;
          status: string;
          config: Json;
          metrics?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["optimization_runs"]["Insert"]>;
      };
      optimization_allocations: {
        Row: {
          id: string;
          run_id: string;
          obligation_id: string | null;
          composite_id: string;
          month: string;
          amount: number;
          regular_units: number;
          irregular_amount: number;
          fixed_amount: number;
        };
        Insert: {
          id?: string;
          run_id: string;
          obligation_id?: string | null;
          composite_id: string;
          month: string;
          amount: number;
          regular_units?: number;
          irregular_amount?: number;
          fixed_amount?: number;
        };
        Update: Partial<Database["public"]["Tables"]["optimization_allocations"]["Insert"]>;
      };
    };
  };
};

export type ObligationRow = Database["public"]["Tables"]["obligations"]["Row"];
export type LedgerEventRow = Database["public"]["Tables"]["ledger_events"]["Row"];
