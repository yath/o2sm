var page = require('webpage').create();
page.onConsoleMessage = function(m) { console.log('Message from page: '+m); }
page.onAlert          = function(m) { console.log('Alert from page: '+m); }

var ID_PACKINFO     = 'packInfoLink';
var TEXT_EVN        = 'Einzelverbindungen';
var TEXT_EVN_DETAIL = 'Details zu Ihren Verbindungen';

var records = [];

var upToDate = 0;

// from https://github.com/ariya/phantomjs/blob/master/examples/waitfor.js
function waitFor(testFx, onReady, timeOutMillis) {
    var maxtimeOutMillis = timeOutMillis ? timeOutMillis : 3000, //< Default Max Timout is 3s
        start = new Date().getTime(),
        condition = false,
        interval = setInterval(function() {
            if ( (new Date().getTime() - start < maxtimeOutMillis) && !condition ) {
                // If not time-out yet and condition not yet fulfilled
                condition = (typeof(testFx) === "string" ? eval(testFx) : testFx()); //< defensive code
            } else {
                clearInterval(interval);
                if(!condition) {
                    // If condition still not fulfilled (timeout but condition is 'false')
                    error("'waitFor()' timeout");
                } else {
                    // Condition fulfilled (timeout and/or condition is 'true')
                    typeof(onReady) === "string" ? eval(onReady) : onReady(); //< Do what it's supposed to do once the condition is fulfilled
                }
            }
        }, 250); //< repeat check every 250ms
};

function error(msg, trace) {
    var msgStack = ['ERROR: ' + msg];
    if (trace && trace.length) {
        msgStack.push('TRACE:');
        trace.forEach(function(t) {
            msgStack.push(' -> ' + (t.file || t.sourceURL) + ': ' + t.line + (t.function ? ' (in function ' + t.function + ')' : ''));
        });
    }
    console.error(msgStack.join('\n'));
    phantom.exit(1);
}
phantom.onError = error;

function waitForContent(text, onReady) {
    waitFor(function() {
        return page.content.indexOf(text) != -1;
    }, onReady, 5000);
}

function dateToInt(date) {
    if (x = date.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)) {
        return x[3] * 10000 +
               x[2] * 100 +
               x[1] * 1;
    } else if (x = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)) {
        return x[1] * 10000 +
               x[2] * 100 +
               x[3] * 1;
    } else {
        error("Unable to parse date '"+date+"'");
    }
}

function getPages() {
    return page.evaluate(function() {
        pages = {};
        $("div.lightbox ul.paginator li").each(function() {
            if (x = $(this).text().match(/[0-9]+/))
                pages[x] = {
                    id: $(this).find("a").attr('id'),
                    active: $(this).hasClass('active')
                };
        });
        
        return pages;
    });
}

function evnPageLoaded(pageno) {
    thisPageRecords = page.evaluate(function() {
        var end = false;
        var headers = $.map($("div.lightbox thead td"), function(x) {
            return $(x).text().trim();
        });
        var dateCol = headers.indexOf("Datum");

        var records = $.map($("div.lightbox tbody tr"), function(row) {
            obj = {};
            $(row).find("td").each(function(index) {
                obj[headers[index]] = $(this).text().replace(/\s+/g, " ").trim();
            });

            return obj;
        });
        return records;
    });

    var end = false;

    for (var i = 0; i < thisPageRecords.length; i++) {
        if (end || dateToInt(thisPageRecords[i]["Datum"]) < upToDate) {
            end = true;
        } else {
            records.push(thisPageRecords[i]);
        }
    }

    var pages = getPages();
    var nextPage = pageno+1;
    if (!end && pages && pages[nextPage]) {
        page.evaluate(function(id) {
            $('#'+id).click();
        }, pages[nextPage].id);
        waitForEvnPage(nextPage);
    } else {
        console.log(JSON.stringify(records));
        phantom.exit();
    }
}

function waitForEvnPage(pageno) {
    console.log("Loading EVN page "+pageno);
    waitFor(function() {
        pages = getPages();
        if (pages && pages[pageno] && pages[pageno].active)
            return true;
        return false;
    }, function() {
        evnPageLoaded(pageno);
    }, 5000);
}

function evnLoaded() {
    console.log('Loading EVN detail...');
    page.evaluate(function(text) {
        $('a:contains("'+text+'")').click();
    }, TEXT_EVN_DETAIL);
    waitForEvnPage(1);
}


function packInfoLoaded() {
    console.log('Loading EVN...');
    page.evaluate(function(text) {
        $('a:contains("'+text+'")').click();
    }, TEXT_EVN);
    waitForContent(TEXT_EVN_DETAIL, evnLoaded);
}

function mainPageLoaded() {
    console.log('Loading Account Balance...');
    page.evaluate(function(id) {
        $('#'+id).click();
    }, ID_PACKINFO);
    waitForContent(TEXT_EVN, packInfoLoaded);
}

system = require('system')
if (system.args.length > 1)
    upToDate = dateToInt(system.args[1]);

console.log('Loading main page...');
page.open('https://zero.o2online.de/surfmanager/', function(status) {
    if (status !== 'success') {
        error('Loading '+url+' failed ('+s+')');
    }
    waitForContent(ID_PACKINFO, mainPageLoaded);
});
