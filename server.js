let http = require('http');
let path = require('path');
let express = require('express');
var bodyParser = require('body-parser');
let Datastore = require('nedb');
let db = new Datastore({ filename: 'db/events.db', autoload: true });

let app = express();
app.server = http.createServer(app);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname+'/index.html'));
});

app.post('/register', function(req, res) {
  //TODO: Some validation

  //TODO run update if already exists
  var field = {
    type: req.body.webhook_type,
    id: req.body.address_id,
    urls: [
      {
        url: req.body.webhook_url,
        err_count: 0
      }
    ],
  };

  db.insert(field, function (err, newDoc) {
    console.log(newDoc);
  });

  res.send("Webhook added");
});

app.server.listen(3001, () => {
  console.log("Server started on port "+app.server.address().port);
});
