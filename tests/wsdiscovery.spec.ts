import chai from 'chai';
import sinon from 'sinon';
import sleep from 'await-sleep';
import HuddlyDevice from './../src/networkdevice';
import WsDiscovery from './../src/wsdiscovery';
import { HUDDLY_L1_PID } from '@huddly/sdk/lib/src/components/device/factory';
import dgram from 'dgram';
import uuid from 'node-uuid';
import { EventEmitter } from 'events';
import os from 'os';

const expect = chai.expect;
chai.should();
class DummySocket extends EventEmitter {
    send() {}
    close() {}
    bind(cb) {
        cb();
    }
    setMulticastInterface() {}
}

const dummyNetworkInterfaces = {
    baseKey: [
        {
            address: 'fe80::b4d4:8905:c723:9e36',
            netmask: 'ffff:ffff:ffff:ffff::',
            family: 'IPv6',
            mac: '90:e2:fc:90:2d:a9',
            scopeid: 13,
            internal: false,
            cidr: 'fe80::b4d4:8905:c723:9e36/64',
        },
        {
            address: '169.254.158.54',
            netmask: '255.255.0.0',
            family: 'IPv4',
            mac: '90:e2:fc:90:2d:a9',
            internal: false,
            cidr: '169.254.158.54/16',
        },
    ],
    dummyKey: [
        {
            address: 'ffff::fff:8905:c723:9e36',
            netmask: 'ffff:ffff:ffff:ffff::',
            family: 'IPv6',
            mac: 'ff:ff:fc:90:2d:a9',
            scopeid: 13,
            internal: false,
            cidr: 'fe80::b4d4:8905:c723:9e36/64',
        },
        {
            address: '169.254.158.54',
            netmask: '255.255.0.0',
            family: 'IPv4',
            mac: 'ff:ff:fc:90:2d:a9',
            internal: false,
            cidr: '169.254.158.54/16',
        },
    ],
};

