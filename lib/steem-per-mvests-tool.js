var Promise = require('bluebird');
global.fetch = require('node-fetch');
var fs = require('fs');

function SteemPerMVestsTool() {
	var self = this;

	self.steemPerMVestsData = {};
	self.repositoryFilePath = process.cwd() + '/data/steem_per_mvests.json';

	function loadSteemPerMVestsDataFromFile() {
		try {
			var data = fs.readFileSync( self.repositoryFilePath, 'utf8');
			return JSON.parse(data);
		} catch (ex) {
			console.error("Error occured on 'loadSteemPerMVestsDataFromFile': " + ex);
			throw ex;
		}
	};

	function saveSteemPerMVestsDataToFile() {
		try {
			fs.writeFileSync(self.repositoryFilePath, JSON.stringify(self.steemPerMVestsData));
		} catch (ex) {
			console.error("Error occured on 'saveSteemPerMVestsDataToFile': " + ex);
			throw ex;
		}
	};

	self.getSteemPerMVestForDate = function(pDate) {
		if (self.steemPerMVestsData.length===0) return null;
		var nearestDiff = null;
		var nearestSteemPerMVestsDataItem = null;
		for (let index = 0; index < self.steemPerMVestsData.length; index++) {
			const steemPerMVestsDataItem = self.steemPerMVestsData[index];
			var date = new Date(steemPerMVestsDataItem.timestamp);
			var diff = date - pDate;
			if (diff < 0) diff = diff * (-1);
			if (nearestDiff === null || (diff < nearestDiff)) {
				nearestDiff = diff;
				nearestSteemPerMVestsDataItem = steemPerMVestsDataItem;
			}
		}
		if (nearestSteemPerMVestsDataItem != null) {
			return nearestSteemPerMVestsDataItem.steem_per_mvests;
		}
		return null;
	}

	self.loadAsync = function() {
		// first load data from json file
		self.steemPerMVestsData = loadSteemPerMVestsDataFromFile();

		var url='https://steemdb.com/api/props';
		console.log( 'loading data from "' + url + '"');
		return fetch(url
			).then((response) => 
				response.json()
			).then((data) => {
				if (data === null || data.length===0) return;
				var maxExistingDate = self.steemPerMVestsData.length > 0 ? new Date(self.steemPerMVestsData[self.steemPerMVestsData.length-1].timestamp) : new Date('2016-01-01T00:00:00');
				// head_block_number
				for (let index = data.length-1; index >= 0; index--) {
					const steemdApiPropsDataItem = data[index];
					var date = new Date(parseInt(steemdApiPropsDataItem.time.$date.$numberLong));
					if (date < maxExistingDate) continue;
					self.steemPerMVestsData.push({
						"timestamp": date.toJSON(),
						"block_id": steemdApiPropsDataItem.head_block_number,
						"steem": steemdApiPropsDataItem.total_vesting_fund_steem,
						"vests": steemdApiPropsDataItem.total_vesting_shares,
						"steem_per_mvests": steemdApiPropsDataItem.total_vesting_fund_steem * 1000000 / steemdApiPropsDataItem.total_vesting_shares
					});
				}
			}).catch((err) => {
				console.log(err);
			});
	}

	self.updateAsync = function() {
		return self.loadAsync(
		).then(data => { 
			saveSteemPerMVestsDataToFile();
			return self.steemPerMVestsData;
		});
	}

}

// instanciate and load data from file
module.exports = new SteemPerMVestsTool();
