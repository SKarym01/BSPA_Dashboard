const xlsx = require('xlsx');
const fs = require('fs');

const workbook = xlsx.readFile('src/app/Result_Sheet_20260205_16h17m55s_OC13_EMB.xlsx');
const sheet = workbook.Sheets['Detailed evaluation'];
const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

const categories = [];
let currentCategory = null;

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
let warningChecks = 0;

for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    // e.g. [ 1, ' [Check] Clamping Force assessment' ]
    if (typeof row[0] === 'number' && typeof row[1] === 'string' && row[1].includes('[Check]')) {
        currentCategory = {
            title: row[1].replace('[Check]', '').replace('[Check] ', '').trim(),
            status: '',
            details: []
        };
        categories.push(currentCategory);
        continue;
    }

    // e.g. [ 'Result evaluation:', undefined, undefined, undefined, undefined, 'Passed' ]
    if (currentCategory && row[0] === 'Result evaluation:') {
        // Status can be in any column after index 0
        const statusStr = row.slice(1).find(cell => typeof cell === 'string' && cell !== '');
        currentCategory.status = (statusStr || 'Passed').replace('[Check] ', ''); // Just a cleanup fallback
        continue;
    }

    // e.g. [ undefined, 'Description', 'Value', 'Reference Value', 'Unit', 'Assessment Remark' ]
    // or data row
    if (currentCategory && !row[0] && typeof row[1] === 'string' && row[1] !== 'Description' && row[1] !== 'Value' && row[1] !== 'Clamping force for parking - OEM') {
        const itemVal = row[2] !== undefined ? String(row[2]) : '-';
        if (itemVal === 'Value') continue;

        currentCategory.details.push({
            name: row[1],
            value: itemVal,
            reference: row[3] !== undefined ? String(row[3]) : '-',
            unit: row[4] !== undefined ? String(row[4]).replace(/\[|\]/g, '').trim() : '-',
            assessment: row[5] || '-'
        });

        // Count assessments
        if (row[5] === 'Passed') passedChecks++;
        else if (row[5] === 'Failed') failedChecks++;
        else if (row[5] === 'Passed with restrictions') warningChecks++;

        // Only count rows that have a valid assessment as 'checks'
        if (row[5] && row[5] !== '-') totalChecks++;
    }
}

const finalStatus = failedChecks === 0 ? 'Passed' : 'Failed';

const mockData = {
    overallStatus: finalStatus,
    summaryCards: [
        { label: 'Total Checks evaluated', value: String(totalChecks), icon: 'clipboard' },
        { label: 'Passed Criteria', value: String(passedChecks), icon: 'check-circle' },
        { label: 'Failed Criteria', value: String(failedChecks), icon: 'x-circle' },
        { label: 'Warnings', value: String(warningChecks), icon: 'alert-triangle' }
    ],
    categories: categories
};

const tsContent = `export const MOCK_RESULTS_DATA = ${JSON.stringify(mockData, null, 2)};`;
fs.writeFileSync('src/app/utils/mock-results.data.ts', tsContent);
console.log('Successfully generated src/app/utils/mock-results.data.ts');
