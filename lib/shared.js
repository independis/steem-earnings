(function(exports) {

    // Define all your functions on the exports object                                                                                                             
	function getFloatValue(pValue, pFactor) {
		if (pValue === undefined || pValue === null || pValue === '') return null;
		var separator = pValue.indexOf(' ');
		if (separator > 0) {
			return parseFloat(pValue.substring(0,separator)) * (pFactor !== undefined && pFactor !== null ? pFactor : 1.0);
		}
		return null;
	};

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

	function convertDateUtcToInt(pDate) {
		var detailedDate = convertToUtcDetailedDate(pDate);
		return detailedDate.year * 10000 + detailedDate.month * 100 + detailedDate.day;
	}
	
	function createPreparedDataObject(pIndex, pTimestamp, pOpType, pRewardSteem, pRewardSbd, pRewardVests, pDetails, pObject, fnGetSteemPerMVestForDate, fnGetExchangeRate) {
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
			steem_per_mvests: fnGetSteemPerMVestForDate(timestamp),
			sbd_btc_exchange: null,
			sbd_btc: null,
			details: pDetails,
			object: pObject
		};
		// calculate SP value
		if (preparedDataObject.reward_vests !== null && preparedDataObject.steem_per_mvests != null) {
			preparedDataObject.reward_sp = preparedDataObject.reward_vests * preparedDataObject.steem_per_mvests / 1000000;
		}
		// get SBD BTC value
		var dateKey = convertDateUtcToInt(timestamp);
		if (preparedDataObject.reward_sbd !== null) {
			var exchangeData = fnGetExchangeRate('SBD-BTC', dateKey);
			if (exchangeData !== null) {
				preparedDataObject.sbd_btc_exchange = exchangeData.close;
				preparedDataObject.sbd_btc = preparedDataObject.reward_sbd * exchangeData.close;
			}
		}
		// get STEEM BTC value
		if (preparedDataObject.reward_steem !== null) {
			var exchangeData = fnGetExchangeRate('STEEM-BTC', dateKey);
			if (exchangeData !== null) {
				preparedDataObject.steem_btc_exchange = exchangeData.close;
				preparedDataObject.steem_btc = preparedDataObject.reward_steem * exchangeData.close;
			}
		}
		// get STEEM BTC value
		if (preparedDataObject.reward_sp !== null) {
			var exchangeData = fnGetExchangeRate('STEEM-BTC', dateKey);
			if (exchangeData !== null) {
				preparedDataObject.vests_btc_exchange = exchangeData.close;
				preparedDataObject.vests_btc = preparedDataObject.reward_sp * exchangeData.close;
			}
		}
		// get BTC EUR value
		var exchangeData = fnGetExchangeRate('BTC-EUR', dateKey);
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
	
	exports.getAccountValue = function(accountName, claims, fnGetSteemPerMVestForDate, fnGetExchangeRate) {
		try {
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
						'',
						claim[1],
						fnGetSteemPerMVestForDate,
						fnGetExchangeRate
					);
					preparedData[opType].push(preparedDataObject);
				} else if (opType === 'transfer') {
					var factor = (op[1].from === accountName) ? -1.0 : 1.0;
					var preparedDataObject = createPreparedDataObject(
						claim[0],
						claim[1].timestamp,
						opType,
						getFloatValue(op[1].amount != undefined && op[1].amount.indexOf('STEEM') >= 0 ? op[1].amount : '', factor),
						getFloatValue(op[1].amount != undefined && op[1].amount.indexOf('SBD') >= 0 ? op[1].amount : '', factor),
						getFloatValue(op[1].amount != undefined && op[1].amount.indexOf('VESTS') >= 0 ? op[1].amount : '', factor),
						(op[1].from === accountName) ? 'to ' + op[1].to : 'from ' + op[1].from,
						claim[1],
						fnGetSteemPerMVestForDate,
						fnGetExchangeRate);
					preparedData[opType].push(preparedDataObject);
				}
			}
			return preparedData;
		} catch (error) {
			console.error(error);
		}
	}

	function createHtmlOutputHeader() {
		var htmlFragement = '<div class="container" style="max-width:98%;">\n';
		return htmlFragement;
	}
	
	function createHtmlOutputFooter() {
		var htmlFragement = '</div>\n';
		htmlFragement += '</body>\n';
		htmlFragement += '</html>\n';
		return htmlFragement;
	}
	
	exports.createHtmlOutput = function(preparedData, filterYear) {
			try {
				var preparedDataKeys = Object.keys(preparedData);
				var totalSteem = 0.0;
				var totalSbd = 0.0;
				var totalVests = 0.0;
				var totalSP = 0.0;
	
				var htmlFragement = createHtmlOutputHeader();
	
				for (let keyIndex = 0; keyIndex < preparedDataKeys.length; keyIndex++) {
					var key = preparedDataKeys[keyIndex];
					htmlFragement += '<br><h2>' + key + ' ' + (filterYear != null ? filterYear : '') + '</h2><br><table class="table"><thead>';
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
					htmlFragement += '<th scope="col">Details</th>';
					htmlFragement += '<th scope="col">JSON</th>';
					htmlFragement += '</thead>';
					htmlFragement += '<tbody>';
		
					var sumValues = [];
		
					for (let index = 0; index < preparedData[key].length; index++) {
						const element = preparedData[key][index];
	
						// check filterYear
						var year = new Date(element.timestamp).getUTCFullYear();
						if (filterYear != null && filterYear != year) continue;
	
						htmlFragement += '<tr>';
						htmlFragement += '<td class="text-right">' + element.index + '</td>';
						htmlFragement += '<td class="text-right">' + element.timestamp.replace('T',' ') + '</td>';
		
						if (sumValues[year] === undefined) sumValues[year] = { reward_steem: 0.0, steem_btc: 0.0, steem_eur: 0.0, reward_sbd: 0.0, sbd_btc: 0.0, sbd_eur: 0.0, reward_vests: 0.0, reward_sp: 0.0, vests_btc: 0.0, vests_eur: 0.0 };
	
						htmlFragement += '<td class="text-right bg-secondary text-white">' + (element.reward_steem != null ? element.reward_steem.toFixed(3) : '') + '</td>';
						if (element.reward_steem != null) {
							sumValues[year].reward_steem += element.reward_steem;
						}
						htmlFragement += '<td class="text-right">' + (element.steem_btc_exchange != null ? element.steem_btc_exchange.toFixed(6) : '') + '</td>';
						htmlFragement += '<td class="text-right">' + (element.steem_btc != null ? element.steem_btc.toFixed(6) : '') + '</td>';
						htmlFragement += '<td class="text-right">' + (element.reward_steem != null && element.btc_eur_exchange != null ? element.btc_eur_exchange.toFixed(3) : '') + '</td>';
						htmlFragement += '<td class="text-right bg-primary text-white">' + (element.reward_steem != null && element.steem_eur != null ? element.steem_eur.toFixed(3) : '') + '</td>';
						if (element.steem_btc != null) {
							sumValues[year].steem_btc += element.steem_btc;
						}
						if (element.reward_steem != null && element.steem_eur != null) {
							sumValues[year].steem_eur += element.steem_eur;
						}
	
						htmlFragement += '<td class="text-right bg-secondary text-white">' + (element.reward_sbd  != null ? element.reward_sbd.toFixed(3) : '') + '</td>';
						if (element.reward_sbd != null) {
							sumValues[year].reward_sbd += element.reward_sbd;
						}
						htmlFragement += '<td class="text-right">' + (element.reward_sbd  != null && element.sbd_btc_exchange != null ? element.sbd_btc_exchange.toFixed(6) : '') + '</td>';
						htmlFragement += '<td class="text-right">' + (element.reward_sbd  != null && element.sbd_btc != null ? element.sbd_btc.toFixed(6) : '') + '</td>';
						htmlFragement += '<td class="text-right">' + (element.reward_sbd  != null && element.btc_eur_exchange != null ? element.btc_eur_exchange.toFixed(3) : '') + '</td>';
						htmlFragement += '<td class="text-right bg-primary text-white">' + (element.reward_sbd  != null && element.sbd_eur != null ? element.sbd_eur.toFixed(3) : '') + '</td>';
						if (element.reward_sbd  != null && element.sbd_btc != null) {
							sumValues[year].sbd_btc += element.sbd_btc;
						}
						if (element.reward_sbd  != null && element.sbd_eur != null) {
							sumValues[year].sbd_eur += element.sbd_eur;
						}
			
						htmlFragement += '<td class="text-right bg-secondary text-white">' + (element.reward_vests  != null ? element.reward_vests.toFixed(3) : '') + '</td>';
						if (element.reward_vests != null) {
							sumValues[year].reward_vests += element.reward_vests;
						}
						htmlFragement += '<td class="text-right">' + (element.reward_vests  != null && element.steem_per_mvests  != null ? (element.steem_per_mvests).toFixed(6) : '') + '</td>';
						htmlFragement += '<td class="text-right bg-secondary text-white">' + (element.reward_sp  != null ? element.reward_sp.toFixed(3) : '') + '</td>';
						if (element.reward_sp != null) {
							sumValues[year].reward_sp += element.reward_sp;
						}
						htmlFragement += '<td class="text-right">' + (element.reward_sp  != null && element.vests_btc_exchange != null ? element.vests_btc_exchange.toFixed(6) : '') + '</td>';
						htmlFragement += '<td class="text-right">' + (element.reward_sp  != null && element.vests_btc != null ? element.vests_btc.toFixed(6) : '') + '</td>';
						htmlFragement += '<td class="text-right">' + (element.reward_sp  != null && element.btc_eur_exchange != null ? element.btc_eur_exchange.toFixed(3) : '') + '</td>';
						htmlFragement += '<td class="text-right bg-primary text-white">' + (element.reward_sp  != null && element.vests_eur != null ? element.vests_eur.toFixed(3) : '') + '</td>';
						if (element.reward_sp  != null && element.vests_btc != null) {
							sumValues[year].vests_btc += element.vests_btc;
						}
						if (element.reward_sp  != null && element.vests_eur != null) {
							sumValues[year].vests_eur += element.vests_eur;
						}
	
						htmlFragement += '<td class="text-left">' + element.details + '</td>';
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
					htmlFragement += '<td></td>';
					htmlFragement += '</tr>\n';
					var yearKeys = Object.keys(sumValues);
					for (let index = 0; index < yearKeys.length; index++) {
						const year = yearKeys[index];
						htmlFragement += '<tr>';
						htmlFragement += '<td></td>';
						htmlFragement += '<td class="text-right"><strong>' + year + '</strong></td>';
						htmlFragement += '<td class="text-right bg-secondary text-white"><strong>' + sumValues[year].reward_steem.toFixed(3) + '</strong></td>';
						htmlFragement += '<td></td>';
						htmlFragement += '<td class="text-right"><strong>' + sumValues[year].steem_btc.toFixed(6) + '</strong></td>';
						htmlFragement += '<td></td>';
						htmlFragement += '<td class="text-right bg-primary text-white"><strong>' + sumValues[year].steem_eur.toFixed(3) + '</strong></td>';
						htmlFragement += '<td class="text-right bg-secondary text-white"><strong>' + sumValues[year].reward_sbd.toFixed(3) + '</strong></td>';
						htmlFragement += '<td></td>';
						htmlFragement += '<td class="text-right"><strong>' + sumValues[year].sbd_btc.toFixed(6) + '</strong></td>';
						htmlFragement += '<td></td>';
						htmlFragement += '<td class="text-right bg-primary text-white"><strong>' + sumValues[year].sbd_eur.toFixed(3) + '</strong></td>';
						htmlFragement += '<td class="text-right bg-secondary text-white"><strong>' + sumValues[year].reward_vests.toFixed(3) + '</strong></td>';
						htmlFragement += '<td></td>';
						htmlFragement += '<td class="text-right bg-secondary text-white"><strong>' + sumValues[year].reward_sp.toFixed(3) + '</strong></td>';
						htmlFragement += '<td></td>';
						htmlFragement += '<td class="text-right"><strong>' + sumValues[year].vests_btc.toFixed(6) + '</strong></td>';
						htmlFragement += '<td></td>';
						htmlFragement += '<td class="text-right bg-primary text-white"><strong>' + sumValues[year].vests_eur.toFixed(3) + '</strong></td>';
						htmlFragement += '<td></td>';
						htmlFragement += '<td></td>';
						htmlFragement += '</tr>\n';
					}
					htmlFragement += '</tbody>';
					htmlFragement += '</table>';
				}
				htmlFragement += createHtmlOutputFooter();
				return htmlFragement;
			} catch (error) {
				console.error(error);
			}
	}


	exports.createCsvOutputHeader = function(){
		var output = '';
		output += 'Index;';
		output += 'Timestamp;';
		output += 'Type;';
		output += 'STEEM;';
		output += 'STEEM/BTC;';
		output += 'STEEM BTC;';
		output += 'BTC/EUR;';
		output += 'STEEM EUR;';
		output += 'SBD;';
		output += 'SBD/BTC;';
		output += 'SBD BTC;';
		output += 'BTC/EUR;';
		output += 'SBD EUR;';
		output += 'VESTS;';
		output += 'STEEM/VESTS;';
		output += 'SP;';
		output += 'SP/BTC;';
		output += 'SP BTC;';
		output += 'BTC/EUR;';
		output += 'SP EUR;';
		output += 'DETAILS;';
		output += '\n';
		return output;
	}
	
	exports.createCsvOutput = function(preparedData, filterYear){
		try {
			var decimalSeparator = ',';
			var preparedDataKeys = Object.keys(preparedData);
	
			var output = '';
	
			for (let keyIndex = 0; keyIndex < preparedDataKeys.length; keyIndex++) {
				var key = preparedDataKeys[keyIndex];
	
				for (let index = 0; index < preparedData[key].length; index++) {
					const element = preparedData[key][index];
	
					// check filterYear
					var year = new Date(element.timestamp).getUTCFullYear();
					if (filterYear != null && filterYear != year) continue;
					
					output += element.index + ';';
					output += element.timestamp + ';';
					output += key + ';';
	
					output += (element.reward_steem != null ? element.reward_steem.toFixed(3).replace('.',decimalSeparator) : '') + ';';
					output += (element.reward_steem != null && element.steem_btc_exchange != null ? element.steem_btc_exchange.toFixed(3).replace('.',decimalSeparator) : '') + ';';
					output += (element.reward_steem != null && element.steem_btc != null ? element.steem_btc.toFixed(3).replace('.',decimalSeparator) : '') + ';';
					output += (element.reward_steem != null && element.btc_eur_exchange != null ? element.btc_eur_exchange.toFixed(6).replace('.',decimalSeparator) : '') + ';';
					output += (element.reward_steem != null && element.steem_eur != null ? element.steem_eur.toFixed(3).replace('.',decimalSeparator) : '') + ';';
	
					output += (element.reward_sbd  != null ? element.reward_sbd.toFixed(3).replace('.',decimalSeparator) : '') + ';';
					output += (element.reward_sbd  != null && element.sbd_btc_exchange  != null ? element.sbd_btc_exchange.toFixed(6).replace('.',decimalSeparator) : '') + ';';
					output += (element.reward_sbd  != null && element.sbd_btc  != null ? element.sbd_btc.toFixed(6).replace('.',decimalSeparator) : '') + ';';
					output += (element.reward_sbd  != null && element.btc_eur_exchange  != null ? element.btc_eur_exchange.toFixed(3).replace('.',decimalSeparator) : '') + ';';
					output += (element.reward_sbd  != null && element.sbd_eur  != null ? element.sbd_eur.toFixed(3).replace('.',decimalSeparator) : '') + ';';
	
					output += (element.reward_vests  != null ? element.reward_vests.toFixed(3).replace('.',decimalSeparator) : '') + ';';
					output += (element.reward_vests  != null && element.steem_per_mvests  != null ? element.steem_per_mvests.toFixed(6).replace('.',decimalSeparator) : '') + ';';
					output += (element.reward_sp  != null ? element.reward_sp.toFixed(3).replace('.',decimalSeparator) : '') + ';';
					output += (element.reward_sp  != null && element.vests_btc_exchange  != null ? element.vests_btc_exchange.toFixed(6).replace('.',decimalSeparator) : '') + ';';
					output += (element.reward_sp  != null && element.vests_btc  != null ? element.vests_btc.toFixed(6).replace('.',decimalSeparator) : '') + ';';
					output += (element.reward_sp  != null && element.btc_eur_exchange  != null ? element.btc_eur_exchange.toFixed(3).replace('.',decimalSeparator) : '') + ';';
					output += (element.reward_sp  != null && element.vests_eur  != null ? element.vests_eur.toFixed(3).replace('.',decimalSeparator) : '') + ';';
	
					output += element.details + ';';
	
					output += '\n';
				}
			}
			return output;
		} catch (error) {
			console.error(error);
		}
	}
	
})((typeof process === 'undefined' || !process.versions)
   ? window.shared = window.shared || {}
: exports);


