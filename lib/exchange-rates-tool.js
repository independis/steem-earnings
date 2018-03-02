var cryptocompareApi = require('cryptocompare-api');

function ExchangeRatesTool() {
	var self = this;

	var exchangeRatesResult = {};

	self.getExchangeRate = function(pExchangeRateKey, pDateKey) {
		if (exchangeRatesResult[pExchangeRateKey] === undefined) return null;
		if (exchangeRatesResult[pExchangeRateKey][pDateKey] === undefined) return null;
		return exchangeRatesResult[pExchangeRateKey][pDateKey];
	}

	function convertToUtcDetailedDate(pDate) {
		if (pDate === undefined || pDate === null) pDate = new Date();
		if (typeof pDate === 'string') pDate = new Date(pDate);
		return detailedDate = {
			year: pDate.getUTCFullYear(),
			month: pDate.getUTCMonth() + 1, /* getMonth() is zero-based */
			day: pDate.getUTCDate(),
			hours: pDate.getUTCHours(),
			minutes: pDate.getUTCMinutes(),
			seconds: pDate.getUTCSeconds()
		}
	}

	self.convertDateUtcToInt = function(pDate) {
		var detailedDate = convertToUtcDetailedDate(pDate);
		return detailedDate.year * 10000 + detailedDate.month * 100 + detailedDate.day;
	}

    self.loadExchangeRatesAsync = function(pSymFrom, pSymTo, pLimit) {
		return new Promise((resolve, reject) => {
			try {
				console.log('loading ' + pSymFrom + '-' + pSymTo + '...');
				cryptocompareApi.getHistoricalDays({
					limit: pLimit,
					aggregate: 1,
					fsym: pSymFrom,
					tsym: pSymTo
				}).then(data => {
					if (data === null && data.Data === null) resolve(exchangeRatesResult);
					var exchangeRateKey = pSymFrom + '-' + pSymTo;
					for (let index = 0; index < data.Data.length; index++) {
						const element = data.Data[index];
						// get date
						var date = new Date(element.time*1000);
						var dateKey = self.convertDateUtcToInt(date);
						// check if date already exists
						if (exchangeRatesResult[exchangeRateKey] === undefined) {
							exchangeRatesResult[exchangeRateKey] = {};
						}
						// check if exchange source-target already exists
						if (exchangeRatesResult[exchangeRateKey][dateKey] === undefined) {
							exchangeRatesResult[exchangeRateKey][dateKey] = {
								"open": element.open,
								"close": element.close,
								"low": element.low,
								"high": element.high,
								"volumefrom": element.volumefrom,
								"volumeto": element.volumeto,
								"source": "cryptocompare"
							};
						}
					}
					resolve(exchangeRatesResult);
				}).catch((error) => {
					reject(error); 
				});
			} catch (error) {
				reject(error);
			}
		});
    }
}

module.exports = new ExchangeRatesTool();
