import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

class AnimeWebViewPage extends StatefulWidget {
  final String streamUrl;
  final String title;

  const AnimeWebViewPage({
    super.key,
    required this.streamUrl,
    required this.title,
  });

  @override
  State<AnimeWebViewPage> createState() => _AnimeWebViewPageState();
}

class _AnimeWebViewPageState extends State<AnimeWebViewPage> {
  late final WebViewController _controller;
  bool _videoReady = false;
  bool _pageLoaded = false;
  bool _isAppFullScreen = false;
  late final String _startHost;
  Widget? _androidCustomWidget;
  void Function()? _hideAndroidCustomWidget;

  @override
  void initState() {
    super.initState();
    _startHost = Uri.tryParse(widget.streamUrl)?.host.toLowerCase() ?? '';

    SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);

    final PlatformWebViewControllerCreationParams params;
    if (WebViewPlatform.instance is WebKitWebViewPlatform) {
      params = WebKitWebViewControllerCreationParams(
        allowsInlineMediaPlayback: true,
        mediaTypesRequiringUserAction: const <PlaybackMediaTypes>{},
      );
    } else {
      params = const PlatformWebViewControllerCreationParams();
    }

    final controller = WebViewController.fromPlatformCreationParams(params);
    if (controller.platform is AndroidWebViewController) {
      AndroidWebViewController.enableDebugging(true);
      final androidController = controller.platform as AndroidWebViewController;
      androidController.setMediaPlaybackRequiresUserGesture(false);
      androidController.setCustomWidgetCallbacks(
        onShowCustomWidget:
            (Widget widget, void Function() onCustomWidgetHidden) {
              _setAppFullScreen(true);
              if (!mounted) return;
              setState(() {
                _androidCustomWidget = widget;
                _hideAndroidCustomWidget = onCustomWidgetHidden;
              });
            },
        onHideCustomWidget: () {
          _setAppFullScreen(false);
          if (!mounted) return;
          setState(() {
            _androidCustomWidget = null;
            _hideAndroidCustomWidget = null;
          });
        },
      );
    }

