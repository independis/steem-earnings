# steemit-earnings
Get information about your steemit earnings.

## Install the required packages of the program

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

## get claimed rewards and transfers

Use the 'get-claimed-rewards.js' script to get your claimed rewards and transfers from your steemit account and export it to a html and a csv file.

```
node get-claimed-rewards.js schererf
```

The following files will be created:
- get-claimed-rewards.js-schererf.html
- get-claimed-rewards.js-schererf.csv
