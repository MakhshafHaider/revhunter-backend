/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
//Begin with reading all csv files from the input directory
//and return an array of all the file names
const fs = require("fs");
const csv = require("csv-parser");
const parse = require('csv-parse/lib/sync'); 


function readCSVFiles(directory) {
    if (!directory) {
        throw new Error("Directory is required");
    }
    const files = fs.readdirSync(directory);
    //Return the full path for each file
    return files.map(file => {
        return `${directory}/${file}`;
    });
}




//Now loop through the array of file names and read each file
//and return an array of objects with the data from each file

function readRowsToMemory(file) {
    if (!file) {
        throw new Error("File is required");
    }
    //console.log(`Reading file ${file}`);
    //Take one file and loop through and read each row
    //and return an array of objects with the data from each row
    //Use the csv-parser library to read each row

    const fileContent = fs.readFileSync(file, 'utf8');
    //parse to csv
    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true
    });
    //Log outcome
    // //console.log(records.length + " rows read from " + file); 
    return records;
}

let files = readCSVFiles("./input");
//console.log(files);
let rows = readRowsToMemory(files[0]);

//export module
module.exports = readCSVFiles;