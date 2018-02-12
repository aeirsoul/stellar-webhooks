// Docs at https://github.com/louischatriot/nedb

let Datastore = require('nedb');
let db = new Datastore({ filename: 'db/events.db', autoload: true });

// Insert some test data
var field = {
  type: 'account_credited',
  id: 'asdasd',
  urls: [],
  error_count: 0,
}

/*db.insert(field, function (err, newDoc) {
  console.log(newDoc);
});*/

db.find({ type: 'account_credited', id: 'asdasd' }, function(err, accs) {
  console.log(accs);
});

//TODO insertion needs verification/validation (correct length, no duplicates, correct updating)
// Things to make this successful:
// - Retries?
// - Get rid of dead links that don't respond for multiple days?
// - ??
