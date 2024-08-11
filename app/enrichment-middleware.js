/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
const ai = require("../api/openai-interface");
const aiURL = require("../api/openai-interface-website-url");
const db = require("../db/mongodb-connector");
const scraping = require("../app/scraping-middleware");
const fs = require("fs");
const path = require("path");
const _ = require("lodash");
const validUrl = require("valid-url");
const async = require("async");
const progressEvents = require("../events/progress-events");
const bar = require("../util/progress-bar");
const progressEmitter = require("../events/progress-events");

// const { WebClient } = require('@slack/web-api');
const { WebClient } = require("@slack/web-api");

// Create a new instance of the WebClient class with the token read from your environment variable
const token = process.env.SLACK_TOKEN; // Make sure to set your token in the environment variables
const web = new WebClient(token);

// Function to send message to a channel
async function sendToSlack(message, channel) {
  try {
    // Use the `chat.postMessage` method to send a message to the channel
    await web.chat.postMessage({
      channel: channel,
      text: message,
    });
  } catch (error) {
    console.error(error);
  }
}

const debouncedEmit = _.debounce(
  (document, prompt, index, c) => {
    // console.log("debounced emit called!!!", document, prompt, index, c);
    progressEmitter.emit("on-db-doc-inserted", { document, prompt, index, c });
  },
  300,
  {
    leading: false,
    maxWait: 3000,
    trailing: true,
  }
);

//import prompts
const { PROMPTS } = require("../prompts/prompts");
const { validateEmail } = require("../api/millionverifier-interface");

const DEBUGLOG = true;
const parallelLimit = process.env.PARALLEL_LIMIT || 10;

async function getClients() {
  //get all clients in simple json
  const clients = await db.getClients();
  return clients;
}

async function getPrompts() {
  //get all prompts in simple json
  return PROMPTS;
}

async function createClient(client) {
  //create a client
  const result = await db.createClient(client);
  return result;
}
async function createEnrichment(enrichment) {
  //create a Enrichment
  const result = await db.createEnrichment(enrichment);
  return result;
}

async function getStats(client, campaign, prompt) {
  //get stats for a client
  const stats = await db.getStats(client, campaign, prompt);
  return stats;
}

async function getStatsTitle(client, campaign) {
  //get stats for a client
  const stats = await db.getStatsBasicTitle(client, campaign);
  return stats;
}

async function getStatsSE(client, campaign) {
  //get stats for a client
  const stats = await db.getStatsSE(client, campaign);
  return stats;
}
async function getCampaigns(client) {
  //get campaigns for a client
  const campaigns = await db.getCampaigns(client);
  return campaigns;
}
async function getAllEnrichment() {
  const records = await db.getAllEnrichmentRecords();
  return records;
}
async function getAllRecords() {
  const records = await db.getAllRecords();
  return records;
}

function getCurrentDateTime() {
  const currentDate = new Date();

  const currentDateString = currentDate.toDateString();
  const currentTimeString = currentDate.toLocaleTimeString();

  const currentDateTimeString = `${currentDateString} ${currentTimeString}`;
  return currentDateTimeString;
}

async function addUser(user) {
  const records = await db.addUser(user);
  return records;
}

