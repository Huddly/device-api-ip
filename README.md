<p>
  <a href="https://travis-ci.com/Huddly/device-api-ip"><img src="https://travis-ci.com/Huddly/device-api-ip.svg?branch=master" alt="Build Status"></a>
  <a href="https://www.npmjs.com/package/@huddly/device-api-ip"><img src="https://badge.fury.io/js/%40huddly%2Fdevice-api-ip.svg" alt="npm badge"></a>
  <a href="https://npmcharts.com/compare/@huddly/device-api-ip?minimal=true"><img src="https://img.shields.io/npm/dm/@huddly/device-api-ip.svg?style=flat" alt="NPM Downloads"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-brightgreen.svg" alt="MIT badge"></a>
  <a href="http://commitizen.github.io/cz-cli/"><img src="https://img.shields.io/badge/commitizen-friendly-brightgreen.svg" alt="Commitizen badge"></a>
</p>


# Huddly SDK - Device Api IP
Huddly SDK device api which uses grpc as transport protocol for communicating with the huddly network/ip cameras

>[!IMPORTANT]  
>
><b>No longer in active developement.</b> We strongly recommend using the [.NET-SDK](https://developer.huddly.com/) going forward.
></br>
></br>
In an effort to meet future demand for how we interact and communicate with our USB devices, we are modernizing our software development kit (SDK). Part of this process is switching over to the .NET framework. The new SDK has the capability to communicate with a proxy service that we run on Windows hosts. The purpose of this proxy service is to bypass a limitation where only one client can communicate with a usb device at any given time. This makes it possible for ours and anyone else's software to communicate with our devices in parallel, without the software clients getting in the way of each other. This services is gradually rolling out on all Windows systems using cameras connected through the Huddly USB Adapter. 
></br>
></br>
By the end of the year (2024) the USB proxy will be installed on all Windows systems using a Huddly IQ or camera connected through the Huddly USB Adapter. Using the JS-SDK to integrate with IQ or Huddly USB Adapter connected cameras will no longer be possible on these hosts.

## Licence
[MIT](LICENCE)
