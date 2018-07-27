# steemit-earnings
Get information about your steemit earnings.

## Using nodeJS

### Install the required packages of the program

For implementation I used several node packages :
- steem: The steem JS API
- fs: To create the output files
- bluebird: Fully featured promises library
- node-fetch: Brings 'window.fetch' to Node.js
- cryptocompare-api: Get exchange rates for crypto and FIAT currencies

Just execute the following command to install all required packages for the program.

````
npm install
````

### get claimed rewards and transfers

Use the 'get-claimed-rewards.js' script to get your claimed rewards and transfers from your steemit account and export it to a html and a csv file.

```
node get-claimed-rewards.js schererf
```

The following files will be created:
- steemit-earnings.js-schererf.html
- steemit-earnings.js-schererf.csv
- steemit-earnings-schererf-cointracking.csv

#### HTML

The HTML file contains a formatted table that includes all rewards and transfer of the specified account.

#### CSV

The CSV file contains a list of all rewards and transfer of the specified account. This file provides a optimal basis for further processing with a spreadsheet software like Excel.

#### COINTRACKING CSV

The CSV file contains a list of all rewards and transfer of the specified account. You can use this file to import your steem transactions to CoinTracking (https://cointracking.info/import/import_csv/).

## Offline HTML UI for getting claimed rewards and transfers directly from your browser

Using the 'ui/steemit-earnings.html' enables you to get your steemit earnings without the installation of nodejs.

1. Open the 'ui/steemit-earnings.html' HTML file directly with the browser of your choice
2. The UI first tries to update the underlying exchange rates. The steem/mvest-values are not updated automatically because of CORS the access to 'steemd.com/api/props' is denied for the browser. 
3. Enter the steemit account name and click 'get earnings' to load the claimed_rewards and transfers of the account
4. The steemit earnings are shown directly in the browser and two csv files are created automatically for download.

## Update included exchange-rate and steem/mvests data via nodejs

A bunch of exchange-rate and steem/mvests data is already included via github sources. To update and complement the data you can use the following CLI tools.

### Update exchange-rate values using 'cryptocompare API'

```
node cli/update-exchangerates.js
```

### Update steem/mvests values using 'steemd.com/api/props'

```
node cli/update-steem-per-mvests.js
```
