var fs = require('fs');
var Promise = require('bluebird');
global.fetch = require('node-fetch');
var steem = require('steem');
steem.api.setOptions({ url: 'https://api.steemit.com' });
var cryptocompareApi = require('cryptocompare-api');


function BlobStorage() {
	var self = this;

	self.storageData = {};

	self.setItem = function(pKey, pData) {
		self.storageData[pKey] = pData;
	}

	self.getItem = function(pKey) {
		return self.storageData[pKey];
	}

	self.removeItem = function(pKey) {
		delete self.storageData[pKey];
	}
}

function SteemdApiPropsHelper() {
	var self = this;

	self.steemdApiPropsData = {};

	self.getSteemPerVestForDate = function(pDate) {
		// todo
		for (let index = 0; index < self.steemdApiPropsData.length; index++) {
			const steemdApiPropsData = self.steemdApiPropsData[index];
			var date = new Date(parseInt(steemdApiPropsData.time.$date.$numberLong))
			if (date.year === pDate.year && date.month === pDate.month && date.day === pDate.day) {
				return steemdApiPropsData.steem_per_mvests;
			}
		}
		return null;
	}

	self.loadAsync = function() {
		var url='https://steemdb.com/api/props';
		return fetch(url
			).then((response) => response.json()
			).then((data) => self.steemdApiPropsData = data);
	}
}

function CryptoCompareHelper() {
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

	self.dailyPriceHistoricalAsync = function(pSymFrom, pSymTo) {
		return cryptocompareApi.getHistoricalDays({
			limit: 2000,
			aggregate: 1,
			fsym: pSymFrom,
			tsym: pSymTo
		}).then((data) => {
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
		});
	}
}

function SteemAccountHistoryHelper(pAccount, pStorage) {
	var self = this;

	self.account = pAccount;

	var storage = pStorage;
	var storageKey = 'steemit-accountHistory-' + pAccount;
	var maxItemCount = 0;

	function getFromStorage() {
		var storageData = storage.getItem(storageKey);
		if (storageData === undefined || storageData === null) {
			storageData = { account: pAccount, account_history: [] };
		} else {
			storageData = JSON.parse(storageData);
		}
		return storageData;
	}

	function writeToStorage(pStorageData) {
		storage.setItem(storageKey, JSON.stringify(pStorageData));
	}

	self.clearCache = function() {
		storage.removeItem(storageKey);
	}

	self.updateAccountHistoryAsync = function() {
			return new Promise((resolve, reject) => {
				try {
					var from = -1;
					var limit = 1000;
					var storageData = getFromStorage();
					doGetAccountHistoryRecursive(self.account, from, limit, storageData.account_history.length-1, storageData.account_history, (err,result) => {
						if (result) {
							writeToStorage(storageData);
						}
						resolve(result);
					});
				} catch (error) {
					reject(error);
				}
		
			})
	}

	self.updateAccountHistory = function(pFnCallback) {
		try {
			var from = -1;
			var limit = 1000;

			var storageData = getFromStorage();

			doGetAccountHistoryRecursive(self.account, from, limit, storageData.account_history.length-1, storageData.account_history, (err,result) => {
				if (result) {
					writeToStorage(storageData);
				}
				pFnCallback(err, result);
			});
		} catch (error) {
			alert(error);
			console.log(error);
		}
	}

	function doGetAccountHistoryRecursive(pAccount, pFrom, pLimit, pUpdateToIndex, pDataArray, pFnCallback) {
		var progressValue = 0;
		console.log( 'requesting data for @' + pAccount + ' (' + pFrom + '/' + pLimit + ')');
		if (pFrom == -1) {
			progressValue = 0; 
		} else if (pFrom <= pLimit) {
			progressValue = 100;
		} else {
			progressValue = parseInt(((maxItemCount-pFrom)*100)/maxItemCount);
		}
		steem.api.getAccountHistory(pAccount, pFrom, pLimit, function(err,result){
			if (err){
				console.error( JSON.stringify(err));
				pFnCallback(err, null);
				return;
			}
			if (result) {
				var lastIndex = -1;
				for (let index = 0; index < result.length; index++) {
					const element = result[index];
					const currentIndex = element[0];
					if (currentIndex > maxItemCount) maxItemCount = currentIndex;
					if (lastIndex === -1 || lastIndex > currentIndex) lastIndex = currentIndex;
					if (pDataArray[currentIndex] === undefined) {
						pDataArray[currentIndex] = element;
					}
				}
				if (lastIndex > 0 && lastIndex > pUpdateToIndex) {
					doGetAccountHistoryRecursive(pAccount, lastIndex, pLimit > lastIndex ? lastIndex : pLimit, pUpdateToIndex, pDataArray, pFnCallback)
				} else {
					// finished
					pFnCallback(null, pDataArray);
				}
			}
		} );   
	}

	self.getClaims = function() {
		var resultData = [];
		var storageData = getFromStorage();
		for (let index = 0; index < storageData.account_history.length; index++) {
			const element = storageData.account_history[index];
			var op = element[1] !== undefined ? element[1].op : null;
			if (op !== null) {
				if (op.length > 0 && 
					// op[0].indexOf('claim') >= 0
					op[0] !== 'account_create' &&
					op[0] !== 'account_create_with_delegation' &&
					op[0] !== 'account_witness_vote' &&
					op[0] !== 'account_witness_proxy' &&
					op[0] !== 'vote' && 
					op[0] !== 'comment' &&
					op[0] !== 'comment_options' &&
					op[0] !== 'delete_comment' &&
					op[0] !== 'delegate_vesting_shares'  && 
					op[0] !== 'account_update' &&
					op[0] !== 'author_reward' &&
					op[0] !== 'curation_reward' &&
					op[0] !== 'custom_json' &&
					op[0] !== 'set_withdraw_vesting_route' &&
					op[0] !== 'limit_order_create' &&
					op[0] !== 'limit_order_cancel' &&
					op[0] !== 'return_vesting_delegation' &&
					op[0] !== 'fill_vesting_withdraw' &&
					op[0] !== 'fill_convert_request' &&
					op[0] !== 'fill_order'
				) { 
					// claim_reward_balance, transfer, transfer_to_vesting, transfer_to_savings
					//	??? , fill_order, withdraw_vesting, , interest, fill_convert_request, limit_order_cancel, return_vesting_delegation
					resultData.push(element);
				}
			} else {
				// unknown op ???
				console.log('==> unknown op: ' + JSON.stringify(element));
			}
		}
		return resultData;
	}
}

