const axios = require("axios");
const sleep = require("util").promisify(setTimeout);
const progressEvents = require("../events/progress-events");

require("dotenv").config();

let DEBUGLOG = false;
let OPENAIDEBUG = false;
const MILLIONVERIFIER_API_KEY = process.env.MILLIONVERIFIER_API_KEY;

async function validateEmail(email) {
  try {
    // Define the API endpoint and parameters
    const endpoint = "https://api.millionverifier.com/api/v3/";
    const params = {
      api: MILLIONVERIFIER_API_KEY,
      email: email,
      timeout: 5000,
    };

    // Make the GET request to the API
    try {
      const response = await axios.get(endpoint, { params });
      //   console.log("!!!!!!!!!!!!!!!! response in email", response.data.quality);
    //   console.log("!!!!!!!!!!!!!!!! response in email", response.status);

      // Check for a successful response
      if (response.status === 200) {
        // Optionally log the response data for debugging
        if (DEBUGLOG) {
          // console.log('response.data+++++++=================',response.data);
        }

        // Emit a progress event with the response data
        progressEvents.emit("email-validation", response.data);

        // Return the response data
        return response.data;
      } else {
        // Handle non-200 status codes as you see fit
        console.log("response.status", response.status);
        throw new Error(`Unexpected response status: ${response.status}`);
      }
    } catch (error) {
      console.log("error", error);
    }
  } catch (error) {
    // Optionally log the error for debugging
    if (OPENAIDEBUG) {
      console.error(error);
    }
    console.log( error);

    // Optionally re-throw the error if you want to handle it higher up
    // throw error;
  }
}

module.exports = { validateEmail };
