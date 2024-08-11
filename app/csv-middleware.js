/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
const db = require("../db/mongodb-connector");
const aiURL = require("../api/openai-interface-website-url");
const { PROMPTS } = require("../prompts/prompts");
// const prependHttp  = require('prepend-http');

const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const _ = require("lodash");
const DEBUGLOG = false;
// const ContactsModal=require("../schema/contactsSchema");

// import event emitter
const progressEmitter = require("../events/progress-events");
const { error } = require("console");
const { validateEmail } = require("../api/millionverifier-interface");

// function to use the db to insert a csv file of rows into a collection
/*
    csvPath: path to csv file
    transform: boolean to indicate if the csv file needs to be transformed to snake_case
    client: campaign = collection in mongo db
*/

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// function isAbsoluteUrl(url) {
//   if (url.startsWith("https://")) {
//     return true;
//   }

//   return false;
// }

// function ensureHttps(url) {
//   console.log('url', url);
//   if (!isAbsoluteUrl(url)) {
//     return "https://" + url;
//   }
//   return url;
// }

function isAbsoluteUrl(url) {
  return url.startsWith("http://") || url.startsWith("https://");
}

function ensureHttps(url) {
  // console.log('Original URL:', url);
  if (!isAbsoluteUrl(url)) {
    // If the URL does not start with 'http://' or 'https://', prepend 'https://'
    return "https://" + url;
  } else if (url.startsWith("http://")) {
    // If the URL starts with 'http://', replace it with 'https://'
    return url.replace("http://", "https://");
  }
  // If the URL is already 'https://', return as is
  return url;
}

//expect absolute paths for csvPath
async function importCSVtoDB(csvPath, transform, client, campaign) {
  let absolutePath = csvPath;

  //convert to snake_case if needed
  if (transform) {
    absolutePath = await convertToSnakeCase(csvPath);
  }

  //validate input parameters
  if (!absolutePath) {
    throw new Error("Invalid csv path");
  }
  if (!client) {
    throw new Error("Empty client");
  }
  if (!campaign) {
    throw new Error("Empty campaign");
  }

  return new Promise((resolve, reject) => {
    const promises = [];
    let emailValidation = [];
    let totalCount = 0;
    let completedCount = 0;

    // use csv parser to read the csv file
    fs.createReadStream(absolutePath)
      .pipe(csv())
      .on("data", async (row) => {
        // console.log("row in middleware", row);
        totalCount++;

        let newRow = row;
        if (!row.campaign) {
          //throw error if campaign is not object
          if (typeof campaign !== "object") {
            throw new Error("Invalid campaign");
          }
          newRow.campaign = campaign.name;
        }
        // check if client is set
        if (!row.client) {
          newRow.client = client.name;
          //console.log(`Set client to ${client.name}`);
        }

        if (row.website) {
          row.website = ensureHttps(row.website);
        }

        try {
          promises.push(db.createClient(client));
          promises.push(db.addCampaignToClient(client, campaign));

          promises.push(newRow);
        } catch (err) {
          console.log(err);
          reject(err);
        }
      })
      .on("end", async () => {
        // console.log(' promise before', promises);
        console.log(
          "+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++",
          totalCount
        );
        progressEmitter.emit("on-total", totalCount);

        // for (let record of promises) {
        //   if(record?.website){
        //     record.website = ensureHttps(record?.website)
        //     console.log('record ', record);
        //   }
        // }
        const filteredArray = promises.filter(
          (result) => typeof result === "object" && result.client
        );
        // console.log("promises.length", filteredArray.length);
        db.addDocumentStrict(
          filteredArray,
          db.collectionsEnum.CONTACTS_COLLECTION
        )
          .then(() => {
            completedCount++;
            progressEmitter.emit("on-update-progress", totalCount);
            console.log(`Completed ${completedCount} of ${totalCount}`);
          })
          //console.log(err);
          .catch((err) => {
            progressEmitter.emit("on-error", err);
          });

        // if (DEBUGLOG) //console.log("CSV file successfully processed");
        //emit event to update app on finished progress
        progressEmitter.emit("on-update-progress", totalCount);
        resolve(true);
      })
      .on("error", (err) => {
        //console.log(err);
        reject(err);
      });
  });
}

