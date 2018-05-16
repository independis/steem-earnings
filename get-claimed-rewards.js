var fs = require('fs');
var Promise = require('bluebird');
global.fetch = require('node-fetch');
var SteemAccountHistory = require('./lib/steem-account-history.js');
var ExchangeRatesTool = require('./lib/exchange-rates-tool.js');
var steemPerMVestsTool = require ('./lib/steem-per-mvests-tool.js');
var shared = require('./lib/shared.js');

var exchangeRatesToolArray = [];
exchangeRatesToolArray["STEEM-BTC"] = new ExchangeRatesTool("STEEM-BTC", "STEEM", "BTC");
exchangeRatesToolArray["SBD-BTC"] = new ExchangeRatesTool("SBD-BTC", "SBD*", "BTC");
exchangeRatesToolArray["BTC-EUR"] = new ExchangeRatesTool("BTC-EUR", "BTC", "EUR");

function writeFile(pFilename, pContent) {
	try {
		if (fs.existsSync(pFilename)) fs.unlinkSync(pFilename);
		fs.writeFileSync(pFilename, pContent);
		console.log(pFilename+' created successfully');
	} catch (ex) {
		console.error('> Error occured: ' + ex);
		throw ex;
	}
}

function createHtmlDocumentOutputHeader() {
	var htmlFragement = '<!doctype html>\n';
	htmlFragement += '<html lang="en">\n';
	htmlFragement += '<head>\n';
	htmlFragement += '<meta charset="utf-8">\n';
	htmlFragement += '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">\n';
	htmlFragement += '<title>steemit earnings</title>\n';
	htmlFragement += '<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">\n';
	htmlFragement += '<style type="text/css">\n';
	htmlFragement += '.table { font-size:0.75rem; padding:0.1rem; }\n';
	htmlFragement += '.td { line-height: 1; padding: .3rem; }\n';
	htmlFragement += '.textcontainer { display: table; table-layout: fixed; word-wrap: break-word; width: 100%; }\n';
	htmlFragement += '.textwrapper { display: table-cell; }\n';
	htmlFragement += '</style>\n';
	htmlFragement += ' <script src="https://code.jquery.com/jquery-3.1.1.slim.min.js" integrity="sha384-A7FZj7v+d/sdmMqp/nOQwliLvUsJfDHW+k9Omg/a/EheAdgtzNs3hpfag6Ed950n" crossorigin="anonymous"></script>\n';
	htmlFragement += '<script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.12.9/umd/popper.min.js" integrity="sha384-ApNbgh9B+Y1QKtv3Rn7W3mgPxhU9K/ScQsAP7hUibX39j7fakFPskvXusvfa0b4Q" crossorigin="anonymous"></script>\n';
	htmlFragement += '<script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js" integrity="sha384-JZR6Spejh4U02d8jOt6vLEHfe/JQGiRRSQQxSfFWpi1MquVdAyjUar5+76PVCmYl" crossorigin="anonymous"></script>\n';
	htmlFragement += '</head>\n';
	htmlFragement += '<body class="bg-light">\n';
	return htmlFragement;
}

function createHtmlDocumentOutputFooter() {
	var htmlFragement = '</body>\n';
	htmlFragement += '</html>\n';
	return htmlFragement;
}

function getExchangeRate(pExchangeRateKey, pDateKey) {
	if (exchangeRatesToolArray[pExchangeRateKey] === undefined) return null;
	return exchangeRatesToolArray[pExchangeRateKey].getExchangeRate(pDateKey);
}

function main(pAccount) {
	var steemAccountHistory = new SteemAccountHistory(pAccount);

	steemPerMVestsTool.loadAsync(
	).then( 
		exchangeRatesToolArray["STEEM-BTC"].updateExchangeRatesAsync()
	).then( 
		exchangeRatesToolArray["SBD-BTC"].updateExchangeRatesAsync()
	).then( 
		exchangeRatesToolArray["BTC-EUR"].updateExchangeRatesAsync()
	).then(() => 
		steemAccountHistory.updateAccountHistoryAsync(pAccount)
	).then(() => {
		var accountValues = shared.getAccountValue(steemAccountHistory.account, steemAccountHistory.getClaims(), steemPerMVestsTool.getSteemPerMVestForDate, getExchangeRate);

		// write output for each year
		var outputFolder = process.cwd() + '/@output';
		if (!fs.existsSync(outputFolder)){
			fs.mkdirSync(outputFolder);
		}
		var outputPathPrefix = outputFolder + '/steemit-earnings-';
		var currentYear = new Date().getUTCFullYear();
		for (var year=2016; year <= currentYear; year++) {
			var html = createHtmlDocumentOutputHeader() + shared.createHtmlOutput(accountValues, year) + createHtmlDocumentOutputFooter();
			writeFile(outputPathPrefix + pAccount + '-' + year + '.html', html);
			var csv = shared.createCsvOutputHeader() + shared.createCsvOutput(accountValues, year);
			writeFile(outputPathPrefix + pAccount + '-' + year + '.csv', csv);	
		}

		// write output complete
		var html = createHtmlDocumentOutputHeader() + shared.createHtmlOutput(accountValues) + createHtmlDocumentOutputFooter();
		writeFile(outputPathPrefix + pAccount + '.html', html);
		var csv = shared.createCsvOutputHeader() + shared.createCsvOutput(accountValues);
		writeFile(outputPathPrefix + pAccount + '.csv', csv);	
	}).catch(console.error);
}

function checkArguments() {
	// check if program was called with command line arguments
	if (process.argv.length === 3) {
		return arguments = {
			account: process.argv[2].trim()
		};
	} else {
		console.log('usage: ' + process.argv[1] + ' account');
		return null;
	}
}

// MAIN
var arguments = checkArguments();
if (arguments != null) {
	main(arguments.account);
}
