# Change Log

All notable changes to homebridge-winpc-io will be documented in this file.

## v0.4.5 (2025-09-15)

### Fixed

- when polling request geting error but value was already seted. returning seted value instead of error value

## v0.4.4 (2025-09-15)

### Added

- CHANGELOG.md

## v0.4.3 (2025-09-15)

### Other Changes

- created fork from homebridge-winpc v0.3.47

### Added

- Wait after set interval. This param helps skip geting false walue after seting state. Polling will be sipped and curent set value will be returned.
- config.schema.json