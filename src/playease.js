playease = function () {
    if (playease.API) {
        return playease.API.get.apply(this, arguments);
    }
};

playease.VERSION = '2.1.62';
playease.DEBUG = false;
playease.LOGGER = false;

