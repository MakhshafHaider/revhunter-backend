/* eslint-disable no-unused-vars */
/* eslint-disable no-dupe-keys */
/* eslint-disable no-undef */
const { ObjectId } = require("mongodb");
const { MongoClient, ServerApiVersion, Collection } = require("mongodb");
const LEADS_COLLECTION = "leads_enrichment";
const CONTACTS_COLLECTION = "contacts";
const CLIENTS_COLLECTION = "clients";
const ENRICHMENT_DB = "enrichment";
const ENRICHMENT_RECORDS = "records";
const USER = "user";
// const io = require("socket.io");
const _ = require("lodash");
const { EventEmitter } = require("events");
// eslint-disable-next-line no-unused-vars
const { type } = require("os");
const progressEmitter = require("../events/progress-events");
const { validateEmail } = require("../api/millionverifier-interface");
const eventEmitter = new EventEmitter();

const DEBUGLOG = false;
let db = null;

// eslint-disable-next-line no-undef
require("dotenv").config();

//add env conf
// eslint-disable-next-line no-undef
const uri = process.env.MONGODB_URI;
//console.log("uri", uri)
const collectionsEnum = {
  CONTACTS_COLLECTION: CONTACTS_COLLECTION,
  CLIENTS_COLLECTION: CLIENTS_COLLECTION,
};

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  connectTimeoutMS: 60000,
});

async function initDB() {
  // if (DEBUGLOG) //console.log("Initializing DB");
  if (db) {
    // if (DEBUGLOG) //console.log("DB already initialized");
    return true;
  }
  try {
    await client.connect();
    //console.log("Connected successfully to server");
    db = client.db(ENRICHMENT_DB);

    // Emit event to signal that the connection is ready
    eventEmitter.emit("dbConnected");
    return true;
  } catch (err) {
    console.log("err from db", err);
  }
}

async function getClients() {
  if (!db) {
    await initDB();
  }
  // return all records from collection clients
  const collection = await db.collection(CLIENTS_COLLECTION);
  const cursor = await collection.find({});
  const clients = [];
  await cursor.forEach((doc) => clients.push(doc));

  return clients;
}

async function getClient(clientName) {
  if (!db) {
    await initDB();
  }
  // return specific client
  const collection = await db.collection(CLIENTS_COLLECTION);
  // return client based on name
  const client = await collection.findOne({ name: clientName });
  return client;
}

async function createClient(client) {
  if (!db) {
    await initDB();
  }

  //expect clientName to be a JSON object
  if (typeof client !== "object") {
    //We are just passing a string so create the client object
    client = { name: client };
  }

  //check if it has name field
  if (!client.name) {
    throw new Error("Client does not have a name");
  }

  // Create a new client if it doesn't exist; update otherwise
  const record = await db
    .collection(CLIENTS_COLLECTION)
    .updateOne({ name: client.name }, { $set: client }, { upsert: true });

  return record;
}

async function createEnrichment(client) {
  if (!db) {
    await initDB();
  }

  //expect clientName to be a JSON object
  if (typeof client !== "object") {
    //We are just passing a string so create the client object
    client = { name: client };
  }

  const record = await db.collection(ENRICHMENT_RECORDS).insertOne(client);

  return record;
}

async function getAllEnrichmentRecords() {
  if (!db) {
    await initDB();
  }

  const records = await db.collection(ENRICHMENT_RECORDS).find({}).toArray();
  //console.log("records", records);
  return records;
}

async function addUser(user) {
  if (!db) {
    await initDB();
  }

  const existingUser = await db.collection(USER).findOne({ email: user.email });

  if (existingUser) {
    return existingUser;
  }

  const record = await db.collection(USER).insertOne(user);
  // console.log("record is:", record);
  return {record, user};
}

async function updateUser(user) {
  if (!db) {
    await initDB();
  }

  const filter = { _id: new ObjectId(user.userID) };

  const update = {
    $push: {
      records: {
        client: user.client,
        campaign: user.campaign,
        prompt: user.prompt,
        stats: user.stats,
        ip: user.ip,
        currentDateTime: user.currentDateTime,
      },
    },
  };

  // Update the user record
  const result = await db.collection(USER).updateOne(filter, update);

  if (result.matchedCount === 1) {
    // User record updated successfully
    return "User record updated";
  } else {
    // User with the specified ID was not found
    return "User not found";
  }
}

async function getAllRecords() {
  if (!db) {
    await initDB();
  }

  const records = await db.collection(CONTACTS_COLLECTION).find({}).toArray();
  //console.log("records", records);
  return records;
}

