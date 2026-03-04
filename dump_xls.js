const xlsx = require('xlsx');
const workbook = xlsx.readFile('src/app/Result_Sheet_20260205_16h17m55s_OC13_EMB.xlsx');
console.log("Sheet names:");
console.log(workbook.SheetNames);
for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`\n\nSheet: ${sheetName}`);
    console.log(data.slice(0, 50));
}
