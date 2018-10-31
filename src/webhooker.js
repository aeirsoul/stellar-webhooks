let config = require('../config');
let StellarSdk = require('stellar-sdk');
let Datastore = require('nedb');
let path = require('path');
let request = require('requestretry');

let stellarApi = config.isTestNet
	? 'https://horizon-testnet.stellar.org'
	: 'https://horizon.stellar.org/';
let server = new StellarSdk.Server(stellarApi);
let db = new Datastore({
	filename: path.join(__dirname + `/db/${config.dbFileName}`),
	autoload: true
});

let sendPayload = function(
	url,
	fallback,
	acc_id,
	type,
	op_href,
	op_title,
	op_value,
	ts
) {
	request(
		{
			method: 'POST',
			uri: url,
			maxAttempts: config.retryAttempts,
			retryDelay: config.retryDelay,
			//retryStrategy: request.RetryStrategies.HTTPOrNetworkError
			headers: {
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				attachments: [
					{
						fallback: fallback,
						color: '#08b5e5',
						author_name: acc_id,
						author_link: stellarApi + '/accounts/' + acc_id,
						title: type,
						title_link: op_href,
						fields: [
							{
								title: op_title,
								value: op_value,
								short: false
							}
						],
						thumb_url:
							'https://www.stellar.org/wp-content/themes/stellar/images/stellar-rocket-300.png',
						footer: 'Stellar Webhooks',
						footer_icon:
							'https://www.stellar.org/wp-content/themes/stellar/images/stellar-rocket-300.png',
						ts: ts
					}
				]
			})
		},
		function(err, res, body) {
			//function only called on success, after maxAttempts or on error
			if (!err && res.statusCode == 200) {
				//TODO Delivered! Reset error and retry counts
				console.log('Delivered');
			} else {
				//TODO Not delivered - increase error count once all retries are done?
				console.error('Issue sending payload! ' + err, body);
			}
		}
	);
};

let openHandler = function(res) {
	console.log('Connection opened ' + res);
};

let errorHandler = function(err) {
	//console.log(err);
};

let messageHandler = function(res) {
	//console.log(res);
	//interpret type of event - perform lookup for registered clients - deliver payload
	if (res.type.includes('account') || res.type.includes('signer')) {
		let timestamp = Date.now() / 1000;
		let asset_code = 'XLM';
		if (res.asset_type && res.asset_type !== 'native') {
			asset_code = res.asset_code;
		}

		//lookup event type and account id
		db.find({ type: res.type, address: res.account }, function(err, accs) {
			if (!err) {
				//send payload to registered urls
				for (let i = 0; i < accs.length; i++) {
					let acc = accs[i];
					for (let j = 0; j < acc.urls.length; j++) {
						let url = acc.urls[j];
						//send payload depending on type
						if (res.type === 'account_credited') {
							//TODO check correct asset code/issuer
							sendPayload(
								url.url,
								res.account + ' credited with ' + res.amount + ' ' + asset_code,
								res.account,
								'Account Credited',
								res._links.operation.href,
								'Amount',
								'+' + res.amount + ' ' + asset_code,
								timestamp
							);
						} else if (res.type === 'account_debited') {
							//TODO check correct asset code/issuer
							sendPayload(
								url.url,
								res.amount + ' ' + asset_code + ' debited from ' + res.account,
								res.account,
								'Account Debited',
								res._links.operation.href,
								'Amount',
								'-' + res.amount + ' ' + asset_code,
								timestamp
							);
						} else if (res.type === 'account_created') {
							sendPayload(
								url.url,
								res.account + ' created with ' + res.starting_balance,
								res.account,
								'Account Created',
								res._links.operation.href,
								'Balance',
								res.starting_balance + ' ' + asset_code,
								timestamp
							);
						} else if (res.type === 'account_removed') {
							sendPayload(
								url.url,
								res.account + ' Account Removed',
								res.account,
								'Account Removed',
								res._links.operation.href,
								'',
								'',
								timestamp
							);
						} else if (res.type === 'signer_created') {
							sendPayload(
								url.url,
								'Signer created on ' + res.account,
								res.account,
								'Signer Created',
								res._links.operation.href,
								'Weight',
								res.weight,
								timestamp
							);
						} else if (res.type === 'signer_removed') {
							sendPayload(
								url.url,
								'Signer removed on ' + res.account,
								res.account,
								'Signer Removed',
								res._links.operation.href,
								'',
								'',
								timestamp
							);
						} else if (res.type === 'signer_updated') {
							sendPayload(
								url.url,
								'Signer updated on ' + res.account,
								res.account,
								'Signer Updated',
								res._links.operation.href,
								'Weight',
								res.weight,
								timestamp
							);
						}
					}
				}
			} else {
				console.error('There was a database error!');
			}
		});
	}

	//else if(res.type.includes('trustline')) {
	//  console.log("TODO -")
	//}
};

exports.runWebhookStream = function() {
	server
		.effects()
		.cursor('now')
		.stream({
			onmessage: messageHandler,
			onerror: errorHandler,
			onopen: openHandler
		});
};

exports.database = db;
