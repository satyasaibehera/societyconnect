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
      residents: {
        Row: {
          age: number | null
          approved_by: string | null
          created_at: string
          date_of_birth: string | null
          full_name: string
          id: string
          phone: string | null
          photo_url: string | null
          resident_type: string
          society_id: string
          status: Database["public"]["Enums"]["approval_status"]
          unit_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          age?: number | null
          approved_by?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name: string
          id?: string
          phone?: string | null
          photo_url?: string | null
          resident_type?: string
          society_id: string
          status?: Database["public"]["Enums"]["approval_status"]
          unit_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          age?: number | null
          approved_by?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          photo_url?: string | null
          resident_type?: string
          society_id?: string
          status?: Database["public"]["Enums"]["approval_status"]
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
          state: string | null
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
          state?: string | null
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
          state?: string | null
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
      vehicles: {
        Row: {
          approved_by: string | null
          created_at: string
          id: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
