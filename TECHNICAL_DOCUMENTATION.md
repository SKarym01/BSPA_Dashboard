# BSPA Dashboard Technical Documentation

**Project:** BSPA Dashboard  
**Application type:** Angular single-page web application  
**Primary purpose:** Prepare, validate, simulate, and review BSPA brake system parameter assessments  
**Last updated:** 2026-05-07  
**Repository root:** `BSPA_Dashboard-1`

---

## 1. Executive Summary

BSPA Dashboard is a frontend prototype for the BSPA workflow. It supports role-based access, project setup, Excel-based input sheet import, parameter validation, EPC comparison, mock MAMBA simulation execution, and result export.

The application is built with Angular standalone components, Tailwind CSS, and the `xlsx` package for Excel parsing and export. The current implementation stores project state in browser memory through Angular services. Backend, database, Jira, EPC, and real MAMBA integrations are represented by local mock logic and should be replaced with production API clients during the next integration phase.

---

## 2. Technology Stack

| Area | Technology | Current Version / Source |
| --- | --- | --- |
| Frontend framework | Angular | `^16.2.0` |
| Language | TypeScript | `~5.1.3` |
| Styling | Tailwind CSS | `^3.3.0` |
| Reactive state | RxJS | `~7.8.0` |
| Excel parsing/export | SheetJS `xlsx` | `^0.18.5` |
| Unit test runner | Karma + Jasmine | Angular CLI defaults |
| Package manager | npm | `package-lock.json` present |

---

## 3. Application Capabilities

### 3.1 Role Selection

The app starts with a role selection flow. The selected role is stored in `localStorage` under `bspa.dashboard.selectedRole`.

Supported roles:

| Role | Description |
| --- | --- |
| `BSPA_COORDINATION` | Full coordination and workflow execution access |
| `TPM_CUSTOMER_TEAM` | Customer-team preparation and review access with design-value restrictions |

Role permissions are defined in `src/app/services/role.service.ts`.

### 3.2 New BSPA Workflow

The main workflow is:

1. `CUSTOMER_DATA`: collect project, customer, and EPC context and optionally upload an input sheet.
2. `INPUT_SHEET`: validate imported or manually entered parameters.
3. `MAMBA`: run mock simulation.
4. `RESULTS`: display parsed result dashboard and allow Excel export.

Workflow state is managed through `DataService.currentWorkflowStep$`.

### 3.3 Minor BSPA / Validation Sheet

The `/minor`, `/sheet`, and `/validation` routes open the parameter validation sheet view. This view supports multi-variant editing, mandatory/semi-mandatory/optional validation states, trust-level selection, EPC mismatch visualization, curve visualization, curve matrix editing, draft save, and handoff into the New BSPA simulation step.

### 3.4 Excel Input Sheet Import

Input sheet upload accepts `.xlsx`, `.xlsm`, `.xls`, and `.xlsb`.

The import flow:

1. User selects an Excel file in `NewBspaComponent`.
2. File is read with `FileReader`.
3. Workbook is parsed with SheetJS.
4. First worksheet is converted to a two-dimensional array.
5. `ExcelExtractor` attempts structured matrix parsing.
6. If matrix parsing fails, the extractor falls back to discovered parameter groups and fuzzy row/value matching.
7. Parsed parameter groups and variants are written into `DataService`.
8. The user is routed to `/validation`.

### 3.5 Result Sheet Parsing

The script `generate_results_json.js` parses `src/app/Result_Sheet_20260205_16h17m55s_OC13_EMB.xlsx`. It reads the `Detailed evaluation` and `Summary` worksheets and generates `src/app/utils/parsed-results.data.ts`.

The generated file exports `PARSED_RESULTS_DATA`, which is used by the results view after mock MAMBA completion.

### 3.6 Results Export

`NewBspaComponent.exportResultsToExcel()` exports result data into a workbook with `Overview`, `Summary`, and `Detailed Results` sheets.

The export filename format is:

```text
bspa_simulation_results_<EPC>_<YYYYMMDD_HHMM>.xlsx
```

---

## 4. Project Structure

