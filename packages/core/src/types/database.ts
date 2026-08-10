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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_lockouts: {
        Row: {
          auth_user_id: string
          failed_count: number
          last_failed_at: string | null
          locked_until: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          failed_count?: number
          last_failed_at?: string | null
          locked_until?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          failed_count?: number
          last_failed_at?: string | null
          locked_until?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      admin_recovery_codes: {
        Row: {
          auth_user_id: string
          batch_id: string
          code_hash: string
          created_at: string
          id: string
          superseded_at: string | null
          used_at: string | null
        }
        Insert: {
          auth_user_id: string
          batch_id: string
          code_hash: string
          created_at?: string
          id?: string
          superseded_at?: string | null
          used_at?: string | null
        }
        Update: {
          auth_user_id?: string
          batch_id?: string
          code_hash?: string
          created_at?: string
          id?: string
          superseded_at?: string | null
          used_at?: string | null
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          auth_user_id: string
          created_at: string | null
          id: string
          is_active: boolean
          must_change_password: boolean
          name: string | null
          recovery_codes_acknowledged: boolean
        }
        Insert: {
          auth_user_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          must_change_password?: boolean
          name?: string | null
          recovery_codes_acknowledged?: boolean
        }
        Update: {
          auth_user_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          must_change_password?: boolean
          name?: string | null
          recovery_codes_acknowledged?: boolean
        }
        Relationships: []
      }
      booking_services: {
        Row: {
          booking_id: string
          branch_service_id: string
          id: string
          price_at_booking: number
          quantity: number | null
        }
        Insert: {
          booking_id: string
          branch_service_id: string
          id?: string
          price_at_booking: number
          quantity?: number | null
        }
        Update: {
          booking_id?: string
          branch_service_id?: string
          id?: string
          price_at_booking?: number
          quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_services_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_services_branch_service_id_fkey"
            columns: ["branch_service_id"]
            isOneToOne: false
            referencedRelation: "branch_services"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          arrived_at: string | null
          booking_ref: string | null
          branch_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          closed_by: string | null
          commission_amount: number | null
          commission_rate: number | null
          completed_at: string | null
          confirmed_at: string | null
          created_at: string | null
          id: string
          no_show_at: string | null
          patient_notes: string | null
          payment_method: string | null
          payment_status: string | null
          paymob_order_id: string | null
          slot_id: string
          status: string | null
          total_amount: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          arrived_at?: string | null
          booking_ref?: string | null
          branch_id: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          closed_by?: string | null
          commission_amount?: number | null
          commission_rate?: number | null
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          id?: string
          no_show_at?: string | null
          patient_notes?: string | null
          payment_method?: string | null
          payment_status?: string | null
          paymob_order_id?: string | null
          slot_id: string
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          arrived_at?: string | null
          booking_ref?: string | null
          branch_id?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          closed_by?: string | null
          commission_amount?: number | null
          commission_rate?: number | null
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          id?: string
          no_show_at?: string | null
          patient_notes?: string | null
          payment_method?: string | null
          payment_status?: string | null
          paymob_order_id?: string | null
          slot_id?: string
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_profile_history: {
        Row: {
          branch_id: string
          changed_at: string
          changed_by: string | null
          id: string
          new_values: Json
          old_values: Json
        }
        Insert: {
          branch_id: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_values: Json
          old_values: Json
        }
        Update: {
          branch_id?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_values?: Json
          old_values?: Json
        }
        Relationships: [
          {
            foreignKeyName: "branch_profile_history_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_service_price_history: {
        Row: {
          branch_service_id: string
          changed_at: string
          changed_by: string | null
          id: string
          new_is_available: boolean
          new_price: number
          old_is_available: boolean | null
          old_price: number | null
        }
        Insert: {
          branch_service_id: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_is_available: boolean
          new_price: number
          old_is_available?: boolean | null
          old_price?: number | null
        }
        Update: {
          branch_service_id?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_is_available?: boolean
          new_price?: number
          old_is_available?: boolean | null
          old_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "branch_service_price_history_branch_service_id_fkey"
            columns: ["branch_service_id"]
            isOneToOne: false
            referencedRelation: "branch_services"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_services: {
        Row: {
          branch_id: string
          created_at: string | null
          custom_tat_hours: number | null
          home_collection: boolean | null
          home_collection_fee: number | null
          id: string
          is_available: boolean | null
          price: number | null
          service_id: string
          updated_at: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string | null
          custom_tat_hours?: number | null
          home_collection?: boolean | null
          home_collection_fee?: number | null
          id?: string
          is_available?: boolean | null
          price?: number | null
          service_id: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string | null
          custom_tat_hours?: number | null
          home_collection?: boolean | null
          home_collection_fee?: number | null
          id?: string
          is_available?: boolean | null
          price?: number | null
          service_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branch_services_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address_ar: string | null
          address_en: string | null
          created_at: string | null
          district: string | null
          governorate: string | null
          holiday_message_ar: string | null
          holiday_mode: boolean | null
          id: string
          instahealth_slot_allocation: number | null
          is_active: boolean | null
          lat: number | null
          lng: number | null
          name_ar: string
          name_en: string
          operating_hours: Json | null
          phone: string | null
          photos: string[] | null
          provider_id: string
          rating: number | null
          review_count: number | null
          slot_duration_minutes: number | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          address_ar?: string | null
          address_en?: string | null
          created_at?: string | null
          district?: string | null
          governorate?: string | null
          holiday_message_ar?: string | null
          holiday_mode?: boolean | null
          id?: string
          instahealth_slot_allocation?: number | null
          is_active?: boolean | null
          lat?: number | null
          lng?: number | null
          name_ar: string
          name_en: string
          operating_hours?: Json | null
          phone?: string | null
          photos?: string[] | null
          provider_id: string
          rating?: number | null
          review_count?: number | null
          slot_duration_minutes?: number | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          address_ar?: string | null
          address_en?: string | null
          created_at?: string | null
          district?: string | null
          governorate?: string | null
          holiday_message_ar?: string | null
          holiday_mode?: boolean | null
          id?: string
          instahealth_slot_allocation?: number | null
          is_active?: boolean | null
          lat?: number | null
          lng?: number | null
          name_ar?: string
          name_en?: string
          operating_hours?: Json | null
          phone?: string | null
          photos?: string[] | null
          provider_id?: string
          rating?: number | null
          review_count?: number | null
          slot_duration_minutes?: number | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_statement_lines: {
        Row: {
          amount_piasters: number
          booking_date: string
          booking_id: string
          booking_ref: string
          commission_piasters: number
          event_date: string | null
          event_kind: string
          excluded: boolean
          excluded_reason: string | null
          id: string
          method: string
          rate_percent: number | null
          statement_id: string
        }
        Insert: {
          amount_piasters: number
          booking_date: string
          booking_id: string
          booking_ref: string
          commission_piasters?: number
          event_date?: string | null
          event_kind: string
          excluded?: boolean
          excluded_reason?: string | null
          id?: string
          method: string
          rate_percent?: number | null
          statement_id: string
        }
        Update: {
          amount_piasters?: number
          booking_date?: string
          booking_id?: string
          booking_ref?: string
          commission_piasters?: number
          event_date?: string | null
          event_kind?: string
          excluded?: boolean
          excluded_reason?: string | null
          id?: string
          method?: string
          rate_percent?: number | null
          statement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_statement_lines_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_statement_lines_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "commission_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_statements: {
        Row: {
          commission_total_piasters: number
          commissionable_count: number
          created_at: string
          excluded_amount_piasters: number
          excluded_count: number
          gmv_piasters: number
          id: string
          issued_at: string
          issued_by: string | null
          month: string
          provider_id: string
          sent_at: string | null
          sent_by: string | null
          settled_at: string | null
          settled_by: string | null
          status: string
          superseded_by: string | null
          version: number
        }
        Insert: {
          commission_total_piasters: number
          commissionable_count: number
          created_at?: string
          excluded_amount_piasters: number
          excluded_count: number
          gmv_piasters: number
          id?: string
          issued_at?: string
          issued_by?: string | null
          month: string
          provider_id: string
          sent_at?: string | null
          sent_by?: string | null
          settled_at?: string | null
          settled_by?: string | null
          status: string
          superseded_by?: string | null
          version: number
        }
        Update: {
          commission_total_piasters?: number
          commissionable_count?: number
          created_at?: string
          excluded_amount_piasters?: number
          excluded_count?: number
          gmv_piasters?: number
          id?: string
          issued_at?: string
          issued_by?: string | null
          month?: string
          provider_id?: string
          sent_at?: string | null
          sent_by?: string | null
          settled_at?: string | null
          settled_by?: string | null
          status?: string
          superseded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "commission_statements_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_statements_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "commission_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          booking_id: string | null
          channel: string | null
          created_at: string | null
          error_message: string | null
          id: string
          message: string
          recipient: string
          sent_at: string | null
          status: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          booking_id?: string | null
          channel?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          message: string
          recipient: string
          sent_at?: string | null
          status?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          booking_id?: string | null
          channel?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          message?: string
          recipient?: string
          sent_at?: string | null
          status?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string | null
          currency: string | null
          gateway_order_id: string | null
          gateway_response: Json | null
          gateway_txn_id: string | null
          id: string
          method: string | null
          refund_amount: number | null
          refunded_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string | null
          currency?: string | null
          gateway_order_id?: string | null
          gateway_response?: Json | null
          gateway_txn_id?: string | null
          id?: string
          method?: string | null
          refund_amount?: number | null
          refunded_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string | null
          currency?: string | null
          gateway_order_id?: string | null
          gateway_response?: Json | null
          gateway_txn_id?: string | null
          id?: string
          method?: string | null
          refund_amount?: number | null
          refunded_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_commission_rates: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          note: string | null
          percent: number
          provider_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from: string
          id?: string
          note?: string | null
          percent: number
          provider_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          note?: string | null
          percent?: number
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_commission_rates_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_profile_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_values: Json
          old_values: Json
          provider_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_values: Json
          old_values: Json
          provider_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_values?: Json
          old_values?: Json
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_profile_history_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_user_history: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          new_values: Json
          old_values: Json
          provider_user_id: string
          source: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_values?: Json
          old_values?: Json
          provider_user_id: string
          source: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_values?: Json
          old_values?: Json
          provider_user_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_user_history_provider_user_id_fkey"
            columns: ["provider_user_id"]
            isOneToOne: false
            referencedRelation: "provider_users"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_users: {
        Row: {
          auth_user_id: string
          branch_ids: string[] | null
          created_at: string | null
          id: string
          is_active: boolean | null
          must_change_password: boolean
          name: string | null
          provider_id: string
          role: string | null
          temp_password_issued_at: string | null
        }
        Insert: {
          auth_user_id: string
          branch_ids?: string[] | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          must_change_password?: boolean
          name?: string | null
          provider_id: string
          role?: string | null
          temp_password_issued_at?: string | null
        }
        Update: {
          auth_user_id?: string
          branch_ids?: string[] | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          must_change_password?: boolean
          name?: string | null
          provider_id?: string
          role?: string | null
          temp_password_issued_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_users_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          category_id: string | null
          created_at: string | null
          description_ar: string | null
          description_en: string | null
          id: string
          is_active: boolean | null
          license_authority: string | null
          license_expiry: string | null
          license_number: string | null
          license_verified: boolean | null
          logo_url: string | null
          name_ar: string
          name_en: string
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_active?: boolean | null
          license_authority?: string | null
          license_expiry?: string | null
          license_number?: string | null
          license_verified?: boolean | null
          logo_url?: string | null
          name_ar: string
          name_en: string
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_active?: boolean | null
          license_authority?: string | null
          license_expiry?: string | null
          license_number?: string | null
          license_verified?: boolean | null
          logo_url?: string | null
          name_ar?: string
          name_en?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "providers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          booking_id: string
          branch_id: string
          comment: string | null
          created_at: string | null
          id: string
          is_flagged: boolean | null
          is_verified: boolean | null
          rating: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          booking_id: string
          branch_id: string
          comment?: string | null
          created_at?: string | null
          id?: string
          is_flagged?: boolean | null
          is_verified?: boolean | null
          rating: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          booking_id?: string
          branch_id?: string
          comment?: string | null
          created_at?: string | null
          id?: string
          is_flagged?: boolean | null
          is_verified?: boolean | null
          rating?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      service_catalog_history: {
        Row: {
          action: string
          category_id: string | null
          changed_at: string
          changed_by: string | null
          id: string
          new_values: Json
          old_values: Json
          service_id: string | null
        }
        Insert: {
          action: string
          category_id?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_values?: Json
          old_values?: Json
          service_id?: string | null
        }
        Update: {
          action?: string
          category_id?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_values?: Json
          old_values?: Json
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_catalog_history_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_catalog_history_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          launch_phase: number | null
          name_ar: string
          name_en: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          launch_phase?: number | null
          name_ar: string
          name_en: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          launch_phase?: number | null
          name_ar?: string
          name_en?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      services: {
        Row: {
          category_id: string
          code: string | null
          created_at: string | null
          default_tat_hours: number | null
          description_ar: string | null
          description_en: string | null
          id: string
          is_active: boolean | null
          name_ar: string
          name_en: string
          preparation_notes_ar: string | null
          preparation_notes_en: string | null
          sort_order: number | null
          status: string
          updated_at: string
        }
        Insert: {
          category_id: string
          code?: string | null
          created_at?: string | null
          default_tat_hours?: number | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_active?: boolean | null
          name_ar: string
          name_en: string
          preparation_notes_ar?: string | null
          preparation_notes_en?: string | null
          sort_order?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          code?: string | null
          created_at?: string | null
          default_tat_hours?: number | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_active?: boolean | null
          name_ar?: string
          name_en?: string
          preparation_notes_ar?: string | null
          preparation_notes_en?: string | null
          sort_order?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      slot_holds: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          slot_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          slot_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          slot_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slot_holds_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_holds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      slots: {
        Row: {
          booked_count: number | null
          branch_id: string
          capacity: number | null
          created_at: string | null
          id: string
          is_blocked: boolean | null
          slot_date: string
          slot_time: string
        }
        Insert: {
          booked_count?: number | null
          branch_id: string
          capacity?: number | null
          created_at?: string | null
          id?: string
          is_blocked?: boolean | null
          slot_date: string
          slot_time: string
        }
        Update: {
          booked_count?: number | null
          branch_id?: string
          capacity?: number | null
          created_at?: string | null
          id?: string
          is_blocked?: boolean | null
          slot_date?: string
          slot_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "slots_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          gender: string | null
          id: string
          name_ar: string | null
          name_en: string | null
          phone: string
          preferred_language: string | null
          sms_reminders: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          gender?: string | null
          id: string
          name_ar?: string | null
          name_en?: string | null
          phone: string
          preferred_language?: string | null
          sms_reminders?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          name_ar?: string | null
          name_en?: string | null
          phone?: string
          preferred_language?: string | null
          sms_reminders?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acknowledge_admin_recovery_codes: { Args: never; Returns: Json }
      admin_create_branch: {
        Args: {
          p_allocation?: number
          p_district: string
          p_lat: number
          p_lng: number
          p_name_ar: string
          p_name_en: string
          p_provider_id: string
        }
        Returns: Json
      }
      admin_create_provider: {
        Args: { p_name_ar: string; p_name_en: string; p_percent: number }
        Returns: Json
      }
      admin_create_service: {
        Args: {
          p_category_id: string
          p_code: string
          p_name_ar: string
          p_name_en: string
          p_preparation_notes_ar?: string
          p_preparation_notes_en?: string
          p_tat_hours?: number
        }
        Returns: Json
      }
      admin_link_service_to_branch: {
        Args: { p_branch_id: string; p_service_id: string }
        Returns: Json
      }
      admin_revoke_provider_sessions: {
        Args: { p_provider_user_id: string }
        Returns: Json
      }
      admin_set_category_active: {
        Args: { p_category_id: string; p_is_active: boolean }
        Returns: Json
      }
      admin_set_service_status: {
        Args: { p_service_id: string; p_to_status: string }
        Returns: Json
      }
      admin_update_branch: {
        Args: {
          p_branch_id: string
          p_district: string
          p_is_active: boolean
          p_lat: number
          p_lng: number
          p_name_ar: string
          p_name_en: string
        }
        Returns: Json
      }
      admin_update_provider: {
        Args: {
          p_is_active: boolean
          p_name_ar: string
          p_name_en: string
          p_provider_id: string
        }
        Returns: Json
      }
      admin_update_service: {
        Args: {
          p_category_id: string
          p_code: string
          p_name_ar: string
          p_name_en: string
          p_preparation_notes_ar?: string
          p_preparation_notes_en?: string
          p_service_id: string
          p_tat_hours?: number
        }
        Returns: Json
      }
      apply_branch_slot_shape: {
        Args: { p_allocation: number; p_branch_id: string }
        Returns: Json
      }
      auto_close_stale_bookings: { Args: never; Returns: number }
      cancel_booking: {
        Args: { p_booking_id: string; p_cancelled_by: string; p_reason: string }
        Returns: Json
      }
      cleanup_expired_holds: { Args: never; Returns: number }
      clear_admin_totp_failures: { Args: never; Returns: Json }
      commission_piasters: {
        Args: { p_amount_piasters: number; p_percent: number }
        Returns: number
      }
      commission_rate_at: {
        Args: { p_on: string; p_provider_id: string }
        Returns: number
      }
      complete_admin_password_change: { Args: never; Returns: Json }
      complete_provider_password_change: { Args: never; Returns: Json }
      compute_commission_draft: {
        Args: { p_month: string; p_provider_id: string }
        Returns: Json
      }
      confirm_booking: {
        Args: {
          p_booking_id: string
          p_gateway_order_id?: string
          p_gateway_response?: Json
          p_gateway_txn_id?: string
          p_payment_method: string
        }
        Returns: Json
      }
      consume_admin_recovery_code: { Args: { p_code: string }; Returns: Json }
      create_pending_booking: {
        Args: {
          p_branch_service_ids: string[]
          p_notes?: string
          p_slot_id: string
        }
        Returns: Json
      }
      create_slot_hold: { Args: { p_slot_id: string }; Returns: Json }
      generate_admin_recovery_codes: { Args: never; Returns: Json }
      generate_branch_slots: {
        Args: {
          p_branch_id: string
          p_end_date?: string
          p_start_date?: string
        }
        Returns: number
      }
      get_admin_auth_state: { Args: never; Returns: Json }
      get_branch_bookings_for_date: {
        Args: {
          p_branch_id: string
          p_date: string
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_status?: string
        }
        Returns: {
          arrived_at: string
          booking_ref: string
          cancellation_reason: string
          cancelled_at: string
          cancelled_by: string
          closed_by: string
          completed_at: string
          confirmed_at: string
          created_at: string
          id: string
          no_show_at: string
          patient_name_ar: string
          patient_notes: string
          patient_phone: string
          payment_method: string
          payment_status: string
          services: Json
          slot_date: string
          slot_id: string
          slot_time: string
          status: string
          total_amount: number
          total_count: number
        }[]
      }
      get_branch_services_for_editor: {
        Args: { p_branch_id: string }
        Returns: {
          branch_service_id: string
          category_name_ar: string
          category_slug: string
          is_available: boolean
          last_changed_at: string
          name_ar: string
          name_en: string
          preparation_notes_ar: string
          price: number
          service_id: string
        }[]
      }
      get_branch_slots: {
        Args: { p_branch_id: string; p_from?: string; p_to?: string }
        Returns: {
          active_hold_count: number
          booked_count: number
          capacity: number
          id: string
          is_blocked: boolean
          slot_date: string
          slot_time: string
        }[]
      }
      get_commission_statement_view: {
        Args: { p_month: string; p_provider_id: string; p_version?: number }
        Returns: Json
      }
      get_patient_bookings: {
        Args: never
        Returns: {
          booking_ref: string
          branch_address_ar: string
          branch_id: string
          branch_lat: number
          branch_lng: number
          branch_name_ar: string
          branch_phone: string
          cancelled_at: string
          created_at: string
          id: string
          is_hospital: boolean
          patient_notes: string
          payment_method: string
          payment_status: string
          services: Json
          slot_date: string
          slot_time: string
          status: string
          total_amount: number
        }[]
      }
      get_provider_branch_ids: { Args: never; Returns: string[] }
      get_provider_login_state: { Args: never; Returns: Json }
      get_provider_staff_accounts: { Args: never; Returns: Json }
      get_provider_staff_detail: {
        Args: { p_provider_user_id: string }
        Returns: Json
      }
      get_service_catalog: { Args: never; Returns: Json }
      get_service_categories_admin: { Args: never; Returns: Json }
      get_service_detail: { Args: { p_service_id: string }; Returns: Json }
      get_user_role: { Args: never; Returns: string }
      is_internal_caller: { Args: never; Returns: boolean }
      issue_statement: {
        Args: { p_month: string; p_provider_id: string }
        Returns: Json
      }
      mark_booking_outcome: {
        Args: { p_booking_id: string; p_outcome: string }
        Returns: Json
      }
      normalize_arabic: { Args: { p_text: string }; Returns: string }
      preview_branch_slot_shape: {
        Args: { p_allocation: number; p_branch_id: string }
        Returns: Json
      }
      preview_category_activation: {
        Args: { p_category_id: string; p_is_active: boolean }
        Returns: Json
      }
      preview_provider_deactivation: {
        Args: { p_provider_id: string }
        Returns: Json
      }
      preview_service_status_change: {
        Args: { p_service_id: string; p_to_status: string }
        Returns: Json
      }
      preview_staff_disable: {
        Args: { p_provider_user_id: string }
        Returns: Json
      }
      record_admin_totp_failure: { Args: never; Returns: Json }
      search_catalog: {
        Args: { p_category_slug?: string; p_query: string }
        Returns: Json
      }
      service_branch_pricing: { Args: { p_service_id: string }; Returns: Json }
      set_provider_commission_rate: {
        Args: {
          p_effective_from: string
          p_note?: string
          p_percent: number
          p_provider_id: string
        }
        Returns: Json
      }
      transition_statement: {
        Args: { p_statement_id: string; p_to: string }
        Returns: Json
      }
      update_branch_profile: {
        Args: {
          p_address_ar: string
          p_address_en: string
          p_phone: string
          p_whatsapp: string
        }
        Returns: Json
      }
      update_branch_service: {
        Args: {
          p_branch_service_id: string
          p_is_available: boolean
          p_price_egp: number
        }
        Returns: Json
      }
      validate_service_definition: {
        Args: {
          p_category_id: string
          p_code: string
          p_name_ar: string
          p_name_en: string
          p_prep_ar: string
          p_prep_en: string
          p_tat_hours: number
        }
        Returns: string
      }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
