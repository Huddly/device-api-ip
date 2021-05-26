import chai from 'chai';
import HuddlyDevice from './../src/networkdevice';

const expect = chai.expect;
chai.should();

describe('HuddlyDeviceApiIP', () => {
  describe('constructor', () => {
    it('should initialize with default values', () => {
      const device: HuddlyDevice = new HuddlyDevice();
      expect(device.name).to.equal(undefined);
      expect(device.mac).to.equal(undefined);
      expect(device.ip).to.equal(undefined);
      expect(device.serial).to.equal(undefined);
      expect(device.types).to.equal(undefined);
      expect(device.scopes).to.equal(undefined);
      expect(device.xaddrs).to.equal(undefined);
      expect(device.modelName).to.equal(undefined);
      expect(device.manufacturer).to.equal(undefined);
      expect(device.metadataVersion).to.equal(undefined);
      expect(device.messageId).to.equal(undefined);
    });
    it('should initialize attributes from map', () => {
      const data = {
        name: 'L1',
        mac: 'A1:B2:C3:D4:E5:f6',
        manufacturer: 'Huddly',
        ip: '1.2.3.4',
        serial: '156434325642',
        modelName: 'ORANGE'
      };
      const device: HuddlyDevice = new HuddlyDevice(data);
      expect(device.name).to.equal(data.name);
      expect(device.mac).to.equal(data.mac);
      expect(device.ip).to.equal(data.ip);
      expect(device.serial).to.equal(data.serial);
      expect(device.modelName).to.equal(data.modelName);
      expect(device.manufacturer).to.equal(data.manufacturer);
    });
  });

  describe('#toString', () => {
    it('should return a string representation of the network device', () => {
      const data = {
        name: 'L1',
        mac: 'A1:B2:C3:D4:E5:F6',
        manufacturer: 'Huddly',
        ip: '1.2.3.4',
        serial: '156434325642',
        modelName: 'ORANGE'
      };
      const device: HuddlyDevice = new HuddlyDevice(data);
      const expectedStr = `Name: ${device.name} | Manufactorer: ${device.manufacturer} | Serial: ${device.serial} | MAC Address: ${device.mac} | IPv4 Address: ${device.ip}`;
      expect(device.toString()).to.equal(expectedStr);
    });
    it('should return a string representation of a unknown device', () => {
      const device: HuddlyDevice = new HuddlyDevice();
      const expectedStr = `Name: Unknown | Manufactorer: Unknown | Serial: Unknown | MAC Address: Unknown | IPv4 Address: Unknown`;
      expect(device.toString()).to.equal(expectedStr);
    });
  });

  describe('#equals', () => {
    describe('should match', () => {
      it('when mac addresses match', () => {
        const d1 = new HuddlyDevice({mac: 'A1:B2:C3:D4:E5:F6'});
        const d2 = new HuddlyDevice({mac: 'A1:B2:C3:D4:E5:F6'});
        expect(d1.equals(d2)).to.equal(true);
      });
      it('when mac is missing but serial is same', () => {
        const d1 = new HuddlyDevice({serial: '156434325642'});
        const d2 = new HuddlyDevice({serial: '156434325642'});
        expect(d1.equals(d2)).to.equal(true);
      });
      it('when mac & serial is missing but ip is same', () => {
        const d1 = new HuddlyDevice({ip: '1.2.3.4'});
        const d2 = new HuddlyDevice({ip: '1.2.3.4'});
        expect(d1.equals(d2)).to.equal(true);
      });
    });
    describe('should not match', () => {
      it('when device is null', () => {
        const d1 = new HuddlyDevice({ip: '1.2.3.4'});
        expect(d1.equals(undefined)).to.equal(false);
      });
      it('when mac address is different', () => {
        const d1 = new HuddlyDevice({mac: 'A1:B2:C3:D4:E5:F6'});
        const d2 = new HuddlyDevice({mac: 'A1:B2:C3:D4:E5:F3'});
        expect(d1.equals(d2)).to.equal(false);
      });
      it('when mac is null but serial is different', () => {
        const d1 = new HuddlyDevice({serial: '156434325642'});
        const d2 = new HuddlyDevice({serial: '456434325642'});
        expect(d1.equals(d2)).to.equal(false);
      });
      it('when mac & serial are null but ip is different', () => {
        const d1 = new HuddlyDevice({ip: '1.2.3.4'});
        const d2 = new HuddlyDevice({ip: '1.2.3.10'});
        expect(d1.equals(d2)).to.equal(false);
      });
    });
  });
});