```text
BSPA_Dashboard-1/
|-- angular.json
|-- package.json
|-- README.md
|-- TECHNICAL_DOCUMENTATION.md
|-- PROJECT_HANDOVER.md
|-- generate_results_json.js
|-- generate_mock_results.js
|-- dump_xls.js
|-- public/
|-- src/
|   |-- index.html
|   |-- main.ts
|   |-- styles.css
|   |-- assets/
|   |-- app/
|       |-- app.component.ts
|       |-- app.component.html
|       |-- app.routes.ts
|       |-- guards/
|       |-- services/
|       |-- components/
|       |-- utils/
```

Important source folders:

| Path | Purpose |
| --- | --- |
| `src/app/components/home` | Dashboard landing page and project overview |
| `src/app/components/new-bspa` | Main new BSPA workflow, upload, simulation, and results |
| `src/app/components/sheet` | Parameter validation sheet and curve UI |
| `src/app/components/check-status` | Status lookup form |
| `src/app/components/role-selector` | Initial role selection |
| `src/app/components/header` | Global header |
| `src/app/components/sidebar` | Navigation sidebar |
| `src/app/services/data.service.ts` | In-memory application state and parameter model |
| `src/app/services/role.service.ts` | Role and permission model |
| `src/app/services/mamba.service.ts` | Mock MAMBA simulation client |
| `src/app/guards/role-feature.guard.ts` | Route-level feature guard |
| `src/app/utils/excel-extractor.ts` | Excel parsing and matrix extraction |
| `src/app/utils/text-norm.ts` | Text normalization and fuzzy matching helpers |
| `src/app/utils/parsed-results.data.ts` | Generated parsed result data |
| `src/app/utils/mock-results.data.ts` | Static fallback result data |

---

## 5. Routing

Routes are defined in `src/app/app.routes.ts`.

| Route | Component | Guarded Feature | Purpose |
| --- | --- | --- | --- |
| `/` | Redirect | None | Redirects to `/home` |
| `/home` | `HomeComponent` | None | Dashboard landing page |
| `/new` | `NewBspaComponent` | `access_new_workflow` | New BSPA workflow |
| `/minor` | `SheetComponent` | `access_minor_workflow` | Minor BSPA parameter sheet |
| `/check` | `CheckStatusComponent` | `access_status_check` | Status check form |
| `/sheet` | `SheetComponent` | `access_validation` | Parameter validation sheet |
| `/validation` | `SheetComponent` | `access_validation` | Parameter validation sheet |

If the user has not selected a role, guarded routes redirect to `/home`.

---

## 6. Core Data Model

The central data model lives in `src/app/services/data.service.ts`.

### 6.1 Workflow State

```ts
export type WorkflowStep =
  | 'CUSTOMER_DATA'
  | 'RB_DATA'
  | 'INPUT_SHEET'
  | 'P_TRIGGER'
  | 'DASHBOARD'
  | 'MAMBA'
  | 'RESULTS';
```

Only a subset is currently active in the UI:

```text
CUSTOMER_DATA -> INPUT_SHEET -> MAMBA -> RESULTS
```

### 6.2 Parameter Groups

```ts
export interface ParameterGroup {
  groupName: string;
  parameters: ParameterRow[];
}
```

Each parameter contains:

```ts
export interface ParameterRow {
  id: string;
  name: string;
  unit?: string;
  userComment?: string;
  checkStatus?: CheckStatus;
  type: 'text' | 'number' | 'select' | 'curve';
  options?: string[];
  mandatoryStatus: MandatoryStatus;
  defaultValue?: any;
  isSimulationRelevant?: boolean;
}
```

### 6.3 Variants

```ts
export interface ProductVariant {
  id: string;
  name: string;
  values: { [paramId: string]: ParameterValue };
}
```

Each parameter value stores both value and provenance:

```ts
export interface ParameterValue {
  value: any;
  source: 'Manual' | 'Imported' | 'Estimation';
  isMissing?: boolean;
  trustLevel?: TrustLevel;
}
```

### 6.4 Trust Levels

```text
Not set
Design value
Estimation
From customer
Imported
From EPC
```

`Design value` has special role restrictions. TPM users cannot edit values currently marked as design values.

---

## 7. Services

### 7.1 DataService

File: `src/app/services/data.service.ts`

Responsibilities:

- Stores active project metadata.
- Stores status check form data.
- Stores draft projects.
- Stores parameter group definitions.
- Stores variant values.
- Publishes workflow step changes through `BehaviorSubject`.
- Provides helper methods for setting values, resetting state, estimating missing values, validating mandatory fields, and generating mock EPC data.

Important methods:

