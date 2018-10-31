exports.isURL = function(str) {
	var pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
		'((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|' + // domain name
		'((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
		'(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
		'(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
			'(\\#[-a-z\\d_]*)?$',
		'i'
	); // fragment locator
	return pattern.test(str);
};

exports.isAddress = function(str) {
	var pattern = new RegExp('^G[A-Z0-9]{55}$');
	return pattern.test(str);
};

exports.isAsset = function(str) {
	var pattern = new RegExp('^[a-zA-Z0-9]{1,12}$');
	return pattern.test(str);
};
