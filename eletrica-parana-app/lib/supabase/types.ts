// Tipos enxutos do schema. Quando estabilizar, regerar com:
//   npx supabase gen types typescript --project-id <id> > lib/supabase/types.ts

export type UserRole = "vendedor" | "admin" | "compras";
export type DemandStatus = "out_of_stock" | "not_registered";

type EmptyRecord = Record<never, never>;

export interface Database {
  __InternalSupabase: { PostgrestVersion: "12" };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          branch: string | null;
          role: UserRole;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          phone?: string | null;
          branch?: string | null;
          role?: UserRole;
          active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          name: string;
          brand: string | null;
          normalized_name: string;
          first_requested_at: string | null;
          request_count: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          brand?: string | null;
          first_requested_at?: string | null;
          request_count?: number;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          document: string | null;
          normalized_name: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone?: string | null;
          document?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
        Relationships: [];
      };
      demand_records: {
        Row: {
          id: string;
          product_id: string;
          customer_id: string;
          vendor_id: string;
          quantity: number;
          status: DemandStatus;
          notes: string | null;
          photo_url: string | null;
          client_uuid: string | null;
          created_at: string;
          synced_at: string | null;
        };
        Insert: {
          id?: string;
          product_id: string;
          customer_id: string;
          vendor_id: string;
          quantity?: number;
          status: DemandStatus;
          notes?: string | null;
          photo_url?: string | null;
          client_uuid?: string | null;
          synced_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["demand_records"]["Insert"]
        >;
        Relationships: [];
      };
      report_config: {
        Row: {
          id: string;
          recipients: string[];
          send_day: number;
          send_hour: number;
          active: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          recipients: string[];
          send_day?: number;
          send_hour?: number;
          active?: boolean;
        };
        Update: Partial<
          Database["public"]["Tables"]["report_config"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: EmptyRecord;
    Functions: EmptyRecord;
    Enums: EmptyRecord;
    CompositeTypes: EmptyRecord;
  };
}
