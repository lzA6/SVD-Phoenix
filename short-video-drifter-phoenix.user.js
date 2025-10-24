// ==UserScript==
// @name         Short Video Drifter Phoenix v6.0 (天启信使·凤凰版)
// @namespace    http://tampermonkey.net/
// @version      6.2
// @description  【架构重构·性能飞跃】一个会自我引导、追求极致体验的短视频摸鱼神器。引入全新“单例UI”模式，全局唯一播放器；CSS驱动的悬浮UI与幽灵模式，性能极致流畅；修复并增强人脸识别、视频填充、窗口控制等核心功能。
// @author       Your AI Assistant (Phoenix Architect)
// @match        *://*/*
// @icon         data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48bGluZWFyR3JhZGllbnQgaWQ9ImciIGdyYWRpZW50VHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMDBBRkZGIi8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjRkYwMDdBIi8+PC9saW5lYXJHcmFkaWVudD48cGF0aCBkPSJNMzIgOEMxOC43NzggOCA4IDE4Ljc3OCA4IDMyQzggNDUuMjIyIDE4Ljc3OCA1NiAzMiA1NkM0NS4yMjIgNTYgNTYgNDUuMjIyIDU2IDMyQzU2IDE4Ljc3OCA0NS4yMjIgOCAzMiA4WiIgZmlsbD0idXJsKCNnKSIvPjxwYXRoIGQ9Ik00MS4yIDE5QzM4LjQxMyAxOSAzNi4xIDEyLjggMjkuNiAxMi44QzIzLjEgMTIuOCAyMC44IDE5IDIwLjggMTlDMTIuMSAxOSAxMS44IDI4LjQgMTEuOCAyOC40VjM1QzExLjggMzUgMTIuMSA0NC42IDIwLjggNDQuNkMyMC44IDQ0LjYgMjMuMSA1MC44IDI5LjYgNTAuOEMzNi4xIDUwLjggMzguNCA0NC42IDQxLjIgNDQuNkg0MS44VjE5SDQxLjJaTTI5LjYgNDEuOEMyNi45IDQxLjggMjYuMiAzNSAyNi4yIDM1VjI4LjRDMjYuMiAyOC44IDI2LjkgMjEuOCAyOS42IDIxLjhDMzIuMyAyMS44IDMzIDI4LjQgMzMgMjguNFYzNUMzMyAzNSAzMi4zIDQxLjggMjkuNiA0MS44WiIgZmlsbD0id2hpdGUiLz48L3N2Zz4=
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @grant        GM_notification
// @grant        window.close
// @connect      www.kuaishou.com
// @connect      www.douyin.com
// @connect      *.kwaicdn.com
// @connect      *.yximgs.com
// @connect      *.douyinvod.com
// @connect      *.bytecdn.cn
// @require      https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core@4.20.0/dist/tf-core.min.js
// @require      https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgl@4.20.0/dist/tf-backend-webgl.min.js
// @require      https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.1.0/dist/blazeface.min.js
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // --- 0. Configuration & Constants ---
    const CONFIG = {
        VERSION: '6.2',
        APP_NAME: 'Short Video Drifter Phoenix',
        KEYS: {
            GEOMETRY: 'svd_phoenix_geometry_v5',
            FAB_POS: 'svd_phoenix_fab_pos_v5',
            STATE: 'svd_phoenix_state_v5',
            HEADERS: 'svd_phoenix_headers_v5',
        },
        BROADCAST_CHANNEL_NAME: 'SVD_PHOENIX_CHANNEL_V5',
        MAX_SEEN_VIDEOS: 500, // Memory management for seen videos
        API_TARGETS: [
            { name: 'kuaishou', host: 'kuaishou.com', path: '/rest/v/feed/hot' },
            { name: 'douyin', host: 'douyin.com', path: '/aweme/v1/web/feed/' } // [FIX] Updated Douyin API path
        ]
    };

    // --- 1. Credential & Data Sniffer (Runs Everywhere) ---
    (function sniffAndCapture() {
        if (window.self !== window.top) return; // Only run sniffer in top-level frames

        const isAcquisitionTab = window.location.search.includes('svd_acquire=true');
        const channel = new BroadcastChannel(CONFIG.BROADCAST_CHANNEL_NAME);

        const captureAndBroadcast = (headersObject, platform) => {
            try {
                const existingHeaders = GM_getValue(CONFIG.KEYS.HEADERS, {});
                const capturedHeaders = {
                    'Cookie': headersObject['Cookie'] || document.cookie,
                    'User-Agent': headersObject['User-Agent'] || navigator.userAgent,
                };
                if (!capturedHeaders.Cookie || !capturedHeaders['User-Agent']) return;

                const newHeaders = { ...existingHeaders, [platform.name]: capturedHeaders };
                GM_setValue(CONFIG.KEYS.HEADERS, newHeaders);
                channel.postMessage({ type: 'HEADERS_UPDATED', payload: newHeaders });
                console.log(`[SVD Sniffer]: Captured and broadcasted credentials for ${platform.name}.`);

                if (isAcquisitionTab) {
                    GM_notification({ title: 'SVD Phoenix', text: `${platform.name} 访问凭证已成功获取！`, timeout: 3000 });
                    setTimeout(() => window.close(), 500);
                }
            } catch (e) {
                console.error(`[SVD Sniffer]: Error capturing credentials: ${e.message}`);
            }
        };

        const broadcastDouyinData = (data) => {
            try {
                if (data && data.aweme_list && data.aweme_list.length > 0) {
                    channel.postMessage({ type: 'DOUYIN_DATA_CAPTURED', payload: data });
                    console.log(`[SVD Sniffer]: Captured and broadcasted ${data.aweme_list.length} Douyin videos.`);
                }
            } catch (e) {
                console.error(`[SVD Sniffer]: Error broadcasting Douyin data: ${e.message}`);
            }
        };

        const findTarget = (url) => url ? CONFIG.API_TARGETS.find(t => url.includes(t.host) && url.includes(t.path)) : null;

        const setupSniffer = () => {
            console.log('[SVD Sniffer]: Initializing hooks for fetch and XHR...');

            // --- Fetch Hook ---
            const originalFetch = window.fetch;
            window.fetch = function(...args) {
                const url = args[0] instanceof Request ? args[0].url : args[0];
                const target = findTarget(url);
                const promise = originalFetch.apply(this, args);

                if (target) {
                    console.log(`[SVD Sniffer]: Intercepted fetch request to ${url}`);
                    const headers = new Headers(args[1]?.headers);
                    const headersAsObject = {};
                    headers.forEach((value, key) => {
                        const normalizedKey = key.split('-').map(k => k.charAt(0).toUpperCase() + k.slice(1)).join('-');
                        headersAsObject[normalizedKey] = value;
                    });
                    captureAndBroadcast(headersAsObject, target);

                    if (target.name === 'douyin') {
                        promise.then(response => {
                            if (response.ok) {
                                response.clone().json().then(broadcastDouyinData).catch(e => {});
                            }
                        });
                    }
                }
                return promise;
            };

            // --- XMLHttpRequest Hook ---
            const originalXhrOpen = window.XMLHttpRequest.prototype.open;
            const originalXhrSend = window.XMLHttpRequest.prototype.send;
            const originalXhrSetRequestHeader = window.XMLHttpRequest.prototype.setRequestHeader;

            window.XMLHttpRequest.prototype.open = function(method, url, ...rest) {
                this._svd_url = url; // Store URL on the instance
                return originalXhrOpen.apply(this, [method, url, ...rest]);
            };

            window.XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
                if (!this._svd_headers) {
                    this._svd_headers = {};
                }
                const normalizedKey = header.split('-').map(k => k.charAt(0).toUpperCase() + k.slice(1)).join('-');
                this._svd_headers[normalizedKey] = value;
                return originalXhrSetRequestHeader.apply(this, [header, value]);
            };

            window.XMLHttpRequest.prototype.send = function(...args) {
                const url = this._svd_url;
                const target = findTarget(url);

                if (target) {
                    console.log(`[SVD Sniffer]: Intercepted XHR request to ${url}`);
                    const headers = this._svd_headers || {};
                    if (!headers['User-Agent']) {
                        headers['User-Agent'] = navigator.userAgent;
                    }
                    if (!headers['Cookie']) {
                        headers['Cookie'] = document.cookie;
                    }
                    captureAndBroadcast(headers, target);

                    this.addEventListener('load', function() {
                        if (this.readyState === 4 && this.status >= 200 && this.status < 300) {
                            if (target.name === 'douyin') {
                                try {
                                    const responseData = JSON.parse(this.responseText);
                                    broadcastDouyinData(responseData);
                                } catch (e) {
                                    console.error(`[SVD Sniffer]: Error parsing XHR response for Douyin: ${e.message}`);
                                }
                            }
                        }
                    });
                }
                return originalXhrSend.apply(this, args);
            };
        };

        setupSniffer();
    })();


    // --- 2. Main App (Singleton UI Logic) ---
    if (window.self !== window.top) return;

    (function launchSingletonUI() {
        const channel = new BroadcastChannel(CONFIG.BROADCAST_CHANNEL_NAME);
        let isMaster = false;
        let masterCheckTimeout;

        const becomeMaster = () => {
            if (isMaster) return;
            isMaster = true;
            clearTimeout(masterCheckTimeout);
            console.log(`[SVD Singleton]: This tab is now the master. Launching UI.`);
            channel.addEventListener('message', (event) => {
                if (event.data.type === 'PING_MASTER') {
                    channel.postMessage({ type: 'PONG_MASTER' });
                }
            });
            startSvdApp();
        };

        // Check if a master already exists
        channel.postMessage({ type: 'PING_MASTER' });
        masterCheckTimeout = setTimeout(becomeMaster, 200); // If no one responds in 200ms, we become master

        channel.addEventListener('message', (event) => {
            if (event.data.type === 'PONG_MASTER') {
                console.log(`[SVD Singleton]: Master UI already exists in another tab. This tab will only run sniffers.`);
                clearTimeout(masterCheckTimeout);
                channel.close(); // This tab doesn't need to listen anymore
            }
        });
    })();


    function startSvdApp() {
        if (document.getElementById('svd-container')) return;
        if (!document.body) {
            setTimeout(startSvdApp, 100);
            return;
        }
        console.log(`[${CONFIG.APP_NAME}] DOM ready, launching v${CONFIG.VERSION}...`);
        new SVD_APP();
    }

    /**
     * Main application class, orchestrates all modules.
     */
    class SVD_APP {
        constructor() {
            this.state = new StateManager();
            this.logger = new Logger();
            this.ui = new UIManager(this.state, this.logger);
            this.broadcast = new BroadcastManager(this.state, this.logger);
            this.api = new APIManager(this.state, this.logger, this.ui);
            this.player = new Player(this.state, this.api, this.ui, this.logger);
            this.interaction = new InteractionManager(this.state, this.ui, this.logger);
            this.bossSensor = new BossSensor(this.state, this.ui, this.logger);

            this.init();
        }

        init() {
            this.state.load();
            this.ui.init(this.player);
            this.broadcast.init(this.player);
            this.player.init();
            this.interaction.init();
            this.bossSensor.init();
            this.logger.log('success', `天启信使·凤凰版 v${CONFIG.VERSION} 已完全启动，祝您摸鱼愉快！`);
        }
    }

    // --- 3. Modules ---

    /**
     * @class Logger
     * Handles logging to both the console and the UI.
     */
    class Logger {
        constructor() {
            this.uiContainer = null; // Will be set by UIManager
        }
        log(level, message, ...args) {
            const timestamp = new Date().toLocaleTimeString();
            const details = args.find(arg => typeof arg === 'object' && arg !== null);
            const logArgs = args.filter(arg => typeof arg !== 'object' || arg === null);
            const logFunc = console[level] || console.log;
            logFunc(`[SVD ${level.toUpperCase()}] ${message}`, ...logArgs, details || '');


            if (this.uiContainer) {
                const entry = document.createElement('div');
                entry.className = `svd-log-entry svd-log-${level}`;
                let detailsHtml = '';
                if (details) {
                    try {
                        const detailsId = `log-details-${Date.now()}-${Math.random()}`;
                        detailsHtml = `
                            <label for="${detailsId}" class="svd-log-details-toggle">查看详情</label>
                            <input type="checkbox" id="${detailsId}" class="svd-log-details-checkbox">
                            <pre class="svd-log-details-content">${JSON.stringify(details, null, 2).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
                        `;
                    } catch (e) { /* ignore circular refs */ }
                }
                entry.innerHTML = `<span class="svd-log-timestamp">[${timestamp}]</span><div class="svd-log-main"><span class="svd-log-message">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span>${detailsHtml}</div>`;
                this.uiContainer.appendChild(entry);
                // Auto-scroll
                this.uiContainer.scrollTop = this.uiContainer.scrollHeight;
            }
        }
    }

    /**
     * @class StateManager
     * Manages the application's reactive state.
     */
    class StateManager extends EventTarget {
        constructor() {
            super();
            this.state = {};
            this.defaults = {
                isMuted: true,
                volume: 0.5,
                playbackRate: 1.0,
                isFullScreen: false,
                isWindowVisible: true,
                isSettingsVisible: false,
                isDisguised: false,
                currentPlatform: 'kuaishou',
                settings: {
                    opacity: 1.0,
                    videoFit: 'cover',
                    bossKey: '`',
                    bossGesture: 'none',
                    enablePrefetch: true,
                    enableDisguise: true,
                    disguiseKey: 'Escape',
                    autoHideUI: false,
                    ghostMode: false,
                    ghostModeShowKey: 'Control',
                    autoResumeOnFocus: true,
                    bossSensor: false,
                    bossSensorFaceCount: 2,
                },
                authHeaders: {}, // Stored by platform name
            };
        }

        load() {
            const savedState = GM_getValue(CONFIG.KEYS.STATE, {});
            const savedHeaders = GM_getValue(CONFIG.KEYS.HEADERS, {});
            this.state = { ...this.defaults, ...savedState, authHeaders: savedHeaders };
            this.state.settings = { ...this.defaults.settings, ...(savedState.settings || {}) };
        }

        save() {
            const stateToSave = { ...this.state };
            delete stateToSave.authHeaders; // Don't save headers in the general state blob
            GM_setValue(CONFIG.KEYS.STATE, stateToSave);
        }

        get(key) { return this.state[key]; }

        set(key, value) {
            const oldValue = this.state[key];
            if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
                this.state[key] = value;
                this.dispatchEvent(new CustomEvent('stateChange', { detail: { key, value } }));
                this.dispatchEvent(new CustomEvent(key, { detail: value }));
                this.save();
            }
        }

        updateSetting(key, value) {
            const settings = { ...this.get('settings'), [key]: value };
            this.set('settings', settings);
        }

        reset() {
            GM_deleteValue(CONFIG.KEYS.GEOMETRY);
            GM_deleteValue(CONFIG.KEYS.FAB_POS);
            GM_deleteValue(CONFIG.KEYS.STATE);
            GM_deleteValue(CONFIG.KEYS.HEADERS);
            window.location.reload();
        }
    }

    /**
     * @class BroadcastManager
     * Handles cross-tab communication.
     */
    class BroadcastManager {
        constructor(state, logger) {
            this.state = state;
            this.logger = logger;
            this.channel = null;
        }

        init(player) {
            this.player = player;
            try {
                this.channel = new BroadcastChannel(CONFIG.BROADCAST_CHANNEL_NAME);
                this.channel.onmessage = this.handleMessage.bind(this);
                this.logger.log('info', '广播信使已建立，正在监听跨页消息。');
            } catch (e) {
                this.logger.log('error', `无法创建 BroadcastChannel: ${e.message}`);
            }
        }

        handleMessage(event) {
            const { type, payload } = event.data;
            if (type === 'HEADERS_UPDATED') {
                this.logger.log('success', '收到来自其他页面的凭证更新广播！', payload);
                this.state.set('authHeaders', payload);
            } else if (type === 'DOUYIN_DATA_CAPTURED') {
                this.logger.log('success', '收到来自嗅探器的抖音视频数据！');
                if (this.state.get('currentPlatform') === 'douyin') {
                    this.player.processDouyinData(payload);
                }
            }
        }
    }

    /**
     * @class APIManager
     * Manages fetching data from different platform APIs.
     */
    class APIManager {
        constructor(state, logger, ui) {
            this.state = state;
            this.logger = logger;
            this.ui = ui;
            this.adapters = {
                'kuaishou': {
                    name: '快手',
                    url: 'https://www.kuaishou.com/new-reco',
                    icon: 'https://p3-pc-weboff.byteimg.com/tos-cn-i-9r5gewecjs/kuaishou-logo.svg',
                    pcursor: "",
                    isFetching: false,
                    fetchFeed: async () => {
                        const headers = this.state.get('authHeaders')?.kuaishou;
                        if (!headers?.Cookie || !headers['User-Agent']) return Promise.reject(new Error('NO_HEADERS'));
                        this.logger.log('info', `[快手] 正在请求视频流, pcursor: ${this.adapters.kuaishou.pcursor || '""'}`);
                        const response = await this.request({
                            method: "POST",
                            url: "https://www.kuaishou.com/rest/v/feed/hot",
                            headers: { ...headers, "accept": "application/json", "Content-Type": "application/json" },
                            data: JSON.stringify({ pcursor: this.adapters.kuaishou.pcursor || "", count: 20 }),
                            responseType: 'json',
                        });
                        if (response.result !== 1 || !response.feeds) throw new Error(`API返回错误 (result: ${response.result}, msg: ${response.error_msg || 'N/A'})`);
                        this.adapters.kuaishou.pcursor = response.pcursor;

                        const videos = response.feeds.map(feed => {
                            const videoUrl = (
                                (Array.isArray(feed?.photo?.main_mv_urls) && (feed.photo.main_mv_urls.find(v => v.quality === 'hd') || feed.photo.main_mv_urls[0])?.url) ||
                                (Array.isArray(feed?.photo?.photoH265Urls) && feed.photo.photoH265Urls[0]?.url) ||
                                (Array.isArray(feed?.photo?.photoUrls) && feed.photo.photoUrls[0]?.url) ||
                                feed?.video?.url ||
                                feed?.photo?.videoUrl
                            );

                            const id = feed?.photo?.id || feed?.id;
                            if (!id || !videoUrl) {
                                this.logger.log('warn', `[快手] 过滤了一个无效的 feed 项目 (可能为广告或非视频内容)`, { item: feed });
                                return null;
                            }

                            return {
                                id,
                                author: feed?.author?.name || feed?.user?.name || '未知作者',
                                desc: feed?.photo?.caption || feed?.caption || feed?.title || '',
                                videoUrl,
                                avatarUrl: feed?.author?.headerUrl || feed?.user?.avatar || '',
                                platform: 'kuaishou',
                                link: `https://www.kuaishou.com/short-video/${id}`
                            };
                        }).filter(Boolean);

                        this.logger.log('success', `[快手] 成功获取 ${videos.length} 个视频。`);
                        return videos;
                    }
                },
                'douyin': {
                    name: '抖音',
                    url: 'https://www.douyin.com',
                    icon: 'https://lf-cdn-tos.bytescm.com/obj/static/ies/douyin_web/public/favicon.ico',
                    isFetching: false,
                    fetchFeed: async () => {
                        // This is now a placeholder. The actual data comes from the broadcast sniffer.
                        this.logger.log('info', '[抖音] 等待来自嗅探器的数据广播...');
                        this.ui.setPlayerState('guiding', {
                            name: '抖音',
                            url: 'https://www.douyin.com',
                            customMessage: '请在新标签页打开抖音并稍微浏览一下，脚本会自动捕获视频数据。'
                        });
                        return new Promise((resolve) => {
                            // The promise will be resolved by the player when data is received.
                            // This function itself doesn't need to do anything more.
                        });
                    }
                },
            };
        }

        async fetchFeed(platformKey) {
            const adapter = this.adapters[platformKey];
            if (!adapter || adapter.isFetching) return [];
            adapter.isFetching = true;
            this.logger.log('info', `[API] 开始为 ${adapter.name} 获取数据...`);
            try {
                return await adapter.fetchFeed();
            } finally {
                adapter.isFetching = false;
            }
        }

        async request(options, retries = 3, delay = 1000) {
            for (let i = 0; i < retries; i++) {
                try {
                    return await new Promise((resolve, reject) => {
                        const requestBody = options.data ? (typeof options.data === 'string' ? options.data : JSON.stringify(options.data)) : 'N/A';
                        this.logger.log('info', `[API Request] -> ${options.method} ${options.url}`, {
                            Request: {
                                Headers: options.headers,
                                Body: requestBody
                            }
                        });
                        GM_xmlhttpRequest({
                            ...options,
                            timeout: 15000,
                            onload: (res) => {
                                if (res.status >= 200 && res.status < 300) {
                                    try {
                                        const responseData = options.responseType === 'json' ? JSON.parse(res.responseText) : res.responseText;
                                        this.logger.log('info', `[API Response] <- ${res.status} ${options.url}`, { Response: responseData });
                                        resolve(responseData);
                                    } catch (e) {
                                        this.logger.log('error', `[API Response JSON Parse Error] <- ${res.status} ${options.url}`, { Error: e.message, ResponseText: res.responseText });
                                        reject(new Error('响应JSON解析失败'));
                                    }
                                } else {
                                    this.logger.log('error', `[API Response Error] <- ${res.status} ${options.url}`, { Status: res.status, Response: res.responseText });
                                    reject(new Error(`HTTP Status ${res.status}`));
                                }
                            },
                            onerror: (err) => {
                                this.logger.log('error', `[API Network Error] ${options.url}`, err);
                                reject(new Error('网络请求失败'));
                            },
                            ontimeout: () => {
                                this.logger.log('error', `[API Timeout] ${options.url}`);
                                reject(new Error('请求超时'));
                            },
                        });
                    });
                } catch (error) {
                    this.logger.log('warn', `请求失败 (第 ${i + 1} 次尝试): ${error.message}`);
                    if (i === retries - 1) throw error;
                    await new Promise(res => setTimeout(res, delay * (i + 1))); // Exponential backoff
                }
            }
        }
    }

    /**
     * @class Player
     * Manages video playback, queue, and prefetching.
     */
    class Player {
        constructor(state, api, ui, logger) {
            this.state = state;
            this.api = api;
            this.ui = ui;
            this.logger = logger;
            this.videoQueue = [];
            this.currentIndex = -1;
            this.seenVideos = new Set();
            this.prefetcherNext = document.createElement('video');
            this.prefetcherPrev = document.createElement('video');
            this.prefetcherNext.muted = this.prefetcherPrev.muted = true;
        }

        init() {
            this.state.addEventListener('authHeaders', (e) => {
                if (e.detail && Object.keys(e.detail).length > 0 && this.ui.getPlayerState() === 'guiding') {
                    this.logger.log('info', '凭证已更新，自动加载视频...');
                    this.loadInitialFeed();
                }
            });
            this.loadInitialFeed();
        }

        async loadInitialFeed() {
            await this.fetchMoreVideos();
        }

        async fetchMoreVideos() {
            const platform = this.state.get('currentPlatform');
            this.ui.setPlayerState('loading');
            try {
                const newVideos = await this.api.fetchFeed(platform);
                if (newVideos?.length > 0) {
                    this.addVideosToQueue(newVideos);
                } else if (this.videoQueue.length === 0 && platform !== 'douyin') {
                    this.ui.setPlayerState('error', `无法从 ${this.api.adapters[platform].name} 加载视频。`);
                }
            } catch (error) {
                this.logger.log('error', `获取视频失败: ${error.message}`);
                if (error.message === 'NO_HEADERS') {
                    this.ui.setPlayerState('guiding', this.api.adapters[platform]);
                } else {
                    this.ui.setPlayerState('error', '视频流加载失败，请检查网络或日志。');
                }
            }
        }

        processDouyinData(data) {
            const videos = data.aweme_list.map(aweme => ({
                id: aweme.aweme_id,
                author: aweme.author.nickname,
                desc: aweme.desc,
                videoUrl: aweme.video.play_addr.url_list[0].replace('http://', 'https://'),
                avatarUrl: aweme.author.avatar_thumb.url_list[0].replace('http://', 'https://'),
                platform: 'douyin',
                link: `https://www.douyin.com/video/${aweme.aweme_id}`
            })).filter(v => v.videoUrl);
            this.addVideosToQueue(videos);
        }

        addVideosToQueue(newVideos) {
            const uniqueVideos = newVideos.filter(v => !this.seenVideos.has(v.id));
            this.videoQueue.push(...uniqueVideos);
            uniqueVideos.forEach(v => {
                this.seenVideos.add(v.id);
                if (this.seenVideos.size > CONFIG.MAX_SEEN_VIDEOS) {
                    const oldestVideoId = this.seenVideos.values().next().value;
                    this.seenVideos.delete(oldestVideoId);
                }
            });

            if (this.currentIndex === -1 && this.videoQueue.length > 0) {
                this.currentIndex = 0;
                this.loadVideo(0);
            }
            this.ui.setPlayerState('playing');
        }


        loadVideo(index) {
            if (index < 0 || index >= this.videoQueue.length) return;
            const videoData = this.videoQueue[index];
            this.logger.log('info', `正在加载: ${videoData.author} - ${videoData.desc.substring(0, 30)}...`);
            this.ui.renderVideo(videoData);
            this.currentIndex = index;
            this.prefetch();
        }

        prefetch() {
            if (!this.state.get('settings').enablePrefetch) return;

            // Prefetch next
            const nextIndex = this.currentIndex + 1;
            if (nextIndex < this.videoQueue.length) {
                const nextVideo = this.videoQueue[nextIndex];
                if (this.prefetcherNext.src !== nextVideo.videoUrl) {
                    this.prefetcherNext.src = nextVideo.videoUrl;
                    this.prefetcherNext.load();
                    this.logger.log('info', `已预加载下一个视频: ${nextVideo.author}`);
                }
            }

            // Prefetch previous
            const prevIndex = this.currentIndex - 1;
            if (prevIndex >= 0) {
                const prevVideo = this.videoQueue[prevIndex];
                if (this.prefetcherPrev.src !== prevVideo.videoUrl) {
                    this.prefetcherPrev.src = prevVideo.videoUrl;
                    this.prefetcherPrev.load();
                    this.logger.log('info', `已预加载上一个视频: ${prevVideo.author}`);
                }
            }
        }

        next() {
            if (this.currentIndex < this.videoQueue.length - 1) {
                this.loadVideo(this.currentIndex + 1);
            } else {
                this.ui.updateStatus('正在加载更多视频...');
                this.fetchMoreVideos();
            }
        }

        prev() {
            if (this.currentIndex > 0) {
                this.loadVideo(this.currentIndex - 1);
            } else {
                this.ui.updateStatus('已经是第一个视频了');
            }
        }

        async switchPlatform(platformKey) {
            if (platformKey === this.state.get('currentPlatform')) return;
            this.logger.log('info', `正在切换平台至 ${this.api.adapters[platformKey].name}...`);
            this.state.set('currentPlatform', platformKey);
            this.videoQueue = [];
            this.currentIndex = -1;
            this.seenVideos.clear();
            const adapter = this.api.adapters[platformKey];
            if (adapter) {
                if ('pcursor' in adapter) adapter.pcursor = "";
                if ('offset' in adapter) adapter.offset = '';
                if ('refresh_index' in adapter) adapter.refresh_index = 1;
                this.ui.clearVideo();
                this.ui.updateStatus(`切换到 ${adapter.name}...`);
                await this.fetchMoreVideos();
            }
        }
    }

    /**
     * @class UIManager
     * Manages all DOM elements, styling, and UI updates.
     */
    class UIManager {
        constructor(state, logger) {
            this.state = state;
            this.logger = logger;
            this.elements = {};
            this.playerState = 'none';
            this.originalWindowTitle = '初始化...';
            this.isTerminalBusy = false;
            this.icons = {
                settings: `<svg viewBox="0 0 24 24"><path d="M19.4 12.9c.2-.5.2-1.1 0-1.6l1.9-1.6c.3-.2.4-.6.2-1l-1.6-2.8c-.2-.4-.6-.5-1-.3l-2.3.9c-.5-.4-1-.7-1.6-.9l-.4-2.5c-.1-.4-.4-.7-.8-.7h-3.2c-.4 0-.7.3-.8.7l-.4 2.5c-.6.2-1.1.5-1.6.9l-2.3-.9c-.4-.2-.8-.1-1 .3l-1.6 2.8c-.2.4-.1.8.2 1l1.9 1.6c-.2.5-.2 1.1 0 1.6l-1.9 1.6c-.3.2-.4.6-.2 1l1.6 2.8c.2.4.6.5 1 .3l2.3-.9c.5.4 1 .7 1.6.9l.4 2.5c.1.4.4.7.8.7h3.2c.4 0 .7-.3.8.7l.4-2.5c.6-.2 1.1-.5 1.6-.9l2.3.9c.4.2.8.1 1-.3l1.6-2.8c.2-.4.1-.8-.2-1l-1.9-1.6zM12 15.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z"/></svg>`,
                mute: `<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.8-1-3.3-2.5-4v8c1.5-.7 2.5-2.2 2.5-4zM5 9v6h4l5 5V4L9 9H5z"/></svg>`,
                unmute: `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.8-1-3.3-2.5-4v8c1.5-.7 2.5-2.2 2.5-4zM14 3.2v2.1c2.9.9 5 3.6 5 6.7s-2.1 5.8-5 6.7v2.1c4-.9 7-4.5 7-8.8s-3-7.8-7-8.8z"/></svg>`,
                fullscreen: `<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5V14h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`,
                exitFullscreen: `<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`,
                close: `<svg viewBox="0 0 24 24"><path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/></svg>`,
                play: `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
                pause: `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
                key: `<svg viewBox="0 0 24 24"><path d="M12.95 9.05a1 1 0 0 0-1.414-1.414L4.293 15.293a1 1 0 1 0 1.414 1.414L12.95 9.05zM8.5 8a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"/></svg>`,
                error: `<svg viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
                link: `<svg viewBox="0 0 24 24"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>`,
                reset: `<svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>`,
                code: `<svg viewBox="0 0 24 24"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>`,
            };
        }

        init(player) {
            this.player = player;
            this.createDOM();
            this.injectStyles();
            this.bindElements();
            this.applyInitialState();
            this.attachEventListeners();
            // Connect logger to UI *after* the element has been created.
            this.logger.uiContainer = this.elements.logContainer;
        }

        getPlayerState() { return this.playerState; }

        createDOM() {
            const container = document.createElement('div');
            container.id = 'svd-container';
            container.innerHTML = `
                <div id="svd-fab" class="svd-hidden" title="打开播放器"></div>
                <div id="svd-window">
                    <div class="svd-resize-handle-wrapper">
                        <div class="svd-resize-handle svd-resize-handle-n"></div><div class="svd-resize-handle svd-resize-handle-s"></div><div class="svd-resize-handle svd-resize-handle-e"></div><div class="svd-resize-handle svd-resize-handle-w"></div><div class="svd-resize-handle svd-resize-handle-ne"></div><div class="svd-resize-handle svd-resize-handle-nw"></div><div class="svd-resize-handle svd-resize-handle-se"></div><div class="svd-resize-handle svd-resize-handle-sw"></div>
                    </div>
                    <div id="svd-window-inner">
                        <header id="svd-header" title="按住拖动">
                            <div id="svd-window-title">${this.originalWindowTitle}</div>
                            <div id="svd-status-display"></div>
                            <div id="svd-controls">
                                <button id="svd-settings-btn" title="设置">${this.icons.settings}</button>
                                <div id="svd-volume-control" class="svd-volume-control">
                                    <button id="svd-mute-btn" title="静音">${this.icons.mute}</button>
                                    <input type="range" id="svd-volume-slider" min="0" max="1" step="0.05" class="svd-volume-slider">
                                </div>
                                <button id="svd-fullscreen-btn" title="全屏模式">${this.icons.fullscreen}</button>
                                <button id="svd-close-btn" title="隐藏播放器">${this.icons.close}</button>
                            </div>
                        </header>
                        <main id="svd-video-container">
                            <div id="svd-state-overlay"></div>
                            <video id="svd-video" playsinline preload="auto"></video>
                            <div id="svd-play-pause-icon"></div>
                            <div id="svd-video-info-scrim"></div>
                            <div id="svd-video-info">
                                <div id="svd-author-info">
                                    <img id="svd-author-avatar" src="" alt="avatar"/>
                                    <span id="svd-author-name"></span>
                                </div>
                                <p id="svd-video-desc"></p>
                            </div>
                            <div id="svd-progress-bar-container"><div id="svd-progress-bar"></div></div>
                        </main>
                        <footer id="svd-footer">
                            <div id="svd-platform-buttons"></div>
                            <button id="svd-copy-link-btn" title="复制视频链接">${this.icons.link}</button>
                        </footer>
                        <div id="svd-settings-panel" class="svd-hidden">
                            <header id="svd-settings-header">
                                <span>高级设置</span>
                                <button id="svd-settings-close-btn" title="返回">${this.icons.close}</button>
                            </header>
                            <div id="svd-settings-body"></div>
                        </div>
                        <div id="svd-disguise-overlay" class="svd-hidden"></div>
                    </div>
                </div>`;
            document.body.appendChild(container);
        }

        bindElements() {
            const el = (id) => document.getElementById(id);
            this.elements = {
                window: el('svd-window'), header: el('svd-header'), video: el('svd-video'),
                videoContainer: el('svd-video-container'), stateOverlay: el('svd-state-overlay'),
                playPauseIcon: el('svd-play-pause-icon'), authorAvatar: el('svd-author-avatar'),
                authorName: el('svd-author-name'), videoDesc: el('svd-video-desc'),
                windowTitle: el('svd-window-title'), statusDisplay: el('svd-status-display'),
                platformButtons: el('svd-platform-buttons'), fab: el('svd-fab'),
                settingsPanel: el('svd-settings-panel'), settingsBody: el('svd-settings-body'),
                progressBar: el('svd-progress-bar'), progressBarContainer: el('svd-progress-bar-container'),
                muteBtn: el('svd-mute-btn'), volumeSlider: el('svd-volume-slider'),
                copyLinkBtn: el('svd-copy-link-btn'), fullscreenBtn: el('svd-fullscreen-btn'),
                closeBtn: el('svd-close-btn'), settingsBtn: el('svd-settings-btn'),
                settingsCloseBtn: el('svd-settings-close-btn'),
                disguiseOverlay: el('svd-disguise-overlay'),
                logContainer: null, // Will be bound later
            };
            this.originalWindowTitle = this.elements.windowTitle.textContent;
        }

        applyInitialState() {
            const geometry = GM_getValue(CONFIG.KEYS.GEOMETRY);
            if (geometry) Object.assign(this.elements.window.style, geometry);
            else {
                this.elements.window.style.top = '15vh';
                this.elements.window.style.left = `${Math.max(20, (window.innerWidth - 360) / 2)}px`;
            }
            const fabPos = GM_getValue(CONFIG.KEYS.FAB_POS);
            if (fabPos) Object.assign(this.elements.fab.style, fabPos);

            this.updateWindowVisibility(this.state.get('isWindowVisible'));
            this.updateMute(this.state.get('isMuted'));
            this.updateVolume(this.state.get('volume'));
            this.updatePlaybackRate(this.state.get('playbackRate'));
            this.updateOpacity(this.state.get('settings').opacity);
            this.updateVideoFit(this.state.get('settings').videoFit);
            this.updateFullScreen(this.state.get('isFullScreen'));
            this.updateSettingsVisibility(this.state.get('isSettingsVisible'));
            this.updateDisguiseVisibility(this.state.get('isDisguised'));
            this.updateAutoHideUI(this.state.get('settings').autoHideUI);

            this.createPlatformButtons();
            this.createSettingsContent();
            this.createDisguiseContent();
        }

        attachEventListeners() {
            // Player events
            this.elements.video.addEventListener('ended', () => this.player.next());
            this.elements.video.addEventListener('error', (e) => {
                this.logger.log('error', `视频加载失败: ${e.target.src}`);
                this.updateStatus('视频加载失败，1.5秒后切换');
                setTimeout(() => this.player.next(), 1500);
            });
            this.elements.video.addEventListener('play', () => this.showPlayPauseIcon(false));
            this.elements.video.addEventListener('pause', () => this.showPlayPauseIcon(true));
            this.elements.video.addEventListener('timeupdate', () => {
                const { currentTime, duration } = this.elements.video;
                if (duration > 0) this.elements.progressBar.style.width = `${(currentTime / duration) * 100}%`;
            });
            this.elements.video.addEventListener('volumechange', () => {
                this.state.set('volume', this.elements.video.volume);
                this.state.set('isMuted', this.elements.video.muted);
            });

            // UI Control events
            this.elements.closeBtn.addEventListener('click', () => this.state.set('isWindowVisible', false));
            this.elements.fullscreenBtn.addEventListener('click', () => this.state.set('isFullScreen', !this.state.get('isFullScreen')));
            this.elements.settingsBtn.addEventListener('click', () => this.state.set('isSettingsVisible', !this.state.get('isSettingsVisible')));
            this.elements.settingsCloseBtn.addEventListener('click', () => this.state.set('isSettingsVisible', false));
            this.elements.muteBtn.addEventListener('click', () => this.state.set('isMuted', !this.state.get('isMuted')));
            this.elements.volumeSlider.addEventListener('input', (e) => this.state.set('volume', parseFloat(e.target.value)));
            // Add click-to-set-volume functionality
            this.elements.volumeSlider.addEventListener('click', (e) => {
                const slider = e.target;
                const rect = slider.getBoundingClientRect();
                const clickPos = e.clientX - rect.left;
                const newVolume = clickPos / rect.width;
                this.state.set('volume', newVolume);
            });

            this.elements.fab.addEventListener('click', () => this.state.set('isWindowVisible', true));
            this.elements.videoContainer.addEventListener('click', (e) => {
                if (e.target === this.elements.videoContainer || e.target === this.elements.video) {
                    this.elements.video.paused ? this.elements.video.play() : this.elements.video.pause();
                }
            });
            this.elements.window.addEventListener('wheel', (e) => {
                if (this.state.get('isDisguised') || e.target.closest('#svd-settings-panel')) return;
                e.preventDefault();
                if (e.deltaY > 0) this.player.next();
                else this.player.prev();
            }, { passive: false });
            this.elements.platformButtons.addEventListener('click', (e) => {
                const btn = e.target.closest('.svd-platform-btn');
                if (btn?.dataset.platform) this.player.switchPlatform(btn.dataset.platform);
            });
            this.elements.progressBarContainer.addEventListener('click', (e) => {
                const rect = this.elements.progressBarContainer.getBoundingClientRect();
                const seekRatio = (e.clientX - rect.left) / rect.width;
                this.elements.video.currentTime = this.elements.video.duration * seekRatio;
            });
            this.elements.copyLinkBtn.addEventListener('click', () => {
                const currentVideo = this.player.videoQueue[this.player.currentIndex];
                if (currentVideo?.link) {
                    navigator.clipboard.writeText(currentVideo.link).then(() => {
                        this.updateStatus('链接已复制!');
                        GM_notification({ text: '视频链接已复制到剪贴板', title: 'SVD Phoenix', timeout: 2000 });
                    });
                }
            });

            // Disguise Terminal Events
            const termInput = document.getElementById('svd-disguise-terminal-input-field');
            const termSendBtn = document.getElementById('svd-disguise-terminal-send-btn');
            if (termInput && termSendBtn) {
                termSendBtn.addEventListener('click', () => this.handleTerminalInput());
                termInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.handleTerminalInput();
                    }
                });
            }


            // State change listeners
            this.state.addEventListener('isWindowVisible', e => this.updateWindowVisibility(e.detail));
            this.state.addEventListener('isMuted', e => this.updateMute(e.detail));
            this.state.addEventListener('volume', e => this.updateVolume(e.detail));
            this.state.addEventListener('playbackRate', e => this.updatePlaybackRate(e.detail));
            this.state.addEventListener('isFullScreen', e => this.updateFullScreen(e.detail));
            this.state.addEventListener('isSettingsVisible', e => this.updateSettingsVisibility(e.detail));
            this.state.addEventListener('isDisguised', e => this.updateDisguiseVisibility(e.detail));
            this.state.addEventListener('settings', e => this.updateSettings(e.detail));
            this.state.addEventListener('currentPlatform', e => this.updateActivePlatformButton(e.detail));

            // Page visibility listener
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.elements.video.pause();
                } else {
                    if (this.state.get('settings').autoResumeOnFocus && this.state.get('isWindowVisible') && this.elements.video.src && !this.state.get('isDisguised')) {
                        this.elements.video.play().catch(()=>{});
                    }
                }
            });
        }

        createPlatformButtons() {
            const fragment = document.createDocumentFragment();
            for (const key in this.player.api.adapters) {
                const platform = this.player.api.adapters[key];
                const btn = document.createElement('button');
                btn.className = 'svd-platform-btn';
                btn.title = `切换到 ${platform.name}`;
                btn.dataset.platform = key;
                btn.innerHTML = `<img src="${platform.icon}" alt="${platform.name}"/>`;
                fragment.appendChild(btn);
            }
            this.elements.platformButtons.innerHTML = '';
            this.elements.platformButtons.appendChild(fragment);
            this.updateActivePlatformButton(this.state.get('currentPlatform'));
        }

        createSettingsContent() {
            const s = this.state.get('settings');
            this.elements.settingsBody.innerHTML = `
                <div class="svd-setting-group"><h4>外观</h4>
                    <div class="svd-setting-item"><label for="svd-opacity-slider">窗口透明度</label><input type="range" id="svd-opacity-slider" min="0.1" max="1" step="0.05" value="${s.opacity}"></div>
                    <div class="svd-setting-item"><label for="svd-video-fit-select">视频填充模式</label><select id="svd-video-fit-select"><option value="cover">Cover (铺满)</option><option value="contain">Contain (适应)</option></select></div>
                    <div class="svd-setting-item"><label for="svd-autohide-toggle">鼠标移出时隐藏UI</label><label class="svd-switch"><input type="checkbox" id="svd-autohide-toggle" ${s.autoHideUI ? 'checked' : ''}><span class="svd-slider"></span></label></div>
                </div>
                <div class="svd-setting-group"><h4>播放</h4>
                    <div class="svd-setting-item"><label for="svd-playback-rate-select">默认播放速度</label><select id="svd-playback-rate-select"></select></div>
                    <div class="svd-setting-item"><label for="svd-prefetch-toggle">启用视频预加载</label><label class="svd-switch"><input type="checkbox" id="svd-prefetch-toggle" ${s.enablePrefetch ? 'checked' : ''}><span class="svd-slider"></span></label></div>
                    <div class="svd-setting-item"><label for="svd-autoresume-toggle">切回标签页时自动续播</label><label class="svd-switch"><input type="checkbox" id="svd-autoresume-toggle" ${s.autoResumeOnFocus ? 'checked' : ''}><span class="svd-slider"></span></label></div>
                </div>
                <div class="svd-setting-group"><h4>老板键 & 伪装</h4>
                    <div class="svd-setting-item"><label for="svd-boss-key-input">隐藏/显示快捷键</label><input type="text" id="svd-boss-key-input" value="${s.bossKey}" placeholder="按下按键"></div>
                    <div class="svd-setting-item"><label for="svd-boss-gesture-select">隐藏鼠标手势</label><select id="svd-boss-gesture-select"></select></div>
                    <div class="svd-setting-item"><label for="svd-disguise-key-input">伪装模式快捷键</label><input type="text" id="svd-disguise-key-input" value="${s.disguiseKey}" placeholder="按下按键"></div>
                    <div class="svd-setting-item"><label for="svd-ghost-mode-toggle">幽灵模式 (移出隐藏)</label><label class="svd-switch"><input type="checkbox" id="svd-ghost-mode-toggle" ${s.ghostMode ? 'checked' : ''}><span class="svd-slider"></span></label></div>
                    <div class="svd-setting-item"><label for="svd-ghost-mode-key-input">幽灵模式显示快捷键</label><input type="text" id="svd-ghost-mode-key-input" value="${s.ghostModeShowKey}" placeholder="按下按键"></div>
                </div>
                 <div class="svd-setting-group"><h4>摄像头感应 (实验性)</h4>
                    <div class="svd-setting-item"><label for="svd-boss-sensor-toggle">启用人脸识别老板键</label><label class="svd-switch"><input type="checkbox" id="svd-boss-sensor-toggle" ${s.bossSensor ? 'checked' : ''}><span class="svd-slider"></span></label></div>
                     <div class="svd-setting-item"><label for="svd-boss-sensor-count">触发人数 (≥)</label><input type="number" id="svd-boss-sensor-count" min="1" max="5" value="${s.bossSensorFaceCount}" style="width: 60px;"></div>
                </div>
                <div class="svd-setting-group"><h4>日志</h4><div id="svd-log-container"></div></div>
                <div class="svd-setting-group"><h4>系统</h4>
                    <div class="svd-setting-item"><label>重置所有设置</label><button id="svd-reset-btn" class="svd-button-danger">${this.icons.reset} 重置</button></div>
                </div>`;

            // Bind the log container element *after* it has been created.
            this.elements.logContainer = document.getElementById('svd-log-container');

            document.getElementById('svd-video-fit-select').value = s.videoFit;

            const rateSelect = document.getElementById('svd-playback-rate-select');
            [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0].forEach(rate => {
                const option = new Option(`${rate}x`, rate);
                if (rate === this.state.get('playbackRate')) option.selected = true;
                rateSelect.add(option);
            });

            const gestureSelect = document.getElementById('svd-boss-gesture-select');
            const gestures = { none: '无', 'top-left': '屏幕左上角', 'top-right': '屏幕右上角', 'bottom-left': '屏幕左下角', 'bottom-right': '屏幕右下角' };
            for (const [value, text] of Object.entries(gestures)) {
                const option = new Option(text, value);
                if (value === s.bossGesture) option.selected = true;
                gestureSelect.add(option);
            }

            document.getElementById('svd-opacity-slider').addEventListener('input', e => this.state.updateSetting('opacity', parseFloat(e.target.value)));
            document.getElementById('svd-video-fit-select').addEventListener('change', e => this.state.updateSetting('videoFit', e.target.value));
            document.getElementById('svd-autohide-toggle').addEventListener('change', e => this.state.updateSetting('autoHideUI', e.target.checked));
            rateSelect.addEventListener('change', e => this.state.set('playbackRate', parseFloat(e.target.value)));
            document.getElementById('svd-prefetch-toggle').addEventListener('change', e => this.state.updateSetting('enablePrefetch', e.target.checked));
            document.getElementById('svd-autoresume-toggle').addEventListener('change', e => this.state.updateSetting('autoResumeOnFocus', e.target.checked));
            const keyInputHandler = (e, key) => { e.preventDefault(); e.target.value = e.key; this.state.updateSetting(key, e.key); };
            document.getElementById('svd-boss-key-input').addEventListener('keydown', e => keyInputHandler(e, 'bossKey'));
            gestureSelect.addEventListener('change', e => this.state.updateSetting('bossGesture', e.target.value));
            document.getElementById('svd-disguise-key-input').addEventListener('keydown', e => keyInputHandler(e, 'disguiseKey'));
            document.getElementById('svd-ghost-mode-toggle').addEventListener('change', e => this.state.updateSetting('ghostMode', e.target.checked));
            document.getElementById('svd-ghost-mode-key-input').addEventListener('keydown', e => keyInputHandler(e, 'ghostModeShowKey'));
            document.getElementById('svd-boss-sensor-toggle').addEventListener('change', e => this.state.updateSetting('bossSensor', e.target.checked));
            document.getElementById('svd-boss-sensor-count').addEventListener('change', e => this.state.updateSetting('bossSensorFaceCount', parseInt(e.target.value, 10)));
            document.getElementById('svd-reset-btn').addEventListener('click', () => {
                if (confirm('确定要重置所有设置和缓存吗？此操作将刷新页面。')) {
                    this.state.reset();
                }
            });
        }

        createDisguiseContent() {
            this.elements.disguiseOverlay.innerHTML = `
                <div class="svd-disguise-ide">
                    <div class="svd-disguise-sidebar">
                        <div class="svd-disguise-sidebar-header">EXPLORER</div>
                        <ul class="svd-disguise-file-tree">
                            <li>&#x1F4C1; src</li>
                            <li class="svd-disguise-file-indent">&#x1F4C2; components</li>
                            <li class="svd-disguise-file-indent">&#x1F4C2; core</li>
                            <li class="svd-disguise-file-indent svd-disguise-file-active">&#x1F4C4; PhoenixCore.js</li>
                            <li class="svd-disguise-file-indent">&#x1F4C4; StateManager.js</li>
                            <li>&#x1F4C1; public</li>
                            <li>&#x1F4C4; package.json</li>
                        </ul>
                    </div>
                    <div class="svd-disguise-main">
                        <div class="svd-disguise-editor">
                            <div class="svd-disguise-tabs"><div class="svd-disguise-tab active">PhoenixCore.js</div></div>
                            <div class="svd-disguise-code">
                                <div class="svd-line-numbers"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span><span>10</span><span>11</span><span>12</span><span>13</span><span>14</span><span>15</span><span>16</span><span>17</span><span>18</span><span>19</span><span>20</span><span>21</span><span>22</span><span>23</span><span>24</span></div>
                                <pre><code><span class="token keyword">import</span> { <span class="token punctuation">{</span> StateManager<span class="token punctuation">,</span> UIManager <span class="token punctuation">}</span> } <span class="token keyword">from</span> <span class="token string">'./modules'</span><span class="token punctuation">;</span>
<span class="token keyword">import</span> * <span class="token keyword">as</span> Sentry <span class="token keyword">from</span> <span class="token string">'@sentry/browser'</span><span class="token punctuation">;</span>

<span class="token comment">/**
 * @class PhoenixCore
 * @description Main application core orchestrator.
 */</span>
<span class="token keyword">class</span> <span class="token class-name">PhoenixCore</span> <span class="token punctuation">{</span>
    <span class="token function">constructor</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token keyword">this</span><span class="token punctuation">.</span><span class="token property-access">state</span> <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">StateManager</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token keyword">this</span><span class="token punctuation">.</span><span class="token property-access">ui</span> <span class="token operator">=</span> <span class="token keyword">new</span> <span class="token class-name">UIManager</span><span class="token punctuation">(</span><span class="token keyword">this</span><span class="token punctuation">.</span><span class="token property-access">state</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token keyword">this</span><span class="token punctuation">.</span><span class="token function">init</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
    <span class="token punctuation">}</span>

    <span class="token keyword">async</span> <span class="token function">init</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token keyword">try</span> <span class="token punctuation">{</span>
            <span class="token keyword">await</span> <span class="token keyword">this</span><span class="token punctuation">.</span><span class="token property-access">state</span><span class="token punctuation">.</span><span class="token function">load</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token keyword">this</span><span class="token punctuation">.</span><span class="token property-access">ui</span><span class="token punctuation">.</span><span class="token function">render</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
            <span class="token console class-name">console</span><span class="token punctuation">.</span><span class="token method function property-access">log</span><span class="token punctuation">(</span><span class="token string">'Phoenix Core Initialized.'</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span> <span class="token keyword">catch</span> <span class="token punctuation">(</span>error<span class="token punctuation">)</span> <span class="token punctuation">{</span>
            Sentry<span class="token punctuation">.</span><span class="token function">captureException</span><span class="token punctuation">(</span>error<span class="token punctuation">)</span><span class="token punctuation">;</span>
        <span class="token punctuation">}</span>
    <span class="token punctuation">}</span>
<span class="token punctuation">}</span></code></pre>
                            </div>
                        </div>
                        <div class="svd-disguise-terminal">
                            <div class="svd-disguise-tabs"><div class="svd-disguise-tab active">TERMINAL</div></div>
                            <div id="svd-disguise-terminal-output" class="svd-disguise-terminal-output">
                                <p>> node scripts/start.js</p>
                                <p><span class="svd-term-success">SUCCESS</span> Compiled successfully in 3.4s</p>
                                <p>You can now view <span class="svd-term-highlight">svd-phoenix</span> in the browser.</p>
                                <p>  <span class="svd-term-highlight">Local:</span>            http://localhost:3000</p>
                                <p>  <span class="svd-term-highlight">On Your Network:</span>  http://192.168.1.10:3000</p>
                                <p>Note that the development build is not optimized.</p>
                                <p>To create a production build, use <span class="svd-term-code">npm run build</span>.</p>
                            </div>
                            <div class="svd-disguise-terminal-input">
                                <span>></span>
                                <input type="text" id="svd-disguise-terminal-input-field" placeholder="Ask AI...">
                                <button id="svd-disguise-terminal-send-btn">Send</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        handleTerminalInput() {
            if (this.isTerminalBusy) return;

            const inputEl = document.getElementById('svd-disguise-terminal-input-field');
            const outputEl = document.getElementById('svd-disguise-terminal-output');
            const sendBtn = document.getElementById('svd-disguise-terminal-send-btn');
            const command = inputEl.value.trim();

            if (!command) return;

            this.isTerminalBusy = true;
            inputEl.disabled = true;
            sendBtn.disabled = true;
            inputEl.value = '';

            // 1. Display user's command
            const userCommandEl = document.createElement('p');
            userCommandEl.className = 'svd-term-user-command';
            userCommandEl.textContent = `> ${command}`;
            outputEl.appendChild(userCommandEl);
            outputEl.scrollTop = outputEl.scrollHeight;

            // 2. Simulate thinking and stream response
            const thinkingEl = document.createElement('p');
            thinkingEl.className = 'svd-term-ai-response';
            const cursor = document.createElement('span');
            cursor.className = 'svd-term-cursor';
            thinkingEl.appendChild(cursor);
            outputEl.appendChild(thinkingEl);

            setTimeout(() => {
                const responses = [
                    `Of course. Analyzing the query: "${command}". I've found a relevant module in the project's core library. Here is a function that should accomplish your goal:\n\n\`\`\`javascript\nasync function queryDatabase(param) {\n  const result = await db.get(param);\n  if (!result) {\n    throw new Error('Not found');\n  }\n  return result.data;\n}\n\`\`\`\nLet me know if you need a different implementation.`,
                    `I can certainly help with that. For "${command}", a more efficient approach would be to use a hash map for O(1) lookups. Initializing the process... \n[INFO] Building dependency tree...\n[SUCCESS] Dependencies resolved. \nHere is the optimized code structure:\nconst map = new Map(initialData.map(item => [item.id, item]));\nconsole.log('Map created with', map.size, 'entries.');`,
                    `Processing request: "${command}". This seems related to the UI state management. I would recommend dispatching an action to the central store instead of mutating the state directly. For example:\n\n` + '`dispatch({ type: "UPDATE_ITEM", payload: { id: 123, data: "new data" } });`\n\nThis ensures data integrity and predictable state changes.'
                ];
                const responseText = responses[Math.floor(Math.random() * responses.length)];

                let i = 0;
                const streamInterval = setInterval(() => {
                    if (i < responseText.length) {
                        thinkingEl.insertBefore(document.createTextNode(responseText[i]), cursor);
                        outputEl.scrollTop = outputEl.scrollHeight;
                        i++;
                    } else {
                        clearInterval(streamInterval);
                        thinkingEl.removeChild(cursor);
                        this.isTerminalBusy = false;
                        inputEl.disabled = false;
                        sendBtn.disabled = false;
                        inputEl.focus();
                    }
                }, 20 + Math.random() * 30); // Typing speed variation
            }, 500 + Math.random() * 500); // Thinking delay
        }


        renderVideo(data) {
            this.elements.video.src = data.videoUrl;
            this.elements.authorAvatar.src = data.avatarUrl;
            this.elements.authorName.textContent = data.author;
            this.elements.videoDesc.textContent = data.desc;
            if (this.state.get('isWindowVisible') && !document.hidden) {
                this.elements.video.play().catch(e => {
                    this.logger.log('warn', '自动播放失败，等待用户交互。');
                });
            }
        }

        clearVideo() {
            this.elements.video.src = '';
            this.elements.authorAvatar.src = '';
            this.elements.authorName.textContent = '';
            this.elements.videoDesc.textContent = '';
        }

        updateStatus(text) {
            this.elements.statusDisplay.textContent = text;
            this.elements.statusDisplay.style.opacity = '1';
            setTimeout(() => { this.elements.statusDisplay.style.opacity = '0'; }, 2000);
        }

        showPlayPauseIcon(isPaused) {
            this.elements.playPauseIcon.innerHTML = isPaused ? this.icons.play : this.icons.pause;
            this.elements.playPauseIcon.classList.add('svd-visible');
            setTimeout(() => this.elements.playPauseIcon.classList.remove('svd-visible'), 500);
        }

        setPlayerState(state, context = null) {
            this.playerState = state;
            const overlay = this.elements.stateOverlay;
            overlay.className = `svd-state-overlay svd-state-${state}`;
            switch (state) {
                case 'guiding':
                    const message = context.customMessage || `为了匿名浏览，请点击下方按钮，脚本将在新标签页中自动获取必要的访问凭证。`;
                    const buttonText = context.name === '抖音' ? '打开抖音并浏览' : '一键获取';
                    overlay.innerHTML = `<div class="svd-state-icon">${this.icons.key}</div><h3>需要 <span class="svd-highlight">${context.name}</span> 数据</h3><p>${message}</p><button id="svd-open-auth-btn" class="svd-button-primary">${buttonText}</button><p class="svd-small-text">此过程无需登录，标签页打开后，浏览一下即可自动捕获数据。</p>`;
                    document.getElementById('svd-open-auth-btn').onclick = () => {
                        this.logger.log('info', `正在为 ${context.name} 打开数据捕获页面...`);
                        GM_openInTab(`${context.url}?svd_acquire=true`, { active: true });
                        this.updateStatus(`正在等待 ${context.name} 数据...`);
                        overlay.innerHTML = `<div class="svd-loader"></div><p>正在新标签页中等待 <span class="svd-highlight">${context.name}</span> 数据...<br>请在新页面中稍作浏览以触发数据加载。</p><p class="svd-small-text">如果长时间无响应，请尝试刷新或手动操作一下。</p>`;
                    };
                    break;
                case 'loading':
                    overlay.innerHTML = `<div class="svd-loader"></div>`;
                    break;
                case 'error':
                    overlay.innerHTML = `<div class="svd-state-icon">${this.icons.error}</div><h3>发生错误</h3><p>${context}</p>`;
                    break;
                case 'playing':
                    overlay.innerHTML = '';
                    break;
            }
        }

        updateWindowVisibility(isVisible) {
            if (isVisible) {
                this.elements.window.classList.remove('svd-hidden');
                this.elements.fab.classList.add('svd-hidden');
                if (this.elements.video.src && !this.elements.video.ended && !this.state.get('isDisguised') && !document.hidden) {
                    this.elements.video.play().catch(e => {});
                }
            } else {
                this.elements.video.pause();
                this.elements.window.classList.add('svd-hidden');
                this.elements.fab.classList.remove('svd-hidden');
            }
        }

        updateMute(isMuted) {
            this.elements.video.muted = isMuted;
            this.elements.muteBtn.innerHTML = isMuted ? this.icons.mute : this.icons.unmute;
            this.elements.muteBtn.title = isMuted ? '取消静音' : '静音';
        }

        updateVolume(volume) {
            if (!this.state.get('isMuted')) this.elements.video.volume = volume;
            this.elements.volumeSlider.value = volume;
        }

        updatePlaybackRate(rate) {
            this.elements.video.playbackRate = rate;
        }

        updateOpacity(value) {
            this.elements.window.style.opacity = value;
        }

        updateVideoFit(mode) {
            this.elements.video.style.objectFit = mode;
        }

        updateAutoHideUI(isEnabled) {
            this.elements.window.classList.toggle('svd-autohide-ui', isEnabled);
        }

        updateFullScreen(isFullScreen) {
            this.elements.window.classList.toggle('svd-fullscreen', isFullScreen);
            this.elements.fullscreenBtn.innerHTML = isFullScreen ? this.icons.exitFullscreen : this.icons.fullscreen;
            this.elements.fullscreenBtn.title = isFullScreen ? '退出全屏' : '全屏模式';
        }

        updateSettingsVisibility(isVisible) {
            this.elements.settingsPanel.classList.toggle('svd-hidden', !isVisible);
            this.elements.settingsBtn.classList.toggle('svd-active', isVisible);
        }

        updateDisguiseVisibility(isDisguised) {
            this.elements.window.classList.toggle('svd-disguised', isDisguised);
            if (isDisguised) {
                this.elements.video.pause();
                this.elements.windowTitle.textContent = 'AI助手在线聊天';
            } else {
                this.elements.windowTitle.textContent = this.originalWindowTitle;
                if (this.state.get('isWindowVisible') && this.elements.video.src && !this.elements.video.ended) {
                    this.elements.video.play().catch(()=>{});
                }
            }
        }

        updateSettings(settings) {
            this.updateOpacity(settings.opacity);
            this.updateVideoFit(settings.videoFit);
            this.updateAutoHideUI(settings.autoHideUI);
        }

        updateActivePlatformButton(platformKey) {
            this.elements.platformButtons.querySelectorAll('.svd-platform-btn').forEach(btn => {
                btn.classList.toggle('svd-active', btn.dataset.platform === platformKey);
            });
        }

        injectStyles() {
            const styles = `
:root { --svd-radius: 16px; --svd-accent: #00aaff; --svd-bg: rgba(25, 27, 34, 0.95); --svd-bg-solid: #191b22; --svd-text: #e6e6e6; --svd-text-secondary: #a0a0a0; }
.svd-hidden { display: none !important; }
body.svd-dragging-no-select { user-select: none !important; }
body.svd-dragging-no-select, body.svd-dragging-no-select #svd-header { cursor: grabbing !important; }
#svd-fab { position: fixed; z-index: 99998; width: 60px; height: 60px; top: 85vh; left: 90vw; background: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48bGluZWFyR3JhZGllbnQgaWQ9ImciIGdyYWRpZW50VHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMDBBRkZGIi8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjRkYwMDdBIi8+PC9saW5lYXJHcmFkaWVudD48cGF0aCBkPSJNMzIgOEMxOC43NzggOCA4IDE4Ljc3OCA4IDMyQzggNDUuMjIyIDE4Ljc3OCA1NiAzMiA1NkM0NS4yMjIgNTYgNTYgNDUuMjIyIDU2IDMyQzU2IDE4Ljc3OCA0NS4yMjIgOCAzMiA4WiIgZmlsbD0idXJsKCNnKSIvPjxwYXRoIGQ9Ik00MS4yIDE5QzM4LjQxMyAxOSAzNi4xIDEyLjggMjkuNiAxMi44QzIzLjEgMTIuOCAyMC44IDE5IDIwLjggMTlDMTIuMSAxOSAxMS44IDI4LjQgMTEuOCAyOC40VjM1QzExLjggMzUgMTIuMSA0NC42IDIwLjggNDQuNkMyMC44IDQ0LjYgMjMuMSA1MC44IDI5LjYgNTAuOEMzNi4xIDUwLjggMzguNCA0NC42IDQxLjIgNDQuNkg0MS44VjE5SDQxLjJaTTI5LjYgNDEuOEMyNi45IDQxLjggMjYuMiAzNSAyNi4yIDM1VjI4LjRDMjYuMiAyOC44IDI2LjkgMjEuOCAyOS42IDIxLjhDMzIuMyAyMS44IDMzIDI4LjQgMzMgMjguNFYzNUMzMyAzNSAzMi4zIDQxLjggMjkuNiA0MS44WiIgZmlsbD0id2hpdGUiLz48L3N2Zz4=') center/cover; border-radius: 50%; cursor: grab; box-shadow: 0 8px 25px rgba(0,0,0,0.3); transition: transform 0.3s ease, opacity 0.3s; }
#svd-fab:hover { transform: scale(1.1); }
#svd-fab.svd-hidden { transform: scale(0.5); opacity: 0; pointer-events: none; }
#svd-window { position: fixed; z-index: 99999; color: var(--svd-text); width: 360px; height: 640px; display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; transition: opacity 0.4s, transform 0.4s; }
#svd-window-inner { width: 100%; height: 100%; background-color: var(--svd-bg); backdrop-filter: blur(20px) saturate(180%); -webkit-backdrop-filter: blur(20px) saturate(180%); border-radius: var(--svd-radius); box-shadow: 0 12px 40px rgba(0,0,0,0.5); display: flex; flex-direction: column; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.1); }
#svd-window.svd-hidden { transform: scale(0.8) !important; opacity: 0 !important; pointer-events: none; }
#svd-window.svd-ghost-hidden { opacity: 0 !important; pointer-events: none; transform: scale(0.95); transition: opacity 0.1s, transform 0.1s; }
#svd-window.svd-fullscreen { width: 100vw !important; height: 100vh !important; top: 0 !important; left: 0 !important; }
#svd-window.svd-fullscreen #svd-window-inner { border-radius: 0; }
#svd-header, #svd-footer, #svd-video-info, #svd-progress-bar-container, #svd-video-info-scrim { transition: opacity 0.3s ease; }
#svd-window.svd-autohide-ui:not(:hover):not(.svd-fullscreen):not(.svd-disguised) #svd-window-inner > *:not(#svd-video-container) { opacity: 0; pointer-events: none; }
#svd-window.svd-autohide-ui:not(:hover):not(.svd-fullscreen):not(.svd-disguised) #svd-video-info, #svd-window.svd-autohide-ui:not(:hover):not(.svd-fullscreen):not(.svd-disguised) #svd-video-info-scrim { opacity: 0; pointer-events: none; }
#svd-header { padding: 8px 14px; display: flex; justify-content: space-between; align-items: center; cursor: grab; flex-shrink: 0; position: relative; z-index: 10; }
#svd-window-title { font-size: 12px; color: var(--svd-text-secondary); font-weight: 500; position: absolute; left: 14px; top: 50%; transform: translateY(-50%); }
#svd-status-display { color: var(--svd-text-secondary); font-size: 12px; position: absolute; left: 50%; transform: translateX(-50%); transition: opacity 0.3s; opacity: 0; background: rgba(0,0,0,0.5); padding: 2px 8px; border-radius: 10px; }
#svd-controls { display: flex; align-items: center; gap: 4px; margin-left: auto; }
#svd-controls button { background: none; border: none; color: var(--svd-text); cursor: pointer; width: 32px; height: 32px; padding: 6px; opacity: 0.8; transition: all 0.2s; border-radius: 50%; }
#svd-controls button:hover, #svd-controls button.svd-active { opacity: 1; background-color: rgba(255,255,255,0.1); }
#svd-controls button svg { width: 100%; height: 100%; fill: currentColor; }
.svd-volume-control { display: flex; align-items: center; }
.svd-volume-slider { width: 70px; opacity: 0.6; transition: opacity 0.3s ease; -webkit-appearance: none; background: transparent; margin-left: 4px; cursor: pointer; }
.svd-volume-control:hover .svd-volume-slider { opacity: 1; }
.svd-volume-slider::-webkit-slider-runnable-track { height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; }
.svd-volume-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; background: #fff; border-radius: 50%; margin-top: -5px; border: none; cursor: pointer; }
#svd-video-container { flex-grow: 1; position: relative; background-color: #000; cursor: pointer; overflow: hidden; }
#svd-window.svd-disguised #svd-video-container, #svd-window.svd-disguised #svd-footer { display: none; }
#svd-video { width: 100%; height: 100%; object-fit: cover; }
#svd-play-pause-icon { position: absolute; top: 50%; left: 50%; width: 64px; height: 64px; transform: translate(-50%, -50%) scale(1.5); opacity: 0; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); pointer-events: none; filter: drop-shadow(0 0 10px rgba(0,0,0,0.5)); color: #fff; }
#svd-play-pause-icon.svd-visible { transform: translate(-50%, -50%) scale(1); opacity: 1; }
#svd-play-pause-icon svg { width: 100%; height: 100%; }
#svd-state-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.7); display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 20px; color: #fff; opacity: 0; pointer-events: none; transition: opacity 0.3s; z-index: 5; }
#svd-state-overlay.svd-state-guiding, #svd-state-overlay.svd-state-loading, #svd-state-overlay.svd-state-error { opacity: 1; pointer-events: all; }
.svd-state-icon { font-size: 48px; margin-bottom: 15px; color: var(--svd-accent); }
.svd-state-icon svg { width: 48px; height: 48px; fill: currentColor; }
#svd-state-overlay h3 { margin: 0 0 10px; }
#svd-state-overlay p { margin: 0 0 20px; font-size: 14px; color: var(--svd-text-secondary); max-width: 80%; line-height: 1.5; }
#svd-state-overlay .svd-small-text { font-size: 12px; color: #888; margin-top: 15px; }
#svd-state-overlay .svd-highlight { color: var(--svd-accent); font-weight: bold; }
.svd-button-primary { background: var(--svd-accent); color: #fff; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: transform 0.2s, box-shadow 0.2s; }
.svd-button-primary:hover { transform: scale(1.05); box-shadow: 0 4px 15px rgba(0, 170, 255, 0.4); }
.svd-loader { width: 48px; height: 48px; border: 5px solid #FFF; border-bottom-color: var(--svd-accent); border-radius: 50%; display: inline-block; box-sizing: border-box; animation: svd-rotation 1s linear infinite; }
@keyframes svd-rotation { 100% { transform: rotate(360deg); } }
#svd-video-info-scrim { position: absolute; bottom: 0; left: 0; right: 0; height: 150px; background: linear-gradient(to top, rgba(0,0,0,0.8), transparent); pointer-events: none; }
#svd-video-info { position: absolute; bottom: 0; left: 0; right: 0; padding: 45px 20px 15px; pointer-events: none; }
#svd-author-info { display: flex; align-items: center; margin-bottom: 8px; }
#svd-author-avatar { width: 40px; height: 40px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.8); margin-right: 12px; background-color: #333; }
#svd-author-name { font-weight: 600; font-size: 16px; text-shadow: 0 1px 3px #000; }
#svd-video-desc { font-size: 14px; margin: 0; color: #eee; text-shadow: 0 1px 3px #000; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
#svd-progress-bar-container { position: absolute; bottom: 0; left: 0; right: 0; height: 15px; cursor: pointer; z-index: 2; }
#svd-progress-bar { height: 3px; background-color: var(--svd-accent); width: 0%; transition: width 0.1s linear; border-radius: 3px; }
#svd-progress-bar-container:hover #svd-progress-bar { height: 5px; }
#svd-footer { padding: 10px 14px; display: flex; justify-content: center; align-items: center; gap: 12px; flex-shrink: 0; position: relative; z-index: 10; }
#svd-platform-buttons { display: flex; gap: 12px; }
.svd-platform-btn { background: rgba(255,255,255,0.1); border: 1px solid transparent; border-radius: 50%; width: 40px; height: 40px; cursor: pointer; padding: 8px; transition: all 0.2s; }
.svd-platform-btn:hover { background-color: rgba(255,255,255,0.2); }
.svd-platform-btn.svd-active { border-color: var(--svd-accent); box-shadow: 0 0 10px var(--svd-accent); }
.svd-platform-btn img { width: 100%; height: 100%; border-radius: 50%; pointer-events: none; }
#svd-copy-link-btn { background: none; border: none; color: var(--svd-text-secondary); cursor: pointer; width: 32px; height: 32px; padding: 6px; opacity: 0.7; transition: all 0.2s; border-radius: 50%; position: absolute; right: 14px; }
#svd-copy-link-btn:hover { opacity: 1; background-color: rgba(255,255,255,0.1); }
#svd-copy-link-btn svg { width: 100%; height: 100%; fill: currentColor; }
#svd-settings-panel { position: absolute; inset: 46px 0 0 0; background-color: var(--svd-bg-solid); z-index: 20; display: flex; flex-direction: column; transition: opacity 0.3s, transform 0.3s; overflow: hidden; }
#svd-settings-panel.svd-hidden { opacity: 0; transform: translateY(20px); pointer-events: none; }
#svd-settings-header { padding: 10px 15px; font-size: 16px; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: center; display: flex; justify-content: center; align-items: center; position: relative; flex-shrink: 0; }
#svd-settings-close-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--svd-text); cursor: pointer; width: 32px; height: 32px; padding: 6px; opacity: 0.7; transition: all 0.2s; border-radius: 50%; }
#svd-settings-close-btn:hover { opacity: 1; background-color: rgba(255,255,255,0.1); }
#svd-settings-close-btn svg { width: 100%; height: 100%; fill: currentColor; }
#svd-settings-body { padding: 15px; display: flex; flex-direction: column; gap: 20px; flex-grow: 1; overflow-y: auto; }
.svd-setting-group h4 { margin: 0 0 10px; font-size: 14px; color: var(--svd-accent); border-bottom: 1px solid var(--svd-accent); padding-bottom: 5px; }
.svd-setting-item { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
.svd-setting-item input[type=range], .svd-setting-item input[type=text], .svd-setting-item select, .svd-setting-item input[type=number] { background: #333; color: #fff; border: 1px solid #555; border-radius: 6px; padding: 5px 8px; }
#svd-boss-key-input, #svd-disguise-key-input, #svd-ghost-mode-key-input { text-align: center; width: 120px; }
#svd-log-container { height: 150px; background: rgba(0,0,0,0.3); border-radius: 6px; padding: 8px; overflow-y: auto; font-size: 11px; font-family: monospace; border: 1px solid #444; }
.svd-log-entry { display: flex; margin-bottom: 4px; }
.svd-log-timestamp { color: #888; margin-right: 8px; flex-shrink: 0; }
.svd-log-main { display: flex; flex-direction: column; }
.svd-log-message { word-break: break-all; }
.svd-log-error .svd-log-message { color: #ff4d4d; }
.svd-log-success .svd-log-message { color: #34c759; }
.svd-log-warn .svd-log-message { color: #ffcc00; }
.svd-log-details-toggle { cursor: pointer; color: var(--svd-accent); font-size: 10px; text-decoration: underline; margin-top: 4px; display: inline-block; }
.svd-log-details-checkbox { display: none; }
.svd-log-details-content { display: none; background: rgba(0,0,0,0.5); padding: 5px; border-radius: 4px; margin-top: 5px; font-size: 10px; max-height: 200px; overflow: auto; white-space: pre-wrap; word-break: break-all; }
.svd-log-details-checkbox:checked ~ .svd-log-details-content { display: block; }
.svd-button-danger { background: #c0392b; color: white; border: none; padding: 5px 10px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 5px; }
.svd-button-danger svg { width: 14px; height: 14px; fill: currentColor; }
.svd-switch { position: relative; display: inline-block; width: 40px; height: 22px; }
.svd-switch input { opacity: 0; width: 0; height: 0; }
.svd-slider { position: absolute; cursor: pointer; inset: 0; background-color: #555; transition: .4s; border-radius: 22px; }
.svd-slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
input:checked + .svd-slider { background-color: var(--svd-accent); }
input:checked + .svd-slider:before { transform: translateX(18px); }
.svd-resize-handle-wrapper { position: absolute; inset: -5px; pointer-events: none; z-index: 5; }
.svd-resize-handle { position: absolute; pointer-events: auto; }
.svd-resize-handle-n { top: 0; left: 10px; right: 10px; height: 10px; cursor: ns-resize; } .svd-resize-handle-s { bottom: 0; left: 10px; right: 10px; height: 10px; cursor: ns-resize; } .svd-resize-handle-e { top: 10px; right: 0; bottom: 10px; width: 10px; cursor: ew-resize; } .svd-resize-handle-w { top: 10px; left: 0; bottom: 10px; width: 10px; cursor: ew-resize; } .svd-resize-handle-ne { top: 0; right: 0; width: 12px; height: 12px; cursor: nesw-resize; } .svd-resize-handle-nw { top: 0; left: 0; width: 12px; height: 12px; cursor: nwse-resize; } .svd-resize-handle-se { bottom: 0; right: 0; width: 12px; height: 12px; cursor: nwse-resize; } .svd-resize-handle-sw { bottom: 0; left: 0; width: 12px; height: 12px; cursor: nesw-resize; }
#svd-disguise-overlay { position: absolute; inset: 46px 0 0 0; background: #1e1e1e; color: #d4d4d4; font-family: 'Consolas', 'Monaco', monospace; z-index: 15; }
.svd-disguise-ide { display: flex; height: 100%; }
.svd-disguise-sidebar { width: 180px; background: #252526; border-right: 1px solid #333; flex-shrink: 0; padding: 5px; font-size: 13px; }
.svd-disguise-sidebar-header { padding: 5px 10px; font-weight: bold; color: #ccc; }
.svd-disguise-file-tree { list-style: none; padding: 0 0 0 10px; margin: 0; }
.svd-disguise-file-tree li { padding: 4px 8px; cursor: default; }
.svd-disguise-file-indent { padding-left: 20px; }
.svd-disguise-file-active { background: #37373d; border-radius: 4px; }
.svd-disguise-main { flex-grow: 1; display: flex; flex-direction: column; }
.svd-disguise-editor { flex-grow: 1; display: flex; flex-direction: column; }
.svd-disguise-tabs { background: #2d2d2d; display: flex; }
.svd-disguise-tab { padding: 8px 15px; background: #1e1e1e; border-right: 1px solid #2d2d2d; font-size: 13px; }
.svd-disguise-code { display: flex; flex-grow: 1; background: #1e1e1e; overflow: hidden; }
.svd-line-numbers { padding: 10px 10px 10px 15px; text-align: right; color: #858585; font-size: 14px; line-height: 1.5; user-select: none; }
.svd-line-numbers span { display: block; }
.svd-disguise-code pre { flex-grow: 1; margin: 0; padding: 10px; font-size: 14px; line-height: 1.5; overflow: auto; }
.svd-disguise-code .token.comment { color: #6a9955; } .svd-disguise-code .token.keyword { color: #569cd6; } .svd-disguise-code .token.punctuation { color: #d4d4d4; } .svd-disguise-code .token.class-name, .svd-disguise-code .token.property-access { color: #4ec9b0; } .svd-disguise-code .token.string { color: #ce9178; } .svd-disguise-code .token.function { color: #dcdcaa; } .svd-disguise-code .token.operator { color: #d4d4d4; }
.svd-disguise-terminal { height: 200px; display: flex; flex-direction: column; border-top: 1px solid #333; }
.svd-disguise-terminal-output { flex-grow: 1; background: #1e1e1e; padding: 10px; font-size: 13px; overflow-y: auto; white-space: pre-wrap; }
.svd-disguise-terminal-output p { margin: 0 0 5px; }
.svd-term-success { color: #34c759; } .svd-term-highlight { color: #87cefa; } .svd-term-code { background: #333; padding: 2px 4px; border-radius: 3px; }
.svd-term-user-command { color: #87cefa; }
.svd-term-ai-response { color: #e0e0e0; }
.svd-term-ai-response code, .svd-term-ai-response .token { background: #2a2a2a; padding: 1px 3px; border-radius: 3px; font-family: inherit; }
.svd-term-cursor { display: inline-block; background-color: #e0e0e0; width: 8px; height: 1em; animation: svd-blink 1s step-end infinite; vertical-align: text-bottom; }
@keyframes svd-blink { 50% { background-color: transparent; } }
.svd-disguise-terminal-input { display: flex; align-items: center; background: #2d2d2d; padding: 5px 10px; border-top: 1px solid #333; }
.svd-disguise-terminal-input input { flex-grow: 1; background: none; border: none; color: #e0e0e0; outline: none; font-family: inherit; font-size: 13px; }
#svd-disguise-terminal-send-btn { background: #444; color: #fff; border: 1px solid #666; padding: 4px 10px; margin-left: 8px; border-radius: 4px; cursor: pointer; }
#svd-disguise-terminal-send-btn:hover { background: #555; }
#svd-disguise-terminal-send-btn:disabled { background: #333; color: #888; cursor: not-allowed; }
`;
            GM_addStyle(styles);
        }
    }

    /**
     * @class InteractionManager
     * Handles all user interactions like dragging, resizing, and boss keys.
     */
    class InteractionManager {
        constructor(state, ui, logger) {
            this.state = state;
            this.ui = ui;
            this.logger = logger;
            this.isGhostHidden = false;
        }

        init() {
            const onInteractionEnd = () => {
                if (!this.state.get('isFullScreen')) {
                    GM_setValue(CONFIG.KEYS.GEOMETRY, { top: this.ui.elements.window.style.top, left: this.ui.elements.window.style.left, width: this.ui.elements.window.style.width, height: this.ui.elements.window.style.height });
                }
            };
            this.makeDraggable(this.ui.elements.window, this.ui.elements.header, onInteractionEnd);
            this.makeResizable(this.ui.elements.window, onInteractionEnd);
            this.makeDraggable(this.ui.elements.fab, this.ui.elements.fab, () => GM_setValue(CONFIG.KEYS.FAB_POS, { top: this.ui.elements.fab.style.top, left: this.ui.elements.fab.style.left }));
            this.initBossKeys();
            this.initGhostMode();
        }

        initGhostMode() {
            const win = this.ui.elements.window;
            win.addEventListener('mouseleave', () => {
                if (this.state.get('settings').ghostMode && !this.state.get('isFullScreen')) {
                    win.classList.add('svd-ghost-hidden');
                    this.ui.elements.video.pause();
                    this.isGhostHidden = true;
                }
            });
            win.addEventListener('mouseenter', () => {
                if (this.state.get('settings').ghostMode && this.isGhostHidden) {
                    win.classList.remove('svd-ghost-hidden');
                    if (this.state.get('isWindowVisible') && !this.state.get('isDisguised')) {
                        this.ui.elements.video.play().catch(()=>{});
                    }
                    this.isGhostHidden = false;
                }
            });
        }

        initBossKeys() {
            document.addEventListener('keydown', (e) => {
                const activeEl = document.activeElement.tagName.toLowerCase();
                if (activeEl === 'input' || activeEl === 'textarea') return;

                const settings = this.state.get('settings');

                // Ghost Mode Show Key
                if (settings.ghostMode && e.key.toLowerCase() === settings.ghostModeShowKey.toLowerCase()) {
                    this.isGhostHidden = !this.isGhostHidden;
                    this.ui.elements.window.classList.toggle('svd-ghost-hidden', this.isGhostHidden);
                     if (this.isGhostHidden) {
                        this.ui.elements.video.pause();
                    } else if (this.state.get('isWindowVisible') && !this.state.get('isDisguised')) {
                        this.ui.elements.video.play().catch(()=>{});
                    }
                }

                // Boss Key (Hide/Show)
                if (e.key.toLowerCase() === settings.bossKey.toLowerCase()) {
                    const isVisible = this.state.get('isWindowVisible');
                    this.state.set('isWindowVisible', !isVisible);
                    if (isVisible) this.state.set('isDisguised', false);
                }

                // Disguise Key
                if (e.key.toLowerCase() === settings.disguiseKey.toLowerCase()) {
                    if (this.state.get('isWindowVisible')) {
                        this.state.set('isDisguised', !this.state.get('isDisguised'));
                    }
                }
            });

            // Mouse Gesture
            document.addEventListener('mousemove', (e) => {
                const gesture = this.state.get('settings').bossGesture;
                if (gesture === 'none' || !this.state.get('isWindowVisible')) return;
                const threshold = 5;
                const { clientX: x, clientY: y } = e;
                const { innerWidth: w, innerHeight: h } = window;

                let cornerHit = false;
                if (gesture === 'top-left' && x < threshold && y < threshold) cornerHit = true;
                else if (gesture === 'top-right' && x > w - threshold && y < threshold) cornerHit = true;
                else if (gesture === 'bottom-left' && x < threshold && y > h - threshold) cornerHit = true;
                else if (gesture === 'bottom-right' && x > w - threshold && y > h - threshold) cornerHit = true;

                if (cornerHit) {
                    this.state.set('isWindowVisible', false);
                    this.state.set('isDisguised', false);
                }
            });
        }

        makeDraggable(element, handle, onDragEnd) {
            handle.onmousedown = (e) => {
                if (e.target.closest('button, input, select') || e.button !== 0 || this.state.get('isFullScreen')) return;
                e.preventDefault();
                e.stopPropagation();

                let shiftX = e.clientX - element.getBoundingClientRect().left;
                let shiftY = e.clientY - element.getBoundingClientRect().top;
                document.body.classList.add('svd-dragging-no-select');

                const moveAt = (clientX, clientY) => {
                    let newLeft = clientX - shiftX;
                    let newTop = clientY - shiftY;
                    newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - element.offsetWidth));
                    newTop = Math.max(0, Math.min(newTop, window.innerHeight - element.offsetHeight));
                    element.style.left = newLeft + 'px';
                    element.style.top = newTop + 'px';
                };

                const onMouseMove = (event) => moveAt(event.clientX, event.clientY);
                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    document.body.classList.remove('svd-dragging-no-select');
                    if (onDragEnd) onDragEnd();
                };
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            };
            handle.ondragstart = () => false;
        }

        makeResizable(element, onResizeEnd) {
            const handles = element.querySelectorAll('.svd-resize-handle');
            handles.forEach(handle => {
                handle.addEventListener('mousedown', (e) => {
                    if (this.state.get('isFullScreen')) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const startX = e.clientX, startY = e.clientY;
                    const startWidth = element.offsetWidth, startHeight = element.offsetHeight;
                    const startLeft = element.offsetLeft, startTop = element.offsetTop;

                    const onMouseMove = (me) => {
                        const dx = me.clientX - startX, dy = me.clientY - startY;
                        const minWidth = 300, minHeight = 450;

                        if (handle.classList.contains('svd-resize-handle-e') || handle.classList.contains('svd-resize-handle-ne') || handle.classList.contains('svd-resize-handle-se')) {
                            element.style.width = `${Math.max(minWidth, startWidth + dx)}px`;
                        }
                        if (handle.classList.contains('svd-resize-handle-s') || handle.classList.contains('svd-resize-handle-se') || handle.classList.contains('svd-resize-handle-sw')) {
                            element.style.height = `${Math.max(minHeight, startHeight + dy)}px`;
                        }
                        if (handle.classList.contains('svd-resize-handle-w') || handle.classList.contains('svd-resize-handle-nw') || handle.classList.contains('svd-resize-handle-sw')) {
                            const newWidth = Math.max(minWidth, startWidth - dx);
                            element.style.width = `${newWidth}px`;
                            element.style.left = `${startLeft + (startWidth - newWidth)}px`;
                        }
                        if (handle.classList.contains('svd-resize-handle-n') || handle.classList.contains('svd-resize-handle-ne') || handle.classList.contains('svd-resize-handle-nw')) {
                            const newHeight = Math.max(minHeight, startHeight - dy);
                            element.style.height = `${newHeight}px`;
                            element.style.top = `${startTop + (startHeight - newHeight)}px`;
                        }
                    };

                    const onMouseUp = () => {
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                        if (onResizeEnd) onResizeEnd();
                    };
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                });
            });
        }
    }

    /**
     * @class BossSensor
     * Experimental feature for face detection-based boss key.
     */
    class BossSensor {
        constructor(state, ui, logger) {
            this.state = state;
            this.ui = ui;
            this.logger = logger;
            this.model = null;
            this.videoEl = null;
            this.isDetecting = false;
            this.threatCooldown = null;
        }

        init() {
            this.state.addEventListener('settings', (e) => {
                const { bossSensor } = e.detail;
                if (bossSensor && !this.isDetecting) this.start();
                if (!bossSensor && this.isDetecting) this.stop();
            });
            if (this.state.get('settings').bossSensor) {
                this.start();
            }
        }

        async start() {
            if (this.isDetecting) return;
            this.logger.log('info', '[BossSensor] 正在启动摄像头感应...');

            if (typeof blazeface === 'undefined' || typeof tf === 'undefined') {
                this.logger.log('error', '[BossSensor] 启动失败: 核心库 (TensorFlow or BlazeFace) 未能加载。请检查网络连接或浏览器扩展是否阻止了CDN。');
                this.ui.updateStatus('人脸识别库加载失败');
                this.state.updateSetting('bossSensor', false);
                return;
            }

            try {
                // Load model
                if (!this.model) {
                    this.logger.log('info', '[BossSensor] 正在加载人脸识别模型...');
                    await tf.setBackend('webgl');
                    this.model = await blazeface.load();
                    this.logger.log('success', '[BossSensor] 人脸识别模型加载成功。');
                }

                // Get camera stream
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 320, height: 240 },
                    audio: false
                });
                this.videoEl = document.createElement('video');
                this.videoEl.srcObject = stream;
                this.videoEl.play();
                this.isDetecting = true;
                this.detectLoop();
                this.logger.log('success', '[BossSensor] 摄像头已启动，开始检测。');
                this.ui.updateStatus('摄像头感应已开启');

            } catch (err) {
                this.logger.log('error', `[BossSensor] 启动失败: ${err.message}`);
                this.ui.updateStatus('摄像头感应启动失败');
                this.state.updateSetting('bossSensor', false);
                this.stop();
            }
        }

        stop() {
            if (!this.isDetecting) return;
            this.isDetecting = false;
            if (this.videoEl && this.videoEl.srcObject) {
                this.videoEl.srcObject.getTracks().forEach(track => track.stop());
            }
            this.videoEl = null;
            clearTimeout(this.threatCooldown);
            this.logger.log('info', '[BossSensor] 摄像头感应已停止。');
        }

        async detectLoop() {
            if (!this.isDetecting || !this.model || !this.videoEl) return;

            try {
                const predictions = await this.model.estimateFaces(this.videoEl, false);
                const faceCount = predictions.length;
                const triggerCount = this.state.get('settings').bossSensorFaceCount;

                if (faceCount >= triggerCount) {
                    // Threat detected
                    clearTimeout(this.threatCooldown);
                    this.threatCooldown = null;
                    if (!this.state.get('isDisguised')) {
                        this.logger.log('warn', `[BossSensor] 检测到 ${faceCount} 张人脸，触发伪装模式！`);
                        this.state.set('isDisguised', true);
                    }
                } else {
                    // No threat, start cooldown to revert
                    if (this.state.get('isDisguised') && !this.threatCooldown) {
                        this.logger.log('info', '[BossSensor] 威胁已解除，10秒后恢复。');
                        this.threatCooldown = setTimeout(() => {
                            this.logger.log('info', '[BossSensor] 恢复视频播放。');
                            this.state.set('isDisguised', false);
                            this.threatCooldown = null;
                        }, 10000);
                    }
                }
            } catch (err) {
                this.logger.log('error', `[BossSensor] 检测循环出错: ${err.message}`);
            }

            requestAnimationFrame(() => this.detectLoop());
        }
    }

})();
