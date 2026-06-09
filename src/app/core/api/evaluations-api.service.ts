import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface HealthResponse {
  status: string;
  version?: string;
  [key: string]: unknown;
}

export interface EvaluationDetail {
  id: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  label?: string | null;
  created_at: string;
  input_path: string;
  rules_path?: string | null;
  message?: string | null;
}

export interface ValidationFindingDto {
  group: string;
  code: string;
  severity: string;
  message: string;
  parameter_name?: string | null;
}

export interface ValidationParameterGroupDto {
  name: string;
  findings: ValidationFindingDto[];
}

export interface ValidationCurvePointDto {
  x: number;
  y: number;
}

export interface ValidationCurveSeriesDto {
  label: string;
  values: number[];
}

export interface ValidationCurveDto {
  name: string;
  points: ValidationCurvePointDto[];
  series: ValidationCurveSeriesDto[];
}

export interface AppliedDefaultViewDto {
  parameter_name: string;
  default_value: unknown;
  parent_component_type: string;
  conditions: string;
  score_param: number;
  score_parent: number;
}

export interface ExtractedParameterViewDto {
  name: string;
  value: unknown;
  source: string;
  group_name?: string | null;
}

export interface ValidationSummaryViewDto {
  ready_for_calculation: boolean;
  missing_required_count: number;
  missing_assumed_count: number;
  plausibility_warning_count: number;
  default_applied_count: number;
  total_findings_count: number;
}

export interface ValidationVariantViewDto {
  variant_name: string;
  extracted_parameters: ExtractedParameterViewDto[];
  parameter_groups: ValidationParameterGroupDto[];
  findings: ValidationFindingDto[];
  summary: ValidationSummaryViewDto;
  curves: ValidationCurveDto[];
  applied_defaults: AppliedDefaultViewDto[];
}

export interface ValidationViewDto {
  generated_at: string;
  input_sheet_name: string;
  active_internal_ids: string[];
  project_info: Record<string, string>;
  feature_context: Record<string, unknown>;
  selected_features: Record<string, unknown>;
  variant_definitions: Array<Record<string, string>>;
  variants: ValidationVariantViewDto[];
}

export interface EvaluationDetailWithValidationDto {
  evaluation: EvaluationDetail;
  validation_view: ValidationViewDto | null;
}

@Injectable({ providedIn: 'root' })
export class EvaluationsApiService {
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/+$/, '');

  constructor(private readonly http: HttpClient) {}

  get healthUrl(): string {
    return `${this.baseUrl}/health`;
  }

  health(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(this.healthUrl);
  }

  uploadEvaluation(inputFile: File, options?: {
    label?: string;
    rulesFile?: File | null;
  }): Observable<EvaluationDetailWithValidationDto> {
    const formData = new FormData();
    formData.append('input_file', inputFile, inputFile.name);

    if (options?.rulesFile) {
      formData.append('rules_file', options.rulesFile, options.rulesFile.name);
    }
    if (options?.label?.trim()) {
      formData.append('label', options.label.trim());
    }

    return this.http.post<EvaluationDetailWithValidationDto>(`${this.baseUrl}/evaluations/upload`, formData);
  }

  getEvaluation(evaluationId: string): Observable<EvaluationDetailWithValidationDto> {
    return this.http.get<EvaluationDetailWithValidationDto>(`${this.baseUrl}/evaluations/${evaluationId}`);
  }
}
