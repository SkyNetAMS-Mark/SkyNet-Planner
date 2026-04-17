export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      drivers: {
        Row: {
          id: string
          name: string
          email: string
          phone: string
          vehicle_type: 'owned' | 'external'
          vehicle_registration: string | null
          status: 'active' | 'inactive'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          phone: string
          vehicle_type?: 'owned' | 'external'
          vehicle_registration?: string | null
          status?: 'active' | 'inactive'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          phone?: string
          vehicle_type?: 'owned' | 'external'
          vehicle_registration?: string | null
          status?: 'active' | 'inactive'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      regions: {
        Row: {
          id: string
          name: string
          description: string | null
          color: string
          is_active: boolean
          lead_time_days: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          color?: string
          is_active?: boolean
          lead_time_days?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          color?: string
          is_active?: boolean
          lead_time_days?: number
          created_at?: string
          updated_at?: string
        }
      }
      postal_codes: {
        Row: {
          id: string
          code: number
          region_id: string
          city: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: number
          region_id: string
          city?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: number
          region_id?: string
          city?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      delivery_periods: {
        Row: {
          id: string
          name: string
          start_time: string
          end_time: string
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          start_time: string
          end_time: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          start_time?: string
          end_time?: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      region_schedules: {
        Row: {
          id: string
          region_id: string
          day_of_week: number
          period_id: string
          max_deliveries: number
          driver_id: string | null
          route_id: string | null
          is_active: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          region_id: string
          day_of_week: number
          period_id: string
          max_deliveries: number
          driver_id?: string | null
          route_id?: string | null
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          region_id?: string
          day_of_week?: number
          period_id?: string
          max_deliveries?: number
          driver_id?: string | null
          route_id?: string | null
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      senders: {
        Row: {
          id: string
          company_name: string
          email: string
          phone: string | null
          address: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_name: string
          email: string
          phone?: string | null
          address?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_name?: string
          email?: string
          phone?: string | null
          address?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      parcels: {
        Row: {
          id: string
          tracking_number: string
          sender_id: string
          receiver_name: string
          receiver_email: string
          receiver_phone: string
          receiver_address: string
          receiver_postal_code: number
          region_id: string | null
          delivery_date: string
          selected_slot_id: string | null
          status: 'pending' | 'slot_selected' | 'in_transit' | 'delivered' | 'failed' | 'cancelled'
          secret_token: string
          token_used: boolean
          token_expires_at: string | null
          notes: string | null
          weight_kg: number | null
          dimensions_cm: string | null
          special_instructions: string | null
          created_at: string
          updated_at: string
          slot_selected_at: string | null
          delivered_at: string | null
          delivery_reminder_sent_at: string | null
        }
        Insert: {
          id?: string
          tracking_number?: string
          sender_id: string
          receiver_name: string
          receiver_email: string
          receiver_phone: string
          receiver_address: string
          receiver_postal_code: number
          region_id?: string | null
          delivery_date: string
          selected_slot_id?: string | null
          status?: 'pending' | 'slot_selected' | 'in_transit' | 'delivered' | 'failed' | 'cancelled'
          secret_token?: string
          token_used?: boolean
          token_expires_at?: string | null
          notes?: string | null
          weight_kg?: number | null
          dimensions_cm?: string | null
          special_instructions?: string | null
          created_at?: string
          updated_at?: string
          slot_selected_at?: string | null
          delivered_at?: string | null
          delivery_reminder_sent_at?: string | null
        }
        Update: {
          id?: string
          tracking_number?: string
          sender_id?: string
          receiver_name?: string
          receiver_email?: string
          receiver_phone?: string
          receiver_address?: string
          receiver_postal_code?: number
          region_id?: string | null
          delivery_date?: string
          selected_slot_id?: string | null
          status?: 'pending' | 'slot_selected' | 'in_transit' | 'delivered' | 'failed' | 'cancelled'
          secret_token?: string
          token_used?: boolean
          token_expires_at?: string | null
          notes?: string | null
          weight_kg?: number | null
          dimensions_cm?: string | null
          special_instructions?: string | null
          created_at?: string
          updated_at?: string
          slot_selected_at?: string | null
          delivered_at?: string | null
          delivery_reminder_sent_at?: string | null
        }
      }
      parcel_history: {
        Row: {
          id: string
          parcel_id: string
          status: string
          notes: string | null
          changed_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          parcel_id: string
          status: string
          notes?: string | null
          changed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          parcel_id?: string
          status?: string
          notes?: string | null
          changed_by?: string | null
          created_at?: string
        }
      }
      admin_users: {
        Row: {
          id: string
          full_name: string
          role: 'admin' | 'manager' | 'viewer'
          is_active: boolean
          last_login_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          role?: 'admin' | 'manager' | 'viewer'
          is_active?: boolean
          last_login_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          role?: 'admin' | 'manager' | 'viewer'
          is_active?: boolean
          last_login_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      routes: {
        Row: {
          id: string
          route_number: number
          name: string | null
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          route_number: number
          name?: string | null
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          route_number?: number
          name?: string | null
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      available_slots: {
        Row: {
          id: string
          region_id: string
          region_name: string
          day_of_week: number
          period_id: string
          period_name: string
          start_time: string
          end_time: string
          max_deliveries: number
          driver_id: string | null
          driver_name: string | null
          is_active: boolean
        }
      }
      parcel_dashboard: {
        Row: {
          id: string
          tracking_number: string
          receiver_name: string
          receiver_postal_code: number
          delivery_date: string
          status: string
          token_used: boolean
          sender_name: string
          region_name: string | null
          day_of_week: number | null
          period_name: string | null
          created_at: string
          updated_at: string
        }
      }
      slot_capacity: {
        Row: {
          slot_id: string
          region_id: string
          region_name: string
          day_of_week: number
          period_id: string
          period_name: string
          max_deliveries: number
          current_count: number
          available_capacity: number
          utilization_percentage: number
        }
      }
    }
    Functions: {
      generate_tracking_number: {
        Args: Record<string, never>
        Returns: string
      }
      generate_secret_token: {
        Args: Record<string, never>
        Returns: string
      }
    }
    Enums: {
      vehicle_type: 'owned' | 'external'
      driver_status: 'active' | 'inactive'
      parcel_status: 'pending' | 'slot_selected' | 'in_transit' | 'delivered' | 'failed' | 'cancelled'
      admin_role: 'admin' | 'manager' | 'viewer'
    }
  }
}