function getFloatValue(pValue, pFactor) {
	if (pValue === undefined || pValue === null || pValue === '') return null;
	var separator = pValue.indexOf(' ');
	if (separator > 0) {
		return parseFloat(pValue.substring(0,separator)) * (pFactor !== undefined && pFactor !== null ? pFactor : 1.0);
	}
	return null;
}

function getAccountValue(pSteemAccountHistoryHelper, pCryptoCompareHelper, pSteemdApiPropsHelper) {
	try {
		var test = pSteemdApiPropsHelper.getSteemPerVestForDate(new Date());

		var claims = pSteemAccountHistoryHelper.getClaims();
		var preparedData = {};

		for (let index = 0; index < claims.length; index++) {
			var claim = claims[index];
			var op = claim[1].op;
			var opType = op[0];
			if (preparedData[opType] === undefined) preparedData[opType] = [];
			if (opType === 'claim_reward_balance') {
				preparedDataObject = {
					index: claim[0],
					timestamp: claim[1].timestamp,
					op_type: opType,
					reward_steem: getFloatValue(op[1].reward_steem),
					reward_sbd: getFloatValue(op[1].reward_sbd),
					reward_vests: getFloatValue(op[1].reward_vests),
					object: claim[1]					
				}
				setExchangesForPreparedDataObject(pCryptoCompareHelper, preparedDataObject, pSteemdApiPropsHelper);
				preparedData[opType].push(preparedDataObject);
			} else if (opType === 'transfer') {
				var factor = (op[1].from === pSteemAccountHistoryHelper.account) ? -1.0 : 1.0;
				preparedDataObject = {
					index: claim[0],
					timestamp: claim[1].timestamp,
					op_type: opType,
					reward_steem: getFloatValue(op[1].amount != undefined && op[1].amount.indexOf('STEEM') >= 0 ? op[1].amount : '', factor),
					reward_sbd: getFloatValue(op[1].amount != undefined && op[1].amount.indexOf('SBD') >= 0 ? op[1].amount : '', factor),
					reward_vests: getFloatValue(op[1].amount != undefined && op[1].amount.indexOf('VESTS') >= 0 ? op[1].amount : '', factor),
					object: claim[1]
				}
				setExchangesForPreparedDataObject(pCryptoCompareHelper, preparedDataObject, pSteemdApiPropsHelper);
				preparedData[opType].push(preparedDataObject);
			} else if (opType === 'transfer_to_vesting') {
				var factor = (op[1].from === pSteemAccountHistoryHelper.account) ? -1.0 : 1.0;
				preparedDataObject = {
					index: claim[0],
					timestamp:claim[1].timestamp,
					op_type: opType,
					reward_steem: getFloatValue(op[1].amount != undefined && op[1].amount.indexOf('STEEM') >= 0 ? op[1].amount : '', factor),
					reward_sbd: getFloatValue(op[1].amount != undefined && op[1].amount.indexOf('SBD') >= 0 ? op[1].amount : '', factor),
					reward_vests: getFloatValue(op[1].amount != undefined && op[1].amount.indexOf('VESTS') >= 0 ? op[1].amount : '', factor),
					object: claim[1]
				}
				setExchangesForPreparedDataObject(pCryptoCompareHelper, preparedDataObject, pSteemdApiPropsHelper);
				preparedData[opType].push(preparedDataObject);
			} else {
				preparedDataObject = {
					index: claim[0],
					timestamp: claim[1].timestamp,
					op_type: opType,
					reward_steem: null,
					reward_sbd: null,
					reward_vests: null,
					reward_sp: null,
					object: claim[1]					
				}
				setExchangesForPreparedDataObject(pCryptoCompareHelper, preparedDataObject, pSteemdApiPropsHelper);
				preparedData[opType].push(preparedDataObject);				
			}
		}
		return preparedData;
	} catch (error) {
		console.error(error);
	}
}

