export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      consents: {
        Row: {
          customer_hash: string;
          email: string | null;
          given_at: string;
          id: number;
          shop_id: string;
          text_hash: string;
          text_version: string;
          withdrawn_at: string | null;
        };
        Insert: {
          customer_hash: string;
          email?: string | null;
          given_at?: string;
          id?: never;
          shop_id: string;
          text_hash: string;
          text_version: string;
          withdrawn_at?: string | null;
        };
        Update: {
          customer_hash?: string;
          email?: string | null;
          given_at?: string;
          id?: never;
          shop_id?: string;
          text_hash?: string;
          text_version?: string;
          withdrawn_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "consents_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      email_events: {
        Row: {
          created_at: string;
          id: number;
          kind: string;
          order_id: string | null;
          provider_message_id: string | null;
          shop_id: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          id?: never;
          kind: string;
          order_id?: string | null;
          provider_message_id?: string | null;
          shop_id: string;
          status: string;
        };
        Update: {
          created_at?: string;
          id?: never;
          kind?: string;
          order_id?: string | null;
          provider_message_id?: string | null;
          shop_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_events_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      email_outbox: {
        Row: {
          attempts: number;
          created_at: string;
          failed_at: string | null;
          id: number;
          kind: string;
          next_attempt_at: string;
          payload: NonNullable<Json>;
          sent_at: string | null;
          shop_id: string;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          failed_at?: string | null;
          id?: never;
          kind: string;
          next_attempt_at?: string;
          payload: NonNullable<Json>;
          sent_at?: string | null;
          shop_id: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          failed_at?: string | null;
          id?: never;
          kind?: string;
          next_attempt_at?: string;
          payload?: NonNullable<Json>;
          sent_at?: string | null;
          shop_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_outbox_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      exports: {
        Row: {
          csv_path: string | null;
          generated_at: string | null;
          id: number;
          pdf_path: string | null;
          period: string;
          sent_at: string | null;
          shop_id: string;
          status: string;
        };
        Insert: {
          csv_path?: string | null;
          generated_at?: string | null;
          id?: never;
          pdf_path?: string | null;
          period: string;
          sent_at?: string | null;
          shop_id: string;
          status?: string;
        };
        Update: {
          csv_path?: string | null;
          generated_at?: string | null;
          id?: never;
          pdf_path?: string | null;
          period?: string;
          sent_at?: string | null;
          shop_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exports_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      launchpad_admins: {
        Row: {
          created_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          format: string;
          id: number;
          is_alcohol: boolean;
          name: string;
          order_id: string;
          product_id: string;
          quantity: number;
          shop_id: string;
          unit_price_cents: number;
          vat_rate: number;
        };
        Insert: {
          format?: string;
          id?: never;
          is_alcohol?: boolean;
          name: string;
          order_id: string;
          product_id: string;
          quantity: number;
          shop_id: string;
          unit_price_cents: number;
          vat_rate: number;
        };
        Update: {
          format?: string;
          id?: never;
          is_alcohol?: boolean;
          name?: string;
          order_id?: string;
          product_id?: string;
          quantity?: number;
          shop_id?: string;
          unit_price_cents?: number;
          vat_rate?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      order_status_events: {
        Row: {
          actor: string | null;
          created_at: string;
          from_status: Database["public"]["Enums"]["order_status"] | null;
          id: number;
          order_id: string;
          shop_id: string;
          to_status: Database["public"]["Enums"]["order_status"];
        };
        Insert: {
          actor?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["order_status"] | null;
          id?: never;
          order_id: string;
          shop_id: string;
          to_status: Database["public"]["Enums"]["order_status"];
        };
        Update: {
          actor?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["order_status"] | null;
          id?: never;
          order_id?: string;
          shop_id?: string;
          to_status?: Database["public"]["Enums"]["order_status"];
        };
        Relationships: [
          {
            foreignKeyName: "order_status_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_status_events_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          anonymized_at: string | null;
          created_at: string;
          customer_hash: string | null;
          email: string | null;
          id: string;
          number: number;
          paid_at: string;
          phone: string | null;
          ready_email_sent_at: string | null;
          shop_id: string;
          slot_end: string;
          slot_start: string;
          status: Database["public"]["Enums"]["order_status"];
          stripe_payment_intent_id: string | null;
          stripe_session_id: string;
          total_cents: number;
          vat_breakdown: NonNullable<Json>;
        };
        Insert: {
          anonymized_at?: string | null;
          created_at?: string;
          customer_hash?: string | null;
          email?: string | null;
          id?: string;
          number?: number;
          paid_at: string;
          phone?: string | null;
          ready_email_sent_at?: string | null;
          shop_id: string;
          slot_end: string;
          slot_start: string;
          status?: Database["public"]["Enums"]["order_status"];
          stripe_payment_intent_id?: string | null;
          stripe_session_id: string;
          total_cents: number;
          vat_breakdown?: NonNullable<Json>;
        };
        Update: {
          anonymized_at?: string | null;
          created_at?: string;
          customer_hash?: string | null;
          email?: string | null;
          id?: string;
          number?: number;
          paid_at?: string;
          phone?: string | null;
          ready_email_sent_at?: string | null;
          shop_id?: string;
          slot_end?: string;
          slot_start?: string;
          status?: Database["public"]["Enums"]["order_status"];
          stripe_payment_intent_id?: string | null;
          stripe_session_id?: string;
          total_cents?: number;
          vat_breakdown?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: "orders_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      product_availability: {
        Row: {
          available: boolean;
          product_id: string;
          shop_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          available?: boolean;
          product_id: string;
          shop_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          available?: boolean;
          product_id?: string;
          shop_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_availability_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      shop_counters: {
        Row: {
          last_order_number: number;
          shop_id: string;
        };
        Insert: {
          last_order_number: number;
          shop_id: string;
        };
        Update: {
          last_order_number?: number;
          shop_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shop_counters_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: true;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      shop_users: {
        Row: {
          created_at: string;
          role: string;
          shop_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          role?: string;
          shop_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          role?: string;
          shop_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shop_users_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      shops: {
        Row: {
          core_version: string;
          created_at: string;
          domain: string;
          id: string;
          name: string;
          slug: string;
          stripe_account_id: string | null;
        };
        Insert: {
          core_version: string;
          created_at?: string;
          domain: string;
          id?: string;
          name: string;
          slug: string;
          stripe_account_id?: string | null;
        };
        Update: {
          core_version?: string;
          created_at?: string;
          domain?: string;
          id?: string;
          name?: string;
          slug?: string;
          stripe_account_id?: string | null;
        };
        Relationships: [];
      };
      stripe_events: {
        Row: {
          event_id: string;
          processed_at: string | null;
          received_at: string;
          shop_id: string;
          type: string;
        };
        Insert: {
          event_id: string;
          processed_at?: string | null;
          received_at?: string;
          shop_id: string;
          type: string;
        };
        Update: {
          event_id?: string;
          processed_at?: string | null;
          received_at?: string;
          shop_id?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stripe_events_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      unsubscribes: {
        Row: {
          created_at: string;
          customer_hash: string;
          shop_id: string;
        };
        Insert: {
          created_at?: string;
          customer_hash: string;
          shop_id: string;
        };
        Update: {
          created_at?: string;
          customer_hash?: string;
          shop_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "unsubscribes_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      pg_all_foreign_keys: {
        Row: {
          fk_columns: unknown[] | null;
          fk_constraint_name: unknown;
          fk_schema_name: unknown;
          fk_table_name: unknown;
          fk_table_oid: unknown;
          is_deferrable: boolean | null;
          is_deferred: boolean | null;
          match_type: string | null;
          on_delete: string | null;
          on_update: string | null;
          pk_columns: unknown[] | null;
          pk_constraint_name: unknown;
          pk_index_name: unknown;
          pk_schema_name: unknown;
          pk_table_name: unknown;
          pk_table_oid: unknown;
        };
        Relationships: [];
      };
      tap_funky: {
        Row: {
          args: string | null;
          is_definer: boolean | null;
          is_strict: boolean | null;
          is_visible: boolean | null;
          kind: unknown;
          langoid: unknown;
          name: unknown;
          oid: unknown;
          owner: unknown;
          returns: string | null;
          returns_set: boolean | null;
          schema: unknown;
          volatility: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      _cleanup: { Args: Record<PropertyKey, never>; Returns: boolean };
      _contract_on: { Args: { "": string }; Returns: unknown };
      _currtest: { Args: Record<PropertyKey, never>; Returns: number };
      _db_privs: { Args: Record<PropertyKey, never>; Returns: unknown[] };
      _extensions: { Args: Record<PropertyKey, never>; Returns: unknown[] };
      _get: { Args: { "": string }; Returns: number };
      _get_latest: { Args: { "": string }; Returns: number[] };
      _get_note: { Args: { "": string }; Returns: string };
      _is_verbose: { Args: Record<PropertyKey, never>; Returns: boolean };
      _prokind: { Args: { p_oid: unknown }; Returns: unknown };
      _query: { Args: { "": string }; Returns: string };
      _refine_vol: { Args: { "": string }; Returns: string };
      _retval: { Args: { "": string }; Returns: string };
      _table_privs: { Args: Record<PropertyKey, never>; Returns: unknown[] };
      _temptypes: { Args: { "": string }; Returns: string };
      _todo: { Args: Record<PropertyKey, never>; Returns: string };
      col_is_null:
        | {
            Args: { column_name: unknown; description?: string; schema_name: unknown; table_name: unknown };
            Returns: string;
          }
        | { Args: { column_name: unknown; description?: string; table_name: unknown }; Returns: string };
      col_not_null:
        | {
            Args: { column_name: unknown; description?: string; schema_name: unknown; table_name: unknown };
            Returns: string;
          }
        | { Args: { column_name: unknown; description?: string; table_name: unknown }; Returns: string };
      diag:
        | {
            Args: { msg: unknown };
            Returns: {
              error: true;
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved";
          }
        | {
            Args: { msg: string };
            Returns: {
              error: true;
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved";
          };
      diag_test_name: { Args: { "": string }; Returns: string };
      do_tap: { Args: Record<PropertyKey, never>; Returns: string[] } | { Args: { "": string }; Returns: string[] };
      fail: { Args: Record<PropertyKey, never>; Returns: string } | { Args: { "": string }; Returns: string };
      findfuncs: { Args: { "": string }; Returns: string[] };
      finish: { Args: { exception_on_failure?: boolean }; Returns: string[] };
      format_type_string: { Args: { "": string }; Returns: string };
      has_unique: { Args: { "": string }; Returns: string };
      in_todo: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_empty: { Args: { "": string }; Returns: string };
      isnt_empty: { Args: { "": string }; Returns: string };
      lives_ok: { Args: { "": string }; Returns: string };
      no_plan: { Args: Record<PropertyKey, never>; Returns: boolean[] };
      num_failed: { Args: Record<PropertyKey, never>; Returns: number };
      os_name: { Args: Record<PropertyKey, never>; Returns: string };
      pass: { Args: Record<PropertyKey, never>; Returns: string } | { Args: { "": string }; Returns: string };
      pg_version: { Args: Record<PropertyKey, never>; Returns: string };
      pg_version_num: { Args: Record<PropertyKey, never>; Returns: number };
      pgtap_version: { Args: Record<PropertyKey, never>; Returns: number };
      runtests: { Args: Record<PropertyKey, never>; Returns: string[] } | { Args: { "": string }; Returns: string[] };
      skip: { Args: { "": string }; Returns: string } | { Args: { how_many: number; why: string }; Returns: string };
      throws_ok: { Args: { "": string }; Returns: string };
      todo:
        | { Args: { how_many: number }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
        | { Args: { why: string }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] };
      todo_end: { Args: Record<PropertyKey, never>; Returns: boolean[] };
      todo_start:
        { Args: Record<PropertyKey, never>; Returns: boolean[] } | { Args: { "": string }; Returns: boolean[] };
    };
    Enums: {
      order_status: "new" | "preparing" | "ready" | "collected";
    };
    CompositeTypes: {
      _time_trial_type: {
        a_time: number | null;
      };
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      order_status: ["new", "preparing", "ready", "collected"],
    },
  },
} as const;
