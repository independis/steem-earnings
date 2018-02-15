var fs = require('fs');
var Promise = require('bluebird');
global.fetch = require('node-fetch');
var steem = require('steem');
steem.api.setOptions({ url: 'https://api.steemit.com' });

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
				if (op.length > 0 && (op[0] === 'claim_reward_balance' || op[0] === 'transfer')) {
					resultData.push(element);
				}
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

function getAccountValue(pSteemAccountHistoryHelper) {
	try {
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
				preparedData[opType].push(preparedDataObject);
			}
		}
		return preparedData;
	} catch (error) {
		console.error(error);
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
				htmlFragement += '<th scope="col" class="text-right">STEEM</th>';
				htmlFragement += '<th scope="col" class="text-right">SBD</th>';
				htmlFragement += '<th scope="col" class="text-right">VESTS</th>';
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
	
					htmlFragement += '<td class="text-right bg-info">' + (element.reward_sbd  != null ? element.reward_sbd.toFixed(3) : '') + '</td>';
					if (element.reward_sbd != null) {
						sumValues[year].reward_sbd += element.reward_sbd;
					}
	
					htmlFragement += '<td class="text-right bg-info">' + (element.reward_vests  != null ? element.reward_vests.toFixed(3) : '') + '</td>';
					if (element.reward_vests != null) {
						sumValues[year].reward_vests += element.reward_vests;
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
					htmlFragement += '<td class="text-right"><strong>STEEM</strong></td>';
					htmlFragement += '<td class="text-right"><strong>SBD</strong></td>';
					htmlFragement += '<td class="text-right"><strong>VESTS</strong></td>';
					htmlFragement += '<td></td>';
					htmlFragement += '</tr>\n';
				var yearKeys = Object.keys(sumValues);
				for (let index = 0; index < yearKeys.length; index++) {
					const year = yearKeys[index];
					htmlFragement += '<tr>';
					htmlFragement += '<td></td>';
					htmlFragement += '<td class="text-right"><strong>' + year + '</strong></td>';
					htmlFragement += '<td class="text-right bg-info"><strong>' + sumValues[year].reward_steem.toFixed(3) + '</strong></td>';
					htmlFragement += '<td class="text-right bg-info"><strong>' + sumValues[year].reward_sbd.toFixed(3) + '</strong></td>';
					htmlFragement += '<td class="text-right bg-info"><strong>' + sumValues[year].reward_vests.toFixed(3) + '</strong></td>';
					htmlFragement += '<td></td>';
					htmlFragement += '</tr>\n';
				}
	
				htmlFragement += '</tbody>';
				htmlFragement += '</table>';
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
		var decimalSeparator = ',';
		var preparedDataKeys = Object.keys(preparedData);

		var output = '';
		output += 'Index;';
		output += 'Timestamp;';
		output += 'Type;';
		output += 'STEEM;';
		output += 'SBD;';
		output += 'VESTS;';
		output += '\n';

		for (let keyIndex = 0; keyIndex < preparedDataKeys.length; keyIndex++) {
			var key = preparedDataKeys[keyIndex];

			for (let index = 0; index < preparedData[key].length; index++) {
				const element = preparedData[key][index];
				output += element.index + ';';
				output += element.timestamp + ';';
				output += key + ';';

				output += (element.reward_steem != null ? element.reward_steem.toFixed(3).replace('.',decimalSeparator) : '') + ';';
				output += (element.reward_sbd  != null ? element.reward_sbd.toFixed(3).replace('.',decimalSeparator) : '') + ';';
				output += (element.reward_vests  != null ? element.reward_vests.toFixed(3).replace('.',decimalSeparator) : '') + ';';
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
	var storage = new BlobStorage();
	var steemAccountHistoryHelper = new SteemAccountHistoryHelper(pAccount, storage);

	steemAccountHistoryHelper.updateAccountHistoryAsync(pAccount
	). then(() => {
		var accountValues = getAccountValue(steemAccountHistoryHelper);
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
