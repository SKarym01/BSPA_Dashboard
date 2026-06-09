import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { EvaluationsApiService, HealthResponse } from '../../core/api/evaluations-api.service';

@Component({
  selector: 'app-backend-check',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section style="max-width:560px;margin:48px auto;padding:24px;font-family:system-ui,sans-serif;">
      <h1 style="margin:0 0 4px;font-size:20px;">Backend Connectivity Check</h1>
      <p style="margin:0 0 16px;color:#64748b;font-size:13px;">
        GET {{ url }}
      </p>

      <div *ngIf="loading"
           style="padding:12px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;color:#475569;font-size:14px;">
        Prüfe Verbindung …
      </div>

      <div *ngIf="!loading && ok"
           style="padding:12px;border:1px solid #bbf7d0;border-radius:6px;background:#f0fdf4;color:#166534;font-size:14px;">
        <strong>Backend erreichbar.</strong>
        <pre style="margin:8px 0 0;font-size:12px;white-space:pre-wrap;">{{ response | json }}</pre>
      </div>

      <div *ngIf="!loading && error"
           style="padding:12px;border:1px solid #fecaca;border-radius:6px;background:#fef2f2;color:#991b1b;font-size:14px;">
        <strong>Backend nicht erreichbar.</strong>
        <div style="margin-top:4px;font-size:13px;">{{ error }}</div>
      </div>

      <button type="button" (click)="check()"
              [disabled]="loading"
              style="margin-top:16px;padding:8px 14px;border-radius:6px;border:0;
                     background:#0f172a;color:#fff;font-size:13px;font-weight:600;
                     cursor:pointer;">
        {{ loading ? 'Lädt …' : 'Erneut prüfen' }}
      </button>
    </section>
  `,
})
export class BackendCheckComponent implements OnInit {
  readonly url: string;
  loading = false;
  ok = false;
  response: HealthResponse | null = null;
  error: string | null = null;

  constructor(private api: EvaluationsApiService) {
    this.url = this.api.healthUrl;
  }

  ngOnInit(): void {
    this.check();
  }

  check(): void {
    this.loading = true;
    this.ok = false;
    this.error = null;
    this.response = null;

    this.api.health().subscribe({
      next: (res) => {
        this.response = res;
        this.ok = true;
        this.loading = false;
      },
      error: (err: HttpErrorResponse) => {
        this.error =
          err.status === 0
            ? `Keine Verbindung zum Backend (${this.url}).`
            : `HTTP ${err.status} ${err.statusText || ''} – ${
                (err.error as any)?.detail ?? err.message
              }`;
        this.loading = false;
      },
    });
  }
}
