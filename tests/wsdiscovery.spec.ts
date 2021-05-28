import chai from 'chai';
import sinon from 'sinon';
import sleep from 'await-sleep';
import Logger from '@huddly/sdk/lib/src/utilitis/logger';
import HuddlyDevice from './../src/networkdevice';
import WsDiscovery from './../src/wsdiscovery';
import dgram from 'dgram';
import uuid from 'node-uuid';
import { EventEmitter } from 'events';

const expect = chai.expect;
chai.should();
const dummyLogger = sinon.createStubInstance(Logger);
class DummySocket extends EventEmitter {
    send() {}
    close() {}
}

describe('WsDiscovery', () => {
    const aD1: HuddlyDevice = new HuddlyDevice({ mac: 'A1' });
    let wsdd: WsDiscovery;
    const wsddOptions = {
        timeout: 10,
    };
    let dummySocket: DummySocket;
    beforeEach(() => {
        dummySocket = new DummySocket();
    });

    describe('constructor', () => {
        let createSocketStub;
        afterEach(() => {
            createSocketStub.restore();
        });
        it('should init class attributes', () => {
            createSocketStub = sinon.stub(dgram, 'createSocket' as any).returns(dummySocket);
            wsdd = new WsDiscovery(dummyLogger, wsddOptions);
            expect(wsdd.opts).to.deep.equal(wsddOptions);
            expect(wsdd.logger).to.equal(dummyLogger);
            expect(wsdd.socket).to.equal(dummySocket);
            expect(createSocketStub.calledOnce).to.equal(true);
            expect(createSocketStub.getCall(0).args[0]).to.equal('udp4');
        });
        it('should re emit socket error', async () => {
            const spy = sinon.spy();
            createSocketStub = sinon.stub(dgram, 'createSocket' as any).returns(dummySocket);
            wsdd = new WsDiscovery(dummyLogger, wsddOptions);
            wsdd.on('ERROR', spy);
            const errorMsg: String = 'Opps socket not initialized';
            dummySocket.emit('error', errorMsg);
            await sleep(250);
            expect(spy.called).to.equal(true);
            expect(spy.getCall(0).args[0]).to.equal(errorMsg);
        });
    });

    describe('#generateMessageId', () => {
        let uuidstub;
        afterEach(() => {
            uuidstub.restore();
        });

        it('should generate a uuid', () => {
            uuidstub = sinon.stub(uuid, 'v4' as any).returns('12345');
            wsdd = new WsDiscovery(dummyLogger, wsddOptions);
            const msgId = wsdd.generateMessageId();
            expect(msgId).to.equal(`urn:uuid:12345`);
        });
    });

    describe('#manufacturerFromMac', () => {
        it('should be Huddly', () => {
            wsdd = new WsDiscovery(dummyLogger, wsddOptions);
            const manufacturer = wsdd.manufacturerFromMac('90:E2:FC:90:12:EC');
            expect(manufacturer).to.equal('Huddly');
        });
        it('should not be Huddly', () => {
            wsdd = new WsDiscovery(dummyLogger, wsddOptions);
            const manufacturer = wsdd.manufacturerFromMac('A5-9F-BE-D6-E1-9B');
            expect(manufacturer).to.not.equal('Huddly');
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
            wsdd = new WsDiscovery(dummyLogger, wsddOptions);
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
            wsdd = new WsDiscovery(dummyLogger, wsddOptions);
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
            uuidstub.restore();
        });

        it('should construct a Huddly network device based on SOAP probe match', done => {
            const msgId: String = '12345';
            const wsddEmitSpy = sinon.spy();
            uuidstub = sinon.stub(uuid, 'v4' as any).returns(msgId);
            wsdd = new WsDiscovery(dummyLogger, { timeout: 10000, socket: dummySocket });
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
            wsdd = new WsDiscovery(dummyLogger, { timeout: 10000, socket: dummySocket });
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
            wsdd = new WsDiscovery(dummyLogger, { timeout: 100, socket: dummySocket });
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
            wsdd = new WsDiscovery(dummyLogger, { socket: dummySocket });
            wsdd.close();
            expect(socketCloseStub.called).to.equal(true);
            expect(wsdd.socket).to.equal(undefined);
        });
        it('should emit close when socket emits close event', () => {
            const spy = sinon.spy();
            wsdd = new WsDiscovery(dummyLogger, { socket: dummySocket });
            wsdd.on('close', spy);
            wsdd.close();
            dummySocket.emit('close');
            expect(socketCloseStub.called).to.equal(true);
            expect(spy.called).to.equal(true);
        });
    });
});
