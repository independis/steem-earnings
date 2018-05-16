var Promise = require('bluebird');
global.fetch = require('node-fetch');
var fs = require('fs');
var steemPerMVestsTool = require ('../lib/steem-per-mvests-tool.js');

function main() {
	// update data from
	steemPerMVestsTool.updateAsync()
	.then((steemPerMVestsData) => {
		var filepath = process.cwd() + '/ui/steem-per-mvests-data.js';
		console.log("Writing file '"+filepath+"'");
		var dataJsonString = "steemPerMVestsData = " + JSON.stringify(steemPerMVestsData) + ";";
		try {
			fs.writeFileSync(filepath, dataJsonString);
		} catch (ex) {
			console.error("Error occured on 'saveSteemPerMVestsDataToFile': " + ex);
			throw ex;
		}
	})
	.catch(err => { console.error(err); });
}

// MAIN
main();
