(function(playease) {
	playease.events = {
		// General Events
		ERROR: 'error',
		
		// API Events
		PLAYEASE_READY: 'playeaseReady',
		PLAYEASE_SETUP_ERROR: 'playeaseSetupError',
		PLAYEASE_RENDER_ERROR: 'playeaseRenderError',
		
		PLAYEASE_STATE: 'playeaseState',
		PLAYEASE_METADATA: 'playeaseMetaData',
		
		PLAYEASE_BUFFER: 'playeaseBuffer',
		PLAYEASE_PLAY: 'playeasePlay',
		PLAYEASE_PAUSE: 'playeasePause',
		PLAYEASE_SEEK: 'playeaseSeek',
		PLAYEASE_STOP: 'playeaseStop',
		
		// View Events
		PLAYEASE_VIEW_PLAY: 'playeaseViewPlay',
		PLAYEASE_VIEW_PAUSE: 'playeaseViewPause',
		PLAYEASE_VIEW_SEEK: 'playeaseViewSeek',
		PLAYEASE_VIEW_STOP: 'playeaseViewStop',
		PLAYEASE_VIEW_VOLUME: 'playeaseViewVolume',
		PLAYEASE_VIEW_FULLSCREEN: 'playeaseViewFullscreen',
		
		// Loader Events
		PLAYEASE_CONTENT_LENGTH: 'playeaseContentLength',
		PLAYEASE_PROGRESS: 'playeaseProgress',
		PLAYEASE_COMPLETE: 'playeaseComplete',
		
		// Muxer Events
		PLAYEASE_FLV_TAG: 'playeaseFlvTag',
		PLAYEASE_AVC_CONFIG_RECORD: 'playeaseAVCConfigRecord',
		PLAYEASE_AVC_SAMPLE: 'playeaseAVCSample',
		PLAYEASE_AAC_SAMPLE: 'playeaseAACSample',
		PLAYEASE_MP4_SEGMENT: 'playeaseMp4Segment',
		PLAYEASE_END_OF_STREAM: 'playeaseEndOfStream'
	};
})(playease);
