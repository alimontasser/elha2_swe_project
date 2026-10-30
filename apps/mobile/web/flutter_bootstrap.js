{{flutter_js}}
{{flutter_build_config}}

// Load without a service worker: Flutter's service worker is deprecated, and the demo is
// served from hosts and iframes where service workers are unavailable.
_flutter.loader.load();
