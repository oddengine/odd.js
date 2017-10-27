(function(playease) {
	var utils = playease.utils,
		crypt = utils.crypt,
		events = playease.events,
		CommandEvent = events.CommandEvent,
		NetStatusEvent = events.NetStatusEvent,
		Level = NetStatusEvent.Level,
		Code = NetStatusEvent.Code,
		AudioEvent = events.AudioEvent,
		VideoEvent = events.VideoEvent,
		DataEvent = events.DataEvent,
		AMF = playease.muxer.AMF,
		net = playease.net,
		rtmp = net.rtmp,
		CSIDs = rtmp.chunk.CSIDs,
		States = rtmp.chunk.States,
		Types = rtmp.message.Types,
		EventTypes = rtmp.usercontrolmessage.UserControlEvent.Types,
		LimitTypes = rtmp.bandwidthmessage.LimitTypes,
		Commands = rtmp.commandmessage.Commands;
	
	rtmp.netconnection = function() {
		var _this = utils.extend(this, new events.eventdispatcher('rtmp.netconnection')),
			_shaker,
			_connected,
			_websocket,
			_url,
			_protocol,
			_appName,
			_instName,
			_args,
			_objectEncoding,
			_farChunkSize,
			_nearChunkSize,
			_farAckWindowSize,
			_nearAckWindowSize,
			_farBandwidth,
			_neerBandwidth,
			_farLimitType,
			_neerLimitType,
			_stats,
			_chunks,
			_responders,
			_transactionId;
		
		function _init() {
			_connected = false;
			_args = [];
			
			_objectEncoding = rtmp.ObjectEncoding.AMF0;
			
			_farChunkSize = 128;
			_nearChunkSize = 128;
			_farAckWindowSize = 2500000;
			_neerBandwidth = 2500000;
			_neerLimitType = LimitTypes.DYNAMIC;
			
			_stats = {
				bytesIn: 0,
				bytesOut: 0
			};
			
			_chunks = [];
			_responders = {};
			_transactionId = 0;
		}
		
		_this.connect = function(url) {
			_url = url;
			_args = Array.prototype.slice.call(arguments, 1);
			
			if (_url === undefined || _url === null) {
				// TODO: Data Generation Mode
				return;
			}
			
			try {
				window.WebSocket = window.WebSocket || window.MozWebSocket;
				_websocket = new WebSocket(_url);
				_websocket.binaryType = 'arraybuffer';
			} catch (err) {
				utils.log('Failed to initialize websocket: ' + err);
				return;
			}
			
			_websocket.onopen = _onOpen;
		};
		
		function _onOpen(e) {
			_shaker = new rtmp.handshaker(_websocket);
			_shaker.addEventListener(events.PLAYEASE_COMPLETE, _onHandshakeComplete);
			_shaker.addEventListener(events.ERROR, _onHandshakeError);
			_shaker.shake(false);
		}
		
		function _onHandshakeComplete(e) {
			_websocket.onmessage = _onMessage;
			_websocket.onerror = _onIOError;
			_websocket.onclose = _onClose;
			
			_this.addEventListener(CommandEvent.CLOSE, _onClose);
			_this.addEventListener(CommandEvent.RESULT, _onResult);
			_this.addEventListener(CommandEvent.ERROR, _onError);
			_this.addEventListener(CommandEvent.CHECK_BANDWIDTH, _onCheckBandwidth);
			_this.addEventListener(CommandEvent.GET_STATS, _onGetStats);
			
			_this.call(Commands.CONNECT, new rtmp.responder(_onConnect, null), {
				Type: AMF.types.OBJECT,
				Data: [{
					Type: AMF.types.STRING,
					Key: 'app',
					Data: 'live'
				}, {
					Type: AMF.types.STRING,
					Key: 'flashVer',
					Data: 'WIN 27,0,0,130'
				}, {
					Type: AMF.types.STRING,
					Key: 'swfUrl',
					Data: 'http://studease.cn/swf/playease.swf'
				}, {
					Type: AMF.types.STRING,
					Key: 'tcUrl',
					Data: 'rtmp://rtmpmate.com/live'
				}, {
					Type: AMF.types.BOOLEAN,
					Key: 'fpad',
					Data: false
				}, {
					Type: AMF.types.DOUBLE,
					Key: 'capabilities',
					Data: 239
				}, {
					Type: AMF.types.DOUBLE,
					Key: 'audioCodecs',
					Data: 3575
				}, {
					Type: AMF.types.DOUBLE,
					Key: 'videoCodecs',
					Data: 252
				}, {
					Type: AMF.types.DOUBLE,
					Key: 'videoFunction',
					Data: 1
				}, {
					Type: AMF.types.STRING,
					Key: 'pageUrl',
					Data: 'http://studease.cn/playease.html'
				}, {
					Type: AMF.types.DOUBLE,
					Key: 'objectEncoding',
					Data: _objectEncoding
				}],
				Ended: true
			});
		}
		
		function _onHandshakeError(e) {
			_this.close();
		}
		
		_this.writeByChunk = function(b, h) {
			if (h.Length < 2) {
				throw 'chunk data (len=' + h.Length + ') not enough.';
			}
			
			var c = new rtmp.chunk();
			c.Fmt = h.Fmt;
			
			for (var i = 0; i < h.Length; /* void */) {
				if (h.CSID <= 63) {
					c.Data.WriteByte((c.Fmt << 6) | h.CSID);
				} else if (h.CSID <= 319) {
					c.Data.WriteByte((c.Fmt << 6) | 0x00);
					c.Data.WriteByte(h.CSID - 64);
				} else if (h.CSID <= 65599) {
					c.Data.WriteByte((c.Fmt << 6) | 0x01);
					c.Data.WriteUint16(h.CSID, true);
				} else {
					throw 'chunk size (' + h.Length + ') out of range.';
				}
				
				if (c.Fmt <= 2) {
					if (h.Timestamp >= 0xFFFFFF) {
						c.Data.Write([0xFF, 0xFF, 0xFF]);
					} else {
						c.Data.Write([
							h.Timestamp>>16 & 0xFF,
							h.Timestamp>>8 & 0xFF,
							h.Timestamp>>0 & 0xFF
						]);
					}
				}
				if (c.Fmt <= 1) {
					c.Data.Write([
						h.Length>>16 & 0xFF,
						h.Length>>8 & 0xFF,
						h.Length>>0 & 0xFF,
					]);
					c.Data.WriteByte(h.Type);
				}
				if (c.Fmt == 0) {
					c.Data.WriteUint32(h.StreamID, true);
				}
				
				// Extended Timestamp
				if (h.Timestamp >= 0xFFFFFF) {
					c.Data.WriteUint32(h.Timestamp, false);
				}
				
				// Chunk Data
				var n = Math.min(h.Length - i, _nearChunkSize);
				c.Data.Write(new Uint8Array(b, i, n));
				
				//fmt.Println(c.Data.Bytes())
				
				i += n;
				
				if (i < h.Length) {
					switch (h.Type) {
					default:
						c.Fmt = 3;
					}
				} else if (i == h.Length) {
					var cs = c.Data.Bytes();
					_this.write(cs);
					
					_stats.bytesOut += c.Data.Len();
					
					/*size := len(cs)
					for x := 0; x < size; x += 16 {
						utils.log("\n")
						
						for y := 0; y < int(math.Min(float64(size-x), 16)); y++ {
							utils.log("%02x ", cs[x+y])
							
							if y == 7 {
								utils.log(" ")
							}
						}
					}*/
				} else {
					throw 'wrote too much';
				}
			}
			
			return h.Length;
		}
		
		function _onMessage(e) {
			var b = new Uint8Array(e.data);
			var size = b.byteLength;
			_parseChunk(b, size);
		}
		
		function _parseChunk(b, size) {
			var c = _getUncompleteChunk();
			
			for (var i = 0; i < size; i++) {
				//utils.log('b[' + i + '] = ' + b[i]);
				
				switch (c.State) {
				case States.START:
					c.CurrentFmt = (b[i] >> 6) & 0xFF;
					c.CSID = b[i] & 0x3F;
					
					if (c.Polluted == false) {
						c.Fmt = c.CurrentFmt;
						c.Polluted = true;
					}
					
					_extendsFromPrecedingChunk(c);
					if (c.CurrentFmt == 3 && c.Extended == false) {
						c.State = States.DATA;
					} else {
						c.State = States.FMT;
					}
					break;
					
				case States.FMT:
					switch (c.CSID) {
					case 0:
						c.CSID = b[i] + 64;
						c.State = States.CSID_1;
						break;
					case 1:
						c.CSID = b[i];
						c.State = States.CSID_0;
						break;
					default:
						if (c.CurrentFmt == 3) {
							if (c.Extended) {
								c.Timestamp = b[i] << 24;
								c.State = States.EXTENDED_TIMESTAMP_0;
							} else {
								throw 'Failed to parse chunk: [1].';
							}
						} else {
							c.Timestamp = b[i] << 16;
							c.State = States.TIMESTAMP_0;
						}
					}
					break;
					
				case States.CSID_0:
					c.CSID |= b[i] << 8;
					c.CSID += 64;
					
					if (c.CurrentFmt == 3 && c.Extended == false) {
						c.State = States.DATA;
					} else {
						c.State = States.CSID_1;
					}
					break;
					
				case States.CSID_1:
					if (c.CurrentFmt == 3) {
						if (c.Extended) {
							c.Timestamp = b[i] << 24
							c.State = States.EXTENDED_TIMESTAMP_0
						} else {
							throw 'Failed to parse chunk: [2].';
						}
					} else {
						c.Timestamp = b[i] << 16;
						c.State = States.TIMESTAMP_0;
					}
					break;
					
				case States.TIMESTAMP_0:
					c.Timestamp |= b[i] << 8;
					c.State = States.TIMESTAMP_1;
					break;
					
				case States.TIMESTAMP_1:
					c.Timestamp |= b[i];
					
					if (c.CurrentFmt == 2 && c.Timestamp != 0xFFFFFF) {
						c.State = States.DATA;
					} else {
						c.State = States.TIMESTAMP_2;
					}
					break;
					
				case States.TIMESTAMP_2:
					if (c.CurrentFmt == 0 || c.CurrentFmt == 1) {
						c.MessageLength = b[i] << 16;
						c.State = States.MESSAGE_LENGTH_0;
					} else if (c.CurrentFmt == 2) {
						if (c.Timestamp == 0xFFFFFF) {
							c.Timestamp = b[i] << 24;
							c.State = States.EXTENDED_TIMESTAMP_0;
						} else {
							throw 'Failed to parse chunk: [3].';
						}
					} else {
						throw 'Failed to parse chunk: [4].';
					}
					break;
					
				case States.MESSAGE_LENGTH_0:
					c.MessageLength |= b[i] << 8;
					c.State = States.MESSAGE_LENGTH_1;
					break;
					
				case States.MESSAGE_LENGTH_1:
					c.MessageLength |= b[i];
					c.State = States.MESSAGE_LENGTH_2;
					break;
					
				case States.MESSAGE_LENGTH_2:
					c.MessageTypeID = b[i];
					
					if (c.CurrentFmt == 1 && c.Timestamp != 0xFFFFFF) {
						c.State = States.DATA;
					} else {
						c.State = States.MESSAGE_TYPE_ID;
					}
					break;
					
				case States.MESSAGE_TYPE_ID:
					if (c.CurrentFmt == 0) {
						c.MessageStreamID = b[i];
						c.State = States.MESSAGE_STREAM_ID_0;
					} else if (c.CurrentFmt == 1) {
						if (c.Timestamp == 0xFFFFFF) {
							c.Timestamp = b[i] << 24;
							c.State = States.EXTENDED_TIMESTAMP_0;
						} else {
							throw 'Failed to parse chunk: [5].';
						}
					} else {
						throw 'Failed to parse chunk: [6].';
					}
					break;
					
				case States.MESSAGE_STREAM_ID_0:
					c.MessageStreamID |= b[i] << 8;
					c.State = States.MESSAGE_STREAM_ID_1;
					break;
					
				case States.MESSAGE_STREAM_ID_1:
					c.MessageStreamID |= b[i] << 16;
					c.State = States.MESSAGE_STREAM_ID_2;
					break;
					
				case States.MESSAGE_STREAM_ID_2:
					c.MessageStreamID |= b[i] << 24;
					if (c.Timestamp == 0xFFFFFF) {
						c.State = States.MESSAGE_STREAM_ID_3;
					} else {
						c.State = States.DATA;
					}
					break;
					
				case States.MESSAGE_STREAM_ID_3:
					if (c.Timestamp == 0xFFFFFF) {
						c.Timestamp = b[i] << 24;
						c.State = States.EXTENDED_TIMESTAMP_0;
					} else {
						throw 'Failed to parse chunk: [7].';
					}
					break;
					
				case States.EXTENDED_TIMESTAMP_0:
					c.Timestamp |= b[i] << 16;
					c.State = States.EXTENDED_TIMESTAMP_1;
					break;
					
				case States.EXTENDED_TIMESTAMP_1:
					c.Timestamp |= b[i] << 8;
					c.State = States.EXTENDED_TIMESTAMP_2;
					break;
					
				case States.EXTENDED_TIMESTAMP_2:
					c.Timestamp |= b[i];
					c.State = States.EXTENDED_TIMESTAMP_3;
					break;
					
				case States.EXTENDED_TIMESTAMP_3:
					c.State = States.DATA;
				case States.DATA:
					var n = c.MessageLength - c.Data.Len();
					if (n > size - i) {
						n = size - i;
					}
					if (n > _farChunkSize - c.Loaded) {
						n = _farChunkSize - c.Loaded;
						c.Loaded = 0;
						c.State = States.START;
					} else {
						c.Loaded += n;
					}
					
					c.Data.Write(new Uint8Array(b.buffer, i, n));
					i += n - 1;
					
					if (c.Data.Len() < c.MessageLength) {
						//c.State = States.DATA;
					} else if (c.Data.Len() == c.MessageLength) {
						c.State = States.COMPLETE;
						
						_parseMessage(c);
						
						if (i < size - 1) {
							c = _getUncompleteChunk();
						}
					} else {
						throw 'Failed to parse chunk: [8].';
					}
					break;
					
				default:
					throw 'Failed to parse chunk: [9].';
				}
			}
		}
		
		function _parseMessage(c) {
			if (c.MessageTypeID != 0x03 && c.MessageTypeID != 0x08 && c.MessageTypeID != 0x09) {
				//utils.log('onMessage: ' + c.MessageTypeID);
			}
			
			var ab = c.Data.Bytes();
			var size = c.Data.Len();
			
			switch (c.MessageTypeID) {
			case Types.SET_CHUNK_SIZE:
				var dv = new DataView(ab);
				_farChunkSize = dv.getUint32(0, false) & 0x7FFFFFFF;
				utils.log('Set farChunkSize: ' + _farChunkSize);
				break;
				
			case Types.ABORT:
				var dv = new DataView(ab);
				var csid = dv.getUint32(0, false);
				utils.log('Abort chunk stream: ' + csid);
				
				if (_chunks.length) {
					var c = _chunks[_chunks.length - 1];
					if (c.State != States.COMPLETE && c.CSID == csid) {
						_chunks.pop();
						utils.log('Removed uncomplete chunk ' + csid);
					}
				}
				break;
				
			case Types.ACK:
				var dv = new DataView(ab);
				var sequenceNumber = dv.getUint32(0, false);
				//utils.log('Sequence Number: ' + sequenceNumber + ', Bytes out: ' + _stats.bytesOut);
				
				if (sequenceNumber != _stats.bytesOut) {
					
				}
				break;
				
			case Types.USER_CONTROL:
				var m = new rtmp.usercontrolmessage();
				m.Fmt = c.Fmt;
				m.CSID = c.CSID;
				m.Timestamp = c.Timestamp;
				m.StreamID = c.MessageStreamID;
				
				m.Parse(ab, 0, size);
				
				_onUserControl(m);
				break;
				
			case Types.ACK_WINDOW_SIZE:
				var dv = new DataView(ab);
				_farAckWindowSize = dv.getUint32(0, false);
				utils.log('Set farAckWindowSize to ' + _farAckWindowSize);
				break;
				
			case Types.BANDWIDTH:
				var m = new rtmp.bandwidthmessage();
				m.Fmt = c.Fmt;
				m.CSID = c.CSID;
				m.Timestamp = c.Timestamp;
				m.StreamID = c.MessageStreamID;
				
				m.Parse(ab, 0, size);
				
				_onBandwidth(m);
				break;
				
			case Types.EDGE:
				// TODO:
				
			case Types.AUDIO:
				var m = new rtmp.audiomessage();
				m.Fmt = c.Fmt;
				m.CSID = c.CSID;
				m.Timestamp = c.Timestamp;
				m.StreamID = c.MessageStreamID;
				
				m.Parse(ab, 0, size);
				
				_this.dispatchEvent(AudioEvent.DATA, { Message: m });
				break;
				
			case Types.VIDEO:
				var m = new rtmp.videoMessage();
				m.Fmt = c.Fmt;
				m.CSID = c.CSID;
				m.Timestamp = c.Timestamp;
				m.StreamID = c.MessageStreamID;
				
				m.Parse(ab, 0, size);
				
				_this.dispatchEvent(VideoEvent.DATA, { Message: m });
				break;
				
			case Types.AMF3_DATA:
			case Types.DATA:
				var m = new rtmp.datamessage(_objectEncoding);
				m.Fmt = c.Fmt;
				m.CSID = c.CSID;
				m.Timestamp = c.Timestamp;
				m.StreamID = c.MessageStreamID;
				
				m.Parse(ab, 0, size);
				
				_this.dispatchEvent(m.Handler, { Message: m });
				break;
				
			case Types.AMF3_SHARED_OBJECT:
			case Types.SHARED_OBJECT:
				// TODO:
				break;
				
			case Types.AMF3_COMMAND:
				ab = new Uint8Array(b, 1).buffer;
			case Types.COMMAND:
				var m = new rtmp.commandmessage(_objectEncoding);
				m.Fmt = c.Fmt;
				m.CSID = c.CSID;
				m.Timestamp = c.Timestamp;
				m.StreamID = c.MessageStreamID;
				
				m.Parse(ab, 0, size);
				
				if (m.CommandObject) {
					var v = m.CommandObject.Hash['objectEncoding'];
					if (v && v.Data != 0) {
						_objectEncoding = rtmp.ObjectEncoding.AMF3;
						m.Type = Types.AMF3_COMMAND;
					}
				}
				
				_onCommand(m);
				break;
				
			case Types.AGGREGATE:
				var m = new rtmp.aggregatemessage();
				m.Fmt = c.Fmt;
				m.CSID = c.CSID;
				m.Timestamp = c.Timestamp;
				m.StreamID = c.MessageStreamID;
				
				m.Parse(ab, 0, size);
				
				_onAggregate(m);
				break;
				
			default:
			}
		}
		
		function _onUserControl(m) {
			//utils.log('onUserControl: type=' + m.Event.Type);
			
			switch (m.Event.Type) {
			case EventTypes.STREAM_BEGIN:
				utils.log('Stream Begin: id=' + m.Event.StreamID);
				break;
			
			case EventTypes.STREAM_EOF:
				utils.log('Stream EOF: id=' + m.Event.StreamID);
				break;
			
			case EventTypes.STREAM_DRY:
				utils.log('Stream Dry: id=' + m.Event.StreamID);
				break;
			
			case EventTypes.SET_BUFFER_LENGTH:
				utils.log('Set BufferLength: id=' + m.Event.StreamID + ', len=' + m.Event.BufferLengt + 'ms.');
				this.dispatchEvent(UserControlEvent.SET_BUFFER_LENGTH, { Message: m });
				break;
			
			case EventTypes.STREAM_IS_RECORDED:
				utils.log('Stream is Recorded: id=' + m.Event.StreamID);
				break;
			
			case EventTypes.PING_REQUEST:
				utils.log('Ping Request: timestamp=' + m.Event.Timestamp);
				break;
			
			case EventTypes.PING_RESPONSE:
				utils.log('Ping Response: timestamp=' + m.Event.Timestamp);
				break;
			
			default:
			}
		}
		
		function _onBandwidth(m) {
			_nearBandwidth = m.AckWindowSize;
			_nearLimitType = m.LimitType;
			utils.log('Set nearBandwidth to ' + _nearBandwidth + ', limitType=' + _nearLimitType);
		}
		
		function _onCommand(m) {
			//utils.log('onCommand: name=' + m.Name);
			
			if (_this.hasEventListener(m.Name)) {
				_this.dispatchEvent(m.Name, { Message: m });
			} else {
				// Should not return error, this might be an user call
				utils.log('No handler found for command \"' + m.Name + '\".');
			}
		}
		
		function _onConnect(e) {
			_connected = true;
		}
		
		function _onResult(e) {
			if (_responders.hasOwnProperty(e.Message.TransactionID)) {
				var reponder = _responders[e.Message.TransactionID];
				if (reponder.result) {
					reponder.result(e);
				}
				
				delete _responders[e.Message.TransactionID];
			}
			
			var info = {};
			utils.foreach(e.Message.Response.Hash, function(k, v) {
				info[k] = v.Data;
			});
			
			if (info.hasOwnProperty('code') == false) {
				return;
			}
			
			_this.dispatchEvent(NetStatusEvent.NET_STATUS, {
				info: info
			});
		}
		
		function _onError(e) {
			if (_responders.hasOwnProperty(e.Message.TransactionID)) {
				var reponder = _responders[e.Message.TransactionID];
				if (reponder.status) {
					reponder.status(e);
				}
				
				delete _responders[e.Message.TransactionID];
			}
			
			var info = {};
			utils.foreach(e.Message.Response.Hash, function(k, v) {
				info[k] = v.Data;
			});
			
			_this.dispatchEvent(NetStatusEvent.NET_STATUS, {
				info: info
			});
		}
		
		function _onCheckBandwidth(e) {
			
		}
		
		function _onGetStats(e) {
			
		}
		
		function _onIOError(e) {
			_this.dispatchEvent(NetStatusEvent.NET_STATUS, {
				info: {
					level: Level.ERROR,
					code: Code.NETCONNECTION_CONNECT_FAILED
				}
			});
		}
		
		function _onClose(e) {
			_this.close();
		}
		
		_this.write = function(b) {
			if (_websocket.readyState == WebSocket.OPEN) {
				_websocket.send(b);
			}
		};
		
		_this.setChunkSize = function(size) {
			var encoder = new AMF.Encoder();
			encoder.AppendInt32(size, false);
			
			var h = new rtmp.message.header();
			h.CSID = CSIDs.PROTOCOL_CONTROL;
			h.Type = Types.SET_CHUNK_SIZE;
			h.Length = encoder.Len();
			
			_this.writeByChunk(encoder.Encode(), h);
			
			_nearChunkSize = size;
			utils.log('Set nearChunkSize: ' + _nearChunkSize);
		};
		
		_this.abort = function() {
			
		};
		
		_this.sendAckSequence = function() {
			var encoder = new AMF.Encoder();
			encoder.AppendInt32(_stats.bytesIn, false);
			
			var h = new rtmp.message.header();
			h.CSID = CSIDs.PROTOCOL_CONTROL;
			h.Type = Types.ACK;
			h.Length = encoder.Len();
			
			_this.writeByChunk(encoder.Encode(), h);
		};
		
		_this.sendUserControl = function(event, streamID, bufferLength, timestamp) {
			var encoder = new AMF.Encoder();
			encoder.AppendInt16(event, false);
			if (event <= EventTypes.STREAM_IS_RECORDED) {
				encoder.AppendInt32(streamID, false);
			}
			if (event == EventTypes.SET_BUFFER_LENGTH) {
				encoder.AppendInt32(bufferLength, false);
			}
			if (event == EventTypes.PING_REQUEST || event == EventTypes.PING_RESPONSE) {
				encoder.AppendInt32(timestamp, false);
			}
			
			var m = new rtmp.usercontrolmessage();
			m.CSID = CSIDs.PROTOCOL_CONTROL;
			m.Length = encoder.Len();
			
			_this.writeByChunk(encoder.Encode(), m);
		};
		
		_this.setAckWindowSize = function(size) {
			var encoder = new AMF.Encoder();
			encoder.AppendInt32(size, false);
			
			var h = new rtmp.message.header();
			h.CSID = CSIDs.PROTOCOL_CONTROL;
			h.Type = Types.ACK_WINDOW_SIZE;
			h.Length = encoder.Len();
			
			_this.writeByChunk(encoder.Encode(), h);
			
			_nearAckWindowSize = size;
			utils.log('Set nearAckWindowSize: ' + _nearAckWindowSize);
		};
		
		_this.setPeerBandwidth = function(size, limitType) {
			var encoder = new AMF.Encoder();
			encoder.AppendInt32(size, false);
			encoder.AppendInt8(limitType);
			
			var m = new rtmp.bandwidthmessage();
			m.CSID = CSIDs.PROTOCOL_CONTROL;
			m.Length = encoder.Len();
			
			_this.writeByChunk(encoder.Encode(), m);
			
			_farBandwidth = size;
			_farLimitType = limitType;
			utils.log('Set farBandwidth to ' + _farBandwidth + ', limitType=' + _farLimitType);
		};
		
		_this.createStream = function() {
			return;
		};
		
		_this.call = function(command, responder) {
			var args = Array.prototype.slice.call(arguments, 2);
			
			var transactionId = 0;
			switch (command) {
				case Commands.CONNECT:
					_transactionId++;
					transactionId = 1;
					break;
				
				case Commands.PLAY:
				case Commands.PLAY2:
				case Commands.RECEIVE_AUDIO:
				case Commands.RECEIVE_VIDEO:
				case Commands.PUBLISH:
				case Commands.SEEK:
				case Commands.PAUSE:
					transactionId = 0;
					break;
				
				default:
					if (responder) {
						_transactionId++;
						transactionId = _transactionId;
					}
					break;
			}
			
			if (responder) {
				_responders[transactionId] = responder;
			}
			
			var encoder = new AMF.Encoder();
			encoder.EncodeString(command);
			encoder.EncodeNumber(transactionId);
			for (var i = 0; i < args.length; i++) {
				encoder.EncodeValue(args[i]);
			}
			
			var h = new rtmp.message.header();
			h.CSID = CSIDs.COMMAND;
			h.Type = Types.COMMAND;
			h.Length = encoder.Len();
			
			_this.writeByChunk(encoder.Encode(), h);
		};
		
		_this.close = function() {
			if (_websocket && (_websocket.readyState == WebSocket.CONNECTING || _websocket.readyState == WebSocket.OPEN)) {
				_websocket.close();
			}
			
			if (_connected) {
				_connected = false;
				
				_this.dispatchEvent(CommandEvent.CLOSE);
				_this.dispatchEvent(NetStatusEvent.NET_STATUS, {
					info: {
						level: Level.ERROR,
						code: Code.NETCONNECTION_CONNECT_CLOSED
					}
				});
			}
		};
		
		function _getUncompleteChunk() {
			var c;
			
			if (_chunks.length) {
				c = _chunks[_chunks.length - 1];
				if (c.State != States.COMPLETE) {
					return c;
				}
			}
			
			c = new rtmp.chunk();
			_chunks.push(c);
			
			return c;
		}
		
		function _extendsFromPrecedingChunk(c) {
			if (c.Fmt == 0) {
				return;
			}
			
			for (var i = _chunks.length - 1, checking = false; i >= 0; i--) {
				var b = _chunks[i];
				if (b.CSID != c.CSID) {
					continue;
				}
				
				if (checking == false) {
					checking = true;
					continue;
				}
				
				if (c.Fmt >= 1 && c.MessageStreamID == 0) {
					c.MessageStreamID = b.MessageStreamID;
				}
				if (c.Fmt >= 2 && c.MessageLength == 0) {
					c.MessageLength = b.MessageLength;
					c.MessageTypeID = b.MessageTypeID;
				}
				
				break;
			}
		}
		
		_this.connected = function() {
			return _connected;
		};
		
		_this.url = function() {
			return _url;
		};
		
		_this.protocol = function() {
			return _protocol;
		};
		
		function _forward(e) {
			_this.dispatchEvent(e.type, e);
		}
		
		_init();
	};
})(playease);