    _controller = controller
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: (NavigationRequest request) {
            final url = request.url;

            // Allow streaming assets explicitly.
            if (_looksLikeStreamingAsset(url)) {
              debugPrint('[ANIME WEBVIEW] Streaming asset allowed: $url');
              return NavigationDecision.navigate;
            }

            // Block known ad/trap domains by host only.
            if (_isBlockedAdUrl(url)) {
              debugPrint('Blocked ad navigation: $url');
              return NavigationDecision.prevent;
            }

            if (request.isMainFrame && !_isAllowedMainFrame(url)) {
              debugPrint('Blocked suspicious main-frame navigation: $url');
              return NavigationDecision.prevent;
            }

            return NavigationDecision.navigate;
          },
          onPageStarted: (url) {
            debugPrint('[ANIME WEBVIEW] Page started: $url');
            if (!mounted) return;
            setState(() {
              _pageLoaded = false;
              _videoReady = false;
              _isAppFullScreen = false;
            });
          },
          onPageFinished: (url) {
            debugPrint('[ANIME WEBVIEW] Page finished: $url');
            if (mounted) {
              setState(() => _pageLoaded = true);
            }
            _startSmartIsolation();
            _attachFullscreenBridge();
            Future.delayed(
              const Duration(milliseconds: 1200),
              _preferHighQualityPlayback,
            );
            Future.delayed(const Duration(seconds: 3), _refreshPlaybackState);
          },
          onWebResourceError: (error) {
            debugPrint(
              '[ANIME WEBVIEW] Error main=${error.isForMainFrame} '
              'type=${error.errorType} code=${error.errorCode} '
              'desc=${error.description}',
            );
            if (!mounted || error.isForMainFrame != true) return;
            setState(() {
              _pageLoaded = true;
            });
          },
        ),
      )
      ..addJavaScriptChannel(
        'VideoStatus',
        onMessageReceived: (JavaScriptMessage message) {
          if (message.message == 'ready' && mounted) {
            setState(() {
              _videoReady = true;
            });
          }
        },
      )
      ..addJavaScriptChannel(
        'FullscreenStatus',
        onMessageReceived: (JavaScriptMessage message) {
          if (message.message == 'enter') {
            _setAppFullScreen(true);
          } else if (message.message == 'exit') {
            _setAppFullScreen(false);
          }
        },
      )
      ..loadRequest(
        widget.streamUrl.startsWith('http')
            ? Uri.parse(widget.streamUrl)
            : Uri.parse('about:blank'),
      );
  }

  Future<void> _refreshPlaybackState() async {
    if (!mounted || !_pageLoaded || _videoReady) return;

    final hasVisiblePlayer = await _detectVisiblePlayer();
    if (!mounted) return;
    if (hasVisiblePlayer) {
      setState(() {
        _videoReady = true;
      });
      _preferHighQualityPlayback();
    }
  }

  Future<void> _preferHighQualityPlayback() async {
    if (!_pageLoaded) return;
    try {
      await _controller.runJavaScript('''
        (() => {
          if (window.__gxPreferHighQualityAttached) return;
          window.__gxPreferHighQualityAttached = true;

          function isVisible(el) {
            if (!el) return false;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }

          function clickEl(el) {
            if (!el) return false;
            try { el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); } catch (_) {}
            try { el.click(); return true; } catch (_) { return false; }
          }

          function qualityScore(text) {
            if (!text) return 0;
            const v = text.toLowerCase().replace(/\\s+/g, '');
            if (v.includes('2160')) return 2160;
            if (v.includes('1440')) return 1440;
            if (v.includes('1080')) return 1080;
            if (v.includes('720')) return 720;
            if (v.includes('540')) return 540;
            if (v.includes('480')) return 480;
            if (v.includes('360')) return 360;
            if (v.includes('240')) return 240;
            if (v === 'hd') return 720;
            return 0;
          }

          function openSettingsIfAny() {
            const selectors = [
              '.jw-icon-settings',
              '.jw-settings-icon',
              '.plyr__control[data-plyr="settings"]',
              '.vjs-settings-button',
              '.vjs-menu-button',
              'button[aria-label*="setting" i]',
              'button[aria-label*="quality" i]',
              '[title*="setting" i]',
              '[title*="quality" i]'
            ];
            for (const selector of selectors) {
              const node = document.querySelector(selector);
              if (!node || !isVisible(node)) continue;
              clickEl(node);
            }
          }

          function pickBestQualityItem() {
            const nodes = Array.from(
              document.querySelectorAll('button, [role="menuitem"], li, a, div, span')
            );
            let bestNode = null;
            let bestScore = 0;

            for (const node of nodes) {
              if (!isVisible(node)) continue;
              const text = (node.textContent || '').trim();
              if (!text || text.length > 24) continue;
              const score = qualityScore(text);
              if (score < 480) continue;
              const classText = ((node.className || '') + '').toLowerCase();
              const roleText = (node.getAttribute && (node.getAttribute('role') || '')) || '';
              const isMenuLike =
                roleText.toLowerCase().includes('menu') ||
                classText.includes('menu') ||
                classText.includes('quality') ||
                classText.includes('setting') ||
                node.tagName === 'BUTTON' ||
                node.tagName === 'A' ||
                node.hasAttribute('tabindex');
              if (!isMenuLike) continue;

              if (score > bestScore) {
                bestScore = score;
                bestNode = node;
              }
            }

            return bestNode;
          }

          let attempts = 0;
          const timer = setInterval(() => {
            attempts++;
            if (attempts > 26) {
              clearInterval(timer);
              return;
            }

            openSettingsIfAny();
            const target = pickBestQualityItem();
            if (!target) return;

            if (clickEl(target)) {
              clearInterval(timer);
            }
          }, 700);
        })();
      ''');
    } catch (_) {
      // Best effort only; some providers block script access.
    }
  }

  Future<bool> _detectVisiblePlayer() async {
    try {
      final result = await _controller.runJavaScriptReturningResult('''
        (() => {
          const blocked = ['ad', 'banner', 'promo', 'qq', 'bet', 'casino', 'slot', 'judi'];
          const visibleVideo = Array.from(document.querySelectorAll('video')).some((v) => {
            const r = v.getBoundingClientRect();
            const s = window.getComputedStyle(v);
            return r.width >= 220 && r.height >= 120 && s.display !== 'none' && s.visibility !== 'hidden';
          });
          if (visibleVideo) return true;

          const visibleIframe = Array.from(document.querySelectorAll('iframe')).some((f) => {
            const src = (f.src || '').toLowerCase();
            const r = f.getBoundingClientRect();
            if (r.width < 220 || r.height < 120) return false;
            for (let i = 0; i < blocked.length; i++) {
              if (src.includes(blocked[i])) return false;
            }
            return src.startsWith('http') || src.startsWith('//');
          });
          return visibleIframe;
        })();
      ''');

      final normalized = result.toString().toLowerCase();
      return result == true || normalized == 'true' || normalized == '1';
    } catch (_) {
      return false;
    }
  }

  bool _looksLikeStreamingAsset(String rawUrl) {
    final url = rawUrl.toLowerCase();
    return url.startsWith('blob:') ||
        url.contains('.m3u8') ||
        url.contains('.ts');
  }

  bool _isBlockedAdUrl(String rawUrl) {
    final uri = Uri.tryParse(rawUrl);
    final host = uri?.host.toLowerCase() ?? '';
    if (host.isEmpty) return false;

    const blockedHostKeywords = <String>[
      'qq',
      '1xbet',
      'adsterra',
      'doubleclick',
      'exoclick',
      'popads',
      'shorte',
      'ouo',
      'judi',
      'casino',
      'slot',
      'togel',
      'toto',
      'gacor',
      'bola',
    ];

    return blockedHostKeywords.any(host.contains);
  }

  bool _isAllowedMainFrame(String rawUrl) {
    final uri = Uri.tryParse(rawUrl);
    final host = uri?.host.toLowerCase() ?? '';
    if (host.isEmpty) return true;

    if (_isBlockedAdUrl(rawUrl)) return false;

    const safeHostKeywords = <String>[
      'otakudesu',
      'vidhide',
      'odvidhide',
      'filemoon',
      'filedon',
      'desudrive',
      'ondesu',
      'mp4upload',
      'mega.nz',
      'stream',
      'embed',
    ];

    if (_startHost.isNotEmpty && host == _startHost) return true;
    return safeHostKeywords.any(host.contains);
  }

  Future<void> _startSmartIsolation() async {
    // Detect player element and isolate it into full-screen view.
    // Avoid auto-clicking quality/mirror links to prevent ad redirects.
    await _controller.runJavaScript('''
      (function() {
        var attempts = 0;

        function run() {
          attempts++;
          if (attempts > 80) return;

          // PLAYER DETECTION
          var iframes = document.querySelectorAll('iframe');
          var videoTag = document.querySelector('video');
          
          if (videoTag) {
            isolate(videoTag);
            return;
          }

          for (var j = 0; j < iframes.length; j++) {
            var s = iframes[j].src || '';
            if (s.includes('blogger.com/video.g') && !s.includes('vq=')) {
              s += (s.includes('?') ? '&' : '?') + 'vq=hd720';
              iframes[j].src = s;
            }
            if (s.includes('http') && !s.includes('ads') && 
                (s.includes('player') || s.includes('embed') || s.includes('vidhide') || s.includes('filemoon') || s.includes('blogger.com/video.g'))) {
              isolate(iframes[j]);
              return;
            }
          }
          
          setTimeout(run, 500);
        }

        function isolate(el) {
          el.style.position = 'fixed';
          el.style.top = '0';
          el.style.left = '0';
          el.style.width = '100vw';
          el.style.height = '100vh';
          el.style.zIndex = '99999999';
          el.style.background = 'black';
          
          var shield = document.getElementById('gx-shield') || document.createElement('div');
          shield.id = 'gx-shield';
          shield.style.position = 'fixed';
          shield.style.top = '0'; shield.style.left = '0';
          shield.style.width = '100%'; shield.style.height = '100%';
          shield.style.background = 'black';
          shield.style.zIndex = '99999998';
          if(!document.getElementById('gx-shield')) document.body.appendChild(shield);
          
          document.body.appendChild(el);
          document.body.style.overflow = 'hidden';
          
          // Auto-click play button if it's a known provider
          if (location.href.includes('vidhide') || location.href.includes('filemoon')) {
             document.body.click();
          }

          VideoStatus.postMessage('ready');
        }

        run();
      })();
    ''');
  }

  Future<void> _attachFullscreenBridge() async {
    await _controller.runJavaScript('''
      (() => {
        if (window.__gxFullscreenBridgeAttached) return;
        window.__gxFullscreenBridgeAttached = true;

        function isFullScreenActive() {
          return !!(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
          );
        }

        function notifyState() {
          FullscreenStatus.postMessage(isFullScreenActive() ? 'enter' : 'exit');
        }

        document.addEventListener('fullscreenchange', notifyState, true);
        document.addEventListener('webkitfullscreenchange', notifyState, true);
        document.addEventListener('mozfullscreenchange', notifyState, true);
        document.addEventListener('MSFullscreenChange', notifyState, true);

        // Best effort fallback for players that trigger custom fullscreen buttons.
        document.addEventListener('click', (e) => {
          const target = e.target;
          if (!target) return;
          const node = target.closest
            ? target.closest('button, [role="button"], .jw-icon, .vjs-fullscreen-control, .plyr__control')
            : target;
          if (!node) return;
          const hint = (
            (node.getAttribute && (
              node.getAttribute('aria-label') ||
              node.getAttribute('title') ||
              node.getAttribute('class')
            )) || ''
          ).toLowerCase();
          if (hint.includes('full') || hint.includes('screen')) {
            setTimeout(notifyState, 200);
            setTimeout(() => FullscreenStatus.postMessage('enter'), 300);
          }
        }, true);
      })();
    ''');
  }

  Future<void> _setAppFullScreen(bool enable) async {
    if (!mounted) return;
    if (_isAppFullScreen == enable) return;

    if (!enable) {
      await SystemChrome.setEnabledSystemUIMode(
        SystemUiMode.edgeToEdge,
        overlays: SystemUiOverlay.values,
      );
      await SystemChrome.setPreferredOrientations([
        DeviceOrientation.portraitUp,
        DeviceOrientation.landscapeLeft,
        DeviceOrientation.landscapeRight,
      ]);
      if (mounted) setState(() => _isAppFullScreen = false);
      return;
    }

    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    await SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    if (mounted) setState(() => _isAppFullScreen = true);
  }

  Future<void> _toggleAppFullScreen() async {
    await _setAppFullScreen(!_isAppFullScreen);
  }

  @override
  void dispose() {
    _hideAndroidCustomWidget?.call();
    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _androidCustomWidget == null,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && _androidCustomWidget != null) {
          _hideAndroidCustomWidget?.call();
        }
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        body: Stack(
          children: [
            // WebView is visible once 'ready' is fired
            Positioned.fill(
              child: Opacity(
                opacity: _pageLoaded ? 1.0 : 0.01,
                child: WebViewWidget(controller: _controller),
              ),
            ),

            if (_androidCustomWidget != null)
              Positioned.fill(
                child: ColoredBox(
                  color: Colors.black,
                  child: _androidCustomWidget!,
                ),
              ),

            if (!_pageLoaded)
              Container(
                color: Colors.black,
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const CircularProgressIndicator(color: Color(0xFF6C5CE7)),
                      const SizedBox(height: 32),
                      const Text(
                        'MENYIAPKAN HALAMAN VIDEO',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 2.0,
                        ),
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'Mendeteksi player dan memuat stream...',
                        style: TextStyle(color: Colors.white54, fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ),

            if (_androidCustomWidget == null)
              Positioned(
                top: MediaQuery.of(context).padding.top + 10,
                left: 10,
                child: CircleAvatar(
                  backgroundColor: Colors.black45,
                  child: IconButton(
                    icon: const Icon(Icons.arrow_back, color: Colors.white),
                    onPressed: () => Navigator.pop(context),
                  ),
                ),
              ),

            if (_androidCustomWidget == null)
              Positioned(
                top: MediaQuery.of(context).padding.top + 10,
                right: 10,
                child: CircleAvatar(
                  backgroundColor: Colors.black45,
                  child: IconButton(
                    icon: Icon(
                      _isAppFullScreen
                          ? Icons.fullscreen_exit
                          : Icons.fullscreen,
                      color: Colors.white,
                    ),
                    onPressed: _toggleAppFullScreen,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
