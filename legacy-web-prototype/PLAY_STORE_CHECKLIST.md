# Varna Parking Google Play Checklist

## Build

- Install JDK 11 or newer.
- Run `npm run mobile:build`.
- Open `android/` in Android Studio or run `cd android && .\gradlew.bat bundleRelease`.
- Configure release signing before uploading the AAB.

## Permissions

- Location: required to submit a parking probability signal.
- Notifications: used for the parking timer warning.
- Network: used for map tiles and crowdsourced availability data.

## Store Listing

- App name: Varna Parking
- Package: `com.varnaparking.app`
- Category: Maps & Navigation
- Short description: Crowdsourced parking probability map for Varna.
- Privacy note: location is used only when the user taps the report button.

## Release Checks

- Verify OpenStreetMap attribution is visible.
- Test low GPS accuracy messaging on a real device.
- Test notification permission flow on Android 13+.
- Confirm API production URL and MongoDB connection before release.
- Upload an AAB, not an unsigned debug APK.