| Method | Purpose |
| --- | --- |
| `updateWorkflowStep(step)` | Changes current workflow state |
| `resetProjectData()` | Clears active project, status check, and variant values |
| `setParameterValue(...)` | Writes a value with source/trust metadata |
| `estimateValueForField(...)` | Mock-estimates one missing text/number field |
| `estimateMissingValues()` | Mock-estimates all eligible missing values |
| `validateForMamba()` | Returns missing mandatory parameter names |
| `getMockEpcData(epc)` | Generates mock EPC comparison data |

Important note: the constructor currently randomizes `mandatoryStatus` values for prototype purposes. This should be removed or replaced with deterministic backend/template data before production use.

### 7.2 RoleService

File: `src/app/services/role.service.ts`

Responsibilities:

- Defines available roles.
- Defines permission matrix.
- Persists selected role to `localStorage`.
- Exposes `can(feature)` checks for components and guards.

### 7.3 MambaService

File: `src/app/services/mamba.service.ts`

Responsibilities:

- Provides `runSimulation(variant)`.
- Returns a delayed mock `Observable<MambaResult>`.
- Calculates mock trust score from completeness.
- Randomly simulates failure in about 10 percent of runs.

Production replacement should call a backend API or MAMBA integration gateway instead of returning local mock data.

---

## 8. Components

### 8.1 App Component

File: `src/app/app.component.ts`

Responsibilities:

- Root shell.
- Imports header, sidebar, router outlet, and role selector.
- Stores currently hardcoded user profile information.
- Handles home navigation and first-time role selection.

### 8.2 HomeComponent

File: `src/app/components/home/home.component.ts`

Responsibilities:

- Displays drafts and recent project metrics.
- Calculates active and completed project counts from `DataService.drafts`.

### 8.3 NewBspaComponent

File: `src/app/components/new-bspa/new-bspa.component.ts`

Responsibilities:

- Drives the new BSPA workflow.
- Handles input sheet upload.
- Extracts project metadata from Excel.
- Loads mock EPC comparison values.
- Handles parameter editing and trust levels.
- Runs AI estimation for the active input.
- Saves drafts.
- Starts mock MAMBA simulation.
- Loads parsed result data after simulation.
- Exports results to Excel.

### 8.4 SheetComponent

File: `src/app/components/sheet/sheet.component.ts`

Responsibilities:

- Displays and edits parameter groups and variants.
- Validates mandatory fields before BSPA start.
- Handles EPC mismatch display.
- Handles trust-level restrictions.
- Displays and edits curve values.
- Provides chart and matrix data for curve parameters.
- Routes into `/new` to continue with simulation.

### 8.5 CheckStatusComponent

File: `src/app/components/check-status/check-status.component.ts`

Responsibilities:

- Validates that Jira ticket number, BSPA number, and EPC number are entered.
- Routes to `/sheet` after successful validation.

Current implementation does not call a backend status API.

### 8.6 RoleSelectorComponent

File: `src/app/components/role-selector/role-selector.component.ts`

Responsibilities:

- Presents available role options.
- Emits selected role to the root component.

---

## 9. Excel Extraction Architecture

File: `src/app/utils/excel-extractor.ts`

`ExcelExtractor` accepts a two-dimensional array created from SheetJS and provides multiple extraction strategies.

### 9.1 Main Entry Points

| Method | Purpose |
| --- | --- |
| `parseMatrixFromSheet()` | Parses full parameter/variant matrix layout |
| `discoverParameterGroups()` | Discovers parameter groups from sheet structure |
| `extractAllParameters(groups)` | Fuzzy-matches known parameters and extracts adjacent values |
| `extractAllParametersWithColumns(groups)` | Extracts values across row columns |
| `extractProjectDescription()` | Extracts project description key/value rows |

### 9.2 Matching Strategy

The extractor uses text normalization from `text-norm.ts`, token-set fuzzy scoring, label detection heuristics, matrix header discovery, unit/check/comment column detection, and curve block configuration for known curve layouts.

Minimum fuzzy match score is currently `88`.

### 9.3 Curve Parsing

Known curve blocks include:

- `pV Curve of one front wheel`
- `pV Curve of one rear wheel`
- `PV Curve of peripherals: DPB<->ESP connection line only`
- `PFS curve`
- `DBR Curve`
- `True pedal feel curve`

Parsed curves are represented as:

