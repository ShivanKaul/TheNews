'use strict';

/*
    Get current options as marked by user, and save to l.s.
*/
function saveOptions() {

    var formElements = document.getElementById('settings').elements;
    var interval = formElements['interval'].value;
    var cycle = formElements['cycle'].checked;
    var cache_expiry = formElements['cache_expiry'].value;
    // var language = formElements['lang'].value;

    var categories = Array.prototype.slice.call(formElements['categories']).filter(function(x) {
            return x.checked;
        })
        .map(function(x) {
            return x.value;
        })
        .join(";");

    chrome.storage.sync.set({
        interval: interval,
        cycle: cycle,
        // language: language,
        categories: categories,
        cache_expiry: cache_expiry
    }, function() {
        // Update status to let user know options were saved.
        var status = document.getElementById('status');
        status.textContent = 'Settings saved!';
        setTimeout(function() {
            status.textContent = '';
        }, 1250);
    });
}

// Update view with options in l.s.
function getOptions() {
    // Modify view
    chrome.storage.sync.get({
        interval: 10,
        // language: "en",
        cycle: true,
        categories: "",
        cache_expiry: 60
    }, function(items) {
        if (items.cycle) {
            document.getElementById('interval').style.display = "block";
            document.getElementById(items.interval).checked = true;
            document.getElementById('cycle').checked = true;
        }
        // Categories
        if (items.categories) {
            var categoriesArray = items.categories.split(";");
            for (var i = 0; i < categoriesArray.length; i++) {
                document.getElementById(categoriesArray[i]).checked = true;
            }
        }
        // Cache expiry
        document.getElementById('cache_expiry_' + items.cache_expiry.toString()).checked = true;
        // Language
        // document.getElementById(items.language.toString()).checked = true;
    });
}

// Add event listeners
document.addEventListener('DOMContentLoaded', getOptions);
document.getElementById("cycle").addEventListener("change", function(e) {
    if (e.target.checked) {
        // show the div:
        document.getElementById('interval').style.display = "block";
    } else {
        // hide the div:
        document.getElementById('interval').style.display = "none";
    }
});
document.getElementById('save').addEventListener('click',
    saveOptions);
