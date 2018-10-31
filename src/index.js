let config = require('../config');
let http = require('http');
let path = require('path');
let express = require('express');
var bodyParser = require('body-parser');
let validate = require('./validation');
let webhookStream = require('./webhooker');

let db = webhookStream.database;
db.persistence.setAutocompactionInterval(config.dbCompactInterval * 1000); //compact db every 60sec

let app = express();
app.server = http.createServer(app);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function(req, res) {
	res.sendFile(path.join(__dirname + '/ui/index.html'));
});

app.post('/register', function(req, res) {
	//Validation
	if (!req.body) {
		res.status(400);
		return res.send(
			JSON.stringify({ status: 'error', message: 'No body sent' })
		);
	}

	let badParamErr = false;
	if (!req.body.webhook_type) {
		badParamErr = true;
	} else {
		if (
			![
				'signer_created',
				'signer_removed',
				'signer_updated',
				'account_created',
				'account_removed',
				'account_debited',
				'account_credited'
			].includes(req.body.webhook_type)
		) {
			res.status(400);
			return res.send(
				JSON.stringify({
					status: 'error',
					message: 'Incompatible webhook type'
				})
			);
		}

		//Check address and webhook url
		if (!req.body.address_id || !req.body.webhook_url) {
			badParamErr = true;
		} else {
			if (!validate.isURL(req.body.webhook_url)) {
				return res.send(
					JSON.stringify({ status: 'error', message: 'Webhook URL invalid' })
				);
			}
			if (!validate.isAddress(req.body.address_id)) {
				return res.send(
					JSON.stringify({
						status: 'error',
						message: 'Stellar address invalid'
					})
				);
			}
		}

		//For the account, check asset type and asset issuer
		if (req.body.webhook_type.includes('account')) {
			if (!req.body.asset_code) {
				badParamErr = true;
			} else {
				if (req.body.asset_code !== 'XLM') {
					if (!req.body.asset_address) {
						badParamErr = true;
					} else if (!validate.isAddress(req.body.asset_address)) {
						return res.send(
							JSON.stringify({
								status: 'error',
								message: 'Asset issuer invalid'
							})
						);
					}
				}

				if (!validate.isAsset(req.body.asset_code)) {
					return res.send(
						JSON.stringify({ status: 'error', message: 'Asset code invalid' })
					);
				}
			}
		}
	}

	//Generic if params aren't sent
	if (badParamErr) {
		res.status(400);
		return res.send(
			JSON.stringify({ status: 'error', message: 'Incorrect parameters sent' })
		);
	}

	//Notes: Since nedb doesnt allow uniqueness on array of objects
	//Do two transactions:
	// First check if object exists - if it does - dont upsert
	// else if it doesnt, upsert which will either create the record or update existing

	//Upsert webhook into database
	db.findOne(
		{
			type: req.body.webhook_type,
			address: req.body.address_id,
			asset_code: req.body.asset_code,
			asset_issuer: req.body.asset_address,
			'urls.url': req.body.webhook_url
		},
		function (err, doc) {
			if (!err) {
				if (!doc) {
					db.update(
						{
							type: req.body.webhook_type,
							address: req.body.address_id,
							asset_code: req.body.asset_code,
							asset_issuer: req.body.asset_address
						},
						{
							$push: {
								urls: {
									url: req.body.webhook_url,
									error_count: 0
								}
							}
						},
						{
							upsert: true
						},
						function (err, count, doc, upsert) {
							if (!err) {
								console.log('update', upsert);
								return res.send(
									JSON.stringify({
										status: 'success',
										message: 'Webhook successfully added'
									})
								);
							} else {
								console.error('Database error. Cannot process upsert request.');
								res.status(500);
								return res.send(
									JSON.stringify({
										status: 'error',
										message: 'Database error. Please try again later'
									})
								);
							}
						}
					);
				} else {
					return res.send(
						JSON.stringify({
							status: 'warning',
							message: 'Webhook already exists'
						})
					);
				}
			} else {
				console.error('Database error. Cannot process find request.');
				res.status(500);
				return res.send(
					JSON.stringify({
						status: 'error',
						message: 'Database error. Please try again later'
					})
				);
			}
		}
	);
});

app.server.listen(3001, () => {
	console.log('Server started on port ' + app.server.address().port);

	//Run stream
	webhookStream.runWebhookStream();
});
