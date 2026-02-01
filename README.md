# BSPA Dashboard

A modern Angular-based web dashboard for managing and initiating BSPA (Brake System Project Assessment) projects. 


## 🚀 Features

*   **Project Initiation**: 
    *   **New BSPA**: Start a completely new assessment.
    *   **Running Change**: Initiate a minor modification (Minor BSPA).
*   **Excel Integration**: Robust import functionality for `.xlsm`, `.xlsx` parameter sheets using `SheetJS` (xlsx).
    *   Automatically detects "Project Name", "EPC", and technical parameters regardless of cell position.
*   **Status Check**: Quick lookup tool for BSPA status using Jira/EPC/BSPA references.
*   **Dynamic Data Grid**: Responsive parameter sheet view with distinct "Expert" and "Standard" user modes.
*   **Bosch Branding**: Custom Tailwind config complying with Bosch colors and typography.

## 🛠 Tech Stack

*   **Framework**: Angular 18+ (Standalone Components)
*   **Styling**: Tailwind CSS (with custom Bosch Theme)
*   **Utilities**: `xlsx` (Excel Parsing)

## 📂 Project Structure

```
src/app/
├── components/
│   ├── check-status/  # Status lookup form
│   ├── header/        # Global navigation header
│   ├── home/          # Main dashboard landing page
│   ├── new-bspa/      # Setup wizard (Upload / Manual entry)
│   └── sheet/         # Main data grid / parameter view
├── services/
│   └── data.service.ts # State management & Data Store
└── app.routes.ts       # Application routing definition
```

## 📦 Installation & Setup

1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Run Development Server**:
    ```bash
    ng serve
    ```
3.  **Build for Production**:
    ```bash
    ng build
    ```

## 🎨 Design Notes
*   **Assets**: Logo assets are stored in `src/assets/`.
*   **Styles**: Global overrides and animations (e.g., `fade-in`, `slide-up`) are in `styles.css`.