async function createCampaign(client, campaign) {
  if (!db) {
    await initDB();
  }
  //expect objects
  if (typeof client !== "object") {
    throw new Error("Client is not an object");
  }
  if (typeof campaign !== "object") {
    throw new Error("Campaign is not an object");
  }

  // create a new campaign by adding it to the client's campaigns array
  const collection = await db.collection("clients");
  let record = await collection.updateOne(
    { client: client },
    { $push: { campaigns: campaign } }
  );

  return record;
}

async function getCampaigns(clientName) {
  if (!db) {
    await initDB();
  }
  // get all campaigns for a client
  const collection = await db.collection(CLIENTS_COLLECTION);
  const clientDoc = await collection.findOne({ name: clientName });
  return clientDoc ? clientDoc.campaigns : [];
}

async function addCampaignToClient(client, campaign) {
  if (!db) {
    await initDB();
  }
  // add campaign to client's campaigns array
  const collection = await db.collection(CLIENTS_COLLECTION);

  const result = await collection.updateOne(
    { name: client.name },
    { $addToSet: { campaigns: campaign } }
  );

  return result;
}

async function getStats(client, campaign, prompt) {
  // console.log("PROMPT !!!!!!!!!!!!!!!!!!!!!!!!!=======================!!!!!!!!!!!!!!", prompt);
  let promptObject = prompt?.name;
  // if client is empty
  if (!client) {
    console.error("Client is empty");
    return null;
  }
  if (!campaign) {
    console.error("Campaign is empty");
    return null;
  }

  //console.log(`Getting stats for client ${client} and campaign ${campaign}`);

  if (!db) {
    await initDB();
  }
  // get stats for a client
  const collection = await db.collection(CONTACTS_COLLECTION);
  //console.log("collection is", collection.countDocuments);
  // find all records with value_proposition not empty
  // and website column not empty
  // and client and campaign match

  const promptStat = [
    { simplified_title: { $exists: true, $ne: null, $ne: "" } },
  ];
  switch (promptObject) {
    case "Basic Enrichment ENG":
      promptStat.push({
        value_proposition: { $exists: true, $ne: null, $ne: "" },
      });
      break;
    case "Basic Enrichment SE":
      promptStat.push({
        value_proposition: { $exists: true, $ne: null, $ne: "" },
      });
      break;
    case "Better Titles ENG":
      promptStat.push({
        simplified_name: { $exists: true, $ne: null, $ne: "" },
      });
      break;
    default:
      break;
  }

  const enrichedNumber = await collection.countDocuments({
    $or: [...promptStat],
    website: { $ne: null, $ne: "" },
    client: client,
    campaign: campaign,
  });

  const totalEnrichmentRun = await collection.countDocuments({
    $or: [
      ...promptStat,
      { enrichment_status: { $exists: true, $ne: null, $ne: "" } },
      { scraping_status: { $exists: true, $ne: null, $ne: "" } },
      // { email_status: { $exists: true, $ne: null, $ne: "" } },
    ],
    website: { $ne: null, $ne: "" },
    client: client,
    campaign: campaign,
  });

  const EmailNotVerified = await collection.countDocuments({
    $or: [
      {
        email_status: { $in: ["risky", "bad"] },
      },
    ],
    website: { $ne: null, $ne: "" },
    client: client,
    campaign: campaign,
  });

  // const WebsiteInvalidURL = await collection.countDocuments({
  //   $or: [
  //     {
  //       simplified_website: { $exists: true, $ne: null, $ne: "" } ,
  //     },
  //   ],
  //   // website: { $ne: null, $ne: "" },
  //   client: client,
  //   campaign: campaign,
  // });


  // console.log("Email not verified",EmailNotVerified );

  let invalidUrls = 0;
  let records = collection.find({ client: client, campaign: campaign });
  // console.log("records", records.simplified_website);
  await records.forEach((record) => {
  
    try {
      new URL(record?.website);
    } catch (err) {
      invalidUrls++;
    }
  });

  // count all records in collection
  const totalRecords = await collection.countDocuments({
    client: client,
    campaign: campaign,
  });

  //console.log("totalNumbetotalNumbertotalNumbertotalNumberr", totalNumber);
  // count all records with website empty
  let faultyUploads = await collection.countDocuments({
    website: null,
    client: client,
    campaign: campaign,
  });

  //collate and return
  faultyUploads += invalidUrls;
  const stats = {
    enrichedNumber,
    totalRecords,
    faultyUploads,
    totalEnrichmentRun,
  };

  // console.log('JSON.stringify(stats)',JSON.stringify(stats));
  // progressEmitter.emit("on-db-doc-updated", stats);

  return stats;
}