function setExchangesForPreparedDataObject(cryptoCompareHelper, pPreparedDataObject, pSteemdApiPropsHelper) {
	var timestamp = new Date(pPreparedDataObject.timestamp);
	var dateKey = cryptoCompareHelper.convertDateUtcToInt(timestamp);
	pPreparedDataObject.steem_per_mvests = pSteemdApiPropsHelper.getSteemPerVestForDate(timestamp);
	pPreparedDataObject.sbd_btc_exchange = null;
	pPreparedDataObject.sbd_btc = null;
	if (pPreparedDataObject.reward_sbd !== null) {
		var exchangeData = cryptoCompareHelper.getExchangeRate('SBD-BTC', dateKey);
		if (exchangeData !== null) {
			pPreparedDataObject.sbd_btc_exchange = exchangeData.close;
			pPreparedDataObject.sbd_btc = pPreparedDataObject.reward_sbd * exchangeData.close;
		}
	}
	pPreparedDataObject.steem_btc_exchange = null;
	pPreparedDataObject.steem_btc = null;
	if (pPreparedDataObject.reward_steem !== null) {
		var exchangeData = cryptoCompareHelper.getExchangeRate('STEEM-BTC', dateKey);
		if (exchangeData !== null) {
			pPreparedDataObject.steem_btc_exchange = exchangeData.close;
			pPreparedDataObject.steem_btc = pPreparedDataObject.reward_steem * exchangeData.close;
		}
	}
	pPreparedDataObject.vests_btc_exchange = null;
	pPreparedDataObject.reward_sp = null;
	pPreparedDataObject.vests_btc = null;
	if (pPreparedDataObject.reward_vests !== null) {
		var exchangeData = cryptoCompareHelper.getExchangeRate('STEEM-BTC', dateKey);
		if (exchangeData !== null) {
			pPreparedDataObject.vests_btc_exchange = exchangeData.close;
			pPreparedDataObject.reward_sp = pPreparedDataObject.reward_vests * pPreparedDataObject.steem_per_mvests / 1000 / 1000;
			pPreparedDataObject.vests_btc = pPreparedDataObject.reward_sp * exchangeData.close;
		}
	}
	var exchangeData = cryptoCompareHelper.getExchangeRate('BTC-EUR', dateKey);
	if (exchangeData !== null) {
		pPreparedDataObject.btc_eur_exchange = exchangeData.close;
		if (pPreparedDataObject.sbd_btc !== null) {
			pPreparedDataObject.sbd_eur = pPreparedDataObject.sbd_btc * exchangeData.close;
		}
		if (pPreparedDataObject.steem_btc !== null) {
			pPreparedDataObject.steem_eur = pPreparedDataObject.steem_btc * exchangeData.close;
		}
		if (pPreparedDataObject.vests_btc !== null) {
			pPreparedDataObject.vests_eur = pPreparedDataObject.vests_btc * exchangeData.close;
		}
	}
}

