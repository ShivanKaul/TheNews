'use strict';

// Don't support filtering based on news sources because of limitations in newapi.org
// Process:
// Starting with list of categories, flatmap it to a list of sources
// Reduce this list, doing a query for each source and build list of {title, abstract, url}
// Display them

// Local storage: Options
var CYCLE_INTERVAL = 5; // in seconds
var BASE_API_URL_SOURCES = "https://newsapi.org/v1/sources";
var BASE_API_URL_ARTICLES = "https://newsapi.org/v1/articles";
var CYCLE = false;
var CATEGORIES = "all";
// Local storage: Cache
var CACHED_RESULTS = {};
var CACHED_TIMESTAMP = null;
var CACHE_EXPIRY = 60;
// Depends on NYT API
var MAX_STORIES = 20;
var AJAX_TIMEOUT = 10; // in seconds

// Restores options and result cache
// stored in chrome.storage asynchronously
function restoreLocalStorage() {
    // Default
    chrome.storage.sync.get({
        interval: CYCLE_INTERVAL,
        categories: CATEGORIES,
        cycle: CYCLE,
        results: CACHED_RESULTS,
        timestamp: CACHED_TIMESTAMP,
        cache_expiry: CACHE_EXPIRY
    }, function(items) {
        CATEGORIES = items.categories;
        CYCLE_INTERVAL = items.interval;
        CYCLE = items.cycle;
        CACHED_RESULTS = items.results;
        CACHED_TIMESTAMP = items.timestamp;
        CACHE_EXPIRY = items.cache_expiry;

        var currentTime = Math.floor(Date.now() / 1000); // UNIX in seconds
        // Cache expiry : 1 minute
        if (CACHED_TIMESTAMP && currentTime - CACHED_TIMESTAMP < CACHE_EXPIRY) {
            console.log("[DEBUG][TheNews]: Using cached stories, current cache expiry is " + CACHE_EXPIRY + " seconds");
            console.log("[DEBUG][TheNews]: Current time: " + currentTime + ", cache time: " + CACHED_TIMESTAMP);
            display(CACHED_RESULTS, false);
        } else {
            fetchDecodeDisplay();
        }
    });
}

// Save results in local cache
function saveResults(results) {
    chrome.storage.sync.set({
        results: results,
        timestamp: Math.floor(Date.now() / 1000)
    });
}


// Get a particular story by choosing randomly from fetched stories
function getRandomStory(numResults, stories) {
    var bound = Math.min(MAX_STORIES - 1, numResults);
    var randomNum = Math.floor((Math.random() * bound));
    var title = stories[randomNum].title;
    var abstract = stories[randomNum].abstract;
    var url = stories[randomNum].url;
    var uninteresting = (title == "Letters to the Editor" || title.indexOf("Evening Briefing") > -1 || title == "Reactions" || title.indexOf("Review: ") > -1);
    // Basic uninteresting article filtering
    if (uninteresting) {
        // Remove uninteresting story: citation: http://stackoverflow.com/a/5767357/2989693
        stories.splice(randomNum, 1);
        return getRandomStory(numResults - 1, stories);
    }
    return {
        title: title,
        abstract: abstract,
        url: url
    };
}

var fetch = function() {
    return new Promise(
        function(resolve, reject) {
            var queryURL = BASE_API_URL + CATEGORIES + "/.json?api-key=" + secretKeys.API_KEY;
            $(document).ready(function() {
                $.ajax({
                    url: queryURL,
                    dataType: "json",
                    timeout: AJAX_TIMEOUT * 1000,
                    statusCode: {
                        502: function() {
                            reject("Error 502 thrown while fetching from NYT API.");
                        }
                    },
                    success: function(queryResult) {
                        // get array of all headlines
                        var stories = queryResult.results;
                        var numResults = queryResult.num_results;
                        resolve({
                            stories: stories,
                            numResults: numResults
                        });
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        var cacheAvailableText = ". No cached stories available.";
                        if (!$.isEmptyObject(CACHED_RESULTS)) {
                            cacheAvailableText = ". Trying to display cached results.";
                            display(CACHED_RESULTS, false);
                        }
                        reject("AJAX call errored/timed out, with error thrown: " + JSON.stringify(jqXHR) + cacheAvailableText);
                    }
                });
            });
        }
    );
}

var decode = function(results) {
    // Decompose into title, abstract, url
    return new Promise(
        function(resolve, reject) {
            resolve({
                stories: results.stories.map(function(result) {
                    return {
                        title: result.title,
                        abstract: result.abstract,
                        url: result.url
                    };
                }),
                numResults: results.numResults
            });
        }
    );
};

var display = function(results, updateCache) {
    function display(results, updateCache) {
        var result = getRandomStory(results.numResults, results.stories);
        var title = result.title;
        var link = result.url;
        // Add quotes
        var abstract = "&ldquo;" + result.abstract + "&rdquo;";
        // Display
        document.getElementById("insert").setAttribute('href', link);
        document.getElementById("insert").setAttribute('title', "Link to NYT article");
        document.getElementById("insert").innerHTML = title;
        document.getElementById("abstract").innerHTML = abstract;
        // Fade in text
        $("#insert").hide().fadeIn();
        $("#abstract").hide().fadeIn();
        // Store results in local storage
        if (updateCache) saveResults(results);
    }
    display(results, updateCache);
    if (CYCLE) {
        window.setInterval(function() {
                display(results, false);
            },
            CYCLE_INTERVAL * 1000);
    }
}

function fetchDecodeDisplay() {
    // Fetch -> Decode -> Display
    fetch()
        .then((results) => decode(results))
        .then((results) => display(results, true))
        .catch(function(error) {
            console.log(error);
        });
}

// We start with restoring local storage
restoreLocalStorage();