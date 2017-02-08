'use strict';

function flatten(array) {
    return [].concat.apply([], array);
}

function getDomain(url) {
    var matcher = url.match(/^https?\:\/\/([^\/:?#]+)(?:[\/:?#]|$)/i);
    return matcher && matcher[1];
}

/**
 * Randomize array element order in-place.
 * O(num)
 * Using Durstenfeld shuffle algorithm, stopping after we have enough.
 */
function pickRandom(num, array) {
    for (var i = array.length - 1; i > 0 && i >= array.length - num; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    // Return last num elements
    return array.slice(Math.max(array.length - num, 1));
}


// Flow:
// Starting with list of categories, flatmap it to a list of sources
// Map this list, doing a query for each source and build list of {title, abstract, url}
// Display them.

// Note: Don't support filtering based on news sources because of limitations in newsapi.org

// Local storage: Options
var CYCLE_INTERVAL = 5; // in seconds
var BASE_API_URL_SOURCES = "https://newsapi.org/v1/sources?category=";
var BASE_API_URL_ARTICLES = "https://newsapi.org/v1/articles?source=";
var CYCLE = false;
var CATEGORIES = "";
// Local storage: Cache
var CACHED_RESULTS = {};
var LANGUAGE = "en"
var CACHED_TIMESTAMP = null;
var CACHE_EXPIRY = 60;
var MAX_STORIES = 20; // Too many stories leads to Chrome Storage error
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
        language: LANGUAGE,
        timestamp: CACHED_TIMESTAMP,
        cache_expiry: CACHE_EXPIRY
    }, function(items) {
        CATEGORIES = items.categories;
        CYCLE_INTERVAL = items.interval;
        CYCLE = items.cycle;
        LANGUAGE = items.language;
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
    var source = stories[randomNum].source;
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
        source: source,
        url: url
    };
}

function fetch(queryURL, callback) {
    return new Promise(
        function(resolve, reject) {
            $.ajax({
                url: queryURL,
                dataType: "json",
                timeout: AJAX_TIMEOUT * 1000,
                statusCode: {
                    502: function() {
                        reject("Error 502 thrown while fetching from newsapi.org");
                    }
                },
                success: function(queryResult) {
                    resolve(callback(queryResult));
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    var cacheAvailableText = ". No cached stories available.";
                    if (!$.isEmptyObject(CACHED_RESULTS)) {
                        cacheAvailableText = ". Trying to display cached results.";
                        display(CACHED_RESULTS, false);
                    }
                    reject("[ERROR][TheNews]: AJAX call to fetch errored/timed out, with error thrown: " + JSON.stringify(jqXHR) + cacheAvailableText);
                }
            });
        }
    );
}

var fetchSources = function() {
    var categories = CATEGORIES.split(";");
    return Promise.all(
        categories.map(function(category) {
            var queryURL = BASE_API_URL_SOURCES + category + "&language=" + LANGUAGE + "&apiKey=" + secretKeys.API_KEY;
            return fetch(queryURL, function(queryResult) {
                return queryResult.sources.map(function(source) {
                    return source.id;
                });
            });
        })
    );
};

var fetchStories = function(sources) {
    return Promise.all(
        flatten(sources)
        .map(function(source) {
            var queryURL = BASE_API_URL_ARTICLES + source + "&apiKey=" + secretKeys.API_KEY;
            return fetch(queryURL, function(queryResult) {
                return queryResult.articles;
            });
        })
    );
}

var decode = function(results) {
    // Decompose into title, abstract, url
    return new Promise(
        function(resolve, reject) {
            resolve({
                stories: pickRandom(MAX_STORIES, flatten(results)).map(function(result) {
                    return {
                        title: result.title,
                        source: getDomain(result.url),
                        abstract: result.description,
                        url: result.url
                    };
                })
            });
        }
    );
};

var display = function(results, updateCache) {
    function display(results, updateCache) {
        var result = getRandomStory(results.stories.length, results.stories);
        var title = result.source ? result.title + " (" + result.source + ")" : result.title;
        var link = result.url;
        // Add quotes
        var abstract = "&ldquo;" + result.abstract + "&rdquo;";
        // Display
        document.getElementById("insert").setAttribute('href', link);
        document.getElementById("insert").setAttribute('title', "Link to article");
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
    fetchSources()
        .then((results) => fetchStories(results))
        .then((results) => decode(results))
        .then((results) => display(results, true))
        .catch(function(error) {
            console.log(error);
        });
}

// We start with restoring local storage
restoreLocalStorage();