/* eslint-disable no-undef */
const { v4: uuidv4 } = require('uuid');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;



async function writeRow(row, headersWritten, output_file) {
    //console.log(row, '============================================row')
    csvWriter = createCsvWriter({
        path: output_file,
        header: [], // Initially empty, we'll set this once we read the headers
        append: true // Append mode, in case we need to add rows to an existing file
    });

    let columns = Object.keys(row);

    // Generate ID for rows that do not have an ID
    if (!row.ID) {
        row.ID = uuidv4();
        columns.push('ID');
    }

    // Write the headers if not already written
    if (!headersWritten) {
        await csvWriter.writeRecords([columns]); // Write headers
        headersWritten = true;
    }

    // Write the row
    await csvWriter.writeRecords([row]);

    return headersWritten;
}

module.exports = writeRow;
