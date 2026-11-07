import 'package:firebase_core/firebase_core.dart';

// Public Firebase settings for push notifications (US-11.01). They only identify the Firebase
// project to browsers and phones, so they are safe to commit. The secret service-account key
// never goes here: it stays with the backend. Each value can be overridden with --dart-define.

const _apiKey = String.fromEnvironment('FIREBASE_API_KEY');
const _appId = String.fromEnvironment('FIREBASE_APP_ID');
const _senderId = String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID');
const _projectId = String.fromEnvironment('FIREBASE_PROJECT_ID');

/// Web Push public key (Firebase → Cloud Messaging → Web Push certificates).
const firebaseVapidKey = String.fromEnvironment(
  'FIREBASE_VAPID_KEY',
  defaultValue: 'BCUa3nhWq8D-yZmov8otb6G2uf5qbVvcHfMNIFxNLSc4L3Az7sr4-n0LQuzIs_AllpDqFZBaxiExnGhwKCwVVbY',
);

/// Real pushes are on only when the whole web config is present; otherwise the demo mock is used.
const pushEnabled = _apiKey != '' && _appId != '' && _senderId != '' && _projectId != '';

const firebaseOptions = FirebaseOptions(
  apiKey: _apiKey,
  appId: _appId,
  messagingSenderId: _senderId,
  projectId: _projectId,
  authDomain: '$_projectId.firebaseapp.com',
);
