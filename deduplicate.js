const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const mergedRows = {};
let headers = null;

// Read the CSV file and merge rows
fs.createReadStream('input-dmaien.csv')
  .pipe(csv())
  .on('headers', (receivedHeaders) => {
    // Store the headers to create the CSV writer later
    headers = receivedHeaders.map((header) => ({ id: header, title: header }));
  })
  .on('data', (row) => {
    const email = row.Email;

    if(!email) {
      return;
    }
    
    if (!mergedRows[email]) {
      mergedRows[email] = {};
    }

    for (const key in row) {
      if (row[key]) {
        mergedRows[email][key] = row[key];
      }
    }
  })
  .on('end', () => {
    // Create a CSV writer with dynamic headers
    const csvWriter = createCsvWriter({
      path: 'merged.csv',
      header: headers,
    });
    
    const records = Object.values(mergedRows);
    //log the number of merged rows
    //console.log(records.length);
    csvWriter.writeRecords(records)
      .then(() => {
        //console.log('...Done');
      });
  });
