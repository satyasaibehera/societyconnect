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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      approval_delegates: {
        Row: {
          created_at: string
          delegate_id: string
          id: string
          is_active: boolean
          owner_id: string
          reason: string | null
          unit_id: string
          valid_from: string
          valid_until: string
        }
        Insert: {
          created_at?: string
          delegate_id: string
          id?: string
          is_active?: boolean
          owner_id: string
          reason?: string | null
          unit_id: string
          valid_from?: string
          valid_until: string
        }
        Update: {
          created_at?: string
          delegate_id?: string
          id?: string
          is_active?: boolean
          owner_id?: string
          reason?: string | null
          unit_id?: string
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_delegates_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      buildings: {
        Row: {
          created_at: string
          floors: number
          id: string
          name: string
          society_id: string
          units_per_floor: number
        }
        Insert: {
          created_at?: string
          floors?: number
          id?: string
          name: string
          society_id: string
          units_per_floor?: number
        }
        Update: {
          created_at?: string
          floors?: number
          id?: string
          name?: string
          society_id?: string
          units_per_floor?: number
        }
        Relationships: [
          {
            foreignKeyName: "buildings_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          assigned_to: string | null
          category: string | null
          created_at: string
          description: string
          id: string
          resident_id: string | null
          society_id: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          description: string
          id?: string
          resident_id?: string | null
          society_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          resident_id?: string | null
          society_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaints_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          message: string | null
          raised_by: string
          resolved_at: string | null
          resolved_by: string | null
          society_id: string
          status: string
          updated_at: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          message?: string | null
          raised_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          society_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          message?: string | null
          raised_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          society_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_alerts_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      helper_assignments: {
        Row: {
          created_at: string
          helper_id: string
          id: string
          unit_id: string
        }
        Insert: {
          created_at?: string
          helper_id: string
          id?: string
          unit_id: string
        }
        Update: {
          created_at?: string
          helper_id?: string
          id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "helper_assignments_helper_id_fkey"
            columns: ["helper_id"]
            isOneToOne: false
            referencedRelation: "helpers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helper_assignments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      helpers: {
        Row: {
          approved_by: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          phone: string | null
          photo_url: string | null
          service_type: string | null
          society_id: string
          status: Database["public"]["Enums"]["approval_status"]
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          phone?: string | null
          photo_url?: string | null
          service_type?: string | null
          society_id: string
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          phone?: string | null
          photo_url?: string | null
          service_type?: string | null
          society_id?: string
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "helpers_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          agenda: string | null
          created_at: string
          created_by: string | null
          id: string
          meeting_date: string | null
          society_id: string
          title: string
        }
        Insert: {
          agenda?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          meeting_date?: string | null
          society_id: string
          title: string
        }
        Update: {
          agenda?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          meeting_date?: string | null
          society_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      move_passes: {
        Row: {
          admin_approved_at: string | null
          admin_approved_by: string | null
          admin_rejection_reason: string | null
          created_at: string
          dues_cleared: boolean
          dues_cleared_at: string | null
          dues_cleared_by: string | null
          id: string
          notes: string | null
          owner_approved_at: string | null
          owner_approved_by: string | null
          owner_rejection_reason: string | null
          pass_type: string
          purpose: string | null
          requested_by: string
          scheduled_date: string | null
          scheduled_time: string | null
          society_id: string
          status: string
          tenant_email: string | null
          tenant_name: string | null
          tenant_phone: string | null
          unit_id: string
          updated_at: string
          vehicle_number: string | null
          vehicle_type: string | null
        }
        Insert: {
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          admin_rejection_reason?: string | null
          created_at?: string
          dues_cleared?: boolean
          dues_cleared_at?: string | null
          dues_cleared_by?: string | null
          id?: string
          notes?: string | null
          owner_approved_at?: string | null
          owner_approved_by?: string | null
          owner_rejection_reason?: string | null
          pass_type: string
          purpose?: string | null
          requested_by: string
          scheduled_date?: string | null
          scheduled_time?: string | null
          society_id: string
          status?: string
          tenant_email?: string | null
          tenant_name?: string | null
          tenant_phone?: string | null
          unit_id: string
          updated_at?: string
          vehicle_number?: string | null
          vehicle_type?: string | null
        }
        Update: {
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          admin_rejection_reason?: string | null
          created_at?: string
          dues_cleared?: boolean
          dues_cleared_at?: string | null
          dues_cleared_by?: string | null
          id?: string
          notes?: string | null
          owner_approved_at?: string | null
          owner_approved_by?: string | null
          owner_rejection_reason?: string | null
          pass_type?: string
          purpose?: string | null
          requested_by?: string
          scheduled_date?: string | null
          scheduled_time?: string | null
          society_id?: string
          status?: string
          tenant_email?: string | null
          tenant_name?: string | null
          tenant_phone?: string | null
          unit_id?: string
          updated_at?: string
          vehicle_number?: string | null
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "move_passes_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "move_passes_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      notices: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          society_id: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          society_id: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          society_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notices_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          metadata: Json | null
          recipient_id: string
          related_id: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          recipient_id: string
          related_id?: string | null
          title: string
          type?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          recipient_id?: string
          related_id?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      office_bearers: {
        Row: {
          created_at: string
          designation: Database["public"]["Enums"]["office_bearer_designation"]
          id: string
          is_approver: boolean
          phone: string | null
          society_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          designation: Database["public"]["Enums"]["office_bearer_designation"]
          id?: string
          is_approver?: boolean
          phone?: string | null
          society_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          designation?: Database["public"]["Enums"]["office_bearer_designation"]
          id?: string
          is_approver?: boolean
          phone?: string | null
          society_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_bearers_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_payment_config: {
        Row: {
          account_holder_name: string | null
          bank_name: string | null
          created_at: string
          id: string
          is_active: boolean
          owner_user_id: string
          rent_amount: number | null
          unit_id: string
          updated_at: string
          upi_id: string | null
        }
        Insert: {
          account_holder_name?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          owner_user_id: string
          rent_amount?: number | null
          unit_id: string
          updated_at?: string
          upi_id?: string | null
        }
        Update: {
          account_holder_name?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          owner_user_id?: string
          rent_amount?: number | null
          unit_id?: string
          updated_at?: string
          upi_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_payment_config_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_categories: {
        Row: {
          account_holder_name: string | null
          account_number: string | null
          amount: number | null
          amount_max: number | null
          amount_min: number | null
          bank_name: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_day: number | null
          frequency: string
          id: string
          ifsc_code: string | null
          is_active: boolean
          is_fixed_amount: boolean
          name: string
          society_id: string
          updated_at: string
          upi_id: string | null
        }
        Insert: {
          account_holder_name?: string | null
          account_number?: string | null
          amount?: number | null
          amount_max?: number | null
          amount_min?: number | null
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_day?: number | null
          frequency?: string
          id?: string
          ifsc_code?: string | null
          is_active?: boolean
          is_fixed_amount?: boolean
          name: string
          society_id: string
          updated_at?: string
          upi_id?: string | null
        }
        Update: {
          account_holder_name?: string | null
          account_number?: string | null
          amount?: number | null
          amount_max?: number | null
          amount_min?: number | null
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_day?: number | null
          frequency?: string
          id?: string
          ifsc_code?: string | null
          is_active?: boolean
          is_fixed_amount?: boolean
          name?: string
          society_id?: string
          updated_at?: string
          upi_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_categories_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_records: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          declared_at: string
          id: string
          notes: string | null
          owner_config_id: string | null
          payer_user_id: string
          payment_type: string
          period_label: string | null
          rejection_reason: string | null
          society_id: string
          status: string
          transaction_ref: string | null
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          declared_at?: string
          id?: string
          notes?: string | null
          owner_config_id?: string | null
          payer_user_id: string
          payment_type: string
          period_label?: string | null
          rejection_reason?: string | null
          society_id: string
          status?: string
          transaction_ref?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          declared_at?: string
          id?: string
          notes?: string | null
          owner_config_id?: string | null
          payer_user_id?: string
          payment_type?: string
          period_label?: string | null
          rejection_reason?: string | null
          society_id?: string
          status?: string
          transaction_ref?: string | null
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_records_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "payment_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_owner_config_id_fkey"
            columns: ["owner_config_id"]
            isOneToOne: false
            referencedRelation: "owner_payment_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string | null
          id: string
          society_id: string
          start_time: string | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          society_id: string
          start_time?: string | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          society_id?: string
          start_time?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rent_receipts: {
        Row: {
          amount: number
          created_at: string
          id: string
          issued_at: string
          notes: string | null
          owner_name: string
          owner_user_id: string
          payment_date: string
          payment_record_id: string
          period_label: string | null
          receipt_number: string
          tenant_name: string
          tenant_user_id: string
          unit_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          issued_at?: string
          notes?: string | null
          owner_name: string
          owner_user_id: string
          payment_date?: string
          payment_record_id: string
          period_label?: string | null
          receipt_number: string
          tenant_name: string
          tenant_user_id: string
          unit_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          issued_at?: string
          notes?: string | null
          owner_name?: string
          owner_user_id?: string
          payment_date?: string
          payment_record_id?: string
          period_label?: string | null
          receipt_number?: string
          tenant_name?: string
          tenant_user_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_receipts_payment_record_id_fkey"
            columns: ["payment_record_id"]
            isOneToOne: false
            referencedRelation: "payment_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_receipts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      residents: {
        Row: {
          age: number | null
          approved_by: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          full_name: string
          gender: string | null
          has_vacated: boolean
          id: string
          phone: string | null
          photo_url: string | null
          relationship: string | null
          resident_type: string
          society_id: string
          status: Database["public"]["Enums"]["approval_status"]
          tenancy_end_date: string | null
          tenancy_start_date: string | null
          unit_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          age?: number | null
          approved_by?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name: string
          gender?: string | null
          has_vacated?: boolean
          id?: string
          phone?: string | null
          photo_url?: string | null
          relationship?: string | null
          resident_type?: string
          society_id: string
          status?: Database["public"]["Enums"]["approval_status"]
          tenancy_end_date?: string | null
          tenancy_start_date?: string | null
          unit_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          age?: number | null
          approved_by?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          gender?: string | null
          has_vacated?: boolean
          id?: string
          phone?: string | null
          photo_url?: string | null
          relationship?: string | null
          resident_type?: string
          society_id?: string
          status?: Database["public"]["Enums"]["approval_status"]
          tenancy_end_date?: string | null
          tenancy_start_date?: string | null
          unit_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "residents_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residents_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      resolutions: {
        Row: {
          created_at: string
          decision_date: string | null
          description: string | null
          id: string
          related_poll_id: string | null
          society_id: string
          title: string
        }
        Insert: {
          created_at?: string
          decision_date?: string | null
          description?: string | null
          id?: string
          related_poll_id?: string | null
          society_id: string
          title: string
        }
        Update: {
          created_at?: string
          decision_date?: string | null
          description?: string | null
          id?: string
          related_poll_id?: string | null
          society_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "resolutions_related_poll_id_fkey"
            columns: ["related_poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resolutions_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      role_requests: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          requester_id: string
          reviewed_by: string | null
          society_id: string | null
          status: Database["public"]["Enums"]["approval_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          requested_role: Database["public"]["Enums"]["app_role"]
          requester_id: string
          reviewed_by?: string | null
          society_id?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          requested_role?: Database["public"]["Enums"]["app_role"]
          requester_id?: string
          reviewed_by?: string | null
          society_id?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_requests_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      security_staff: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string | null
          photo_url: string | null
          society_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          photo_url?: string | null
          society_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          photo_url?: string | null
          society_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_staff_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      societies: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
          requires_admin_for_move_pass: boolean
          state: string | null
          temp_pass_validity_hours: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          requires_admin_for_move_pass?: boolean
          state?: string | null
          temp_pass_validity_hours?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          requires_admin_for_move_pass?: boolean
          state?: string | null
          temp_pass_validity_hours?: number
          updated_at?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          building_id: string
          created_at: string
          floor: number
          id: string
          unit_number: string
        }
        Insert: {
          building_id: string
          created_at?: string
          floor: number
          id?: string
          unit_number: string
        }
        Update: {
          building_id?: string
          created_at?: string
          floor?: number
          id?: string
          unit_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicle_passes: {
        Row: {
          approved_by: string | null
          created_at: string
          id: string
          pass_type: string
          purpose: string | null
          requested_by: string | null
          society_id: string
          status: string
          unit_id: string | null
          unit_label: string | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          vehicle_number: string
          vehicle_type: string | null
          visitor_name: string | null
          visitor_phone: string | null
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          id?: string
          pass_type?: string
          purpose?: string | null
          requested_by?: string | null
          society_id: string
          status?: string
          unit_id?: string | null
          unit_label?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          vehicle_number: string
          vehicle_type?: string | null
          visitor_name?: string | null
          visitor_phone?: string | null
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          id?: string
          pass_type?: string
          purpose?: string | null
          requested_by?: string | null
          society_id?: string
          status?: string
          unit_id?: string | null
          unit_label?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          vehicle_number?: string
          vehicle_type?: string | null
          visitor_name?: string | null
          visitor_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_passes_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_passes_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          approved_by: string | null
          created_at: string
          id: string
          ownership_type: string | null
          parking_slot: string | null
          resident_id: string | null
          society_id: string
          status: Database["public"]["Enums"]["approval_status"]
          vehicle_number: string
          vehicle_type: string | null
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          id?: string
          ownership_type?: string | null
          parking_slot?: string | null
          resident_id?: string | null
          society_id: string
          status?: Database["public"]["Enums"]["approval_status"]
          vehicle_number: string
          vehicle_type?: string | null
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          id?: string
          ownership_type?: string | null
          parking_slot?: string | null
          resident_id?: string | null
          society_id?: string
          status?: Database["public"]["Enums"]["approval_status"]
          vehicle_number?: string
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
        ]
      }
      visitors: {
        Row: {
          approved_by: string | null
          created_at: string
          created_by: string | null
          entry_time: string | null
          exit_time: string | null
          id: string
          name: string
          phone: string | null
          purpose: string | null
          society_id: string
          status: Database["public"]["Enums"]["approval_status"]
          visiting_unit_id: string | null
          visiting_unit_label: string | null
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          entry_time?: string | null
          exit_time?: string | null
          id?: string
          name: string
          phone?: string | null
          purpose?: string | null
          society_id: string
          status?: Database["public"]["Enums"]["approval_status"]
          visiting_unit_id?: string | null
          visiting_unit_label?: string | null
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          entry_time?: string | null
          exit_time?: string | null
          id?: string
          name?: string
          phone?: string | null
          purpose?: string | null
          society_id?: string
          status?: Database["public"]["Enums"]["approval_status"]
          visiting_unit_id?: string | null
          visiting_unit_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitors_society_id_fkey"
            columns: ["society_id"]
            isOneToOne: false
            referencedRelation: "societies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitors_visiting_unit_id_fkey"
            columns: ["visiting_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          created_at: string
          id: string
          poll_id: string
          resident_id: string | null
          vote_option: string
        }
        Insert: {
          created_at?: string
          id?: string
          poll_id: string
          resident_id?: string | null
          vote_option: string
        }
        Update: {
          created_at?: string
          id?: string
          poll_id?: string
          resident_id?: string | null
          vote_option?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_resident_id: { Args: { _user_id: string }; Returns: string }
      get_user_unit_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_unit_approver: {
        Args: { _unit_id: string; _user_id: string }
        Returns: boolean
      }
      is_unit_member: {
        Args: { _unit_id: string; _user_id: string }
        Returns: boolean
      }
      is_unit_owner: {
        Args: { _unit_id: string; _user_id: string }
        Returns: boolean
      }
      transfer_ownership: {
        Args: {
          _current_owner_id: string
          _invoker_user_id: string
          _new_owner_id: string
        }
        Returns: undefined
      }
      unit_has_approved_owner: { Args: { _unit_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "office_bearer"
        | "resident"
        | "security"
      approval_status: "pending" | "approved" | "rejected"
      office_bearer_designation:
        | "president"
        | "vice_president"
        | "secretary"
        | "joint_secretary"
        | "treasurer"
        | "joint_treasurer"
        | "ward_leader"
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
    Enums: {
      app_role: [
        "super_admin",
        "admin",
        "office_bearer",
        "resident",
        "security",
      ],
      approval_status: ["pending", "approved", "rejected"],
      office_bearer_designation: [
        "president",
        "vice_president",
        "secretary",
        "joint_secretary",
        "treasurer",
        "joint_treasurer",
        "ward_leader",
      ],
    },
  },
} as const
