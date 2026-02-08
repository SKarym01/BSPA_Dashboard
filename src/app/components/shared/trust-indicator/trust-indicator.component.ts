import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-trust-indicator',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="flex items-center gap-1 cursor-pointer group" (click)="cycleTrust()">
        <!-- Trust Level Visualization: 5 Bars -->
        <div class="flex gap-0.5">
            <div *ngFor="let bar of [1,2,3,4,5]" 
                 class="w-1.5 h-4 rounded-sm transition-all duration-300"
                 [ngClass]="getBarClass(bar)">
            </div>
        </div>
        
        <!-- Tooltip/Label (Visible on Hover) -->
        <span class="text-xs text-slate-400 group-hover:text-slate-200 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {{ getTrustLabel() }}
        </span>
    </div>
  `,
    styles: []
})
export class TrustIndicatorComponent {
    @Input() level: number = 0; // 1-5
    @Output() levelChange = new EventEmitter<number>();
    @Input() readonly: boolean = false;

    getBarClass(barIndex: number): string {
        if (this.level >= barIndex) {
            // Active Bar Colors
            if (this.level <= 2) return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]';
            if (this.level <= 4) return 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]';
            return 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]';
        }
        // Inactive Bar
        return 'bg-slate-200';
    }

    getTrustLabel(): string {
        switch (this.level) {
            case 1: return 'Very Low Trust';
            case 2: return 'Low Trust';
            case 3: return 'Medium Trust';
            case 4: return 'High Trust';
            case 5: return 'Verified (OEM/RB)';
            default: return 'No Trust Data';
        }
    }

    cycleTrust() {
        if (this.readonly) return;
        let newLevel = this.level + 1;
        if (newLevel > 5) newLevel = 1;
        this.level = newLevel;
        this.levelChange.emit(this.level);
    }
}
