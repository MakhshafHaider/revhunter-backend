/* eslint-disable no-undef */
const express = require("express");
const path = require("path");
const app = express();
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const csvMiddleware = require("./app/csv-middleware.js");
var bodyParser = require('body-parser');

// const warmupEmailsSimplified = require('./script.js');
// import warmupEmailsSimplified from ('./script.mjs');
const http = require("http").Server(app);
const io = require("socket.io")(http, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://enrichment-services-mp6k.onrender.com",
      "https://enrichment-services.onrender.com",
    ],
    credentials:true,            
    methods: ["GET", "POST"],
  },
});
const progressEmitter = require("./events/progress-events.js");
const cors = require("cors");
const db = require("./db/mongodb-connector.js");

// app middleware
const enrichmentMiddleware = require("./app/enrichment-middleware.js");

// Serve static files from Vue.js build output directory
app.use(express.static(path.join(__dirname, "enrichment-app/dist")));
app.use(cors());
// For parsing application/json
app.use(express.json());

// For parsing application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));
// app.use('/', authRoutes);


io.on("connection", (socket) => {
  console.log("a user connected");
  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

function onTotalUpdated(total) {
  io.emit("on-total", { total });
}
const array1 =[];

progressEmitter.on("on-db-doc-inserted", async (result) => {
  const { document, prompt, index, c } = result;
  // console.log("!!!!!!============!!!!!!!!!!!!!!!! prompt on db inserted", prompt);
  array1.push(c);
  // console.log('array of records', array1)

  const fullCount = Array.from({ length: 100 }, (_, i) => i + 1);
  const missingNumbers = fullCount.filter(number => !array1.includes(number));
  
  // console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!,Recevied debounce c ", missingNumbers);
  // console.log(
  //   "EVENT TRIGGERED: DB doc inserted:" + JSON.stringify(document.client)
  // );

  let client = document.client;
  let campaign = document.campaign;
  const stats = await enrichmentMiddleware.getStats(client, campaign, prompt);
  console.log("atats!!!!!!!!!!!!", stats, index);
  io.emit("on-db-doc-inserted", { stats, index });
});

progressEmitter.on("on-db-doc-finished", async (index) => {
  console.log("EVENT TRIGGERED: DB doc inserted:" + index);

  io.emit("on-db-doc-finished", index);
});

progressEmitter.on("on-db-doc-updated", (stat) => {
  // console.log("EVENT TRIGGERED: DB doc inserted:" , stat);

  io.emit("on-db-doc-updated");
});

// Listen to the event and update total items to process
progressEmitter.on("on-total", (total) => {
  // console.log(`EVENT TRIGGERED: Total count to upload ${total}`);
  onTotalUpdated(total);
});

// Listen to the event and update processing left
progressEmitter.on("on-update-progress", (progress) => {
  // console.log(`EVENT TRIGGERED: Progress ${progress}`);
  io.emit("on-update-progress", { progress });
});

progressEmitter.on("error", (err) => {
  io.emit("error", err);
});

app.get("/enrichment-remaining", async (req, res) => {
  const remaining = await enrichmentMiddleware.findRemainingRecordsToEnrich();
  res.status(200).json({ remaining });
});

app.get("/clients", async (req, res) => {
  //Get all clients in simple json
  const clients = await enrichmentMiddleware.getClients();
  // //console.log(JSON.stringify(clients));
  res.status(200).json({ clients });
});

app.post("/clients", async (req, res) => {
  //Create a client
  const result = await enrichmentMiddleware.createClient(req.body.client);
  res.status(200).json({ result });
});

app.get("/records/data", async (req, res) => {
  const stats = await enrichmentMiddleware.getAllEnrichment();
  res.status(200).json({ stats });
});


app.post("/login/user", async ( req, res) => {
  // console.log("req.body of user", req.body)
  const result = await enrichmentMiddleware.addUser(req.body);
  res.status(200).json({ result });

})

app.get("/getRecords", async (req, res) => {
  let filter =  {
    client: "agency",
    campaign: "c-levels",
    website: { $ne: "" },
  }
 
  const records = await enrichmentMiddleware.getAllRecords();


  // console.log("!!!!!!records!!!!!!!!!!!!!!!!!!!!!,", records);
  res.status(200).json({ message: "File uploaded", records });

});

app.get("/clients/:client/:campaign/stats", async (req, res) => {
  //Log what's happening
  console.log("Getting stats for client: " + req.params.client + " and campaign: " + req.params.campaign);
  const client = req.params.client;

  if (client === 'undefined') { // Adjust the condition based on your validation rules
      console.log('here');
    return res.status(400).json({ message: "Invalid or missing client parameter" });
  }

  const encodedCampaign = req.params.campaign;
  
  const campaign = decodeURIComponent(encodedCampaign);
  // //console.log("campaign", campaign);
  const stats = await enrichmentMiddleware.getStats(client, campaign);
  // //console.log("stats in server", stats)
  res.status(200).json({ stats });
});

app.get("/clients/:client/:campaign/statsTitle", async (req, res) => {
  //Log what's happening
  //console.log(
  //   "Getting stats for client: " +
  //     req.params.client +
  //     " and campaign: " +
  //     req.params.campaign
  // );
  const client = req.params.client;
  const encodedCampaign = req.params.campaign;
  const campaign = decodeURIComponent(encodedCampaign);
  const stats = await enrichmentMiddleware.getStatsTitle(client, campaign);
  // //console.log("stats in server", stats);
  res.status(200).json({ stats });
});

app.get("/clients/:client/:campaign/statsSE", async (req, res) => {
  //Log what's happening
  //console.log(
  //   "Getting stats for client: " +
  //     req.params.client +
  //     " and campaign: " +
  //     req.params.campaign
  // );
  const client = req.params.client;
  const encodedCampaign = req.params.campaign;
  const campaign = decodeURIComponent(encodedCampaign);
  const stats = await enrichmentMiddleware.getStatsSE(client, campaign);
  //console.log("stats in server", stats);
  res.status(200).json({ stats });
});


app.post("/clients/:client/:campaign/enrich", async (req, res) => {
  // console.log("ENRICHED CALLED", req);
  if (!req.body.prompt) {
    res.status(400).json({ message: "No prompt provided" });
    return;
  }
  if (!req.params.client) {
    res.status(400).json({ message: "No client provided" });
    return;
  }
  //Log what's happening
  // Get data from post request

  const client = req.params.client;
  const encodedCampaign = req.params.campaign;
  const campaign = decodeURIComponent(encodedCampaign);

  // console.log(
  //   "Enriching client: " + client + " and campaign: " + campaign,
  //   req.body.index
  // );
  const result = await enrichmentMiddleware.enrichCampaignOnClient(
    client,
    campaign,
    req.body.prompt,
    req.body.index,
    req.body.ip,
    req.body.userID
  );
  // console.log("+++result+++", result);
  res.status(200).json({ result });
});

app.get("/clients/:client/:campaign/:prompt/download", async (req, res) => {
  console.log("req.body", req.params.prompt);

  console.log("req.params.client", req.params.client);
  const client = req.params.client;
  const encodedCampaign = req.params.campaign;
  const campaign = decodeURIComponent(encodedCampaign);
  console.log("req.params.campaign",campaign);
  const result = await csvMiddleware.downloadContactsCSVWithClientAndCampaign(
    client,
    campaign,
    req.params.prompt
  );
  res.status(200).download(result);
});

app.post("/api/enrichment", async (req, res) => {
  // //console.log('req.body', req.body);

  const result = await enrichmentMiddleware.createEnrichment(req.body);
  // //console.log("clients", result);
  res.status(200).json({ result });
});

app.get("/clients/:client/campaigns", async (req, res) => {
  //console.log(req.params.client);
  const campaigns = await enrichmentMiddleware.getCampaigns(req.params.client);
  res.status(200).json({ campaigns });
});

app.get("/prompts", async (req, res) => {
  const prompts = await enrichmentMiddleware.getPrompts();
  res.status(200).json({ prompts });
});

// Any route should render your Vue app
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "enrichment-app/dist/index.html"));
});

