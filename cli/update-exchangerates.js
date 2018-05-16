var Promise = require('bluebird');
global.fetch = require('node-fetch');
var fs = require('fs');
var ExchangeRatesTool = require('../lib/exchange-rates-tool.js');

var exchangeRatesToolArray = [];
exchangeRatesToolArray["STEEM-BTC"] = new ExchangeRatesTool("STEEM-BTC", "STEEM", "BTC");
exchangeRatesToolArray["SBD-BTC"] = new ExchangeRatesTool("SBD-BTC", "SBD*", "BTC");
exchangeRatesToolArray["BTC-EUR"] = new ExchangeRatesTool("BTC-EUR", "BTC", "EUR");

function doUpdateExchangerates(pExchangeRateKey) {
	const exchangeRatesTool = exchangeRatesToolArray[pExchangeRateKey];
	exchangeRatesTool.updateExchangeRatesAsync()
	.then((exchangeRateData) => {
		var filepath = process.cwd() + '/ui/' + pExchangeRateKey + '.js';
		console.log("Writing file '"+filepath+"'");
		var dataJsonString = 'exchangeRateData["' + pExchangeRateKey + '"] = ' + JSON.stringify(exchangeRateData) + ';';
		try {
			fs.writeFileSync(filepath, dataJsonString);
		} catch (ex) {
			console.error("Error occured on saving 'exchangeRateData': " + ex);
			throw ex;
		}
	})
	.catch(err => { console.error(err); });			
	
}

function main() {
	// update data from
	doUpdateExchangerates("STEEM-BTC");
	doUpdateExchangerates("SBD-BTC");
	doUpdateExchangerates("BTC-EUR");
}

// MAIN
main();
