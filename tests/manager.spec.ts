import sinon from 'sinon';
import chai, { expect } from 'chai';
import sinonChai from 'sinon-chai';
import sleep from 'await-sleep';

import DeviceDiscoveryManager from './../src/manager';
import { EventEmitter } from 'events';
import WsDiscovery from './../src/wsdiscovery';
import HuddlyDevice from './../src/networkdevice';

chai.should();
chai.use(sinonChai);
chai.use(require('chai-things')).use(require('chai-as-promised'));

const dummyWsdd = sinon.createStubInstance(WsDiscovery);

describe('DeviceDiscoveryManager', () => {
    let devicemanager: DeviceDiscoveryManager;
    const aD1: HuddlyDevice = new HuddlyDevice({ mac: 'A1' });
    const aD2: HuddlyDevice = new HuddlyDevice({ mac: 'A2' });
    const bD1: HuddlyDevice = new HuddlyDevice({ mac: 'B1' });
    const bD2: HuddlyDevice = new HuddlyDevice({ mac: 'A2' });
    const bD3: HuddlyDevice = new HuddlyDevice({ mac: 'B3' });

    beforeEach(() => {
        devicemanager = new DeviceDiscoveryManager({}, dummyWsdd);
    });

    afterEach(() => {
        devicemanager.destroy();
    });

    describe('constructor', () => {
        it('should initialize empty list of discovered devices', () => {
            expect(devicemanager.pollInterval).to.equal(undefined);
            expect(devicemanager.pollIntervalMs).to.equal(5000);
        });
    });

    describe('#registerForHotplugEvents', () => {
        let emitter;
        beforeEach(() => {
            emitter = new EventEmitter();
        });

        it('should call #setupProbePoke', () => {
            const spy = sinon.spy(devicemanager, 'setupProbePoke');
            devicemanager.registerForHotplugEvents(emitter);
            expect(spy.calledOnce).to.equals(true);
        });
    });

    describe('#listExcept', () => {
        const a: HuddlyDevice[] = [aD1, aD2];
        const b: HuddlyDevice[] = [bD1, bD2, bD3];
        it('should return all elements of A not present in B', () => {
            const res: HuddlyDevice[] = devicemanager.listExcept(a, b);
            expect(res.length).to.equal(1);
            expect(res[0].mac).to.equal(aD1.mac);
        });
        it('should return all elements of B not present in A', () => {
            const res: HuddlyDevice[] = devicemanager.listExcept(b, a);
            expect(res.length).to.equal(2);
            expect(res[0].mac).to.equal(bD1.mac);
            expect(res[1].mac).to.equal(bD3.mac);
        });
        it('should return an empty list when both arrays contain same elements', () => {
            const modA = [aD1, aD2];
            const modB = [aD1, aD2];
            const res1: HuddlyDevice[] = devicemanager.listExcept(modA, modB);
            const res2: HuddlyDevice[] = devicemanager.listExcept(modB, modA);
            expect(res1.length).to.equal(0);
            expect(res2.length).to.equal(0);
        });
    });

    describe('#probeHandler', () => {
        let emitter;
        beforeEach(() => {
            emitter = new EventEmitter();
        });

        it('should emit attach events for all elements present in new discoverd devices', () => {
            devicemanager = new DeviceDiscoveryManager({}, dummyWsdd);
            const attachSpy = sinon.spy();
            const detachSpy = sinon.spy();
            emitter.on('ATTACH', attachSpy);
            emitter.on('DETACH', detachSpy);
            devicemanager.registerForHotplugEvents(emitter);
            devicemanager.probeHandler([aD1, aD2]);
            expect(attachSpy.callCount).to.equal(2);
            expect(detachSpy.callCount).to.equal(0);
            expect(attachSpy.withArgs(aD1).calledOnce).to.equal(true);
            expect(attachSpy.withArgs(aD2).calledOnce).to.equal(true);
        });
        it('should emit detach events for all elements present ', () => {
            devicemanager = new DeviceDiscoveryManager({ preDiscoveredDevices: [aD1] }, dummyWsdd);
            const attachSpy = sinon.spy();
            const detachSpy = sinon.spy();
            emitter.on('ATTACH', attachSpy);
            emitter.on('DETACH', detachSpy);
            devicemanager.registerForHotplugEvents(emitter);
            devicemanager.probeHandler([aD2]);
            expect(attachSpy.callCount).to.equal(1);
            expect(detachSpy.callCount).to.equal(1);
            expect(attachSpy.withArgs(aD2).calledOnce).to.equal(true);
            expect(detachSpy.withArgs(aD1).calledOnce).to.equal(true);
        });
        it('should retain only devices currently reachable through wsdd', () => {
            devicemanager = new DeviceDiscoveryManager(
                { preDiscoveredDevices: [aD1, aD2] },
                dummyWsdd
            );
            const attachSpy = sinon.spy();
            const detachSpy = sinon.spy();
            emitter.on('ATTACH', attachSpy);
            emitter.on('DETACH', detachSpy);
            devicemanager.registerForHotplugEvents(emitter);
            devicemanager.probeHandler([aD2, bD1]);
            expect(attachSpy.callCount).to.equal(1);
            expect(detachSpy.callCount).to.equal(1);
            expect(devicemanager.pairedDevices.length).to.equal(2);
            expect(devicemanager.pairedDevices[0]).to.equal(aD2);
            expect(devicemanager.pairedDevices[1]).to.equal(bD1);
        });
    });

    describe('#setupProbePoke', () => {
        let probeHandlerStub;
        afterEach(() => {
            if (probeHandlerStub) {
                probeHandlerStub.restore();
            }
            devicemanager.destroy();
        });
        it('should call wsdd probe and handle device list to probeHandler', async () => {
            devicemanager = new DeviceDiscoveryManager({ pollInterval: 100 }, dummyWsdd);
            devicemanager.setupProbePoke();
            await sleep(150);
            expect(dummyWsdd.probe.callCount).gte(2);
        });
        it('should call probeHandler on each probe callback', async () => {
            devicemanager = new DeviceDiscoveryManager({ pollInterval: 100 }, dummyWsdd);
            dummyWsdd.probe.callsFake(cb => {
                cb([]);
            });
            probeHandlerStub = sinon.stub(devicemanager, 'probeHandler');
            devicemanager.setupProbePoke();
            await sleep(150);
            expect(probeHandlerStub.callCount).gte(2);
        });
    });

    describe('#destroy', () => {
        it('should clear interval and close wsdd', () => {
            const localWsddStub = sinon.createStubInstance(WsDiscovery);
            devicemanager = new DeviceDiscoveryManager({}, localWsddStub);
            devicemanager.destroy();
            expect(devicemanager.pollInterval).to.be.an('undefined');
            expect(localWsddStub.close.callCount).to.equal(1);
        });
    });

    describe('#deviceList', () => {
        it('should return whatever wsdd.probe resolves with', async () => {
            dummyWsdd.probe.callsFake(cb => {
                cb([aD1, aD2]);
            });
            const deviceList: HuddlyDevice[] = await devicemanager.deviceList();
            expect(deviceList.length).to.equal(2);
            expect(deviceList[0]).to.equal(aD1);
            expect(deviceList[1]).to.equal(aD2);
        });
    });

    describe('#getDevice', () => {
        const _D1: HuddlyDevice = new HuddlyDevice({ mac: 'A1', serialNumber: '12345' });
        const _D2: HuddlyDevice = new HuddlyDevice({ mac: 'A2', serialNumber: '56789' });
        const _D3: HuddlyDevice = new HuddlyDevice({ mac: 'B1', serialNumber: '98765' });
        const probeList: HuddlyDevice[] = [_D1, _D2, _D3];
        beforeEach(() => {
            dummyWsdd.probe.callsFake(cb => {
                cb(probeList);
            });
        });
        it('should resolve device if the given serial matches', async () => {
            const found: HuddlyDevice = await devicemanager.getDevice(_D3.serialNumber.toString());
            expect(found).to.equal(_D3);
        });
        it('should resolve with first discovered device if serial not specified', async () => {
            const found: HuddlyDevice = await devicemanager.getDevice();
            expect(found).to.equal(_D1);
        });
        it('should reject if non of discovered devices match with given serial', () => {
            const promise = devicemanager.getDevice('no_serial');
            return expect(promise).to.eventually.be.rejectedWith(
                `Could not find device with serial no_serial amongst ${probeList.length} devices!`
            );
        });
    });
});