async function importFolderToDB(folderPath, transform, client, campaign) {
  let absolutePath = path.resolve(__dirname, folderPath);
  ////console.log(absolutePath);

  //validate input parameters
  if (!absolutePath) {
    throw new Error("Invalid csv path");
  }
  if (!client) {
    throw new Error("Invalid client");
  }
  if (!campaign && typeof campaign !== "object") {
    throw new Error("Invalid campaign");
  }

  var fsPromises = require("fs").promises;

  //loop through all files in folder
  const files = await fsPromises.readdir(absolutePath);
  ////console.log(files);
  for (const file of files) {
    let absoluteFilePath = path.resolve(__dirname, folderPath + file);
    await importCSVtoDB(absoluteFilePath, transform, client, campaign);
  }
}

async function downloadContactsCSVWithClientAndCampaign(
  client,
  campaign,
  prompt
) {
  console.log(`Downloading CSV for client ${client} and campaign ${campaign}`);
  let filter = { client: client, campaign: campaign };
  //console.log(
  //     "Filter and collection:" +
  //       filter +
  //       " " +
  //       db.collectionsEnum.CONTACTS_COLLECTION
  //   );
  //console.log(filter);
  //console.log(db.collectionsEnum.CONTACTS_COLLECTION);
  return await downloadCSVForCollectionWithFilter(
    db.collectionsEnum.CONTACTS_COLLECTION,
    filter,
    prompt
  );
}

async function downloadCSVForCollectionWithFilter(
  collectionName,
  filter,
  prompt
) {
  const collection = await db.getCollection(collectionName);
  const cursor = await collection.find(filter);
  console.log(
    "PRMPT IS CALLED==========================================================",
    prompt
  );
  const records = [];

  await cursor.forEach((doc) => records.push(doc));

  if (records.length === 0) {
    console.log("No records found in this collection");
    return null;
  }

  let csvWriter;
  // if (prompt === "Basic Enrichment ENG") {
  const fields = records
    .reduce((accumulator, record) => {
      const fieldKeys = Object.keys(record);
      return fieldKeys.length > accumulator.length ? fieldKeys : accumulator;
    }, [])
    .filter((field) => field !== "token_details");

  console.log("Most number of fields", fields);
  // console.log("record[0]", records[0])
  csvWriter = createCsvWriter({
    path: path.join(__dirname, `${collectionName}_contacts.csv`),
    header: [
      // ...Object.keys(records[0]),
      ...fields,
      "enrichment_status",
      "scraping_status",
      "error",
    ].map((field) => ({
      id: field,
      title: field,
    })),
  });
  // }

  //   const csvWriter = createCsvWriter({
  //     path: path.join(__dirname, `${collectionName}_contacts.csv`),
  //     header: [...Object.keys(records[0]), 'enrichment_status'].map((field) => ({
  //       id: field,
  //       title: field,
  //     })),
  //   });
  console.log(
    "recoreds========================================================================",
    records
  );
  const wordsToSkip = [
    "company",
    "Company",
    "Company Name",
    "target audience",
    "achieve desired outcome",
    "additional benefit",
  ];
  // const wordsToSkip = ['company','Company Name', 'target audience', 'achieve desired outcome', 'additional benefit'];

  const pattern = new RegExp(`\\[${wordsToSkip.join("|")}\\]`, "i");
  // const pattern = /\[Company Name\]/i;

  const emptyRecordsToSkip = records.filter((record) => {
    console.log(
      "record?.comment_on_content_piece",
      record?.comment_on_content_piece
    );
    if (record?.comment_on_content_piece === undefined) {
      // console.log("record?.comment_on_content_piece?????????????????????????????????????????????????????????????/", record?.comment_on_content_piece);

      // Skip the record if the 'comment_on_content_piece' field is empty
      return false;
    }
    return true;
  });

  console.log("emptyRecordsToSkip", emptyRecordsToSkip);
  const filteredRecords = emptyRecordsToSkip.filter(
    (record) =>
      !pattern.test(record.value_proposition) &&
      !pattern.test(record.comment_on_content_piece)
  );

  await csvWriter.writeRecords(filteredRecords);

  // const filteredRecords = records.filter(record => !bracketsPattern.test(record.comment_on_content_piece && record.value_proposition));

  // await csvWriter.writeRecords(records);
  //console.log("colle")
  //console.log(`CSV for ${collection} is saved.`);
  return path.join(__dirname, `${collectionName}_contacts.csv`);
}

