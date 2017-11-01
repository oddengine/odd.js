(function(playease) {
	playease.events = {
		// General Events
		ERROR: 'error',
		RESIZE: 'resize',
		
		// API Events
		PLAYEASE_READY: 'playeaseReady',
		PLAYEASE_SETUP_ERROR: 'playeaseSetupError',
		PLAYEASE_RENDER_ERROR: 'playeaseRenderError',
		PLAYEASE_SECURITY_ERROR: 'playeaseSecurityError',
		PLAYEASE_IO_ERROR: 'playeaseIOError',
		
		PLAYEASE_STATE: 'playeaseState',
		PLAYEASE_PROPERTY: 'playeaseProperty',
		PLAYEASE_METADATA: 'playeaseMetaData',
		PLAYEASE_DURATION: 'playeaseDuration',
		
		PLAYEASE_BUFFERING: 'playeaseBuffering',
		PLAYEASE_PLAYING: 'playeasePlaying',
		PLAYEASE_PAUSED: 'playeasePaused',
		PLAYEASE_RELOADING: 'playeaseReloading',
		PLAYEASE_SEEKING: 'playeaseSeeking',
		PLAYEASE_STOPPED: 'playeaseStopped',
		PLAYEASE_REPORT: 'playeaseReport',
		PLAYEASE_MUTE: 'playeaseMute',
		PLAYEASE_VOLUME: 'playeaseVolume',
		PLAYEASE_VIDEOOFF: 'playeaseVideoOff',
		PLAYEASE_HD: 'playeaseHD',
		PLAYEASE_BULLET: 'playeaseBullet',
		PLAYEASE_FULLPAGE: 'playeaseFullpage',
		PLAYEASE_FULLSCREEN: 'playeaseFullscreen',
		
		// View Events
		PLAYEASE_VIEW_PLAY: 'playeaseViewPlay',
		PLAYEASE_VIEW_PAUSE: 'playeaseViewPause',
		PLAYEASE_VIEW_RELOAD: 'playeaseViewReload',
		PLAYEASE_VIEW_SEEK: 'playeaseViewSeek',
		PLAYEASE_VIEW_STOP: 'playeaseViewStop',
		PLAYEASE_VIEW_REPORT: 'playeaseViewReport',
		PLAYEASE_VIEW_MUTE: 'playeaseViewMute',
		PLAYEASE_VIEW_VOLUME: 'playeaseViewVolume',
		PLAYEASE_VIEW_VIDEOOFF: 'playeaseViewVideoOff',
		PLAYEASE_VIEW_HD: 'playeaseViewHD',
		PLAYEASE_VIEW_BULLET: 'playeaseViewBullet',
		PLAYEASE_VIEW_FULLPAGE: 'playeaseViewFullpage',
		PLAYEASE_VIEW_FULLSCREEN: 'playeaseViewFullscreen',
		PLAYEASE_VIEW_CLICK: 'playeaseViewClick',
		
		PLAYEASE_SLIDER_CHANGE: 'playeaseSliderChange',
		
		// Loader Events
		PLAYEASE_CONTENT_LENGTH: 'playeaseContentLength',
		PLAYEASE_PROGRESS: 'playeaseProgress',
		PLAYEASE_COMPLETE: 'playeaseComplete',
		
		// Muxer Events
		PLAYEASE_MEDIA_INFO: 'playeaseMediaInfo',
		
		PLAYEASE_FLV_TAG: 'playeaseFlvTag',
		PLAYEASE_AVC_CONFIG_RECORD: 'playeaseAVCConfigRecord',
		PLAYEASE_AVC_SAMPLE: 'playeaseAVCSample',
		PLAYEASE_AAC_SPECIFIC_CONFIG: 'playeaseAACSpecificConfig',
		PLAYEASE_AAC_SAMPLE: 'playeaseAACSample',
		
		PLAYEASE_MP4_INIT_SEGMENT: 'playeaseMp4InitSegment',
		PLAYEASE_MP4_SEGMENT: 'playeaseMp4Segment',
		
		PLAYEASE_END_OF_STREAM: 'playeaseEndOfStream',
		
		// rtmp message
		AudioEvent: {
			DATA: 'playeaseAudioData'
		},
		VideoEvent: {
			DATA: 'playeaseVideoData'
		},
		DataEvent: {
			SET_DATA_FRAME: '@setDataFrame',
			CLEAR_DATA_FRAME: '@clearDataFrame'
		},
		
		// CommandEvent
		CommandEvent: {
			CONNECT:       'connect',
			CLOSE:         'close',
			CREATE_STREAM: 'createStream',
			RESULT:        '_result',
			ERROR:         '_error',
		
			PLAY:          'play',
			PLAY2:         'play2',
			DELETE_STREAM: 'deleteStream',
			CLOSE_STREAM:  'closeStream',
			RECEIVE_AUDIO: 'receiveAudio',
			RECEIVE_VIDEO: 'receiveVideo',
			PUBLISH:       'publish',
			SEEK:          'seek',
			PAUSE:         'pause',
			ON_STATUS:     'onStatus',
		
			CHECK_BANDWIDTH: 'checkBandwidth',
			GET_STATS:       'getStats'
		},
		
		// UserControlEvent
		UserControlEvent: {
			STREAM_BEGIN:       'StreamBegin',
			STREAM_EOF:         'StreamEOF',
			STREAM_DRY:         'StreamDry',
			SET_BUFFER_LENGTH:  'SetBufferLength',
			STREAM_IS_RECORDED: 'StreamIsRecorded',
			PING_REQUEST:       'PingRequest',
			PING_RESPONSE:      'PingResponse'
		},
		
		// Net Status Events
		PLAYEASE_NET_STATUS: 'playeaseNetStatus',
		NetStatusEvent: {
			NET_STATUS: 'netStatus',
			Level: {
				ERROR:   'error',
				STATUS:  'status',
				WARNING: 'warning'
			},
			Code: {
				NETCONNECTION_CALL_FAILED:         'NetConnection.Call.Failed',
				NETCONNECTION_CONNECT_APPSHUTDOWN: 'NetConnection.Connect.AppShutdown',
				NETCONNECTION_CONNECT_CLOSED:      'NetConnection.Connect.Closed',
				NETCONNECTION_CONNECT_FAILED:      'NetConnection.Connect.Failed',
				NETCONNECTION_CONNECT_IDLETIMEOUT: 'NetConnection.Connect.IdleTimeout',
				NETCONNECTION_CONNECT_INVALIDAPP:  'NetConnection.Connect.InvalidApp',
				NETCONNECTION_CONNECT_REJECTED:    'NetConnection.Connect.Rejected',
				NETCONNECTION_CONNECT_SUCCESS:     'NetConnection.Connect.Success',
				
				NETSTREAM_BUFFER_EMPTY:              'NetStream.Buffer.Empty',
				NETSTREAM_BUFFER_FLUSH:              'NetStream.Buffer.Flush',
				NETSTREAM_BUFFER_FULL:               'NetStream.Buffer.Full',
				NETSTREAM_FAILED:                    'NetStream.Failed',
				NETSTREAM_PAUSE_NOTIFY:              'NetStream.Pause.Notify',
				NETSTREAM_PLAY_FAILED:               'NetStream.Play.Failed',
				NETSTREAM_PLAY_FILESTRUCTUREINVALID: 'NetStream.Play.FileStructureInvalid',
				NETSTREAM_PLAY_PUBLISHNOTIFY:        'NetStream.Play.PublishNotify',
				NETSTREAM_PLAY_RESET:                'NetStream.Play.Reset',
				NETSTREAM_PLAY_START:                'NetStream.Play.Start',
				NETSTREAM_PLAY_STOP:                 'NetStream.Play.Stop',
				NETSTREAM_PLAY_STREAMNOTFOUND:       'NetStream.Play.StreamNotFound',
				NETSTREAM_PLAY_UNPUBLISHNOTIFY:      'NetStream.Play.UnpublishNotify',
				NETSTREAM_PUBLISH_BADNAME:           'NetStream.Publish.BadName',
				NETSTREAM_PUBLISH_IDLE:              'NetStream.Publish.Idle',
				NETSTREAM_PUBLISH_START:             'NetStream.Publish.Start',
				NETSTREAM_RECORD_ALREADYEXISTS:      'NetStream.Record.AlreadyExists',
				NETSTREAM_RECORD_FAILED:             'NetStream.Record.Failed',
				NETSTREAM_RECORD_NOACCESS:           'NetStream.Record.NoAccess',
				NETSTREAM_RECORD_START:              'NetStream.Record.Start',
				NETSTREAM_RECORD_STOP:               'NetStream.Record.Stop',
				NETSTREAM_SEEK_FAILED:               'NetStream.Seek.Failed',
				NETSTREAM_SEEK_INVALIDTIME:          'NetStream.Seek.InvalidTime',
				NETSTREAM_SEEK_NOTIFY:               'NetStream.Seek.Notify',
				NETSTREAM_STEP_NOTIFY:               'NetStream.Step.Notify',
				NETSTREAM_UNPAUSE_NOTIFY:            'NetStream.Unpause.Notify',
				NETSTREAM_UNPUBLISH_SUCCESS:         'NetStream.Unpublish.Success',
				NETSTREAM_VIDEO_DIMENSIONCHANGE:     'NetStream.Video.DimensionChange'
			}
		},
		
		// Timer Events
		PLAYEASE_TIMER: 'playeaseTimer',
		PLAYEASE_TIMER_COMPLETE: 'playeaseTimerComplete'
	};
})(playease);
