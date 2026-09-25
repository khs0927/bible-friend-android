
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "ai_usage": {
                  Row: {
                    "guardian_id": string,"kind": string,"units": number,"usage_date": string
                  }
                  Insert: {
                    "guardian_id": string,"kind": string,"units"?: number,"usage_date": string
                  }
                  Update: {
                    "guardian_id"?: string,"kind"?: string,"units"?: number,"usage_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_usage_guardian_id_fkey"
      columns: ["guardian_id"]
isOneToOne: false
      referencedRelation: "guardians"
      referencedColumns: ["id"]
    }
                  ]
                },"chat_messages": {
                  Row: {
                    "child_id": string,"content": string,"created_at": string,"flagged": boolean,"id": number,"role": string,"story_id": string | null
                  }
                  Insert: {
                    "child_id": string,"content": string,"created_at"?: string,"flagged"?: boolean,"id"?: never,"role": string,"story_id"?: string | null
                  }
                  Update: {
                    "child_id"?: string,"content"?: string,"created_at"?: string,"flagged"?: boolean,"id"?: never,"role"?: string,"story_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "chat_messages_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    }
                  ]
                },"children": {
                  Row: {
                    "avatar": string,"birth_year": number | null,"created_at": string,"guardian_id": string,"id": string,"nickname": string,"updated_at": string
                  }
                  Insert: {
                    "avatar"?: string,"birth_year"?: number | null,"created_at"?: string,"guardian_id": string,"id"?: string,"nickname": string,"updated_at"?: string
                  }
                  Update: {
                    "avatar"?: string,"birth_year"?: number | null,"created_at"?: string,"guardian_id"?: string,"id"?: string,"nickname"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "children_guardian_id_fkey"
      columns: ["guardian_id"]
isOneToOne: false
      referencedRelation: "guardians"
      referencedColumns: ["id"]
    }
                  ]
                },"favorite_verses": {
                  Row: {
                    "child_id": string,"created_at": string,"id": string,"verse_ref": string,"verse_text": string
                  }
                  Insert: {
                    "child_id": string,"created_at"?: string,"id"?: string,"verse_ref": string,"verse_text": string
                  }
                  Update: {
                    "child_id"?: string,"created_at"?: string,"id"?: string,"verse_ref"?: string,"verse_text"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "favorite_verses_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    }
                  ]
                },"growth_events": {
                  Row: {
                    "activity": string,"child_id": string,"created_at": string,"event_key": string,"id": number,"reward": NonNullable<Json>,"source_id": string
                  }
                  Insert: {
                    "activity": string,"child_id": string,"created_at"?: string,"event_key": string,"id"?: never,"reward"?: NonNullable<Json>,"source_id": string
                  }
                  Update: {
                    "activity"?: string,"child_id"?: string,"created_at"?: string,"event_key"?: string,"id"?: never,"reward"?: NonNullable<Json>,"source_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "growth_events_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    }
                  ]
                },"growth_profiles": {
                  Row: {
                    "child_id": string,"profile": NonNullable<Json>,"updated_at": string
                  }
                  Insert: {
                    "child_id": string,"profile": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "child_id"?: string,"profile"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "growth_profiles_child_id_fkey"
      columns: ["child_id"]
isOneToOne: true
      referencedRelation: "children"
      referencedColumns: ["id"]
    }
                  ]
                },"guardians": {
                  Row: {
                    "consent_version": string | null,"consented_at": string | null,"created_at": string,"display_name": string | null,"id": string,"marketing_opt_in": boolean,"updated_at": string
                  }
                  Insert: {
                    "consent_version"?: string | null,"consented_at"?: string | null,"created_at"?: string,"display_name"?: string | null,"id": string,"marketing_opt_in"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "consent_version"?: string | null,"consented_at"?: string | null,"created_at"?: string,"display_name"?: string | null,"id"?: string,"marketing_opt_in"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"prayer_notes": {
                  Row: {
                    "answered_at": string | null,"body": string,"child_id": string,"created_at": string,"gratitude": string | null,"id": string,"status": string,"verse_ref": string | null,"verse_text": string | null
                  }
                  Insert: {
                    "answered_at"?: string | null,"body": string,"child_id": string,"created_at"?: string,"gratitude"?: string | null,"id"?: string,"status"?: string,"verse_ref"?: string | null,"verse_text"?: string | null
                  }
                  Update: {
                    "answered_at"?: string | null,"body"?: string,"child_id"?: string,"created_at"?: string,"gratitude"?: string | null,"id"?: string,"status"?: string,"verse_ref"?: string | null,"verse_text"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "prayer_notes_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    }
                  ]
                },"treasure_cards": {
                  Row: {
                    "card_id": string,"child_id": string,"collected_at": string,"id": string
                  }
                  Insert: {
                    "card_id": string,"child_id": string,"collected_at"?: string,"id"?: string
                  }
                  Update: {
                    "card_id"?: string,"child_id"?: string,"collected_at"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "treasure_cards_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "consume_ai_quota":
{ Args: { "p_guardian_id": string,"p_kind": string,"p_limit": number,"p_units": number }; Returns: boolean
                           },
"owns_child":
{ Args: { "p_child_id": string }; Returns: boolean
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const