async function setHeadersToLowerCaseInCSV(csvPath) {
  const absolutePath = path.resolve(__dirname, csvPath);
  const outputPath = path.resolve(
    __dirname,
    csvPath.replace(".csv", "_lowercase_headers.csv")
  );

  let newHeaders = null;
  const records = [];
  let csvWriter = null;

  fs.createReadStream(absolutePath)
    .pipe(csv()) // We don't want the CSV parser to treat the first line as headers
    .on("headers", (headers) => {
      newHeaders = headers.map((header) => header.toLowerCase());
      csvWriter = createCsvWriter({
        path: outputPath,
        header: newHeaders.map((header) => ({ id: header, title: header })),
      });
    })
    .on("data", (row) => {
      const newRow = {};
      Object.keys(row).forEach((key) => {
        newRow[key.toLowerCase()] = row[key];
      });
      records.push(newRow);
    })
    .on("end", async () => {
      await csvWriter.writeRecords(records); // Write all rows at once
      //   if (DEBUGLOG) //console.log("CSV file successfully processed");
    });

  return true;
}

// Expect absolute path for csvPath
async function convertToSnakeCase(csvPath) {
  return new Promise((resolve, reject) => {
    const outputPath = csvPath.replace(".csv", "_snake_case.csv");

    let newHeaders = null;
    const records = [];
    let csvWriter = null;

    fs.createReadStream(csvPath)
      .pipe(csv())
      .on("headers", (headers) => {
        // Convert headers to snake_case
        newHeaders = headers.map((header) => _.snakeCase(header));
        // Create a new csvWriter instance with the new headers
        csvWriter = createCsvWriter({
          path: outputPath,
          header: newHeaders.map((header) => ({ id: header, title: header })),
        });
      })
      .on("data", (row) => {
        // Convert keys in each row to snake_case
        const newRow = {};
        Object.keys(row).forEach((key) => {
          newRow[_.snakeCase(key)] = row[key];
        });
        records.push(newRow);
      })
      .on("end", async () => {
        await csvWriter.writeRecords(records); // Write all rows at once
        // if (DEBUGLOG)
        //console.log("CSV file successfully converted to snake_case");
        resolve(outputPath);
      })
      .on("error", (err) => {
        //console.log(err);
        reject(err);
      });
  });
}

//test
//setHeadersToLowerCaseInCSV('../input/test.csv');
//convertToSnakeCase('../input/test_lowercase_headers.csv');
let test = false;
if (test) {
  (async () => {
    await importFolderToDB(
      "../input/seedtable/",
      true,
      "agency",
      "EU Startups | Founders"
    ).then(async () => {
      //console.log("done");
      await db.countDocuments("test");
    });
    await downloadCSVForCollectionWithFilter("agency", {
      campaign: "EU Startups | Founders",
    });
    await db.close();
  })();
}

module.exports = {
  importCSVtoDB,
  importFolderToDB,
  downloadContactsCSVWithClientAndCampaign,
  downloadCSVForCollectionWithFilter,
};

downloadCSVForCollectionWithFilter("agency", {
  campaign: "EU Startups | Founders",
});

/*importCSVtoDB('../input/test.csv', true)
    .then(async () => {
        //console.log('done');
        await db.countDocuments();
        await db.close();
    })
    .catch((err) => {
        //console.log(err);
    });*/