function createHtmlOutput(preparedData){
		try {
			var htmlFragement = '';
			var preparedDataKeys = Object.keys(preparedData);
			var totalSteem = 0.0;
			var totalSbd = 0.0;
			var totalVests = 0.0;
			var totalSP = 0.0;

			htmlFragement += '<!doctype html>\n';
			htmlFragement += '<html lang="en">\n';
			htmlFragement += '<head>\n';
			htmlFragement += '<meta charset="utf-8">\n';
			htmlFragement += '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">\n';
			htmlFragement += '<title>steemit earnings</title>\n';
			htmlFragement += '<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">\n';
			htmlFragement += '<style type="text/css">\n';
			htmlFragement += '.textcontainer { display: table; table-layout: fixed; word-wrap: break-word; width: 100%; }\n';
			htmlFragement += '.textwrapper { display: table-cell; }\n';
			htmlFragement += '</style>\n';
			htmlFragement += ' <script src="https://code.jquery.com/jquery-3.1.1.slim.min.js" integrity="sha384-A7FZj7v+d/sdmMqp/nOQwliLvUsJfDHW+k9Omg/a/EheAdgtzNs3hpfag6Ed950n" crossorigin="anonymous"></script>\n';
			htmlFragement += '<script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.12.9/umd/popper.min.js" integrity="sha384-ApNbgh9B+Y1QKtv3Rn7W3mgPxhU9K/ScQsAP7hUibX39j7fakFPskvXusvfa0b4Q" crossorigin="anonymous"></script>\n';
			htmlFragement += '<script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js" integrity="sha384-JZR6Spejh4U02d8jOt6vLEHfe/JQGiRRSQQxSfFWpi1MquVdAyjUar5+76PVCmYl" crossorigin="anonymous"></script>\n';
			htmlFragement += '</head>\n';
			htmlFragement += '<body class="bg-light">\n';
			htmlFragement += '<div class="container">\n';


			for (let keyIndex = 0; keyIndex < preparedDataKeys.length; keyIndex++) {
				var key = preparedDataKeys[keyIndex];
				htmlFragement += '<br><h2>'+key+'</h2><br><table class="table"><thead>';
				htmlFragement += '<th scope="col" class="text-right">Index</th>';
				htmlFragement += '<th scope="col" class="text-right">Timestamp</th>';
				htmlFragement += '<th scope="col" class="text-right">reward_steem</th>';
				htmlFragement += '<th scope="col" class="text-right">STEEM/BTC exchange</th>';
				htmlFragement += '<th scope="col" class="text-right">STEEM BTC</th>';
				htmlFragement += '<th scope="col" class="text-right">BTC/EUR exchange</th>';
				htmlFragement += '<th scope="col" class="text-right">STEEM EUR</th>';
				htmlFragement += '<th scope="col" class="text-right">reward_sbd</th>';
				htmlFragement += '<th scope="col" class="text-right">SBD/BTC exchange</th>';
				htmlFragement += '<th scope="col" class="text-right">SBD BTC</th>';
				htmlFragement += '<th scope="col" class="text-right">BTC/EUR exchange</th>';
				htmlFragement += '<th scope="col" class="text-right">SBD EUR</th>';
				htmlFragement += '<th scope="col" class="text-right">reward_vests</th>';
				htmlFragement += '<th scope="col" class="text-right">reward_SP</th>';
				htmlFragement += '<th scope="col" class="text-right">SP/BTC exchange</th>';
				htmlFragement += '<th scope="col" class="text-right">SP BTC</th>';
				htmlFragement += '<th scope="col" class="text-right">BTC/EUR exchange</th>';
				htmlFragement += '<th scope="col" class="text-right">SP EUR</th>';
				htmlFragement += '<th scope="col">JSON</th>';
				htmlFragement += '</thead>';
				htmlFragement += '<tbody>';
	
				var sumValues = [];
	
				for (let index = 0; index < preparedData[key].length; index++) {
					const element = preparedData[key][index];
					var year = new Date(element.timestamp).getUTCFullYear();
					htmlFragement += '<tr>';
					htmlFragement += '<td class="text-right">' + element.index + '</td>';
					htmlFragement += '<td class="text-right">' + element.timestamp + '</td>';
	
					htmlFragement += '<td class="text-right bg-info">' + (element.reward_steem != null ? element.reward_steem.toFixed(3) : '') + '</td>';
					if (sumValues[year] === undefined) sumValues[year] = { reward_steem: 0.0, steem_btc: 0.0, steem_eur: 0.0, reward_sbd: 0.0, sbd_btc: 0.0, sbd_eur: 0.0, reward_vests: 0.0, reward_sp: 0.0, vests_btc: 0.0, vests_eur: 0.0 };
					if (element.reward_steem != null) {
						sumValues[year].reward_steem += element.reward_steem;
					}
					htmlFragement += '<td class="text-right">' + (element.steem_btc_exchange != null ? element.steem_btc_exchange.toFixed(6) : '') + '</td>';
					htmlFragement += '<td class="text-right">' + (element.steem_btc != null ? element.steem_btc.toFixed(6) : '') + '</td>';
					htmlFragement += '<td class="text-right">' + (element.btc_eur_exchange != null ? element.btc_eur_exchange.toFixed(3) : '') + '</td>';
					htmlFragement += '<td class="text-right">' + (element.steem_eur != null ? element.steem_eur.toFixed(3) : '') + '</td>';
					if (element.steem_btc != null) {
						sumValues[year].steem_btc += element.steem_btc;
					}
					if (element.steem_eur != null) {
						sumValues[year].steem_eur += element.steem_eur;
					}
	
					htmlFragement += '<td class="text-right bg-info">' + (element.reward_sbd  != null ? element.reward_sbd.toFixed(3) : '') + '</td>';
					if (element.reward_sbd != null) {
						sumValues[year].reward_sbd += element.reward_sbd;
					}
					htmlFragement += '<td class="text-right">' + (element.sbd_btc_exchange != null ? element.sbd_btc_exchange.toFixed(6) : '') + '</td>';
					htmlFragement += '<td class="text-right">' + (element.sbd_btc != null ? element.sbd_btc.toFixed(6) : '') + '</td>';
					htmlFragement += '<td class="text-right">' + (element.btc_eur_exchange != null ? element.btc_eur_exchange.toFixed(3) : '') + '</td>';
					htmlFragement += '<td class="text-right">' + (element.sbd_eur != null ? element.sbd_eur.toFixed(3) : '') + '</td>';
					if (element.sbd_btc != null) {
						sumValues[year].sbd_btc += element.sbd_btc;
					}
					if (element.sbd_eur != null) {
						sumValues[year].sbd_eur += element.sbd_eur;
					}
	
					htmlFragement += '<td class="text-right bg-info">' + (element.reward_vests  != null ? element.reward_vests.toFixed(3) : '') + '</td>';
					if (element.reward_vests != null) {
						sumValues[year].reward_vests += element.reward_vests;
					}
					htmlFragement += '<td class="text-right bg-info">' + (element.reward_sp  != null ? element.reward_sp.toFixed(3) : '') + '</td>';
					if (element.reward_sp != null) {
						sumValues[year].reward_sp += element.reward_sp;
					}
					htmlFragement += '<td class="text-right">' + (element.vests_btc_exchange != null ? element.vests_btc_exchange.toFixed(6) : '') + '</td>';
					htmlFragement += '<td class="text-right">' + (element.vests_btc != null ? element.vests_btc.toFixed(6) : '') + '</td>';
					htmlFragement += '<td class="text-right">' + (element.btc_eur_exchange != null ? element.btc_eur_exchange.toFixed(3) : '') + '</td>';
					htmlFragement += '<td class="text-right">' + (element.vests_eur != null ? element.vests_eur.toFixed(3) : '') + '</td>';
					if (element.vests_btc != null) {
						sumValues[year].vests_btc += element.vests_btc;
					}
					if (element.vests_eur != null) {
						sumValues[year].vests_eur += element.vests_eur;
					}
	
					htmlFragement += '<td><a class="btn btn-primary" data-toggle="collapse" href="#collapse'+element.index+'" aria-expanded="false" aria-controls="collapseExample">'+element.op_type+'...</a></td>';
					htmlFragement += '</tr>\n';
					htmlFragement += '<tr class="collapse" id="collapse'+element.index+'">';
					htmlFragement += '<td>...</td>';
					htmlFragement += '<td colspan=17><div class="textcontainer"><div class="textwrapper">' + JSON.stringify(element.object) + '</div></div></td>';
					htmlFragement += '</tr>\n';
					
				}
				// footer sums
				htmlFragement += '<tr>';
					htmlFragement += '<td></td>';
					htmlFragement += '<td class="text-right"><strong>year</strong></td>';
					htmlFragement += '<td class="text-right"><strong> STEEM</strong></td>';
					htmlFragement += '<td></td>';
					htmlFragement += '<td class="text-right"><strong> STEEM BTC</strong></td>';
					htmlFragement += '<td></td>';
					htmlFragement += '<td class="text-right"><strong> STEEM EUR</strong></td>';
					htmlFragement += '<td class="text-right"><strong> SBD</strong></td>';
					htmlFragement += '<td></td>';
					htmlFragement += '<td class="text-right"><strong> SBD BTC</strong></td>';
					htmlFragement += '<td></td>';
					htmlFragement += '<td class="text-right"><strong> SBD EUR</strong></td>';
					htmlFragement += '<td class="text-right"><strong> VESTS</strong></td>';
					htmlFragement += '<td class="text-right"><strong> SP</strong></td>';
					htmlFragement += '<td></td>';
					htmlFragement += '<td class="text-right"><strong> VESTS BTC</strong></td>';
					htmlFragement += '<td></td>';
					htmlFragement += '<td class="text-right"><strong> VESTS EUR</strong></td>';
					htmlFragement += '<td></td>';
					htmlFragement += '</tr>\n';
				var yearKeys = Object.keys(sumValues);
				for (let index = 0; index < yearKeys.length; index++) {
					const year = yearKeys[index];
					htmlFragement += '<tr>';
					htmlFragement += '<td></td>';
					htmlFragement += '<td class="text-right"><strong>' + year + '</strong></td>';
					htmlFragement += '<td class="text-right bg-info"><strong>' + sumValues[year].reward_steem.toFixed(3) + '</strong></td>';
					htmlFragement += '<td></td>';
					htmlFragement += '<td class="text-right"><strong>' + sumValues[year].steem_btc.toFixed(6) + '</strong></td>';
					htmlFragement += '<td></td>';
					htmlFragement += '<td class="text-right"><strong>' + sumValues[year].steem_eur.toFixed(3) + '</strong></td>';
					htmlFragement += '<td class="text-right bg-info"><strong>' + sumValues[year].reward_sbd.toFixed(3) + '</strong></td>';
					htmlFragement += '<td></td>';
					htmlFragement += '<td class="text-right"><strong>' + sumValues[year].sbd_btc.toFixed(6) + '</strong></td>';
					htmlFragement += '<td></td>';
					htmlFragement += '<td class="text-right"><strong>' + sumValues[year].sbd_eur.toFixed(3) + '</strong></td>';
					htmlFragement += '<td class="text-right bg-info"><strong>' + sumValues[year].reward_vests.toFixed(3) + '</strong></td>';
					htmlFragement += '<td class="text-right bg-info"><strong>' + (sumValues[year].reward_sp !== undefined ? sumValues[year].reward_sp : 0.0).toFixed(3) + '</strong></td>';
					htmlFragement += '<td></td>';
					htmlFragement += '<td class="text-right"><strong>' + sumValues[year].vests_btc.toFixed(6) + '</strong></td>';
					htmlFragement += '<td></td>';
					htmlFragement += '<td class="text-right"><strong>' + sumValues[year].vests_eur.toFixed(3) + '</strong></td>';
					htmlFragement += '<td></td>';
					htmlFragement += '</tr>\n';
				}
	
				htmlFragement += '</tbody>';
				htmlFragement += '</table>';
				// totalSteem += sumSteem;
				// totalSbd += sumSbd;
				// totalVests += sumVests;
			}

			htmlFragement += '</div>\n';
			htmlFragement += '</body>\n';
			htmlFragement += '</html>\n';
			return htmlFragement;
		} catch (error) {
			console.error(error);
		}
}

