export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      cash_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          details: Json | null
          id: string
          session_id: string | null
          store_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          session_id?: string | null
          store_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          session_id?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_audit_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_audit_log_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount: number
          authorized_by: string | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          direction: number
          id: string
          notes: string | null
          reason: string | null
          request_id: string | null
          reverses_movement_id: string | null
          sale_id: string | null
          session_id: string
          store_id: string
          type: string
        }
        Insert: {
          amount: number
          authorized_by?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          direction: number
          id?: string
          notes?: string | null
          reason?: string | null
          request_id?: string | null
          reverses_movement_id?: string | null
          sale_id?: string | null
          session_id: string
          store_id: string
          type: string
        }
        Update: {
          amount?: number
          authorized_by?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          direction?: number
          id?: string
          notes?: string | null
          reason?: string | null
          request_id?: string | null
          reverses_movement_id?: string | null
          sale_id?: string | null
          session_id?: string
          store_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_reverses_movement_id_fkey"
            columns: ["reverses_movement_id"]
            isOneToOne: false
            referencedRelation: "cash_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closed_by_name: string | null
          closing_summary: Json | null
          counted_cash: number | null
          created_at: string
          difference: number | null
          divergence_reason: string | null
          expected_cash: number | null
          id: string
          opened_at: string
          opening_amount: number
          opening_notes: string | null
          operator_id: string
          operator_name: string | null
          reopen_count: number
          request_id: string | null
          session_number: number
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closed_by_name?: string | null
          closing_summary?: Json | null
          counted_cash?: number | null
          created_at?: string
          difference?: number | null
          divergence_reason?: string | null
          expected_cash?: number | null
          id?: string
          opened_at?: string
          opening_amount: number
          opening_notes?: string | null
          operator_id: string
          operator_name?: string | null
          reopen_count?: number
          request_id?: string | null
          session_number: number
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closed_by_name?: string | null
          closing_summary?: Json | null
          counted_cash?: number | null
          created_at?: string
          difference?: number | null
          divergence_reason?: string | null
          expected_cash?: number | null
          id?: string
          opened_at?: string
          opening_amount?: number
          opening_notes?: string | null
          operator_id?: string
          operator_name?: string | null
          reopen_count?: number
          request_id?: string | null
          session_number?: number
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_settings: {
        Row: {
          admin_can_close_others: boolean
          allow_admin_reopen: boolean
          allow_close_with_divergence: boolean
          allow_multiple_open_per_store: boolean
          allow_supplies: boolean
          allow_withdrawals: boolean
          created_at: string
          enabled: boolean
          id: string
          require_reason_divergence: boolean
          require_reason_supply: boolean
          require_reason_withdrawal: boolean
          store_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admin_can_close_others?: boolean
          allow_admin_reopen?: boolean
          allow_close_with_divergence?: boolean
          allow_multiple_open_per_store?: boolean
          allow_supplies?: boolean
          allow_withdrawals?: boolean
          created_at?: string
          enabled?: boolean
          id?: string
          require_reason_divergence?: boolean
          require_reason_supply?: boolean
          require_reason_withdrawal?: boolean
          store_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admin_can_close_others?: boolean
          allow_admin_reopen?: boolean
          allow_close_with_divergence?: boolean
          allow_multiple_open_per_store?: boolean
          allow_supplies?: boolean
          allow_withdrawals?: boolean
          created_at?: string
          enabled?: boolean
          id?: string
          require_reason_divergence?: boolean
          require_reason_supply?: boolean
          require_reason_withdrawal?: boolean
          store_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean | null
          created_at: string
          display_order: number | null
          id: string
          image_url: string | null
          name: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          display_order?: number | null
          id: string
          image_url?: string | null
          name: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          display_order?: number | null
          id?: string
          image_url?: string | null
          name?: string
        }
        Relationships: []
      }
      complement_groups: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          display_order: number
          id: string
          max_select: number
          min_select: number
          name: string
          required: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          max_select?: number
          min_select?: number
          name: string
          required?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          max_select?: number
          min_select?: number
          name?: string
          required?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      complement_items: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          display_order: number
          group_id: string
          id: string
          image_url: string | null
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          group_id: string
          id?: string
          image_url?: string | null
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          group_id?: string
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "complement_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "complement_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          birth_date: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          observacoes: string | null
          phone: string | null
          store_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          observacoes?: string | null
          phone?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          observacoes?: string | null
          phone?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      master_commands: {
        Row: {
          acked_at: string | null
          attempts: number
          command_id: string
          command_type: string
          created_at: string
          executed_at: string | null
          id: string
          installation_id: string | null
          last_error: string | null
          master_created_at: string | null
          payload: Json | null
          received_at: string
          result: Json | null
          result_sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          acked_at?: string | null
          attempts?: number
          command_id: string
          command_type: string
          created_at?: string
          executed_at?: string | null
          id?: string
          installation_id?: string | null
          last_error?: string | null
          master_created_at?: string | null
          payload?: Json | null
          received_at?: string
          result?: Json | null
          result_sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          acked_at?: string | null
          attempts?: number
          command_id?: string
          command_type?: string
          created_at?: string
          executed_at?: string | null
          id?: string
          installation_id?: string | null
          last_error?: string | null
          master_created_at?: string | null
          payload?: Json | null
          received_at?: string
          result?: Json | null
          result_sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      master_events: {
        Row: {
          created_at: string
          details: Json | null
          id: string
          kind: string
          message: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          id?: string
          kind: string
          message: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          id?: string
          kind?: string
          message?: string
        }
        Relationships: []
      }
      master_integration: {
        Row: {
          base_url: string | null
          cleanup_last_at: string | null
          created_at: string
          financial_unpublished_until: string | null
          id: number
          installation_id: string | null
          last_commands_at: string | null
          last_error: string | null
          last_heartbeat_at: string | null
          last_report_at: string | null
          last_sync_at: string | null
          last_sync_error_at: string | null
          last_verify_at: string | null
          license_status: string | null
          log_retention_days: number
          status: string
          store_name: string | null
          sync_interval_seconds: number
          sync_lock_until: string | null
          token_encrypted: string | null
          token_last4: string | null
          updated_at: string
        }
        Insert: {
          base_url?: string | null
          cleanup_last_at?: string | null
          created_at?: string
          financial_unpublished_until?: string | null
          id?: number
          installation_id?: string | null
          last_commands_at?: string | null
          last_error?: string | null
          last_heartbeat_at?: string | null
          last_report_at?: string | null
          last_sync_at?: string | null
          last_sync_error_at?: string | null
          last_verify_at?: string | null
          license_status?: string | null
          log_retention_days?: number
          status?: string
          store_name?: string | null
          sync_interval_seconds?: number
          sync_lock_until?: string | null
          token_encrypted?: string | null
          token_last4?: string | null
          updated_at?: string
        }
        Update: {
          base_url?: string | null
          cleanup_last_at?: string | null
          created_at?: string
          financial_unpublished_until?: string | null
          id?: number
          installation_id?: string | null
          last_commands_at?: string | null
          last_error?: string | null
          last_heartbeat_at?: string | null
          last_report_at?: string | null
          last_sync_at?: string | null
          last_sync_error_at?: string | null
          last_verify_at?: string | null
          license_status?: string | null
          log_retention_days?: number
          status?: string
          store_name?: string | null
          sync_interval_seconds?: number
          sync_lock_until?: string | null
          token_encrypted?: string | null
          token_last4?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      master_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          master_user_id: string
          revoked_at: string | null
          token_hash: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          master_user_id: string
          revoked_at?: string | null
          token_hash: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          master_user_id?: string
          revoked_at?: string | null
          token_hash?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "master_sessions_master_user_id_fkey"
            columns: ["master_user_id"]
            isOneToOne: false
            referencedRelation: "master_users"
            referencedColumns: ["id"]
          },
        ]
      }
      master_users: {
        Row: {
          created_at: string
          failed_attempts: number
          id: string
          last_login_at: string | null
          locked_until: string | null
          must_change_password: boolean
          password_hash: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          failed_attempts?: number
          id?: string
          last_login_at?: string | null
          locked_until?: string | null
          must_change_password?: boolean
          password_hash: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          failed_attempts?: number
          id?: string
          last_login_at?: string | null
          locked_until?: string | null
          must_change_password?: boolean
          password_hash?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          active: boolean
          code: string
          created_at: string
          display_order: number
          id: string
          kind: string
          name: string
          store_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          display_order?: number
          id?: string
          kind?: string
          name: string
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          display_order?: number
          id?: string
          kind?: string
          name?: string
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      pdv_controls: {
        Row: {
          blocked: boolean
          changed_at: string
          changed_by: string | null
          key: string
          message: string | null
          source: string
        }
        Insert: {
          blocked?: boolean
          changed_at?: string
          changed_by?: string | null
          key: string
          message?: string | null
          source?: string
        }
        Update: {
          blocked?: boolean
          changed_at?: string
          changed_by?: string | null
          key?: string
          message?: string | null
          source?: string
        }
        Relationships: []
      }
      pdv_license_state: {
        Row: {
          changed_at: string
          id: number
          license_status: string | null
          suspended: boolean
        }
        Insert: {
          changed_at?: string
          id?: number
          license_status?: string | null
          suspended?: boolean
        }
        Update: {
          changed_at?: string
          id?: number
          license_status?: string | null
          suspended?: boolean
        }
        Relationships: []
      }
      pix_settings: {
        Row: {
          created_at: string
          id: string
          pix_key: string | null
          receiver_city: string | null
          receiver_name: string | null
          store_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          pix_key?: string | null
          receiver_city?: string | null
          receiver_name?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          pix_key?: string | null
          receiver_city?: string | null
          receiver_name?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pix_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_complement_groups: {
        Row: {
          created_at: string
          display_order: number
          group_id: string
          id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          group_id: string
          id?: string
          product_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          group_id?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_complement_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "complement_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_complement_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean | null
          category_id: string
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          min_stock: number | null
          name: string
          price: number
          stock_quantity: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          category_id: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          min_stock?: number | null
          name: string
          price: number
          stock_quantity?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          category_id?: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          min_stock?: number | null
          name?: string
          price?: number
          stock_quantity?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          permissions: Json
          role: string | null
          store_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          permissions?: Json
          role?: string | null
          store_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          permissions?: Json
          role?: string | null
          store_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          created_at: string
          id: string
          item_id: string
          quantity: number
          reason: string
          sale_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          quantity: number
          reason: string
          sale_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          quantity?: number
          reason?: string
          sale_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "returns_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          sale_id: string
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          sale_id: string
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          sale_id?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_number_sequence: {
        Row: {
          id: number
          last_number: number
          store_id: string
          updated_at: string | null
        }
        Insert: {
          id?: number
          last_number?: number
          store_id: string
          updated_at?: string | null
        }
        Update: {
          id?: number
          last_number?: number
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_number_sequence_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cash_session_id: string | null
          created_at: string
          customer_name: string | null
          id: string
          notes: string | null
          payment_method: string | null
          sale_number: number | null
          seller_id: string | null
          status: string | null
          store_id: string
          total: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cash_session_id?: string | null
          created_at?: string
          customer_name?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          sale_number?: number | null
          seller_id?: string | null
          status?: string | null
          store_id: string
          total: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cash_session_id?: string | null
          created_at?: string
          customer_name?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          sale_number?: number | null
          seller_id?: string | null
          status?: string | null
          store_id?: string
          total?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_stores: {
        Row: {
          created_at: string
          id: string
          seller_id: string
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          seller_id: string
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          seller_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_stores_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_stores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          active: boolean | null
          commission_rate: number | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          store_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          commission_rate?: number | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          commission_rate?: number | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sellers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          reason: string
          store_id: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          reason: string
          store_id: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          reason?: string
          store_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_categories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          store_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          store_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_products: {
        Row: {
          available: boolean
          created_at: string
          id: string
          price: number | null
          product_id: string
          store_id: string
          updated_at: string
        }
        Insert: {
          available?: boolean
          created_at?: string
          id?: string
          price?: number | null
          product_id: string
          store_id: string
          updated_at?: string
        }
        Update: {
          available?: boolean
          created_at?: string
          id?: string
          price?: number | null
          product_id?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          accent_color: string | null
          address: string | null
          auto_backup: boolean | null
          background_color: string | null
          cart_icon_size: number
          category_columns: number
          category_name_bg: string | null
          category_name_color: string | null
          category_name_size: number | null
          checkout_color: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          gradient_color: string | null
          gradient_direction: string | null
          gradient_enabled: boolean
          id: string
          logo_size: number | null
          logo_url: string | null
          low_stock_alert: boolean | null
          menu_icon_size: number | null
          min_stock_threshold: number | null
          notifications_enabled: boolean | null
          opening_hours: string | null
          phone: string | null
          primary_color: string | null
          printer_font_size: number | null
          printer_footer_text: string | null
          printer_header_text: string | null
          printer_margin_left: number
          printer_show_address: boolean | null
          printer_show_customer: boolean | null
          printer_show_date: boolean | null
          printer_show_logo: boolean | null
          printer_show_order_number: boolean | null
          printer_show_payment_method: boolean | null
          printer_show_phone: boolean | null
          printer_show_seller: boolean | null
          printer_width: string | null
          product_columns: number
          product_label_align: string
          product_name_bg: string | null
          product_name_color: string | null
          product_name_size: number | null
          pwa_background_color: string | null
          pwa_description: string | null
          pwa_icon_url: string | null
          pwa_name: string | null
          pwa_orientation: string | null
          pwa_short_name: string | null
          pwa_theme_color: string | null
          save_icon_size: number
          secondary_color: string | null
          store_id: string | null
          store_name: string | null
          store_name_size: number | null
          subtitle_size: number | null
          subtitle_text: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          address?: string | null
          auto_backup?: boolean | null
          background_color?: string | null
          cart_icon_size?: number
          category_columns?: number
          category_name_bg?: string | null
          category_name_color?: string | null
          category_name_size?: number | null
          checkout_color?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          gradient_color?: string | null
          gradient_direction?: string | null
          gradient_enabled?: boolean
          id?: string
          logo_size?: number | null
          logo_url?: string | null
          low_stock_alert?: boolean | null
          menu_icon_size?: number | null
          min_stock_threshold?: number | null
          notifications_enabled?: boolean | null
          opening_hours?: string | null
          phone?: string | null
          primary_color?: string | null
          printer_font_size?: number | null
          printer_footer_text?: string | null
          printer_header_text?: string | null
          printer_margin_left?: number
          printer_show_address?: boolean | null
          printer_show_customer?: boolean | null
          printer_show_date?: boolean | null
          printer_show_logo?: boolean | null
          printer_show_order_number?: boolean | null
          printer_show_payment_method?: boolean | null
          printer_show_phone?: boolean | null
          printer_show_seller?: boolean | null
          printer_width?: string | null
          product_columns?: number
          product_label_align?: string
          product_name_bg?: string | null
          product_name_color?: string | null
          product_name_size?: number | null
          pwa_background_color?: string | null
          pwa_description?: string | null
          pwa_icon_url?: string | null
          pwa_name?: string | null
          pwa_orientation?: string | null
          pwa_short_name?: string | null
          pwa_theme_color?: string | null
          save_icon_size?: number
          secondary_color?: string | null
          store_id?: string | null
          store_name?: string | null
          store_name_size?: number | null
          subtitle_size?: number | null
          subtitle_text?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          address?: string | null
          auto_backup?: boolean | null
          background_color?: string | null
          cart_icon_size?: number
          category_columns?: number
          category_name_bg?: string | null
          category_name_color?: string | null
          category_name_size?: number | null
          checkout_color?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          gradient_color?: string | null
          gradient_direction?: string | null
          gradient_enabled?: boolean
          id?: string
          logo_size?: number | null
          logo_url?: string | null
          low_stock_alert?: boolean | null
          menu_icon_size?: number | null
          min_stock_threshold?: number | null
          notifications_enabled?: boolean | null
          opening_hours?: string | null
          phone?: string | null
          primary_color?: string | null
          printer_font_size?: number | null
          printer_footer_text?: string | null
          printer_header_text?: string | null
          printer_margin_left?: number
          printer_show_address?: boolean | null
          printer_show_customer?: boolean | null
          printer_show_date?: boolean | null
          printer_show_logo?: boolean | null
          printer_show_order_number?: boolean | null
          printer_show_payment_method?: boolean | null
          printer_show_phone?: boolean | null
          printer_show_seller?: boolean | null
          printer_width?: string | null
          product_columns?: number
          product_label_align?: string
          product_name_bg?: string | null
          product_name_color?: string | null
          product_name_size?: number | null
          pwa_background_color?: string | null
          pwa_description?: string | null
          pwa_icon_url?: string | null
          pwa_name?: string | null
          pwa_orientation?: string | null
          pwa_short_name?: string | null
          pwa_theme_color?: string | null
          save_icon_size?: number
          secondary_color?: string | null
          store_id?: string | null
          store_name?: string | null
          store_name_size?: number | null
          subtitle_size?: number | null
          subtitle_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_stock: {
        Row: {
          created_at: string
          id: string
          min_stock: number
          product_id: string
          stock_quantity: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          min_stock?: number
          product_id: string
          stock_quantity?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          min_stock?: number
          product_id?: string
          stock_quantity?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_stock_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          active: boolean
          address: string | null
          code: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          code?: string | null
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          code?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          observacoes: string | null
          phone: string | null
          store_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          observacoes?: string | null
          phone?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          observacoes?: string | null
          phone?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          description: string
          id: string
          store_id: string
          type: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          date: string
          description: string
          id?: string
          store_id: string
          type: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          store_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      user_categories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_stores: {
        Row: {
          created_at: string
          id: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_stores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_store: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_catalog: { Args: { _user_id: string }; Returns: boolean }
      get_next_sale_number:
        | { Args: never; Returns: number }
        | { Args: { _store_id: string }; Returns: number }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      master_cleanup_logs: { Args: never; Returns: Json }
      master_save_sync_settings: {
        Args: { _minutes: number; _retention_days: number }
        Returns: Json
      }
      master_try_sync_lock: { Args: { _seconds: number }; Returns: boolean }
      pdv_is_blocked: { Args: { _key: string }; Returns: boolean }
      pdv_license_suspended: { Args: never; Returns: boolean }
      pdv_lock_applies: { Args: never; Returns: boolean }
      pdv_raise_blocked: { Args: { _key: string }; Returns: undefined }
      user_store_id: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
