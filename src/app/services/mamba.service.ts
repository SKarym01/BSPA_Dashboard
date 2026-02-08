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
        console.log(`[MAMBA] Inspecting Trust Levels...`);

        // Check if any critical params are missing trust
        const lowTrustParams = Object.values(variant.values).filter(v => v.trustLevel < 3);
        if (lowTrustParams.length > 5) {
            console.warn(`[MAMBA] Warning: multiple low-trust parameters detected.`);
        }

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
        // Randomly simulate failure based on "missing data" logic from DataService?
        // Actually, let's make it deterministic: if "Project Name" contains "FAIL", fail it.
        // Or if trust levels are terrible.

        const trustSum = Object.values(variant.values).reduce((acc, val) => acc + (val.trustLevel || 0), 0);
        const count = Object.values(variant.values).length || 1;
        const avgTrust = trustSum / count;

        const isSuccess = Math.random() > 0.2; // 80% chance of success generally

        if (!isSuccess) {
            return {
                success: false,
                simulationId: 'SIM-' + Math.floor(Math.random() * 99999),
                timestamp: new Date(),
                warnings: ['Critical parameter out of bounds', 'Model convergence failure'],
                metrics: { trustScore: 0, performanceIndex: 0 }
            };
        }

        return {
            success: true,
            simulationId: 'SIM-' + Math.floor(Math.random() * 99999),
            timestamp: new Date(),
            warnings: avgTrust < 3 ? ['Low trust input data - verify results manually'] : [],
            metrics: {
                trustScore: Math.round(avgTrust * 20), // Convert 5-scale to 100
                performanceIndex: 95
            },
            reportUrl: 'http://mock-mamba-report.pdf'
        };
    }
}