function createCsvOutput(preparedData){
	try {
		var output = '';
		var decimalSeparator = ',';
		var preparedDataKeys = Object.keys(preparedData);

			output += 'Index;';
			output += 'Timestamp;';
			output += 'Type;';
			output += 'reward_steem;';
			output += 'STEEM/BTC exchange;';
			output += 'STEEM BTC;';
			output += 'BTC/EUR exchange;';
			output += 'STEEM EUR;';
			output += 'reward_sbd;';
			output += 'SBD/BTC exchange;';
			output += 'SBD BTC;';
			output += 'BTC/EUR exchange;';
			output += 'SBD EUR;';
			output += 'reward_vests;';
			output += 'reward_SP;';
			output += 'SP/BTC exchange;';
			output += 'SP BTC;';
			output += 'BTC/EUR exchange;';
			output += 'SP EUR'+'\n';

		for (let keyIndex = 0; keyIndex < preparedDataKeys.length; keyIndex++) {
			var key = preparedDataKeys[keyIndex];

			for (let index = 0; index < preparedData[key].length; index++) {
				const element = preparedData[key][index];
				output += element.index + ';';
				output += element.timestamp + ';';
				output += key + ';';

				output += (element.reward_steem != null ? element.reward_steem.toFixed(3).replace('.',decimalSeparator) : '') + ';';
				output += (element.steem_btc_exchange != null ? element.steem_btc_exchange.toFixed(6).replace('.',decimalSeparator) : '') + ';';
				output += (element.steem_btc != null ? element.steem_btc.toFixed(6).replace('.',decimalSeparator) : '') + ';';
				output += (element.btc_eur_exchange != null ? element.btc_eur_exchange.toFixed(3).replace('.',decimalSeparator) : '') + ';';
				output += (element.steem_eur != null ? element.steem_eur.toFixed(3).replace('.',decimalSeparator) : '') + ';';
				output += (element.reward_sbd  != null ? element.reward_sbd.toFixed(3).replace('.',decimalSeparator) : '') + ';';
				output += (element.sbd_btc_exchange != null ? element.sbd_btc_exchange.toFixed(6).replace('.',decimalSeparator) : '') + ';';
				output += (element.sbd_btc != null ? element.sbd_btc.toFixed(6).replace('.',decimalSeparator) : '') + ';';
				output += (element.btc_eur_exchange != null ? element.btc_eur_exchange.toFixed(3).replace('.',decimalSeparator) : '') + ';';
				output += (element.sbd_eur != null ? element.sbd_eur.toFixed(3).replace('.',decimalSeparator) : '') + ';';
				output += (element.reward_vests  != null ? element.reward_vests.toFixed(3).replace('.',decimalSeparator) : '') + ';';
				output += (element.reward_sp  != null ? element.reward_sp.toFixed(3).replace('.',decimalSeparator) : '') + ';';
				output += (element.vests_btc_exchange != null ? element.vests_btc_exchange.toFixed(6).replace('.',decimalSeparator) : '') + ';';
				output += (element.vests_btc != null ? element.vests_btc.toFixed(6).replace('.',decimalSeparator) : '') + ';';
				output += (element.btc_eur_exchange != null ? element.btc_eur_exchange.toFixed(3).replace('.',decimalSeparator) : '') + ';';
				output += (element.vests_eur != null ? element.vests_eur.toFixed(3).replace('.',decimalSeparator) : '');
				output += '\n';
			}
		}
		return output;
	} catch (error) {
		console.error(error);
	}
}

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

function main(pAccount) {
	console.log('reading currency exchanges SBD, STEEM, BTC');

	var storage = new BlobStorage();
	var steemdApiPropsHelper = new SteemdApiPropsHelper();
	var steemAccountHistoryHelper = new SteemAccountHistoryHelper(pAccount, storage);
	var cryptoCompareHelper = new CryptoCompareHelper();

	Promise.join(
		cryptoCompareHelper.dailyPriceHistoricalAsync('SBD', 'BTC'),
		cryptoCompareHelper.dailyPriceHistoricalAsync('STEEM', 'BTC'),
		cryptoCompareHelper.dailyPriceHistoricalAsync('BTC', 'EUR'),
		steemdApiPropsHelper.loadAsync()
	).then(()=>{
		return steemAccountHistoryHelper.updateAccountHistoryAsync(pAccount);
	}). then(() => {
		var accountValues = getAccountValue(steemAccountHistoryHelper, cryptoCompareHelper, steemdApiPropsHelper);
		var html = createHtmlOutput(accountValues);
		writeFile(process.argv[1] + '-' + pAccount + '.html', html);
		var csv = createCsvOutput(accountValues);
		writeFile(process.argv[1] + '-' + pAccount + '.csv', csv);
	});
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
