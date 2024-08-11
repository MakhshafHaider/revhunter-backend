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


async function callOpenAIWithCompletePromptAndModel(systemPrompt, content, model) {
    //check input parameters
    if (!systemPrompt) {
        // //console.log(systemPrompt);
        throw new Error('Invalid system prompt');
    }
    if (!content) {
        // //console.log(content);
        throw new Error('Invalid content');
    }
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
            messages: [{ role: 'system', content: systemPrompt}, { role: 'user', content: content }],
            temperature: 0.7,
            // max_tokens: 6000
        }, {
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
            // timeout: 10000
        });
        console.log("response from open ai", response);
        let remainingTokens = response.headers['x-ratelimit-remaining-tokens'];
        progressEvents.emit('on-remaining-tokens', remainingTokens);
        // console.log('webiste content length', content?.length);
        // console.log('systemPrompt length ', systemPrompt?.length);
       
        console.log(`Remaining tokens per minute: ${remainingTokens}`);
        //if (DEBUGLOG) //console.log(`Response: ${JSON.stringify(response.data)}`);
        // console.log(`Response from headers: ${JSON.stringify(response.headers)}`);
        if (remainingTokens < 35000) {
            // if(DEBUGLOG) //console.log('Waiting for tokens to renew...');
            await sleep(60000);
    
            //call the function again
            response = await callOpenAIWithCompletePromptAndModel(systemPrompt, content, model);
        }
    } catch (err) {
        //Catch status 429 from OpenAI API and back off then try again
        
        console.log('err from the api, err', err.response?.data);
        console.log('err from the api, status', err.response?.status);
        if(!err.response.data){
            console.log('error from undefined console', err.response);
        }
        if(!err.response){
            console.log('error from undefined err.response ', err);
        }
        if (err.response.status === 429) {
            // if(DEBUGLOG) //console.log('Waiting for tokens to renew...');
            await sleep(60000);
              console.log("CALL AFTER SLEEP")
            //call the function again
            response = await callOpenAIWithCompletePromptAndModel(systemPrompt, content, model);
            console.log('response in catch block', response);
        }
        // console.log('err from the api, err');
        // console.log('webiste content length', content?.length);

        // console.log('webiste content length', content);
        // console.log('systemPrompt length ', systemPrompt?.length);
    
    }
    return response;
}

module.exports = { callOpenAIWithCompletePromptAndModel };

