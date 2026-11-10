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
      hexes: {
        Row: {
          centroid: unknown
          created_at: string
          h3_index: string
          slope_deg: number | null
          weather_point_id: string | null
          zone_id: number
        }
        Insert: {
          centroid?: unknown
          created_at?: string
          h3_index: string
          slope_deg?: number | null
          weather_point_id?: string | null
          zone_id: number
        }
        Update: {
          centroid?: unknown
          created_at?: string
          h3_index?: string
          slope_deg?: number | null
          weather_point_id?: string | null
          zone_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "hexes_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          created_at: string
          date: string
          hazard_type: Database["public"]["Enums"]["hazard_type"]
          hours_closed: number | null
          id: number
          lat: number | null
          lng: number | null
          location: unknown
          place: string | null
          source_url: string | null
          trucks_stranded: number | null
          zone_id: number
        }
        Insert: {
          created_at?: string
          date: string
          hazard_type: Database["public"]["Enums"]["hazard_type"]
          hours_closed?: number | null
          id?: never
          lat?: number | null
          lng?: number | null
          location?: unknown
          place?: string | null
          source_url?: string | null
          trucks_stranded?: number | null
          zone_id: number
        }
        Update: {
          created_at?: string
          date?: string
          hazard_type?: Database["public"]["Enums"]["hazard_type"]
          hours_closed?: number | null
          id?: never
          lat?: number | null
          lng?: number | null
          location?: unknown
          place?: string | null
          source_url?: string | null
          trucks_stranded?: number | null
          zone_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "incidents_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          confirmations: number
          created_at: string
          expires_at: string | null
          hazard_type: Database["public"]["Enums"]["hazard_type"]
          id: string
          location: unknown
          note: string | null
          photo_path: string | null
          source: Database["public"]["Enums"]["report_source"]
          status: Database["public"]["Enums"]["report_status"]
          updated_at: string
          user_id: string | null
          zone_id: number | null
        }
        Insert: {
          confirmations?: number
          created_at?: string
          expires_at?: string | null
          hazard_type: Database["public"]["Enums"]["hazard_type"]
          id?: string
          location: unknown
          note?: string | null
          photo_path?: string | null
          source: Database["public"]["Enums"]["report_source"]
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
          user_id?: string | null
          zone_id?: number | null
        }
        Update: {
          confirmations?: number
          created_at?: string
          expires_at?: string | null
          hazard_type?: Database["public"]["Enums"]["hazard_type"]
          id?: string
          location?: unknown
          note?: string | null
          photo_path?: string | null
          source?: Database["public"]["Enums"]["report_source"]
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
          user_id?: string | null
          zone_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_scores: {
        Row: {
          confidence: Database["public"]["Enums"]["confidence_level"] | null
          flash_flood: number | null
          h3_index: string | null
          horizon_hours: number
          id: number
          landslide: number | null
          model_version: string
          overall: number
          reason: string | null
          risk_high: number | null
          risk_low: number | null
          rockfall: number | null
          run_at: string
          snow_ice: number | null
          top_hazard: Database["public"]["Enums"]["hazard_type"] | null
          zone_id: number
        }
        Insert: {
          confidence?: Database["public"]["Enums"]["confidence_level"] | null
          flash_flood?: number | null
          h3_index?: string | null
          horizon_hours: number
          id?: never
          landslide?: number | null
          model_version: string
          overall: number
          reason?: string | null
          risk_high?: number | null
          risk_low?: number | null
          rockfall?: number | null
          run_at?: string
          snow_ice?: number | null
          top_hazard?: Database["public"]["Enums"]["hazard_type"] | null
          zone_id: number
        }
        Update: {
          confidence?: Database["public"]["Enums"]["confidence_level"] | null
          flash_flood?: number | null
          h3_index?: string | null
          horizon_hours?: number
          id?: never
          landslide?: number | null
          model_version?: string
          overall?: number
          reason?: string | null
          risk_high?: number | null
          risk_low?: number | null
          rockfall?: number | null
          run_at?: string
          snow_ice?: number | null
          top_hazard?: Database["public"]["Enums"]["hazard_type"] | null
          zone_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "risk_scores_h3_index_fkey"
            columns: ["h3_index"]
            isOneToOne: false
            referencedRelation: "hexes"
            referencedColumns: ["h3_index"]
          },
          {
            foreignKeyName: "risk_scores_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          advice: string | null
          agent_id: string | null
          cold_stored: boolean
          created_at: string
          destination: string | null
          driver_id: string | null
          eta: string | null
          harvest_date: string | null
          id: string
          last_location: unknown
          last_seen_at: string | null
          origin: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          tonnes: number | null
          truck_number: string | null
          truck_type: Database["public"]["Enums"]["truck_type"] | null
          updated_at: string
          variety: string | null
        }
        Insert: {
          advice?: string | null
          agent_id?: string | null
          cold_stored?: boolean
          created_at?: string
          destination?: string | null
          driver_id?: string | null
          eta?: string | null
          harvest_date?: string | null
          id?: string
          last_location?: unknown
          last_seen_at?: string | null
          origin?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tonnes?: number | null
          truck_number?: string | null
          truck_type?: Database["public"]["Enums"]["truck_type"] | null
          updated_at?: string
          variety?: string | null
        }
        Update: {
          advice?: string | null
          agent_id?: string | null
          cold_stored?: boolean
          created_at?: string
          destination?: string | null
          driver_id?: string | null
          eta?: string | null
          harvest_date?: string | null
          id?: string
          last_location?: unknown
          last_seen_at?: string | null
          origin?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tonnes?: number | null
          truck_number?: string | null
          truck_type?: Database["public"]["Enums"]["truck_type"] | null
          updated_at?: string
          variety?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          agent_id: string | null
          created_at: string
          id: string
          name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          verified: boolean
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          id: string
          name?: string | null
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          verified?: boolean
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          id?: string
          name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "users_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_readings: {
        Row: {
          fetched_at: string
          id: number
          is_forecast: boolean
          location: unknown
          point_id: string
          precipitation_mm: number | null
          snow_depth_m: number | null
          snowfall_cm: number | null
          temperature_c: number | null
          valid_at: string
        }
        Insert: {
          fetched_at?: string
          id?: never
          is_forecast?: boolean
          location?: unknown
          point_id: string
          precipitation_mm?: number | null
          snow_depth_m?: number | null
          snowfall_cm?: number | null
          temperature_c?: number | null
          valid_at: string
        }
        Update: {
          fetched_at?: string
          id?: never
          is_forecast?: boolean
          location?: unknown
          point_id?: string
          precipitation_mm?: number | null
          snow_depth_m?: number | null
          snowfall_cm?: number | null
          temperature_c?: number | null
          valid_at?: string
        }
        Relationships: []
      }
      zones: {
        Row: {
          base_risk: number
          created_at: string
          danger_km: number
          from_place: string
          id: number
          length_km: number
          name: string
          notes: string | null
          risk_level: string
          to_place: string
          updated_at: string
        }
        Insert: {
          base_risk: number
          created_at?: string
          danger_km?: number
          from_place: string
          id: number
          length_km: number
          name: string
          notes?: string | null
          risk_level: string
          to_place: string
          updated_at?: string
        }
        Update: {
          base_risk?: number
          created_at?: string
          danger_km?: number
          from_place?: string
          id?: number
          length_km?: number
          name?: string
          notes?: string | null
          risk_level?: string
          to_place?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      confidence_level: "low" | "medium" | "high"
      hazard_type:
        | "landslide"
        | "rockfall"
        | "flash_flood"
        | "snow_ice"
        | "accident"
        | "other"
      report_source: "driver" | "police"
      report_status: "unconfirmed" | "confirmed" | "expired"
      shipment_status:
        | "planned"
        | "holding"
        | "moving"
        | "stuck"
        | "on_rail"
        | "diverted"
        | "delivered"
      truck_type: "light" | "heavy"
      user_role: "grower" | "trader" | "agent" | "driver" | "police" | "admin"
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
    Enums: {
      confidence_level: ["low", "medium", "high"],
      hazard_type: [
        "landslide",
        "rockfall",
        "flash_flood",
        "snow_ice",
        "accident",
        "other",
      ],
      report_source: ["driver", "police"],
      report_status: ["unconfirmed", "confirmed", "expired"],
      shipment_status: [
        "planned",
        "holding",
        "moving",
        "stuck",
        "on_rail",
        "diverted",
        "delivered",
      ],
      truck_type: ["light", "heavy"],
      user_role: ["grower", "trader", "agent", "driver", "police", "admin"],
    },
  },
} as const
