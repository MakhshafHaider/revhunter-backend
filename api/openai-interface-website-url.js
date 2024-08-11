/* eslint-disable no-undef */
// Description: Interface for OpenAI API
// Dependencies: axios, sleep, dotenv
const axios = require('axios');
const sleep = require('util').promisify(setTimeout);
const progressEvents = require('../events/progress-events');
require('dotenv').config();

let DEBUGLOG = false;
let OPENAIDEBUG = false;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;


async function callOpenAIWithCompletePromptAndModelForWebsite(systemPrompt, model) {
    //check input parameters
    if (!systemPrompt) {
        console.log('systemPrompt.lengths',systemPrompt.length);
        throw new Error('Invalid system prompt');
    }
    // if (!content) {
    //     // //console.log(content);
    //     throw new Error('Invalid content');
    // }
    if (!model) {
        throw new Error('Invalid model');
    }
    let response;
    try{
        console.log("API calling now !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
       // console.log('webiste content', content);
        // console.log('systemPrompt', systemPrompt);
        response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: model,
            messages: [{ role: 'system', content: systemPrompt}],
            temperature: 0.7,
            // max_tokens: 6000
        }, {
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
            // timeout: 10000
        });
        console.log("response while adding simplified website", response.data);
        console.log("response.data.choices ", response.data?.choices);
        // console.log("response while adding simplified website", response.data);
        let remainingTokens = response.headers['x-ratelimit-remaining-tokens'];
        progressEvents.emit('on-remaining-tokens', remainingTokens);
        // console.log('webiste content length', content?.length);
        // console.log('systemPrompt length ', systemPrompt?.length);
       
        // console.log(`Remaining tokens per minute: ${remainingTokens}`);
        //if (DEBUGLOG) //console.log(`Response: ${JSON.stringify(response.data)}`);
        // console.log(`Response from headers: ${JSON.stringify(response.headers)}`);
        if (remainingTokens < 35000) {
            // if(DEBUGLOG) //console.log('Waiting for tokens to renew...');
            await sleep(60000);
    
            //call the function again
            response = await callOpenAIWithCompletePromptAndModelForWebsite(systemPrompt,  model);
        }
    } catch (err) {
        console.log('Error while adding simplified website', err.response?.data);

        //Catch status 429 from OpenAI API and back off then try again
        if (err.response.status === 429) {
            // if(DEBUGLOG) //console.log('Waiting for tokens to renew...');
            await sleep(60000);
    
            //call the function again
            response = await callOpenAIWithCompletePromptAndModelForWebsite(systemPrompt, model);
        }
        // console.log('err from the api, err');
        // console.log('webiste content length', content?.length);

        // console.log('webiste content length', content);
        console.log('systemPrompt length ', systemPrompt?.length);
    
    }
    return  response;
    // response?.data?.choices[0]?.message?.content.trim()
}

module.exports = { callOpenAIWithCompletePromptAndModelForWebsite };

