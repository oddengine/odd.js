(function(playease) {
	var net = playease.net;
	
	net.netstatus = {
		NETCONNECTION_CALL_FAILED: 'NetConnection.Call.Failed',
		NETCONNECTION_CONNECT_APPSHUTDOWN: 'NetConnection.Connect.AppShutdown',
		NETCONNECTION_CONNECT_CLOSED: 'NetConnection.Connect.Closed',
		NETCONNECTION_CONNECT_FAILED: 'NetConnection.Connect.Failed',
		NETCONNECTION_CONNECT_IDLETIMEOUT: 'NetConnection.Connect.IdleTimeout',
		NETCONNECTION_CONNECT_INVALIDAPP: 'NetConnection.Connect.InvalidApp',
		NETCONNECTION_CONNECT_REJECTED: 'NetConnection.Connect.Rejected',
		NETCONNECTION_CONNECT_SUCCESS: 'NetConnection.Connect.Success',
		
		NETSTREAM_BUFFER_EMPTY: 'NetStream.Buffer.Empty',
		NETSTREAM_BUFFER_FLUSH: 'NetStream.Buffer.Flush',
		NETSTREAM_BUFFER_FULL: 'NetStream.Buffer.Full',
		NETSTREAM_FAILED: 'NetStream.Failed',
		NETSTREAM_PAUSE_NOTIFY: 'NetStream.Pause.Notify',
		NETSTREAM_PLAY_FAILED: 'NetStream.Play.Failed',
		NETSTREAM_PLAY_FILESTRUCTUREINVALID: 'NetStream.Play.FileStructureInvalid',
		NETSTREAM_PLAY_PUBLISHNOTIFY: 'NetStream.Play.PublishNotify',
		NETSTREAM_PLAY_RESET: 'NetStream.Play.Reset',
		NETSTREAM_PLAY_START: 'NetStream.Play.Start',
		NETSTREAM_PLAY_STOP: 'NetStream.Play.Stop',
		NETSTREAM_PLAY_STREAMNOTFOUND: 'NetStream.Play.StreamNotFound',
		NETSTREAM_PLAY_UNPUBLISHNOTIFY: 'NetStream.Play.UnpublishNotify',
		NETSTREAM_PUBLISH_BADNAME: 'NetStream.Publish.BadName',
		NETSTREAM_PUBLISH_IDLE: 'NetStream.Publish.Idle',
		NETSTREAM_PUBLISH_START: 'NetStream.Publish.Start',
		NETSTREAM_RECORD_ALREADYEXISTS: 'NetStream.Record.AlreadyExists',
		NETSTREAM_RECORD_FAILED: 'NetStream.Record.Failed',
		NETSTREAM_RECORD_NOACCESS: 'NetStream.Record.NoAccess',
		NETSTREAM_RECORD_START: 'NetStream.Record.Start',
		NETSTREAM_RECORD_STOP: 'NetStream.Record.Stop',
		NETSTREAM_SEEK_FAILED: 'NetStream.Seek.Failed',
		NETSTREAM_SEEK_INVALIDTIME: 'NetStream.Seek.InvalidTime',
		NETSTREAM_SEEK_NOTIFY: 'NetStream.Seek.Notify',
		NETSTREAM_STEP_NOTIFY: 'NetStream.Step.Notify',
		NETSTREAM_UNPAUSE_NOTIFY: 'NetStream.Unpause.Notify',
		NETSTREAM_UNPUBLISH_SUCCESS: 'NetStream.Unpublish.Success',
		NETSTREAM_VIDEO_DIMENSIONCHANGE: 'NetStream.Video.DimensionChange'
	};
})(playease);