app.post('/upload-csv-leads', upload.single('file'), (req, res) => {
  let results = [];
  // Stream the file contents and parse the CSV
  fs.createReadStream(req.file.path)
    .pipe(csvParser())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      // Once the CSV is parsed, call your function with the results
      // console.log('results are!!!!!!!!!!!!!!!!!', results);
      // warmupEmailsSimplified();

      // Optionally, delete the uploaded file after processing
      fs.unlinkSync(req.file.path);

      res.send('CSV processed and warmup initiated.');
    });
});

//File upload API, checking if the file is csv

app.post("/upload", upload.single("file"), async (req, res) => {

  console.log('req.body client', req.body);
  console.log('req.body campaign', req.body.campaign);
  //check if campaign is empty
  if (!req.body.campaign) {
    // console.log("res", res);
    res.status(400).json({ message: "No campaign provided" });
    return;
  }
  
  //check if client is empty
  if (!req.body.client) {
    res.status(400).json({ message: "No client provided" });
    return;
  }
  
  if (!req.file) {
    res.status(400).json({ message: "No file uploaded" });
    return;
  }

  let client = req.body.client;
  // Check if client.name is empty
  if (client && !client.name) {
    //check if client is string
    if (typeof client === "string") {
      client = {
        name: client,
      };
    }
  }

  let campaign = req.body.campaign;
  // Check if campaign.name is empty
  if (campaign && !campaign.name) {
    //check if campaign is string
    if (typeof campaign === "string") {
      campaign = {
        name: campaign,
      };
    }
  }

  try {
    //console.log("Importing CSV to DB");
    // //console.log("req.file.path", req.file.path);
    const absoluteFilePath = path.resolve(__dirname, req.file.path);
    // console.log("absoluteFilePath", absoluteFilePath);
    await csvMiddleware.importCSVtoDB(absoluteFilePath, true, client, campaign);
  } catch (err) {
    //console.log(err);
    res.status(400).json({ message: err.message });
  }
  //Return client object
  let result = await db.getClient(client.name);

  res.status(200).json({ message: "File uploaded", result });
});

const port = 4000; // or whatever port you want to use
http.listen(port, () => {
  //console.log(`Server running on http://localhost:${port}/`);
});

module.exports = app;