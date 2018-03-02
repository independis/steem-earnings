var fs = require('fs');
var Promise = require('bluebird');
global.fetch = require('node-fetch');
var SteemAccountHistory = require('./lib/steem-account-history.js');
var SteemdApiProps = require('./lib/steemd-api-props.js');
var exchangeRatesTool = require('./lib/exchange-rates-tool.js');

function getFloatValue(pValue, pFactor) {
	if (pValue === undefined || pValue === null || pValue === '') return null;
	var separator = pValue.indexOf(' ');
	if (separator > 0) {
		return parseFloat(pValue.substring(0,separator)) * (pFactor !== undefined && pFactor !== null ? pFactor : 1.0);
	}
	return null;
}


function createPreparedDataObject(pIndex, pTimestamp, pOpType, pRewardSteem, pRewardSbd, pRewardVests, pObject, pSteemdApiProps) {
	// create new object
	var timestamp = new Date(pTimestamp);
	var preparedDataObject = {
		index: pIndex,
		timestamp: pTimestamp,
		op_type: pOpType,
		reward_steem: pRewardSteem,
		reward_sbd: pRewardSbd,
		reward_vests: pRewardVests,
		reward_sp: null,
		steem_per_mvests: pSteemdApiProps.getSteemPerMVestForDate(timestamp),
		sbd_btc_exchange: null,
		sbd_btc: null,
		object: pObject
	};
	// calculate SP value
	if (preparedDataObject.reward_vests !== null && preparedDataObject.steem_per_mvests != null) {
		preparedDataObject.reward_sp = preparedDataObject.reward_vests * preparedDataObject.steem_per_mvests / 1000000;
	}
	// get SBD BTC value
	var dateKey = exchangeRatesTool.convertDateUtcToInt(timestamp);
	if (preparedDataObject.reward_sbd !== null) {
		var exchangeData = exchangeRatesTool.getExchangeRate('SBD-BTC', dateKey);
		if (exchangeData !== null) {
			preparedDataObject.sbd_btc_exchange = exchangeData.close;
			preparedDataObject.sbd_btc = preparedDataObject.reward_sbd * exchangeData.close;
		}
	}
	// get STEEM BTC value
	if (preparedDataObject.reward_steem !== null) {
		var exchangeData = exchangeRatesTool.getExchangeRate('STEEM-BTC', dateKey);
		if (exchangeData !== null) {
			preparedDataObject.steem_btc_exchange = exchangeData.close;
			preparedDataObject.steem_btc = preparedDataObject.reward_steem * exchangeData.close;
		}
	}
	// get STEEM BTC value
	if (preparedDataObject.reward_sp !== null) {
		var exchangeData = exchangeRatesTool.getExchangeRate('STEEM-BTC', dateKey);
		if (exchangeData !== null) {
			preparedDataObject.vests_btc_exchange = exchangeData.close;
			preparedDataObject.vests_btc = preparedDataObject.reward_sp * exchangeData.close;
		}
	}
	// get BTC EUR value
	var exchangeData = exchangeRatesTool.getExchangeRate('BTC-EUR', dateKey);
	if (exchangeData !== null) {
		preparedDataObject.btc_eur_exchange = exchangeData.close;
		if (preparedDataObject.sbd_btc !== null) {
			preparedDataObject.sbd_eur = preparedDataObject.sbd_btc * exchangeData.close;
		}
		if (preparedDataObject.steem_btc !== null) {
			preparedDataObject.steem_eur = preparedDataObject.steem_btc * exchangeData.close;
		}
		if (preparedDataObject.vests_btc !== null) {
			preparedDataObject.vests_eur = preparedDataObject.vests_btc * exchangeData.close;
		}
	}
	return preparedDataObject;
}

