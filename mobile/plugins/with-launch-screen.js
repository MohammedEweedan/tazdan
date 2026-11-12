/**
 * iOS launch screen: plain brand navy (#24384F), no image.
 *
 * Without expo-splash-screen installed, Expo SDK 54's prebuild writes a white
 * launch screen with constraints to a logo view that doesn't exist. The app's
 * own splash (src/components/ui/LaunchSplash.tsx) starts on the same navy and
 * draws the ن, so the hand-off from the launch screen is invisible.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// #24384F → sRGB components.
const NAVY = { red: (0x24 / 255).toFixed(5), green: (0x38 / 255).toFixed(5), blue: (0x4f / 255).toFixed(5) };

const STORYBOARD = `<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="24093.7" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="EXPO-VIEWCONTROLLER-1">
    <device id="retina6_12" orientation="portrait" appearance="light"/>
    <dependencies>
        <deployment identifier="iOS"/>
        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="24053.1"/>
        <capability name="Safe area layout guides" minToolsVersion="9.0"/>
        <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
    </dependencies>
    <scenes>
        <scene sceneID="EXPO-SCENE-1">
            <objects>
                <viewController storyboardIdentifier="SplashScreenViewController" id="EXPO-VIEWCONTROLLER-1" sceneMemberID="viewController">
                    <view key="view" userInteractionEnabled="NO" contentMode="scaleToFill" insetsLayoutMarginsFromSafeArea="NO" id="EXPO-ContainerView" userLabel="ContainerView">
                        <rect key="frame" x="0.0" y="0.0" width="393" height="852"/>
                        <autoresizingMask key="autoresizingMask" flexibleMaxX="YES" flexibleMaxY="YES"/>
                        <subviews/>
                        <viewLayoutGuide key="safeArea" id="Rmq-lb-GrQ"/>
                        <constraints/>
                        <color key="backgroundColor" red="${NAVY.red}" green="${NAVY.green}" blue="${NAVY.blue}" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
                    </view>
                </viewController>
                <placeholder placeholderIdentifier="IBFirstResponder" id="EXPO-PLACEHOLDER-1" userLabel="First Responder" sceneMemberID="firstResponder"/>
            </objects>
            <point key="canvasLocation" x="0.0" y="0.0"/>
        </scene>
    </scenes>
    <resources>
        <namedColor name="SplashScreenBackground">
            <color red="${NAVY.red}" green="${NAVY.green}" blue="${NAVY.blue}" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
        </namedColor>
    </resources>
</document>
`;

module.exports = function withLaunchScreen(config) {
  // Expo's later storyboard mod expects subviews, constraints and resources
  // even when there is no logo. Keep those containers for clean prebuilds.
  return withDangerousMod(config, ['ios', async (c) => {
    const file = path.join(c.modRequest.platformProjectRoot, c.modRequest.projectName, 'SplashScreen.storyboard');
    fs.writeFileSync(file, STORYBOARD);
    return c;
  }]);
};