async function updateUser(user) {
  const records = await db.updateUser(user);
  return records;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function enrichCampaignOnClient(
  client,
  campaign,
  prompt,
  index,
  ip,
  userID
) {
  //log input parameters
  if (DEBUGLOG) console.log(`Client: ${client}`);
  if (DEBUGLOG) console.log(`Campaign: ${campaign}`);
  if (DEBUGLOG) console.log(`Prompt: ${prompt}`);
  if (DEBUGLOG) console.log(`index: ${index}`);

  //check input parameters
  if (!client) {
    //console.log(client);
    throw new Error("Invalid client");
  }
  if (!campaign) {
    //console.log(campaign);
    throw new Error("Invalid campaign");
  }
  if (!prompt) {
    //console.log(prompt);
    throw new Error("Invalid prompt");
  }

  //resolve prompt, look for match in PROMPTS array
  const promptObject = PROMPTS.find((p) => p.name === prompt);

  if (!promptObject) {
    // //console.log(promptObject);

    throw new Error("Invalid prompt");
  }

  //run enrichment on a campaign for a client
  //get all records that have a website
  const filter = { client: client, campaign: campaign };
  console.log("filter", filter);
  const batchSize = 2500;
  let offset = 0;
  let records;
  const enrichedRecords = [];
  // console.log('filter', filter)
  // do
  while (true) {
    records = await db.getFilteredContacts(filter, batchSize, offset);
    console.log("I am called");
    if (!records || records.length === 0) {
      break; // Exit the loop if no more records
    }

    if (records) {
      console.log(`Found ${records} records`);
      //filter out records that have already been enriched

      const remainingRecords = records.filter(
        (record) => !record.value_proposition
        // && record.email_verified === "good"
      );

      // console.log(`Found ${remainingRecords.length} records to enrich`);
      let c = 0;

      for (const record of remainingRecords) {
        enrichedRecords.push(
          enrichBasedOnWebsiteAndPrompt(record, promptObject, index, c)
        );
      }

      //run enrichment on the remaining records
      let progress = 0;
      progressEvents.emit("on-init-progress", remainingRecords.length);

      console.log("enrichedRecords", enrichedRecords.length);

      offset += batchSize;
    }
  }

  return Promise.allSettled(enrichedRecords).then(async (values) => {
    //console.log("++++++======================Iam finished");
    const stats = await getStats(client, campaign);
    const currentDateTime = getCurrentDateTime();

    let value = {
      client,
      campaign,
      prompt: promptObject.name,
      stats,
      ip,
      currentDateTime,
      userID,
    };
    const result = await createEnrichment(value);

    const updateRecord = await updateUser(value);
    if (stats) {
      const message = `Enrichment Summary:
     - Enriched Number: ${stats?.enrichedNumber}
     - Total Records: ${stats?.totalRecords}
     - Faulty Uploads: ${stats?.faultyUploads}
     - Total Enrichment Runs: ${stats?.totalEnrichmentRun}`;

      if (process.env.NODE_ENV === "production") {
        await sendToSlack(message, "#development");
      }
    }

    // console.log("value", result);

    progressEmitter.emit("on-db-doc-finished", index);
  });
  //  while (offset < records.length);

  //     let promises =[];
  //     for (const record of remainingRecords) {
  //     promises.push(enrichBasedOnWebsiteAndPrompt(record, promptObject).catch((error) => {
  //         console.error(`Error processing record: ${error.message}`);
  //         return record; // Return the original record in case of an error
  //     }));
  // }

  // return Promise.all(promises).then((results) => {
  //     // results will contain the enriched records or the original records in case of errors
  //     const errors = results.filter((result) => result instanceof Error);

  //     if (errors.length > 0) {
  //         console.error(`There were ${errors.length} errors during processing.`);
  //     }

  //     return results;
  // });

  //return the enriched records
  // return enrichedRecords;
}

async function enrichBasedOnWebsiteAndPrompt(record, promptObject, index, c) {
  try {
    console.log("Test 1");
    //get the website from the record
    let website = record.website;
    // if(!record.website){
    //   console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!website", website);
    //    record.scraping_status = "Website URL does not exists"
    // }
    // console.log("TEST 2", record);
    //expect path in promptObject
    // console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!promptObject!!!!!!!!!!!!!!!!!!!!!!!', promptObject);
    let count = 0;
    if (!promptObject.path) {
      throw new Error("Invalid prompt object");
    }
    //console.log("Test 2");
    // if (!promptObject2.path) {
    //   console.error(promptObject2);
    //   throw new Error("Invalid prompt object");
    // }
    // console.log("Test 2");

    // console.log("TEST 3")
    //check if website is valid

    // console.log("TEST 3.1");
    //make sure record has a company name that is non empty
    if (record.company_name.trim() === "") {
      //console.log(`Company name is non empty: ${record.company}`);
      return record;
    }

    // console.log("TEST 3.2")
    //is there already an enrichment on this record for this website?
    if (record.value_proposition) {
      //console.log(`Enrichment already exists for website ${website}`);
      return record;
    }

    //read the prompt from file
    // console.log('promptObject.path', promptObject.path);
    const absolutePath = path.resolve(__dirname, promptObject.path);
    let prompt = fs.readFileSync(absolutePath, "utf-8");

    if (promptObject.required_parameters) {
      //if (DEBUGLOG) //console.log(`Prompt has required parameters: ${promptObject.required_parameters}`);
      for (const requiredParameter of promptObject.required_parameters) {
        if (!record[requiredParameter]) {
          console.log(
            `Record does not have required parameter ${requiredParameter}`
          );
          // throw new Error(
          //   `Record does not have required parameter ${requiredParameter}`
          // );
          // record.scraping_status = "Website URL doe not exists";
        }
        //if (DEBUGLOG) //console.log(`Replacing required parameter ${requiredParameter} with ${record[requiredParameter]}`);
        //replace this required parameter in the prompt
        prompt = prompt.replace(
          `{{${requiredParameter}}}`,
          record[requiredParameter]
        );
      }
    }
    let websiteContent;
    const model = "gpt-3.5-turbo";

    // console.log("Test 3");

    try {
      if (website) {
        websiteContent = await scraping.getCleanContentFromWebsite(website);
      }
      //if (DEBUGLOG) //console.log(`Website content: ${websiteContent}`);
      // console.log(
      //   "website conetct length , website url",
      //   websiteContent.length,
      //   website
      // );
      //if (DEBUGLOG) //console.log(`Calling OpenAI API with prompt: ${prompt}`);
      //if (DEBUGLOG) //console.log(`Calling OpenAI API with content: ${websiteContent}`);
      //if (DEBUGLOG) //console.log(`Calling OpenAI API with model: ${model}`);

      if (!websiteContent) {
        throw new Error("Website content is empty");
      }
    } catch (err) {
      // Website could not be scraped
      // log the reason and return the record
      // with status field set to 'error'

      // console.log("error SCRAPING STATUS", err.message);
      record.scraping_status = err.message;

      // return record;
    }
    console.log("Test 4");

    // console.log("prompt 2", prompt2);
    try {
      if (!record.scraping_status) {
        // console.log("called with scraping status");
        const response = await ai.callOpenAIWithCompletePromptAndModel(
          prompt,
          websiteContent,
          model
        );
        // console.log(
        //   response?.data?.choices?.message?.content,
        //   "called with scraping status AFTERRRRR"
        // );
         record.token_details = {token_usage: response?.data?.usage, prompt_legth: prompt.length}; 

        //parse response to JSON
        try {
          var responseJSON = JSON.parse(
            response.data.choices[0].message.content.trim()
          );
        } catch (error) {
          console.log("error", error);
          throw new Error("Website content : JSON parse error");
        }

        // if (DEBUGLOG) //console.log(`Response: ${responseJSON}`);
        //add each property from responseJSON to the record
        // console.log("response json!!!!!!!!!!!!!!!!!!!!", responseJSON);
        for (let [key, value] of Object.entries(responseJSON)) {
          record[key] = value;
          //if (DEBUGLOG) //console.log(`Added ${key} to record`);
        }
      }
    } catch (err) {
      // console.log("err.messages", err);
      // record.enrichment_status = 'JSON Parse error';
      record.enrichment_status = err.message;
      // return record;
    }

    try {
      // console.log('recird', record);
      if (!record.email) {
        // console.log("EMIL  FOUND+++++++++++++++++++++++============================")
        record.error = "Email not Found";
      }
    } catch (error) {
      console.error("An unexpected error occurred: ", error);
    }
    //update the record in the database
    try {
      //use lenient approach to adding the record
      // console.log("records added", record);

      await db.addDocument(record, record.client);
      // console.log("before decounce c =", record);
      progressEmitter.emit("on-db-doc-inserted", {
        document: record,
        promptObject,
        index,
        c,
      });

      debouncedEmit(record, promptObject, index, c);
    } catch (err) {
      //console.log(err);
      throw new Error(
        `Error adding enriched record to database: ${err.message}`
      );
    }

    //console.log("new records", record);
    return record;
  } catch (error) {
    //console.log("err", err);
  }
}

async function enrichIfNotEnrichedBasedOnFilter(client, filter, promptFile) {
  //Takes a filter, finds mongo records that match the filter, and enriches them
  //with the OpenAI API
  //Returns the enriched records
  //check input parameters
  if (!filter) {
    //console.log(filter);
    throw new Error("Invalid filter");
  }
  if (!client) {
    //console.log(client);
    throw new Error("Invalid client");
  }
  //log the filter
  // if (DEBUGLOG) //console.log(`Filter: ${JSON.stringify(filter)}`);
  //log the client
  // if (DEBUGLOG) //console.log(`Client: ${client}`);
  //get the records
  const records = await db.getFilteredCollection(client, filter);
  //console.log(`Found ${records.length} records`);

  let progress = 0;
  //enrich the records
  const enrichedRecords = [];
  for (const record of records) {
    enrichedRecords.push(
      await enrichBasedOnWebsiteAndPrompt(record, promptFile)
    );
    progress++;
    //console.log(`Progress: ${progress} of ${records.length}`);
    // if (DEBUGLOG)
    //   //console.log(
    //     "Enriched record: ",
    //     enrichedRecords[enrichedRecords.length - 1]
    //   );
  }

  //return the enriched records
  return enrichedRecords;
}

//Batch and parallell processing of enrichment
async function batchAndParallellEnrichIfNotEnrichedBasedOnFilter(
  client,
  filter,
  promptFile
) {
  //Takes a filter, finds mongo records that match the filter, and enriches them
  //with the OpenAI API
  //Returns the enriched records
  //check input parameters
  if (!filter) {
    //console.log(filter);
    throw new Error("Invalid filter");
  }
  if (!client) {
    //console.log(client);
    throw new Error("Invalid client");
  }
  //log the filter
  // if (DEBUGLOG) //console.log(`Filter: ${JSON.stringify(filter)}`);
  //log the client
  // if (DEBUGLOG) //console.log(`Client: ${client}`);
  //get the records
  const records = await db.getFilteredCollection(client, filter);
  progressEvents.emit("on-init-progress", records.length);
  //console.log(`Found ${records.length} records`);

  let enrichedRecords = [];
  let progress = 0;

  await async.mapLimit(
    records,
    parallelLimit,
    async (record) => {
      const enrichedRecord = await enrichBasedOnWebsiteAndPrompt(
        record,
        promptFile
      );
      progress++;

      // if (DEBUGLOG) //console.log(`Progress: ${progress} of ${records.length}`);
      // if (DEBUGLOG) {
      //console.log("Enriched record: ", enrichedRecord);
      // }
      return enrichedRecord;
    },
    (err, results) => {
      if (err) {
        throw new Error(err);
      }
      enrichedRecords = results;
    }
  );

  //return the enriched records
  return enrichedRecords;
}

// Find records that have not been enriched yet
// and enrich them
async function findRemainingRecordsToEnrich() {
  //get all records that have a website
  const filter = { website: { $ne: "" } };
  const records = await db.getFilteredCollection("test", filter);
  //console.log(`Found ${records.length} records`);
  //filter out records that have already been enriched
  const remainingRecords = records.filter(
    (record) => !record.value_proposition
  );
  //console.log(`Found ${remainingRecords.length} records to enrich`);

  return remainingRecords.length;
}

//test
let test = false;
if (test) {
  (async () => {
    //console.log("Running test in enrichment-middleware.js");
    //await enrichBasedOnWebsiteAndPrompt({ website: 'https://lupineleads.com' }, '../prompts/systemPrompt-industry.txt').then((enrichedRecord) => { //console.log(enrichedRecord);});
    //filter on client: test and where website is not empty
    //const filter = { client: 'test', website: { $ne: '' } };
    await batchAndParallellEnrichIfNotEnrichedBasedOnFilter(
      "agency",
      {
        client: "agency",
        website: { $ne: "" },
        value_proposition: { $ne: "" },
      },
      promptIndex.getBasicInfoFromWebsite
    ).then((enrichedRecords) => {
      //console.log(enrichedRecords);
    });
  })();
}

module.exports = {
  enrichBasedOnWebsiteAndPrompt,
  getPrompts,
  getStatsTitle,
  enrichCampaignOnClient,
  getClients,
  createClient,
  getCampaigns,
  getStats,
  getStatsSE,
  enrichIfNotEnrichedBasedOnFilter,
  batchAndParallellEnrichIfNotEnrichedBasedOnFilter,
  findRemainingRecordsToEnrich,
  createEnrichment,
  getAllRecords,
  getAllEnrichment,
  addUser,
};