describe('WsDiscovery', () => {
    const aD1: HuddlyDevice = new HuddlyDevice({ mac: 'A1' });
    let wsdd: WsDiscovery, createSocketStub, networkInterfacesStub;
    const wsddOptions = {
        timeout: 10,
    };
    let dummySocket: DummySocket;
    beforeEach(() => {
        dummySocket = new DummySocket();
        createSocketStub = sinon.stub(dgram, 'createSocket' as any).returns(dummySocket);
        networkInterfacesStub = sinon
            .stub(os, 'networkInterfaces' as any)
            .returns(dummyNetworkInterfaces);
    });

    afterEach(() => {
        createSocketStub.restore();
        networkInterfacesStub.restore();
    });

    describe('#bindSocket', () => {
        it('should init class attributes', () => {
            wsdd = new WsDiscovery(wsddOptions);
            expect(wsdd.socket).to.equal(dummySocket);
            expect(createSocketStub.calledOnce).to.equal(true);
            expect(createSocketStub.getCall(0).args[0]).to.equal('udp4');
        });
        it('should re emit socket error', async () => {
            wsdd = new WsDiscovery(wsddOptions);
            const errorMessagePromise = new Promise(res => wsdd.on('ERROR', res));
            const errorMsg: String = 'Opps socket not initialized';
            dummySocket.emit('error', errorMsg);
            await sleep(250);
            const errorMessage = await errorMessagePromise;
            expect(errorMessage).to.equal(errorMsg);
        });

        it('should set multicast interface to provided interface addr', () => {
            sinon.spy(dummySocket, 'setMulticastInterface');
            wsdd = new WsDiscovery({
                targetInterfaceAddr: '127.0.0.1',
            });

            expect(dummySocket.setMulticastInterface).to.have.been.calledWith('127.0.0.1');
        });

        it('should use base interface address by default', () => {
            sinon.spy(dummySocket, 'setMulticastInterface');

            wsdd = new WsDiscovery();

            expect(dummySocket.setMulticastInterface).to.have.been.calledWith('169.254.158.54');
        });

        describe('watchInterface', () => {
            let watchIfSpy;
            beforeEach(() => {
                watchIfSpy = sinon.spy(WsDiscovery.prototype, 'watchInterface');
            });
            afterEach(() => {
                watchIfSpy.restore();
            });
            it('should call watchInterface for default when no BASE device present', () => {
                networkInterfacesStub.returns({});
                wsdd = new WsDiscovery();
                expect(watchIfSpy.called).to.equal(true);
                expect(watchIfSpy.getCall(0).args[0]).to.equal('default');
            });
            it('should call watchInterface for BASE interface', () => {
                wsdd = new WsDiscovery();
                expect(watchIfSpy.called).to.equal(true);
                expect(watchIfSpy.getCall(0).args[0]).to.equal('baseKey');
            });
        });
    });

    describe('#watchInterface', () => {
        let bindSocketStub, clock;
        beforeEach(() => {
            bindSocketStub = sinon.stub(WsDiscovery.prototype, 'bindSocket');
            clock = sinon.useFakeTimers();
        });
        afterEach(() => {
            bindSocketStub.restore();
            clock.restore();
        });

        describe('NO BASE', () => {
            it('should not setup watcher for default interface', () => {
                wsdd = new WsDiscovery();
                wsdd.watchInterface('default');
                expect(wsdd.interfaceWatcher).to.be.undefined;
            });
        });
        describe('BASE interface', () => {
            it('should close socket when BASE interface is disconnected', () => {
                bindSocketStub.restore();
                sinon.spy(dummySocket, 'close');
                wsdd = new WsDiscovery();
                clock.tick(1000);
                networkInterfacesStub.returns({});
                clock.tick(1000);
                expect(dummySocket.close).to.have.been.called;
                expect(wsdd.ifStateConnected).to.equal(false);
            });
            it('should re-bind socket when interface is re discovered/attached', () => {
                bindSocketStub.restore();
                wsdd = new WsDiscovery();
                const spy = sinon.spy(wsdd, 'bindSocket');
                wsdd.ifStateConnected = false;
                clock.tick(1000);
                clock.tick(1000);
                expect(spy).to.have.been.called;
                expect(wsdd.ifStateConnected).to.equal(true);
            });
        });
    });

    describe('#findL1HostInterface', () => {
        let manufacturerStub;
        beforeEach(() => {
            manufacturerStub = sinon.stub(WsDiscovery.prototype, 'manufacturerFromMac');
        });
        afterEach(() => {
            manufacturerStub?.restore();
        });
        it('should return a base interface', () => {
            const dummyNetworkInterfaces = {
                baseKey: [
                    {
                        address: '169.254.158.54',
                        family: 'IPv4',
                    },
                ],
            };
            networkInterfacesStub.returns(dummyNetworkInterfaces);
            manufacturerStub.returns(true);
            wsdd = new WsDiscovery(wsddOptions);
            const map = wsdd.findL1HostInterface();
            expect(map).to.deep.equal({ ip: '169.254.158.54', interface: 'baseKey' });
        });
        it('should ignore ipv6 interfaces', () => {
            const dummyNetworkInterfaces = { baseKey: [{ family: 'IPv6' }] };
            networkInterfacesStub.returns(dummyNetworkInterfaces);
            wsdd = new WsDiscovery(wsddOptions);
            const map = wsdd.findL1HostInterface();
            expect(map).to.deep.equal({ ip: undefined, interface: undefined });
        });
        it('should ignore non-huddly vendors', () => {
            const dummyNetworkInterfaces = { baseKey: [{ family: 'IPv4' }] };
            networkInterfacesStub.returns(dummyNetworkInterfaces);
            manufacturerStub.returns(false);
            wsdd = new WsDiscovery(wsddOptions);
            const map = wsdd.findL1HostInterface();
            expect(map).to.deep.equal({ ip: undefined, interface: undefined });
        });
        it('should return the targeted interface', () => {
            const dummyNetworkInterfaces = {
                base1Key: [{ family: 'IPv4', address: '169.254.158.54' }],
                base2Key: [{ family: 'IPv4', address: '169.254.158.55' }],
            };
            networkInterfacesStub.returns(dummyNetworkInterfaces);
            manufacturerStub.returns(true);
            wsdd = new WsDiscovery({ ...wsddOptions, targetInterfaceName: 'base2Key' });
            const map = wsdd.findL1HostInterface();
            expect(map).to.deep.equal({ ip: '169.254.158.55', interface: 'base2Key' });
        });
    });

    describe('#isDeviceAllowed', () => {
        it('should allow link local addresses by default', () => {
            wsdd = new WsDiscovery(wsddOptions);
            const allowed = wsdd.isDeviceAllowed('169.254.10.10');
            expect(allowed).to.equal(true);
        });
        it('link local should be ignored when option says so', () => {
            wsdd = new WsDiscovery({ ...wsddOptions, ignoreLinkLocalDevices: true });
            const allowed = wsdd.isDeviceAllowed('169.254.10.10');
            expect(allowed).to.equal(false);
        });
        it('should not allow anything beyond link local addresses by default', () => {
            wsdd = new WsDiscovery(wsddOptions);
            const allowed = wsdd.isDeviceAllowed('10.1.0.10');
            expect(allowed).to.equal(false);
        });
        it('should be allowed when option says so and ip is non-link local', () => {
            wsdd = new WsDiscovery({ ...wsddOptions, probeEntireNetwork: true });
            const allowed = wsdd.isDeviceAllowed('10.1.0.10');
            expect(allowed).to.equal(true);
        });
    });

    describe('#generateMessageId', () => {
        let uuidstub;
        afterEach(() => {
            uuidstub.restore();
        });

        it('should generate a uuid', () => {
            uuidstub = sinon.stub(uuid, 'v4' as any).returns('12345');
            wsdd = new WsDiscovery(wsddOptions);
            const msgId = wsdd.generateMessageId();
            expect(msgId).to.equal(`urn:uuid:12345`);
        });
    });

    describe('#manufacturerFromMac', () => {
        it('should be Huddly', () => {
            wsdd = new WsDiscovery(wsddOptions);
            const manufacturer = wsdd.manufacturerFromMac('90:E2:FC:90:12:EC');
            expect(manufacturer).to.equal('Huddly');
        });
        it('should not be Huddly', () => {
            wsdd = new WsDiscovery(wsddOptions);
            const manufacturer = wsdd.manufacturerFromMac('A5-9F-BE-D6-E1-9B');
            expect(manufacturer).to.not.equal('Huddly');
        });
    });

    describe('#networkDevicePID', () => {
        it('should return custom PID for L1', () => {
            wsdd = new WsDiscovery(wsddOptions);
            const pid: number = wsdd.networkDevicePID('L1');
            expect(pid).to.equal(HUDDLY_L1_PID);
        });
        it('should return 0 for unknown device name', () => {
            wsdd = new WsDiscovery(wsddOptions);
            const pid: number = wsdd.networkDevicePID('HelloWorld');
            expect(pid).to.equal(0x00);
        });
    });

    describe('#parseOnvifScopes', () => {
        const onvifScopes: String[] = [
            'onvif://www.onvif.org/name/L1',
            'onvif://www.onvif.org/Profile/Streaming',
            'onvif://www.onvif.org/type/video_encoder',
            'onvif://www.onvif.org/type/ptz',
            'onvif://www.onvif.org/hardware/810-00011-MBLK',
            'onvif://www.onvif.org/location/ANY',
            'onvif://www.onvif.org/serial/12101A0029',
            'onvif://www.onvif.org/mac/90:E2:FC:90:12:EC',
        ];

        beforeEach(() => {
            wsdd = new WsDiscovery(wsddOptions);
        });

        it('should parse Name scope', () => {
            const parsed = wsdd.parseOnvifScopes(onvifScopes, 'name');
            expect(parsed.length).to.equal(1);
            expect(parsed[0]).to.equal('L1');
        });
        it('should parse Profile scope', () => {
            const parsed = wsdd.parseOnvifScopes(onvifScopes, 'Profile');
            expect(parsed.length).to.equal(1);
            expect(parsed[0]).to.equal('Streaming');
        });
        it('should parse Types scope', () => {
            const parsed = wsdd.parseOnvifScopes(onvifScopes, 'type');
            expect(parsed.length).to.equal(2);
            expect(parsed[0]).to.equal('video_encoder');
            expect(parsed[1]).to.equal('ptz');
        });
        it('should parse Hardware scope', () => {
            const parsed = wsdd.parseOnvifScopes(onvifScopes, 'hardware');
            expect(parsed.length).to.equal(1);
            expect(parsed[0]).to.equal('810-00011-MBLK');
        });
        it('should parse Location scope', () => {
            const parsed = wsdd.parseOnvifScopes(onvifScopes, 'location');
            expect(parsed.length).to.equal(1);
            expect(parsed[0]).to.equal('ANY');
        });
        it('should parse Serial scope', () => {
            const parsed = wsdd.parseOnvifScopes(onvifScopes, 'serial');
            expect(parsed.length).to.equal(1);
            expect(parsed[0]).to.equal('12101A0029');
        });
        it('should parse Mac scope', () => {
            const parsed = wsdd.parseOnvifScopes(onvifScopes, 'mac');
            expect(parsed.length).to.equal(1);
            expect(parsed[0]).to.equal('90:E2:FC:90:12:EC');
        });
        it('should return default value when scope not found', () => {
            const parsed = wsdd.parseOnvifScopes(onvifScopes, 'unknown', ['helloworld']);
            expect(parsed.length).to.equal(1);
            expect(parsed[0]).to.equal('helloworld');
        });
    });

    describe('#makeDiscoveryBody', () => {
        it('should return default discovery body buffer', () => {
            const msgId = 'urn:uuid:1234';
            const body =
                '<?xml version="1.0" encoding="UTF-8"?>' +
                '<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope"' +
                'xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing"' +
                'xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"' +
                'xmlns:tds="https://www.onvif.org/ver10/device/wsdl/devicemgmt.wsdl"' +
                'xmlns:dn="http://www.onvif.org/ver10/network/wsdl">' +
                '<e:Header>' +
                `<w:MessageID>${msgId}</w:MessageID>` +
                '<w:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To>' +
                '<w:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action>' +
                '</e:Header>' +
                '<e:Body>' +
                '<d:Probe><d:Types>dn:NetworkVideoTransmitter</d:Types></d:Probe>' +
                '</e:Body>' +
                '</e:Envelope>';
            wsdd = new WsDiscovery(wsddOptions);
            const buff: Buffer = wsdd.makeDiscoveryBody(msgId);
            expect(buff).to.deep.equal(Buffer.from(body));
        });
    });

    describe('#probe', () => {
        let setTimeoutStub;
        let uuidstub;

        beforeEach(() => {
            setTimeoutStub = sinon.stub(WsDiscovery.prototype, 'setTimeoutWithRandomDelay');
        });
        afterEach(() => {
            setTimeoutStub.restore();
            uuidstub?.restore();
        });

        it('should construct a Huddly network device based on SOAP probe match', done => {
            const msgId: String = '12345';
            const wsddEmitSpy = sinon.spy();
            uuidstub = sinon.stub(uuid, 'v4' as any).returns(msgId);
            wsdd = new WsDiscovery({ timeout: 10000, socket: dummySocket });
            const data: any = {
                ip: '169.254.98.175',
                name: 'L1',
                profile: 'Streaming',
                types: ['video_encoder', 'ptz'],
                hardware: '810-00011-MBLK',
                location: 'ANY',
                serialNumber: '12101A0029',
                mac: '90:E2:FC:90:12:EC',
                metaDataVersion: '1.2',
            };
            const huddlyProbeMatch = `
        <?xml version="1.0" encoding="UTF-8"?>
        <SOAP-ENV:Envelope xmlns:SOAP-ENV="http://www.w3.org/2003/05/soap-envelope">
          <SOAP-ENV:Header>
            <wsa:RelatesTo>urn:uuid:${msgId}</wsa:RelatesTo>
          </SOAP-ENV:Header>
          <SOAP-ENV:Body>
            <wsdd:ProbeMatches>
              <wsdd:ProbeMatch>
                <wsdd:Scopes>onvif://www.onvif.org/name/${data.name} onvif://www.onvif.org/Profile/${data.profile} onvif://www.onvif.org/type/${data.types[0]} onvif://www.onvif.org/type/${data.types[1]} onvif://www.onvif.org/hardware/${data.hardware} onvif://www.onvif.org/location/${data.location} onvif://www.onvif.org/serial/${data.serialNumber} onvif://www.onvif.org/mac/${data.mac}</wsdd:Scopes>
                <wsdd:XAddrs>http://${data.ip}:1000/onvif/device_service</wsdd:XAddrs>
                <wsdd:MetadataVersion>${data.metaDataVersion}</wsdd:MetadataVersion>
              </wsdd:ProbeMatch>
            </wsdd:ProbeMatches>
          </SOAP-ENV:Body>
        </SOAP-ENV:Envelope>
      `;

            wsdd.on('device', wsddEmitSpy);
            const cb = (devices: HuddlyDevice[]) => {
                expect(devices.length).to.equal(1);
                expect(devices[0].ip).to.equal(data.ip);
                expect(devices[0].serialNumber).to.equal(data.serialNumber);
                expect(devices[0].name).to.equal(data.name);
                expect(devices[0].modelName).to.equal(data.hardware);
                expect(devices[0].types).to.deep.equal(data.types);
                expect(devices[0].xaddrs).to.equal(`http://${data.ip}:1000/onvif/device_service`);
                expect(devices[0].mac).to.equal(data.mac);
                expect(devices[0].metadataVersion).to.equal(data.metaDataVersion);
                expect(devices[0].manufacturer).to.equal('Huddly');
                expect(wsddEmitSpy.called).to.equal(true);
                expect(wsddEmitSpy.getCall(0).args[0]).to.equal(devices[0]);
                done();
            };
            wsdd.probe(cb);
            dummySocket.emit('message', Buffer.from(huddlyProbeMatch));
        });

        it('should return empty list for probes not related to messageId', done => {
            const msgId: String = '12345';
            uuidstub = sinon.stub(uuid, 'v4' as any).returns(msgId);
            wsdd = new WsDiscovery({ timeout: 10000, socket: dummySocket });
            const huddlyProbeMatch = `
        <?xml version="1.0" encoding="UTF-8"?>
        <SOAP-ENV:Envelope xmlns:SOAP-ENV="http://www.w3.org/2003/05/soap-envelope">
          <SOAP-ENV:Header>
            <wsa:RelatesTo>urn:uuid:000000000000000</wsa:RelatesTo>
          </SOAP-ENV:Header>
        </SOAP-ENV:Envelope>
      `;

            const cb = (devices: HuddlyDevice[]) => {
                expect(devices.length).to.equal(0);
                done();
            };
            wsdd.probe(cb);
            dummySocket.emit('message', Buffer.from(huddlyProbeMatch));
        });

        it('should return empty list when there is no probe match', done => {
            wsdd = new WsDiscovery({ timeout: 100, socket: dummySocket });
            const huddlyProbeMatch = `
        <?xml version="1.0" encoding="UTF-8"?>
        <SOAP-ENV:Envelope xmlns:SOAP-ENV="http://www.w3.org/2003/05/soap-envelope">
          <SOAP-ENV:Header>
            <wsa:RelatesTo>urn:uuid:000000000000000</wsa:RelatesTo>
          </SOAP-ENV:Header>
        </SOAP-ENV:Envelope>
      `;

            const cb = (devices: HuddlyDevice[]) => {
                expect(devices.length).to.equal(0);
                done();
            };
            wsdd.probe(cb);
        });

        it('should not send probe messages if interface where socket is bound is unavaliable', () => {
            wsdd = new WsDiscovery({ timeout: 100, socket: dummySocket });
            wsdd.ifStateConnected = false;
            wsdd.probe();
            expect(setTimeoutStub).to.have.not.been.calledOnce;
        });
    });

    describe('#close', () => {
        let socketCloseStub;
        beforeEach(() => {
            socketCloseStub = sinon.stub(dummySocket, 'close');
        });
        afterEach(() => {
            socketCloseStub.restore();
        });

        it('should close socket', () => {
            wsdd = new WsDiscovery({ socket: dummySocket });
            wsdd.close();
            expect(socketCloseStub.called).to.equal(true);
            expect(wsdd.socket).to.be.undefined;
        });
        it('should emit close when socket emits close event', () => {
            const spy = sinon.spy();
            wsdd = new WsDiscovery({ socket: dummySocket });
            wsdd.on('close', spy);
            wsdd.close();
            dummySocket.emit('close');
            expect(socketCloseStub.called).to.equal(true);
            expect(spy.called).to.equal(true);
        });

        it('should clear interfaceWatcher interval if it was set', () => {
            sinon.spy(global, 'clearInterval');
            wsdd = new WsDiscovery({ socket: dummySocket });
            wsdd.close();
            expect(clearInterval).to.have.been.calledOnce;
            expect(wsdd.interfaceWatcher).to.be.undefined;
        });
    });
});
