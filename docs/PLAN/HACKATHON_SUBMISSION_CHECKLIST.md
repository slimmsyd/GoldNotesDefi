# GoldBack Hackathon Submission Checklist

## Submission Target
- [ ] Submit the native Android app from `mobile-app/`
- [ ] Use the `preview` APK path as the primary build artifact
- [ ] Confirm the build uses a reviewer-reachable backend, not `10.0.2.2`

## Eligibility Checks
- [ ] Confirm the project work submitted for the hackathon started within the allowed window
- [ ] Confirm the team has not raised outside capital
- [ ] Prepare a concise statement explaining the mobile work added during the hackathon
- [ ] Verify all claims in the submission form are factually correct

## Required Deliverables
- [ ] Functional Android APK
- [ ] GitHub repo link
- [ ] Demo video
- [ ] Pitch deck or brief presentation

## Android Build Checklist
- [ ] `mobile-app/eas.json` `preview` profile is the build target
- [ ] APK build command is `npm run eas:build:preview`
- [ ] Build metadata is archived:
  - [ ] APK filename
  - [ ] commit hash
  - [ ] backend URL
  - [ ] checksum
- [ ] Local release build is either verified or explicitly deferred until Java 17+ is installed
- [ ] Release signing path is documented and ready for follow-up hardening

## Mobile-Specific Evidence Checklist
- [ ] Native `android/` project exists
- [ ] Expo dev client workflow is used for wallet-native runtime
- [ ] Solana Mobile Wallet Adapter packages are present
- [ ] Mobile-specific navigation exists
- [ ] Wallet sheet / mobile auth exists
- [ ] Checkout persistence and restart recovery exist
- [ ] The app is clearly not a PWA wrapper

## Functional Smoke Checklist
- [ ] App installs on Android
- [ ] App launches without native-module runtime errors
- [ ] Gold Collection loads pricing and product imagery
- [ ] Wallet entry point is visible and usable
- [ ] Checkout path works end to end in the demo environment
- [ ] Authenticated endpoints return expected data
- [ ] Pending checkout recovery works after restart
- [ ] Dashboard, Vault, and Redeem surfaces load without crashing

## Demo Video Checklist
- [ ] Demo is recorded from the Android app, not the web app
- [ ] Demo follows `PLAN/DEMO_SCRIPT.md`
- [ ] Video clearly shows native mobile navigation
- [ ] Video clearly shows Gold Collection and checkout
- [ ] Video clearly shows at least one mobile-specific capability
- [ ] Video does not claim unfinished flows are live

## Pitch Deck / Brief Checklist
- [ ] Problem
- [ ] Solution
- [ ] Why mobile matters
- [ ] What was built during the hackathon
- [ ] Architecture summary
- [ ] Demo flow
- [ ] Roadmap after submission

## Final Submission Checklist
- [ ] Repo link works from a clean browser session
- [ ] APK link downloads successfully
- [ ] Video link works
- [ ] Deck link works
- [ ] Submission form fields are double-checked
- [ ] All materials are submitted before the deadline
