import chai from 'chai';
import sinon from 'sinon';
import sleep from 'await-sleep';

import HuddlyHEX from '@huddly/sdk-interfaces/lib/enums/HuddlyHex';

import HuddlyDevice from './../src/networkdevice';
import WsDiscovery from './../src/wsdiscovery';
import dgram from 'dgram';
import uuid from 'node-uuid';
import { EventEmitter } from 'events';
import os from 'os';

const expect = chai.expect;
chai.should();
class DummySocket extends EventEmitter {
    send() {}
    close() {}
    bind() {}
    setMulticastInterface() {}
}

const dummyNetworkInterfaces = {
    baseInterface: [
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
    linkLocalInterface: [
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
            address: '169.254.158.50',
            netmask: '255.255.0.0',
            family: 'IPv4',
            mac: 'ff:ff:fc:90:2d:a9',
            internal: false,
            cidr: '169.254.158.50/16',
        },
    ],
    targetInterface: [
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
            address: '195.88.54.16',
            netmask: '255.255.255.255',
            family: 'IPv4',
            mac: 'ff:ff:fc:ff:ff:a9',
            internal: false,
            cidr: '195.88.54.16/32',
        },
    ],
};

describe('WsDiscovery', () => {
    const aD1: HuddlyDevice = new HuddlyDevice({ mac: 'A1' });
    let wsdd: WsDiscovery, createSocketStub, networkInterfacesStub, bindStub;
    const wsddOptions = {
        timeout: 10,
    };
    let dummySocket: DummySocket;
    beforeEach(() => {
        dummySocket = new DummySocket();
        createSocketStub = sinon.stub(dgram, 'createSocket' as any).returns(dummySocket);
        bindStub = sinon.stub(dummySocket, 'bind');
        networkInterfacesStub = sinon
            .stub(os, 'networkInterfaces' as any)
            .returns(dummyNetworkInterfaces);
    });

    afterEach(() => {
        createSocketStub.restore();
        networkInterfacesStub.restore();
        bindStub.restore();
    });

    describe('#initNetworkInterfaces', () => {
        describe('One or more link local interfaces', () => {
            it('should only init all link local interfaces', () => {
                wsdd = new WsDiscovery(wsddOptions);
                expect(wsdd.socketConnections.baseInterface).to.equal(dummySocket);
                expect(wsdd.socketConnections.linkLocalInterface).to.equal(dummySocket);
                expect(wsdd.socketConnections.baseInterface).to.not.equal(undefined);
                expect(wsdd.socketConnections.linkLocalInterface).to.not.equal(undefined);
                expect(Object.keys(wsdd.socketConnections).length).to.equal(2);
            });

            it('should create sockets that bind to the respecitve interface addresses', () => {
                wsdd = new WsDiscovery(wsddOptions);
                expect(createSocketStub.calledTwice).to.equal(true);
                expect(createSocketStub.getCall(0).args[0]).to.equal('udp4');
                expect(createSocketStub.getCall(1).args[0]).to.equal('udp4');
                expect(bindStub.getCall(0).args[0].address).to.equal(
                    dummyNetworkInterfaces.baseInterface[1].address
                );
                expect(bindStub.getCall(1).args[0].address).to.equal(
                    dummyNetworkInterfaces.linkLocalInterface[1].address
                );
            });
        });

        describe('targeted interface', () => {
            it('should only bind to matching interface if an address is provided', () => {
                wsdd = new WsDiscovery({
                    targetInterfaceAddr: '195.88.54.16',
                });
                expect(bindStub).to.have.been.calledWith({ address: '195.88.54.16' });
                expect(Object.keys(wsdd.socketConnections).length).to.equal(1);
                expect(wsdd.socketConnections.targetInterface).to.not.equal(undefined);
            });
            it('should only bind to matching interface if a name is provided', () => {
                wsdd = new WsDiscovery({
                    targetInterfaceName: 'targetInterface',
                });
                expect(bindStub).to.have.been.calledWith({ address: '195.88.54.16' });
                expect(Object.keys(wsdd.socketConnections).length).to.equal(1);
                expect(wsdd.socketConnections.targetInterface).to.not.equal(undefined);
            });
            it('should do nothing if address is provided an no matching interface is found', () => {
                wsdd = new WsDiscovery({
                    targetInterfaceAddr: '195.88.54.12',
                });
                expect(bindStub).to.have.callCount(0);
            });
            it('should do nothing if name is provided an no matching interface is found', () => {
                wsdd = new WsDiscovery({
                    targetInterfaceName: 'nothing',
                });
                expect(bindStub).to.have.callCount(0);
            });
        });

        describe('probe entire network', () => {
            it('should create only one socket named default that probes the entire network', () => {
                wsdd = new WsDiscovery({ probeEntireNetwork: true });
                expect(Object.keys(wsdd.socketConnections).length).to.equal(1);
                expect(wsdd.socketConnections.default).to.not.equal(undefined);
                expect(bindStub.getCall(0).args.length).to.equal(0);
            });
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

        it('should start watching network interfaces', () => {
            wsdd = new WsDiscovery(wsddOptions);
            expect(wsdd.networkInterfacesWatcher).to.not.equal(undefined);
        });
    });

    describe('#bindSocket', () => {
        let socket, bindSpy;
        beforeEach(() => {
            wsdd = new WsDiscovery(wsddOptions);
            socket = new DummySocket();
            bindSpy = sinon.spy(socket, 'bind');
        });
        afterEach(() => {
            bindSpy.restore();
        });
        it('should bind socket to provided ip address', () => {
            wsdd.bindSocket({ ip: '0.0.0.0', interfaceName: 'A name' }, socket);
            expect(bindSpy).to.have.been.calledOnce;
            expect(bindSpy).to.have.been.calledWith({ address: '0.0.0.0' });
        });

        it('should bind socket to the whole network when no ip address is provided', () => {
            wsdd.bindSocket({ ip: undefined, interfaceName: 'Default' }, socket);
            expect(bindSpy).to.have.been.calledOnce;
            expect(bindSpy.getCall(0).args.length).to.equal(0);
        });
    });

    describe('#networkInterfacesWatcher', () => {
        let clock;
        beforeEach(() => {
            clock = sinon.useFakeTimers();
        });
        afterEach(() => {
            clock.restore();
        });

        describe('default state', () => {
            it('should have a socket bind to any new link local interfaces that appears', () => {
                wsdd = new WsDiscovery();
                networkInterfacesStub.restore();
                networkInterfacesStub = sinon.stub(os, 'networkInterfaces' as any).returns({
                    ...dummyNetworkInterfaces,
                    newOne: [
                        {},
                        {
                            family: 'IPv4',
                            address: '169.254.0.0',
                        },
                    ],
                });

                clock.tick(1001);
                expect(wsdd.socketConnections.newOne).to.equal(dummySocket);
                expect(bindStub.getCall(2).args[0].address).to.equal('169.254.0.0');
                expect(Object.keys(wsdd.socketConnections).length).to.equal(3);
            });

            it('should close the socket and remove it if a network interface disappears', () => {
                sinon.spy(dummySocket, 'close');
                wsdd = new WsDiscovery();
                networkInterfacesStub.restore();
                networkInterfacesStub = sinon
                    .stub(os, 'networkInterfaces' as any)
                    .returns({ baseInterface: dummyNetworkInterfaces.baseInterface });

                clock.tick(1001);
                expect(wsdd.socketConnections.linkLocalInterface).to.equal(undefined);
                expect(Object.keys(wsdd.socketConnections).length).to.equal(1);
                expect(dummySocket.close).to.have.callCount(1);
            });
        });
        describe('targeted address or name', () => {
            it('should connect to interface with target address if it appears', () => {
                networkInterfacesStub.restore();
                networkInterfacesStub = sinon
                    .stub(os, 'networkInterfaces' as any)
                    .returns({ baseInterface: dummyNetworkInterfaces.baseInterface });
                wsdd = new WsDiscovery({ targetInterfaceAddr: '195.88.54.16' });
                networkInterfacesStub.restore();
                networkInterfacesStub = sinon
                    .stub(os, 'networkInterfaces' as any)
                    .returns({ targetInterface: dummyNetworkInterfaces.targetInterface });

                clock.tick(1001);

                expect(wsdd.socketConnections.targetInterface).to.equal(dummySocket);
                expect(bindStub.getCall(0).args[0].address).to.equal('195.88.54.16');
                expect(Object.keys(wsdd.socketConnections).length).to.equal(1);
            });
        });
        it('should do nothing if its setup to probe entire network', () => {
            wsdd = new WsDiscovery({ probeEntireNetwork: true });
            const findNetworkStub = sinon.stub(wsdd, 'findNetworkInterfaces').returns({
                linkLocalMaps: [],
                targetInterface: { ip: undefined, interfaceName: '' },
            });
            clock.tick(1001);
            expect(wsdd.findNetworkInterfaces).to.have.callCount(0);
            findNetworkStub.restore();
        });
    });
    describe('#findNetworkInterfaces', () => {
        it('should return all link local interfaces', () => {
            networkInterfacesStub.returns(dummyNetworkInterfaces);
            wsdd = new WsDiscovery(wsddOptions);
            const netInterfaces = wsdd.findNetworkInterfaces();
            expect(netInterfaces.linkLocalMaps).to.deep.equal([
                { ip: '169.254.158.54', interfaceName: 'baseInterface' },
                { ip: '169.254.158.50', interfaceName: 'linkLocalInterface' },
            ]);
        });
        it('should ignore ipv6 interfaces', () => {
            const dummyNetworkInterfaces = { baseKey: [{ family: 'IPv6' }] };
            networkInterfacesStub.returns(dummyNetworkInterfaces);
            wsdd = new WsDiscovery(wsddOptions);
            const netInterfaces = wsdd.findNetworkInterfaces();
            expect(netInterfaces.linkLocalMaps.length).to.equal(0);
        });
        it('should ignore non-link local interfaces', () => {
            const dummyNetworkInterfaces = {
                notLinkLocal: [{ family: 'IPv4', address: '142.4.42.2' }],
            };
            networkInterfacesStub.returns(dummyNetworkInterfaces);
            wsdd = new WsDiscovery(wsddOptions);
            const netInterfaces = wsdd.findNetworkInterfaces();
            expect(netInterfaces.linkLocalMaps.length).to.equal(0);
        });
        it('should return the targeted interface by name', () => {
            networkInterfacesStub.returns(dummyNetworkInterfaces);
            wsdd = new WsDiscovery({ ...wsddOptions, targetInterfaceName: 'targetInterface' });
            const netInterfaces = wsdd.findNetworkInterfaces();
            expect(netInterfaces.targetInterface).to.deep.equal({
                ip: '195.88.54.16',
                interfaceName: 'targetInterface',
            });
        });
        it('should return the targeted interface by ip', () => {
            networkInterfacesStub.returns(dummyNetworkInterfaces);
            wsdd = new WsDiscovery({ ...wsddOptions, targetInterfaceAddr: '195.88.54.16' });
            const netInterfaces = wsdd.findNetworkInterfaces();
            expect(netInterfaces.targetInterface).to.deep.equal({
                ip: '195.88.54.16',
                interfaceName: 'targetInterface',
            });
        });
    });

    describe('#isDeviceAllowed', () => {
        it('should allow link local addresses by default', () => {
            wsdd = new WsDiscovery({ ...wsddOptions });
            const allowed = wsdd.isDeviceAllowed('169.254.10.10');
            expect(allowed).to.equal(true);
        });
        it('link local should be ignored when option says so and probing entire network', () => {
            wsdd = new WsDiscovery({
                ...wsddOptions,
                probeEntireNetwork: true,
                ignoreLinkLocalDevices: true,
            });
            const allowed = wsdd.isDeviceAllowed('169.254.10.10');
            expect(allowed).to.equal(false);
        });
        it('should allow anything when not probing entire network', () => {
            wsdd = new WsDiscovery(wsddOptions);
            const allowed = wsdd.isDeviceAllowed('10.1.0.10');
            expect(allowed).to.equal(true);
        });
        it('should not allow devices with localhost ip address', () => {
            wsdd = new WsDiscovery(wsddOptions);
            const allowed = wsdd.isDeviceAllowed('127.0.0.1');
            expect(allowed).to.equal(false);
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
            expect(pid).to.equal(HuddlyHEX.L1_PID);
        });
        it('should return custom PID for S1', () => {
            wsdd = new WsDiscovery(wsddOptions);
            const pid: number = wsdd.networkDevicePID('S1');
            expect(pid).to.equal(HuddlyHEX.S1_PID);
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

        it('should not consider non huddly manufactured devices', done => {
            const wsddEmitSpy = sinon.spy();
            uuidstub = sinon.stub(uuid, 'v4' as any).returns('12345');
            wsdd = new WsDiscovery({ timeout: 10000 });
            const data: any = {
                serialNumber: '122211222',
                mac: 'A1:B2:C3:D4:F5:11',
            };
            const huddlyProbeMatch = `
                <?xml version="1.0" encoding="UTF-8"?>
                <SOAP-ENV:Envelope xmlns:SOAP-ENV="http://www.w3.org/2003/05/soap-envelope">
                <SOAP-ENV:Header>
                    <wsa:RelatesTo>urn:uuid:12345</wsa:RelatesTo>
                </SOAP-ENV:Header>
                <SOAP-ENV:Body>
                    <wsdd:ProbeMatches>
                    <wsdd:ProbeMatch>
                        <wsdd:Scopes>onvif://www.onvif.org/name/Dummy onvif://www.onvif.org/Profile/Streaming onvif://www.onvif.org/serial/${data.serialNumber} onvif://www.onvif.org/mac/${data.mac}</wsdd:Scopes>
                        <wsdd:XAddrs>http://1.1.1.1:1000/onvif/device_service</wsdd:XAddrs>
                        <wsdd:MetadataVersion>1.2</wsdd:MetadataVersion>
                    </wsdd:ProbeMatch>
                    </wsdd:ProbeMatches>
                </SOAP-ENV:Body>
                </SOAP-ENV:Envelope>
            `;

            wsdd.on('device', wsddEmitSpy);
            let deviceEmitCallCount = 0;
            let cbDeviceListCount = 0;
            const cb = (devices: HuddlyDevice[]) => {
                deviceEmitCallCount += wsddEmitSpy.callCount;
                cbDeviceListCount += devices.length;
            };
            wsdd.probe(cb);
            setTimeout(() => {
                expect(deviceEmitCallCount).to.equal(0);
                expect(cbDeviceListCount).to.equal(0);
                done();
            }, 500);
            dummySocket.emit('message', Buffer.from(huddlyProbeMatch));
        });

        it('should return empty list for probes not related to messageId', done => {
            const msgId: String = '12345';
            uuidstub = sinon.stub(uuid, 'v4' as any).returns(msgId);
            wsdd = new WsDiscovery({
                timeout: 10000,
                socket: dummySocket,
                targetInterfaceAddr: dummyNetworkInterfaces.targetInterface[1].address,
            });
            const huddlyProbeMatch = `
        <?xml version="1.0" encoding="UTF-8"?>
        <SOAP-ENV:Envelope xmlns:SOAP-ENV="http://www.w3.org/2003/05/soap-envelope">
          <SOAP-ENV:Header>
            <wsa:RelatesTo>urn:uuid:000000000000000</wsa:RelatesTo>
          </SOAP-ENV:Header>
        </SOAP-ENV:Envelope>
      `;

            const clock = sinon.useFakeTimers();
            const cb = (devices: HuddlyDevice[]) => {
                expect(devices.length).to.equal(0);
                done();
            };
            wsdd.probe(cb);
            dummySocket.emit('message', Buffer.from(huddlyProbeMatch));
            clock.tick(10005);
            clock.restore();
        });

        it('should return empty list when there is no probe match', done => {
            wsdd = new WsDiscovery({
                timeout: 100,
                socket: dummySocket,
                targetInterfaceAddr: dummyNetworkInterfaces.targetInterface[1].address,
            });

            const cb = (devices: HuddlyDevice[]) => {
                expect(devices.length).to.equal(0);
                done();
            };
            wsdd.probe(cb);
        });

        it('should not send probe messages if there are no sockets bounds to any interface', () => {
            wsdd = new WsDiscovery({ timeout: 100, socket: dummySocket, targetInterfaceAddr: '0' });
            wsdd.probe();
            expect(setTimeoutStub).to.have.not.been.calledOnce;
        });

        it('should run callback with empty list when there is no interfaces to probe', () => {
            networkInterfacesStub.restore();
            networkInterfacesStub = sinon.stub(os, 'networkInterfaces' as any).returns({});

            const cb = sinon.stub();
            wsdd = new WsDiscovery({});
            wsdd.probe(cb);
            expect(cb).to.have.been.calledWith([]);
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

        it('should close socket for all the connections made', () => {
            wsdd = new WsDiscovery({ socket: dummySocket });
            wsdd.close();
            expect(socketCloseStub).to.have.callCount(2);
            expect(wsdd.socketConnections).to.equal(undefined);
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

        it('should clear networkInterfacesWatcher interval if it was set', () => {
            sinon.spy(global, 'clearInterval');
            wsdd = new WsDiscovery({ socket: dummySocket });
            wsdd.close();
            expect(clearInterval).to.have.been.calledOnce;
            expect(wsdd.networkInterfacesWatcher).to.be.undefined;
        });
    });
});
