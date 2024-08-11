const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

let file1Data = {};
let file2Data = {};

async function run() {
  await readCSV('file1.csv', file1Data);
  await readCSV('file2.csv', file2Data);
  
  const differences = compareCSVs(file1Data, file2Data);
  //console.log('Differences:', differences);

  // Use this for dynamic header based on the keys available in the differences
  const header = Object.keys(differences[0] || {}).map(key => ({ id: key, title: key }));

  const csvWriter = createCsvWriter({
    path: 'differences.csv',
    header
  });

  csvWriter.writeRecords(differences).then(() => {
    //console.log('...Done');
  });
}

function readCSV(file, dataObj) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(file)
      .pipe(csv())
      .on('data', (row) => {
        const email = row.Email;
        dataObj[email] = row;
      })
      .on('end', resolve)
      .on('error', reject);
  });
}

function compareCSVs(dataObj1, dataObj2) {
  const differences = [];

  for (const email in dataObj1) {
    if (!dataObj2[email]) {
      differences.push({ Email: email, Status: 'Missing in File 2' });
    }
  }

  for (const email in dataObj2) {
    if (!dataObj1[email]) {
      differences.push({ Email: email, Status: 'Missing in File 1' });
    }
  }

  return differences;
}

run().catch(console.error);
