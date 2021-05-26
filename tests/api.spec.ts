import chai from 'chai';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';
import { EventEmitter } from 'events';

import GrpcTransport from './../src/transport';
import HuddlyDeviceApiIP from './../src/index';
import HuddlyDevice from './../src/networkdevice';

const expect = chai.expect;
chai.should();
chai.use(sinonChai);

const dummyLogger = {
  warn: () => { },
  info: () => { },
  error: () => { },
  debug: () => { }
};

const mockedDevices: HuddlyDevice[] = [
  new HuddlyDevice({
    name: 'L1',
    serial: '1234566445',
    manufacturer: 'Huddly',
    mac: 'FF:FF:FF:FF:FF:FF',
    ip: '',
    types: [],
    scopes: [],
    xaddrs: 'Unknown',
    modelName: 'Unknown',
    metadataVersion: 'Unknown',
    messageId: 'Unknown',
  }),
  new HuddlyDevice({
    name: 'DUMMY',
    serial: '12000045',
    manufacturer: 'JohnDoe Co',
    mac: 'FF:FF:FF:FF:FF:FF',
    ip: '',
    types: [],
    scopes: [],
    xaddrs: 'Unknown',
    modelName: 'Unknown',
    metadataVersion: 'Unknown',
    messageId: 'Unknown',
  }),
];

const dummyDeviceDiscoveryManager = {
  registerForHotplugEvents: () => { },
  deviceList: () => { return mockedDevices; },
  getDevice: () => { }
};

describe('HuddlyDeviceApiIP', () => {
  let deviceApi: HuddlyDeviceApiIP;
  beforeEach(() => {
    deviceApi = new HuddlyDeviceApiIP({
      logger: dummyLogger,
      manager: dummyDeviceDiscoveryManager
    });
  });

  describe('#registerForHotplugEvents', () => {
    it('should initialize event emitter and register hotplug events on device manager', async () => {
      const emitter = new EventEmitter();
      const spy = sinon.spy(deviceApi.deviceDiscoveryManager, 'registerForHotplugEvents');
      expect(deviceApi.eventEmitter).to.be.undefined;
      await deviceApi.registerForHotplugEvents(emitter);
      expect(deviceApi.eventEmitter).to.be.instanceof(EventEmitter);
      expect(spy.callCount).to.equal(1);
    });
  });

  describe('#getDeviceDiscoveryApi', () => {
    it('should return the device discovery manager instance', async () => {
      const deviceDiscoveryApi = await deviceApi.getDeviceDiscoveryAPI();
      expect(deviceDiscoveryApi).to.equal(dummyDeviceDiscoveryManager);
    });
  });

  describe('#getValidatedTransport', () => {
    describe('for undefined device', () => {
      it('should not initialize a transport implementation', async () => {
        const transport = await deviceApi.getValidatedTransport(undefined);
        expect(transport).to.be.undefined;
      });
    });

    describe('for L1', () => {
      let transportstub;
      let getTransportStub;
      beforeEach(() => {
        transportstub = sinon.createStubInstance(GrpcTransport);
      });
      afterEach(() => {
        getTransportStub.restore();
      });

      it('should support grpc transport implementation', async () => {
        getTransportStub = sinon.stub(deviceApi, 'getTransport').returns(transportstub);
        const supported = await deviceApi.getValidatedTransport(mockedDevices[0]);
        expect(supported).to.be.instanceof(GrpcTransport);
      });

      it('should not support device when init fails', async () => {
        getTransportStub = sinon.stub(deviceApi, 'getTransport').returns(Promise.reject());
        const supported = await deviceApi.getValidatedTransport(mockedDevices[0]);
        expect(supported).to.equal(undefined);
      });

      it('should not support non-Huddly devices', async () => {
        const supported = await deviceApi.getValidatedTransport(mockedDevices[1]);
        expect(supported).to.equal(undefined);
      });
    });
  });

  describe('#isUVCControlsSupported', () => {
    it('should not support UVC controls', async () => {
      const uvcSupport = await deviceApi.isUVCControlsSupported(mockedDevices[0]);
      expect(uvcSupport).to.equal(false);
    });
  });

  describe('#getUVCControlAPIForDevice', () => {
    it('should throw error when calling getUVCControlAPIForDevice for node-usb device api', async () => {
      try {
        await deviceApi.getUVCControlAPIForDevice(mockedDevices[0]);
        expect(true).to.equal(false);
      } catch (e) {
        expect(e.message).to.equal('UVCControlInterface API not supported for network/ip cameras');
      }
    });
  });

  describe('#isHIDSupported', () => {
    it('should not support HID', async () => {
      const hidSupport = await deviceApi.isHIDSupported(mockedDevices[0]);
      expect(hidSupport).to.equal(false);
    });
  });

  describe('#getHIDApiForDevice', () => {
    it('should throw error when calling getHIDAPIForDevice for node-usb device api', async () => {
      try {
        await deviceApi.getHIDAPIForDevice(mockedDevices[0]);
        expect(true).to.equal(false);
      } catch (e) {
        expect(e.message).to.equal('HID not supported for network/ip cameras');
      }
    });
  });
});