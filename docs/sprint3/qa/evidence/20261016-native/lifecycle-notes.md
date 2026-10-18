# Native test lifecycle notes — 16 October 2026

This is a retrospective record of successful tool events reported by the root
test operator during this session. Times are approximate Melbourne local time
(AEDT, UTC+11); they are not timestamps copied from raw process logs. These notes
must be read alongside the timestamped UI observations and screenshots.

## Process restarts

At approximately 08:15, the operator terminated Expo Go on both platforms using
the following dedicated process-lifecycle commands. Both returned exit code 0.

```sh
adb -s emulator-5554 shell am force-stop host.exp.exponent
xcrun simctl terminate 579524DE-E6EA-42AE-9AB7-12FD385A0D08 host.exp.Exponent
```

At approximately 08:20, the same two commands were repeated successfully, again
with exit code 0. Apps were relaunched through CUA-controlled device UI icons or
Expo Go recent-project history. Android UI interaction took place in IntelliJ
IDEA's Running Devices window. The commands above terminated the app process;
they did not clear app data or restart either device.

## Recovered setup and input incidents

The first Android reverse mappings for TCP ports 43189 and 8099 disappeared.
The operator restored these mappings at approximately 08:16, after which Expo Go
loaded Yoir. The earlier remote-update download error is therefore recorded as a
recovered setup incident, not a demonstrated Yoir product defect. See the service
diagnostics and `android-02-expo-load-error` observation for the captured failure.

During Android login, an initially mistyped password entered through the
on-screen keyboard returned an incorrect-credentials error. Correcting the input
allowed login to succeed. This input incident does not establish a login defect.

No later process restarts, cleanup, test result or persistence outcome is implied
by this retrospective note. Those require their own observations or records.
