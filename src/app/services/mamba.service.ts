import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay, tap } from 'rxjs/operators';
import { DataService, ProductVariant } from './data.service';

export interface MambaResult {
    success: boolean;
    simulationId: string;
    timestamp: Date;
    warnings: string[];
    metrics: {
        trustScore: number; // 0-100
        performanceIndex: number;
    };
    reportUrl?: string; // Mock URL for download
}

@Injectable({
    providedIn: 'root'
})
export class MambaService {

    constructor(private dataService: DataService) { }

    /**
     * Simulates sending data to MAMBA for evaluation.
     * Checks for "Blockers" (missing critical values) first.
     */
    runSimulation(variant: ProductVariant): Observable<MambaResult> {
        console.log(`[MAMBA] Sending Variant: ${variant.name} to Simulation Engine...`);

        // Simulate Network Delay
        return of(this.mockMambaLogic(variant)).pipe(
            delay(3000), // 3 seconds simulation time
            tap(result => {
                if (!result.success) {
                    console.error('[MAMBA] Simulation Failed:', result.warnings);
                } else {
                    console.log('[MAMBA] Simulation Complete:', result);
                }
            })
        );
    }

    private mockMambaLogic(variant: ProductVariant): MambaResult {
        // Randomly simulate success/failure
        const isSuccess = Math.random() > 0.1; // 90% chance of success generally

        if (!isSuccess) {
            return {
                success: false,
                simulationId: 'SIM-' + Math.floor(Math.random() * 99999),
                timestamp: new Date(),
                warnings: ['Critical parameter out of bounds', 'Model convergence failure'],
                metrics: { trustScore: 0, performanceIndex: 0 }
            };
        }

        // Calculate a mock score based on data completeness
        const filledParams = Object.values(variant.values).filter(v => !v.isMissing).length;
        const totalParams = Object.keys(variant.values).length || 1;
        const completeness = (filledParams / totalParams) * 100;

        return {
            success: true,
            simulationId: 'SIM-' + Math.floor(Math.random() * 99999),
            timestamp: new Date(),
            warnings: [],
            metrics: {
                trustScore: Math.round(completeness), // Use completeness as "Trust Score" mock
                performanceIndex: 95
            },
            reportUrl: 'http://mock-mamba-report.pdf'
        };
    }
}
