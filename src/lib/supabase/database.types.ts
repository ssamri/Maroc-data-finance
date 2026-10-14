/** Supabase schema contract. Regenerate from the verified project after migration.
 * Raw numeric reads are JS numbers; financial presentation must use value_exact
 * from approved_observations to retain every decimal digit.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type ValidationStatus = "draft" | "pending" | "approved" | "rejected";
export type AdminRole = "reader" | "editor" | "reviewer" | "admin";
export type ObservationStatus = "observed" | "provisional" | "estimated";
export type DocumentType = "pdf" | "csv" | "xlsx" | "html" | "json";

type Timestamps = { created_at: string; updated_at: string };
type Reviewed = Timestamps & {
  id: string;
  validation_status: ValidationStatus;
  review_note: string | null;
  approved_by: string | null;
  approved_at: string | null;
};
export type AdminProfile = Timestamps & { user_id: string; display_name: string; role: AdminRole; active: boolean };
export type Institution = Reviewed & { code: string; name: string; name_translations: Json; website_url: string; country_code: string };
export type DataSource = Reviewed & { institution_id: string; name: string; source_url: string; access_method: "document" | "api" | "manual"; api_verified_at: string | null; notes: string | null };
export type SourceDocument = Reviewed & {
  data_source_id: string; institution_id: string; title: string; source_url: string;
  published_at: string; retrieved_at: string; document_type: DocumentType;
  language: "fr" | "ar" | "en"; storage_path: string | null; sha256: string | null;
  byte_size: number | null; extraction_metadata: Json;
};
export type Indicator = Reviewed & { code: string; name: string; name_translations: Json; category: "debt" | "budget" | "deficit" | "interest" | "population" | "gdp" | "comparison"; description: string };
export type IndicatorDefinition = Reviewed & {
  indicator_id: string; version: number; definition: string; unit: string; scale: number;
  economic_scope: string; frequency: "annual" | "quarterly" | "monthly" | "point_in_time";
  accounting_basis: string; comparability_notes: string | null; valid_from: string; valid_until: string | null;
};
export type Observation = Reviewed & {
  indicator_id: string; indicator_definition_id: string; value: number; unit: string;
  scale: number; economic_scope: string; period_start: string; period_end: string;
  published_at: string; institution_id: string; source_document_id: string;
  source_url: string; document_locator: string; observation_status: ObservationStatus;
  origin: "official_publisher"; version: number; previous_observation_id: string | null; created_by: string | null;
};
export type Forecast = Reviewed & {
  indicator_definition_id: string; institution_id: string; source_document_id: string;
  source_url: string; document_locator: string; published_at: string; period_start: string;
  period_end: string; value: number; lower_bound: number | null; upper_bound: number | null; assumptions: Json;
};
export type CalculationMethod = Reviewed & { code: string; version: number; name: string; description: string; formula: string; limitations: string; max_horizon_days: number };
export type Projection = Reviewed & {
  indicator_definition_id: string; calculation_method_id: string; anchor_observation_id: string;
  scenario_name: string; reference_at: string; valid_until: string; value: number;
  rate_per_second: number; assumptions: Json; provenance: "calculated_estimate"; created_by: string | null;
};
type IngestionJob = Timestamps & { id: string; source_document_id: string; status: "queued" | "running" | "completed" | "failed" | "cancelled"; parser_version: string; requested_by: string | null; started_at: string | null; completed_at: string | null; observation_count: number; error_code: string | null };
type IngestionLog = { id: number; ingestion_job_id: string; level: "info" | "warning" | "error"; message: string; details: Json; created_at: string };
type DataRevision = { id: number; observation_id: string; action: "insert" | "review" | "revision"; previous_snapshot: Json | null; new_snapshot: Json; actor_id: string | null; created_at: string };
type AuditLog = { id: number; actor_id: string | null; table_name: string; row_id: string; action: "INSERT" | "UPDATE" | "DELETE"; old_record: Json | null; new_record: Json | null; created_at: string };
type EditorialContent = Reviewed & { slug: string; title_translations: Json; body_translations: Json };

type Table<Row, Required extends keyof Row = never, Decimal extends keyof Row = never> = {
  Row: Row;
  Insert: Pick<Row, Exclude<Required, Decimal>> & Partial<Omit<Row, Required | Decimal>> &
    { [K in Extract<Required, Decimal>]: number | string } & { [K in Exclude<Decimal, Required>]?: number | string | (null extends Row[K] ? null : never) };
  Update: Partial<Omit<Row, Decimal>> & { [K in Decimal]?: number | string | (null extends Row[K] ? null : never) };
  Relationships: [];
};
export type ApprovedObservation = Omit<Observation, "value" | "scale" | "validation_status" | "review_note" | "approved_by" | "created_by" | "created_at" | "updated_at"> & { value_exact: string; scale_exact: string };
export type ApprovedForecast = Omit<Forecast, "value" | "lower_bound" | "upper_bound" | "validation_status" | "review_note" | "approved_by" | "created_at" | "updated_at"> & { value_exact: string; lower_bound_exact: string | null; upper_bound_exact: string | null };
export type ApprovedProjection = Omit<Projection, "value" | "rate_per_second" | "validation_status" | "review_note" | "approved_by" | "created_by" | "created_at" | "updated_at"> & { value_exact: string; rate_per_second_exact: string };
export type ApprovedObservationExport = {
  id: string; indicator_code: string; value_exact: string; scale_exact: string;
  unit: string; economic_scope: string; period_start: string; period_end: string;
  reference_date: string; published_at: string; source_id: string; source_url: string;
  source_document_id: string; document_title: string; document_page: number | null; document_locator: string;
  document_sha256: string | null; document_retrieved_at: string;
  observation_status: ObservationStatus; validation_status: "approved"; version: number;
  producer_name: string; definition_id: string; definition_version: number; accounting_basis: string; frequency: IndicatorDefinition["frequency"];
};

export type Database = {
  maroc_en_chiffres: {
    Tables: {
      admin_users: Table<AdminProfile, "user_id" | "display_name">;
      institutions: Table<Institution, "code" | "name" | "website_url">;
      data_sources: Table<DataSource, "institution_id" | "name" | "source_url" | "access_method">;
      source_documents: Table<SourceDocument, "data_source_id" | "institution_id" | "title" | "source_url" | "published_at" | "document_type">;
      indicators: Table<Indicator, "code" | "name" | "category" | "description">;
      indicator_definitions: Table<IndicatorDefinition, "indicator_id" | "definition" | "unit" | "economic_scope" | "frequency" | "accounting_basis" | "valid_from", "scale">;
      observations: Table<Observation, "indicator_id" | "indicator_definition_id" | "value" | "unit" | "scale" | "economic_scope" | "period_start" | "period_end" | "published_at" | "institution_id" | "source_document_id" | "source_url" | "document_locator", "value" | "scale">;
      forecasts: Table<Forecast, "indicator_definition_id" | "institution_id" | "source_document_id" | "source_url" | "document_locator" | "published_at" | "period_start" | "period_end" | "value" | "assumptions", "value" | "lower_bound" | "upper_bound">;
      calculation_methods: Table<CalculationMethod, "code" | "version" | "name" | "description" | "formula" | "limitations" | "max_horizon_days">;
      projections: Table<Projection, "indicator_definition_id" | "calculation_method_id" | "anchor_observation_id" | "scenario_name" | "reference_at" | "valid_until" | "value" | "rate_per_second" | "assumptions", "value" | "rate_per_second">;
      ingestion_jobs: Table<IngestionJob, "source_document_id" | "parser_version">;
      ingestion_logs: Table<IngestionLog, "ingestion_job_id" | "level" | "message">;
      data_revisions: Table<DataRevision, "observation_id" | "action" | "new_snapshot">;
      audit_logs: Table<AuditLog, "table_name" | "row_id" | "action">;
      editorial_content: Table<EditorialContent, "slug" | "title_translations" | "body_translations">;
    };
    Views: {
      approved_observations: { Row: ApprovedObservation; Relationships: [] };
      approved_forecasts: { Row: ApprovedForecast; Relationships: [] };
      approved_projections: { Row: ApprovedProjection; Relationships: [] };
      approved_observation_export: { Row: ApprovedObservationExport; Relationships: [] };
    };
    Functions: {
      has_admin_role: { Args: { required_roles?: AdminRole[] }; Returns: boolean };
      export_approved_observations: { Args: { p_indicator_code?: string | null }; Returns: ApprovedObservationExport[] };
      review_observation: { Args: { p_observation_id: string; p_decision: ValidationStatus; p_reason?: string | null }; Returns: Observation };
      review_source_document: { Args: { p_document_id: string; p_decision: ValidationStatus; p_reason?: string | null }; Returns: SourceDocument };
      review_registry: { Args: { p_entity: string; p_id: string; p_decision: ValidationStatus; p_reason?: string | null }; Returns: Json };
    };
    Enums: { validation_status: ValidationStatus; admin_role: AdminRole; observation_status: ObservationStatus; document_type: DocumentType; ingestion_status: IngestionJob["status"] };
    CompositeTypes: Record<string, never>;
  };
};