```ts
export interface CurveValue {
  xLabel: string;
  yLabel: string;
  xUnit?: string;
  yUnit?: string;
  points: CurvePoint[];
}
```

---

## 10. Validation Rules

Parameter severity is based on `mandatoryStatus`.

| Status | Meaning | UI Behavior |
| --- | --- | --- |
| `mandatory` | Required for simulation | Missing values block BSPA start |
| `semi-mandatory` | Recommended / warning-level | Can be filled manually or estimated |
| `optional` | Informational | Missing values allowed |
| `irrelevant` | Not relevant for current context | Treated as non-blocking |

`SheetComponent.startBspa()` calls `DataService.validateForMamba()`. This currently blocks only missing mandatory fields.

`NewBspaComponent.startBspa()` currently requires all parameters to be filled before starting simulation. This differs from `SheetComponent` and should be aligned before production release.

---

## 11. Role and Permission Matrix

Feature keys:

```text
access_new_workflow
access_minor_workflow
access_status_check
access_validation
upload_input_sheet
manual_entry
autofill_defaults
ai_estimate
edit_parameter_values
edit_trust_level
toggle_design_value_lock
save_draft
start_bspa
export_results
```

| Feature | BSPA Coordination | TPM Customer Team |
| --- | --- | --- |
| New workflow | Yes | Yes |
| Minor workflow | Yes | No |
| Status check | Yes | Yes |
| Validation | Yes | Yes |
| Upload input sheet | Yes | Yes |
| Manual entry | Yes | Yes |
| Autofill defaults | Yes | Yes |
| AI estimate | Yes | Yes |
| Edit parameter values | Yes | Yes |
| Edit trust level | Yes | Yes |
| Toggle design value lock | Yes | No |
| Save draft | Yes | Yes |
| Start BSPA | Yes | Yes |
| Export results | Yes | Yes |

---

## 12. Styling and Branding

Global styles are defined in `src/styles.css` and `tailwind.config.js`.

The app uses Bosch color variables, Bosch Sans font assets, Tailwind utilities, and shared panel/card styles.

Font assets:

```text
src/assets/fonts/
src/app/utils/boschsans-v5_003/
```

Brand assets:

```text
src/assets/bosch-logo.svg
src/assets/logo-bspa.png
src/assets/supergraphic_line
```

---

## 13. Build and Run Instructions

Install dependencies:

```bash
npm install
```

Start development server:

```bash
npm start
```

Default local URL:

```text
http://localhost:4200
```

Build production bundle:

```bash
npm run build
```

Build output:

```text
dist/sws-dashboard/
```

Run unit tests:

```bash
npm test
```

Regenerate parsed result data:

```bash
node generate_results_json.js
```

This updates `src/app/utils/parsed-results.data.ts`.

### 13.1 GitHub Pages Deployment

This project includes a GitHub Actions workflow for GitHub Pages:

```text
.github/workflows/deploy-pages.yml
```

Deployment behavior:

- Runs on every push to `main`.
- Can also be started manually through `workflow_dispatch`.
- Installs dependencies with `npm ci`.
- Builds with `npm run build -- --base-href=/${{ github.event.repository.name }}/`.
- Uploads `dist/sws-dashboard` as the Pages artifact.
- Copies `index.html` to `404.html` so direct Angular routes can fall back to the SPA.
- Adds `.nojekyll` to prevent GitHub Pages from applying Jekyll processing.

Required GitHub repository setting:

```text
Settings -> Pages -> Build and deployment -> Source -> GitHub Actions
```

Default published URL:

```text
https://<username>.github.io/<repository-name>/
```

---

## 14. Generated and Sample Files

| File | Purpose |
| --- | --- |
| `src/app/Input_File_V5.22.xlsm` | Sample input workbook |
| `src/app/Result_Sheet_20260205_16h17m55s_OC13_EMB.xlsx` | Sample MAMBA result workbook |
| `src/app/utils/parsed-results.data.ts` | Generated result data imported by the UI |
| `src/app/utils/mock-results.data.ts` | Static mock result data |
| `generate_results_json.js` | Converts result workbook into TypeScript data |
| `generate_mock_results.js` | Mock data generation helper |
| `dump_xls.js` | Excel inspection helper |

Generated files should be reviewed before committing when source workbooks change.

---

## 15. Current Mocked Areas and Production Integration Targets

