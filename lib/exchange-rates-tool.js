var Promise = require('bluebird');
global.fetch = require('node-fetch');
var fs = require('fs');
var cryptocompareApi = require('cryptocompare-api');

function ExchangeRatesTool(pExchangeRateKey, pSymFrom, pSymTo) {
	var self = this;

	self.exchangeRateKey = pExchangeRateKey;
	self.symFrom = pSymFrom;
	self.symTo = pSymTo;
	self.exchangeRateData = {};

	function getExchangeRateDataFilePath() {
		return process.cwd() + '/data/' + self.exchangeRateKey + '.json';
	}

	function loadExchangeRateDataFromFile() {
		try {
			var filePath = getExchangeRateDataFilePath(self.exchangeRateKey);
			if (fs.existsSync(filePath)) {
				var data = fs.readFileSync( filePath, 'utf8');
				return JSON.parse(data);
			} else {
				return {};
			}
		} catch (ex) {
			console.error("Error occured on 'loadExchangeRateDataFromFile': " + ex);
			throw ex;
		}
	};

	function saveExchangeRateDataToFile() {
		try {
			fs.writeFileSync(getExchangeRateDataFilePath(self.exchangeRateKey), JSON.stringify(self.exchangeRateData));
		} catch (ex) {
			console.error("Error occured on 'saveExchangeRateDataToFile': " + ex);
			throw ex;
		}
	};

	self.getExchangeRate = function(pDateKey) {
		if (self.exchangeRateData[pDateKey] === undefined) return null;
		return self.exchangeRateData[pDateKey];
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

    self.loadExchangeRatesAsync = function() {
		// first load data from json file
		self.exchangeRateData = loadExchangeRateDataFromFile();

		return new Promise((resolve, reject) => {
			try {
				console.log('loading ' + self.symFrom + '-' + self.symTo + '...');
				cryptocompareApi.getHistoricalDays({
					limit: 1000,
					aggregate: 1,
					fsym: self.symFrom,
					tsym: self.symTo
				}).then(data => {
					if (data === null && data.Data === null) resolve(self.exchangeRateData);
					for (let index = 0; index < data.Data.length; index++) {
						const element = data.Data[index];
						// get date
						var date = new Date(element.time*1000);
						var dateKey = self.convertDateUtcToInt(date);
						// check if exchange source-target already exists
						if (element.close === 0) continue; 
						if (self.exchangeRateData[dateKey] === undefined) {
							self.exchangeRateData[dateKey] = {
								"open": element.open,
								"close": element.close,
								"low": element.low,
								"high": element.high,
								"volumefrom": element.volumefrom,
								"volumeto": element.volumeto,
								"volume": element.volumeto,
								"source": "cryptocompare"
							};
						} else {
							// check for update
							if (self.exchangeRateData[dateKey].close !== element.close) {
								self.exchangeRateData[dateKey] = {
									"open": element.open,
									"close": element.close,
									"low": element.low,
									"high": element.high,
									"volumefrom": element.volumefrom,
									"volumeto": element.volumeto,
									"volume": element.volumeto,
									"source": "cryptocompare"
								};
							}
						}
					}
					resolve(self.exchangeRateData);
				}).catch((error) => {
					reject(error); 
				});
			} catch (error) {
				reject(error);
			}
		});
	}
	
	self.updateExchangeRatesAsync = function() {
		return self.loadExchangeRatesAsync(
		).then(data => { 
			saveExchangeRateDataToFile();
			return self.exchangeRateData;
		});
	}

}

module.exports = ExchangeRatesTool;
