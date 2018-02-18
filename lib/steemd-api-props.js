var Promise = require('bluebird');
global.fetch = require('node-fetch');

var SteemdApiProps = function() {
	var self = this;

	self.steemdApiPropsData = {};

	self.getSteemPerMVestForDate = function(pDate) {
		if (self.steemdApiPropsData.length===0) return null;
		var nearestDiff = null;
		var nearestSteemdApiPropsDataItem = null;
		for (let index = 0; index < self.steemdApiPropsData.length; index++) {
			const steemdApiPropsDataItem = self.steemdApiPropsData[index];
			var date = new Date(parseInt(steemdApiPropsDataItem.time.$date.$numberLong));
			var diff = date - pDate;
			if (diff < 0) diff = diff * (-1);
			if (nearestDiff === null || (diff < nearestDiff && date >= pDate)) {
				nearestDiff = diff;
				nearestSteemdApiPropsDataItem = steemdApiPropsDataItem;
			}
		}
		if (nearestSteemdApiPropsDataItem != null) {
			return nearestSteemdApiPropsDataItem.total_vesting_fund_steem * 1000000 / nearestSteemdApiPropsDataItem.total_vesting_shares; // nearestSteemdApiPropsDataItem.steem_per_mvests;
		}
		return null;
	}

	self.loadAsync = function() {
		var url='https://steemdb.com/api/props';
		console.log( 'loading data from "' + url + '"');
		return fetch(url
			).then((response) => response.json()
			).then((data) => self.steemdApiPropsData = data);
	}
}

module.exports = SteemdApiProps;
