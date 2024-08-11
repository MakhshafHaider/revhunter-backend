const request = require("supertest");
const express = require("express");
const multer = require("multer");
// const '../testing_file.csv' = require('../testing_file.csv'  );
const { initDB, close } = require("../db/mongodb-connector"); // Replace with your actual import
const path = require("path");
const db = require("../db/mongodb-connector");
const {
  downloadContactsCSVWithClientAndCampaign,
} = require("../app/csv-middleware");
const app = require("../server");

// Assuming `yourUploadHandler` is the function you provided in your original code.
const csvMiddleware = require("../app/csv-middleware"); // Update with correct path
// Mock setup for multer
jest.mock("multer", () => {
  return jest.fn(() => ({
    single: jest.fn().mockImplementation(() => (req, res, next) => {
      req.file = req.file || null; // Mock file attachment
      next();
    }),
  }));
});

// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.post("/upload", multer().single("file"), csvMiddleware.importCSVtoDB);
// Test suite
describe("POST /upload", () => {
  let db;

  // Initialize database before running any test cases
  beforeAll(async function () {
    db = await initDB();
    return true;
  });

  // Clean up the database after all tests have run.
  afterAll(async function () {
    await close();
  });

  it("should return 400 if no file is uploaded", async () => {
    const res = await request(app)
      .post("/upload")
      .send({ campaign: "SampleCampaign", client: "SampleClient" });

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message: "No file uploaded" });
  }, 60000);

  it("should return 400 if no campaign provided", async () => {
    const filePath = path.join(__dirname, "../testing_file.csv"); // Replace with a path to a test CSV file
    const res = await request(app)
      .post("/upload")
      .field("client", "sampleClient")
      .attach("file", filePath); // Ensure the file exists

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message: "No campaign provided" });
  }, 60000); // Increased timeout

  it("should return 400 if no client provided", async () => {
    const filePath = path.join(__dirname, "../testing_file.csv"); // Replace with a path to a test CSV file
    const res = await request(app)
      .post("/upload")
      .send({ campaign: "Test Campaign" });
    // .attach('file', path.resolve(__dirname, './testing_file.csv')); // Adjust the file path

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ message: "No client provided" }); // This is correct as per your route logic
  }, 60000);

  it("should handle successful file upload", async () => {
    const filePath = path.join(__dirname, "../testing_file.csv");
    // Mock the dependencies and functions inside `yourUploadHandler` for a successful scenario
    const res = await request(app)
      .post("/upload")
      .field("client", "sampleClient")
      .field("campaign", "sampleCampaign")
      .attach("file", filePath); // Update with actual file path

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("message", "File uploaded");
  }, 60000);

  it("should handle errors during file processing", async () => {
    // You need to mock the file processing function to throw an error
    const filePath = path.join(__dirname, "../testing_file.csv");
    const res = await request(app)
      .post("/upload")
      .send({client:"sampleCLiet", campaign: 'sampleCampaign', file: filePath})
      // .field("client", "sampleClient")
      // .field("campaign", "sampleCampaign")
      // .attach("file", filePath); // Update with actual file path
    expect(res.statusCode).toBe(400);
    // Expect some error message, adjust according to the actual error handling in your code
    expect(res.body).toHaveProperty("message");
  });

  // Add more test cases as needed...

  /// enrich

  it("should process valid request successfully", async () => {
    const response = await request(app)
      .post("/clients/client1/campaignA/enrich")
      .send({
        prompt: "Better Titles ENG",
        index: 1,
        ip: "127.0.0.1",
        userID: "65661cef741495ec343901ee",
      });
    expect(response.statusCode).toBe(200);
    // console.log('respons', response);
    expect(response.body).toEqual({});
  });

  it("should handle invalid client parameter", async () => {
    const response = await request(app)
      .post("/clients//campaignA/enrich")
      .send({
        prompt: "Better Titles ENG",
        index: 1,
        ip: "127.0.0.1",
        userID: "65661cef741495ec343901ee",
      });
    //  console.log('res', response);
    expect(response.statusCode).toBe(404); // Assuming the error results in a 500 status
  }, 60000);

  it("should handle invalid campaign parameter", async () => {
    const response = await request(app)
      .post("/clients/clientA//enrich")
      .send({
        prompt: "Better Titles ENG",
        index: 1,
        ip: "127.0.0.1",
        userID: "65661cef741495ec343901ee",
      });
    //  console.log('res', response);
    expect(response.statusCode).toBe(404); // Assuming the error results in a 500 status
  }, 60000);
  it("should successfully retrieve stats", async () => {
    const client = "client1";
    const campaign = encodeURIComponent("campaignA");
    const response = await request(app).get(
      `/clients/${client}/${campaign}/stats`
    );

    // console.log('response', response);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      stats: {
        enrichedNumber: 0,
        totalRecords: 0,
        faultyUploads: 0,
        totalEnrichmentRun: 0,
      },
    });
  }, 20000);

});

describe("GET /clients/:client/:campaign/stats", () => {
  let db;

  // Initialize database before running any test cases
  beforeAll(async function () {
    db = await initDB();
    return true;
  });

  // Clean up the database after all tests have run.
  afterAll(async function () {
    await close();
  });

 
  it("should handle invalid or missing client parameter", async () => {
    const campaign = encodeURIComponent("campaignA");
    const invalidClient = "undefined";

    const response = await request(app).get(
      `/clients/${invalidClient}/${campaign}/stats`
    ); // Notice the missing client in the URL
    // console.log(response)
    expect(response.statusCode).toBe(400); // or the status code you use for invalid input
    // expect the appropriate error message or response
  });

  // ... other tests ...
});


jest.mock('../app/csv-middleware', () => {
  return {
    downloadContactsCSVWithClientAndCampaign: jest.fn(),
  };
});

describe('downloadContactsCSVWithClientAndCampaign', () => {
  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    csvMiddleware.downloadContactsCSVWithClientAndCampaign.mockClear();
  });

  it('should handle valid client and campaign parameters', async () => {
    const client = 'TestClient';
    const campaign = encodeURIComponent('TestCampaign2023'); // Encoding the campaign
    const prompt = 'Basic Enrichment ENG';

    // Set up the mock implementation
    csvMiddleware.downloadContactsCSVWithClientAndCampaign.mockImplementationOnce((client, campaign, prompt) => {
      return Promise.resolve(`./testing_file.csv`);
    });

    // Make a request to your route
    const response = await request(app).get(`/clients/${client}/${campaign}/${prompt}/download`);
    //  console.log('response', response);
    // Assertions
    expect(response.status).toBe(200);
    expect(csvMiddleware.downloadContactsCSVWithClientAndCampaign).toHaveBeenCalledWith(client, 'TestCampaign2023', prompt);
    expect(csvMiddleware.downloadContactsCSVWithClientAndCampaign).toHaveBeenCalledTimes(1);
    // You can add more assertions based on the returned file, headers, etc.
  });

  // Add more tests here to handle different scenarios like invalid inputs, server errors, etc.
});