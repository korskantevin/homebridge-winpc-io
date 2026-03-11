# Change Log

All notable changes to homebridge-winpc-io will be documented in this file

## [Unreleased]
- Add ping ability instead of URL GET to check status, this will allow not to install Airytec он PC, but Airytec still will be needed for Turn PC off.
- Change plugin from Accessory Plugin to Dynamic Platform Plugin using homebridge-plugin-template. This step is need to get Verified Plugin status.
- Check HomeBridge v2.0 compatability and made plugin Release.

## [0.4.7] - 2026-03-11

### Fixed

- setPowerState callback for HAP-NodeJS 

## [0.4.6] - 2025-10-20

### Other Changes

- Some package.json fixes

## [0.4.5] - 2025-09-15

### Fixed

- when polling request geting error but value was already seted. returning seted value instead of error value

## [0.4.4] - 2025-09-15

### Added

- CHANGELOG.md - All notable changes to homebridge-winpc-io will be documented in this file.

## [0.4.3] - 2025-09-15

### Other Changes

- created fork from homebridge-winpc v0.3.47

### Added

- Wait after set interval. This param helps skip geting false walue after seting state. Polling will be sipped and curent set value will be returned.
- config.schema.json - implementation of the Homebridge Plugin Settings GUI.