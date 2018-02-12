let StellarSdk = require('stellar-sdk');
let stellarApi = 'https://horizon-testnet.stellar.org';
let server = new StellarSdk.Server(stellarApi);
let Datastore = require('nedb');
let db = new Datastore({ filename: 'db/events.db', autoload: true });
let request = require('requestretry');

//TODO config + replace thumbnails
let sendPayload = function (url, fallback, acc_id, type, op_href, op_title, op_value, ts) {
  request({
    method: 'POST',
    uri: url,
    maxAttempts: 5,
    retryDelay: 5000,
    //retryStrategy: request.RetryStrategies.HTTPOrNetworkError
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      "attachments": [
        {
            "fallback": fallback,
            "color": "#08b5e5",
            "author_name": acc_id,
            "author_link": stellarApi+"/accounts/"+acc_id,
            "title": type,
            "title_link": op_href,
            "fields": [
                {
                    "title": op_title,
                    "value": op_value,
                    "short": false
                }
            ],
            "image_url": "http://my-website.com/path/to/image.jpg",
            "thumb_url": "http://example.com/path/to/thumb.png",
            "footer": "Stellar Webhooks",
            "footer_icon": "https://platform.slack-edge.com/img/default_application_icon.png",
            "ts": ts
        }
      ]
    })
  }, function (err, res, body) {
    //function only called on success, after maxAttempts or on error
    if(!err && res.statusCode == 200) {
      //TODO Delivered! Reset error and retry counts
      console.log("Delivered");
    } else {
      //TODO Not delivered - increase error count once all retries are done?
      console.error("Issue sending payload! "+err)
    }
  })
}

let openHandler = function (res) {
  //console.log("Connection opened "+res);
}

let errorHandler = function(err) {
  //console.log(err);
}

let messageHandler = function (res) {
  //interpret type of event - perform lookup for registered clients - deliver payload
  if(res.type.includes('account') || res.type.includes('signer')) {
    //console.log(res);
    let timestamp = Date.now()/1000;
    let asset_code = 'XLM';
    if(res.asset_type && res.asset_type !== 'native') {
      asset_code = res.asset_code;
    }

    //lookup event type and account id
    db.find({ type: res.type, id: res.account }, function(err, accs) {
      if(!err) {
        //send payload to registered urls
        for(let i = 0; i < accs.length; i++) {
          let acc = accs[i];
          for(let j = 0; j < acc.urls.length; j++) {
            let url = acc.urls[j];
            console.log(accs.length + " "+acc.urls.length);
            //send payload depending on type
            if(res.type === 'account_credited') {
              sendPayload(url.url,
                          res.account+" credited with "+res.amount+" "+asset_code, res.account,
                          "Account Credited", res._links.operation.href,
                          "Amount", "+"+res.amount+" "+asset_code, timestamp);
            } else if (res.type === 'account_debited') {
              sendPayload(url.url,
                          res.amount+" "+asset_code+" debited from "+res.account, res.account,
                          "Account Debited", res._links.operation.href,
                          "Amount", "-"+res.amount+" "+asset_code, timestamp);
            } else if (res.type === 'account_created') {
              sendPayload(url.url,
                          res.account+" created with "+res.starting_balance, res.account,
                          "Account Created", res._links.operation.href,
                          "Balance", res.starting_balance+" "+asset_code, timestamp);
            } else if (res.type === 'account_removed') {
              sendPayload(url.url,
                          res.account+" removed", res.account,
                          "Account Removed", res._links.operation.href,
                          "", "", timestamp);
            }
          }
        }
      } else {
        console.error("There was a database error!");
      }
    });
  }

  //else if(res.type.includes('trustline')) {
  //  console.log("TODO -")
  //}
}

server.effects().cursor("now").stream({
  onmessage: messageHandler,
  onerror: errorHandler,
  onopen: openHandler
});