async function getStatsBasicTitle(client, campaign) {
  // if client is empty
  if (!client) {
    console.error("Client is empty");
    return null;
  }
  if (!campaign) {
    console.error("Campaign is empty");
    return null;
  }

  //console.log(`Getting stats for client ${client} and campaign ${campaign}`);

  if (!db) {
    await initDB();
  }
  // get stats for a client
  const collection = await db.collection(CONTACTS_COLLECTION);
  //console.log("collection is", collection.countDocuments);
  // find all records with value_proposition not empty
  // and website column not empty
  // and client and campaign match
  const enrichedNumber = await collection.countDocuments({
    $or: [
      { simplified_name: { $exists: true, $ne: null, $ne: "" } },
      { simplified_title: { $exists: true, $ne: null, $ne: "" } },
    ],
    website: { $ne: null, $ne: "" },
    client: client,
    campaign: campaign,
  });

  //console.log("ENRICHED !!!!!!!!!!!!!!!!!!", enrichedNumber);

  let invalidUrls = 0;
  let records = collection.find({ client: client, campaign: campaign });
  await records.forEach((record) => {
    try {
      new URL(record.website);
    } catch (err) {
      invalidUrls++;
    }
  });
  //console.log(
  //   "Client, campaignClient, campaignClient, campaignClient, campaign ",
  //   client,
  //   campaign
  // );

  // count all records in collection
  const totalNumber = await collection.countDocuments({
    client: client,
    campaign: campaign,
  });

  //console.log("totalNumbetotalNumbertotalNumbertotalNumberr", totalNumber);
  // count all records with website empty
  let faultyUploads = await collection.countDocuments({
    website: null,
    client: client,
    campaign: campaign,
  });

  //collate and return
  faultyUploads += invalidUrls;
  const stats = [
    {
      enrichedNumber: enrichedNumber,
      totalNumber: totalNumber,
      faultyUploads: faultyUploads,
    },
  ];
  // //console.log(JSON.stringify(stats));
  // progressEmitter.emit("on-db-doc-updated", stats);

  return stats;
}

async function getStatsSE(client, campaign) {
  // if client is empty
  if (!client) {
    console.error("Client is empty");
    return null;
  }
  if (!campaign) {
    console.error("Campaign is empty");
    return null;
  }

  //console.log(`Getting stats for client ${client} and campaign ${campaign}`);

  if (!db) {
    await initDB();
  }
  // get stats for a client
  const collection = await db.collection(CONTACTS_COLLECTION);
  //console.log("collection is", collection.countDocuments);
  // find all records with value_proposition not empty
  // and website column not empty
  // and client and campaign match
  const enrichedNumber = await collection.countDocuments({
    $or: [
      { comment_on_content_piece: { $exists: true, $ne: null, $ne: "" } },
      { value_proposition: { $exists: true, $ne: null, $ne: "" } },
    ],
    website: { $ne: null, $ne: "" },
    client: client,
    campaign: campaign,
  });

  //console.log("ENRICHED !!!!!!!!!!!!!!!!!!", enrichedNumber);

  let invalidUrls = 0;
  let records = collection.find({ client: client, campaign: campaign });
  await records.forEach((record) => {
    try {
      new URL(record.website);
    } catch (err) {
      invalidUrls++;
    }
  });
  //console.log(
  //   "Client, campaignClient, campaignClient, campaignClient, campaign ",
  //   client,
  //   campaign
  // );

  // count all records in collection
  const totalNumber = await collection.countDocuments({
    client: client,
    campaign: campaign,
  });

  //console.log("totalNumbetotalNumbertotalNumbertotalNumberr", totalNumber);
  // count all records with website empty
  let faultyUploads = await collection.countDocuments({
    website: null,
    client: client,
    campaign: campaign,
  });

  //collate and return
  faultyUploads += invalidUrls;
  const stats = [
    {
      enrichedNumber: enrichedNumber,
      totalNumber: totalNumber,
      faultyUploads: faultyUploads,
    },
  ];
  // //console.log(JSON.stringify(stats));
  // progressEmitter.emit("on-db-doc-updated", stats);

  return stats;
}

// eslint-disable-next-line no-redeclare
async function close() {
  try {
    // Close the connection
    await client.close();
    //console.log("Closed connection");
  } catch (err) {
    //console.log(err);
  }
}

