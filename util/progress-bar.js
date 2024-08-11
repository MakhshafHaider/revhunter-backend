const ProgressBar = require('progress');
const progressEmitter = require('../events/progress-events');

let bar = null;
let remainingTokens = 0;
let rowsToProcess = 0;
let errorCount = 0;
let firstTotal = 0;

async function initProgressBar(total){
    // Check if bar already exists
    if (!bar) {
        // Create a progress bar instance
        bar = new ProgressBar('Processing [:bar] :percent :etas | :progress/:total | Remaining tokens/min: :tokens', {
            complete: '=',
            incomplete: ' ',
            width: 20,
            total: total,  // Total number of things to process
            renderThrottle: 100,
            tokens: { tokens: "Calculating...", progress: 0}  // Initialize custom tokens
        });
    }

}

function updateBar(){
    // Check if bar already exists
    if (!bar) {
        //console.log('Bar not initialized, ignoring');
        return;
    }
    // Update the progress bar
    bar.tick({
        'total': rowsToProcess,
        'tokens': remainingTokens,  // This should be fetched from the OpenAI API response
        'errorCount': errorCount,
        'progress': firstTotal - rowsToProcess
    });
}

// Listen to the event and update remainingTokens
progressEmitter.on('on-remaining-tokens', (newRemainingTokens) => {
    remainingTokens = newRemainingTokens;
    updateBar();
});

// Listen to the event and update processing left
progressEmitter.on('on-update-progress', (progress) => {
    rowsToProcess = firstTotal - progress;
    ////console.log(`Remaining to process: ${rowsToProcess}`);
    ////console.log(`Processed items: ${progress}`);
    updateBar();
});

// Listen to the event and update processing left
progressEmitter.on('on-init-progress', (total) => {
    ////console.log(`Total items to process: ${total}`);
    initProgressBar(total);
});

// Listen to the event and update total items to process
progressEmitter.on('set-total', (total) => {
    ////console.log(`Total items to process: ${total}`);
    rowsToProcess = total;
    firstTotal = total;
    //updateBar();
});



module.exports = { initProgressBar, updateBar };