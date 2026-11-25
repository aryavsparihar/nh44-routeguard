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
      agent_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          agent_id: string
          code: string
          created_at: string
          expires_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          agent_id: string
          code: string
          created_at?: string
          expires_at: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          agent_id?: string
          code?: string
          created_at?: string
          expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_invites_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          at: string
          id: number
          meta: Json | null
          reason: string | null
          request_id: string | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          at?: string
          id?: number
          meta?: Json | null
          reason?: string | null
          request_id?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          at?: string
          id?: number
          meta?: Json | null
          reason?: string | null
          request_id?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
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
      idempotency_keys: {
        Row: {
          created_at: string
          key: string
          response_body: Json | null
          response_status: number
          route: string
          user_id: string
        }
        Insert: {
          created_at?: string
          key: string
          response_body?: Json | null
          response_status: number
          route: string
          user_id: string
        }
        Update: {
          created_at?: string
          key?: string
          response_body?: Json | null
          response_status?: number
          route?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "idempotency_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          added_by: string | null
          apple_trucks_mentioned: boolean | null
          archive_url: string | null
          confidence: Database["public"]["Enums"]["confidence_level"] | null
          coord_basis: string | null
          created_at: string
          date: string
          date_basis: string | null
          event_end_date: string | null
          evidence_quote: string | null
          external_id: string | null
          hazard_type: Database["public"]["Enums"]["hazard_type"]
          hours_basis: string | null
          hours_closed: number | null
          id: number
          is_demo: boolean
          lat: number | null
          lng: number | null
          location: unknown
          notes: string | null
          place: string | null
          second_source_url: string | null
          source_published_date: string | null
          source_publisher: string | null
          source_url: string | null
          trucks_stranded: number | null
          vehicles_stranded: number | null
          verified_by: string | null
          verified_on: string | null
          zone_id: number
        }
        Insert: {
          added_by?: string | null
          apple_trucks_mentioned?: boolean | null
          archive_url?: string | null
          confidence?: Database["public"]["Enums"]["confidence_level"] | null
          coord_basis?: string | null
          created_at?: string
          date: string
          date_basis?: string | null
          event_end_date?: string | null
          evidence_quote?: string | null
          external_id?: string | null
          hazard_type: Database["public"]["Enums"]["hazard_type"]
          hours_basis?: string | null
          hours_closed?: number | null
          id?: never
          is_demo?: boolean
          lat?: number | null
          lng?: number | null
          location?: unknown
          notes?: string | null
          place?: string | null
          second_source_url?: string | null
          source_published_date?: string | null
          source_publisher?: string | null
          source_url?: string | null
          trucks_stranded?: number | null
          vehicles_stranded?: number | null
          verified_by?: string | null
          verified_on?: string | null
          zone_id: number
        }
        Update: {
          added_by?: string | null
          apple_trucks_mentioned?: boolean | null
          archive_url?: string | null
          confidence?: Database["public"]["Enums"]["confidence_level"] | null
          coord_basis?: string | null
          created_at?: string
          date?: string
          date_basis?: string | null
          event_end_date?: string | null
          evidence_quote?: string | null
          external_id?: string | null
          hazard_type?: Database["public"]["Enums"]["hazard_type"]
          hours_basis?: string | null
          hours_closed?: number | null
          id?: never
          is_demo?: boolean
          lat?: number | null
          lng?: number | null
          location?: unknown
          notes?: string | null
          place?: string | null
          second_source_url?: string | null
          source_published_date?: string | null
          source_publisher?: string | null
          source_url?: string | null
          trucks_stranded?: number | null
          vehicles_stranded?: number | null
          verified_by?: string | null
          verified_on?: string | null
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
      job_dead_letters: {
        Row: {
          attempts: number
          enqueued_at: string
          failed_at: string
          id: number
          job: string
          last_error: string | null
          msg_id: number
          payload: Json
        }
        Insert: {
          attempts: number
          enqueued_at: string
          failed_at?: string
          id?: never
          job: string
          last_error?: string | null
          msg_id: number
          payload: Json
        }
        Update: {
          attempts?: number
          enqueued_at?: string
          failed_at?: string
          id?: never
          job?: string
          last_error?: string | null
          msg_id?: number
          payload?: Json
        }
        Relationships: []
      }
      official_updates: {
        Row: {
          body: string | null
          created_at: string
          created_by: string
          delete_reason: string | null
          deleted_at: string | null
          id: string
          issued_at: string
          kind: Database["public"]["Enums"]["official_update_kind"]
          source_name: string
          source_url: string
          supersedes_id: string | null
          title: string
          valid_until: string
          version: number
          zone_id: number | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by: string
          delete_reason?: string | null
          deleted_at?: string | null
          id?: string
          issued_at: string
          kind: Database["public"]["Enums"]["official_update_kind"]
          source_name: string
          source_url: string
          supersedes_id?: string | null
          title: string
          valid_until: string
          version?: number
          zone_id?: number | null
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string
          delete_reason?: string | null
          deleted_at?: string | null
          id?: string
          issued_at?: string
          kind?: Database["public"]["Enums"]["official_update_kind"]
          source_name?: string
          source_url?: string
          supersedes_id?: string | null
          title?: string
          valid_until?: string
          version?: number
          zone_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "official_updates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "official_updates_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "official_updates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "official_updates_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      report_confirmations: {
        Row: {
          created_at: string
          distance_m: number | null
          report_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          distance_m?: number | null
          report_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          distance_m?: number | null
          report_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_confirmations_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_confirmations_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_confirmations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      report_flags: {
        Row: {
          created_at: string
          id: number
          reason: Database["public"]["Enums"]["flag_reason"]
          report_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          reason: Database["public"]["Enums"]["flag_reason"]
          report_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          reason?: Database["public"]["Enums"]["flag_reason"]
          report_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_flags_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "public_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_flags_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_flags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          client_id: string | null
          confirmations: number
          created_at: string
          expires_at: string
          hazard_type: Database["public"]["Enums"]["hazard_type"]
          hidden_reason: string | null
          id: string
          is_demo: boolean
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
          client_id?: string | null
          confirmations?: number
          created_at?: string
          expires_at: string
          hazard_type: Database["public"]["Enums"]["hazard_type"]
          hidden_reason?: string | null
          id?: string
          is_demo?: boolean
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
          client_id?: string | null
          confirmations?: number
          created_at?: string
          expires_at?: string
          hazard_type?: Database["public"]["Enums"]["hazard_type"]
          hidden_reason?: string | null
          id?: string
          is_demo?: boolean
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
          level: string | null
          model_version: string
          overall: number
          reason: string | null
          reason_code: string | null
          reason_params: Json | null
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
          level?: string | null
          model_version: string
          overall: number
          reason?: string | null
          reason_code?: string | null
          reason_params?: Json | null
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
          level?: string | null
          model_version?: string
          overall?: number
          reason?: string | null
          reason_code?: string | null
          reason_params?: Json | null
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
      road_status: {
        Row: {
          item: string
          source_url: string | null
          state: Database["public"]["Enums"]["road_state"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          item: string
          source_url?: string | null
          state?: Database["public"]["Enums"]["road_state"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          item?: string
          source_url?: string | null
          state?: Database["public"]["Enums"]["road_state"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "road_status_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          advice: Json | null
          agent_id: string | null
          cold_stored: boolean
          created_at: string
          created_by: string | null
          destination: string | null
          driver_id: string | null
          eta: string | null
          harvest_date: string | null
          id: string
          is_demo: boolean
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
          advice?: Json | null
          agent_id?: string | null
          cold_stored?: boolean
          created_at?: string
          created_by?: string | null
          destination?: string | null
          driver_id?: string | null
          eta?: string | null
          harvest_date?: string | null
          id?: string
          is_demo?: boolean
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
          advice?: Json | null
          agent_id?: string | null
          cold_stored?: boolean
          created_at?: string
          created_by?: string | null
          destination?: string | null
          driver_id?: string | null
          eta?: string | null
          harvest_date?: string | null
          id?: string
          is_demo?: boolean
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
            foreignKeyName: "shipments_created_by_fkey"
            columns: ["created_by"]
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
          consent_version: string | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          id: string
          language: string
          location_consent: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          verification_level: Database["public"]["Enums"]["verification_level"]
        }
        Insert: {
          agent_id?: string | null
          consent_version?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          id: string
          language?: string
          location_consent?: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          verification_level?: Database["public"]["Enums"]["verification_level"]
        }
        Update: {
          agent_id?: string | null
          consent_version?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          id?: string
          language?: string
          location_consent?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          verification_level?: Database["public"]["Enums"]["verification_level"]
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
      verifications: {
        Row: {
          cert_version: string | null
          consent_version: string | null
          created_at: string
          id: number
          last4: string | null
          method: Database["public"]["Enums"]["verification_method"]
          user_id: string
          verdict: Database["public"]["Enums"]["verification_verdict"]
          verified_by: string | null
        }
        Insert: {
          cert_version?: string | null
          consent_version?: string | null
          created_at?: string
          id?: never
          last4?: string | null
          method: Database["public"]["Enums"]["verification_method"]
          user_id: string
          verdict: Database["public"]["Enums"]["verification_verdict"]
          verified_by?: string | null
        }
        Update: {
          cert_version?: string | null
          consent_version?: string | null
          created_at?: string
          id?: never
          last4?: string | null
          method?: Database["public"]["Enums"]["verification_method"]
          user_id?: string
          verdict?: Database["public"]["Enums"]["verification_verdict"]
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifications_verified_by_fkey"
            columns: ["verified_by"]
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
      latest_risk: {
        Row: {
          confidence: Database["public"]["Enums"]["confidence_level"] | null
          flash_flood: number | null
          h3_index: string | null
          horizon_hours: number | null
          id: number | null
          landslide: number | null
          level: string | null
          model_version: string | null
          overall: number | null
          reason: string | null
          reason_code: string | null
          reason_params: Json | null
          risk_high: number | null
          risk_low: number | null
          rockfall: number | null
          run_at: string | null
          snow_ice: number | null
          top_hazard: Database["public"]["Enums"]["hazard_type"] | null
          zone_id: number | null
          zone_name: string | null
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
      public_reports: {
        Row: {
          confirmations: number | null
          created_at: string | null
          expires_at: string | null
          has_photo: boolean | null
          hazard_type: Database["public"]["Enums"]["hazard_type"] | null
          id: string | null
          is_demo: boolean | null
          location: unknown
          note: string | null
          source: Database["public"]["Enums"]["report_source"] | null
          status: Database["public"]["Enums"]["report_status"] | null
          zone_id: number | null
        }
        Insert: {
          confirmations?: number | null
          created_at?: string | null
          expires_at?: string | null
          has_photo?: never
          hazard_type?: Database["public"]["Enums"]["hazard_type"] | null
          id?: string | null
          is_demo?: boolean | null
          location?: unknown
          note?: string | null
          source?: Database["public"]["Enums"]["report_source"] | null
          status?: Database["public"]["Enums"]["report_status"] | null
          zone_id?: number | null
        }
        Update: {
          confirmations?: number | null
          created_at?: string | null
          expires_at?: string | null
          has_photo?: never
          hazard_type?: Database["public"]["Enums"]["hazard_type"] | null
          id?: string | null
          is_demo?: boolean | null
          location?: unknown
          note?: string | null
          source?: Database["public"]["Enums"]["report_source"] | null
          status?: Database["public"]["Enums"]["report_status"] | null
          zone_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_set_role: {
        Args: {
          p_reason: string
          p_request_id?: string
          p_role: Database["public"]["Enums"]["user_role"]
          p_target: string
        }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      write_audit: {
        Args: {
          p_action: string
          p_meta?: Json
          p_reason?: string
          p_request_id?: string
          p_target_id?: string
          p_target_type?: string
        }
        Returns: number
      }
    }
    Enums: {
      confidence_level: "low" | "medium" | "high"
      flag_reason:
        | "not_there"
        | "wrong_place"
        | "duplicate"
        | "offensive"
        | "other"
      hazard_type:
        | "landslide"
        | "rockfall"
        | "flash_flood"
        | "snow_ice"
        | "accident"
        | "other"
      official_update_kind: "closure" | "one_way" | "reopened" | "advisory"
      report_source: "driver" | "police" | "admin"
      report_status:
        | "unconfirmed"
        | "confirmed"
        | "expired"
        | "resolved"
        | "hidden"
      road_state: "open" | "closed" | "unknown"
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
      verification_level:
        | "none"
        | "email"
        | "agent_vouched"
        | "aadhaar_qr"
        | "official"
      verification_method: "agent_vouch" | "aadhaar_qr" | "admin"
      verification_verdict: "verified" | "manual_review" | "rejected"
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
      flag_reason: [
        "not_there",
        "wrong_place",
        "duplicate",
        "offensive",
        "other",
      ],
      hazard_type: [
        "landslide",
        "rockfall",
        "flash_flood",
        "snow_ice",
        "accident",
        "other",
      ],
      official_update_kind: ["closure", "one_way", "reopened", "advisory"],
      report_source: ["driver", "police", "admin"],
      report_status: [
        "unconfirmed",
        "confirmed",
        "expired",
        "resolved",
        "hidden",
      ],
      road_state: ["open", "closed", "unknown"],
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
      verification_level: [
        "none",
        "email",
        "agent_vouched",
        "aadhaar_qr",
        "official",
      ],
      verification_method: ["agent_vouch", "aadhaar_qr", "admin"],
      verification_verdict: ["verified", "manual_review", "rejected"],
    },
  },
} as const
