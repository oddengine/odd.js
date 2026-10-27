(function (odd) {
    var utils = odd.utils,
        RTC = odd.RTC;

    // Shared configuration rules; successful negotiation remains NetStream's
    // responsibility. Capability enumeration never opens a peer connection.
    RTC.Encodings = {
        validate: function (video, codecpreferences) {
            if (!video || typeof video !== 'object' || Array.isArray(video) ||
                !Array.isArray(codecpreferences) || codecpreferences.length > 16 ||
                codecpreferences.some(function (codec) { return typeof codec !== 'string' || codec.length > 128; })) {
                throw { name: 'TypeError', message: 'Invalid video or codec preferences.' };
            }
            if (!Array.isArray(video.encodings) ||
                (video.simulcast !== undefined && typeof video.simulcast !== 'boolean') ||
                typeof video.svc !== 'boolean') {
                throw { name: 'TypeError', message: 'Invalid video scalability configuration.' };
            }
            var simulcast = video.simulcast === undefined ? video.encodings.length > 1 : video.simulcast;
            if ((simulcast && (video.encodings.length < 2 || video.encodings.length > 3)) ||
                (!simulcast && video.encodings.length > 1) ||
                (video.svc && video.encodings.length === 0)) {
                throw { name: 'TypeError', message: 'Video encoding count conflicts with simulcast/SVC flags.' };
            }
            if (video.svc && !codecpreferences.some(function (codec) {
                return codec.toLowerCase() === 'video/av1';
            })) {
                throw { name: 'NotSupportedError', message: 'SVC requires an explicit video/AV1 codec preference.' };
            }
            var rids = [];
            return video.encodings.map(function (value) {
                var encoding = utils.extendz({}, value);
                if ((simulcast && (!encoding.rid || !/^[a-zA-Z0-9]{1,16}$/.test(encoding.rid))) ||
                    (encoding.rid && rids.indexOf(encoding.rid) !== -1) ||
                    !Number.isFinite(encoding.maxBitrate) || encoding.maxBitrate <= 0) {
                    throw { name: 'TypeError', message: 'Video encodings require unique RIDs for simulcast and positive bitrate limits.' };
                }
                rids.push(encoding.rid);
                if (video.svc) {
                    // AV1 full spatial/temporal modes. Independent S modes,
                    // half-resolution and key-shift variants are not implemented.
                    if (!/^L(?:1T[1-3]|[23]T[1-3](?:_KEY)?)$/.test(encoding.scalabilityMode || '')) {
                        throw { name: 'NotSupportedError', message: 'Unsupported AV1 scalabilityMode.' };
                    }
                } else {
                    if (encoding.scalabilityMode && encoding.scalabilityMode !== 'L1T1') {
                        throw { name: 'TypeError', message: 'A layered scalabilityMode requires video.svc=true.' };
                    }
                    delete encoding.scalabilityMode;
                }
                return encoding;
            });
        },

        describe: function () {
            var result = { available: false, codecs: [], modes: [] };
            for (var spatial = 1; spatial <= 3; spatial++) {
                for (var temporal = 1; temporal <= 3; temporal++) {
                    var mode = 'L' + spatial + 'T' + temporal;
                    result.modes.push(mode);
                    if (spatial > 1) { result.modes.push(mode + '_KEY'); }
                }
            }
            if (typeof RTCRtpSender === 'undefined' || typeof RTCRtpSender.getCapabilities !== 'function' ||
                typeof RTCPeerConnection === 'undefined' || !RTCPeerConnection.prototype.addTransceiver) {
                return result;
            }
            try {
                var capabilities = RTCRtpSender.getCapabilities('video');
                if (!capabilities || !Array.isArray(capabilities.codecs)) { return result; }
                ['video/H264', 'video/H265', 'video/AV1'].forEach(function (mimeType) {
                    if (capabilities.codecs.some(function (codec) { return codec.mimeType.toLowerCase() === mimeType.toLowerCase(); })) {
                        result.codecs.push(mimeType);
                    }
                });
                result.available = true;
            } catch (error) {
                result.error = { name: error.name, message: error.message };
            }
            return result;
        },

        preset: function (profile, simulcast, svc, mode) {
            var constraints = RTC.Constraints[profile];
            if (!constraints || typeof simulcast !== 'boolean' || typeof svc !== 'boolean') {
                throw { name: 'TypeError', message: 'Invalid encoding preset.' };
            }
            var video = constraints.video, bitrate = video.maxBitrate * 1000;
            var encodings = simulcast ? [
                { rid: 'high', scaleResolutionDownBy: 1, maxBitrate: bitrate, maxFramerate: video.frameRate },
                { rid: 'medium', scaleResolutionDownBy: 2, maxBitrate: Math.max(1, Math.round(bitrate / 3)), maxFramerate: video.frameRate },
                { rid: 'low', scaleResolutionDownBy: 4, maxBitrate: Math.max(1, Math.round(bitrate / 8)), maxFramerate: Math.min(15, video.frameRate) },
            ] : svc ? [{ maxBitrate: bitrate }] : [];
            if (svc) {
                encodings.forEach(function (encoding) { encoding.scalabilityMode = mode; });
            }
            var result = { simulcast: simulcast, svc: svc, encodings: encodings };
            RTC.Encodings.validate(result, svc ? ['audio/opus', 'video/AV1'] : ['audio/opus', 'video/H264']);
            return result;
        },
    };
})(odd);
