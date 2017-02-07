// Citation: https://developer.chrome.com/extensions/optionsV2
// Saves options to chrome.storage.sync.

function saveOptions() {

    var formElements = document.getElementById('settings').elements;
    var interval = formElements['interval'].value;
    var cycle = formElements['cycle'].checked;
    var cache_expiry = formElements['cache_expiry'].value;

    var categories = Array.prototype.slice.call(formElements['categories']).filter(function(x) {
            return x.checked;
        })
        .map(function(x) {
            return x.value;
        })
        .join(";");

    if (!categories) {
        categories = "all";
    }

    chrome.storage.sync.set({
        interval: interval,
        cycle: cycle,
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

document.getElementById('save').addEventListener('click',
    saveOptions);

function getOptions() {
    // Modify view
    chrome.storage.sync.get({
        interval: 5,
        cycle: false,
        categories: "all",
        cache_expiry: 60
    }, function(items) {
        if (items.cycle) {
            document.getElementById('interval').style.display = "block";
            document.getElementById(items.interval).checked = true;
            document.getElementById('cycle').checked = true;
        }
        // Categories
        var categoriesArray = items.categories.split(";");
        for (var i = 0; i < categoriesArray.length; i++) {
            document.getElementById(categoriesArray[i]).checked = true;
        }
        // Cache expiry
        document.getElementById('cache_expiry_' + items.cache_expiry.toString()).checked = true;
    });
}
document.addEventListener('DOMContentLoaded', getOptions);

var cycle = document.getElementById("cycle");
cycle.addEventListener("change", function(e) {
    if (e.target.checked) {
        //show the div:
        document.getElementById('interval').style.display = "block";
    } else {
        //hide the div:
        document.getElementById('interval').style.display = "none";
    }
});