// function to add document to collection
// eslint-disable-next-line no-unused-vars
async function addDocument(document) {
  // console.log("docuemt to be added", document)
  // Expected fields
  const expectedFields = [
    // "website",
    // "email",
    "company_name",
    "client",
    "campaign",
  ];

  // Check if document has all expected fields
  const keys = Object.keys(document);
  const isValid = expectedFields.every((field) => keys.includes(field));
  if (!isValid) {
    // //console.log(JSON.stringify(keys));
    // //console.log(JSON.stringify(expectedFields));
    // console.log(JSON.stringify(document));
    throw new Error("Document does not have the expected fields here");
  }
  if (Object.keys(document).length === 0) {
    throw new Error("Document object is empty");
  }

  const cleanedDocument = {};

  // Copy non-empty string fields to the cleaned document
  for (const key in document) {
    if (document.hasOwnProperty(key) && document[key] !== '') {
      cleanedDocument[key] = document[key];
    }
  }

  // console.log("cleaned document!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!1", cleanedDocument);
  // delete document.id;
  delete cleanedDocument._id;

  try {
    // add document to collection
    // console.log("keys.length", keys.length);
    // console.log('document.email',document.email, document?.value_proposition);
    // console.log(document, "documeNT");

    await db
      .collection(CONTACTS_COLLECTION)
      .updateOne(
        { _id: document?._id },
        { $set: cleanedDocument },
        { upsert: true }
      );
    //   await db
    // .collection(CONTACTS_COLLECTION)
    // .replaceOne(
    //   { email: document.email },
    //   document,
    //   { upsert: true }
    // );

  } catch (err) {
    console.log("can not update record", err);
  }
}

async function getCollection(collection) {
  if (!db) {
    await initDB();
  }

  return db.collection(collection);
}

async function getFilteredCollection(collection, filter) {
  // check input parameters
  if (!collection) {
    throw new Error("Invalid collection");
  }
  if (!filter) {
    throw new Error("Invalid filter");
  }

  if (!db) {
    await initDB();
  }

  //console.log(`Getting filtered collection ${collection} with filter ${JSON.stringify(filter)}`);

  return db.collection(collection).find(filter).toArray();
}

// async function getFilteredContacts(filter) {
//   if (!filter) {
//     throw new Error("Invalid filter");
//   }

//   if (!db) {
//     await initDB();
//   }

//   // console.log(`Getting filtered collection ${CONTACTS_COLLECTION} with filter ${JSON.stringify(filter)} ${db.collection(CONTACTS_COLLECTION).find(filter).toArray()}`);

//   let data = await db.collection(CONTACTS_COLLECTION).find(filter).toArray();
//   // console.log(data);
//   return db.collection(CONTACTS_COLLECTION).find(filter).toArray();
// }
async function getFilteredContacts(filter, limit, offset) {
  // console.log('limit', limit);
  if (!filter) {
    throw new Error("Invalid filter");
  }

  if (!db) {
    await initDB();
  }

  // let offset = 0;
  let allRecords = [];

  while (true) {
    const batchRecords = await db
      .collection(CONTACTS_COLLECTION)
      .find(filter)
      .skip(offset)
      .limit(limit)
      .toArray();

    if (batchRecords.length === 0) {
      break;
    }

    // allRecords = allRecords.concat(batchRecords);
    offset += limit;
    return batchRecords;
  }
  // console.log("all records", allRecords.length);
  // return allRecords;
}

