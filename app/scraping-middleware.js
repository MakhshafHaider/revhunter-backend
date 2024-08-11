const axios = require('axios');
const https = require('https');
const { convert } = require('html-to-text');



let DEBUGLOG = false;

async function getCleanContentFromWebsite(url) {
    // if (DEBUGLOG) //console.log(`Processing URL ${url}`);

    const isValidUrl = (string) => {
        try {
          new URL(string);
        } catch (_) {
          return false;
        }
        return true;
      };

    //check if url is valid
    if (!url.startsWith('http')) {
        url = `https://${url}`;
    }

    if (!isValidUrl(url)) {
        // console.log(`Invalid URL ${url}`);
        throw new Error(`Invalid URL ${url}`);
    }

    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    const axiosInstance = axios.create({
        // baseURL : 'http://127.0.0.1',
        httpsAgent: httpsAgent,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537' },
        // timeout: 5000 // 5 seconds
    });
    // Fetch the HTML content of the website
    let response;
    try {
    //    let urltest = 'www.knowwhatsloved.com';
        response  = await axiosInstance.get(url);
        // console.log('response from webiste clean', response?.data);
    } 

    catch (err) {
        // console.log('err in api of webiste', err?.response?.statusText || err?.reason || "Not Found");
        // console.log('err in api of webiste', err);
        //Log in error log
        // throw new Error(`Error fetching URL ${url}. Error from api:  ${err}`);
        throw new Error(`Error fetching URL ${url}. Error from api:  ${err?.response?.statusText || err?.reason || "Not Found"}`);
    }
    // Check if response and response.data exist
    if (!response || typeof response.data === 'undefined') {
        throw new Error(`Response or response data is undefined for URL ${url}`);
    }

    // console.log('response in website data', response);

    const htmlContent = response?.data;

    // Convert HTML to text using html-to-text
    const options = {
        wordwrap: 130,
        selectors: [
            { selector: 'a', format: 'skip' },           // Skip all links
            { selector: 'script', format: 'skip' },      // Skip all script tags
            { selector: 'style', format: 'skip' },       // Skip all style tags
            { selector: 'img', format: 'skip' },]
    };

    const textContent = convert(htmlContent, options);
    const cleanedContent = textContent.replace(/\s+/g, ' ').trim();
    const trimmedContent = cleanedContent.slice(0, 6000);
    console.log('trimmedContent', trimmedContent.length);
    return trimmedContent;
}


module.exports = { getCleanContentFromWebsite };