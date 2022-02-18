#### 0.1.6 (2022-02-18)

##### Chores

*  Build & Test with node 16 ([1111ccfa](https://github.com/Huddly/device-api-ip/commit/1111ccfa5e9c808b5cf6cd892d104333420fc3ac))
*  resolve dependeny vulnerabilities ([0812ff2e](https://github.com/Huddly/device-api-ip/commit/0812ff2e1dc8085934051a48f1fcc49354b80ccb))

##### New Features

*  Slack notify when build fails (master) ([debfca33](https://github.com/Huddly/device-api-ip/commit/debfca33d91375e3ea0a8fc3ed26da9a145d4bfe))
*  Cron trigger master branch (Mon-Fri @ 0700) ([7566f332](https://github.com/Huddly/device-api-ip/commit/7566f3326674f97a35f08698596e17781d71f9c0))
*  Allow audit check to have a whitelist ([17b97f8e](https://github.com/Huddly/device-api-ip/commit/17b97f8e9fd062ad76243b7d7083c26d222f2371))
*  Introduce dependency audit-check ([d0579133](https://github.com/Huddly/device-api-ip/commit/d0579133de7ba856eb436580cbd61ade821d6d68))

##### Bug Fixes

*  Wsdd discover only huddly manufactured devices ([08f84221](https://github.com/Huddly/device-api-ip/commit/08f84221ab80fda1508c218a32b4d58882d8f193))
*  Vulnerability check fix with node 16 ([9cb9167b](https://github.com/Huddly/device-api-ip/commit/9cb9167b2d5e5b776df5d3758169990ffa075acc))
*  Update registry url for npmjs to use https ([e2d68e0a](https://github.com/Huddly/device-api-ip/commit/e2d68e0ae39f6b117519d5b0c71048e129198fb3))
* **package.json:**  Win does not recognize '.' ([1187fce3](https://github.com/Huddly/device-api-ip/commit/1187fce32c97c91c69d40741306041452d66ca62))

##### Refactors

*  Remove unused code ([c5d72176](https://github.com/Huddly/device-api-ip/commit/c5d7217670db2aa5ad7ff6f5fdeb191c474b0ca2))

##### Tests

*  Install chalk-js for terminal styling ([9a564e21](https://github.com/Huddly/device-api-ip/commit/9a564e219d443e7bf3fcc8a22c7b8f8c2cff49d7))

#### 0.1.5 (2022-01-26)

##### New Features

*  only probe link local interfaces as default ([3908ae4f](https://github.com/Huddly/device-api-ip/commit/3908ae4fa6cff0da3aae376473bf37303e4d247a))
*  replace travis with githubactions ([a406e921](https://github.com/Huddly/device-api-ip/commit/a406e921cd6d31f6d4d7748785aee25f1b12e3eb))

##### Bug Fixes

* **networkdevice:**  mac addr comparison igore case ([9e2cfda9](https://github.com/Huddly/device-api-ip/commit/9e2cfda981b85d556a509058929d0176ef3a66d8))

##### Other Changes

*  Add ~ for sdk to safly install all patch versions ([31580441](https://github.com/Huddly/device-api-ip/commit/315804419935e59ec906db6c410e68f9f18c1e8f))
*  Emit serialnumber and not device for DETACH event (to correspond with api-usb). ([dda2e0ce](https://github.com/Huddly/device-api-ip/commit/dda2e0cef6d734484468d77bc23725d4d50f3f73))

##### Refactors

*  Use @huddly/sdk-interfaces ([935049ee](https://github.com/Huddly/device-api-ip/commit/935049eee1e66806394876cf51e52311ada3f875))

#### 0.1.4 (2021-08-25)

##### Chores

*  bump sdk dependency to v0.6.1 ([6e49400c](https://github.com/Huddly/device-api-ip/commit/6e49400c647a81d87e0448b286bcf32af540435c))

##### Documentation Changes

* **Readme:**  Add package badges ([98ae5a8c](https://github.com/Huddly/device-api-ip/commit/98ae5a8ceb95005bfe0f8e4a94b48468aaf29cc5))

##### Bug Fixes

*  Update the L1 PID ([9c2f9113](https://github.com/Huddly/device-api-ip/commit/9c2f91136e37b27267127d9803d12fa07525d9ee))

