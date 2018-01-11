playease = function() {
	if (playease.api) {
		return playease.api.getInstance.apply(this, arguments);
	}
};

playease.version = '1.0.97';
