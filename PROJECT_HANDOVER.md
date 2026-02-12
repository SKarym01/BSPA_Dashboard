# Project Handover & Architecture Documentation

**Generated on:** 2026-02-12
**Project Name:** BSPA Dashboard (Brake System Parameter Analysis)
**Framework:** Angular (Standalone Components) + Tailwind CSS

This document provides a comprehensive technical overview of the BSPA Dashboard project. It is designed to allow another AI agent or developer to immediately understand the architecture, logic, and state of the application.

---

## 1. Project Overview & Workflow

The **BSPA Dashboard** is a web application for configuring and running brake system simulations.

### Core Workflow Steps
1.  **Project Setup (`CUSTOMER_DATA`)**:
    *   User enters an **EPC Number** (optional, triggers comparison logic).
    *   User uploads an **Excel Parameter Sheet** (parsed dynamically) OR skips to manual entry.
2.  **Validation (`INPUT_SHEET`)**:
    *   User reviews extracted parameters.
    *   System validates data based on `MandatoryStatus`.
    *   System compares inputs against "EPC Spec" (if EPC provided).
    *   User can use "Fill Defaults" or "AI Estimation" tools.
3.  **Simulation (`MAMBA`)**:
    *   User triggers the "Mamba" simulation (currently mocked service).
4.  **Results (`RESULTS`)**:
    *   User views success message/results.

---

## 2. Key Architecture & Services

### A. Data Service (`src/app/services/data.service.ts`)
**Role:** Global State Singleton.
*   **`parameterGroups`**: The source of truth for all vehicle parameters (grouped).
    *   *Structure*: `ParameterGroup[]` -> `ParameterRow[]`.
    *   *Key Fields*: `id`, `name`, `unit`, `mandatoryStatus` ('mandatory'|'semi-mandatory'|'optional'), `defaultValue`.
*   **`variants`**: Stores the current working data.
    *   *Structure*: `ProductVariant[]` -> `values: { [paramId]: ParameterValue }`.
    *   *`ParameterValue`*: `{ value: any, source: 'Manual'|'Input Sheet'|'Estimated'|'Default', isMissing: boolean }`.
*   **`epcNumber`**: Stores the current project EPC.
*   **`getMockEpcData(epc)`**: Returns mock spec data `{ paramId: value }` for comparison.

### B. Mamba Service (`src/app/services/mamba.service.ts`)
**Role:** Simulation Client.
*   **Current State:** Mocked. `runSimulation()` returns a delayed Observable.

### C. Excel Extractor (`src/app/utils/excel-extractor.ts`)
**Role:** Excel Parsing Logic.
*   **Input**: Raw 2D array from `xlsx` read.
*   **Logic**: Iterates through rows. Uses **fuzzy string matching** or exact inclusion to find Parameter Names in the sheet. Extracts the value from the adjacent right cell.

---

## 3. UI Logic & Components

### A. New BSPA Component (`src/app/components/new-bspa/`)
**Role:** Monitors the Wizard/Workflow.
*   **File**: `new-bspa.component.ts`
    *   **`isMissing(id)`**: Returns `true` if value is null/undefined/empty.
    *   **`isEpcMismatch(id)`**: Returns `true` if `Input Value != EPC Spec Value`.
    *   **`autofillDefaults()`**: Iterates all parameters. If missing & has `defaultValue`, sets value and marks source as 'Default'.
    *   **`runAiEstimation()`**: Triggers `dataService.estimateMissingValues` (mocks AI fill).
*   **Template**: `new-bspa.component.html` (Redesigned Step 2)
    *   **Layout**: Clean 3-column table (Parameter, Value/Spec, Status).
    *   **Styling**: See Validation Logic below.

### B. Dashboard (`src/app/components/home/`)
**Role:** Landing Page.
*   **Logic**: Displays lists of "Drafts" and "Recent Projects" from `DataService.drafts`.
*   **Metrics**: Shows "Active Projects" and "Running Simulations".

---

## 4. Validation & visual Logic (Critical)

The Validation Table uses a strict color-coding system based on `mandatoryStatus`.

| Type | Status Key | Missing/Empty Behavior | Color | Action |
| :--- | :--- | :--- | :--- | :--- |
| **Mandatory** | `mandatory` | **Blocker** | **Red** Border/Dot | Must fill manually. |
| **Semi-Mandatory**| `semi-mandatory` | **Warning** | **Orange** Border/Dot | Can use "Fill Defaults" or "AI Estimate". |
| **Optional** | `optional` | **Info** | **Blue** Border/Dot | Can be ignored. |

### Comparison Logic
*   **Trigger**: User enters an EPC Number in Step 1.
*   **Display**: A "Spec: [Value]" line appears below the input field in Step 2.
*   **Mismatch**: If the input does not match the Spec, the Spec Value turns **Red** with a warning icon.

### Text Source Styling
*   **Bold Black**: Imported from Excel (`Source: 'Input Sheet'`).
*   **Italic Blue**: Auto-filled (`Source: 'Default'` or `'Estimated'`).
*   **Gray**: Manually entered (`Source: 'Manual'`).

---

## 5. File Structure Reference
```
src/
├── app/
│   ├── components/
│   │   ├── home/           # Dashboard
│   │   ├── new-bspa/       # Main Workflow (Upload -> Validate -> Sim)
│   │   └── shared/         # (TrustIndicator is deprecated)
│   ├── services/
│   │   ├── data.service.ts # Core State & Models
│   │   └── mamba.service.ts# Simulation Mock
│   ├── utils/
│   │   └── excel-extractor.ts # Parsing Logic
│   └── app.component.html  # Main Shell
└── styles.css              # Tailwind Config
```

## 6. Next Steps for AI Agent
To continue development, focus on:
1.  **Backend Integration**: Connect `DataService` to a real backend API instead of mock arrays.
2.  **Mamba API**: Replace `MambaService` mock with real HTTP calls.
3.  **Excel Robustness**: Enhance `excel-extractor.ts` for more complex sheet layouts.