function getAccountValue(pSteemAccountHistory, pSteemdApiProps) {
	try {
		var claims = pSteemAccountHistory.getClaims();
		var preparedData = {};
		for (let index = 0; index < claims.length; index++) {
			var claim = claims[index];
			var op = claim[1].op;
			var opType = op[0];
			if (preparedData[opType] === undefined) preparedData[opType] = [];
			if (opType === 'claim_reward_balance') {
				var preparedDataObject = createPreparedDataObject(
					claim[0],
					claim[1].timestamp,
					opType,
					getFloatValue(op[1].reward_steem),
					getFloatValue(op[1].reward_sbd),
					getFloatValue(op[1].reward_vests),
					claim[1],
					pSteemdApiProps
				);
				preparedData[opType].push(preparedDataObject);
			} else if (opType === 'transfer') {
				var factor = (op[1].from === pSteemAccountHistory.account) ? -1.0 : 1.0;
				var preparedDataObject = createPreparedDataObject(
					claim[0],
					claim[1].timestamp,
					opType,
					getFloatValue(op[1].amount != undefined && op[1].amount.indexOf('STEEM') >= 0 ? op[1].amount : '', factor),
					getFloatValue(op[1].amount != undefined && op[1].amount.indexOf('SBD') >= 0 ? op[1].amount : '', factor),
					getFloatValue(op[1].amount != undefined && op[1].amount.indexOf('VESTS') >= 0 ? op[1].amount : '', factor),
					claim[1],
					pSteemdApiProps);
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
				htmlFragement += '<th scope="col" class="text-right">STEEM/BTC</th>';
				htmlFragement += '<th scope="col" class="text-right">STEEM BTC</th>';
				htmlFragement += '<th scope="col" class="text-right">BTC/EUR</th>';
				htmlFragement += '<th scope="col" class="text-right">STEEM EUR</th>';
				htmlFragement += '<th scope="col" class="text-right">SBD</th>';
				htmlFragement += '<th scope="col" class="text-right">SBD/BTC</th>';
				htmlFragement += '<th scope="col" class="text-right">SBD BTC</th>';
				htmlFragement += '<th scope="col" class="text-right">BTC/EUR</th>';
				htmlFragement += '<th scope="col" class="text-right">SBD EUR</th>';
				htmlFragement += '<th scope="col" class="text-right">VESTS</th>';
				htmlFragement += '<th scope="col" class="text-right">Steem/mvests</th>';
				htmlFragement += '<th scope="col" class="text-right">SP</th>';
				htmlFragement += '<th scope="col" class="text-right">SP/BTC</th>';
				htmlFragement += '<th scope="col" class="text-right">SP BTC</th>';
				htmlFragement += '<th scope="col" class="text-right">BTC/EUR</th>';
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
	
					if (sumValues[year] === undefined) sumValues[year] = { reward_steem: 0.0, steem_btc: 0.0, steem_eur: 0.0, reward_sbd: 0.0, sbd_btc: 0.0, sbd_eur: 0.0, reward_vests: 0.0, reward_sp: 0.0, vests_btc: 0.0, vests_eur: 0.0 };

					htmlFragement += '<td class="text-right bg-info">' + (element.reward_steem != null ? element.reward_steem.toFixed(3) : '') + '</td>';
					if (element.reward_steem != null) {
						sumValues[year].reward_steem += element.reward_steem;
					}
					htmlFragement += '<td class="text-right">' + (element.steem_btc_exchange != null ? element.steem_btc_exchange.toFixed(6) : '') + '</td>';
					htmlFragement += '<td class="text-right">' + (element.steem_btc != null ? element.steem_btc.toFixed(6) : '') + '</td>';
					htmlFragement += '<td class="text-right">' + (element.reward_steem != null && element.btc_eur_exchange != null ? element.btc_eur_exchange.toFixed(3) : '') + '</td>';
					htmlFragement += '<td class="text-right">' + (element.reward_steem != null && element.steem_eur != null ? element.steem_eur.toFixed(3) : '') + '</td>';
					if (element.steem_btc != null) {
						sumValues[year].steem_btc += element.steem_btc;
					}
					if (element.reward_steem != null && element.steem_eur != null) {
						sumValues[year].steem_eur += element.steem_eur;
					}

					htmlFragement += '<td class="text-right bg-info">' + (element.reward_sbd  != null ? element.reward_sbd.toFixed(3) : '') + '</td>';
					if (element.reward_sbd != null) {
						sumValues[year].reward_sbd += element.reward_sbd;
					}
					htmlFragement += '<td class="text-right">' + (element.reward_sbd  != null && element.sbd_btc_exchange != null ? element.sbd_btc_exchange.toFixed(6) : '') + '</td>';
					htmlFragement += '<td class="text-right">' + (element.reward_sbd  != null && element.sbd_btc != null ? element.sbd_btc.toFixed(6) : '') + '</td>';
					htmlFragement += '<td class="text-right">' + (element.reward_sbd  != null && element.btc_eur_exchange != null ? element.btc_eur_exchange.toFixed(3) : '') + '</td>';
					htmlFragement += '<td class="text-right">' + (element.reward_sbd  != null && element.sbd_eur != null ? element.sbd_eur.toFixed(3) : '') + '</td>';
					if (element.reward_sbd  != null && element.sbd_btc != null) {
						sumValues[year].sbd_btc += element.sbd_btc;
					}
					if (element.reward_sbd  != null && element.sbd_eur != null) {
						sumValues[year].sbd_eur += element.sbd_eur;
					}
		
					htmlFragement += '<td class="text-right bg-info">' + (element.reward_vests  != null ? element.reward_vests.toFixed(3) : '') + '</td>';
					if (element.reward_vests != null) {
						sumValues[year].reward_vests += element.reward_vests;
					}
					htmlFragement += '<td class="text-right">' + (element.reward_vests  != null && element.steem_per_mvests  != null ? (element.steem_per_mvests).toFixed(6) : '') + '</td>';
					htmlFragement += '<td class="text-right bg-info">' + (element.reward_sp  != null ? element.reward_sp.toFixed(3) : '') + '</td>';
					if (element.reward_sp != null) {
						sumValues[year].reward_sp += element.reward_sp;
					}
					htmlFragement += '<td class="text-right">' + (element.reward_sp  != null && element.vests_btc_exchange != null ? element.vests_btc_exchange.toFixed(6) : '') + '</td>';
					htmlFragement += '<td class="text-right">' + (element.reward_sp  != null && element.vests_btc != null ? element.vests_btc.toFixed(6) : '') + '</td>';
					htmlFragement += '<td class="text-right">' + (element.reward_sp  != null && element.btc_eur_exchange != null ? element.btc_eur_exchange.toFixed(3) : '') + '</td>';
					htmlFragement += '<td class="text-right">' + (element.reward_sp  != null && element.vests_eur != null ? element.vests_eur.toFixed(3) : '') + '</td>';
					if (element.reward_sp  != null && element.vests_btc != null) {
						sumValues[year].vests_btc += element.vests_btc;
					}
					if (element.reward_sp  != null && element.vests_eur != null) {
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
					htmlFragement += '<td class="text-right"><strong>STEEM</strong></td>';
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
					htmlFragement += '<td></td>';
					htmlFragement += '<td class="text-right"><strong> SP</strong></td>';
					htmlFragement += '<td></td>';
					htmlFragement += '<td class="text-right"><strong> SP BTC</strong></td>';
					htmlFragement += '<td></td>';
					htmlFragement += '<td class="text-right"><strong> SP EUR</strong></td>';
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
					htmlFragement += '<td></td>';
					htmlFragement += '<td class="text-right bg-info"><strong>' + sumValues[year].reward_sp.toFixed(3) + '</strong></td>';
					htmlFragement += '<td></td>';
					htmlFragement += '<td class="text-right"><strong>' + sumValues[year].vests_btc.toFixed(6) + '</strong></td>';
					htmlFragement += '<td></td>';
					htmlFragement += '<td class="text-right"><strong>' + sumValues[year].vests_eur.toFixed(3) + '</strong></td>';
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
	var steemAccountHistory = new SteemAccountHistory(pAccount);
	var steemdApiProps = new SteemdApiProps();

	steemdApiProps.loadAsync(
	).then( 
		exchangeRatesTool.loadExchangeRatesAsync("STEEM","BTC",1000)
	).then( 
		exchangeRatesTool.loadExchangeRatesAsync("SBD","BTC",1000)
	).then( 
		exchangeRatesTool.loadExchangeRatesAsync("BTC","EUR",1000)
	).then(() => 
		steemAccountHistory.updateAccountHistoryAsync(pAccount)
	).then(() => {
		var accountValues = getAccountValue(steemAccountHistory, steemdApiProps);
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
