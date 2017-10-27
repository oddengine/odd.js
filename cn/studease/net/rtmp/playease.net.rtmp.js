(function(playease) {
	var net = playease.net,
		rtmp = net.rtmp = {};
	
	rtmp.ObjectEncoding = {
		AMF0: 0,
		AMF3: 3
	},
	rtmp.URLRe = /^(ws[s]?\:\/\/[a-z0-9\.\-]+\:?[0-9]*(\/[a-z0-9\.\-_]+){1,2})\/([a-z0-9\.\-_]+)\??([a-z0-9\-_%&=]*)$/i;
})(playease);
