function SimpleStorage() {
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

module.exports = SimpleStorage;
