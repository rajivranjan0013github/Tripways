#!/bin/bash

echo "🧹 Cleaning iOS build and cache files..."

# Go to ios folder
cd ios || exit

echo "🗑️ Removing Pods, Podfile.lock, and build folders..."
rm -rf Pods Podfile.lock build

echo "🧼 Removing Xcode DerivedData..."
rm -rf ~/Library/Developer/Xcode/DerivedData

echo "📦 Reinstalling Pods..."
pod install

# Return to root folder
cd ..

echo "✅ iOS cleanup complete!"
echo "🏗️ Building and running iOS app..."

# Run iOS app
npx react-native run-ios

echo "🎉 Done!"
