var SimpleStorage = require('./simple-storage.js');
var steem = require('steem');
steem.api.setOptions({ url: 'https://api.steemit.com' });
// steem.api.setOptions({ url: 'https://gtg.steem.house:8090' });
// steem.api.setOptions({ url: 'https://steemd.minnowsupportproject.org/' });
// steem.api.setOptions({ url: 'https://steemd.privex.io/' });
// steem.api.setOptions({ url: 'https://rpc.buildteam.io/' });
// steem.api.setOptions({ url: 'https://steemd.pevo.science/' });
// steem.api.setOptions({ url: 'https://rpc.steemviz.com/' });


function SteemAccountHistory(pAccount) {
	var self = this;

	self.account = pAccount;

	var storage = new SimpleStorage();
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
			var op = element != null && element.length >= 2 && element[1] !== undefined ? element[1].op : null;
			if (op !== null) {
				if (op.length > 0 && (op[0] === 'claim_reward_balance' || op[0] === 'transfer')) {
					resultData.push(element);
				}
			}
		}
		return resultData;
	}
}

module.exports = SteemAccountHistory;