// function to add document to collection with strict validation
async function addDocumentStrict(document, collection = "") {
  // Remove empty or null keys
  // console.log("document are", document.length);

  // for (let key of Object.keys(document)) {
  //   if (key === "" || key === null) {
  //     delete document[key];
  //   }
  // }

  // // Trim whitespace for all string fields
  // for (let [key, value] of Object.entries(document)) {
  //   if (typeof value === "string") {
  //     document[key] = value.trim();
  //   }
  // }

  //check if db is connected
  if (!db) {
    await initDB();
  }

  //if collection is empty, use default
  if (!collection) {
    collection = LEADS_COLLECTION;
  }

  //Make sure we are not adding a record with an empty email
  //unless we are adding a client
  // if (!document.email) {
  //   //console.log("DB: Document does not have an email");

  //   //console.log(JSON.stringify(document));

  //   //console.log(collection);
  //   throw new Error("Document does not have an email");
  // }

  // Expected fields
  const expectedFields = [
    "website",
    "email",
    "company_name",
    "client",
    "campaign",
  ];
  //Assume company = company_name
  // document.company = document.company_name;

  // Check if document has all expected fields
  // const keys = Object.keys(document);
  // const isValid = expectedFields.every((field) => keys.includes(field));

  // if (!isValid) {
  //   //console.log(JSON.stringify(keys));
  //   //console.log(JSON.stringify(expectedFields));
  //   //console.log(JSON.stringify(document));
  //   console.error("Document does not have the expected fields");
  //   throw new Error("Document does not have the expected fields here2");
  // }

  // Additional checks
  // for (const key of keys) {
  //   // Make sure all values are strings
  //   if (typeof document[key] !== "string") {
  //     console.error(`Field ${key} must be a string`);
  //     //console.log(key);
  //     //console.log(typeof document[key]);
  //     //console.log(JSON.stringify(document));
  //     throw new Error(`Field ${key} must be a string`);
  //   }

  //   // Make sure all keys are in snake_case
  //   if (key !== _.snakeCase(key)) {
  //     console.error(`Key ${key} must be in snake_case`);
  //     throw new Error(`Key ${key} must be in snake_case`);
  //   }
  // }

  //check validity of website
  // if (document.website) {
  //   try {
  //     new URL(document.website);
  //   } catch (err) {
  //     //console.log("I am throwing the error")
  //     console.error(`Invalid URL ${document.website}`);
  //     throw new Error(`Invalid URL ${document.website}`);
  //   }
  // }
  // try {
  //   const result = await validateEmail(document.email);
  //   document.email_status = result.quality;
  // } catch (error) {
  //   console.log("error", error);
  // }

  try {
    // add document to collection using upsert based on email
    const query = { email: document.email };
    const update = { $set: document };
    // const options = { upsert: true };
    const options = { ordered: true };

    // if (DEBUGLOG) //console.log(query, update, options, collection);
    if (!db.collection) {
      //console.log("db.collection is not defined");
    }
    try {
      // console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!", document, options, "===================================================")
      await db.collection("contacts").insertMany(document, options);
      // if (DEBUGLOG) //console.log("Added document to collection");
      // progressEmitter.emit('on-db-doc-inserted', document);
    } catch (err) {
      //Check if MongoServerError
      if (err.name === "MongoServerError") {
        //Check if duplicate key error
        if (err.code === 11000) {
          //console.log("Duplicate key error");
          // //console.log(JSON.stringify(query));
          // //console.log(JSON.stringify(update));
        } else if (err.code === 56) {
          //console.log("DB: Error with empty update path");
          //console.log(err);
          // //console.log(JSON.stringify(query));
          // //console.log(JSON.stringify(update));
          //Log all details
          // //console.log(JSON.stringify(document));
        }
        throw err;
      }
      //console.log("DB: Error updating document in collection");
      //console.log(err);
      // //console.log(JSON.stringify(query));
      //Log all details
      // //console.log(JSON.stringify(query));
      // //console.log(JSON.stringify(update));
    }
  } catch (err) {
    //console.log("Error adding document to collection");
    //Log all details
    //console.log(JSON.stringify(document));
    //console.log(err);
    throw err;
  }
}

// function to print out the number of documents in a collection
async function countDocuments(collection) {
  //stop if collection is empty
  if (!collection) {
    throw new Error("Collection name is empty");
  }

  try {
    // print the number of documents in a collection
    const count = await db.collection(collection).countDocuments();
    //console.log(`This collection has ${count} documents`);
  } catch (err) {
    //console.log(err);
  }
}

// Delete all documents in a collection
async function deleteAllDocuments(collection) {
  //stop if collection is empty
  if (!collection) {
    throw new Error("Collection name is empty");
  }

  try {
    // delete all documents in a collection
    await db.collection(collection).deleteMany({});
    //console.log(`Deleted all documents in collection ${collection}`);
  } catch (err) {
    //console.log(err);
  }
}

let test = false;
if (test) {
  getFilteredCollection("agency", { email: "daniel.strieder@credi2.com" })
    .then((cursor) => {
      cursor.forEach(console.dir);
    })
    .catch(console.dir);
}
(async () => {
  if (!db) await initDB();
})();

module.exports = {
  collectionsEnum,
  initDB,
  getClient,
  addUser,
  updateUser,
  getStatsSE,
  getStatsBasicTitle,
  getFilteredContacts,
  addDocumentStrict,
  addCampaignToClient,
  createCampaign,
  createClient,
  getClients,
  getCampaigns,
  getStats,
  addDocument,
  close,
  countDocuments,
  getCollection,
  getFilteredCollection,
  createEnrichment,
  getAllEnrichmentRecords,
  getAllRecords,
};
