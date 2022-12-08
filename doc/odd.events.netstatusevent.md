# NetStatusEvent

An object dispatches a NetStatusEvent when it reports its status.

## Constants

| Constant | Description |
| :--- | :--- |
| NET_STATUS | Defines the value of the type property of a netstatus event. |

## Properties

### info

| Code | Level | Meaning |
| :--- | :--- | :--- |
| "NetConnection.Call.Failed" | "error" | The NetConnection.call() method was not able to invoke the server-side method or command. |
| "NetConnection.Call.Success" | "status" | The NetConnection.call() method has invoked the server-side method or command. |
| "NetConnection.Connect.AppShutdown" | "error" | The server-side application is shutting down. |
| "NetConnection.Connect.BadGateway" | "error" |  |
| "NetConnection.Connect.Closed" | "status" | The connection was closed successfully. |
| "NetConnection.Connect.Failed" | "error" | The connection attempt failed. |
| "NetConnection.Connect.GatewayTimeout" | "status" |  |
| "NetConnection.Connect.IdleTimeout" | "status" | The server disconnected the client because the client was idle longer than the configured value for <MaxIdleTime>. |
| "NetConnection.Connect.InvalidApp" | "error" | The application name specified in the call to NetConnection.connect() is invalid. |
| "NetConnection.Connect.NetworkChange" | "status" | The SDK has detected a network change, for example, a dropped wireless connection, a successful wireless connection,or a network cable loss. |
| "NetConnection.Connect.Rejected" | "error" | The connection attempt did not have permission to access the application. |
| "NetConnection.Connect.Success" | "status" | The connection attempt succeeded. |
| "NetGroup.Connect.Closed" | "status" | The group was closed successfully. |
| "NetGroup.Connect.Failed" | "error" | The NetGroup connection attempt failed. |
| "NetGroup.Connect.Rejected" | "error" | The NetGroup is not authorized to function. |
| "NetGroup.Connect.Success" | "status" | The NetGroup is successfully constructed and authorized to function. |
| "NetGroup.LocalCoverage.Notify" | "status" | Sent when a portion of the group address space for which this node is responsible changes. |
| "NetGroup.MulticastStream.PublishNotify" | "status" | Sent when a new named stream is detected in NetGroup's Group. |
| "NetGroup.MulticastStream.UnpublishNotify" | "status" | Sent when a named stream is no longer available in the Group. |
| "NetGroup.Neighbor.Connect" | "status" | Sent when a neighbor connects to this node. |
| "NetGroup.Neighbor.Disconnect" | "status" | Sent when a neighbor disconnects from this node. |
| "NetGroup.Posting.Failed" | "error" | Sent when a new Group Posting has failed. |
| "NetGroup.Posting.Notify" | "status" | Sent when a new Group Posting is received. |
| "NetGroup.Replication.Fetch.Failed" | "error" | Sent when a fetch request for an object fails or is denied. |
| "NetGroup.Replication.Fetch.Result" | "status" | Sent when a fetch request was satisfied by a neighbor. |
| "NetGroup.Replication.Fetch.SendNotify" | "status" | Sent when the Object Replication system is about to send a request for an object to a neighbor. |
| "NetGroup.Replication.Request" | "status" | Sent when a neighbor has requested an object. |
| "NetGroup.SendTo.Failed" | "error" | Sent when a message directed to another node has failed. |
| "NetGroup.SendTo.Notify" | "status" | Sent when a message directed to this node is received. |
| "NetStream.Buffer.Empty" | "status" | The buffer is empty and the stream stops playing. |
| "NetStream.Buffer.Flush" | "status" | Data has finished streaming, and the remaining buffer is emptied. |
| "NetStream.Buffer.Full" | "status" | The buffer is full and the stream begins playing. |
| "NetStream.Failed" | "error" | An error has occurred for a reason other than those listed in other event codes. |
| "NetStream.Pause.Notify" | "status" | The stream is paused. |
| "NetStream.Play.Failed" | "error" | A playing request attempt failed. |
| "NetStream.Play.FileStructureInvalid" | "error" | The application detects an invalid file structure and will not try to play this type of file. |
| "NetStream.Play.InsufficientBW" | "warning" | The client does not have sufficient bandwidth to play the data at normal speed. |
| "NetStream.Play.NoSupportedTrackFound" | "status" | The application does not detect any supported tracks (video, audio or data) and will not try to play the file. |
| "NetStream.Play.PublishNotify" | "status" | The initial publish to a stream is sent to all subscribers. |
| "NetStream.Play.Reset" | "status" | Caused by a play list reset. |
| "NetStream.Play.Start" | "status" | The playing has started. |
| "NetStream.Play.Stop" | "status" | The playing has stopped. |
| "NetStream.Play.StreamNotFound" | "error" | The stream passed to the NetStream.play() method can't be found. |
| "NetStream.Play.Transition" | "status" | Transition to another stream as a result of bitrate stream switching has succeeded. |
| "NetStream.Play.UnpublishNotify" | "status" | An unpublish from a stream is sent to all subscribers. |
| "NetStream.Publish.BadName" | "error" | Attempt to publish a stream which is already being published by someone else. |
| "NetStream.Publish.Rejected" | "status" | The publishing attempt did not have permission. |
| "NetStream.Publish.Idle" | "status" | The publisher of the stream is idle and not transmitting data. |
| "NetStream.Publish.Start" | "status" | Publish was successful. |
| "NetStream.Record.AlreadyExists" | "status" | The stream being recorded maps to a file that is already being recorded to by another stream. |
| "NetStream.Record.Failed" | "error" | An attempt to record a stream failed. |
| "NetStream.Record.NoAccess" | "error" | Attempt to record a stream that is still playing or the client has no access right. |
| "NetStream.Record.Start" | "status" | Recording has started. |
| "NetStream.Record.Stop" | "status" | Recording stopped. |
| "NetStream.Seek.Failed" | "error" | The seek fails, which happens if the stream is not seekable. |
| "NetStream.Seek.InvalidTime" | "error" | Sent while seeking or playing past the end of the stream. |
| "NetStream.Seek.Notify" | "status" | The seek operation is complete. |
| "NetStream.Step.Notify" | "status" | The step operation is complete. |
| "NetStream.Unpause.Notify" | "status" | The stream is resumed. |
| "NetStream.Unpublish.Success" | "status" | The unpublish operation was successful. |
| "NetStream.Video.DimensionChange" | "status" | The video dimensions are available or have changed. |
