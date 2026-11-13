import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

/// Push notifications (Firebase Cloud Messaging).
///
/// OFF until a Firebase project exists. With `false` the app makes zero
/// Firebase calls (Firebase is never initialised).
///
/// To turn it on:
///  1. Create a Firebase project, add an Android app
///     (package `com.trackkaro.track_karo`) and an iOS app
///     (bundle id `com.trackkaro.trackKaro`).
///  2. Copy the values from the Firebase console (or `flutterfire configure`)
///     into the two FirebaseOptions below.
///  3. iOS only: upload an APNs key in Firebase > Cloud Messaging, and in
///     Xcode add the "Push Notifications" capability and the
///     "Remote notifications" background mode.
///  4. Set [kFirebaseEnabled] to true.
/// No google-services.json / GoogleService-Info.plist is needed: Firebase is
/// initialised from Dart with these options.
const bool kFirebaseEnabled = false;

const FirebaseOptions kFirebaseAndroidOptions = FirebaseOptions(
  apiKey: 'REPLACE_ANDROID_API_KEY',
  appId: 'REPLACE_ANDROID_APP_ID', // 1:1234567890:android:abcdef
  messagingSenderId: 'REPLACE_SENDER_ID',
  projectId: 'REPLACE_PROJECT_ID',
);

const FirebaseOptions kFirebaseIosOptions = FirebaseOptions(
  apiKey: 'REPLACE_IOS_API_KEY',
  appId: 'REPLACE_IOS_APP_ID', // 1:1234567890:ios:abcdef
  messagingSenderId: 'REPLACE_SENDER_ID',
  projectId: 'REPLACE_PROJECT_ID',
  iosBundleId: 'com.trackkaro.trackKaro',
);

FirebaseOptions get kFirebaseOptions =>
    defaultTargetPlatform == TargetPlatform.iOS
        ? kFirebaseIosOptions
        : kFirebaseAndroidOptions;
