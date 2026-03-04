const xlsx = require('xlsx');
const fs = require('fs');

const excelPath = 'src/app/Result_Sheet_20260205_16h17m55s_OC13_EMB.xlsx';
const workbook = xlsx.readFile(excelPath);

const detailedSheet = workbook.Sheets['Detailed evaluation'];
const detailedData = xlsx.utils.sheet_to_json(detailedSheet, { header: 1 });

const summarySheet = workbook.Sheets['Summary'];

const categories = [];
let currentCategory = null;

detailedData.forEach(row => {
    // Category Header: Row starts with a number (column A) and has a title with '[Check]' in column B
    const no = row[0];
    const categoryTitle = row[1];

    if (no && typeof no === 'number' && typeof categoryTitle === 'string' && categoryTitle.includes('[Check]')) {
        currentCategory = {
            title: categoryTitle.replace(/\[Check\]/i, '').trim(),
            status: 'Unknown',
            details: []
        };
        categories.push(currentCategory);
    } else if (currentCategory && row[0] === 'Result evaluation:') {
        currentCategory.status = row[5] || 'Unknown';
    } else if (currentCategory && row[1] && String(row[2]).toLowerCase().includes('value') && String(row[3]).toLowerCase().includes('reference')) {
        // Headers row for details, skip
    } else if (currentCategory && row[1] && (row[2] !== undefined || row[3] !== undefined)) {
        // detail row
        // skip if it's just a subheader row like "Clamping_Force_assessment - Bosch"
        if (row[2] === undefined && row[3] === undefined) return;

        currentCategory.details.push({
            name: row[1],
            value: row[2] !== undefined ? String(row[2]).trim() : '-',
            reference: row[3] !== undefined ? String(row[3]).trim() : '-',
            unit: row[4] !== undefined ? String(row[4]).trim().replace('[', '').replace(']', '') : '-',
            assessment: row[5] !== undefined ? String(row[5]).trim() : '-'
        });
    }
});

// Calculate statistics for simple summary cards
let totalCount = 0;
let passedCount = 0;
let failedCount = 0;
let warningCount = 0;

categories.forEach(c => {
    c.details.forEach(d => {
        if (d.assessment === 'Passed') passedCount++;
        else if (d.assessment === 'Failed') failedCount++;
        else if (d.assessment === 'Passed with restrictions') warningCount++;

        if (['Passed', 'Failed', 'Passed with restrictions'].includes(d.assessment)) {
            totalCount++;
        }
    });
});

// Tracking Info from Summary sheet
const summaryData = xlsx.utils.sheet_to_json(summarySheet, { header: 1 });
const trackingInfo = [];
let trackingStarted = false;

summaryData.forEach(row => {
    if (row[0] === 'Tracking information') {
        trackingStarted = true;
    } else if (trackingStarted && row[0]) {
        // Stop if we hit something else or empty row followed by data
        if (row[0] === 'Customer:') { // Example of mapping known fields
            trackingInfo.push({ label: 'Customer', value: String(row[2] || '-') });
        } else if (row[0].includes(':')) {
            trackingInfo.push({ label: row[0].replace(':', '').trim(), value: String(row[2] || '-') });
        }
    }
});

const resultData = {
    overallStatus: failedCount > 0 ? 'Failed' : (warningCount > 0 ? 'Passed with restrictions' : 'Passed'),
    trackingInfo: trackingInfo,
    summaryCards: [
        { label: 'Total Checks evaluated', value: String(totalCount), icon: 'clipboard' },
        { label: 'Passed Criteria', value: String(passedCount), icon: 'check-circle' },
        { label: 'Failed Criteria', value: String(failedCount), icon: 'x-circle' },
        { label: 'Warnings', value: String(warningCount), icon: 'alert-triangle' }
    ],
    categories: categories
};

const output = `export const PARSED_RESULTS_DATA = ${JSON.stringify(resultData, null, 2)};`;
fs.writeFileSync('src/app/utils/parsed-results.data.ts', output);
console.log('Successfully created parsed-results.data.ts');
