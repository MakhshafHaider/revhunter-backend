// import ora from 'ora';
// import axios from 'axios';
// import fs from 'fs';

// ... rest of your code

// This Node.js script is designed to warm up email accounts by updating their settings
// through Smartlead's API. Before executing, replace 'kinled-hq.com' with the domain
// relevant to your email accounts. The script fetches email IDs and metadata, then updates
// the daily email limits and signatures based on the account's first name. Progress and errors
// are logged in the console, and the final success count is displayed. Adjust the 'apiKey' as needed.
// Throttling is implemented to avoid rate limit issues. After customization, run this script
// in a Node.js environment to perform the warmup process.

// const ora = require('ora');
// import ora from 'ora';

const axios = require('axios');
const fs = require('fs');

const warmupEmailsSimplified = async () => {
    // Prompt the user for the API key
    const apiKey = process.argv[2] || "0472de5f-7468-47d7-a505-08c38b23bf03_0q2cgzu";

    // Define API endpoint to get the IDs
    const baseURL = "https://server.smartlead.ai/api/v1/email-accounts/";
    let offset = 0;
    const limit = 100; // Fetching in chunks of 100, can be adjusted if needed

    let allIds = [];
    // const spinner = ora('Fetching IDs').start();

    // Fetch all IDs using pagination
    while (true) {
        //wait 1 second before each request
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log(' i am called ')
        try {
            const response = await axios.get(baseURL, {
                params: {
                    api_key: apiKey,
                    offset: offset,
                    limit: limit
                }
            });
            console.log('response', response);

            // Break the loop if no more data is returned
            if (!response.data.length) {
                console.log("break")
                break;
            }

            // Extract IDs and first names from the current chunk and add to the main list
            const idsChunk = response.data.map(item => ({ id: item.id, from_name: item.from_name, from_email: item.from_email }));
            allIds = allIds.concat(idsChunk);

            // If the returned data is less than the limit, it means we've reached the end
            if (response.data.length < limit) {
                break;
            }

            // Increase the offset for the next loop iteration
            offset += limit;

        } catch (error) {
            // spinner.fail(`Failed to fetch IDs: ${error}`);
            return;
        }
    }

    // spinner.succeed('Fetched all IDs');
    //print out the IDs
    console.log(allIds);
    //store the ids in a file
    fs.writeFile('ids.json', JSON.stringify(allIds), function (err) {
        if (err) return console.log(err);
        console.log('ids > ids.json');
    });

    // Define API endpoint and headers for the update process
    const urlTemplate = `https://server.smartlead.ai/api/v1/email-accounts/{{id}}?api_key=${apiKey}`;
    const headers = {
        "Content-Type": "application/json"
    };

    // Data payload for the request, modified according to your new requirements
    const createPayload = (from_name) => ({
        max_email_per_day: 24,
        custom_tracking_url: "",
        bcc: "",
        signature: `Best regards, ${from_name}`,
        time_to_wait_in_mins: 60,
    });

    let successfulUpdates = 0;
    // const updateSpinner = ora('Updating IDs').start();
    console.log('all ids', allIds)
    // Loop through each ID and first name
    for (const { id, from_name, from_email } of allIds) {

        if (from_email && from_email.endsWith("kinled-hq.com")) {
            console.log(`Updating ID ${id} - ${from_email}`);
            try {
                //wait 200 ms before each request
                await new Promise(resolve => setTimeout(resolve, 1000));
                console.log(from_name);
                //take only the first name from from_name
                const first_name = from_name.split(" ")[0];
                const payload = createPayload(first_name);
                const response = await axios.post(urlTemplate.replace("{{id}}", id), payload, { headers: headers });
                if (response.status === 200) { // Assuming 200 is the success status code
                    successfulUpdates++;
                }
                console.log(`Updated ID ${id} - ${from_email}`);
            } catch (error) {
                // Handle errors as needed
                console.log(`Failed to update ID ${id}: ${error}`);
                // Print out the error in detail
                console.log(error);
            }
        }
    }

    // updateSpinner.succeed(`Total successful updates: ${successfulUpdates}/${allIds.length}`);
    console.log("All requests completed!");
};
module.exports = { warmupEmailsSimplified };

// warmupEmailsSimplified();
// module.exports = warmupEmailsSimplified;