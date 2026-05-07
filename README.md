# BSPA Dashboard

BSPA Dashboard is an Angular-based web application for preparing and validating BSPA brake system parameter assessments. It supports role-based access, Excel input sheet import, parameter validation, EPC comparison, mock MAMBA simulation, result review, and Excel result export.

For the complete handover and architecture details, see:

```text
TECHNICAL_DOCUMENTATION.md
```

## Tech Stack

- Angular `^16.2.0` with standalone components
- TypeScript `~5.1.3`
- Tailwind CSS `^3.3.0`
- SheetJS `xlsx` for Excel import/export
- RxJS for workflow state

## Main Features

- Role selection for BSPA Coordination and TPM Customer Team.
- New BSPA workflow from project setup to validation, mock simulation, and results.
- Minor BSPA / validation sheet workflow.
- Excel upload for `.xlsx`, `.xlsm`, `.xls`, and `.xlsb` files.
- Fuzzy Excel parameter extraction and matrix parsing.
- Multi-variant parameter editing.
- Trust-level tracking for manual, imported, estimated, EPC, customer, and design-value data.
- Curve parameter display and editing.
- Result workbook parsing through `generate_results_json.js`.
- Result export to Excel.

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm start
```

Build the production bundle:

```bash
npm run build
```

Run tests:

```bash
npm test
```

Regenerate parsed result data after changing the sample result workbook:

```bash
node generate_results_json.js
```

## Deploy to GitHub Pages

This repository includes a GitHub Actions workflow at:

```text
.github/workflows/deploy-pages.yml
```

To enable deployment:

1. Push the repository to GitHub.
2. Open the repository on GitHub.
3. Go to `Settings -> Pages`.
4. Set `Build and deployment -> Source` to `GitHub Actions`.
5. Push to the `main` branch or run the workflow manually from the `Actions` tab.

The workflow builds the Angular app with the correct GitHub Pages base path:

```bash
npm run build -- --base-href=/<repo-name>/
```

The deployed site will be available at:

```text
https://<username>.github.io/<repo-name>/
```

The workflow also creates `404.html` from `index.html` so Angular routes still work after a browser refresh.

## Important Files

```text
src/app/services/data.service.ts
src/app/services/role.service.ts
src/app/services/mamba.service.ts
src/app/components/new-bspa/new-bspa.component.ts
src/app/components/sheet/sheet.component.ts
src/app/utils/excel-extractor.ts
src/app/app.routes.ts
```

## Current Status

This repository is currently a frontend prototype. Project persistence, EPC lookup, status checking, authentication, authorization, and real MAMBA execution are mocked or local-only and are documented as integration targets in `TECHNICAL_DOCUMENTATION.md`.