| Area | Current State | Production Recommendation |
| --- | --- | --- |
| User identity | Hardcoded in `App` | Integrate with Bosch identity provider or backend session |
| Role permissions | Local `RoleService` matrix | Load from backend authorization service |
| Project storage | In-memory `DataService` arrays | Persist projects and drafts through backend API |
| EPC comparison | `DataService.getMockEpcData()` | Replace with EPC/ePC3 API or connector-backed service |
| MAMBA simulation | `MambaService` mock observable | Replace with backend job submission and polling |
| Status check | Local required-field validation only | Call Jira/BSPA/EPC status endpoint |
| AI estimation | Random local estimation | Replace with approved estimation service/model |
| Mandatory status | Randomized in constructor | Load deterministic rulebook/template metadata |
| Result data | Parsed local sample workbook | Load actual simulation result from MAMBA response |

---

## 16. MAMBA / Database Integration Context

The separate MAMBA database and JAR architecture notes describe a Java/MATLAB-backed integration using:

| JAR | Purpose |
| --- | --- |
| `mambaconnector.jar` | Core MAMBA database operations, Hibernate/JPA entities, DAOs, MATLAB integration |
| `admintool.jar` | Administration UI and user/permission management |
| `epcconnector.jar` | ePC product data access |
| `epc3connector` | ePC3 product data access |

Important Java-side concepts from the integration notes:

- `MambaSessionCustomizer` reads database connection properties.
- `FactoryInitializer` creates the `EntityManagerFactory`.
- `MambaApp` starts/stops the Hibernate/JPA session and provides MATLAB-facing operations.
- Session data is converted between MATLAB structs and Java entities through `sessionM2J` and `sessionJ2M`.

Recommended frontend integration pattern:

1. Keep this Angular application decoupled from direct database/JAR access.
2. Build a backend gateway service that owns Java/MATLAB/JAR invocation.
3. Expose REST endpoints for project creation, EPC lookup, MAMBA job start, job status, and result retrieval.
4. Replace Angular mocks with typed API clients.

This avoids shipping database credentials or Java connector logic to the browser.

---

## 17. Known Technical Risks

| Risk | Impact | Recommendation |
| --- | --- | --- |
| Random mandatory statuses | Validation behavior changes between reloads | Replace with deterministic template/rulebook data |
| Local-only state | User loses project data on refresh or browser change | Add backend persistence |
| Mock EPC comparison | Mismatch indicators are not authoritative | Integrate real EPC data source |
| Mock MAMBA service | Simulation results are not real | Integrate real simulation backend |
| Divergent validation rules | `/new` and `/sheet` do not block on exactly the same criteria | Centralize validation policy in `DataService` |
| Excel parser complexity | Workbook layout changes may break extraction | Add fixture-based parser tests |
| No HTTP layer yet | Integration work may touch many components | Add dedicated API services and DTOs |
| Hardcoded user profile | Not suitable for production | Integrate authenticated user context |

---

## 18. Recommended Next Steps

1. Remove random mandatory-status assignment from `DataService`.
2. Define canonical parameter/rulebook schema.
3. Add fixture tests for `ExcelExtractor`.
4. Introduce Angular API services for projects, EPC, status check, and MAMBA.
5. Replace `MambaService` mock with backend job submission.
6. Persist drafts and project state outside browser memory.
7. Align validation behavior between `NewBspaComponent` and `SheetComponent`.
8. Add user/session integration and backend-provided permissions.
9. Add CI build and test workflow.
10. Document deployment target once the hosting environment is selected.

---

## 19. Maintenance Checklist

Before handover or release:

- Run `npm install` if dependencies changed.
- Run `npm run build`.
- Run `npm test` when tests are available/stable.
- Regenerate `parsed-results.data.ts` if the result workbook changes.
- Verify role restrictions for both supported roles.
- Verify Excel import with the latest official input template.
- Verify result export opens correctly in Excel.
- Confirm no database credentials, secrets, or internal connection strings are committed.

---

## 20. Ownership Notes

This repository currently represents a frontend prototype and integration preparation layer. Production completion requires backend integration for persistence, EPC lookup, MAMBA execution, authentication, and authorization.

The most important files for a new developer to read first are:

```text
src/app/services/data.service.ts
src/app/services/role.service.ts
src/app/components/new-bspa/new-bspa.component.ts
src/app/components/sheet/sheet.component.ts
src/app/utils/excel-extractor.ts
src/app/app.routes.ts
```
